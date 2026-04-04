import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogIn, UserPlus, AlertCircle, CheckCircle2, Eye, EyeOff, Mail, User, Lock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              {mode === 'login' ? <LogIn className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
            </div>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-primary/50 text-xs">
            {mode === 'login' ? 'Access your crafting plans and profile' : 'Join the Albion Navigator community'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {/* Email */}
          <div className="grid gap-1.5">
            <Label htmlFor="auth-email" className="text-xs font-bold uppercase tracking-widest text-primary/50">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30 pointer-events-none" />
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                autoComplete="email"
                className="pl-10 bg-black/40 border-primary/10 focus:border-primary/30"
              />
            </div>
          </div>

          {/* Username (register only) */}
          <AnimatePresence>
            {mode === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid gap-1.5"
              >
                <Label htmlFor="auth-username" className="text-xs font-bold uppercase tracking-widest text-primary/50">Display Name</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30 pointer-events-none" />
                  <Input
                    id="auth-username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Your crafter name"
                    autoComplete="username"
                    className="pl-10 bg-black/40 border-primary/10 focus:border-primary/30"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Password */}
          <div className="grid gap-1.5">
            <Label htmlFor="auth-password" className="text-xs font-bold uppercase tracking-widest text-primary/50">
              Password {mode === 'register' && <span className="text-primary/30 normal-case font-normal tracking-normal">(min. 6 chars)</span>}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30 pointer-events-none" />
              <Input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="pl-10 pr-11 bg-black/40 border-primary/10 focus:border-primary/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Feedback */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2.5 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                key="ok"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2.5 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs font-medium"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <Button type="submit" disabled={loading} className="w-full">
            {loading && <LogIn className="w-4 h-4 mr-2 animate-spin" />}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>

          {/* Switch mode */}
          <div className="text-center">
            {mode === 'login' ? (
              <button type="button" onClick={() => switchMode('register')} className="text-primary/40 hover:text-primary text-xs transition-colors">
                Don't have an account? <span className="text-primary/60 font-bold">Register here</span>
              </button>
            ) : (
              <button type="button" onClick={() => switchMode('login')} className="text-primary/40 hover:text-primary text-xs transition-colors">
                Already have an account? <span className="text-primary/60 font-bold">Sign in</span>
              </button>
            )}
          </div>
        </form>

        <DialogFooter className="pt-2">
          <p className="text-xs text-primary/20 uppercase tracking-widest text-center w-full">
            Local-First • Password Secured • No Server Required
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}