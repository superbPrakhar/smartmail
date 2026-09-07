import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Star, Calendar, User, AlignLeft, Sparkles, Zap, ArrowLeft, Target, ClipboardList, CheckCircle2, Clock, BoltIcon, Loader2, ShieldCheck } from 'lucide-react';

axios.defaults.withCredentials = true;

export default function EmailDetailView() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(null);
  const [summary, setSummary] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('currentViewEmail');
    if (savedEmail) {
      const parsed = JSON.parse(savedEmail);
      setEmail(parsed);
      
      // If summary already exists (cached), use it
      if (parsed.summary && parsed.summary.length > 10) {
        // Try parsing as JSON first (new structured format)
        try {
          const structuredSummary = JSON.parse(parsed.summary);
          setSummary(structuredSummary);
        } catch {
          // Legacy string summary — wrap it in the new structure
          setSummary({
            summary: parsed.summary,
            action_required: false,
            deadline: null,
            important_points: []
          });
        }
        setLoadingSummary(false);
      } else {
        // Call AI on-demand for this single email
        fetchAISummary(parsed);
      }
    }
  }, []);

  const fetchAISummary = async (emailData) => {
    try {
      setLoadingSummary(true);
      setAiError(null);
      const res = await axios.post('/emails/summarize', {
        emailId: emailData.emailId,
        subject: emailData.subject,
        body: emailData.body,
        sender: emailData.sender
      });
      
      // New structured response: res.data.summary is a JSON object
      setSummary(res.data.summary);
      if (res.data.metadata) {
        setMetadata(res.data.metadata);
      }
      if (res.data.error) {
        setAiError(res.data.error);
      }
    } catch (err) {
      console.error('AI Summary error:', err);
      setAiError('Could not connect to the AI service.');
      setSummary({
        summary: 'Could not generate AI summary at this time. Please read the original content below.',
        action_required: false,
        deadline: null,
        important_points: []
      });
    } finally {
      setLoadingSummary(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 font-bold">Loading email data or no data found...</p>
      </div>
    );
  }

  const SummaryCard = ({ icon: Icon, title, content, gradient, iconColor }) => {
    if (!content) return null;
    return (
      <div className={`group relative rounded-2xl p-[1.5px] ${gradient} shadow-md overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-xl`}>
        <div className="relative bg-white/95 backdrop-blur-xl rounded-[0.85rem] p-6 h-full">
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center shadow-sm`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{title}</h4>
              <div className="text-slate-700 leading-relaxed font-medium text-[0.95rem] whitespace-pre-wrap">{content}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Build display content from structured summary
  const summaryText = summary?.summary || '';
  const actionRequired = summary?.action_required;
  const deadline = summary?.deadline;
  const importantPoints = summary?.important_points || [];

  const keyPointsContent = importantPoints.length > 0
    ? importantPoints.map(p => `• ${p}`).join('\n')
    : null;

  const actionContent = actionRequired === true
    ? '• Yes — action is required. Check the details above.'
    : actionRequired === false
      ? '• No action needed — this is just informational.'
      : null;

  const deadlineContent = deadline
    ? `• ${deadline}`
    : '• No specific deadlines mentioned.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Back Button */}
        <div className="mb-6">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="flex items-center text-slate-500 hover:text-blue-600 font-bold transition-all duration-300 bg-white/80 backdrop-blur-sm px-5 py-2.5 rounded-full shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Inbox
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          
          {/* Header */}
          <div className="px-8 sm:px-10 py-8 border-b border-slate-100/50 bg-gradient-to-r from-slate-50/80 to-blue-50/30">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-tight mb-6">{email.subject}</h2>
            
            {/* Metadata Badges */}
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="flex items-center px-4 py-2 bg-white text-slate-600 rounded-lg font-semibold border border-slate-150 shadow-sm">
                <User className="w-3.5 h-3.5 mr-2 text-slate-400" />
                {email.sender}
              </div>
              <div className="flex items-center px-4 py-2 bg-white text-slate-600 rounded-lg font-semibold border border-slate-150 shadow-sm">
                <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400" />
                {new Date(email.timestamp).toLocaleString()}
              </div>
              <div className="flex items-center bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg font-bold shadow-sm">
                Score: {email.importanceScore} <Star className="w-3.5 h-3.5 ml-1.5 fill-amber-500 text-amber-500" />
              </div>
              <div className="flex items-center bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg font-bold shadow-sm">
                {email.category}
              </div>
            </div>
          </div>
          
          <div className="p-8 sm:p-10">
            
            {/* AI Summary Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">AI-Powered Email Breakdown</h3>
              </div>
              {/* Local AI Privacy Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-bold text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                🔒 Local AI Processing
              </div>
            </div>

            {/* AI Error Banner */}
            {aiError && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium">
                ⚠️ {aiError}
              </div>
            )}

            {/* Loading State */}
            {loadingSummary ? (
              <div className="mb-10 p-10 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
                <p className="text-indigo-700 font-bold text-lg">AI is reading your email...</p>
                <p className="text-slate-500 font-medium text-sm">Generating a local AI summary just for you</p>
              </div>
            ) : (
              /* Summary Cards Grid */
              <div className="grid gap-4 mb-10">
                <SummaryCard 
                  icon={Target}
                  title="What's This About?"
                  content={summaryText}
                  gradient="bg-gradient-to-br from-blue-400 to-cyan-500"
                  iconColor="bg-gradient-to-br from-blue-500 to-cyan-600"
                />
                <SummaryCard 
                  icon={ClipboardList}
                  title="Key Points"
                  content={keyPointsContent}
                  gradient="bg-gradient-to-br from-indigo-400 to-purple-500"
                  iconColor="bg-gradient-to-br from-indigo-500 to-purple-600"
                />
                <SummaryCard 
                  icon={CheckCircle2}
                  title="Action Required"
                  content={actionContent}
                  gradient="bg-gradient-to-br from-emerald-400 to-teal-500"
                  iconColor="bg-gradient-to-br from-emerald-500 to-teal-600"
                />
                <SummaryCard 
                  icon={Clock}
                  title="Deadlines"
                  content={deadlineContent}
                  gradient="bg-gradient-to-br from-orange-400 to-red-500"
                  iconColor="bg-gradient-to-br from-orange-500 to-red-600"
                />
              </div>
            )}

            {/* AI Provider Info */}
            {metadata && (
              <div className="mb-6 flex items-center gap-2 text-xs text-slate-400 font-medium">
                <Sparkles className="w-3 h-3" />
                <span>Summary by {metadata.aiProvider} • {metadata.aiModel}</span>
              </div>
            )}

            {/* Full Body Section */}
            <div className="mb-10">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <AlignLeft className="w-5 h-5" /> Original Content
              </h4>
              <div className="text-slate-600 whitespace-pre-wrap font-sans text-base leading-relaxed p-8 sm:p-10 bg-slate-50/50 rounded-2xl border border-slate-100 max-h-[500px] overflow-y-auto shadow-sm selection:bg-blue-100">
                {email.body}
              </div>
            </div>
            
            {/* AI Smart Replies */}
            {email.smartReplies && email.smartReplies.length > 0 && (
              <div className="border-t border-slate-100 pt-8 mt-6">
                <h4 className="text-sm font-black uppercase tracking-widest text-violet-500 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5" /> AI One-Click Replies
                </h4>
                <div className="flex gap-3 flex-wrap">
                  {email.smartReplies.map((reply, idx) => (
                    <button 
                      key={idx}
                      onClick={() => alert('Demo: Reply sent — "' + reply + '"')}
                      className="px-5 py-2.5 bg-white border-2 border-violet-100 text-violet-700 font-bold rounded-xl hover:bg-violet-50 hover:border-violet-300 transition-all shadow-sm active:scale-95 text-sm"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
