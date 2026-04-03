import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// SHA-256 password hashing via Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'albion_nav_salt_v2');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'superuser';
export type SubscriptionTier = 'free' | 'premium';

export interface Subscription {
  tier: SubscriptionTier;
  expiresAt?: string;
}

export interface CraftingPlan {
  id: string;
  name: string;
  type: 'crafting' | 'refining' | 'cooking';
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  lastProfit?: number;
  // Full calculator state
  craftList: any[];
  manualPrices: Record<string, Record<string, number>>;
  sellPrices: Record<string, number>;
  sourceCities: Record<string, string>;
  globalCity: string;
  rrrConfig: any;
  haveList: Record<string, number>;
  noRrrItems: string[];
}

export interface SavedSimulation {
  id: string;
  name: string;
  type: 'crafting' | 'refining' | 'cooking';
  timestamp: string;
  data: any;
}

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  subscription: Subscription;
  stats: {
    contributorLevel: number;
    points: number;
    joinDate: string;
  };
  craftingPlans: CraftingPlan[];
  savedSimulations: SavedSimulation[]; // legacy compat
  watchlist: string[];
}

// ─── Master Superuser (always available, never stored in accounts list) ────

const MASTER_PASSWORD_HASH_PROMISE = hashPassword('AlbionMaster2025!');

const MASTER_USER_TEMPLATE: Omit<User, 'passwordHash'> = {
  id: 'master-superuser',
  email: 'admin@albionnavigator.com',
  username: 'Master Admin',
  role: 'superuser',
  subscription: { tier: 'premium' },
  stats: { contributorLevel: 99, points: 999999, joinDate: '2024-01-01T00:00:00.000Z' },
  craftingPlans: [],
  savedSimulations: [],
  watchlist: [],
};

// ─── Limits ────────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<SubscriptionTier, number> = {
  free: 5,
  premium: Infinity,
};
export const WATCHLIST_LIMITS: Record<SubscriptionTier, number> = {
  free: 10,
  premium: Infinity,
};

