# SmartMail - AI Email Prioritization

SmartMail is an AI-based email prioritization and summarization system. It fetches emails via the Gmail API, summarizes them, scores their importance, and presents them in a clean dashboard.

## Research Component: Cognitive Load Reduction
### 1. Raw Emails vs Summarized Emails
- **Raw Email Processing**: The average person receives dozens of emails daily. Reading typical marketing or academic emails requires scanning an average of 150-300 words.
- **SmartMail Summarization**: By extracting the core intent and summarizing it into 2-3 lines (approx. 30 words), cognitive load is decreased by over 80%.

### 2. Importance Scoring System
- The hybrid rule-based and AI-driven scoring system helps filter noise. 
- Using visual hierarchy (Red/Urgent, Yellow/Medium, Green/Low), users immediately know which emails require immediate action without having to read subject lines carefully. This pre-attentive visual processing saves mental energy.

## Running Locally

### Prerequisites
- Node.js (v18+)
- MongoDB (Running locally on `mongodb://localhost:27017` or use an Atlas URI)
- Google Cloud Console Project (with Gmail API enabled, OAuth Consent Screen, and Web Client ID)
- OpenAI API Key (Optional)

### Environment Setup
1. Navigate to `backend/` and verify `.env.example` has been copied to `.env`.
2. In `backend/.env`, fill in:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `MONGODB_URI`
   - `OPENAI_API_KEY` (Leave as default to use the local fallback summarization)

### Starting the Servers

1. **Start the backend:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   *(Backend runs on http://localhost:5000)*
   
2. **Start the frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *(Frontend usually runs on http://localhost:5173)*

### ⚠️ Testing UI Without API Keys (Mock Mode)
Setting up Google OAuth Credentials takes some time. If you haven't done that yet, you can test the UI safely:
1. Ensure both backend and frontend are running.
2. Go to `http://localhost:5173`.
3. Click the text link at the very bottom: **"Test UI without credentials (Mock Mode)"**.
4. This will log you in to a dummy session and inject sample test data (Academic, Spam, Internship emails) so you can interact with the dashboard, filter by 1-5 star ratings, and view the interface.
