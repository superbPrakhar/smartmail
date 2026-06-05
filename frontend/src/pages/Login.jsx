import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Mail, Lock, Zap, Shield, Sparkles } from 'lucide-react';

axios.defaults.withCredentials = true;

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errParam = params.get('error');
    if (errParam) {
      if (errParam === 'gmail_connect_failed') {
        setError('Google connection failed. Make sure your account is added to Google OAuth Test Users.');
      } else if (errParam === 'not_authenticated_for_gmail') {
        setError('Please sign in first before connecting Gmail.');
      } else {
        setError(decodeURIComponent(errParam).replace(/_/g, ' '));
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const res = await axios.post(endpoint, { email, password });
      
      const user = res.data.user;
      if (!user.isGmailConnected) {
        window.location.href = '/connect-gmail';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-50">
      {/* Animated Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/30 blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-400/30 blur-[120px] animate-pulse delay-1000"></div>
      
      <div className="relative z-10 w-full max-w-[1100px] mx-auto p-6 flex flex-col lg:flex-row gap-12 items-center">
        
        {/* Left Side: Marketing/Hero */}
        <div className="flex-1 text-center lg:text-left text-slate-800">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6 shadow-sm border border-white/50 text-blue-700 font-bold text-sm animate-float">
            <Sparkles className="w-4 h-4" /> AI Email Prioritization
          </div>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
            The Inbox, <br/> <span className="text-gradient">Mastered.</span>
          </h1>
          <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto lg:mx-0 font-medium">
            SmartMail automatically analyzes, scores, and summarizes your emails so you can save hours of cognitive load every single day.
          </p>
          <div className="hidden md:flex justify-center lg:justify-start gap-6">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-white/60 px-4 py-2 rounded-xl">
              <Zap className="w-5 h-5 text-amber-500" /> Instant Summaries
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-white/60 px-4 py-2 rounded-xl">
              <Shield className="w-5 h-5 text-emerald-500" /> Custom Priorities
            </div>
          </div>
        </div>

        {/* Right Side: Glass Login Form */}
        <div className="w-full max-w-md glass rounded-3xl p-8 shadow-2xl border border-white">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h2>
          </div>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 flex items-center justify-center">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Email address</label>
              <div className="relative group">
                <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-3.5 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800" 
                  placeholder="you@example.com"
                  required 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
              <div className="relative group">
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-3.5 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800" 
                  placeholder="••••••••"
                  required 
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 mt-4"
            >
              {loading ? 'Processing...' : isLogin ? 'Sign In ➔' : 'Create Account ➔'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm font-semibold text-slate-500">
            {isLogin ? "New to SmartMail? " : "Already have an account? "}
            <button 
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="font-bold text-blue-600 hover:text-blue-700 transition-colors focus:outline-none ml-1"
            >
              {isLogin ? 'Create one now' : 'Log in here'}
            </button>
          </div>
          
          <div className="mt-6 pt-6 border-t border-slate-200/60 text-center">
            <button onClick={() => window.location.href = '/auth/mockLogin'} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg">
              Test UI directly (Mock Data)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
