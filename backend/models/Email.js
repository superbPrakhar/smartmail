const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

let EmailModel;

if (process.env.MONGODB_URI) {
  const emailSchema = new mongoose.Schema({
    emailId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    subject: String,
    sender: String,
    snippet: String,
    body: String,
    summary: String,
    importanceScore: Number,
    category: String,
    wittyNotification: String,
    tone: String,
    readTimeGst: Number,
    timeRoiScore: Number,
    smartReplies: { type: [String], default: [] },
    timestamp: Date
  }, { timestamps: true });

  EmailModel = mongoose.model('Email', emailSchema);
} else {
  const dbPath = path.join(__dirname, '../database_emails.json');

  function readEmailsFromFile() {
    try {
      if (fs.existsSync(dbPath)) {
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data || '[]');
      }
    } catch (err) {
      console.error('Error reading emails database:', err);
    }
    return [];
  }

  function writeEmailsToFile(emailsList) {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(emailsList, null, 2), 'utf8');
    } catch (err) {
      console.error('Error writing emails database:', err);
    }
  }

  class EmailClass {
    constructor(data) {
      Object.assign(this, data);
      if (!this._id) {
        this._id = Math.random().toString(36).substring(2, 12);
      }
    }

    async save() {
      const emailsDB = readEmailsFromFile();
      const index = emailsDB.findIndex(e => e._id === this._id);
      if (index > -1) {
        emailsDB[index] = this;
      } else {
        emailsDB.push(this);
      }
      writeEmailsToFile(emailsDB);
      return this;
    }

    static async find(query) {
      const emailsDB = readEmailsFromFile();
      if (query && query.userId) {
        return emailsDB.filter(e => e.userId === query.userId || e.userId === query.userId.toString());
      }
      return [...emailsDB];
    }

    static async findOne(query) {
      const emailsDB = readEmailsFromFile();
      let found = null;
      if (query.emailId && query.userId) {
        found = emailsDB.find(e => e.emailId === query.emailId && e.userId === query.userId);
      } else if (query.emailId) {
        found = emailsDB.find(e => e.emailId === query.emailId);
      }
      return found ? new EmailClass(found) : null;
    }

    static async findOneAndUpdate(query, update) {
      const emailsDB = readEmailsFromFile();
      const index = emailsDB.findIndex(e => {
        if (query.emailId) return e.emailId === query.emailId;
        return false;
      });
      if (index > -1) {
        Object.assign(emailsDB[index], update);
        writeEmailsToFile(emailsDB);
        return new EmailClass(emailsDB[index]);
      }
      return null;
    }

    static async deleteMany() {
      writeEmailsToFile([]);
    }
  }

  EmailModel = EmailClass;
}

module.exports = EmailModel;
