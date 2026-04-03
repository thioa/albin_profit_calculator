import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, User, LogIn, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (mode === 'login') {
      const ok = await login(username);
      if (ok) {
        setSuccess('Logged in successfully!');
        setTimeout(onClose, 1000);
      } else {
        setError('User not found. Please register first.');
      }
    } else {
      const ok = await register(username);
      if (ok) {
        setSuccess('Account created! Logging in...');
        setTimeout(onClose, 1000);
      } else {
        setError('Username already taken.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md glass-panel rounded-3xl shadow-2xl border border-primary/20 overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-primary/10 flex items-center justify-between bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                {mode === 'login' ? <LogIn className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h3>
                <p className="text-xs text-primary/60 font-medium">
                  {mode === 'login' ? 'Login to access your simulations' : 'Join the elite crafters community'}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-primary/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-primary/50 uppercase tracking-[0.2em] ml-1">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your crafter name"
                  autoFocus
                  className="w-full bg-black/40 border border-primary/10 rounded-2xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-inner"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm font-medium"
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary-container text-on-primary font-black py-4 rounded-2xl shadow-[0_8px_20px_rgba(212,175,55,0.3)] transition-all active:scale-[0.98] uppercase tracking-widest text-sm flex items-center justify-center gap-3 group"
            >
              {mode === 'login' ? 'Access Profile' : 'Start Crafting'}
              <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <LogIn className="w-4 h-4" />
              </motion.div>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-primary/40 hover:text-primary text-xs font-bold transition-all"
              >
                {mode === 'login' ? "Don't have an account? Create one" : "Already have an account? Login here"}
              </button>
            </div>
          </form>

          {/* Footer Note */}
          <div className="p-4 bg-black/20 text-center border-t border-primary/5">
            <p className="text-[9px] text-primary/20 uppercase font-black tracking-widest">
              Local-First Secure Storage • No Password Required
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
