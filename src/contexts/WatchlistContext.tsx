import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { fetchPrices } from '../lib/albion-api';
import { AlbionCity, AlbionServer } from '../types/albion';

export interface Notification {
  id: string;
  itemId: string;
  itemName: string;
  message: string;
  timestamp: string;
  type: 'price_drop' | 'price_spike' | 'system';
  read: boolean;
}

interface WatchlistContextType {
  notifications: Notification[];
  addNotification: (itemId: string, itemName: string, message: string, type?: Notification['type']) => void;
  markAsRead: (id: string) => void;
  clearNotifications: () => void;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export const WatchlistProvider = ({ children, server }: { children: ReactNode; server: AlbionServer }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('albion_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('albion_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (itemId: string, itemName: string, message: string, type: Notification['type'] = 'price_drop') => {
    const newNotif: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      itemId,
      itemName,
      message,
      timestamp: new Date().toISOString(),
      type,
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50)); // Keep last 50
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const clearNotifications = () => setNotifications([]);

  // Mock background check (In a real app, this would be a server-side cron)
  useEffect(() => {
    if (!user || user.watchlist.length === 0) return;

    const checkPrices = async () => {
      // Just a sample check for the first few items to simulate behavior
      const itemsToCheck = user.watchlist.slice(0, 5); 
      try {
        const prices = await fetchPrices(itemsToCheck, ["Caerleon", "Lymhurst", "Martlock"], [1], server);
        
        // Simulate a "Price Alert" if price is low enough (this is just for demo/logic)
        prices.forEach(p => {
          if (p.sell_price_min > 0 && p.sell_price_min < 50000) { // arbitrary threshold
             // In a real app, we'd compare against targetPrice set by user
          }
        });
      } catch (e) {
        console.error("Watchlist price check failed", e);
      }
    };

    const interval = setInterval(checkPrices, 300000); // Every 5 mins
    return () => clearInterval(interval);
  }, [user, server]);

  return (
    <WatchlistContext.Provider value={{ notifications, addNotification, markAsRead, clearNotifications }}>
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error('useWatchlist must be used within a WatchlistProvider');
  return context;
};
