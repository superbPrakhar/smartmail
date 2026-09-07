const natural = require('natural');
const localLLMService = require('./localLLMService');

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
  const analysisBody = body && body.length > 2000 ? body.substring(0, 2000) + '...' : body;
  const content = `${subject} ${analysisBody}`.toLowerCase();
  
  // 1. Scoring
  let score = 2;
  if (content.match(/deadline|urgent|asap|important/)) score += 3;
  if (sender.match(/\.edu|professor|university|official/)) score += 4;
  if (content.match(/offer|discount|spam|unsubscribe|sale|promotions/)) score -= 2;

  if (preferences && preferences.importantKeywords) {
    for (const kw of preferences.importantKeywords) {
      if (kw && content.includes(kw.toLowerCase())) score += 3;
    }
  }
  if (preferences && preferences.spamKeywords) {
    for (const kw of preferences.spamKeywords) {
      if (kw && content.includes(kw.toLowerCase())) score -= 3;
    }
  }
  score = Math.max(1, Math.min(5, score));
  
  // 2. ML Categorization
  const categoryPrediction = classifier.classify(content);
  
  // 3. NO AI summary during fetch — just a placeholder
  const summary = '';

  // 4. Deadline Detection
  let wittyNotification = null;
  if (content.match(/deadline|due tomorrow|closes on|expires|within 24 hours/)) {
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
  if (content.match(/urgent|asap|now|immediate|penalty|fail/)) tone = 'Urgent';
  else if (content.match(/thanks|love|appreciate|excited|happy|cheers/)) tone = 'Friendly';
  else if (content.match(/complain|unacceptable|poor|bad|disappointed|angry/)) tone = 'Angry';

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
  const result = await localLLMService.analyzeEmail({ subject, sender, body });
  
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

  // Handle failure gracefully (e.g. Ollama offline)
  return {
    success: false,
    error: result.error || 'Local AI service unavailable.',
    metadata: {
      aiProvider: 'ollama',
      aiModel: process.env.OLLAMA_MODEL || 'qwen3:1.7b'
    }
  };
};

module.exports = { analyzeEmail, generateAISummary };