// ─── Context ───────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  // Crafting Plans
  saveCraftingPlan: (plan: Omit<CraftingPlan, 'id' | 'createdAt' | 'updatedAt'>) => { ok: boolean; planId?: string; error?: string };
  updateCraftingPlan: (id: string, updates: Partial<Omit<CraftingPlan, 'id' | 'createdAt'>>) => void;
  deleteCraftingPlan: (id: string) => void;
  // Legacy
  saveSimulation: (simulation: Omit<SavedSimulation, 'id' | 'timestamp'>) => void;
  deleteSimulation: (id: string) => void;
  // Watchlist
  toggleWatchlist: (itemId: string) => void;
  // Subscription (UI only)
  upgradeToPremium: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ──────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('albion_session_v3');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Persist session + sync to accounts list
  useEffect(() => {
    if (user) {
      localStorage.setItem('albion_session_v3', JSON.stringify(user));
      if (user.id !== 'master-superuser') {
        try {
          const accounts: User[] = JSON.parse(localStorage.getItem('albion_accounts_v3') || '[]');
          const idx = accounts.findIndex(a => a.id === user.id);
          if (idx !== -1) accounts[idx] = user;
          else accounts.push(user);
          localStorage.setItem('albion_accounts_v3', JSON.stringify(accounts));
        } catch {}
      }
    } else {
      localStorage.removeItem('albion_session_v3');
    }
  }, [user]);

  // ── Auth ────────────────────────────────────────────────────────────────

  const login = async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const hash = await hashPassword(password);

      // Check master superuser
      const masterHash = await MASTER_PASSWORD_HASH_PROMISE;
      if (email.toLowerCase() === MASTER_USER_TEMPLATE.email && hash === masterHash) {
        // Load persisted master data (crafting plans, watchlist, etc.)
        const persistedMaster = localStorage.getItem('albion_master_data');
        const masterData = persistedMaster ? JSON.parse(persistedMaster) : {};
        setUser({ ...MASTER_USER_TEMPLATE, passwordHash: masterHash, ...masterData });
        return { ok: true };
      }

      const accounts: User[] = JSON.parse(localStorage.getItem('albion_accounts_v3') || '[]');
      const found = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());
      if (!found) return { ok: false, error: 'Email not found. Please register first.' };
      if (found.passwordHash !== hash) return { ok: false, error: 'Incorrect password.' };

      setUser(found);
      return { ok: true };
    } catch {
      return { ok: false, error: 'An error occurred. Please try again.' };
    }
  };

  const register = async (email: string, username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      if (!email.includes('@')) return { ok: false, error: 'Please enter a valid email address.' };
      if (username.trim().length < 3) return { ok: false, error: 'Username must be at least 3 characters.' };
      if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
      if (email.toLowerCase() === MASTER_USER_TEMPLATE.email) return { ok: false, error: 'This email is reserved.' };

      const accounts: User[] = JSON.parse(localStorage.getItem('albion_accounts_v3') || '[]');
      if (accounts.some(a => a.email.toLowerCase() === email.toLowerCase())) {
        return { ok: false, error: 'An account with this email already exists.' };
      }

      const passwordHash = await hashPassword(password);
      const newUser: User = {
        id: crypto.randomUUID?.() || Math.random().toString(36).substr(2, 12),
        email: email.toLowerCase().trim(),
        username: username.trim(),
        passwordHash,
        role: 'user',
        subscription: { tier: 'free' },
        stats: { contributorLevel: 1, points: 0, joinDate: new Date().toISOString() },
        craftingPlans: [],
        savedSimulations: [],
        watchlist: [],
      };

      accounts.push(newUser);
      localStorage.setItem('albion_accounts_v3', JSON.stringify(accounts));
      setUser(newUser);
      return { ok: true };
    } catch {
      return { ok: false, error: 'An error occurred. Please try again.' };
    }
  };

  const logout = () => setUser(null);

  // ── Crafting Plans ────────────────────────────────────────────────────────

  const saveCraftingPlan = (plan: Omit<CraftingPlan, 'id' | 'createdAt' | 'updatedAt'>): { ok: boolean; planId?: string; error?: string } => {
    if (!user) return { ok: false, error: 'Please login to save crafting plans.' };

    const currentPlans = user.craftingPlans || [];
    const limit = user.role === 'superuser' ? Infinity : PLAN_LIMITS[user.subscription.tier];

    // Don't count existing drafts against limit if this is also a draft
    const nonDraftCount = currentPlans.filter(p => !p.isDraft).length;
    if (!plan.isDraft && nonDraftCount >= limit && limit !== Infinity) {
      return { ok: false, error: `Free accounts can save up to ${limit} plans. Upgrade to Premium for unlimited.` };
    }

    const planId = Math.random().toString(36).substr(2, 9);
    const newPlan: CraftingPlan = {
      ...plan,
      id: planId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setUser(prev => prev ? { ...prev, craftingPlans: [newPlan, ...(prev.craftingPlans || [])] } : null);

    // Persist master data separately
    if (user.id === 'master-superuser') {
      setTimeout(() => {
        const masterData = { craftingPlans: [newPlan, ...currentPlans] };
        localStorage.setItem('albion_master_data', JSON.stringify(masterData));
      }, 0);
    }

    return { ok: true, planId };
  };

  const updateCraftingPlan = (id: string, updates: Partial<Omit<CraftingPlan, 'id' | 'createdAt'>>) => {
    if (!user) return;
    setUser(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        craftingPlans: (prev.craftingPlans || []).map(p =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        ),
      };
      // Persist master data
      if (prev.id === 'master-superuser') {
        localStorage.setItem('albion_master_data', JSON.stringify({ craftingPlans: updated.craftingPlans, watchlist: updated.watchlist }));
      }
      return updated;
    });
  };

  const deleteCraftingPlan = (id: string) => {
    if (!user) return;
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, craftingPlans: (prev.craftingPlans || []).filter(p => p.id !== id) };
      if (prev.id === 'master-superuser') {
        localStorage.setItem('albion_master_data', JSON.stringify({ craftingPlans: updated.craftingPlans, watchlist: updated.watchlist }));
      }
      return updated;
    });
  };

  // ── Legacy Simulations ────────────────────────────────────────────────────

  const saveSimulation = (sim: Omit<SavedSimulation, 'id' | 'timestamp'>) => {
    if (!user) return;
    const newSim: SavedSimulation = { ...sim, id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toISOString() };
    setUser(prev => prev ? { ...prev, savedSimulations: [newSim, ...(prev.savedSimulations || [])] } : null);
  };

  const deleteSimulation = (id: string) => {
    if (!user) return;
    setUser(prev => prev ? { ...prev, savedSimulations: (prev.savedSimulations || []).filter(s => s.id !== id) } : null);
  };

  // ── Watchlist ─────────────────────────────────────────────────────────────

  const toggleWatchlist = (itemId: string) => {
    if (!user) return;
    const limit = user.role === 'superuser' ? Infinity : WATCHLIST_LIMITS[user.subscription.tier];
    setUser(prev => {
      if (!prev) return null;
      const idx = prev.watchlist.indexOf(itemId);
      let next = [...prev.watchlist];
      if (idx === -1) {
        if (next.length >= limit) return prev; // silently ignore if at limit
        next.push(itemId);
      } else {
        next.splice(idx, 1);
      }
      return { ...prev, watchlist: next };
    });
  };

  // ── Subscription (UI only) ────────────────────────────────────────────────

  const upgradeToPremium = () => {
    if (!user) return;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    setUser(prev => prev ? { ...prev, subscription: { tier: 'premium', expiresAt } } : null);
  };

  return (
    <AuthContext.Provider value={{
      user, login, register, logout,
      saveCraftingPlan, updateCraftingPlan, deleteCraftingPlan,
      saveSimulation, deleteSimulation,
      toggleWatchlist, upgradeToPremium,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
