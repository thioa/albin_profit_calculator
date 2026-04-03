import React, { useState } from 'react';
import { useAuth, SavedSimulation } from '../../contexts/AuthContext';
import { useWatchlist } from '../../contexts/WatchlistContext';
import {
  User, Settings, LogOut, History, Star, Trash2, ExternalLink,
  Zap, Bell, CheckCheck, TrendingDown, TrendingUp, Package, X,
  Crown, Shield, Mail, Calendar, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatSilver, formatTimeAgo } from '../../lib/economy-utils';

const ROLE_CONFIG = {
  superuser: { label: 'Master', icon: Shield, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  user: { label: 'Member', icon: User, color: 'text-primary/60', bg: 'bg-primary/5', border: 'border-primary/10' },
};

const SUB_CONFIG = {
  premium: { label: 'Premium', icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  free: { label: 'Free', icon: Zap, color: 'text-primary/50', bg: 'bg-white/5', border: 'border-white/5' },
};

export default function ProfileView({
  onSelectSimulation,
  initialTab = 'sims'
}: {
  onSelectSimulation: (sim: SavedSimulation) => void,
  initialTab?: 'sims' | 'watch' | 'notifs'
}) {
  const { user, logout, deleteSimulation, upgradeToPremium } = useAuth();
  const { notifications, markAsRead, clearNotifications } = useWatchlist();
  const [activeSubTab, setActiveSubTab] = useState<'sims' | 'watch' | 'notifs'>(initialTab);

  if (!user) return (
    <div className="flex flex-col items-center justify-center p-20 text-center space-y-6 glass-panel rounded-3xl border border-primary/10">
      <div className="p-6 bg-primary/5 rounded-full border border-primary/20">
        <User className="w-20 h-20 text-primary/30" />
      </div>
      <div>
        <h3 className="text-2xl font-black text-white uppercase tracking-tight">Access Restricted</h3>
        <p className="text-primary/60 max-w-sm mx-auto mt-2 text-sm leading-relaxed">
          Please sign in to view your profile and saved crafting plans.
        </p>
      </div>
    </div>
  );

  const roleCfg = ROLE_CONFIG[user.role];
  const RoleIcon = roleCfg.icon;
  const subCfg = SUB_CONFIG[user.subscription.tier];
  const SubIcon = subCfg.icon;
  const isPremium = user.subscription.tier === 'premium' || user.role === 'superuser';

  return (
    <div className="space-y-6">

      {/* ── Hero Profile Card ── */}
      <div className="glass-panel p-8 rounded-3xl border border-primary/15 bg-linear-to-br from-primary/8 to-transparent relative overflow-hidden group">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-28 h-28 rounded-3xl bg-black/40 border-2 border-primary/30 flex items-center justify-center group-hover:border-primary transition-all duration-500 shadow-2xl">
              <span className="material-symbols-outlined text-primary text-5xl">account_circle</span>
            </div>
            {/* Role badge */}
            <div className={`absolute -bottom-2 -right-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider shadow-lg ${roleCfg.bg} ${roleCfg.border} ${roleCfg.color}`}>
              <RoleIcon className="w-3.5 h-3.5" /> {roleCfg.label}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <h2 className="text-3xl font-black text-white uppercase tracking-tight">{user.username}</h2>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider self-center ${subCfg.bg} ${subCfg.border} ${subCfg.color}`}>
                <SubIcon className="w-3.5 h-3.5" /> {subCfg.label}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-primary/50 font-medium">
              <span className="flex items-center gap-2"><Mail className="w-4 h-4" />{user.email}</span>
              <span className="flex items-center gap-2"><Calendar className="w-4 h-4" />Joined {new Date(user.stats.joinDate).toLocaleDateString()}</span>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-6 pt-2">
              {[
                { label: 'Saved Plans', value: user.craftingPlans?.length || 0 },
                { label: 'Watchlist', value: user.watchlist.length },
                { label: 'Points', value: user.stats.points.toLocaleString(), highlight: true },
                { label: 'Level', value: `Lv.${user.stats.contributorLevel}` },
              ].map(stat => (
                <div key={stat.label} className="text-center md:text-left">
                  <p className="text-xs text-primary/40 uppercase font-bold tracking-wider">{stat.label}</p>
                  <p className={`text-xl font-black ${stat.highlight ? 'text-success' : 'text-white'}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={logout}
              className="flex items-center justify-center gap-2.5 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95">
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
            <button className="flex items-center justify-center gap-2.5 px-5 py-2.5 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/15 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95">
              <Settings className="w-3.5 h-3.5" /> Settings
            </button>
          </div>
        </div>
      </div>

      {/* ── Subscription Banner (free users only) ── */}
      {!isPremium && (
        <div className="glass-panel p-5 rounded-2xl border border-yellow-500/10 bg-linear-to-r from-yellow-500/5 to-transparent flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-xl">
              <Crown className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Upgrade to Premium</p>
              <p className="text-xs text-primary/50 mt-0.5">Unlimited crafting plans · Unlimited watchlist · Priority scan</p>
            </div>
          </div>
          <button
            onClick={upgradeToPremium}
            className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shrink-0 active:scale-95"
          >
            <Crown className="w-3.5 h-3.5" /> Upgrade
          </button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-1 bg-black/40 rounded-2xl border border-primary/8 w-fit">
        {[
          { id: 'sims', label: 'Simulations', icon: History },
          { id: 'watch', label: 'Watchlist', icon: Star },
          { id: 'notifs', label: 'Notifications', icon: Bell, badge: notifications.filter(n => !n.read).length },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveSubTab(tab.id as any)}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === tab.id ? 'bg-primary text-black shadow-lg' : 'text-primary/40 hover:bg-white/5 hover:text-primary'}`}>
              <Icon className="w-3.5 h-3.5" /> {tab.label}
              {tab.badge ? <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-black flex items-center justify-center text-white border border-black/40">{tab.badge}</span> : null}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="glass-panel p-6 rounded-3xl min-h-90">
        <AnimatePresence mode="wait">

          {/* Simulations */}
          {activeSubTab === 'sims' && (
            <motion.div key="sims" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <h4 className="text-xs font-black text-primary/40 uppercase tracking-widest px-1">Saved Simulations</h4>
              {!user.savedSimulations?.length ? (
                <div className="flex flex-col items-center justify-center py-16 opacity-40 gap-3">
                  <History className="w-14 h-14 text-primary/20" />
                  <p className="text-sm font-bold">No simulations saved yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {user.savedSimulations.map(sim => (
                    <div key={sim.id} className="group p-4 bg-black/30 border border-primary/8 rounded-2xl hover:border-primary/30 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary">
                          {sim.type}
                        </span>
                        <span className="text-[9px] text-primary/25">{formatTimeAgo(sim.timestamp)}</span>
                      </div>
                      <h5 className="text-white font-bold text-sm mb-3 truncate group-hover:text-primary transition-colors">{sim.name}</h5>
                      <div className="flex gap-2">
                        <button onClick={() => onSelectSimulation(sim)} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary/8 hover:bg-primary text-primary hover:text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                          <ExternalLink className="w-3 h-3" /> Open
                        </button>
                        <button onClick={() => deleteSimulation(sim.id)} className="p-2 bg-red-500/5 hover:bg-red-500/20 text-red-500/50 hover:text-red-400 rounded-xl transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Watchlist */}
          {activeSubTab === 'watch' && (
            <motion.div key="watch" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <h4 className="text-xs font-black text-primary/40 uppercase tracking-widest px-1">Watched Items ({user.watchlist.length})</h4>
              {!user.watchlist.length ? (
                <div className="flex flex-col items-center justify-center py-16 opacity-40 gap-3">
                  <Star className="w-14 h-14 text-primary/20" />
                  <p className="text-sm font-bold">Watchlist is empty.</p>
                  <p className="text-xs">Add items from Top Flips to watch them.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {user.watchlist.map(id => (
                    <div key={id} className="p-3 bg-black/30 border border-primary/8 rounded-xl flex items-center gap-3 group hover:border-primary/25 transition-all">
                      <img src={`https://render.albiononline.com/v1/item/${id}.png`} alt={id} className="w-10 h-10 object-contain group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-bold truncate uppercase">{id.replace(/_/g, ' ').split(':').pop()}</p>
                        <p className="text-primary/30 text-[9px] uppercase tracking-widest mt-0.5">Live Tracking</p>
                      </div>
                      <Package className="w-3.5 h-3.5 text-primary/20 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Notifications */}
          {activeSubTab === 'notifs' && (
            <motion.div key="notifs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-black text-primary/40 uppercase tracking-widest">Alerts & System Logs</h4>
                {notifications.length > 0 && (
                  <button onClick={clearNotifications} className="flex items-center gap-1.5 text-[9px] text-primary/30 hover:text-primary transition-colors font-black uppercase tracking-widest">
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>
              {!notifications.length ? (
                <div className="flex flex-col items-center justify-center py-16 opacity-40 gap-3">
                  <Bell className="w-14 h-14 text-primary/20" />
                  <p className="text-sm font-bold">No alerts yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map(n => (
                    <div key={n.id} onClick={() => markAsRead(n.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 items-start ${n.read ? 'bg-black/10 border-primary/5 opacity-50' : 'bg-primary/5 border-primary/15 shadow-sm hover:border-primary/25'}`}>
                      <div className={`p-2.5 rounded-xl shrink-0 ${n.type === 'price_drop' ? 'bg-emerald-500/10 text-emerald-400' : n.type === 'price_spike' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {n.type === 'price_drop' ? <TrendingDown className="w-4 h-4" /> : n.type === 'price_spike' ? <TrendingUp className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex justify-between items-start">
                          <p className="font-bold text-white text-xs uppercase tracking-tight">{n.itemName}</p>
                          <span className="text-[9px] text-primary/25 shrink-0 ml-3">{formatTimeAgo(n.timestamp)}</span>
                        </div>
                        <p className="text-primary/50 text-xs leading-relaxed">{n.message}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 bg-primary rounded-full shadow-[0_0_6px_rgba(212,175,55,0.8)] mt-1.5 shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
