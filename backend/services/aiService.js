const natural = require('natural');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
  const analysisBody = body && body.length > 2000 ? body.substring(0, 2000) + '...' : body;

  // --- PRIMARY: Google Gemini (FREE — gemini-2.5-flash has 1500/day) ---
  if (process.env.GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Try multiple models in case one has exhausted its quota
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    
    const prompt = `You are a smart, friendly email assistant. Read this email and explain it to me like a helpful friend would. Use simple, everyday English that anyone can understand.

Your response MUST follow this EXACT format (use these exact headings with emojis):

🎯 WHAT'S THIS ABOUT?
Write 1-2 friendly sentences explaining what this email is about. Talk like a helpful friend, not a robot. Example: "Hey! Your college just sent you a reminder about an assessment you need to complete today."

📋 KEY POINTS
• List the most important facts from the email as bullet points
• Keep each point short and simple
• Only include what actually matters

✅ WHAT YOU NEED TO DO
• List specific actions the reader needs to take
• If there's nothing to do, write "• No action needed — this is just informational"

⏰ DEADLINES
• List any dates, times, or deadlines mentioned
• If none, write "• No specific deadlines mentioned"

⚡ BOTTOM LINE
Write one final sentence — is this urgent? Can they ignore it? Should they act now?

---
Email Subject: ${subject}
From: ${sender}

Email Content:
${analysisBody}`;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying Gemini model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log(`Gemini success with model: ${modelName}`);
        return response.text();
      } catch (err) {
        console.error(`Gemini Error (${modelName}):`, err.message?.substring(0, 200));
        // If rate limited, try next model
        if (err.message?.includes('429') || err.message?.includes('quota')) {
          console.log(`Model ${modelName} quota exhausted, trying next...`);
          continue;
        }
        // For other errors, also try next model
        continue;
      }
    }
    console.error('All Gemini models exhausted or failed.');
  }

  // --- SECONDARY: OpenAI ---
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    try {
      const { OpenAI } = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: `Summarize this email in a friendly, simple way. Subject: ${subject}\nFrom: ${sender}\n\n${analysisBody}` }],
        max_tokens: 250
      });
      return response.choices[0].message.content;
    } catch (err) {
      console.error('OpenAI Error:', err.message);
    }
  }

  // --- FALLBACK: Local template ---
  return localTemplateSummary(subject, sender, analysisBody);
};

// Local template-based summary
const localTemplateSummary = (subject, sender, body) => {
  const senderName = sender.split('<')[0].trim() || sender;
  const sentences = body.replace(/(\r\n|\n|\r)/gm, " ")
                        .split(/(?<=[.!?])\s+/)
                        .map(s => s.trim())
                        .filter(s => s.length > 15 && s.match(/^[A-Z]/));

  const topSentences = sentences.slice(0, 3).map(s => `• ${s}`).join('\n');
  
  return `🎯 WHAT'S THIS ABOUT?\nYou received an email from ${senderName} regarding "${subject}".\n\n📋 KEY POINTS\n${topSentences || '• No clear content could be extracted from this email.'}\n\n✅ WHAT YOU NEED TO DO\n• Review the email content above for any required actions.\n\n⏰ DEADLINES\n• Check the original content below for specific dates.\n\n⚡ BOTTOM LINE\nPlease read the original content for full details.`;
};

module.exports = { analyzeEmail, generateAISummary };
