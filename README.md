# SmartMail — Privacy-Preserving Local LLM-Based Intelligent Email Management

SmartMail is an AI-based email prioritization and summarization system. It fetches emails via the Gmail API, classifies their priority using traditional NLP/ML, and summarizes them using a **locally running LLM (Qwen3 via Ollama)** — ensuring email content used for LLM processing is not sent to third-party cloud LLM providers.

## Local AI Architecture

```
                    INTERNET
                       │
                       │ Gmail API (email retrieval only)
                       ▼
                  Gmail Server
                       │
                       ▼
               SmartMail Backend
                 │           │
                 ▼           ▼
          NLP Priority    Local Ollama
          Classifier      (localhost)
           (P1–P5)          │
                            ▼
                        Qwen3 1.7B
                            │
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

**Key architecture decisions:**
- **Email retrieval** continues to use the Gmail API (external service).
- **Priority classification** (P1–P5) uses a traditional Naive Bayes NLP classifier — fast, no LLM needed.
- **Email summarization** is performed locally by Qwen3 via Ollama. Email content used for LLM processing is **not** sent to third-party cloud LLM providers.
- Summaries are returned as **structured JSON** (summary, action_required, deadline, important_points).

## Research Component: Cognitive Load Reduction
### 1. Raw Emails vs Summarized Emails
- **Raw Email Processing**: The average person receives dozens of emails daily. Reading typical marketing or academic emails requires scanning an average of 150–300 words.
- **SmartMail Summarization**: By extracting the core intent and summarizing it into 2–3 lines (approx. 30 words), cognitive load is decreased by over 80%.

### 2. Importance Scoring System
- The hybrid rule-based and ML-driven scoring system helps filter noise.
- Using visual hierarchy (Red/Urgent, Yellow/Medium, Green/Low), users immediately know which emails require immediate action without having to read subject lines carefully.

## Running Locally

### Prerequisites
- Node.js (v18+)
- [Ollama](https://ollama.com/) installed and running
- MongoDB (optional — uses file-based storage if not set)
- Google Cloud Console Project (with Gmail API enabled, OAuth Consent Screen, and Web Client ID)

### Step 1 — Install Ollama
Download and install Ollama from [ollama.com](https://ollama.com/).

### Step 2 — Install Qwen3 model
```bash
ollama pull qwen3:1.7b
```

### Step 3 — Start Ollama
Ollama typically runs as a background service automatically after installation. If not:
```bash
ollama serve
```

### Step 4 — Configure environment
Navigate to `backend/` and copy `.env.example` to `.env`:
```bash
cp backend/.env.example backend/.env
```
Fill in your Google OAuth credentials. The Ollama defaults should work out of the box.

### Step 5 — Start the backend
```bash
cd backend
npm install
npm run dev
```
*(Backend runs on http://localhost:5000)*

### Step 6 — Start the frontend
```bash
cd frontend
npm install
npm run dev
```
*(Frontend runs on http://localhost:5173)*

### Step 7 — Authenticate with Gmail
Open `http://localhost:5173` and sign in with your Google account.

### Step 8 — Fetch & Summarize
Your emails will be fetched and classified instantly. Click on any email to generate a local AI summary powered by Qwen3.

### ⚠️ Testing UI Without API Keys (Mock Mode)
If you haven't set up Google OAuth yet:
1. Ensure both backend and frontend are running.
2. Go to `http://localhost:5173`.
3. Click **"Test UI without credentials (Mock Mode)"**.
4. This logs you into a dummy session with sample data.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | — |
| `OLLAMA_BASE_URL` | Ollama API URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | LLM model name | `qwen3:1.7b` |
| `OLLAMA_TIMEOUT_MS` | Timeout for LLM calls | `60000` |
| `OLLAMA_MAX_INPUT_CHARS` | Max email body chars sent to LLM | `12000` |
| `MONGODB_URI` | MongoDB connection string (optional) | File-based storage |

## Changing the LLM Model
The model is configurable via the `OLLAMA_MODEL` environment variable. Supported models include:
```
qwen3:0.6b    — Fastest, lightest
qwen3:1.7b    — Default, good balance
qwen3:4b      — Most capable
```
No code changes are required to switch models.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB / File-based JSON |
| Email | Gmail API, Google OAuth 2.0 |
| Priority Classification | Naive Bayes (natural.js) |
| Email Summarization | Qwen3 via Ollama (local) |
