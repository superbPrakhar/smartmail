const express = require('express');
const { google } = require('googleapis');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();

// Local Registration
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email ? email.trim().toLowerCase() : '';
    let user = await User.findOne({ email: normalizedEmail });
    if (user) return res.status(400).json({ error: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    user = new User({ email: normalizedEmail, passwordHash });
    await user.save();
    
    req.session.userId = user._id;
    req.session.user = {
      _id: user._id,
      email: user.email,
      isGmailConnected: Boolean(user.isGmailConnected),
      preferences: user.preferences || { importantKeywords: [], spamKeywords: [] }
    };
    res.json({ message: 'Registration successful', user: { id: user._id, email: user.email, isGmailConnected: user.isGmailConnected } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Local Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email ? email.trim().toLowerCase() : '';
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    req.session.userId = user._id;
    req.session.user = {
      _id: user._id,
      email: user.email,
      googleId: user.googleId,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      isGmailConnected: Boolean(user.isGmailConnected),
      preferences: user.preferences || { importantKeywords: [], spamKeywords: [] }
    };
    res.json({ message: 'Login successful', user: { id: user._id, email: user.email, isGmailConnected: user.isGmailConnected, preferences: user.preferences } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Current session
router.get('/me', async (req, res) => {
  // Check session cookie first (reliable across all serverless containers)
  let user = req.session && req.session.user ? req.session.user : null;
  if (!user && req.session && req.session.userId) {
    user = await User.findById(req.session.userId);
  }
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  
  res.json({
    id: user._id,
    email: user.email,
    isGmailConnected: Boolean(user.isGmailConnected),
    preferences: user.preferences || { importantKeywords: [], spamKeywords: [] }
  });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.status(200).json({ message: 'Logged out' });
});

const Email = require('../models/Email');
const { analyzeEmail } = require('../services/aiService');

// Update Preferences
router.post('/preferences', async (req, res) => {
  const userId = (req.session && req.session.userId) || (req.session && req.session.user && req.session.user._id);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const { importantKeywords, spamKeywords } = req.body;
  try {
    const rawImportant = Array.isArray(importantKeywords) ? importantKeywords : (typeof importantKeywords === 'string' ? importantKeywords.split(/[,;\n]+/) : []);
    const rawSpam = Array.isArray(spamKeywords) ? spamKeywords : (typeof spamKeywords === 'string' ? spamKeywords.split(/[,;\n]+/) : []);

    const newPreferences = { 
      importantKeywords: rawImportant.map(s => String(s).trim()).filter(Boolean), 
      spamKeywords: rawSpam.map(s => String(s).trim()).filter(Boolean)
    };

    let user = req.session && req.session.user ? new User(req.session.user) : null;
    if (!user) {
      user = await User.findById(userId);
    }
    if (!user) {
      user = new User({
        _id: userId,
        email: (req.session && req.session.user && req.session.user.email) || 'user@smartmail.app',
        isGmailConnected: true
      });
    }

    user.preferences = newPreferences;
    await user.save();

    // Store directly in session cookie so it is available across all serverless containers
    if (req.session) {
      if (!req.session.user) req.session.user = {};
      req.session.userId = user._id;
      req.session.user._id = user._id;
      req.session.user.preferences = newPreferences;
    }

    // Dynamically re-score all existing emails in the database for this user
    try {
      const userEmails = await Email.find({ userId: user._id });
      if (Array.isArray(userEmails) && userEmails.length > 0) {
        for (const em of userEmails) {
          const analysis = await analyzeEmail(
            em.subject || '', 
            em.body || em.snippet || '', 
            em.sender || '', 
            newPreferences
          );
          em.importanceScore = analysis.importanceScore;
          em.category = analysis.category;
          em.tone = analysis.tone;
          em.timeRoiScore = analysis.timeRoiScore;
          if (analysis.wittyNotification) em.wittyNotification = analysis.wittyNotification;
          await em.save();
        }
      }
    } catch (reScoreErr) {
      console.error('Error re-scoring emails upon preference update:', reScoreErr);
    }

    res.json({ message: 'Preferences updated', preferences: newPreferences });
  } catch (err) {
    console.error('Preferences update error:', err);
    res.status(500).json({ error: 'Server error updating preferences' });
  }
});


// GMAIL OAUTH INTEGRATION
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.CALLBACK_URL
  );
};

// 1. Connect Gmail / Google Sign-in trigger
router.get('/google/connect', async (req, res) => {
  const oauth2Client = getOAuth2Client();
  const stateVal = req.session && req.session.userId ? req.session.userId.toString() : 'direct_google_auth';
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // getting refresh token
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    state: stateVal,
    prompt: 'consent' // force consent for refresh token
  });
  res.redirect(url);
});

// 2. Callback from Google
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) throw new Error(oauthError);
    if (!code) throw new Error('Missing OAuth authorization code');

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = (userInfo.data.email || '').trim().toLowerCase();

    let user = null;
    if (state && state !== 'direct_google_auth') {
      user = await User.findById(state);
    }
    if (!user && userEmail) {
      user = await User.findOne({ email: userEmail });
    }
    if (!user) {
      // Auto-create user account from Google profile
      user = new User({
        email: userEmail || `user_${userInfo.data.id}@gmail.com`,
        passwordHash: 'google_managed_auth',
        googleId: userInfo.data.id,
        isGmailConnected: true,
        preferences: { importantKeywords: [], spamKeywords: [] }
      });
    }

    user.googleId = userInfo.data.id;
    if (tokens.access_token) {
      user.accessToken = tokens.access_token;
    }
    if (tokens.refresh_token) {
      user.refreshToken = tokens.refresh_token;
    }
    user.isGmailConnected = true;
    await user.save();

    // Re-establish session with complete user payload
    req.session.userId = user._id;
    req.session.user = {
      _id: user._id,
      email: user.email,
      googleId: user.googleId,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      isGmailConnected: true,
      preferences: user.preferences || { importantKeywords: [], spamKeywords: [] }
    };

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Auth callback error:', error);
    res.redirect(`/?error=${encodeURIComponent(error.message || 'gmail_connect_failed')}`);
  }
});

// Mock Login (Updates)
router.get('/mockLogin', async (req, res) => {
  let user = await User.findOne({ email: 'mockuser@smartmail.local' });
  if (!user) {
    const passwordHash = await bcrypt.hash('password123', 10);
    user = new User({
      email: 'mockuser@smartmail.local',
      passwordHash,
      googleId: 'mock_12345',
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      isGmailConnected: true,
      preferences: { importantKeywords: ['project', 'urgent'], spamKeywords: ['sale'] }
    });
    await user.save();
  }
  req.session.userId = user._id;
  req.session.user = {
    _id: user._id,
    email: user.email,
    googleId: user.googleId,
    accessToken: user.accessToken,
    refreshToken: user.refreshToken,
    isGmailConnected: true,
    preferences: user.preferences
  };
  res.redirect(`/dashboard`);
});

// Mock Gmail connection skip
router.post('/google/mock-connect', async (req, res) => {
  const userId = req.session && req.session.userId ? req.session.userId : (req.session && req.session.user ? req.session.user._id : null);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    let user = await User.findById(userId);
    if (!user && req.session.user) {
      user = new User(req.session.user);
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isGmailConnected = true;
    await user.save();
    if (req.session.user) {
      req.session.user.isGmailConnected = true;
    }
    res.json({ success: true, message: 'Mock Gmail connected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
