import React, { useState, useEffect, useMemo } from "react";
import { AlbionItem, AlbionCity, AlbionServer } from "../../types/albion";
import { fetchPrices } from "../../lib/albion-api";
import {
  calculateNetRevenue,
  getCraftingCity,
  getRrr,
  RrrConfig,
} from "../../lib/crafting-utils";
import { formatSilver } from "../../lib/economy-utils";
import SearchBar from "../common/SearchBar";
import {
  Loader2,
  Package,
  Info,
  ChevronDown,
  Plus,
  Trash2,
  RefreshCw,
  ArrowUp,
  History,
  TrendingUp,
  TrendingDown,
  MapPin,
  RotateCcw,
  BarChart2,
  Save,
  Share2,
  ExternalLink,
  Copy,
  Check as CheckIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import itemsDataRaw from "../../data/items-lite.json";
import { processItems } from "../../lib/item-utils";
import { useAuth, SavedSimulation, CraftingPlan } from "../../contexts/AuthContext";
import { serializeState, deserializeState, compressCalculatorState, decompressCalculatorState } from "../../lib/share-utils";
import { cn } from "@/lib/utils";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);

const CITIES: AlbionCity[] = ["Martlock", "Bridgewatch", "Lymhurst", "Fort Sterling", "Thetford", "Caerleon", "Brecilien"];

const CITY_COLORS: Record<string, string> = {
  "Fort Sterling": "bg-blue-500/20 text-blue-300 border-blue-500/40",
  "Lymhurst":      "bg-green-500/20 text-green-300 border-green-500/40",
  "Bridgewatch":   "bg-orange-500/20 text-orange-300 border-orange-500/40",
  "Martlock":      "bg-primary/20 text-primary border-primary/40",
  "Thetford":      "bg-primary/20 text-primary border-primary/40",
  "Caerleon":      "bg-red-500/20 text-red-300 border-red-500/40",
  "Brecilien":     "bg-teal-500/20 text-teal-300 border-teal-500/40",
};

interface CraftItem {
  id: string;
  name: string;
  count: number;
  icon: string;
  subCategory: string;
  /** Station fee in silver per single craft (user editable) */
  stationFeeSilver: number;
}

interface ShoppingItem {
  id: string;
  name: string;
  requiredRaw: number;
  returned: number;
  requiredNet: number;
  have: number;
  icon: string;
  isCraftable: boolean;
  sourceCity: AlbionCity;
}

interface BaseCalculatorProps {
  server: AlbionServer;
  title: string;
  icon: React.ReactNode;
  storageKey: string;
  filterPredicate: (item: AlbionItem) => boolean;
  outputMultiplier?: (item: AlbionItem) => number;
  injectedItem?: { item: AlbionItem; targetTab: string; timestamp: number } | null;
  onItemInjected?: () => void;
}

