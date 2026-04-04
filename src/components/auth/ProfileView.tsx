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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const ROLE_CONFIG = {
  superuser: { label: 'Master', icon: Shield, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  user: { label: 'Member', icon: User, color: 'text-sidebar-foreground/60', bg: 'bg-sidebar-accent/50', border: 'border-sidebar-border/30' },
};

const SUB_CONFIG = {
  premium: { label: 'Premium', icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  free: { label: 'Free', icon: Zap, color: 'text-sidebar-foreground/50', bg: 'bg-sidebar-accent/30', border: 'border-sidebar-border/20' },
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
    <div className="flex flex-col items-center justify-center p-20 text-center space-y-6 glass-panel rounded-3xl border border-sidebar-border/20">
      <div className="p-6 bg-sidebar-accent/30 rounded-full border border-sidebar-border/30">
        <User className="w-20 h-20 text-sidebar-foreground/30" />
      </div>
      <div>
        <h3 className="text-2xl font-black text-sidebar-foreground uppercase tracking-tight">Access Restricted</h3>
        <p className="text-sidebar-foreground/50 max-w-sm mx-auto mt-2 text-sm leading-relaxed">
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
      <div className="glass-panel p-6 rounded-3xl border border-sidebar-border/20 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
          {/* Avatar with Role Badge */}
          <div className="relative shrink-0 mx-auto lg:mx-0">
            <Avatar className="w-24 h-24 rounded-2xl border-2 border-sidebar-border/50 group-hover:border-sidebar-primary transition-all shadow-xl">
              <AvatarImage src={user.avatar || undefined} alt={user.username} className="object-cover" />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-primary text-3xl font-bold">
                {user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className={`absolute -bottom-2 -right-2 flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider shadow-lg ${roleCfg.bg} ${roleCfg.border} ${roleCfg.color}`}>
              <RoleIcon className="w-3 h-3" /> {roleCfg.label}
            </div>
          </div>

          {/* User Info */}
          <div className="flex-1 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <h2 className="text-2xl sm:text-3xl font-black text-sidebar-foreground uppercase tracking-tight">{user.username}</h2>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${subCfg.bg} ${subCfg.border} ${subCfg.color}`}>
                <SubIcon className="w-3 h-3" /> {subCfg.label}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-sidebar-foreground/50 mb-4">
              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{user.email}</span>
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Joined {new Date(user.stats.joinDate).toLocaleDateString()}</span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Saved Plans', value: user.craftingPlans?.length || 0 },
                { label: 'Watchlist', value: user.watchlist.length },
                { label: 'Points', value: user.stats.points.toLocaleString(), highlight: true },
                { label: 'Level', value: `Lv.${user.stats.contributorLevel}` },
              ].map(stat => (
                <div key={stat.label} className="bg-sidebar-accent/30 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-sidebar-foreground/40 uppercase font-bold tracking-wider">{stat.label}</p>
                  <p className={`text-lg font-black ${stat.highlight ? 'text-success' : 'text-sidebar-foreground'}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-auto shrink-0">
            <button onClick={logout}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all">
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-sidebar-accent/50 hover:bg-sidebar-accent text-sidebar-foreground border border-sidebar-border rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all">
              <Settings className="w-3.5 h-3.5" /> Settings
            </button>
          </div>
        </div>
      </div>

      {/* ── Subscription Banner (free users only) ── */}
      {!isPremium && (
        <div className="glass-panel p-4 rounded-2xl border border-yellow-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-xl">
              <Crown className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-black text-sidebar-foreground">Upgrade to Premium</p>
              <p className="text-xs text-sidebar-foreground/50">Unlimited crafting plans · Unlimited watchlist · Priority scan</p>
            </div>
          </div>
          <button
            onClick={upgradeToPremium}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/30 rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all shrink-0"
          >
            <Crown className="w-3.5 h-3.5" /> Upgrade
          </button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-1 bg-sidebar-accent/30 rounded-xl border border-sidebar-border/20 w-fit">
        {[
          { id: 'sims', label: 'Simulations', icon: History },
          { id: 'watch', label: 'Watchlist', icon: Star },
          { id: 'notifs', label: 'Notifications', icon: Bell, badge: notifications.filter(n => !n.read).length },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveSubTab(tab.id as any)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeSubTab === tab.id ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}>
              <Icon className="w-3.5 h-3.5" /> {tab.label}
              {tab.badge ? <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[8px] font-black flex items-center justify-center text-white">{tab.badge}</span> : null}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="glass-panel p-6 rounded-2xl min-h-80">
        <AnimatePresence mode="wait">

          {/* Simulations */}
          {activeSubTab === 'sims' && (
            <motion.div key="sims" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <h4 className="text-xs font-bold text-sidebar-foreground/40 uppercase tracking-wider">Saved Simulations</h4>
              {!user.savedSimulations?.length ? (
                <div className="flex flex-col items-center justify-center py-16 opacity-40 gap-3">
                  <History className="w-14 h-14 text-sidebar-foreground/20" />
                  <p className="text-sm font-bold text-sidebar-foreground/60">No simulations saved yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {user.savedSimulations.map(sim => (
                    <div key={sim.id} className="group p-4 bg-sidebar-accent/20 border border-sidebar-border/20 rounded-xl hover:border-sidebar-primary/30 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sidebar-accent/50 text-sidebar-foreground/70">
                          {sim.type}
                        </span>
                        <span className="text-[10px] text-sidebar-foreground/30">{formatTimeAgo(sim.timestamp)}</span>
                      </div>
                      <h5 className="text-sidebar-foreground font-bold text-sm mb-3 truncate group-hover:text-sidebar-primary transition-colors">{sim.name}</h5>
                      <div className="flex gap-2">
                        <button onClick={() => onSelectSimulation(sim)} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-sidebar-primary/10 hover:bg-sidebar-primary text-sidebar-primary hover:text-sidebar-primary-foreground rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all">
                          <ExternalLink className="w-3 h-3" /> Open
                        </button>
                        <button onClick={() => deleteSimulation(sim.id)} className="p-2 bg-destructive/10 hover:bg-destructive/20 text-destructive/60 hover:text-destructive rounded-lg transition-all">
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
              <h4 className="text-xs font-bold text-sidebar-foreground/40 uppercase tracking-wider">Watched Items ({user.watchlist.length})</h4>
              {!user.watchlist.length ? (
                <div className="flex flex-col items-center justify-center py-16 opacity-40 gap-3">
                  <Star className="w-14 h-14 text-sidebar-foreground/20" />
                  <p className="text-sm font-bold text-sidebar-foreground/60">Watchlist is empty.</p>
                  <p className="text-xs text-sidebar-foreground/40">Add items from Top Flips to watch them.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {user.watchlist.map(id => (
                    <div key={id} className="p-3 bg-sidebar-accent/20 border border-sidebar-border/20 rounded-lg flex items-center gap-3 group hover:border-sidebar-primary/30 transition-all">
                      <img src={`https://render.albiononline.com/v1/item/${id}.png`} alt={id} className="w-10 h-10 object-contain group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sidebar-foreground text-xs font-bold truncate uppercase">{id.replace(/_/g, ' ').split(':').pop()}</p>
                        <p className="text-sidebar-foreground/30 text-[10px] uppercase tracking-wider mt-0.5">Live Tracking</p>
                      </div>
                      <Package className="w-3.5 h-3.5 text-sidebar-foreground/20 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Notifications */}
          {activeSubTab === 'notifs' && (
            <motion.div key="notifs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-sidebar-foreground/40 uppercase tracking-wider">Alerts & System Logs</h4>
                {notifications.length > 0 && (
                  <button onClick={clearNotifications} className="flex items-center gap-1.5 text-[10px] text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors font-bold uppercase tracking-wider">
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>
              {!notifications.length ? (
                <div className="flex flex-col items-center justify-center py-16 opacity-40 gap-3">
                  <Bell className="w-14 h-14 text-sidebar-foreground/20" />
                  <p className="text-sm font-bold text-sidebar-foreground/60">No alerts yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map(n => (
                    <div key={n.id} onClick={() => markAsRead(n.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex gap-3 items-start ${n.read ? 'bg-sidebar-accent/10 border-sidebar-border/10 opacity-50' : 'bg-sidebar-accent/20 border-sidebar-border/30 hover:border-sidebar-primary/30'}`}>
                      <div className={`p-2 rounded-lg shrink-0 ${n.type === 'price_drop' ? 'bg-emerald-500/10 text-emerald-400' : n.type === 'price_spike' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {n.type === 'price_drop' ? <TrendingDown className="w-4 h-4" /> : n.type === 'price_spike' ? <TrendingUp className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="font-bold text-sidebar-foreground text-xs uppercase tracking-tight">{n.itemName}</p>
                          <span className="text-[10px] text-sidebar-foreground/30 shrink-0 ml-2">{formatTimeAgo(n.timestamp)}</span>
                        </div>
                        <p className="text-sidebar-foreground/50 text-xs leading-relaxed mt-1">{n.message}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 bg-sidebar-primary rounded-full shadow-[0_0_6px_rgba(212,175,55,0.8)] mt-1.5 shrink-0" />}
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
