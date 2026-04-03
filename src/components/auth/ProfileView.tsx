import React, { useState } from 'react';
import { useAuth, SavedSimulation } from '../../contexts/AuthContext';
import { useWatchlist, Notification as AppNotification } from '../../contexts/WatchlistContext';
import { 
  User, 
  Settings, 
  LogOut, 
  History, 
  Star, 
  Trash2, 
  ExternalLink, 
  ChevronRight, 
  Zap, 
  Bell, 
  CheckCheck,
  TrendingDown,
  TrendingUp,
  Package,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatSilver, formatTimeAgo } from '../../lib/economy-utils';

export default function ProfileView({ 
  onSelectSimulation, 
  initialTab = 'sims' 
}: { 
  onSelectSimulation: (sim: SavedSimulation) => void,
  initialTab?: 'sims' | 'watch' | 'notifs'
}) {
  const { user, logout, deleteSimulation } = useAuth();
  const { notifications, markAsRead, clearNotifications } = useWatchlist();
  const [activeSubTab, setActiveSubTab] = useState<'sims' | 'watch' | 'notifs'>(initialTab);

  if (!user) return (
    <div className="flex flex-col items-center justify-center p-20 text-center space-y-6 glass-panel rounded-3xl border border-primary/10">
      <div className="p-6 bg-primary/5 rounded-full border border-primary/20 shadow-inner">
        <User className="w-20 h-20 text-primary/30" />
      </div>
      <div>
        <h3 className="text-2xl font-black text-white uppercase tracking-tight">Access Restricted</h3>
        <p className="text-primary/60 max-w-sm mx-auto mt-2 text-sm leading-relaxed font-medium">Please login or register to view your profile and saved simulations.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Description */}
      <div className="glass-panel p-5 rounded-3xl border border-primary/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <User className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-black text-white uppercase italic tracking-wider">My Profile</h2>
        </div>
        <p className="text-primary/60 text-sm">
          Manage your saved crafting simulations, track watchlisted items for price alerts, and view your notification history — all in one place.
        </p>
      </div>

      {/* Header Profile Card */}
      <div className="glass-panel p-8 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <User className="w-48 h-48 text-primary -mr-20 -mt-20 rotate-12" />
        </div>

        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative">
            <div className="w-32 h-32 rounded-3xl overflow-hidden bg-surface-container-highest border-2 border-primary/40 shadow-2xl flex items-center justify-center group-hover:border-primary transition-all duration-500">
              <span className="material-symbols-outlined text-primary text-6xl group-hover:scale-110 transition-transform duration-700">account_circle</span>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-xl p-1.5 shadow-lg border-4 border-[#0a0e14]">
              <Zap className="w-4 h-4 fill-current" />
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <h2 className="text-3xl font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors duration-300">{user.username}</h2>
              <span className="inline-flex px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black text-primary uppercase tracking-widest self-center md:self-start">Level {user.stats.contributorLevel} Contributor</span>
            </div>
            <p className="text-primary/60 text-sm font-medium">Member since {new Date(user.stats.joinDate).toLocaleDateString()}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 pt-4">
              <div className="text-center md:text-left">
                <p className="text-[10px] text-primary/40 uppercase font-black tracking-widest">Saved Sims</p>
                <p className="text-xl font-black text-white">{user.savedSimulations.length}</p>
              </div>
              <div className="w-[1px] h-8 bg-primary/10 hidden md:block"></div>
              <div className="text-center md:text-left">
                <p className="text-[10px] text-primary/40 uppercase font-black tracking-widest">Watched Items</p>
                <p className="text-xl font-black text-white">{user.watchlist.length}</p>
              </div>
              <div className="w-[1px] h-8 bg-primary/10 hidden md:block"></div>
              <div className="text-center md:text-left">
                <p className="text-[10px] text-primary/40 uppercase font-black tracking-widest">Points</p>
                <p className="text-xl font-black text-emerald-400">{user.stats.points}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 shrink-0">
            <button 
              onClick={logout}
              className="flex items-center justify-center gap-3 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-[0_4px_15px_rgba(239,68,68,0.1)] active:scale-95"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
            <button className="flex items-center justify-center gap-3 px-6 py-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95">
              <Settings className="w-4 h-4" /> Settings
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Main Content Areas */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-1 p-1 bg-black/40 rounded-2xl border border-primary/10 w-fit">
            <button
              onClick={() => setActiveSubTab('sims')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'sims' ? 'bg-primary text-on-primary shadow-lg' : 'text-primary/50 hover:bg-white/5'}`}
            >
              <History className="w-3.5 h-3.5" /> Saved Simulations
            </button>
            <button
              onClick={() => setActiveSubTab('watch')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'watch' ? 'bg-primary text-on-primary shadow-lg' : 'text-primary/50 hover:bg-white/5'}`}
            >
              <Star className="w-3.5 h-3.5" /> Watchlist
            </button>
            <button
              onClick={() => setActiveSubTab('notifs')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'notifs' ? 'bg-primary text-on-primary shadow-lg relative' : 'text-primary/50 hover:bg-white/5 relative'}`}
            >
              <Bell className="w-3.5 h-3.5" /> Notifications
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black/40 animate-pulse"></span>
              )}
            </button>
          </div>

          <div className="glass-panel p-6 rounded-3xl min-h-[400px]">
            <AnimatePresence mode="wait">
              {activeSubTab === 'sims' && (
                <motion.div 
                  key="sims"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between px-2 mb-2">
                    <h4 className="text-sm font-black text-primary/50 uppercase tracking-widest">Recent Simulation Backups</h4>
                  </div>
                  
                  {user.savedSimulations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 opacity-40">
                      <History className="w-16 h-16 text-primary/30" />
                      <p className="text-sm font-bold">No simulations saved yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {user.savedSimulations.map((sim) => (
                        <div key={sim.id} className="group p-5 bg-black/40 border border-primary/10 rounded-2xl hover:border-primary/40 transition-all hover:translate-y-[-2px] relative overflow-hidden">
                          <div className="flex items-center justify-between mb-4">
                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest
                              ${sim.type === 'crafting' ? 'bg-indigo-500/10 text-indigo-400' : 
                                sim.type === 'refining' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}
                            `}>
                              {sim.type}
                            </span>
                            <span className="text-[10px] text-primary/30 font-medium">{formatTimeAgo(sim.timestamp)}</span>
                          </div>
                          <h5 className="text-white font-bold text-lg mb-4 truncate group-hover:text-primary transition-colors">{sim.name}</h5>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => onSelectSimulation(sim)}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-on-primary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Re-Open simulation
                            </button>
                            <button 
                              onClick={() => deleteSimulation(sim.id)}
                              className="p-2.5 bg-red-500/5 hover:bg-red-500/20 text-red-500 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeSubTab === 'watch' && (
                <motion.div 
                  key="watch"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between px-2 mb-2">
                    <h4 className="text-sm font-black text-primary/50 uppercase tracking-widest">Watching for Opportunities</h4>
                  </div>
                  {user.watchlist.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 opacity-40">
                      <Star className="w-16 h-16 text-primary/30" />
                      <p className="text-sm font-bold">Watchlist is currently empty.</p>
                      <p className="text-[10px]">Add items from Top Flips to monitor them.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {user.watchlist.map((id) => (
                        <div key={id} className="p-4 bg-black/40 border border-primary/10 rounded-2xl flex items-center gap-4 group hover:border-primary/30 transition-all">
                          <img 
                            src={`https://render.albiononline.com/v1/item/${id}.png`} 
                            alt={id} 
                            className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-xs truncate uppercase tracking-tight">{id.replace(/_/g, ' ').split(':').pop()}</p>
                            <p className="text-primary/40 text-[9px] font-black uppercase tracking-widest mt-1">Live Tracking</p>
                          </div>
                          <button className="p-2 text-primary/30 hover:text-red-500 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeSubTab === 'notifs' && (
                <motion.div 
                  key="notifs"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between px-2 mb-4">
                    <h4 className="text-sm font-black text-primary/50 uppercase tracking-widest">Price Alerts & System Logs</h4>
                    {notifications.length > 0 && (
                      <button 
                        onClick={clearNotifications}
                        className="text-[9px] font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-colors flex items-center gap-2"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Mark all as read
                      </button>
                    )}
                  </div>
                  
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 opacity-40">
                      <Bell className="w-16 h-16 text-primary/30" />
                      <p className="text-sm font-bold">Inbox zero! No new alerts.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((n) => (
                        <div 
                          key={n.id} 
                          onClick={() => markAsRead(n.id)}
                          className={`p-5 rounded-2xl border transition-all cursor-pointer flex gap-5 items-start
                            ${n.read ? 'bg-black/20 border-primary/5 opacity-60' : 'bg-primary/5 border-primary/20 shadow-lg'}
                          `}
                        >
                          <div className={`p-3 rounded-xl shadow-inner shrink-0
                            ${n.type === 'price_drop' ? 'bg-emerald-500/10 text-emerald-400' : 
                              n.type === 'price_spike' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-400'}
                          `}>
                            {n.type === 'price_drop' ? <TrendingDown className="w-5 h-5" /> : 
                             n.type === 'price_spike' ? <TrendingUp className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                              <p className="font-bold text-white text-sm uppercase tracking-tight">{n.itemName}</p>
                              <span className="text-[10px] text-primary/30 font-medium">{formatTimeAgo(n.timestamp)}</span>
                            </div>
                            <p className="text-primary/60 text-xs leading-relaxed">{n.message}</p>
                          </div>
                          {!n.read && <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_8px_rgba(212,175,55,0.8)] mt-2"></div>}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
