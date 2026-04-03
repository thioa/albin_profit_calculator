import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { X, LogIn, UserPlus, AlertCircle, CheckCircle2, Eye, EyeOff, Mail, User, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login, register } = useAuth();

  const reset = () => { setEmail(''); setUsername(''); setPassword(''); setError(''); setSuccess(''); };
  const switchMode = (m: 'login' | 'register') => { setMode(m); reset(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (res.ok) { setSuccess('Welcome back!'); setTimeout(onClose, 900); }
        else setError(res.error || 'Login failed.');
      } else {
        const res = await register(email, username, password);
        if (res.ok) { setSuccess('Account created! Welcome aboard.'); setTimeout(onClose, 900); }
        else setError(res.error || 'Registration failed.');
      }
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          className="relative w-full max-w-[420px] glass-panel rounded-3xl shadow-2xl border border-primary/20 overflow-hidden"
        >
          {/* Decorative top gradient */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-primary/8 to-transparent pointer-events-none" />

          {/* Header */}
          <div className="relative p-6 pb-0 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                {mode === 'login' ? <LogIn className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </h3>
                <p className="text-xs text-primary/50 mt-0.5">
                  {mode === 'login' ? 'Access your crafting plans and profile' : 'Join the Albion Navigator community'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-primary/30 hover:text-white mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="relative p-6 pt-5 space-y-3">

            {/* Email */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/25" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoFocus autoComplete="email"
                  className="w-full bg-black/40 border border-primary/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm font-medium placeholder:text-primary/20 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
              </div>
            </div>

            {/* Username (register only) */}
            <AnimatePresence>
              {mode === 'register' && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="space-y-1 overflow-hidden"
                >
                  <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Display Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/25" />
                    <input
                      type="text" value={username} onChange={e => setUsername(e.target.value)}
                      placeholder="Your crafter name" autoComplete="username"
                      className="w-full bg-black/40 border border-primary/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm font-medium placeholder:text-primary/20 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">
                Password {mode === 'register' && <span className="text-primary/25 normal-case font-normal tracking-normal">(min. 6 chars)</span>}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/25" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full bg-black/40 border border-primary/10 rounded-xl py-3 pl-10 pr-11 text-white text-sm font-medium placeholder:text-primary/20 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-primary/25 hover:text-primary transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Feedback */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div key="err" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </motion.div>
              )}
              {success && (
                <motion.div key="ok" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2.5 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full mt-1 bg-primary hover:brightness-110 text-black font-black py-3.5 rounded-xl shadow-[0_6px_20px_rgba(212,175,55,0.25)] transition-all active:scale-[0.98] uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading
                ? <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                : mode === 'login' ? <><LogIn className="w-4 h-4" /> Sign In</> : <><UserPlus className="w-4 h-4" /> Create Account</>
              }
            </button>

            {/* Switch mode */}
            <div className="text-center pt-1">
              {mode === 'login' ? (
                <button type="button" onClick={() => switchMode('register')} className="text-primary/35 hover:text-primary text-xs transition-colors">
                  Don't have an account? <span className="text-primary/60 font-bold">Register here</span>
                </button>
              ) : (
                <button type="button" onClick={() => switchMode('login')} className="text-primary/35 hover:text-primary text-xs transition-colors">
                  Already have an account? <span className="text-primary/60 font-bold">Sign in</span>
                </button>
              )}
            </div>
          </form>

          <div className="px-6 pb-5 text-center">
            <p className="text-[9px] text-primary/15 uppercase tracking-widest">
              Local-First • Password Secured • No Server Required
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
