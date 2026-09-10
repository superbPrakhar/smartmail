const express = require('express');
const { google } = require('googleapis');
const User = require('../models/User');
const Email = require('../models/Email');
const { analyzeEmail, generateAISummary } = require('../services/aiService');
const router = express.Router();

function cleanBody(text) {
  if (!text) return '';
  
  // Remove style and script tags and their contents entirely
  let cleaned = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // Convert basic HTML line breaks to actual newlines before stripping
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n');
  
  // Strip remaining HTML tags
  cleaned = cleaned.replace(/<[^>]*>?/gm, '');
  
  // Decode common HTML entities
  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'"
  };
  cleaned = cleaned.replace(/&[a-zA-Z0-9#]+;/g, match => entities[match] || ' ');
  
  // Condense multiple spaces/tabs into a single space (preserve newlines)
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
  
  // Condense 3+ newlines into exactly 2 newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}

function getBodyContent(payload) {
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }
  if (payload.parts) {
    let htmlPart = '';
    let textPart = '';
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain') {
        textPart = getBodyContent(part);
      } else if (part.mimeType === 'text/html') {
        htmlPart = getBodyContent(part);
      } else if (part.mimeType && part.mimeType.startsWith('multipart/')) {
        const nestedContent = getBodyContent(part);
        if (nestedContent) textPart = nestedContent;
      }
    }
    return textPart || htmlPart || '';
  }
  return '';
}

function getHeader(headers, name) {
  if(!headers) return '';
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

// ============================================
// FETCH EMAILS — Fast, no AI calls
// ============================================
router.get('/fetch', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.email === 'mockuser@smartmail.local' || !user.accessToken || !process.env.GOOGLE_CLIENT_ID) {
      return generateMockEmails(res, user._id, user.preferences);
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: user.accessToken, refresh_token: user.refreshToken });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const resp = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50
    });
    
    if (!resp.data.messages) return res.json({ message: 'No emails found' });
    
    const messages = resp.data.messages;
    
    // Process ALL 50 emails strictly in parallel to guarantee 4-10 seconds load time
    const batchResults = await Promise.all(messages.map(async (msg) => {
      try {
        // Check cache first
        let existingEmail = await Email.findOne({ emailId: msg.id });
        if (existingEmail) {
          // Dynamically re-score cached emails with updated user preferences
          const analysis = await analyzeEmail(
            existingEmail.subject || '', 
            existingEmail.body || existingEmail.snippet || '', 
            existingEmail.sender || '', 
            user.preferences
          );
          if (existingEmail.importanceScore !== analysis.importanceScore || existingEmail.category !== analysis.category) {
            existingEmail.importanceScore = analysis.importanceScore;
            existingEmail.category = analysis.category;
            existingEmail.tone = analysis.tone;
            existingEmail.timeRoiScore = analysis.timeRoiScore;
            if (analysis.wittyNotification) existingEmail.wittyNotification = analysis.wittyNotification;
            await existingEmail.save();
          }
          return existingEmail;
        }
        
        const messageData = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full' 
        });
        
        const headers = messageData.data.payload.headers;
        const subject = getHeader(headers, 'subject');
        const sender = getHeader(headers, 'from');
        const snippet = messageData.data.snippet;
        
        let bodyText = getBodyContent(messageData.data.payload);
        if (!bodyText) bodyText = snippet;
        
        bodyText = cleanBody(bodyText);

        // Quick analysis — scoring + categorization only, NO AI API call
        const analysis = await analyzeEmail(subject, bodyText, sender, user.preferences);
        
        const newEmail = new Email({
          emailId: msg.id,
          userId: user._id,
          subject,
          sender,
          snippet,
          body: bodyText,
          summary: analysis.summary,
          importanceScore: analysis.importanceScore,
          category: analysis.category,
          wittyNotification: analysis.wittyNotification,
          tone: analysis.tone,
          readTimeGst: analysis.readTimeGst,
          timeRoiScore: analysis.timeRoiScore,
          smartReplies: analysis.smartReplies,
          timestamp: new Date(parseInt(messageData.data.internalDate))
        });
        
        await newEmail.save();
        return newEmail;
      } catch (err) {
        console.error(`Error processing email ${msg.id}:`, err.message);
        return null;
      }
    }));
    
    const fetchedEmails = batchResults.filter(e => e !== null);
    fetchedEmails.sort((a,b) => b.importanceScore - a.importanceScore || b.timestamp - a.timestamp);
    res.json(fetchedEmails);

  } catch (err) {
    console.error('Fetch emails error', err);
    res.status(500).json({ error: err.message || 'Failed to fetch emails' });
  }
});

