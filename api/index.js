// Vercel Serverless Entry Point
// Set VERCEL flag before importing backend so app.listen() is skipped
process.env.VERCEL = '1';

const app = require('../backend/index.js');
module.exports = app;
