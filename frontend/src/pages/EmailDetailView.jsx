import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Star, Calendar, User, AlignLeft, Sparkles, Zap, ArrowLeft, Target, ClipboardList, CheckCircle2, Clock, BoltIcon, Loader2 } from 'lucide-react';

axios.defaults.withCredentials = true;

export default function EmailDetailView() {
  const [email, setEmail] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    const savedEmail = localStorage.getItem('currentViewEmail');
    if (savedEmail) {
      const parsed = JSON.parse(savedEmail);
      setEmail(parsed);
      
      // If summary already exists (cached), use it
      if (parsed.summary && parsed.summary.length > 10) {
        setSummary(parsed.summary);
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
      const res = await axios.post('/emails/summarize', {
        emailId: emailData.emailId,
        subject: emailData.subject,
        body: emailData.body,
        sender: emailData.sender
      });
      setSummary(res.data.summary);
    } catch (err) {
      console.error('AI Summary error:', err);
      setSummary(`🎯 WHAT'S THIS ABOUT?\nCould not generate AI summary at this time. Please read the original content below.\n\n📋 KEY POINTS\n• The AI service is temporarily unavailable.\n\n✅ WHAT YOU NEED TO DO\n• Read the full email content below.\n\n⏰ DEADLINES\n• Check the original content.\n\n⚡ BOTTOM LINE\nPlease review the email manually.`);
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

  // Parse the structured summary into sections
  const parseSummary = (rawSummary) => {
    if (!rawSummary) return null;
    
    const sections = {
      about: '',
      keyPoints: '',
      actions: '',
      deadlines: '',
      bottomLine: ''
    };

    const aboutMatch = rawSummary.match(/🎯\s*WHAT'S THIS ABOUT\??\s*\n([\s\S]*?)(?=📋|$)/);
    const keyMatch = rawSummary.match(/📋\s*KEY POINTS\s*\n([\s\S]*?)(?=✅|$)/);
    const actionMatch = rawSummary.match(/✅\s*WHAT YOU NEED TO DO\s*\n([\s\S]*?)(?=⏰|$)/);
    const deadlineMatch = rawSummary.match(/⏰\s*DEADLINES?\s*\n([\s\S]*?)(?=⚡|$)/);
    const bottomMatch = rawSummary.match(/⚡\s*BOTTOM LINE\s*\n([\s\S]*?)$/);

    sections.about = aboutMatch ? aboutMatch[1].trim() : '';
    sections.keyPoints = keyMatch ? keyMatch[1].trim() : '';
    sections.actions = actionMatch ? actionMatch[1].trim() : '';
    sections.deadlines = deadlineMatch ? deadlineMatch[1].trim() : '';
    sections.bottomLine = bottomMatch ? bottomMatch[1].trim() : '';

    if (!sections.about && !sections.keyPoints && !sections.actions) {
      sections.about = rawSummary;
    }

    return sections;
  };

  const sections = parseSummary(summary);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Back Button */}
        <div className="mb-6">
          <button 
            onClick={() => window.location.href = '/dashboard'} 
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
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">AI-Powered Email Breakdown</h3>
            </div>

            {/* Loading State */}
            {loadingSummary ? (
              <div className="mb-10 p-10 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
                <p className="text-indigo-700 font-bold text-lg">AI is reading your email...</p>
                <p className="text-slate-500 font-medium text-sm">Generating a friendly summary just for you</p>
              </div>
            ) : (
              /* Summary Cards Grid */
              <div className="grid gap-4 mb-10">
                <SummaryCard 
                  icon={Target}
                  title="What's This About?"
                  content={sections?.about}
                  gradient="bg-gradient-to-br from-blue-400 to-cyan-500"
                  iconColor="bg-gradient-to-br from-blue-500 to-cyan-600"
                />
                <SummaryCard 
                  icon={ClipboardList}
                  title="Key Points"
                  content={sections?.keyPoints}
                  gradient="bg-gradient-to-br from-indigo-400 to-purple-500"
                  iconColor="bg-gradient-to-br from-indigo-500 to-purple-600"
                />
                <SummaryCard 
                  icon={CheckCircle2}
                  title="What You Need To Do"
                  content={sections?.actions}
                  gradient="bg-gradient-to-br from-emerald-400 to-teal-500"
                  iconColor="bg-gradient-to-br from-emerald-500 to-teal-600"
                />
                <SummaryCard 
                  icon={Clock}
                  title="Deadlines"
                  content={sections?.deadlines}
                  gradient="bg-gradient-to-br from-orange-400 to-red-500"
                  iconColor="bg-gradient-to-br from-orange-500 to-red-600"
                />
                <SummaryCard 
                  icon={BoltIcon}
                  title="Bottom Line"
                  content={sections?.bottomLine}
                  gradient="bg-gradient-to-br from-violet-400 to-fuchsia-500"
                  iconColor="bg-gradient-to-br from-violet-500 to-fuchsia-600"
                />
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
