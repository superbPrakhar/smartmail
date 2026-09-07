const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

let UserModel;

if (process.env.MONGODB_URI) {
  const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    googleId: String,
    accessToken: String,
    refreshToken: String,
    isGmailConnected: { type: Boolean, default: false },
    preferences: {
      importantKeywords: { type: [String], default: [] },
      spamKeywords: { type: [String], default: [] }
    }
  }, { timestamps: true });

  UserModel = mongoose.model('User', userSchema);
} else {
  const isVercel = Boolean(process.env.VERCEL);
  const bundledDbPath = path.join(__dirname, '../database_users.json');
  const dbPath = isVercel ? path.join('/tmp', 'database_users.json') : bundledDbPath;

  // In-memory fallback cache for serverless lifecycles
  let memoryUsers = null;

  function readUsersFromFile() {
    if (memoryUsers) return memoryUsers;
    try {
      if (fs.existsSync(dbPath)) {
        const data = fs.readFileSync(dbPath, 'utf8');
        memoryUsers = JSON.parse(data || '[]');
        return memoryUsers;
      } else if (isVercel && fs.existsSync(bundledDbPath)) {
        const data = fs.readFileSync(bundledDbPath, 'utf8');
        memoryUsers = JSON.parse(data || '[]');
        try { fs.writeFileSync(dbPath, data, 'utf8'); } catch(e) {}
        return memoryUsers;
      }
    } catch (err) {
      console.error('Error reading users database:', err);
    }
    memoryUsers = [];
    return memoryUsers;
  }

  function writeUsersToFile(usersList) {
    memoryUsers = usersList;
    try {
      fs.writeFileSync(dbPath, JSON.stringify(usersList, null, 2), 'utf8');
    } catch (err) {
      console.error('Error writing users database:', err);
    }
  }

  class UserClass {
    constructor(data) {
      Object.assign(this, data);
      if (this.email) {
        this.email = this.email.trim().toLowerCase();
      }
      if (!this._id) {
        this._id = Math.random().toString(36).substring(2, 12);
      }
      if (!this.preferences) {
        this.preferences = { importantKeywords: [], spamKeywords: [] };
      }
      if (this.isGmailConnected === undefined) this.isGmailConnected = false;
    }

    async save() {
      if (this.email) {
        this.email = this.email.trim().toLowerCase();
      }
      const users = readUsersFromFile();
      const index = users.findIndex(u => u._id === this._id);
      if (index > -1) {
        users[index] = this;
      } else {
        users.push(this);
      }
      writeUsersToFile(users);
      return this;
    }

    static async findOne(query) {
      const users = readUsersFromFile();
      let found = null;
      if (query.email) {
        const targetEmail = query.email.trim().toLowerCase();
        found = users.find(u => u.email && u.email.trim().toLowerCase() === targetEmail);
      }
      return found ? new UserClass(found) : null;
    }

    static async findById(id) {
      const users = readUsersFromFile();
      const found = users.find(u => u._id === id || u._id === id.toString());
      return found ? new UserClass(found) : null;
    }

    static async deleteMany() {
      writeUsersToFile([]);
    }
  }

  UserModel = UserClass;
}

module.exports = UserModel;
