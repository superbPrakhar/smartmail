import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Filter, LogOut, Search, Settings, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import EmailCard from '../components/EmailCard';

axios.defaults.withCredentials = true;

export default function Dashboard() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isZenMode, setIsZenMode] = useState(false);
  
  // Filters
  const [minScore, setMinScore] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    fetchEmails();
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const meRes = await axios.get('/auth/me');
      if (!meRes.data.isGmailConnected) {
         window.location.href = '/connect-gmail';
         return;
      }
      
      const res = await axios.get('/emails/fetch');
      if (res.data.error) throw new Error(res.data.error);
      if (res.data.message === 'No emails found') {
        setEmails([]);
      } else {
        setEmails(res.data);
        if ('Notification' in window && Notification.permission === 'granted') {
          const urgentEmail = res.data.find(e => e.wittyNotification);
          if (urgentEmail) {
             new Notification('SmartMail AI 💌', {
               body: urgentEmail.wittyNotification,
               icon: 'https://cdn-icons-png.flaticon.com/512/732/732200.png'
             });
          }
        }
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(`Error: ${err.response.data.error}`);
      } else {
        setError(err.message || 'Failed to fetch emails. Are you connected to internet?');
      }
      if (err.response && err.response.status === 401) {
         window.location.href = '/';
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/auth/logout');
      window.location.href = '/';
    } catch (err) {
      console.error(err);
    }
  };

  // Apply priority filter based on active button
  const getScoreFilter = () => {
    if (activeFilter === 'urgent') return [4, 5];
    if (activeFilter === 'medium') return [3, 3];
    if (activeFilter === 'low') return [1, 2];
    return [minScore, 5];
  };

  const filteredEmails = emails.filter(email => {
    const [minS, maxS] = getScoreFilter();
    const meetScore = email.importanceScore >= minS && email.importanceScore <= maxS;
    const meetCategory = categoryFilter === 'All' || email.category === categoryFilter;
    return meetScore && meetCategory;
  });

  // Count emails per priority
  const urgentCount = emails.filter(e => e.importanceScore >= 4).length;
  const mediumCount = emails.filter(e => e.importanceScore === 3).length;
  const lowCount = emails.filter(e => e.importanceScore <= 2).length;

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-[280px] bg-white/70 backdrop-blur-2xl border-r border-slate-200/60 p-6 flex flex-col z-10 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center mb-10">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-blue-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">SmartMail</h1>
        </div>

        <div className="mb-10 flex-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center"><Filter className="w-3 h-3 mr-2" /> Filters</h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Minimum Priority</label>
              <select 
                value={minScore} 
                onChange={(e) => { setMinScore(Number(e.target.value)); setActiveFilter('all'); }}
                className="w-full bg-slate-100/50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer appearance-none"
              >
                <option value={1}>Show All Emails</option>
                <option value={3}>⭐ 3+ Stars (Medium)</option>
                <option value={4}>⭐ 4+ Stars (Important)</option>
                <option value={5}>⭐ 5 Stars (Urgent)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Category Filter</label>
              <select 
                value={categoryFilter} 
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-slate-100/50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer appearance-none"
              >
                <option value="All">All Categories</option>
                <option value="Academic">Academic</option>
                <option value="Internship">Internship</option>
                <option value="Events">Events</option>
                <option value="Spam">Spam filter</option>
                <option value="Uncategorized">Uncategorized</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-2">
          <button 
            onClick={() => window.location.href = '/setup-priorities'}
            className="flex items-center text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-4 py-3 rounded-xl transition-all text-sm font-bold w-full"
          >
            <Settings className="w-4 h-4 mr-3" />
            Priorities Engine
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center text-slate-600 hover:text-red-600 hover:bg-red-50 px-4 py-3 rounded-xl transition-all text-sm font-bold w-full"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Log out securely
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-50/50 to-transparent -z-10"></div>
        
        {/* Header */}
        <header className="px-10 pt-10 pb-6 w-full max-w-5xl mx-auto flex justify-between items-end relative z-10">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">AI Inbox</h2>
            <p className="text-slate-500 font-medium mt-1">We've sorted your latest messages to save cognitive load.</p>
          </div>
          <div className="flex items-center gap-3 text-sm font-bold">
              <button 
                onClick={() => setIsZenMode(!isZenMode)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all border ${isZenMode ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg shadow-indigo-500/30' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm'}`}
              >
                🛡️ Zen Mode
              </button>

              {/* WORKING Filter Buttons */}
              <button
                onClick={() => setActiveFilter(activeFilter === 'urgent' ? 'all' : 'urgent')}
                className={`px-4 py-2 rounded-full border transition-all cursor-pointer active:scale-95 ${activeFilter === 'urgent' ? 'bg-rose-600 text-white border-rose-700 shadow-lg shadow-rose-500/30' : 'bg-rose-100 text-rose-700 border-rose-200/50 shadow-sm hover:bg-rose-200'}`}
              >
                🔴 Urgent ({urgentCount})
              </button>
              <button
                onClick={() => setActiveFilter(activeFilter === 'medium' ? 'all' : 'medium')}
                className={`px-4 py-2 rounded-full border transition-all cursor-pointer active:scale-95 ${activeFilter === 'medium' ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-500/30' : 'bg-amber-100 text-amber-700 border-amber-200/50 shadow-sm hover:bg-amber-200'}`}
              >
                🟡 Medium ({mediumCount})
              </button>
              <button
                onClick={() => setActiveFilter(activeFilter === 'low' ? 'all' : 'low')}
                className={`px-4 py-2 rounded-full border transition-all cursor-pointer active:scale-95 ${activeFilter === 'low' ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-200/50 shadow-sm hover:bg-emerald-200'}`}
              >
                🟢 Low ({lowCount})
              </button>
          </div>
        </header>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-10 pb-10 w-full max-w-5xl mx-auto hide-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <p className="font-bold text-slate-500">AI is fetching and analyzing your emails...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-6 rounded-2xl flex items-center border border-red-100 shadow-sm">
              <AlertCircle className="w-6 h-6 mr-3" />
              <span className="font-semibold">{error}</span>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="text-center py-20 glass rounded-3xl mt-4 border-dashed border-2 border-slate-300">
              <Search className="w-16 h-16 text-slate-300 mx-auto mb-6" />
              <h3 className="text-xl font-bold text-slate-800">No Emails Found</h3>
              <p className="text-slate-500 font-medium mt-2">No emails found matching your current filter. Try clicking the active filter button again to reset.</p>
            </div>
          ) : (
            <div className="grid gap-4 mt-2">
              {filteredEmails.map(email => {
                const blurClass = (isZenMode && email.importanceScore < 3) 
                  ? 'blur-[6px] opacity-40 grayscale pointer-events-none transition-all duration-500' 
                  : 'transition-all duration-500';
                
                return (
                  <div key={email.emailId} className={blurClass}>
                     <EmailCard email={email} onClick={() => {}} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
