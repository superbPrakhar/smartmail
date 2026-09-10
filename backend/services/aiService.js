const natural = require('natural');
const geminiLLMService = require('./geminiLLMService');

// Initialize NLP Tooling
const classifier = new natural.BayesClassifier();
const tokenizer = new natural.WordTokenizer();

// --- TRAIN THE ML MODEL (Naive Bayes) ---
classifier.addDocument('deadline final project assignment exam course syllabus test', 'Academic');
classifier.addDocument('research paper publication journal professor university faculty lab', 'Academic');
classifier.addDocument('job internship position application resume hiring interview offer candidate recruiter', 'Internship');
classifier.addDocument('frontend software engineering candidate technical screen', 'Internship');
classifier.addDocument('hackathon workshop event invitation webinar ticket register rsvp', 'Events');
classifier.addDocument('conference summit tech talk session panel networking', 'Events');
classifier.addDocument('discount sale 50% off offer buy now subscribe promotion newsletter save', 'Spam');
classifier.addDocument('special premium trial act fast limited time unmissable clearance', 'Spam');
classifier.train();

// ============================================
// PHASE 1: Quick analysis for dashboard (NO AI call — instant)
// ============================================
const analyzeEmail = async (subject, body, sender, preferences) => {
  const safeSubject = (subject || '').trim();
  const safeSender = (sender || '').trim();
  const safeBody = (body || '').trim();
  const analysisBody = safeBody.length > 2000 ? safeBody.substring(0, 2000) + '...' : safeBody;

  // Search across sender, subject, and FULL body for comprehensive matching
  const fullContent = `${safeSender} ${safeSubject} ${safeBody}`.toLowerCase();
  const normalizedFull = fullContent.replace(/[^a-z0-9\s]/g, ' ');
  
  // 1. Scoring
  let score = 2;
  if (fullContent.match(/deadline|urgent|asap|important|critical|action required/)) score += 3;
  if (safeSender.match(/\.edu|professor|university|official/i)) score += 4;
  if (fullContent.match(/offer|discount|spam|unsubscribe|sale|promotions|clearance/)) score -= 2;

  let matchedCriticalKeyword = false;
  if (preferences && Array.isArray(preferences.importantKeywords)) {
    for (const rawKw of preferences.importantKeywords) {
      if (!rawKw) continue;
      const kw = rawKw.trim().toLowerCase();
      if (!kw) continue;
      const normalizedKw = kw.replace(/[^a-z0-9\s]/g, ' ').trim();

      // 1. Exact phrase match
      if (fullContent.includes(kw) || normalizedFull.includes(normalizedKw)) {
        matchedCriticalKeyword = true;
        break;
      }

      // 2. Distinctive words matching (e.g. "kanohar" or "electricals")
      const parts = normalizedKw.split(/\s+/).filter(p => p.length >= 3);
      if (parts.length > 1) {
        // If all significant words match, or any very distinctive word (length >= 5) matches
        const allMatch = parts.every(p => normalizedFull.includes(p));
        const distinctiveMatch = parts.some(p => p.length >= 5 && normalizedFull.includes(p));
        if (allMatch || distinctiveMatch) {
          matchedCriticalKeyword = true;
          break;
        }
      } else if (parts.length === 1 && parts[0].length >= 3 && normalizedFull.includes(parts[0])) {
        matchedCriticalKeyword = true;
        break;
      }
    }
  }

  if (matchedCriticalKeyword) {
    // Guaranteed 5-Star Critical Urgency
    score = 5;
  } else if (preferences && Array.isArray(preferences.spamKeywords)) {
    for (const rawKw of preferences.spamKeywords) {
      if (!rawKw) continue;
      const kw = rawKw.trim().toLowerCase();
      if (!kw) continue;
      if (fullContent.includes(kw)) {
        score = 1;
        break;
      }
    }
  }

  score = Math.max(1, Math.min(5, score));
  
  // 2. ML Categorization
  const categoryPrediction = classifier.classify(fullContent);
  
  // 3. NO AI summary during fetch — just a placeholder
  const summary = '';

  // 4. Deadline Detection
  let wittyNotification = null;
  if (fullContent.match(/deadline|due tomorrow|closes on|expires|within 24 hours/)) {
    const zingers = [
      "Hey bestie ✨ that form deadline is creeping up! Wrap it up like a burrito! 🌯💻",
      "Wakey wakey, eggs & bakey! 🍳 Your application closes soon. Don't ghost it! 👻",
      "Alert! 🚨 We found a ticking clock. Time to secure that bag before it burns! 💰🍞",
      "Ding dong! 🛎️ Your future self just called—they want you to submit this right now! 🚀",
      "Spicy hot alert! 🌶️ An internship deadline is almost here. Go grab your dream job! 🏃‍♂️👔"
    ];
    wittyNotification = zingers[Math.floor(Math.random() * zingers.length)];
  }

  // 5. Read Time, Tone & ROI 
  const wordCount = analysisBody.split(/\s+/).length || 1;
  const readTimeGst = Math.max(5, Math.floor(wordCount / 200 * 60));
  const timeRoiScore = parseFloat(((score / readTimeGst) * 100).toFixed(1));

  let tone = 'Professional';
  if (matchedCriticalKeyword || fullContent.match(/urgent|asap|now|immediate|penalty|fail/)) tone = 'Urgent';
  else if (fullContent.match(/thanks|love|appreciate|excited|happy|cheers/)) tone = 'Friendly';
  else if (fullContent.match(/complain|unacceptable|poor|bad|disappointed|angry/)) tone = 'Angry';

  if (matchedCriticalKeyword && !wittyNotification) {
    wittyNotification = "⚡ Priority Alert! Email from your designated Critical Topics received.";
  }

  // 6. Smart Replies
  let smartReplies = ["Got it, thanks!", "I will review this soon.", "Let's schedule a call."];
  if (tone === 'Urgent') {
    smartReplies = ["I'm on it!", "Can we extend the deadline?", "I will send this right away."];
  } else if (tone === 'Friendly') {
    smartReplies = ["Thanks a lot! 😊", "Great catch!", "Sounds like a plan!"];
  } else if (categoryPrediction === 'Events') {
    smartReplies = ["I RSVP yes!", "I can't make it.", "Is there a virtual link?"];
  }

  return { summary, importanceScore: score, category: categoryPrediction, wittyNotification, tone, readTimeGst, timeRoiScore, smartReplies };
};

// ============================================
// PHASE 2: On-demand AI summary (called when user clicks an email)
// ============================================
const generateAISummary = async (subject, body, sender) => {
  const result = await geminiLLMService.analyzeEmail({ subject, sender, body });
  
  if (result.success) {
    // Return structured JSON directly, along with metadata
    return {
      success: true,
      data: result.data,
      metadata: {
        aiProvider: result.provider,
        aiModel: result.model
      }
    };
  }

  // Handle failure gracefully (e.g. invalid API key)
  return {
    success: false,
    error: result.error || 'Gemini AI service unavailable.',
    metadata: {
      aiProvider: 'gemini',
      aiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    }
  };
};

module.exports = { analyzeEmail, generateAISummary };
