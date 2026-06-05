import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Target, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';

axios.defaults.withCredentials = true;

export default function SetupPriorities() {
  const [important, setImportant] = useState('');
  const [spam, setSpam] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    axios.get('/auth/me')
      .then(res => {
        if(res.data.preferences) {
           setImportant(res.data.preferences.importantKeywords.join(', ') || '');
           setSpam(res.data.preferences.spamKeywords.join(', ') || '');
        }
      })
      .catch(console.error);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const impKeywords = important.split(',').map(s => s.trim()).filter(Boolean);
      const spKeywords = spam.split(',').map(s => s.trim()).filter(Boolean);
      
      await axios.post('/auth/preferences', {
        importantKeywords: impKeywords,
        spamKeywords: spKeywords
      });
      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50 p-4 overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 blur-[120px] animate-pulse"></div>

      <div className="relative z-10 bg-white/80 backdrop-blur-3xl max-w-2xl w-full rounded-[2rem] shadow-2xl border border-white p-10 animate-in fade-in slide-in-from-bottom-10 duration-500">
        
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6 shadow-sm border border-white/50 text-blue-700 font-bold text-xs uppercase tracking-widest">
           <Sparkles className="w-4 h-4" /> Priorities Engine
        </div>

        <h2 className="text-4xl font-extrabold text-slate-800 mb-4 tracking-tight">Teach the AI</h2>
        <p className="text-slate-500 font-medium text-lg leading-relaxed mb-10">
          SmartMail scores emails dynamically. Enter standard keywords below so our system can learn exactly what demands your attention right away, and what is just noise.
        </p>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="group relative bg-white border-2 border-slate-100 rounded-2xl p-6 transition-all hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/10 focus-within:border-blue-500 focus-within:shadow-blue-500/10">
            <div className="flex items-center mb-2">
              <Target className="w-6 h-6 text-blue-600 mr-3" />
              <h3 className="text-xl font-bold text-slate-800">Critical Topics</h3>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-6">Emails containing these words receive a <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">+3 Score Boost</span>.</p>
            <input 
              type="text"
              value={important}
              onChange={(e) => setImportant(e.target.value)}
              placeholder="e.g. Job Offer, Invoice, React, Urgent"
              className="w-full bg-transparent text-lg font-medium text-slate-800 placeholder-slate-300 outline-none"
            />
          </div>

          <div className="group relative bg-white border-2 border-slate-100 rounded-2xl p-6 transition-all hover:border-red-200 hover:shadow-lg hover:shadow-red-500/10 focus-within:border-red-500 focus-within:shadow-red-500/10">
            <div className="flex items-center mb-2">
              <AlertTriangle className="w-6 h-6 text-red-500 mr-3" />
              <h3 className="text-xl font-bold text-slate-800">Visual Noise / Spam</h3>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-6">Emails containing these words take a <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">-3 Penalty</span>.</p>
            <input 
              type="text"
              value={spam}
              onChange={(e) => setSpam(e.target.value)}
              placeholder="e.g. Sale, 50% Off, Newsletter"
              className="w-full bg-transparent text-lg font-medium text-slate-800 placeholder-slate-300 outline-none"
            />
          </div>

          <div className="flex items-center justify-end pt-8">
            <button 
              type="button" 
              onClick={() => window.location.href = '/dashboard'}
              className="mr-6 text-slate-400 font-bold hover:text-slate-600 transition-colors"
            >
              Skip for now
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-95 transition-all disabled:opacity-50 text-lg"
            >
              {success ? 'Saved! Redirecting...' : loading ? 'Saving Profile...' : 'Save & Continue'} <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
