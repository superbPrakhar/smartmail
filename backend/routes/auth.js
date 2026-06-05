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
    res.json({ message: 'Login successful', user: { id: user._id, email: user.email, isGmailConnected: user.isGmailConnected, preferences: user.preferences } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Current session
router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = await User.findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  
  res.json({ id: user._id, email: user.email, isGmailConnected: user.isGmailConnected, preferences: user.preferences });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.status(200).json({ message: 'Logged out' });
});

// Update Preferences
router.post('/preferences', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const { importantKeywords, spamKeywords } = req.body;
  try {
    const user = await User.findById(req.session.userId);
    user.preferences = { importantKeywords, spamKeywords };
    await user.save();
    res.json({ message: 'Preferences updated', preferences: user.preferences });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
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

// 1. Connect Gmail trigger (must be logged in)
router.get('/google/connect', async (req, res) => {
  if (!req.session.userId) return res.redirect(`/?error=not_authenticated_for_gmail`);
  
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // getting refresh token
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/userinfo.email'],
    state: req.session.userId.toString(), // pass user id safely
    prompt: 'consent' // force consent
  });
  res.redirect(url);
});

// 2. Callback from Google
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!state) throw new Error('Missing state parameter (user id)');

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    const user = await User.findById(state);
    if (!user) throw new Error('User not found during oauth callback');

    user.googleId = userInfo.data.id;
    user.accessToken = tokens.access_token;
    if (tokens.refresh_token) {
      user.refreshToken = tokens.refresh_token;
    }
    user.isGmailConnected = true;
    await user.save();

    // Re-establish session just in case
    req.session.userId = user._id;

    res.redirect(`/dashboard`);
  } catch (error) {
    console.error('Auth callback error', error);
    res.redirect(`/?error=gmail_connect_failed`);
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
  res.redirect(`/dashboard`);
});

// Mock Gmail connection skip
router.post('/google/mock-connect', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isGmailConnected = true;
    await user.save();
    res.json({ success: true, message: 'Mock Gmail connected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