export default function BaseCalculator({ server, title, icon, storageKey, filterPredicate, outputMultiplier, injectedItem, onItemInjected }: BaseCalculatorProps) {
  const [craftList, setCraftList]         = useState<CraftItem[]>([]);
  const [haveList, setHaveList]           = useState<Record<string, number>>({});
  const [manualPrices, setManualPrices]   = useState<Record<string, Record<string, number>>>({});
  const [sellPrices, setSellPrices]       = useState<Record<string, number>>({});
  const [sourceCities, setSourceCities]   = useState<Record<string, AlbionCity>>({});
  const [overriddenCities, setOverriddenCities] = useState<Set<string>>(new Set());
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  
  // globalCity: auto-follows the best city of the last added item, unless user manually changes it
  const [globalCity, setGlobalCity]       = useState<AlbionCity>("Caerleon");
  const [cityManuallySet, setCityManuallySet] = useState(false);

  const [rrrConfig, setRrrConfig] = useState<RrrConfig>({ stationBonus: 10, cityBonus: true, focus: false });
  const rrr = useMemo(() => getRrr(rrrConfig), [rrrConfig]);
  interface RecentEntry { item: AlbionItem; prices: Record<string, Record<string, number>>; sellPrices: Record<string, number>; }
  const [recentItems, setRecentItems] = useState<RecentEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(`albion-recent-${storageKey}`) || '[]'); } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(`albion-recent-${storageKey}`, JSON.stringify(recentItems)); } catch {}
  }, [recentItems, storageKey]);

  // Propagate globalCity changes to non-overridden ingredient source cities
  useEffect(() => {
    setSourceCities(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!overriddenCities.has(id)) next[id] = globalCity;
      }
      return next;
    });
  }, [globalCity, overriddenCities]);

  const { user, saveSimulation, saveCraftingPlan, updateCraftingPlan } = useAuth();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeName, setFinalizeName] = useState('');
  const [finalizeNote, setFinalizeNote] = useState('');
  const [autoSaveDraftId, setAutoSaveDraftId] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [recentDropdownOpen, setRecentDropdownOpen] = useState(false);
  const [recentActiveIndex, setRecentActiveIndex] = useState(-1);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<string | null>(null);
  const [autoSaveToast, setAutoSaveToast] = useState(false);
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentDropdownRef = React.useRef<HTMLDivElement>(null);
  const recentItemsRef = React.useRef<(HTMLButtonElement | null)[]>([]);
  // Items excluded from RRR cashback (e.g. Treeheart, Tame Wild Boar)
  const [noRrrItems, setNoRrrItems] = useState<Set<string>>(new Set());
  // Track if user has made actual input changes (for auto-save)
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  const lastInjectedRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (injectedItem && injectedItem.targetTab === storageKey) {
      if (lastInjectedRef.current !== injectedItem.timestamp) {
        lastInjectedRef.current = injectedItem.timestamp;
        addCraftItem(injectedItem.item);
        if (onItemInjected) onItemInjected();
      }
    }
  }, [injectedItem, storageKey]);

  // Close recent dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (recentDropdownRef.current && !recentDropdownRef.current.contains(event.target as Node)) {
        setRecentDropdownOpen(false);
        setRecentActiveIndex(-1);
      }
    };
    if (recentDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [recentDropdownOpen]);

  // ── Load plan/simulation from events ─────────────────────────────────────
  useEffect(() => {
    const handleLoadSim = (e: any) => {
      const sim = e.detail as SavedSimulation;
      if (sim.type === storageKey) {
        const data = sim.data;
        if (data.craftList) setCraftList(data.craftList);
        if (data.haveList) setHaveList(data.haveList);
        if (data.manualPrices) setManualPrices(data.manualPrices);
        if (data.sellPrices) setSellPrices(data.sellPrices);
        if (data.sourceCities) setSourceCities(data.sourceCities);
        if (data.globalCity) setGlobalCity(data.globalCity);
        if (data.rrrConfig) setRrrConfig(data.rrrConfig);
      }
    };

    // Load CraftingPlan (new system)
    const handleLoadPlan = (e: any) => {
      const plan = e.detail as CraftingPlan;
      if (plan.type !== storageKey) return;
      if (plan.craftList) setCraftList(plan.craftList);
      if (plan.haveList) setHaveList(plan.haveList);
      if (plan.manualPrices) setManualPrices(plan.manualPrices);
      if (plan.sellPrices) setSellPrices(plan.sellPrices);
      if (plan.sourceCities) setSourceCities(plan.sourceCities as Record<string, AlbionCity>);
      if (plan.globalCity) setGlobalCity(plan.globalCity as AlbionCity);
      if (plan.rrrConfig) setRrrConfig(plan.rrrConfig);
      if (plan.noRrrItems) setNoRrrItems(new Set(plan.noRrrItems));
      // Track the loaded plan as our auto-save target
      if (plan.id) setAutoSaveDraftId(plan.id);
    };

    // URL hash state
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.startsWith('state=')) {
      const decoded = decompressCalculatorState(deserializeState(hash.replace('state=', '')));
      if (decoded) {
        if (decoded.craftList) setCraftList(decoded.craftList);
        if (decoded.haveList) setHaveList(decoded.haveList);
        if (decoded.manualPrices) setManualPrices(decoded.manualPrices);
        if (decoded.sellPrices) setSellPrices(decoded.sellPrices);
        if (decoded.sourceCities) setSourceCities(decoded.sourceCities);
        if (decoded.globalCity) setGlobalCity(decoded.globalCity);
        if (decoded.rrrConfig) setRrrConfig(decoded.rrrConfig);
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    window.addEventListener('albion_load_simulation', handleLoadSim);
    window.addEventListener('albion_load_crafting_plan', handleLoadPlan);
    return () => {
      window.removeEventListener('albion_load_simulation', handleLoadSim);
      window.removeEventListener('albion_load_crafting_plan', handleLoadPlan);
    };
  }, [storageKey]);

  // Keyboard navigation for Recent Items dropdown
  const handleRecentKeyDown = (e: React.KeyboardEvent) => {
    if (!recentDropdownOpen || recentItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setRecentActiveIndex(prev => (prev < recentItems.length - 1 ? prev + 1 : prev));
      recentItemsRef.current[recentActiveIndex + 1]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setRecentActiveIndex(prev => (prev > 0 ? prev - 1 : -1));
      recentItemsRef.current[recentActiveIndex - 1]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && recentActiveIndex >= 0) {
      e.preventDefault();
      const { item, prices: snap, sellPrices: snapSell } = recentItems[recentActiveIndex];
      addCraftItem(item);
      setManualPrices(prev => {
        const merged = { ...snap };
        for (const id of Object.keys(prev)) { merged[id] = { ...merged[id], ...prev[id] }; }
        return merged;
      });
      setSellPrices(prev => ({ ...snapSell, ...prev }));
      setRecentDropdownOpen(false);
      setRecentActiveIndex(-1);
    } else if (e.key === 'Escape') {
      setRecentDropdownOpen(false);
      setRecentActiveIndex(-1);
    }
  };

  // ── Auto-Save (debounced 2s, only on user interaction) ─────────────────────
  const getCurrentPlanState = () => ({
    craftList, haveList, manualPrices, sellPrices,
    sourceCities: sourceCities as Record<string, string>,
    globalCity, rrrConfig,
    noRrrItems: Array.from(noRrrItems),
  });

  useEffect(() => {
    if (!user || craftList.length === 0 || !hasUserInteracted) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaveStatus('idle');

    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveStatus('saving');
      const planState = getCurrentPlanState();

      if (autoSaveDraftId) {
        updateCraftingPlan(autoSaveDraftId, { ...planState, isDraft: true });
      } else {
        const result = saveCraftingPlan({
          name: `${title} Draft`,
          type: storageKey as 'crafting' | 'refining' | 'cooking',
          isDraft: true,
          notes: '',
          ...planState,
        });
        if (result.ok && result.planId) setAutoSaveDraftId(result.planId);
      }

      setHasUserInteracted(false); // Reset after save
      setAutoSaveToast(true);
      setTimeout(() => setAutoSaveStatus('saved'), 300);
      setTimeout(() => { setAutoSaveStatus('idle'); setAutoSaveToast(false); }, 2500);
    }, 2000);

    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [craftList, manualPrices, sellPrices, sourceCities, globalCity, rrrConfig, haveList, noRrrItems, user, hasUserInteracted]);

  // ── Finalize Plan (give it a proper name) ─────────────────────────────────
  const handleFinalize = () => {
    if (!user) { alert('Please login to save crafting plans.'); return; }
    setFinalizeName(`My ${title} — ${new Date().toLocaleDateString()}`);
    setFinalizeNote('');
    setShowFinalizeModal(true);
  };

  const confirmFinalize = () => {
    if (!finalizeName.trim()) return;
    const planState = getCurrentPlanState();
    if (autoSaveDraftId) {
      updateCraftingPlan(autoSaveDraftId, { name: finalizeName, notes: finalizeNote, isDraft: false, ...planState });
    } else {
      const result = saveCraftingPlan({
        name: finalizeName,
        type: storageKey as 'crafting' | 'refining' | 'cooking',
        isDraft: false,
        notes: finalizeNote,
        ...planState,
      });
      if (result.ok && result.planId) setAutoSaveDraftId(result.planId);
    }
    setShowFinalizeModal(false);
  };

  // Legacy simulation save
  const handleSave = () => {
    if (!user) { alert('Please login to save simulations.'); return; }
    const name = prompt('Enter a name:', `My ${title} ${new Date().toLocaleDateString()}`);
    if (name) saveSimulation({ name, type: storageKey as 'crafting' | 'refining' | 'cooking', data: { craftList, haveList, manualPrices, sellPrices, sourceCities, globalCity, rrrConfig } });
  };

  // Shopping list — Bring / Returned / Net
  const shoppingList = useMemo<ShoppingItem[]>(() => {
    const map: Record<string, ShoppingItem> = {};
    craftList.forEach(item => {
      const ai = itemsData.find(it => it.id === item.id);
      if (!ai?.craftingRecipe?.length) return;
      ai.craftingRecipe?.forEach(req => {
        const ri       = itemsData.find(it => it.id === req.id);
        const full     = req.count * item.count;
        const getsRrr  = !noRrrItems.has(req.id);  // user can uncheck to exclude
        const returned = getsRrr ? full * (rrr / 100) : 0;
        const net      = full - returned;
        const city     = sourceCities[req.id] || globalCity;
        if (map[req.id]) {
          map[req.id].requiredRaw += full;
          map[req.id].returned    += returned;
          map[req.id].requiredNet += net;
        } else {
          map[req.id] = {
            id: req.id, name: ri?.name || req.id,
            requiredRaw: full, returned, requiredNet: net,
            have: haveList[req.id] || 0,
            icon: ri?.icon || `https://render.albiononline.com/v1/item/${req.id}.png`,
            isCraftable: !!ri?.craftingRecipe?.length,
            sourceCity: city,
          };
        }
      });
    });
    return Object.values(map);
  }, [craftList, haveList, rrr, sourceCities, globalCity, noRrrItems]);

  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  // Auto-fetch live prices for all items in shopping list
  useEffect(() => {
    if (shoppingList.length === 0) return;
    
    let isMounted = true;
    const fetchAll = async () => {
      const ids = shoppingList.map(i => i.id);
      // We check all cities we're currently using plus global city
      const cities = Array.from(new Set([...Object.values(sourceCities), globalCity]));
      
      try {
        const data = await fetchPrices(ids, cities, [1], server);
        if (!isMounted) return;
        
        const priceMap: Record<string, number> = {};
        data.forEach(p => {
          const key = `${p.item_id}_${p.city}`;
          priceMap[key] = p.sell_price_min;
        });
        setLivePrices(priceMap);
      } catch (e) {
        console.error("Live price fetch failed", e);
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 60000); // Update every minute
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [shoppingList.length, server, globalCity, sourceCities]);

  const toggleRrr = (id: string) => {
    setHasUserInteracted(true);
    setNoRrrItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const removeCraftItem = (id: string) => { setHasUserInteracted(true); setCraftList(prev => prev.filter(i => i.id !== id)); setConfirmDeleteItem(null); };
  const updateCraftItem = (id: string, u: Partial<CraftItem>) => {
    setHasUserInteracted(true);
    setCraftList(prev => prev.map(i => i.id === id ? { ...i, ...u } : i));
  };

  const addCraftItem = (item: AlbionItem) => {
    let added = true;
    setCraftList(prev => {
      if (prev.some(i => i.id === item.id)) {
        added = false;
        return prev;
      }
      return [...prev, {
        id: item.id,
        name: item.name,
        count: 1,
        icon: item.icon,
        subCategory: item.subCategory || "",
        stationFeeSilver: 300,
      }];
    });

    if (!added) return;

    // Auto-set globalCity to item's best crafting city (unless user locked it)
    const bestCity = getCraftingCity(item.subCategory || "");
    if (bestCity && !cityManuallySet) {
      setGlobalCity(bestCity);
    }

    // Initialise ingredient source cities
    const albionItem = itemsData.find(it => it.id === item.id);
    if (albionItem?.craftingRecipe) {
      const targetCity = (bestCity && !cityManuallySet) ? bestCity : globalCity;
      setSourceCities(prev => {
        const next = { ...prev };
        for (const req of albionItem.craftingRecipe) {
          if (!next[req.id]) next[req.id] = targetCity;
        }
        return next;
      });
    }

    // Snapshot current prices for easy recall
    setRecentItems(prev => [
      { item, prices: manualPrices, sellPrices },
      ...prev.filter(e => e.item.id !== item.id)
    ].slice(0, 10));
  };

  // Pull market prices (crafted items + ingredients across all cities)
  const pullPrices = async () => {
    const allIds = [...new Set([...craftList.map(i => i.id), ...shoppingList.map(i => i.id)])];
    if (!allIds.length) return;
    setLoading(true); setError(null);
    try {
      const prices = await fetchPrices(allIds, CITIES, [1], server);
      const newPrices = { ...manualPrices };
      const newSell   = { ...sellPrices };
      const craftIds  = new Set(craftList.map(i => i.id));
      prices.forEach(p => {
        if (p.sell_price_min > 0) {
          if (!newPrices[p.item_id]) newPrices[p.item_id] = {};
          newPrices[p.item_id][p.city as AlbionCity] = p.sell_price_min;
          // Best sell city for crafted item = highest price
          if (craftIds.has(p.item_id)) {
            if (!newSell[p.item_id] || p.sell_price_min > newSell[p.item_id]) {
              newSell[p.item_id] = p.sell_price_min;
            }
          }
        }
      });
      setManualPrices(newPrices);
      setSellPrices(newSell);
    } catch {
      setError("Failed to fetch market prices.");
    } finally {
      setLoading(false);
    }
  };

  // Per-item calculations
  const itemCalcs = useMemo(() => craftList.map(craftItem => {
    const ai = itemsData.find(it => it.id === craftItem.id);
    const recipe = ai?.craftingRecipe || [];
    const stationFee   = craftItem.stationFeeSilver * craftItem.count;
    const materialCost = recipe.reduce((acc, req) => {
      const city      = sourceCities[req.id] || globalCity;
      const price     = manualPrices[req.id]?.[city] || 0;
      const getsRrr   = !noRrrItems.has(req.id);
      const effectRrr = getsRrr ? rrr : 0;
      const net       = req.count * craftItem.count * (1 - effectRrr / 100);
      return acc + price * net;
    }, 0);
    const multiplier = outputMultiplier ? outputMultiplier(ai as AlbionItem) : 1;
    const sellPrice  = (sellPrices[craftItem.id] || 0) * craftItem.count * multiplier;
    const netRevenue = calculateNetRevenue(sellPrice);
    const profit     = netRevenue - materialCost - stationFee;
    const bestCity   = getCraftingCity(craftItem.subCategory);
    return { stationFee, materialCost, sellPrice, netRevenue, profit, bestCity };
  }), [craftList, manualPrices, sellPrices, sourceCities, globalCity, rrr, noRrrItems]);

  const totalFees     = useMemo(() => itemCalcs.reduce((a, c) => a + c.stationFee, 0), [itemCalcs]);
  const totalMat      = useMemo(() => shoppingList.reduce((acc, item) => {
    const net = Math.max(0, item.requiredNet - item.have);
    return acc + net * (manualPrices[item.id]?.[item.sourceCity] || 0);
  }, 0), [shoppingList, manualPrices]);
  const totalSell     = useMemo(() => itemCalcs.reduce((a, c) => a + c.sellPrice, 0), [itemCalcs]);
  const totalProfit   = useMemo(() => itemCalcs.reduce((a, c) => a + c.profit, 0), [itemCalcs]);

  // Whether any city prices available for the sell comparison table
  const hasCityPrices = craftList.some(i => manualPrices[i.id] && Object.keys(manualPrices[i.id]).length > 0);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">

      {/* Auto-save toast notification */}
      <AnimatePresence>
        {autoSaveToast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border bg-emerald-500/15 border-emerald-500/30 text-sm font-bold text-emerald-400"
          >
            <CheckIcon className="w-4 h-4" />
            Draft saved automatically
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Page Header ─── */}
      <div className="glass-panel p-5 rounded-3xl border border-primary/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            {icon}
          </div>
          <h1 className="text-xl font-black text-white uppercase italic tracking-wider">{title}</h1>
        </div>
        <p className="text-primary/70 text-sm">
          {storageKey === 'crafting' ? 'Calculate crafting profitability by accounting for ingredient costs, resource return rates (RRR), and city bonuses.' : 
           storageKey === 'refining' ? 'Optimize your refining process. Compare raw material costs against refined outputs with localized city bonuses.' : 
           'Plan your cooking sessions. Track ingredient requirements and calculate net profit after taxes and fees for consumables.'}
        </p>
      </div>

      {/* ─── Control Bar ─── */}
      <div className="flex flex-col gap-4 glass-panel p-5 rounded-3xl border border-primary/10 relative z-30">
        {/* Row 1: Search + Recent */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <SearchBar onSelect={addCraftItem} craftableOnly filterPredicate={filterPredicate} />
          </div>

          {/* Recent Items dropdown */}
          <div className="relative group shrink-0" ref={recentDropdownRef}>
            <button
              className="flex items-center gap-2 px-4 h-11 bg-black/40 border border-primary/20 rounded-xl text-white hover:bg-black/60 hover:border-primary/40 transition-all text-sm font-bold whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary/50"
              onClick={() => { setRecentDropdownOpen(v => !v); setRecentActiveIndex(-1); }}
              onKeyDown={handleRecentKeyDown}
              aria-expanded={recentDropdownOpen}
              aria-haspopup="listbox"
              aria-label="Recent items"
            >
              <History className="w-4 h-4 text-primary" />
              Recent
              <ChevronDown className={`w-3.5 h-3.5 text-primary/40 transition-transform ${recentDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {recentDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  role="listbox"
                  aria-label="Recent items list"
                  className="absolute top-full right-0 mt-2 w-64 glass-panel rounded-xl shadow-2xl z-50 p-2"
                >
                  {recentItems.length === 0 ? (
                    <div className="p-3 text-sm text-primary/40 italic text-center">No recent items yet</div>
                  ) : recentItems.map(({ item, prices: snap, sellPrices: snapSell }, idx) => (
                    <button key={item.id}
                      id={`recent-item-${idx}`}
                      ref={el => { recentItemsRef.current[idx] = el; }}
                      role="option"
                      aria-selected={recentActiveIndex === idx}
                      onClick={() => {
                        addCraftItem(item);
                        setManualPrices(prev => {
                          const merged = { ...snap };
                          for (const id of Object.keys(prev)) { merged[id] = { ...merged[id], ...prev[id] }; }
                          return merged;
                        });
                        setSellPrices(prev => ({ ...snapSell, ...prev }));
                        setRecentDropdownOpen(false);
                        setRecentActiveIndex(-1);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left min-h-12 transition-colors ${
                        recentActiveIndex === idx ? 'bg-primary/15' : 'hover:bg-white/5'
                      }`}
                    >
                      <img src={item.icon} className="w-8 h-8" alt="" />
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate font-medium">{item.name}</div>
                        {snapSell[item.id] > 0 && (
                          <div className="text-xs text-primary/40">Last sell: {snapSell[item.id].toLocaleString()}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Row 2: Options | divider | Actions */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Default City */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Default City</label>
            <div className="relative">
              <select value={globalCity}
                onChange={e => { setGlobalCity(e.target.value as AlbionCity); setCityManuallySet(true); }}
                className="h-11 bg-black/40 border border-primary/20 rounded-xl px-4 pr-8 text-primary text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background appearance-none cursor-pointer min-w-36">
                {CITIES.map(c => <option key={c} value={c} className="bg-[#0a0e14] text-white">{c}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 w-4 h-4 pointer-events-none" />
            </div>
          </div>

          {/* Station Bonus */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Station Bonus</label>
            <div className="relative">
              <select value={rrrConfig.stationBonus}
                onChange={e => setRrrConfig(p => ({ ...p, stationBonus: Number(e.target.value) as 10 | 20 }))}
                className="h-11 bg-black/40 border border-primary/20 rounded-xl px-4 pr-8 text-primary text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background appearance-none cursor-pointer min-w-40">
                <option value={10} className="bg-[#0a0e14] text-white">Normal (10%)</option>
                <option value={20} className="bg-[#0a0e14] text-white">Event / Premium (20%)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 w-4 h-4 pointer-events-none" />
            </div>
          </div>

          {/* City Bonus */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">City Bonus</label>
            <button
              onClick={() => setRrrConfig(p => ({ ...p, cityBonus: !p.cityBonus }))}
              aria-pressed={rrrConfig.cityBonus}
              aria-label={`City Bonus: ${rrrConfig.cityBonus ? 'On' : 'Off'}`}
              className={`h-11 px-5 rounded-xl font-bold text-sm transition-all ${
                rrrConfig.cityBonus
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-black/30 text-primary/50 border border-primary/15"
              }`}
            >
              {rrrConfig.cityBonus ? "On" : "Off"}
            </button>
          </div>

          {/* Focus */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Focus</label>
            <button
              onClick={() => setRrrConfig(p => ({ ...p, focus: !p.focus }))}
              aria-pressed={rrrConfig.focus}
              aria-label={`Focus: ${rrrConfig.focus ? 'On' : 'Off'}`}
              className={`h-11 px-5 rounded-xl font-bold text-sm transition-all ${
                rrrConfig.focus
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-black/30 text-primary/50 border border-primary/15"
              }`}
            >
              {rrrConfig.focus ? "On" : "Off"}
            </button>
          </div>

          {/* Divider */}
          <div className="h-11 w-px bg-primary/10 self-stretch mb-0.5" />

          {/* RRR Badge */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">RRR</label>
            <div className="flex items-center gap-2 h-11 bg-primary/10 border border-primary/30 rounded-xl px-4">
              <RotateCcw className="w-4 h-4 text-primary" />
              <span className="text-primary font-black text-base">{rrr.toFixed(1)}%</span>
            </div>
          </div>

          {/* Pull Market */}
          <div className="flex flex-col gap-1.5 ml-auto">
            <label className="text-[10px] font-black text-transparent select-none">Actions</label>
            <button onClick={pullPrices} disabled={loading}
              className="flex items-center gap-2 px-4 h-11 bg-primary/15 hover:bg-primary/25 border border-primary/40 rounded-xl text-primary font-bold uppercase tracking-wider transition-all disabled:opacity-40 shrink-0 text-xs">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Pull Market
            </button>
          </div>

          {/* Auto-save + Finalize */}
          {user && craftList.length > 0 ? (
            <div className="flex items-end gap-2">
              {/* Auto-save status - icon with tooltip */}
              <div className="h-11 px-2 flex items-center justify-center transition-all" title={
                autoSaveStatus === 'saving' ? 'Saving...' :
                autoSaveStatus === 'saved'  ? 'Saved' : 'Auto-save on'
              }>
                <span className={cn(
                  autoSaveStatus === 'saving' ? 'text-primary/50' :
                  autoSaveStatus === 'saved'  ? 'text-success' : 'text-primary/30'
                )}>
                  {autoSaveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   autoSaveStatus === 'saved'  ? <CheckIcon className="w-4 h-4" /> :
                   <Save className="w-4 h-4" />}
                </span>
              </div>
              {/* Finalize Plan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-transparent select-none">Finalize</label>
                <button onClick={handleFinalize}
                  className="flex items-center gap-2 px-4 h-11 bg-success/10 hover:bg-success/20 text-success border border-success/25 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shrink-0">
                  <Save className="w-4 h-4" /> Finalize Plan
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-transparent select-none">Finalize</label>
              <button onClick={handleFinalize} disabled={craftList.length === 0}
                className="flex items-center gap-2 px-4 h-11 bg-success/10 hover:bg-success/20 text-success border border-success/25 rounded-xl font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-30 shrink-0">
                <Save className="w-4 h-4" /> Finalize Plan
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">{error}</div>
      )}

      {/* ─── Items to Craft ─── Horizontal Table Layout ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-1">
          {icon}
          <h2 className="text-lg font-black text-white uppercase tracking-wider italic">{title}</h2>
        </div>
        <div className="glass-panel rounded-3xl overflow-hidden overflow-x-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-black/20 border-b border-primary/10">
                <th className="p-4 w-10" scope="col" />
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider" scope="col">Item</th>
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider hidden sm:table-cell" scope="col">Best City</th>
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider hidden md:table-cell" scope="col">Recipe</th>
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center w-20" scope="col">Qty</th>
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center w-36" scope="col">
                  Fee / craft
                  <div className="text-xs text-primary/40 font-normal normal-case tracking-normal">(silver, editable)</div>
                </th>
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center w-32" scope="col">Sell Price</th>
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-right w-32" scope="col">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <AnimatePresence mode="popLayout">
                {craftList.map((item, idx) => {
                  const ai     = itemsData.find(it => it.id === item.id);
                  const recipe = ai?.craftingRecipe || [];
                  const calc   = itemCalcs[idx];

                  return (
                    <motion.tr key={item.id} layout
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      className="hover:bg-white/5 transition-colors motion-reduce:transition-none motion-reduce:animate-none">
                      <td className="p-3">
                        {confirmDeleteItem === item.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => removeCraftItem(item.id)} className="px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all" aria-label="Confirm delete">
                              Confirm
                            </button>
                            <button onClick={() => setConfirmDeleteItem(null)} className="px-2 py-1 bg-white/5 text-primary/30 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all" aria-label="Cancel delete">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteItem(item.id)} className="p-2 text-gray-600 hover:text-red-500 transition-colors" aria-label={`Remove ${item.name} from crafting list`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <img src={item.icon} alt={`${item.name} crafting item`} className="w-11 h-11 object-contain shrink-0" referrerPolicy="no-referrer" loading="lazy" />
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate">{item.name}</div>
                            <div className="text-xs text-primary/40 font-mono tracking-tight truncate">{item.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        {calc.bestCity ? (
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${CITY_COLORS[calc.bestCity] ?? "bg-gray-800 text-on-surface border-primary/20"}`}>
                            <MapPin className="w-3 h-3" />{calc.bestCity}
                            <span className="text-[9px] opacity-70">+15%</span>
                          </div>
                        ) : <span className="text-xs text-primary/40 italic">Any City</span>}
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-2">
                          {(!recipe || recipe.length === 0)
                            ? <span className="text-xs text-primary/40 italic">No recipe</span>
                            : recipe.map(req => {
                              const ri = itemsData.find(it => it.id === req.id);
                              return (
                                <div key={req.id} className="flex items-center gap-1.5 bg-black/30 border border-primary/10 rounded-lg p-1.5 pr-2.5" title={ri?.name || req.id}>
                                  <img src={ri?.icon || `https://render.albiononline.com/v1/item/${req.id}.png`} className="w-6 h-6" alt={`${ri?.name || req.id} ingredient`} referrerPolicy="no-referrer" loading="lazy" />
                                  <span className="text-xs font-bold text-primary/60">{req.count * item.count}x</span>
                                </div>
                              );
                            })}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center">
                          <input type="number" value={item.count}
                            onChange={e => updateCraftItem(item.id, { count: Math.max(1, Number(e.target.value)) })}
                            className="w-16 min-w-11 bg-black/40 border border-primary/20 rounded-xl py-2.5 px-2 text-center text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background touch-target"
                            aria-label={`Quantity for ${item.name}`}
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col items-center gap-0.5">
                          <input type="number" value={item.stationFeeSilver || ""}
                            placeholder="0"
                            onChange={e => updateCraftItem(item.id, { stationFeeSilver: Math.max(0, Number(e.target.value)) })}
                            className="w-28 bg-black/40 border border-primary/20 rounded-xl py-2 px-3 text-center text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background" />
                          {item.count > 1 && item.stationFeeSilver > 0 && (
                            <span className="text-xs text-primary/40">
                              Total: {formatSilver(item.stationFeeSilver * item.count)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center">
                          <input type="number" value={sellPrices[item.id] || ""}
                            placeholder="Set price"
                            onChange={e => { setHasUserInteracted(true); setSellPrices(prev => ({ ...prev, [item.id]: Number(e.target.value) })); }}
                            className={`w-32 min-w-12 bg-black/40 border rounded-xl py-2.5 px-3 text-center text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background touch-target ${
                              !sellPrices[item.id] ? "border-yellow-500/30 text-yellow-400 placeholder:text-yellow-700/50" : "border-primary/30 text-primary"
                            }`}
                            aria-label={`Sell price for ${item.name}`}
                          />
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        {sellPrices[item.id] ? (
                          <div className={`flex items-center justify-end gap-1 font-black text-sm ${calc.profit > 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {calc.profit > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {formatSilver(Math.abs(calc.profit))}
                          </div>
                        ) : <span className="text-[10px] text-gray-600 italic">—</span>}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {craftList.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <img
                        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='12' fill='%23151a21'/%3E%3Ccircle cx='60' cy='50' r='25' fill='none' stroke='%23f59e0b' stroke-width='3' opacity='0.4'/%3E%3Cpath d='M60 35 L60 65 M45 50 L75 50' stroke='%23f59e0b' stroke-width='3' stroke-linecap='round' opacity='0.6'/%3E%3Crect x='35' y='80' width='50' height='8' rx='4' fill='%23333' opacity='0.3'/%3E%3C/svg%3E"
                        alt="Search illustration"
                        className="w-20 h-20 opacity-60"
                      />
                      <div>
                        <p className="text-primary/60 font-medium text-sm">No items to craft yet</p>
                        <p className="text-primary/30 text-xs mt-1">Search for a craftable item above to get started</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Mobile Card Layout for Small Screens ─── */}
      <div className="block md:hidden space-y-4">
        <AnimatePresence mode="popLayout">
          {craftList.map((item, idx) => {
            const ai = itemsData.find(it => it.id === item.id);
            const recipe = ai?.craftingRecipe || [];
            const calc = itemCalcs[idx];

            return (
              <motion.div key={item.id} layout
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="glass-panel p-4 rounded-2xl border border-primary/10">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <img src={item.icon} alt={`${item.name} crafting item`} className="w-12 h-12 object-contain shrink-0" referrerPolicy="no-referrer" loading="lazy" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate">{item.name}</div>
                      <div className="text-xs text-primary/40 font-mono tracking-tight truncate">{item.id}</div>
                    </div>
                  </div>
                  {confirmDeleteItem === item.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => removeCraftItem(item.id)} className="px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Confirm</button>
                      <button onClick={() => setConfirmDeleteItem(null)} className="px-2 py-1 bg-white/5 text-primary/30 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteItem(item.id)} className="p-2 text-gray-600 hover:text-red-500 transition-colors shrink-0" aria-label={`Remove ${item.name} from crafting list`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-xs text-primary/60 uppercase tracking-wider mb-1">Quantity</div>
                    <input type="number" value={item.count}
                      onChange={e => updateCraftItem(item.id, { count: Math.max(1, Number(e.target.value)) })}
                      className="w-full bg-black/40 border border-primary/20 rounded-xl py-2 px-3 text-center text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background" />
                  </div>
                  <div>
                    <div className="text-xs text-primary/60 uppercase tracking-wider mb-1">Station Fee</div>
                    <input type="number" value={item.stationFeeSilver || ""}
                      placeholder="0"
                      onChange={e => updateCraftItem(item.id, { stationFeeSilver: Math.max(0, Number(e.target.value)) })}
                      className="w-full bg-black/40 border border-primary/20 rounded-xl py-2 px-3 text-center text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background" />
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-xs text-primary/60 uppercase tracking-wider mb-1">Sell Price</div>
                  <input type="number" value={sellPrices[item.id] || ""}
                    placeholder="Set price"
                    onChange={e => { setHasUserInteracted(true); setSellPrices(prev => ({ ...prev, [item.id]: Number(e.target.value) })); }}
                    className={`w-full bg-black/40 border rounded-xl py-2 px-3 text-center text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
                      !sellPrices[item.id] ? "border-yellow-500/30 text-yellow-400 placeholder:text-yellow-700/50" : "border-primary/30 text-primary"
                    }`} />
                </div>

                {calc.bestCity && (
                  <div className="mb-3">
                    <div className="text-xs text-primary/60 uppercase tracking-wider mb-1">Best City</div>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${CITY_COLORS[calc.bestCity] ?? "bg-gray-800 text-on-surface border-primary/20"}`}>
                      <MapPin className="w-3 h-3" />{calc.bestCity}
                      <span className="text-[9px] opacity-70">+15%</span>
                    </div>
                  </div>
                )}

                {recipe.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-primary/60 uppercase tracking-wider mb-2">Recipe</div>
                    <div className="flex flex-wrap gap-2">
                      {recipe.map(req => {
                        const ri = itemsData.find(it => it.id === req.id);
                        return (
                          <div key={req.id} className="flex items-center gap-1.5 bg-black/30 border border-primary/10 rounded-lg p-1.5 pr-2.5" title={ri?.name || req.id}>
                            <img src={ri?.icon || `https://render.albiononline.com/v1/item/${req.id}.png`} className="w-6 h-6" alt={`${ri?.name || req.id} ingredient`} referrerPolicy="no-referrer" loading="lazy" />
                            <span className="text-xs font-bold text-primary/60">{req.count * item.count}x</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-primary/10">
                  <div className="text-xs text-primary/60 uppercase tracking-wider">Profit</div>
                  {sellPrices[item.id] ? (
                    <div className={`flex items-center gap-1 font-black text-sm ${calc.profit > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {calc.profit > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {formatSilver(Math.abs(calc.profit))}
                    </div>
                  ) : <span className="text-xs text-gray-600 italic">Set price</span>}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {craftList.length === 0 && (
          <div className="glass-panel p-8 rounded-2xl border border-primary/10 text-center">
            <div className="flex flex-col items-center gap-3">
              <img
                src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='12' fill='%23151a21'/%3E%3Ccircle cx='60' cy='50' r='25' fill='none' stroke='%23f59e0b' stroke-width='3' opacity='0.4'/%3E%3Cpath d='M60 35 L60 65 M45 50 L75 50' stroke='%23f59e0b' stroke-width='3' stroke-linecap='round' opacity='0.6'/%3E%3Crect x='35' y='80' width='50' height='8' rx='4' fill='%23333' opacity='0.3'/%3E%3C/svg%3E"
                alt="Search illustration"
                className="w-16 h-16 opacity-60"
              />
              <p className="text-primary/50 text-sm">No items to craft yet</p>
              <p className="text-primary/30 text-xs">Search for a craftable item above</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── City Price Comparison (Best Market) ─── */}
      {hasCityPrices && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-1">
            <BarChart2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-black text-white uppercase tracking-wider italic">Best Market to Sell</h2>
            <span className="text-xs text-primary/50 italic ml-1">— highest price is highlighted</span>
          </div>
          <div className="glass-panel rounded-3xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/20 border-b border-primary/10">
                  <th className="p-3 text-[10px] font-black text-primary/60 uppercase tracking-widest" scope="col">Item</th>
                  {CITIES.map(city => (
                    <th key={city} className="p-3 text-[10px] font-black text-primary/60 uppercase tracking-widest text-center" scope="col">
                      <div className={`inline-block px-2 py-1 rounded-md border text-[9px] ${CITY_COLORS[city] ?? ""}`}>{city}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {craftList.map(item => {
                  const cityPriceMap = manualPrices[item.id] || {};
                  const prices = CITIES.map(c => cityPriceMap[c] || 0);
                  const maxPrice = Math.max(...prices);

                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <img src={item.icon} alt={`${item.name} item icon`} className="w-9 h-9 object-contain shrink-0" referrerPolicy="no-referrer" loading="lazy" />
                          <div className="text-sm font-bold text-white truncate">{item.name}</div>
                        </div>
                      </td>
                      {CITIES.map((city, i) => {
                        const price = prices[i];
                        const isBest = price > 0 && price === maxPrice;
                        return (
                          <td key={city} className="p-3 text-center">
                            {price > 0 ? (
                              <div className={`inline-flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg font-mono text-xs font-bold ${
                                isBest ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300" : "text-primary/70"
                              }`}>
                                {isBest && <TrendingUp className="w-3 h-3" />}
                                {formatSilver(price)}
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-700">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Shopping List ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-1">
          <Plus className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-black text-white uppercase tracking-wider italic">Shopping List</h2>
          <span className="text-xs text-primary/50 italic ml-1">
            — bring full amount, get <span className="text-emerald-400 font-bold">{rrr.toFixed(1)}% back</span> after crafting
          </span>
        </div>
        <div className="glass-panel rounded-3xl overflow-hidden overflow-x-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-black/20 border-b border-primary/10">
                <th className="p-3 w-10" scope="col" />
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider" scope="col">Item</th>
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center" scope="col">Bring</th>
                <th className="p-3 text-xs font-bold text-success uppercase tracking-wider text-center hidden sm:table-cell" scope="col">
                  Return
                  <div className="text-xs text-primary/50 font-normal normal-case tracking-normal">(uncheck if not returned)</div>
                </th>
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center" scope="col">Have</th>
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center" scope="col">Net Buy</th>
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center hidden md:table-cell" scope="col">Source City</th>
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center hidden lg:table-cell" scope="col">Unit Price</th>
                <th className="p-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-right" scope="col">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {shoppingList.map(item => {
                const netBuy   = Math.max(0, Math.ceil(item.requiredNet) - item.have);
                const unitPrice = manualPrices[item.id]?.[item.sourceCity] || 0;
                const hasRrr = !noRrrItems.has(item.id);
                const livePrice = livePrices[`${item.id}_${item.sourceCity}`];

                return (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3">
                      {item.isCraftable && (
                        <button onClick={() => { const ai = itemsData.find(it => it.id === item.id); if (ai) addCraftItem(ai); }}
                          className="p-2 bg-black/20 border border-primary/10 rounded-lg text-primary/60 hover:text-primary hover:border-primary transition-all" title="Craft this ingredient" aria-label={`Add ${item.name} to crafting list`}>
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={item.icon} alt={`${item.name} shopping item`} className="w-10 h-10 object-contain shrink-0" referrerPolicy="no-referrer" loading="lazy" />
                        <div className="text-sm font-bold text-white truncate">{item.name}</div>
                      </div>
                    </td>
                    <td className="p-3 text-center"><span className="text-sm font-mono font-bold text-white">{Math.ceil(item.requiredRaw)}</span></td>
                    <td className="p-3 hidden sm:table-cell">
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="checkbox"
                          checked={hasRrr}
                          onChange={() => toggleRrr(item.id)}
                          title={hasRrr ? "Gets RRR cashback (click to disable)" : "Not returned (click to enable)"}
                          aria-label={hasRrr ? `RRR cashback for ${item.name} (click to disable)` : `No RRR cashback for ${item.name} (click to enable)`}
                          className="w-5 h-5 accent-success cursor-pointer rounded focus:ring-2 focus:ring-success/50"
                        />
                        {hasRrr ? (
                          <span className="text-sm font-mono font-bold text-emerald-400">+{Math.floor(item.returned)}</span>
                        ) : (
                          <span className="text-sm font-mono text-gray-600 line-through">+{Math.floor(item.requiredRaw * (rrr / 100))}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center">
                        <input type="number" value={item.have}
                          onChange={e => { setHasUserInteracted(true); setHaveList(prev => ({ ...prev, [item.id]: Number(e.target.value) })); }}
                          className="w-16 min-w-11 bg-black/40 border border-primary/20 rounded-xl py-2.5 px-2 text-center text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background touch-target"
                          aria-label={`Amount of ${item.name} you already have`}
                        />
                      </div>
                    </td>
                    <td className="p-3 text-center"><span className="text-sm font-mono font-bold text-primary">{netBuy}</span></td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="flex justify-center">
                        <div className="relative">
                          <select value={item.sourceCity}
                            onChange={e => {
                              setHasUserInteracted(true);
                              const c = e.target.value as AlbionCity;
                              setSourceCities(prev => ({ ...prev, [item.id]: c }));
                              setOverriddenCities(prev => new Set(prev).add(item.id));
                            }}
                            className="bg-black/40 border border-primary/20 rounded-xl py-1.5 pl-2 pr-7 text-[11px] font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background appearance-none">
                            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-primary/50 w-3 h-3 pointer-events-none" />
                        </div>
                      </div>
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      <div className="flex flex-col items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={unitPrice ? unitPrice.toLocaleString() : ""}
                          placeholder="0"
                          onChange={e => {
                            setHasUserInteracted(true);
                            const raw = Number(e.target.value.replace(/[^0-9]/g, ""));
                            setManualPrices(prev => ({
                              ...prev, [item.id]: { ...(prev[item.id] || {}), [item.sourceCity]: raw }
                            }));
                          }}
                          className={`w-32 bg-black/40 border rounded-xl py-1.5 px-3 text-center text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background h-10 ${
                            !unitPrice ? "border-yellow-500/30 text-yellow-400 placeholder:text-yellow-700/50" : "border-primary/20 text-primary"
                          }`}
                        />
                        {livePrice > 0 && (
                          <div className="flex items-center gap-1 opacity-50">
                            <span className="text-[8px] font-black uppercase tracking-tighter text-primary/60">Live:</span>
                            <span className="text-[9px] font-mono font-bold text-on-surface">
                              {formatSilver(livePrice).replace(' Silver', '')}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-sm text-primary">
                      {formatSilver(netBuy * unitPrice)}
                    </td>
                  </tr>
                );
              })}
              {shoppingList.length === 0 && (
                <tr><td colSpan={9} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='12' fill='%23151a21'/%3E%3Crect x='30' y='35' width='60' height='50' rx='6' fill='none' stroke='%23f59e0b' stroke-width='2' opacity='0.4'/%3E%3Cline x1='30' y1='55' x2='90' y2='55' stroke='%23f59e0b' stroke-width='2' opacity='0.3'/%3E%3Crect x='40' y='45' width='15' height='15' rx='3' fill='%23f59e0b' opacity='0.3'/%3E%3Crect x='60' y='45' width='15' height='15' rx='3' fill='%23f59e0b' opacity='0.2'/%3E%3Crect x='40' y='62' width='15' height='15' rx='3' fill='%23f59e0b' opacity='0.15'/%3E%3Crect x='60' y='62' width='15' height='15' rx='3' fill='%23f59e0b' opacity='0.1'/%3E%3C/svg%3E"
                      alt="Shopping list illustration"
                      className="w-16 h-16 opacity-60"
                    />
                    <p className="text-primary/50 text-sm">Add items to craft to see the shopping list</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Mobile Card Layout for Shopping List ─── */}
      <div className="block lg:hidden space-y-3">
        {shoppingList.map(item => {
          const netBuy = Math.max(0, Math.ceil(item.requiredNet) - item.have);
          const unitPrice = manualPrices[item.id]?.[item.sourceCity] || 0;
          const hasRrr = !noRrrItems.has(item.id);
          const livePrice = livePrices[`${item.id}_${item.sourceCity}`];

          return (
            <div key={item.id} className="glass-panel p-4 rounded-2xl border border-primary/10">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img src={item.icon} alt={`${item.name} shopping item`} className="w-10 h-10 object-contain shrink-0" referrerPolicy="no-referrer" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white truncate">{item.name}</div>
                    <div className="text-xs text-primary/40 font-mono tracking-tight truncate">{item.id}</div>
                  </div>
                </div>
                {item.isCraftable && (
                  <button onClick={() => { const ai = itemsData.find(it => it.id === item.id); if (ai) addCraftItem(ai); }}
                    className="p-2 bg-black/20 border border-primary/10 rounded-lg text-primary/60 hover:text-primary hover:border-primary transition-all shrink-0" title="Craft this ingredient" aria-label={`Add ${item.name} to crafting list`}>
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <div className="text-xs text-primary/60 uppercase tracking-wider mb-1">Bring</div>
                  <div className="text-sm font-mono font-bold text-white">{Math.ceil(item.requiredRaw)}</div>
                </div>
                <div>
                  <div className="text-xs text-primary/60 uppercase tracking-wider mb-1">Have</div>
                  <input type="number" value={item.have}
                    onChange={e => { setHasUserInteracted(true); setHaveList(prev => ({ ...prev, [item.id]: Number(e.target.value) })); }}
                    className="w-full bg-black/40 border border-primary/20 rounded-xl py-1.5 px-2 text-center text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background" />
                </div>
                <div>
                  <div className="text-xs text-primary/60 uppercase tracking-wider mb-1">Net Buy</div>
                  <div className="text-sm font-mono font-bold text-primary">{netBuy}</div>
                </div>
              </div>

              <div className="mb-3">
                <div className="text-xs text-primary/60 uppercase tracking-wider mb-1">Return (RRR)</div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasRrr}
                    onChange={() => toggleRrr(item.id)}
                    title={hasRrr ? "Gets RRR cashback (click to disable)" : "Not returned (click to enable)"}
                    className="w-5 h-5 accent-success cursor-pointer rounded focus:ring-2 focus:ring-success/50"
                  />
                  {hasRrr ? (
                    <span className="text-sm font-mono font-bold text-emerald-400">+{Math.floor(item.returned)}</span>
                  ) : (
                    <span className="text-sm font-mono text-gray-600 line-through">+{Math.floor(item.requiredRaw * (rrr / 100))}</span>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <div className="text-xs text-primary/60 uppercase tracking-wider mb-1">Source City</div>
                <select value={item.sourceCity}
                  onChange={e => {
                    setHasUserInteracted(true);
                    const c = e.target.value as AlbionCity;
                    setSourceCities(prev => ({ ...prev, [item.id]: c }));
                    setOverriddenCities(prev => new Set(prev).add(item.id));
                  }}
                  className="w-full bg-black/40 border border-primary/20 rounded-xl py-1.5 pl-2 pr-7 text-[11px] font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background appearance-none">
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="mb-3">
                <div className="text-xs text-primary/60 uppercase tracking-wider mb-1">Unit Price</div>
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={unitPrice ? unitPrice.toLocaleString() : ""}
                    placeholder="0"
                    onChange={e => {
                      setHasUserInteracted(true);
                      const raw = Number(e.target.value.replace(/[^0-9]/g, ""));
                      setManualPrices(prev => ({
                        ...prev, [item.id]: { ...(prev[item.id] || {}), [item.sourceCity]: raw }
                      }));
                    }}
                    className={`w-full bg-black/40 border rounded-xl py-1.5 px-3 text-center text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background h-10 ${
                      !unitPrice ? "border-yellow-500/30 text-yellow-400 placeholder:text-yellow-700/50" : "border-primary/20 text-primary"
                    }`}
                  />
                  {livePrice > 0 && (
                    <div className="flex items-center gap-1 opacity-50">
                      <span className="text-[8px] font-black uppercase tracking-tighter text-primary/60">Live:</span>
                      <span className="text-[9px] font-mono font-bold text-on-surface">
                        {formatSilver(livePrice).replace(' Silver', '')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-primary/10">
                <div className="text-xs text-primary/60 uppercase tracking-wider">Total Cost</div>
                <div className="font-mono font-bold text-sm text-primary">
                  {formatSilver(netBuy * unitPrice)}
                </div>
              </div>
            </div>
          );
        })}
        {shoppingList.length === 0 && (
          <div className="glass-panel p-8 rounded-2xl border border-primary/10 text-center">
            <div className="flex flex-col items-center gap-3">
              <img
                src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='12' fill='%23151a21'/%3E%3Crect x='30' y='35' width='60' height='50' rx='6' fill='none' stroke='%23f59e0b' stroke-width='2' opacity='0.4'/%3E%3Cline x1='30' y1='55' x2='90' y2='55' stroke='%23f59e0b' stroke-width='2' opacity='0.3'/%3E%3Crect x='40' y='45' width='15' height='15' rx='3' fill='%23f59e0b' opacity='0.3'/%3E%3Crect x='60' y='45' width='15' height='15' rx='3' fill='%23f59e0b' opacity='0.2'/%3E%3Crect x='40' y='62' width='15' height='15' rx='3' fill='%23f59e0b' opacity='0.15'/%3E%3Crect x='60' y='62' width='15' height='15' rx='3' fill='%23f59e0b' opacity='0.1'/%3E%3C/svg%3E"
                alt="Shopping list illustration"
                className="w-14 h-14 opacity-60"
              />
              <p className="text-primary/50 text-sm">Add items to craft to see the shopping list</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Footer Summary ─── */}
      {craftList.length > 0 && (
        <div className="glass-panel p-4 rounded-2xl border border-primary/10">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            <div className="text-center">
              <div className="text-[9px] font-black text-primary/40 uppercase tracking-widest">Station Fees</div>
              <div className="text-lg font-black text-white">{formatSilver(totalFees).replace(' Silver', '')}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] font-black text-primary/40 uppercase tracking-widest">Material Cost</div>
              <div className="text-lg font-black text-white">{formatSilver(totalMat).replace(' Silver', '')}</div>
            </div>
            <div className="h-8 w-px bg-primary/10 hidden sm:block" />
            <div className="text-center">
              <div className="text-[9px] font-black text-primary/40 uppercase tracking-widest">Total Sell Value</div>
              <div className="text-lg font-black text-primary">{formatSilver(totalSell).replace(' Silver', '')}</div>
            </div>
            <div className={`flex flex-col items-center px-4 py-2 rounded-xl border ${
              totalProfit > 0 ? "bg-emerald-500/10 border-emerald-500/30"
              : totalProfit < 0 ? "bg-red-500/10 border-red-500/30"
              : "bg-black/20 border-primary/10"}`}>
              <div className="text-[9px] font-black text-primary/60 uppercase tracking-widest">Total Profit</div>
              <div className={`text-xl font-black flex items-center gap-1.5 ${
                totalProfit > 0 ? "text-emerald-400" : totalProfit < 0 ? "text-red-400" : "text-primary/70"}`}>
                {totalProfit > 0 ? <TrendingUp className="w-4 h-4" /> : totalProfit < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                {formatSilver(Math.abs(totalProfit)).replace(' Silver', '')}
              </div>
              {(totalFees + totalMat) > 0 && (
                <div className={`text-[10px] font-bold ${
                  totalProfit > 0 ? "text-emerald-500" : totalProfit < 0 ? "text-red-500" : "text-primary/50"}`}>
                  {totalProfit > 0 ? "+" : ""}{((totalProfit / (totalFees + totalMat)) * 100).toFixed(1)}% ROI
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-[10px] text-primary/50 leading-relaxed">
          <strong className="text-primary/60">RRR is cashback:</strong> You bring the full ingredient amount — the station returns a portion after crafting.
          <strong className="text-primary/60"> Station Fee</strong> is the silver you pay the station per craft (check in-game before entering).
          <strong className="text-primary/60"> Default City</strong> auto-follows the item's best crafting city unless you manually change it.
        </p>
      </div>

      {/* Not logged in notice */}
      {!user && craftList.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/10 rounded-xl">
          <Save className="w-4 h-4 text-primary/40 shrink-0" />
          <p className="text-[10px] text-primary/40">
            <strong className="text-primary/60">Sign in</strong> to enable auto-save and keep your crafting plans across sessions.
          </p>
        </div>
      )}

      {/* ── Finalize Plan Modal ── */}
      <AnimatePresence>
        {showFinalizeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowFinalizeModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
              className="relative w-full max-w-md glass-panel rounded-3xl border border-primary/20 p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <Save className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Finalize Plan</h3>
                  <p className="text-xs text-primary/40">Give this plan a name to save it permanently.</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Plan Name</label>
                <input
                  type="text" value={finalizeName} onChange={e => setFinalizeName(e.target.value)}
                  autoFocus
                  className="w-full bg-black/40 border border-primary/15 rounded-xl py-3 px-4 text-white text-sm font-bold placeholder:text-primary/20 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Notes <span className="text-primary/20 font-normal normal-case">(optional)</span></label>
                <textarea
                  value={finalizeNote} onChange={e => setFinalizeNote(e.target.value)}
                  rows={2} placeholder="Remind yourself anything useful..."
                  className="w-full bg-black/40 border border-primary/15 rounded-xl py-3 px-4 text-white text-sm placeholder:text-primary/20 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowFinalizeModal(false)}
                  className="flex-1 py-3 bg-white/5 text-primary/40 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all">
                  Cancel
                </button>
                <button onClick={confirmFinalize} disabled={!finalizeName.trim()}
                  className="flex-1 py-3 bg-emerald-500 hover:brightness-110 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                  <Save className="w-3.5 h-3.5" /> Save Plan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
