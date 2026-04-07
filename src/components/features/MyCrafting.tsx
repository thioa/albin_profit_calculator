import React, { useState, useMemo } from 'react';
import { useAuth, CraftingPlan, PLAN_LIMITS } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Hammer, ChefHat, Layers, Trash2, ExternalLink, Plus, Search,
  Clock, TrendingUp, TrendingDown, Crown, Filter, StickyNote,
  FileEdit, CheckCircle2, AlertCircle
} from 'lucide-react';
import { formatSilver } from '../../lib/economy-utils';

const TYPE_CONFIG = {
  crafting: { label: 'Crafting', icon: Hammer, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
  refining: { label: 'Refining', icon: Layers, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
  cooking: { label: 'Cooking', icon: ChefHat, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
};

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface MyCraftingProps {
  onNavigateToTab?: (tab: string) => void;
}

export default function MyCrafting({ onNavigateToTab }: MyCraftingProps) {
  const { user, deleteCraftingPlan, upgradeToPremium } = useAuth();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'crafting' | 'refining' | 'cooking'>('all');
  const [showDrafts, setShowDrafts] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'profit' | 'name'>('date');
  type SortOption = 'date' | 'profit' | 'name';
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const plans = user?.craftingPlans || [];
  const isPremium = user?.subscription.tier === 'premium' || user?.role === 'superuser';
  const planLimit = user?.role === 'superuser' ? Infinity : PLAN_LIMITS[user?.subscription.tier || 'free'];
  const finalisedCount = plans.filter(p => !p.isDraft).length;

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const handleOpen = (plan: CraftingPlan) => {
    // Dispatch event to load the plan into the appropriate calculator tab
    window.dispatchEvent(new CustomEvent('albion_load_crafting_plan', { detail: plan }));
    // Navigate to the right tab
    if (onNavigateToTab) onNavigateToTab(plan.type);
    showToast(`"${plan.name}" loaded in ${TYPE_CONFIG[plan.type].label}!`, 'ok');
  };

  const handleDelete = (id: string) => {
    deleteCraftingPlan(id);
    setConfirmDelete(null);
    showToast('Plan deleted.', 'ok');
  };

  const filtered = useMemo(() => {
    return plans
      .filter(p => {
        if (!showDrafts && p.isDraft) return false;
        if (filterType !== 'all' && p.type !== filterType) return false;
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'profit') return (b.lastProfit || 0) - (a.lastProfit || 0);
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [plans, search, filterType, sortBy, showDrafts]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-6 glass-panel rounded-3xl border border-primary/10">
        <div className="p-6 bg-primary/5 rounded-full border border-primary/20">
          <Hammer className="w-20 h-20 text-primary/30" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tight">Sign In Required</h3>
          <p className="text-primary/70 max-w-sm mx-auto mt-2 text-sm">
            Login to save and manage your crafting plans â€” with all manual prices preserved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
              toast.type === 'ok' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-red-500/15 border-red-500/30 text-red-400'
            }`}>
            {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl border border-primary/10">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <div className="p-2 bg-primary/10 rounded-lg"><Hammer className="w-5 h-5 text-primary" /></div>
          <h2 className="text-xl font-black text-white uppercase italic tracking-wider">My Crafting Plans</h2>
          {user.role === 'superuser' && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-xl text-xs font-bold text-orange-400 uppercase tracking-wider">
              Master
            </span>
          )}
          {isPremium && user.role !== 'superuser' && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs font-bold text-yellow-400 uppercase tracking-wider">
              <Crown className="w-3.5 h-3.5" /> Premium
            </span>
          )}
        </div>
        <p className="text-primary/75 text-sm mb-4">
          Save your crafting setups â€” including manual prices â€” so you never have to re-enter them again.
        </p>

        {/* Quota bar (free users only) */}
        {!isPremium && (
          <div className="p-4 bg-black/30 rounded-2xl border border-primary/10 flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold text-primary/70 uppercase tracking-wider">Plan Storage</span>
                <span className="text-xs font-bold text-primary/70">{finalisedCount} / {planLimit}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${finalisedCount >= planLimit ? 'bg-destructive' : 'bg-primary'}`}
                  style={{ width: `${Math.min((finalisedCount / (planLimit as number)) * 100, 100)}%` }} />
              </div>
            </div>
            <button onClick={upgradeToPremium}
              className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 rounded-xl text-sm font-bold uppercase tracking-wider transition-all shrink-0 h-12">
              <Crown className="w-4 h-4" /> Upgrade
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/70" />
          <input type="text" placeholder="Search plans..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-12 bg-black/20 border border-primary/20 rounded-xl pl-10 pr-4 text-sm text-white placeholder:text-primary/30 focus:outline-none focus:border-primary/40 transition-all" />
        </div>

        <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-primary/10">
          {(['all', 'crafting', 'refining', 'cooking'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-label font-black uppercase tracking-widest transition-all capitalize ${filterType === t ? 'bg-primary text-black' : 'text-primary/70 hover:text-primary'}`}>
              {t}
            </button>
          ))}
        </div>

        <button onClick={() => setShowDrafts(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-label font-black uppercase tracking-widest transition-all ${showDrafts ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-black/20 border-primary/10 text-primary/30 hover:text-primary'}`}>
          <FileEdit className="w-3 h-3" /> Show Drafts
        </button>

        <div className="flex items-center gap-2 px-3 py-2 bg-black/40 border border-primary/20 rounded-xl">
          <Filter className="w-3.5 h-3.5 text-primary/30 shrink-0" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)}
            className="bg-black/30 text-xs font-bold text-primary/60 focus:outline-none cursor-pointer">
            <option value="date">Latest First</option>
            <option value="profit">By Profit</option>
            <option value="name">By Name</option>
          </select>
        </div>
      </div>

      {/* Empty state */}
      {plans.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4 glass-panel rounded-3xl border border-dashed border-primary/10">
          {/* TODO: Replace with actual My Crafting illustration - recommended size: 150x150px */}
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' rx='15' fill='%23151a21'/%3E%3Cpath d='M75 40 L95 70 L85 70 L85 110 L65 110 L65 70 L55 70 Z' fill='%23f59e0b' opacity='0.6'/%3E%3Crect x='55' y='115' width='40' height='8' rx='4' fill='%23333'/%3E%3C/svg%3E"
            alt="My Crafting illustration"
            className="w-32 h-32 opacity-60"
          />
          <div className="text-center">
            <p className="text-white font-bold">No crafting plans saved yet</p>
            <p className="text-primary/70 text-sm mt-1 max-w-xs">
              Go to Crafting, add items and set prices â€” they'll auto-save as a draft. Then click <strong className="text-primary/70">Finalize Plan</strong> to name and keep it.
            </p>
          </div>
          <div className="flex items-center gap-2 text-label text-primary/25 uppercase tracking-widest">
            <Plus className="w-3 h-3" /> Start in the Crafting tab
          </div>
        </div>
      )}

      {/* Plans Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((plan, idx) => {
              const cfg = TYPE_CONFIG[plan.type];
              const Icon = cfg.icon;
              const itemCount = plan.craftList?.length || 0;
              const profit = plan.lastProfit;
              const isDeleting = confirmDelete === plan.id;

              return (
                <motion.div key={plan.id} layout
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.04 }}
                  className={`group glass-panel rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${
                    plan.isDraft ? 'border border-primary/5 opacity-80 hover:opacity-100' : 'border border-primary/10 hover:border-primary/30'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center gap-3 p-4 border-b border-primary/5">
                    <div className={`p-2 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-white truncate group-hover:text-primary transition-colors">{plan.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className={`text-tiny font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</p>
                        {plan.isDraft && (
                          <span className="text-micro font-black uppercase tracking-widest text-primary/25 bg-white/5 px-1.5 py-0.5 rounded">Draft</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Item Icons Preview */}
                  <div className="px-4 pt-3 pb-2">
                    {itemCount > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {plan.craftList.slice(0, 4).map((item: any) => (
                          <img key={item.id} src={item.icon} alt={item.name} title={item.name}
                            className="w-8 h-8 rounded-lg border border-primary/10 bg-black/20 object-contain p-0.5" referrerPolicy="no-referrer" />
                        ))}
                        {itemCount > 4 && (
                          <div className="w-8 h-8 rounded-lg border border-primary/10 bg-black/20 flex items-center justify-center text-tiny font-black text-primary/30">+{itemCount - 4}</div>
                        )}
                      </div>
                    ) : <p className="text-label text-primary/20 italic">No items</p>}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-px bg-primary/5 mx-4 mb-3 rounded-xl overflow-hidden text-center">
                    <div className="bg-black/30 px-3 py-2">
                      <p className="text-micro text-primary/25 font-black uppercase tracking-widest">Items</p>
                      <p className="text-sm font-black text-white">{itemCount}</p>
                    </div>
                    <div className="bg-black/30 px-3 py-2">
                      <p className="text-micro text-primary/25 font-black uppercase tracking-widest">Last Profit</p>
                      {profit != null ? (
                        <p className={`text-sm font-black flex items-center justify-center gap-0.5 ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {profit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {formatSilver(Math.abs(profit)).replace(' Silver', '')}
                        </p>
                      ) : <p className="text-sm font-black text-primary/20">â€”</p>}
                    </div>
                  </div>

                  {/* Notes */}
                  {plan.notes && (
                    <div className="mx-4 mb-3">
                      <button onClick={() => setExpandedNotes(expandedNotes === plan.id ? null : plan.id)}
                        className="w-full flex items-start gap-2 p-2.5 bg-black/20 rounded-xl border border-primary/5 text-left hover:border-primary/15 transition-all">
                        <StickyNote className="w-3 h-3 text-primary/25 shrink-0 mt-0.5" />
                        <p className={`text-label text-primary/35 leading-relaxed ${expandedNotes === plan.id ? '' : 'line-clamp-1'}`}>{plan.notes}</p>
                      </button>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-4 pb-4 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-tiny text-primary/20">
                      <Clock className="w-2.5 h-2.5" />{formatTimeAgo(plan.updatedAt)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isDeleting ? (
                        <>
                          <button onClick={() => handleDelete(plan.id)} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/20 rounded-lg text-tiny font-black uppercase tracking-widest transition-all">Confirm</button>
                          <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 bg-white/5 text-primary/30 rounded-lg text-tiny font-black uppercase tracking-widest transition-all">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setConfirmDelete(plan.id)} className="p-1.5 text-primary/15 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleOpen(plan)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-black border border-primary/20 rounded-lg text-tiny font-black uppercase tracking-widest transition-all">
                            <ExternalLink className="w-3 h-3" /> Open
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {plans.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-primary/25 text-sm">No plans match your filter.</div>
      )}
    </div>
  );
}