// ============================================
// ON-DEMAND AI SUMMARY — Called when user clicks on a single email
// ============================================
router.post('/summarize', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const { emailId, subject, body, sender } = req.body;
    
    if (!subject && !body) {
      return res.status(400).json({ error: 'Missing email data' });
    }
    
    // Generate AI summary on-demand
    const result = await generateAISummary(subject, body, sender);
    
    if (result.success) {
      // Cache the structured summary in MongoDB
      if (emailId) {
        await Email.findOneAndUpdate({ emailId }, {
          summary: JSON.stringify(result.data),
          aiProvider: result.metadata.aiProvider,
          aiModel: result.metadata.aiModel,
          actionRequired: result.data.action_required,
          deadline: result.data.deadline,
          importantPoints: result.data.important_points,
          summaryGeneratedAt: new Date()
        });
      }
      
      res.json({
        summary: result.data,
        metadata: result.metadata
      });
    } else {
      // Gemini unavailable — return graceful error
      res.json({
        summary: {
          summary: 'Gemini AI summary unavailable. Please ensure GEMINI_API_KEY is configured in backend/.env.',
          action_required: false,
          deadline: null,
          important_points: []
        },
        metadata: result.metadata,
        error: result.error
      });
    }
  } catch (err) {
    console.error('Summarize error:', err);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// ============================================
// AI STATUS — Check if Gemini API key is configured
// ============================================
const geminiLLMService = require('../services/geminiLLMService');

router.get('/ai/status', async (req, res) => {
  try {
    const status = await geminiLLMService.getStatus();
    res.json(status);
  } catch (err) {
    res.json({ available: false, provider: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
  }
});

async function generateMockEmails(res, userId, preferences) {
  const academicSubjects = [
    "URGENT: Final Project Deadline Extension",
    "Midterm Examination Schedule and Seat Plan",
    "Research Assistantship opening in AI/ML Lab",
    "Syllabus Update for Advanced Algorithms CS301",
    "Library Book Overdue Notice",
    "Academic Advising: Schedule your Spring semester review",
    "Invitation to Graduate Seminars on Deep Learning",
    "Grades Released: Systems Programming CS202",
    "Office Hours rescheduled for Prof. Miller this week",
    "Campus Safety Alert: Scheduled Maintenance in Science Complex",
    "Registration Open: Fall Course Enrollments",
    "Scholarship Application Results - Dean's Honor List",
    "Feedback Required: Campus Facilities Student Survey",
    "Project Milestone 2 Evaluation and Feedback",
    "Reminder: Course Evaluation due by Sunday night",
    "Guest Lecture: Ethics in Artificial Intelligence by Dr. Sarah",
    "Math Department Seminar on Chaos Theory"
  ];
  
  const internshipSubjects = [
    "Google Software Engineering Internship - Offer Details",
    "Microsoft Interview Status and Next Steps",
    "Meta Candidate Technical Screen Invitation",
    "Stripe Software Engineer Internship Application Update",
    "Nvidia Panel Interview Schedule Slot Selection",
    "Netflix: We would love to chat about your background!",
    "Amazon Web Services: Virtual Hiring Event Invitation",
    "OpenAI Residency Program Application Status Update",
    "GitHub Campus Expert invitation status",
    "Uber Engineering Internship: Final Round Invitation",
    "Airbnb Talent Acquisition: Internship opportunities",
    "Tesla Engineering Internship: Resume screening success",
    "Adobe Systems: Coding Assessment Link",
    "Salesforce Futureforce: Welcome to the pipeline!",
    "Palantir Technologies: Next steps in selection process",
    "ByteDance Engineering Team: Phone Screen Feedback"
  ];

  const eventsSubjects = [
    "Join us for the Annual Hackathon this weekend!",
    "RSVP: Developer Meetup - React and Tailwind discussion",
    "Workshop: Getting Started with Next.js & TypeScript",
    "TEDx Campus Event: Tickets now available",
    "Webinar: The Future of Agentic Coding and AI",
    "Networking Event: Meet Tech Founders at Downtown Cafe",
    "Vite Conf: Registration Confirmation",
    "Seminar: Cybersecurity trends in 2026",
    "Career Fair: Meet 50+ Top Tech Companies on Wednesday",
    "Startup Pitch Night: Call for student presentations",
    "Local Dev Fest 2026: Tickets and Agenda",
    "Algorithms Study Group Session - Join the Discord",
    "Open Source Contribution Day: Let's build together",
    "AI Art Exhibition: Invitation to Opening Ceremony",
    "Workshop: Build and Deploy Mobile Apps with Flutter",
    "Game Jam: 48 Hours to Build a Game!"
  ];

  const spamSubjects = [
    "50% off Udemy courses! Act fast, offer ends tonight!",
    "Clearance Sale: Up to 70% off selected electronics!",
    "Your weekly tech newsletter: What is new in AI",
    "Special Premium Trial: 1 Month free access inside!",
    "Unmissable deals: Save big on summer clothing",
    "Congratulations! You won a $100 gift card!",
    "Get rich quick with this one simple trick",
    "Special promotion: Earn 3x points on flights",
    "Limited time offer: Upgrade your cloud storage now",
    "Clearance event: Warehouse liquidation sales",
    "Earn cash back on everyday purchases - sign up!",
    "Don't miss out: Final hours to claim your discount",
    "Increase your productivity with these 10 tools"
  ];

  const uncategorizedSubjects = [
    "Dinner plans this weekend?",
    "Class notes for CS101 study session",
    "Hey! Long time no see, let's catch up",
    "Rent Due Reminder: June payment instructions",
    "Photos from our hiking trip last Sunday",
    "Question about your homework solution",
    "Happy Birthday! Have a wonderful day!",
    "Receipt for your subscription renewal",
    "Can you review this code snippet for me?",
    "Lost keys: Did anyone find car keys in the lounge?",
    "Checking in on how you're doing",
    "Weekend plans: Let's watch the game!",
    "Recipe for that amazing pasta we had",
    "Shared document: Group Project Draft",
    "Coffee break? Let's meet at Starbucks in 10 mins",
    "Update on family reunion planning"
  ];

  const categories = [
    { name: 'Academic', subjects: academicSubjects, senders: ['professor@university.edu', 'registrar@university.edu', 'advising@university.edu', 'dean@college.edu'] },
    { name: 'Internship', subjects: internshipSubjects, senders: ['recruiting@google.com', 'careers@microsoft.com', 'talent@meta.com', 'hiring@stripe.com', 'jobs@nvidia.com'] },
    { name: 'Events', subjects: eventsSubjects, senders: ['events@hackathon.org', 'meetup@dev.com', 'workshops@academy.io', 'tickets@tedx.edu'] },
    { name: 'Spam', subjects: spamSubjects, senders: ['marketing@udemy.com', 'deals@groupon.com', 'newsletters@techweekly.com', 'offers@shoppy.io'] },
    { name: 'Uncategorized', subjects: uncategorizedSubjects, senders: ['friend@gmail.com', 'mom@family.com', 'classmate@gmail.com', 'landlord@apartment.com'] }
  ];

  const mockData = [];

  // If user has custom critical keywords (e.g. "Kanohar Electricals"), inject dedicated mock emails
  if (preferences && Array.isArray(preferences.importantKeywords)) {
    preferences.importantKeywords.forEach((rawKw, kwIdx) => {
      const kw = (rawKw || '').trim();
      if (!kw) return;
      const customSubject = `URGENT: Project Action Item & Specifications for ${kw}`;
      const customSender = `${kw} Official <contact@${kw.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company'}.com>`;
      const customBody = `Dear Partner,\n\nThis is a high-priority communication regarding ${kw}. Please review the urgent deliverables and confirm the action items outlined below at your earliest convenience.\n\nBest regards,\n${kw} Management`;
      
      mockData.push({
        _id: `custom_kw_${kwIdx}`,
        emailId: `custom_kw_${kwIdx}`,
        subject: customSubject,
        sender: customSender,
        snippet: customBody.substring(0, 80) + '...',
        body: customBody,
        summary: customBody,
        category: 'Work',
        timestamp: new Date(Date.now() - kwIdx * 5 * 60 * 1000),
        importanceScore: 5,
        wittyNotification: `⚡ Critical Alert! Priority message regarding ${kw} requires your attention!`,
        tone: 'Urgent',
        readTimeGst: 15,
        timeRoiScore: 33.3,
        smartReplies: ["I'm on it immediately!", "Reviewed and confirmed.", "Let's discuss this on a call."],
        userId: userId
      });
    });
  }

  // Generate 80 standard mock emails
  const totalEmailsNeeded = 80;
  for (let i = 0; i < totalEmailsNeeded; i++) {
    const catConfig = categories[i % categories.length];
    
    // Pick subject and sender
    const subjectIndex = Math.floor(i / categories.length) % catConfig.subjects.length;
    const subject = catConfig.subjects[subjectIndex];
    const sender = catConfig.senders[Math.floor(Math.random() * catConfig.senders.length)];
    const emailId = `mock_${100 + i}`;
    const body = `This is the body content of the email regarding: "${subject}". Here is some additional text to make it feel like a real email. Please review the details carefully and take necessary action. If you have any questions, feel free to reply.`;
    
    // Run through actual priority scoring engine
    const analysis = await analyzeEmail(subject, body, sender, preferences);

    mockData.push({
      _id: emailId,
      emailId: emailId,
      subject: subject,
      sender: sender,
      snippet: `${body.substring(0, 60)}...`,
      body: body,
      summary: body,
      category: analysis.category || catConfig.name,
      timestamp: new Date(Date.now() - (i + 1) * 30 * 60 * 1000),
      importanceScore: analysis.importanceScore,
      wittyNotification: analysis.wittyNotification,
      tone: analysis.tone,
      readTimeGst: analysis.readTimeGst,
      timeRoiScore: analysis.timeRoiScore,
      smartReplies: analysis.smartReplies,
      userId: userId
    });
  }
  
  mockData.sort((a, b) => b.importanceScore - a.importanceScore || b.timestamp - a.timestamp);
  res.json(mockData);
}

// ============================================
// SEND EMAIL REPLY ROUTE
// ============================================
router.post('/send-reply', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { emailId, to, subject, replyText, threadId } = req.body;

    if (!to || !replyText) {
      return res.status(400).json({ error: 'Recipient email ("to") and reply text are required.' });
    }

    // Extract raw email address if formatted like "Sender Name <email@example.com>"
    let recipientEmail = to;
    const match = to.match(/<([^>]+)>/);
    if (match) {
      recipientEmail = match[1];
    }

    // Handle mock user or missing access token
    if (user.email === 'mockuser@smartmail.local' || !user.accessToken || !process.env.GOOGLE_CLIENT_ID) {
      console.log(`[Mock Reply Sent] To: ${recipientEmail} | Message: "${replyText}"`);
      return res.json({
        success: true,
        mock: true,
        recipient: recipientEmail,
        message: `Mock reply sent successfully to ${recipientEmail}!`
      });
    }

    // Initialize Google OAuth2 Client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: user.accessToken, refresh_token: user.refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Format RFC 2822 Email Message
    const formattedSubject = subject ? (subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`) : 'Re: Email';
    const emailLines = [
      `To: ${recipientEmail}`,
      `Subject: ${formattedSubject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      replyText
    ];

    const rawMessage = Buffer.from(emailLines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const requestBody = { raw: rawMessage };
    if (threadId) {
      requestBody.threadId = threadId;
    }

    const sendRes = await gmail.users.messages.send({
      userId: 'me',
      requestBody
    });

    console.log(`[Gmail Reply Sent] Message ID: ${sendRes.data.id} to ${recipientEmail}`);

    res.json({
      success: true,
      messageId: sendRes.data.id,
      recipient: recipientEmail,
      message: `Email reply sent successfully to ${recipientEmail}!`
    });
  } catch (error) {
    console.error('Error sending reply via Gmail:', error);

    // If scope missing or invalid token
    if (error.code === 403 || (error.message && (error.message.includes('insufficient') || error.message.includes('permission')))) {
      return res.status(403).json({
        error: 'Gmail permission missing. Please reconnect your Gmail account to grant send permission.',
        reconnectNeeded: true
      });
    }

    res.status(500).json({ error: error.message || 'Failed to send email reply' });
  }
});

module.exports = router;
