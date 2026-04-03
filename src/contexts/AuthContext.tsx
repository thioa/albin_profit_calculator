import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  username: string;
  stats: {
    contributorLevel: number;
    points: number;
    joinDate: string;
  };
  savedSimulations: SavedSimulation[];
  watchlist: string[]; // item IDs
}

export interface SavedSimulation {
  id: string;
  name: string;
  type: 'crafting' | 'refining' | 'cooking';
  timestamp: string;
  data: any; // The state from BaseCalculator
}

interface AuthContextType {
  user: User | null;
  login: (username: string) => Promise<boolean>;
  register: (username: string) => Promise<boolean>;
  logout: () => void;
  saveSimulation: (simulation: Omit<SavedSimulation, 'id' | 'timestamp'>) => void;
  deleteSimulation: (id: string) => void;
  toggleWatchlist: (itemId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('albion_user_session');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('albion_user_session', JSON.stringify(user));
      // Also update the global accounts list
      const accounts = JSON.parse(localStorage.getItem('albion_accounts') || '[]');
      const index = accounts.findIndex((a: any) => a.id === user.id);
      if (index !== -1) {
        accounts[index] = user;
        localStorage.setItem('albion_accounts', JSON.stringify(accounts));
      }
    } else {
      localStorage.removeItem('albion_user_session');
    }
  }, [user]);

  const login = async (username: string) => {
    const accounts = JSON.parse(localStorage.getItem('albion_accounts') || '[]');
    const found = accounts.find((a: any) => a.username.toLowerCase() === username.toLowerCase());
    if (found) {
      setUser(found);
      return true;
    }
    return false;
  };

  const register = async (username: string) => {
    const accounts = JSON.parse(localStorage.getItem('albion_accounts') || '[]');
    if (accounts.some((a: any) => a.username.toLowerCase() === username.toLowerCase())) {
      return false;
    }

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      username,
      stats: {
        contributorLevel: 1,
        points: 0,
        joinDate: new Date().toISOString(),
      },
      savedSimulations: [],
      watchlist: [],
    };

    accounts.push(newUser);
    localStorage.setItem('albion_accounts', JSON.stringify(accounts));
    setUser(newUser);
    return true;
  };

  const logout = () => setUser(null);

  const saveSimulation = (sim: Omit<SavedSimulation, 'id' | 'timestamp'>) => {
    if (!user) return;
    const newSim: SavedSimulation = {
      ...sim,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
    };
    setUser(prev => prev ? {
      ...prev,
      savedSimulations: [newSim, ...prev.savedSimulations]
    } : null);
  };

  const deleteSimulation = (id: string) => {
    if (!user) return;
    setUser(prev => prev ? {
      ...prev,
      savedSimulations: prev.savedSimulations.filter(s => s.id !== id)
    } : null);
  };

  const toggleWatchlist = (itemId: string) => {
    if (!user) return;
    setUser(prev => {
      if (!prev) return null;
      const index = prev.watchlist.indexOf(itemId);
      const next = [...prev.watchlist];
      if (index === -1) next.push(itemId);
      else next.splice(index, 1);
      return { ...prev, watchlist: next };
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, saveSimulation, deleteSimulation, toggleWatchlist }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
