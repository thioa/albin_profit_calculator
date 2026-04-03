import React, { useState, useEffect, useMemo } from "react";
import { AlbionPrice, AlbionCity, AlbionServer, ItemQuality, AlbionItem } from "../../types/albion";
import { fetchPrices } from "../../lib/albion-api";
import { calculateRecommendationProfit, RecommendationResult, getRrr, RrrConfig } from "../../lib/crafting-utils";
import { formatSilver, formatTimeAgo, getFreshnessLevel, FreshnessLevel, getQualityName } from "../../lib/economy-utils";
import { HOT_ITEMS } from "../../config/constants";
import itemsDataRaw from "../../data/items-lite.json";
import { processItems } from "../../lib/item-utils";
import { Loader2, RefreshCw, Info, Clock, ArrowRight, Zap, TrendingUp, AlertTriangle, ShieldCheck, Star, Hammer, MapPin, Search } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useWatchlist } from "../../contexts/WatchlistContext";
import { motion, AnimatePresence } from "motion/react";
import { getOrMarkStale, setPriceCacheBatch, TTL, clearAllPrices } from "../../lib/price-cache";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);

interface CraftingRecommendationsProps {
  server: AlbionServer;
  isPremium: boolean;
}

export default function CraftingRecommendations({ server, isPremium }: CraftingRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [backgroundScan, setBackgroundScan] = useState(false);
  const [cacheAge, setCacheAge] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [rrrConfig, setRrrConfig] = useState<RrrConfig>({ stationBonus: 10, cityBonus: true, focus: false });
  const [fixedCity, setFixedCity] = useState<AlbionCity | "Global">("Lymhurst");
  const [selectedTiers, setSelectedTiers] = useState<number[]>([4, 5, 6]);
  
  const scanIdRef = React.useRef(0);
  const { user } = useAuth();
  const { addNotification } = useWatchlist();

  const itemsMap = useMemo(() => {
    const map: Record<string, AlbionItem> = {};
    itemsData.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, []);

  const rrr = useMemo(() => getRrr(rrrConfig), [rrrConfig]);

  const processAndSetResults = (data: any[], currentScanId: number) => {
    if (currentScanId !== scanIdRef.current) return;
    const priceMap: Record<string, Record<string, number>> = {};
    data.forEach(p => {
      if (!priceMap[p.item_id]) priceMap[p.item_id] = {};
      priceMap[p.item_id][p.city] = p.sell_price_min;
    });
    const analysisCity = fixedCity === "Global" ? undefined : fixedCity;
    const results: RecommendationResult[] = filteredTargets.map(item =>
      calculateRecommendationProfit(item, priceMap, rrr, isPremium, analysisCity)
    ).filter(r => r && r.profit > 0) as RecommendationResult[];
    setRecommendations(results.sort((a, b) => b.profit - a.profit));
  };

  // Lazily compute filteredTargets inside scan to keep it DRY
  const getFilteredTargets = () => itemsData.filter(item =>
    item.craftingRecipe && item.craftingRecipe.length > 0 && selectedTiers.includes(item.tier) &&
    HOT_ITEMS.some(hotId => item.id.startsWith(hotId))
  );

  const scanRecommendations = async (forceRefresh = false) => {
    const currentScanId = ++scanIdRef.current;
    setLoading(false);
    setError(null);
    try {
      const filteredTargets = getFilteredTargets();
      if (filteredTargets.length === 0) { setRecommendations([]); return; }

      const cities: AlbionCity[] = ["Martlock", "Bridgewatch", "Lymhurst", "Fort Sterling", "Thetford", "Caerleon"];
      const allIds: string[] = [];
      filteredTargets.forEach(item => {
        allIds.push(item.id);
        item.craftingRecipe?.forEach(req => allIds.push(req.id));
      });
      const uniqueIds = [...new Set(allIds)];

      // ── Step 1: Serve from cache instantly ──────────────────────────────
      if (!forceRefresh) {
        const { cached, staleIds } = getOrMarkStale(uniqueIds, cities, [1], TTL.PROFIT_SCANNER);
        if (cached.length > 0) {
          processAndSetResults(cached, currentScanId);
          setCacheAge(new Date());
          if (staleIds.length === 0) return;
          setBackgroundScan(true);
          try {
            const fresh = await fetchPrices(staleIds, cities, [1], server);
            if (currentScanId !== scanIdRef.current) return;
            setPriceCacheBatch(fresh);
            processAndSetResults([...cached.filter(c => !staleIds.includes(c.item_id)), ...fresh], currentScanId);
            setCacheAge(new Date());
          } catch {}
          setBackgroundScan(false);
          return;
        }
      }

      // ── Step 2: Full fetch ───────────────────────────────────────────────
      setLoading(true);
      const data = await fetchPrices(uniqueIds, cities, [1], server);
      if (currentScanId !== scanIdRef.current) return;
      setPriceCacheBatch(data);
      setCacheAge(new Date());
      processAndSetResults(data, currentScanId);
    } catch (err) {
      if (currentScanId === scanIdRef.current) setError("Failed to fetch recommendations. Try narrowing your filters.");
    } finally {
      if (currentScanId === scanIdRef.current) setLoading(false);
    }
  };

  // Helper kept outside scan for processAndSetResults to use
  const filteredTargets = getFilteredTargets();

  useEffect(() => {
    scanRecommendations();
  }, [server, isPremium, rrr, selectedTiers, fixedCity]);

  const handleInjectToCalculator = (rec: RecommendationResult) => {
    const item = itemsMap[rec.itemId];
    if (!item) return;

    const event = new CustomEvent('albion_add_craft_item', {
      detail: {
        item: item,
        targetTab: 'crafting',
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER & CONTROLS ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass-panel p-6 rounded-3xl border border-primary/10">
        <div className="space-y-1">
          <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Hammer className="w-6 h-6 text-primary" />
            City <span className="text-primary">Profit</span> Scanner
          </h3>
          <p className="text-primary/60 text-sm">
            {fixedCity === "Global" 
              ? "Scanning all cities for the best routing opportunities (Buy/Sell anywhere)."
              : `Analyzing profit for items where materials and products are traded in ${fixedCity}.`
            }
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* City Selector */}
          <div className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded-xl border border-primary/10">
            <MapPin className="w-4 h-4 text-primary/60" />
            <select
              value={fixedCity}
              onChange={(e) => setFixedCity(e.target.value as AlbionCity | "Global")}
              className="bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer uppercase tracking-widest"
            >
              <option value="Global" className="bg-slate-900 border-none">Global Routes</option>
              <option value="Martlock" className="bg-slate-900">Martlock</option>
              <option value="Bridgewatch" className="bg-slate-900">Bridgewatch</option>
              <option value="Lymhurst" className="bg-slate-900">Lymhurst</option>
              <option value="Fort Sterling" className="bg-slate-900">Fort Sterling</option>
              <option value="Thetford" className="bg-slate-900">Thetford</option>
              <option value="Caerleon" className="bg-slate-900">Caerleon</option>
            </select>
          </div>

          {/* Tier Multi-Select */}
          <div className="flex bg-black/20 p-1 rounded-xl border border-primary/10">
            {[4, 5, 6, 7, 8].map(tier => (
              <button
                key={tier}
                onClick={() => {
                  setSelectedTiers(prev => 
                    prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier]
                  );
                }}
                className={`w-10 h-10 rounded-lg text-xs font-black transition-all ${
                  selectedTiers.includes(tier) 
                  ? "bg-primary text-black" 
                  : "text-primary/40 hover:text-primary"
                }`}
              >
                T{tier}
              </button>
            ))}
          </div>

          {/* RRR Toggle Panel */}
          <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-xl border border-primary/10 overflow-x-auto max-w-full">
            <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest whitespace-nowrap">Focus</label>
            <button
              onClick={() => setRrrConfig(prev => ({ ...prev, focus: !prev.focus }))}
              className={`h-9 px-4 rounded-full font-bold text-xs transition-all ${
                rrrConfig.focus
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(52,211,153,0.25)]"
                  : "bg-white/5 text-gray-500 border border-transparent"
              }`}
            >
              {rrrConfig.focus ? "On" : "Off"}
            </button>
            
            <div className="w-px h-4 bg-primary/10 mx-1 shrink-0" />
            
            <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest whitespace-nowrap">RRR</label>
            <span className="text-xs font-black text-primary">{rrr.toFixed(1)}%</span>
            
            {backgroundScan && (
              <div className="flex items-center gap-1.5 ml-2 text-[9px] text-primary/40 uppercase tracking-widest">
                <RefreshCw className="w-3 h-3 animate-spin" /> Updating...
              </div>
            )}
            {cacheAge && !backgroundScan && (
              <span className="ml-2 text-[9px] text-primary/20 uppercase tracking-widest">
                {Math.round((Date.now() - cacheAge.getTime()) / 60000)}m ago
              </span>
            )}

            <button
              onClick={() => { clearAllPrices(); scanRecommendations(true); }}
              disabled={loading}
              className="ml-4 p-2 text-primary/60 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── RESULTS ── */}
      {loading && recommendations.length === 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-panel border border-primary/10 rounded-2xl h-32 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/50 p-12 rounded-3xl text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="text-red-500 font-bold">{error}</p>
          <button onClick={() => scanRecommendations(true)} className="bg-red-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-600 transition-colors">Retry Scan</button>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="glass-panel p-20 rounded-3xl text-center border border-primary/5">
          <Search className="w-16 h-16 text-primary/10 mx-auto mb-6" />
          <h4 className="text-xl font-bold text-white opacity-40 uppercase tracking-widest italic">No Profitable Crafts Found</h4>
          <p className="text-primary/30 mt-2">Try adjusting your filters or checking a different tier.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {recommendations.slice(0, displayLimit).map((rec, idx) => (
              <motion.div
                key={rec.itemId + idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group relative glass-panel border border-primary/10 rounded-2xl overflow-hidden hover:border-primary/40 transition-all duration-500"
              >
                {/* Accent Bar */}
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary to-primary/20" />
                
                <div className="p-5 flex flex-col lg:flex-row items-center gap-8">
                  {/* Item Ident */}
                  <div className="flex items-center gap-4 w-full lg:w-64">
                    <div className="relative shrink-0">
                      <div className="glass-panel p-3 rounded-2xl border border-primary/20 bg-black/40">
                        <img src={rec.icon} alt={rec.itemName} className="w-12 h-12 object-contain group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-white font-bold text-base truncate group-hover:text-primary transition-colors">{rec.itemName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono text-primary/40 uppercase bg-white/5 px-2 py-0.5 rounded">
                          {rec.itemId.split('_')[0]} {/* Tier */}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400/60 uppercase">Craftable</span>
                      </div>
                    </div>
                  </div>

                  {/* Profit Stats */}
                  <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-primary/40 font-black uppercase tracking-widest mb-1">Potential Profit</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-mono font-black text-emerald-400">+{formatSilver(rec.profit).replace(' Silver', '')}</span>
                        <span className="text-[9px] font-black text-emerald-700">SLV</span>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-primary/40 font-black uppercase tracking-widest mb-1">ROI Yield</span>
                      <div className="flex items-center gap-1.5 text-blue-400 font-mono font-black text-lg">
                        <Zap className="w-4 h-4 fill-current" />
                        {rec.roi.toFixed(1)}%
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-primary/40 font-black uppercase tracking-widest mb-1">
                        {fixedCity === "Global" ? "Optimal Route" : "Single City"}
                      </span>
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        {fixedCity === "Global" ? (
                          <>
                            <div className="flex flex-col items-start">
                              <span className="text-[8px] text-gray-500 uppercase">Craft at</span>
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-red-500" />
                                {rec.craftCity}
                              </div>
                            </div>
                            <ArrowRight className="w-3 h-3 text-primary/40" />
                            <div className="flex flex-col items-end">
                              <span className="text-[8px] text-gray-500 uppercase text-right">Sell at</span>
                              <div className="flex items-center gap-1">
                                {rec.sellCity}
                                <MapPin className="w-3 h-3 text-emerald-500" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 bg-emerald-500/10 px-2 py-1 rounded text-emerald-400">
                             <ShieldCheck className="w-3 h-3" />
                             <span>Exclusive {fixedCity}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-primary/40 font-black uppercase tracking-widest mb-1">Investment</span>
                      <span className="text-sm font-mono text-white/50">{formatSilver(rec.totalCost)}</span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="shrink-0 flex items-center gap-3">
                    <button 
                      onClick={() => handleInjectToCalculator(rec)}
                      className="flex items-center gap-2 bg-primary/10 hover:bg-primary text-primary hover:text-black border border-primary/20 rounded-xl px-5 py-3 transition-all font-black uppercase text-xs tracking-widest"
                    >
                      <Hammer className="w-4 h-4" /> Analyse
                    </button>
                  </div>
                </div>

                {/* Ingredients Tooltip/Expansion (Optional) */}
                <div className="px-5 pb-5 border-t border-white/[0.03] pt-4">
                   <div className="flex items-center gap-4">
                      <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Sourcing:</span>
                      <div className="flex flex-wrap gap-3">
                         {rec.ingredients.map(ing => (
                            <div key={ing.id} className="flex items-center gap-2 text-xs text-white/40">
                               <span className="font-mono">{ing.count}x</span>
                               <span className="font-bold text-white/60">{ing.id.split('_').pop()}</span>
                               <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded">{ing.buyCity}</span>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {recommendations.length > displayLimit && (
            <div className="flex justify-center pt-6">
              <button 
                onClick={() => setDisplayLimit(p => p + 10)}
                className="glass-panel px-8 py-3 rounded-xl border border-primary/10 hover:border-primary/50 text-white font-bold tracking-widest uppercase text-xs transition-all hover:bg-primary/5"
              >
                Load More Opportunities
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
