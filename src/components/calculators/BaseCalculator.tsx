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
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Items excluded from RRR cashback (e.g. Treeheart, Tame Wild Boar)
  const [noRrrItems, setNoRrrItems] = useState<Set<string>>(new Set());

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
      if (plan.sourceCities) setSourceCities(plan.sourceCities as any);
      if (plan.globalCity) setGlobalCity(plan.globalCity as any);
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

  // ── Auto-Save (debounced 2s) ──────────────────────────────────────────────
  const getCurrentPlanState = () => ({
    craftList, haveList, manualPrices, sellPrices,
    sourceCities: sourceCities as Record<string, string>,
    globalCity, rrrConfig,
    noRrrItems: Array.from(noRrrItems),
  });

  useEffect(() => {
    if (!user || craftList.length === 0) return; // Don't auto-save empty state

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaveStatus('idle');

    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveStatus('saving');
      const planState = getCurrentPlanState();

      if (autoSaveDraftId) {
        // Update existing draft
        updateCraftingPlan(autoSaveDraftId, { ...planState, isDraft: true });
      } else {
        // Create new draft
        const result = saveCraftingPlan({
          name: `${title} Draft`,
          type: storageKey as 'crafting' | 'refining' | 'cooking',
          isDraft: true,
          notes: '',
          ...planState,
        });
        if (result.ok && result.planId) setAutoSaveDraftId(result.planId);
      }

      setTimeout(() => setAutoSaveStatus('saved'), 300);
      setTimeout(() => setAutoSaveStatus('idle'), 2500);
    }, 2000);

    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [craftList, manualPrices, sellPrices, sourceCities, globalCity, rrrConfig, haveList, noRrrItems, user]);

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
    if (name) saveSimulation({ name, type: storageKey as any, data: { craftList, haveList, manualPrices, sellPrices, sourceCities, globalCity, rrrConfig } });
  };

  // Shopping list — Bring / Returned / Net
  const shoppingList = useMemo<ShoppingItem[]>(() => {
    const map: Record<string, ShoppingItem> = {};
    craftList.forEach(item => {
      const ai = itemsData.find(it => it.id === item.id);
      if (!ai?.craftingRecipe?.length) return;
      ai.craftingRecipe.forEach(req => {
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

  const toggleRrr = (id: string) =>
    setNoRrrItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const removeCraftItem = (id: string) => setCraftList(prev => prev.filter(i => i.id !== id));
  const updateCraftItem = (id: string, u: Partial<CraftItem>) =>
    setCraftList(prev => prev.map(i => i.id === id ? { ...i, ...u } : i));

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
        stationFeeSilver: 0,
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

      {/* ─── Page Header ─── */}
      <div className="glass-panel p-5 rounded-3xl border border-primary/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            {icon}
          </div>
          <h2 className="text-xl font-black text-white uppercase italic tracking-wider">{title}</h2>
        </div>
        <p className="text-primary/60 text-sm">
          {storageKey === 'crafting' ? 'Calculate crafting profitability by accounting for ingredient costs, resource return rates (RRR), and city bonuses.' : 
           storageKey === 'refining' ? 'Optimize your refining process. Compare raw material costs against refined outputs with localized city bonuses.' : 
           'Plan your cooking sessions. Track ingredient requirements and calculate net profit after taxes and fees for consumables.'}
        </p>
      </div>

      {/* ─── Control Bar ─── */}
      <div className="flex flex-col gap-4 glass-panel p-5 rounded-3xl border border-primary/10 relative z-30">
        {/* Row 1: Search + Pull */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <SearchBar onSelect={addCraftItem} craftableOnly filterPredicate={filterPredicate} />
          </div>

          {/* Recent Items — always in top row */}
          <div className="relative group shrink-0">
            <button className="flex items-center gap-2 px-4 h-12 bg-black/20 border border-primary/20 rounded-xl text-white hover:bg-black/60 transition-all text-sm font-bold whitespace-nowrap">
              <History className="w-5 h-5 text-primary" />
              Recent <ChevronDown className="w-4 h-4 text-primary/50" />
            </button>
            <div className="absolute top-full right-0 mt-2 w-64 glass-panel rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2">
              {recentItems.length === 0 ? (
                <div className="p-3 text-sm text-primary/40 italic text-center">No recent items yet</div>
              ) : recentItems.map(({ item, prices: snap, sellPrices: snapSell }) => (
                <button key={item.id}
                  onClick={() => {
                    addCraftItem(item);
                    setManualPrices(prev => {
                      const merged = { ...snap };
                      for (const id of Object.keys(prev)) {
                        merged[id] = { ...merged[id], ...prev[id] };
                      }
                      return merged;
                    });
                    setSellPrices(prev => ({ ...snapSell, ...prev }));
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg text-left min-h-12">
                  <img src={item.icon} className="w-8 h-8" alt="" />
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate font-medium">{item.name}</div>
                    {snapSell[item.id] > 0 && (
                      <div className="text-xs text-primary/40">Last sell: {snapSell[item.id].toLocaleString()}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={pullPrices} disabled={loading}
            className="flex items-center gap-2 px-5 h-12 bg-primary text-black font-bold uppercase tracking-wider rounded-xl hover:brightness-110 transition-all disabled:opacity-50 shrink-0 text-sm shadow-[0_4px_12px_rgba(212,175,55,0.2)]">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            Pull Market
          </button>

          {/* Auto-save status */}
          {user && craftList.length > 0 && (
            <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all shrink-0 h-12 px-3 ${
              autoSaveStatus === 'saving' ? 'text-primary/60' :
              autoSaveStatus === 'saved'  ? 'text-success' : 'text-primary/30'
            }`}>
              {autoSaveStatus === 'saving' ? <Loader2 className="w-5 h-5 animate-spin" /> :
               autoSaveStatus === 'saved'  ? <CheckIcon className="w-5 h-5" /> :
               <Save className="w-5 h-5" />}
              {autoSaveStatus === 'saving' ? 'Saving...' : autoSaveStatus === 'saved' ? 'Saved' : 'Auto-save On'}
            </div>
          )}

          {/* Finalize Plan button */}
          <button onClick={handleFinalize} disabled={craftList.length === 0}
            className="flex items-center gap-2 px-4 h-12 bg-success/10 hover:bg-success/20 text-success border border-success/20 rounded-xl font-bold uppercase tracking-wider text-sm transition-all disabled:opacity-30 shrink-0">
            <Save className="w-5 h-5" /> Finalize Plan
          </button>
        </div>

        {/* Row 2: City + RRR breakdown */}
        <div className="flex flex-wrap items-end gap-4 pt-4 border-t border-primary/10">
          {/* Default city */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-primary/50 uppercase tracking-wider">Default City</label>
            <div className="relative">
              <select value={globalCity}
                onChange={e => { setGlobalCity(e.target.value as AlbionCity); setCityManuallySet(true); }}
                className="h-12 bg-black/20 border border-primary/20 rounded-xl px-4 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none text-sm font-bold min-w-40">
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 w-5 h-5 pointer-events-none" />
            </div>
          </div>

          <div className="w-px h-12 bg-primary/10 self-stretch mb-0.5" />

          {/* Station bonus */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-primary/50 uppercase tracking-wider">Station Bonus</label>
            <div className="relative">
              <select value={rrrConfig.stationBonus}
                onChange={e => setRrrConfig(p => ({ ...p, stationBonus: Number(e.target.value) as 10 | 20 }))}
                className="h-12 bg-black/20 border border-primary/20 rounded-xl px-4 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none text-sm font-bold min-w-40">
                <option value={10}>Normal (10%)</option>
                <option value={20}>Event / Premium (20%)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 w-5 h-5 pointer-events-none" />
            </div>
          </div>

          {/* City Bonus Toggle */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-primary/50 uppercase tracking-wider">City Bonus</label>
            <button
              onClick={() => setRrrConfig(p => ({ ...p, cityBonus: !p.cityBonus }))}
              className={`h-9 px-4 rounded-full font-bold text-xs transition-all ${
                rrrConfig.cityBonus
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(52,211,153,0.25)]"
                  : "bg-white/5 text-gray-500 border border-transparent"
              }`}
            >
              {rrrConfig.cityBonus ? "On" : "Off"}
            </button>
          </div>

          {/* Focus Toggle */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-primary/50 uppercase tracking-wider">Focus</label>
            <button
              onClick={() => setRrrConfig(p => ({ ...p, focus: !p.focus }))}
              className={`h-9 px-4 rounded-full font-bold text-xs transition-all ${
                rrrConfig.focus
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(52,211,153,0.25)]"
                  : "bg-white/5 text-gray-500 border border-transparent"
              }`}
            >
              {rrrConfig.focus ? "On" : "Off"}
            </button>
          </div>

          {/* Computed RRR Badge */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-primary/50 uppercase tracking-wider">Total RRR</label>
            <div className="flex items-center gap-2 h-12 bg-primary/10 border border-primary/30 rounded-xl px-4">
              <RotateCcw className="w-5 h-5 text-primary" />
              <span className="text-primary font-bold text-base">{rrr.toFixed(1)}%</span>
            </div>
          </div>

        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">{error}</div>
      )}

      {/* ─── Items to Craft ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-1">
          {icon}
          <h3 className="text-lg font-black text-white uppercase tracking-wider italic">{title}</h3>
        </div>
        <div className="glass-panel rounded-3xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-black/20 border-b border-primary/10">
                <th className="p-4 w-10" />
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider min-w-44">Item</th>
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider">Best City</th>
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider">Recipe</th>
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider text-center w-20">Qty</th>
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider text-center w-36">
                  Fee / craft
                  <div className="text-xs text-primary/40 font-normal normal-case tracking-normal">(silver, editable)</div>
                </th>
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider text-center w-32">Sell Price</th>
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider text-right w-32">Profit</th>
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
                      className="hover:bg-white/5 transition-colors">
                      <td className="p-3">
                        <button onClick={() => removeCraftItem(item.id)} className="p-2 text-gray-600 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <img src={item.icon} alt={item.name} className="w-11 h-11 object-contain shrink-0" referrerPolicy="no-referrer" />
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate">{item.name}</div>
                            <div className="text-xs text-primary/40 font-mono tracking-tight truncate">{item.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {calc.bestCity ? (
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${CITY_COLORS[calc.bestCity] ?? "bg-gray-800 text-on-surface border-primary/20"}`}>
                            <MapPin className="w-3 h-3" />{calc.bestCity}
                            <span className="text-[9px] opacity-70">+15%</span>
                          </div>
                        ) : <span className="text-xs text-primary/40 italic">Any City</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {recipe.length === 0
                            ? <span className="text-xs text-primary/40 italic">No recipe</span>
                            : recipe.map(req => {
                              const ri = itemsData.find(it => it.id === req.id);
                              return (
                                <div key={req.id} className="flex items-center gap-1.5 bg-black/30 border border-primary/10 rounded-lg p-1.5 pr-2.5" title={ri?.name || req.id}>
                                  <img src={ri?.icon || `https://render.albiononline.com/v1/item/${req.id}.png`} className="w-6 h-6" alt="" referrerPolicy="no-referrer" />
                                  <span className="text-xs font-bold text-primary/60">{req.count * item.count}</span>
                                </div>
                              );
                            })}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center">
                          <input type="number" value={item.count}
                            onChange={e => updateCraftItem(item.id, { count: Math.max(1, Number(e.target.value)) })}
                            className="w-16 bg-black/20 border border-primary/20 rounded-lg py-2 px-2 text-center text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col items-center gap-0.5">
                          <input type="number" value={item.stationFeeSilver || ""}
                            placeholder="0"
                            onChange={e => updateCraftItem(item.id, { stationFeeSilver: Math.max(0, Number(e.target.value)) })}
                            className="w-28 bg-black/20 border border-primary/20 rounded-lg py-2 px-3 text-center text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary" />
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
                            onChange={e => setSellPrices(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                            className={`w-28 bg-black/20 border rounded-lg py-2 px-3 text-center text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary ${
                              !sellPrices[item.id] ? "border-yellow-500/30 text-yellow-500/80 placeholder:text-yellow-700/50" : "border-primary/20 text-white"
                            }`} />
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
                  <td colSpan={8} className="p-12 text-center text-primary/50 italic text-sm">
                    Search for a craftable item above to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── City Price Comparison (Best Market) ─── */}
      {hasCityPrices && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-1">
            <BarChart2 className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-black text-white uppercase tracking-wider italic">Best Market to Sell</h3>
            <span className="text-xs text-primary/50 italic ml-1">— highest price is highlighted</span>
          </div>
          <div className="glass-panel rounded-3xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-black/20 border-b border-primary/10">
                  <th className="p-3 text-[10px] font-black text-primary/50 uppercase tracking-widest min-w-[180px]">Item</th>
                  {CITIES.map(city => (
                    <th key={city} className="p-3 text-[10px] font-black text-primary/50 uppercase tracking-widest text-center">
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
                          <img src={item.icon} alt={item.name} className="w-9 h-9 object-contain shrink-0" referrerPolicy="no-referrer" />
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
                                isBest ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300" : "text-primary/60"
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
          <h3 className="text-lg font-black text-white uppercase tracking-wider italic">Shopping List</h3>
          <span className="text-xs text-primary/50 italic ml-1">
            — bring full amount, get <span className="text-emerald-400 font-bold">{rrr.toFixed(1)}% back</span> after crafting
          </span>
        </div>
        <div className="glass-panel rounded-3xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-black/20 border-b border-primary/10">
                <th className="p-3 w-10" />
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider min-w-44">Item</th>
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider text-center">Bring</th>
                <th className="p-3 text-xs font-bold text-success uppercase tracking-wider text-center">
                  Return
                  <div className="text-xs text-primary/40 font-normal normal-case tracking-normal">(uncheck if not returned)</div>
                </th>
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider text-center">Have</th>
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider text-center">Net Buy</th>
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider text-center">Source City</th>
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider text-center">Unit Price</th>
                <th className="p-3 text-xs font-bold text-primary/50 uppercase tracking-wider text-right">Σ Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {shoppingList.map(item => {
                const netBuy   = Math.max(0, Math.ceil(item.requiredNet) - item.have);
                const unitPrice = manualPrices[item.id]?.[item.sourceCity] || 0;
                return (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3">
                      {item.isCraftable && (
                        <button onClick={() => { const ai = itemsData.find(it => it.id === item.id); if (ai) addCraftItem(ai); }}
                          className="p-2 bg-black/20 border border-primary/10 rounded-lg text-primary/60 hover:text-primary hover:border-primary transition-all" title="Craft this ingredient">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={item.icon} alt={item.name} className="w-10 h-10 object-contain shrink-0" referrerPolicy="no-referrer" />
                        <div className="text-sm font-bold text-white truncate">{item.name}</div>
                      </div>
                    </td>
                    <td className="p-3 text-center"><span className="text-sm font-mono font-bold text-white">{Math.ceil(item.requiredRaw)}</span></td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="checkbox"
                          checked={!noRrrItems.has(item.id)}
                          onChange={() => toggleRrr(item.id)}
                          title={noRrrItems.has(item.id) ? "Not returned (click to enable)" : "Gets RRR cashback (click to disable)"}
                          className="w-5 h-5 accent-success cursor-pointer rounded focus:ring-2 focus:ring-success/50"
                        />
                        {!noRrrItems.has(item.id) ? (
                          <span className="text-sm font-mono font-bold text-emerald-400">+{Math.floor(item.returned)}</span>
                        ) : (
                          <span className="text-sm font-mono text-gray-600 line-through">+{Math.floor(item.requiredRaw * (rrr / 100))}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center">
                        <input type="number" value={item.have}
                          onChange={e => setHaveList(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                          className="w-16 bg-black/20 border border-primary/20 rounded-lg py-1.5 px-2 text-center text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    </td>
                    <td className="p-3 text-center"><span className="text-sm font-mono font-bold text-primary">{netBuy}</span></td>
                    <td className="p-3">
                      <div className="flex justify-center">
                        <div className="relative">
                          <select value={item.sourceCity}
                            onChange={e => {
                              const c = e.target.value as AlbionCity;
                              setSourceCities(prev => ({ ...prev, [item.id]: c }));
                              setOverriddenCities(prev => new Set(prev).add(item.id));
                            }}
                            className="bg-black/20 border border-primary/20 rounded-lg py-1.5 pl-2 pr-7 text-[11px] font-bold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary appearance-none">
                            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 text-primary/50 w-3 h-3 pointer-events-none" />
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={unitPrice ? unitPrice.toLocaleString() : ""}
                          placeholder="0"
                          onChange={e => {
                            const raw = Number(e.target.value.replace(/[^0-9]/g, ""));
                            setManualPrices(prev => ({
                              ...prev, [item.id]: { ...(prev[item.id] || {}), [item.sourceCity]: raw }
                            }));
                          }}
                          className={`w-32 bg-black/20 border rounded-lg py-1.5 px-3 text-center text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary h-10 ${
                            !unitPrice ? "border-red-500/30 text-red-400 placeholder:text-red-700/50" : "border-primary/20 text-white"
                          }`}
                        />
                        {/* API Price Ref - Small badge below */}
                        <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                          <span className="text-[8px] font-black uppercase tracking-tighter text-primary/60">Live:</span>
                          <span className="text-[9px] font-mono font-bold text-on-surface">
                            {livePrices[`${item.id}_${item.sourceCity}`] ? formatSilver(livePrices[`${item.id}_${item.sourceCity}`]).replace(' Silver', '') : '—'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-sm text-on-surface">
                      {formatSilver(netBuy * unitPrice)}
                    </td>
                  </tr>
                );
              })}
              {shoppingList.length === 0 && (
                <tr><td colSpan={9} className="p-10 text-center text-primary/50 italic text-sm">Add items to craft to see the shopping list.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Footer Summary ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 glass-panel p-5 rounded-3xl border border-primary/10">
        <div className="text-center p-4 bg-black/20 rounded-xl">
          <div className="text-[9px] font-black text-primary/50 uppercase tracking-widest mb-1">Station Fees</div>
          <div className="text-2xl font-black text-on-surface">{formatSilver(totalFees).replace(' Silver', '')}</div>
        </div>
        <div className="text-center p-4 bg-black/20 rounded-xl">
          <div className="text-[9px] font-black text-primary/50 uppercase tracking-widest mb-1">Material Cost</div>
          <div className="text-2xl font-black text-on-surface">{formatSilver(totalMat).replace(' Silver', '')}</div>
        </div>
        <div className="text-center p-4 bg-black/20 rounded-xl">
          <div className="text-[9px] font-black text-primary/50 uppercase tracking-widest mb-1">Total Sell Value</div>
          <div className="text-2xl font-black text-primary">{formatSilver(totalSell).replace(' Silver', '')}</div>
        </div>
        <div className={`text-center p-4 rounded-xl border ${
          totalProfit > 0 ? "bg-emerald-500/10 border-emerald-500/30"
          : totalProfit < 0 ? "bg-red-500/10 border-red-500/30"
          : "bg-black/20 border-transparent"}`}>
          <div className="text-[9px] font-black text-primary/50 uppercase tracking-widest mb-1">Est. Profit</div>
          <div className={`text-2xl font-black flex items-center justify-center gap-1.5 ${
            totalProfit > 0 ? "text-emerald-400" : totalProfit < 0 ? "text-red-400" : "text-primary/60"}`}>
            {totalProfit > 0 ? <TrendingUp className="w-5 h-5" /> : totalProfit < 0 ? <TrendingDown className="w-5 h-5" /> : null}
            {formatSilver(Math.abs(totalProfit)).replace(' Silver', '')}
          </div>
          {(totalFees + totalMat) > 0 && (
            <div className={`text-xs font-bold mt-1 ${
              totalProfit > 0 ? "text-emerald-500" : totalProfit < 0 ? "text-red-500" : "text-primary/50"}`}>
              {totalProfit > 0 ? "+" : ""}{((totalProfit / (totalFees + totalMat)) * 100).toFixed(1)}% ROI
            </div>
          )}
        </div>
      </div>

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
