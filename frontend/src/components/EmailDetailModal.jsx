import React, { useState } from 'react';
import { X, Star, Calendar, User, AlignLeft, Sparkles, Zap } from 'lucide-react';

export default function EmailDetailModal({ email, onClose }) {
  if (!email) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-opacity animate-in fade-in duration-300">
      <div className="bg-white/95 backdrop-blur-3xl rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-white/50 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100/50 flex justify-between items-start bg-slate-50/50">
          <div className="flex-1 pr-6">
            <h2 className="text-2xl font-extrabold text-slate-800 leading-tight">{email.subject}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full transition-colors bg-white shadow-sm border border-slate-200">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Metadata Badges */}
          <div className="flex flex-wrap gap-3 mb-8 text-sm">
            <div className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold">
              <User className="w-4 h-4 mr-2 text-slate-500" />
              {email.sender}
            </div>
            <div className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold">
              <Calendar className="w-4 h-4 mr-2 text-slate-500" />
              {new Date(email.timestamp).toLocaleString()}
            </div>
            <div className="flex items-center bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl font-bold shadow-sm">
               Score: {email.importanceScore} <Star className="w-4 h-4 ml-1 fill-amber-500 text-amber-500" />
            </div>
            <div className="flex items-center bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-xl font-bold shadow-sm">
              {email.category}
            </div>
          </div>

          {/* AI Summary Section */}
          <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 rounded-3xl relative overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4"/> Smart Summary
            </h4>
            <p className="text-slate-800 leading-relaxed font-bold text-lg relative z-10">{email.summary}</p>
          </div>

          {/* Full Body Section */}
          <div className="mb-8">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
              <AlignLeft className="w-4 h-4" /> Original Content
            </h4>
            <div className="text-slate-600 whitespace-pre-wrap font-sans text-[15px] leading-relaxed p-8 bg-slate-50/50 rounded-3xl border border-slate-100 min-h-[200px] shadow-sm selection:bg-blue-100">
              {email.body}
            </div>
          </div>
          
          {/* Novelty: AI Smart Replies */}
          {email.smartReplies && email.smartReplies.length > 0 && (
            <div className="border-t border-slate-100 pt-6 mt-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-violet-500 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" /> AI One-Click Replies
              </h4>
              <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                {email.smartReplies.map((reply, idx) => (
                  <button 
                    key={idx}
                    onClick={() => { alert('Demo: Fake "Reply Sent" executing for: ' + reply); onClose(); }}
                    className="shrink-0 px-5 py-2.5 bg-white border-2 border-violet-100 text-violet-700 font-bold rounded-xl hover:bg-violet-50 hover:border-violet-300 transition-all shadow-sm active:scale-95"
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
  );
}
