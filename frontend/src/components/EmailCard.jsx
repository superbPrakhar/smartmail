import React from 'react';
import { Star, Mail, Zap } from 'lucide-react';

export default function EmailCard({ email, onClick }) {
  let borderLeftColor = 'border-[rgba(203,213,225,0.5)]'; // default tailwind slate-300
  let badgeColor = 'bg-slate-100 text-slate-600';
  
  if (email.importanceScore >= 4) {
    badgeColor = 'bg-rose-100 text-rose-700';
  } else if (email.importanceScore === 3) {
    badgeColor = 'bg-amber-100 text-amber-700';
  } else {
    badgeColor = 'bg-emerald-100 text-emerald-700';
  }

  // Novelty: Tone Ring
  if (email.tone === 'Urgent') borderLeftColor = 'border-l-rose-500 shadow-[-4px_0_15px_-3px_rgba(244,63,94,0.3)]';
  else if (email.tone === 'Friendly') borderLeftColor = 'border-l-teal-400 shadow-[-4px_0_15px_-3px_rgba(45,212,191,0.3)]';
  else if (email.tone === 'Angry') borderLeftColor = 'border-l-orange-500 shadow-[-4px_0_15px_-3px_rgba(249,115,22,0.3)]';
  else borderLeftColor = 'border-l-blue-400';

  const categoryColor = {
    'Academic': 'bg-blue-100 text-blue-700 border-blue-200',
    'Internship': 'bg-violet-100 text-violet-700 border-violet-200',
    'Events': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'Spam': 'bg-red-50 text-red-600 border-red-100',
    'Uncategorized': 'bg-slate-100 text-slate-600 border-slate-200'
  }[email.category] || 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <div 
      onClick={() => {
        localStorage.setItem('currentViewEmail', JSON.stringify(email));
        window.location.href = '/email-detail';
      }}
      className={`p-6 rounded-2xl cursor-pointer glass-card border-l-[6px] ${borderLeftColor}`}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-extrabold text-lg text-slate-800 line-clamp-1 pr-4">{email.subject}</h3>
        <span className={`flex items-center text-xs font-bold px-3 py-1 rounded-full shrink-0 ${badgeColor}`}>
          {email.importanceScore} <Star className="w-3.5 h-3.5 ml-1 fill-current" />
        </span>
      </div>
      
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-slate-500 font-semibold flex items-center">
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center mr-2">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
          </div>
          {email.sender.split('<')[0].trim()}
        </div>
        
        {/* Novelty: Time-ROI Badge */}
        {email.timeRoiScore && (
          <div className="flex bg-slate-800 text-slate-200 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md items-center shadow-inner">
            <Zap className="w-3 h-3 text-amber-400 mr-1 fill-amber-400"/>
            {email.readTimeGst}s read | ROI: {email.timeRoiScore}
          </div>
        )}
      </div>
      
      <p className="text-slate-600 text-sm line-clamp-2 mb-4 font-medium leading-relaxed">
        {email.summary}
      </p>
      
      <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-100 pt-3">
        <span className={`px-3 py-1 rounded-full font-bold border ${categoryColor}`}>
          {email.category}
        </span>
        <span className="font-semibold">{new Date(email.timestamp).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
