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
      return generateMockEmails(res, user._id);
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: user.accessToken, refresh_token: user.refreshToken });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const resp = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 100
    });
    
    if (!resp.data.messages) return res.json({ message: 'No emails found' });
    
    const fetchedEmails = [];
    
    // Process ALL 100 emails in parallel — no AI call, just scoring (instant)
    const BATCH_SIZE = 20;
    const messages = resp.data.messages;
    
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (msg) => {
        try {
          // Check cache first
          let existingEmail = await Email.findOne({ emailId: msg.id });
          if (existingEmail) return existingEmail;
          
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
      
      fetchedEmails.push(...batchResults.filter(e => e !== null));
    }
    
    fetchedEmails.sort((a,b) => b.importanceScore - a.importanceScore || b.timestamp - a.timestamp);
    res.json(fetchedEmails);

  } catch (err) {
    console.error('Fetch emails error', err);
    res.status(500).json({ error: 'Failed to fetch emails' });
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
    const summary = await generateAISummary(subject, body, sender);
    
    // Cache it so we don't call AI again for the same email
    if (emailId) {
      await Email.findOneAndUpdate({ emailId }, { summary });
    }
    
    res.json({ summary });
  } catch (err) {
    console.error('Summarize error:', err);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

async function generateMockEmails(res, userId) {
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
    "Increase your productivity with these 10 tools",
    "Exclusive invitation: VIP shopping club access",
    "Your account statement is ready for review",
    "Get professional resume writing services for cheap"
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
  const zingers = [
    "Hey bestie ✨ that form deadline is creeping up! Wrap it up like a burrito! 🌯💻",
    "Wakey wakey, eggs & bakey! 🍳 Your application closes soon. Don't ghost it! 👻",
    "Alert! 🚨 We found a ticking clock. Time to secure that bag before it burns! 💰🍞",
    "Ding dong! 🛎️ Your future self just called—they want you to submit this right now! 🚀",
    "Spicy hot alert! 🌶️ An internship deadline is almost here. Go grab your dream job! 🏃‍♂️👔"
  ];

  // Generate 80 mock emails
  const totalEmailsNeeded = 80;
  for (let i = 0; i < totalEmailsNeeded; i++) {
    const catConfig = categories[i % categories.length];
    
    // Pick subject and sender
    const subjectIndex = Math.floor(i / categories.length) % catConfig.subjects.length;
    const subject = catConfig.subjects[subjectIndex];
    const sender = catConfig.senders[Math.floor(Math.random() * catConfig.senders.length)];
    
    const emailId = `mock_${100 + i}`;
    
    // Determine tone
    let tone = 'Professional';
    const contentLower = subject.toLowerCase();
    if (contentLower.includes('urgent') || contentLower.includes('deadline') || contentLower.includes('final') || contentLower.includes('overdue')) {
      tone = 'Urgent';
    } else if (catConfig.name === 'Events' || catConfig.name === 'Uncategorized') {
      tone = 'Friendly';
    }
    
    // Determine importance score
    let score = 2;
    if (tone === 'Urgent') score += 2;
    if (catConfig.name === 'Academic' || catConfig.name === 'Internship') score += 1;
    if (catConfig.name === 'Spam') score = 1;
    score = Math.max(1, Math.min(5, score));
    
    // Determine read time
    const readTimeGst = 5 + (i * 3) % 45; // between 5 and 50 seconds
    const timeRoiScore = parseFloat(((score / readTimeGst) * 100).toFixed(1));
    
    // Witty notification
    let wittyNotification = null;
    if (tone === 'Urgent' && i % 4 === 0) {
      wittyNotification = zingers[i % zingers.length];
    }
    
    // Smart replies
    let smartReplies = ["Got it, thanks!", "I will review this soon.", "Let's schedule a call."];
    if (tone === 'Urgent') {
      smartReplies = ["I'm on it!", "Can we extend the deadline?", "I will send this right away."];
    } else if (tone === 'Friendly') {
      smartReplies = ["Thanks a lot! 😊", "Great catch!", "Sounds like a plan!"];
    } else if (catConfig.name === 'Events') {
      smartReplies = ["I RSVP yes!", "I can't make it.", "Is there a virtual link?"];
    } else if (catConfig.name === 'Spam') {
      smartReplies = ["Unsubscribe", "Not interested", "Mark as spam"];
    }
    
    const body = `This is the body content of the email regarding: "${subject}". Here is some additional text to make it feel like a real email. Please review the details carefully and take necessary action. If you have any questions, feel free to reply.`;
    
    mockData.push({
      _id: emailId,
      emailId: emailId,
      subject: subject,
      sender: sender,
      snippet: `${body.substring(0, 60)}...`,
      body: body,
      summary: body,
      category: catConfig.name,
      timestamp: new Date(Date.now() - i * 30 * 60 * 1000), // Spaced by 30 mins
      importanceScore: score,
      wittyNotification: wittyNotification,
      tone: tone,
      readTimeGst: readTimeGst,
      timeRoiScore: timeRoiScore,
      smartReplies: smartReplies,
      userId: userId
    });
  }
  
  res.json(mockData);
}

module.exports = router;
