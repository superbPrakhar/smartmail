require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieSession = require('cookie-session');

const authRoutes = require('./routes/auth');
const emailRoutes = require('./routes/emails');

const app = express();

app.use(cors({
  origin: true, // Allow any local port to prevent CORS on port 5174
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieSession({
  maxAge: 24 * 60 * 60 * 1000, 
  keys: [process.env.SESSION_SECRET || 'secret'],
}));

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB successfully!'))
    .catch((err) => console.error('MongoDB connection error:', err));
} else {
  console.log('Using In-Memory Database Mode - No installation required!');
}

// Simple logging middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  res.on('finish', () => {
    console.log(`[RESPONSE] ${req.method} ${req.url} - Status: ${res.statusCode}`);
  });
  next();
});

app.use('/auth', authRoutes);
app.use('/emails', emailRoutes);

// Serve static React files in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get(/^(.*)$/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
