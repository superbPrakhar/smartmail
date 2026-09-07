# SmartMail — AI-Powered Intelligent Email Management

SmartMail is an AI-based email prioritization and summarization system. It fetches emails via the Gmail API, classifies their priority using traditional NLP/ML (Naive Bayes), and generates instant, structured email breakdowns using **Google Gemini 1.5 Flash API**.

## System Architecture

```
                    INTERNET
                       │
                       ├─────────────────────────────┐
                       │ Gmail API                   │ Google Gemini API
                       ▼                             ▼
                  Gmail Server              Gemini 1.5 Flash Cloud
                       │                             │
                       ▼                             │
               SmartMail Backend ────────────────────┘
                 │           │
                 ▼           ▼
          NLP Priority    Gemini Flash
          Classifier      Summarizer
           (P1–P5)           │
                            ▼
                      AI Summary (JSON)
                 │           │
                 └─────┬─────┘
                       ▼
                    MongoDB
                       │
                       ▼
                React Dashboard
```

**Key architecture features:**
- **Email Retrieval**: Uses Google OAuth 2.0 and Gmail API.
- **Priority Classification** (P1–P5): Traditional Naive Bayes NLP classifier — instant scoring and categorization.
- **Email Summarization**: Powered by Google Gemini 1.5 Flash API with structured JSON output (`summary`, `action_required`, `deadline`, `important_points`).
- **Interactive Replies**: One-click AI Smart Replies and custom composer sent via Gmail API.

---

## Running Locally

### Prerequisites
- Node.js (v18+)
- Google Cloud Console Project (with Gmail API enabled, OAuth Consent Screen, and Web Client ID)
- Google Gemini API Key (from [Google AI Studio](https://aistudio.google.com/app/apikey))

### Step 1 — Configure environment
Navigate to `backend/` and copy `.env.example` to `.env`:
```bash
cp backend/.env.example backend/.env
```
Fill in your `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GEMINI_API_KEY`.

### Step 2 — Start the backend
```bash
cd backend
npm install
npm run dev
```
*(Backend runs on http://localhost:5000)*

### Step 3 — Start the frontend
```bash
cd frontend
npm install
npm run dev
```
*(Frontend runs on http://localhost:5173)*

### Step 4 — Authenticate with Gmail
Open `http://localhost:5173` and sign in with your Google account.

---

## 💻 Native Desktop Application (Electron)

SmartMail can also run as a native desktop application:

### Run Desktop App in Development Mode:
```bash
npm run electron:dev
```
*Launches Electron window connecting automatically to backend & frontend.*

### Package Desktop App into Windows Executable (.exe):
```bash
npm run electron:build
```
*Generates standalone installer in `dist-electron/`.*

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, Tailwind CSS, Lucide Icons |
| Backend | Node.js, Express.js |
| Database | MongoDB / File-based JSON |
| Email API | Gmail API, Google OAuth 2.0 |
| Priority Classification | Naive Bayes (`natural`) |
| Email Summarization | Google Gemini 1.5 Flash API (`@google/generative-ai`) |
