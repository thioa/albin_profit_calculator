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

export default function ProfitScanner({ server, isPremium }: CraftingRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [backgroundScan, setBackgroundScan] = useState(false);
  const [cacheAge, setCacheAge] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [rrrConfig, setRrrConfig] = useState<RrrConfig>({ stationBonus: 10, cityBonus: true, focus: false });
  const [fixedCity, setFixedCity] = useState<AlbionCity | "Global">("Global");
  const [selectedTiers, setSelectedTiers] = useState<number[]>([]);
  
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

      // â”€â”€ Step 1: Serve from cache instantly â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

      // â”€â”€ Step 2: Full fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    <div className="space-y-4">
      {/* HEADER & CONTROLS - POWER DASHBOARD */}
      <div className="space-y-4">
        {/* Title + Mode Indicator */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Hammer className="w-7 h-7 text-primary" />
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">City Profit Scanner</h3>
              <div className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border ${
                fixedCity === "Global" 
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/30"
              }`}>
                {fixedCity === "Global" ? "🌍 Global Routes" : `📍 City-Locked: ${fixedCity}`}
              </div>
            </div>
            <p className="text-primary/50 text-sm max-w-xl">
              {fixedCity === "Global" 
                ? "Analyzing best routing opportunities across all cities (Buy/Sell anywhere)"
                : `Analyzing profit for items where materials and products are traded in ${fixedCity}`
              }
            </p>
          </div>

          {/* Quick Scan Stats */}
          <div className="flex items-center gap-3 text-right">
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-400">{recommendations.length}</div>
              <div className="text-tiny text-white/40 uppercase tracking-tighter">Opportunities</div>
            </div>
            <div className="w-px h-12 bg-white/10" />
            {backgroundScan ? (
              <div className="flex items-center gap-1.5 text-blue-400 text-center">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <div>
                  <div className="text-sm font-bold">Scanning</div>
                  <div className="text-tiny text-blue-400/60">Live Update</div>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-sm font-black text-primary">{cacheAge ? `${Math.round((Date.now() - cacheAge.getTime()) / 60000)}m` : "--"}</div>
                <div className="text-tiny text-white/40 uppercase tracking-tighter">Fresh Data</div>
              </div>
            )}
          </div>
        </div>

        {/* Controls Panel */}
        <div className="glass-panel p-4 rounded-xl border border-primary/10 space-y-3">
          {/* Row 1: Route Mode & Quick Tier Presets */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            {/* City Selector */}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary/60" />
              <div className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded-lg border border-primary/10">
                <label className="text-micro font-black text-primary/60 uppercase tracking-tighter">Route Mode</label>
                <select
                  value={fixedCity}
                  onChange={(e) => setFixedCity(e.target.value as AlbionCity | "Global")}
                  className="bg-transparent text-sm font-black text-white focus:outline-none cursor-pointer uppercase tracking-wider pl-1"
                >
                  <option value="Global" className="bg-slate-900">🌍 Global Routes</option>
                  <option value="Martlock" className="bg-slate-900">Martlock</option>
                  <option value="Bridgewatch" className="bg-slate-900">Bridgewatch</option>
                  <option value="Lymhurst" className="bg-slate-900">Lymhurst</option>
                  <option value="Fort Sterling" className="bg-slate-900">Fort Sterling</option>
                  <option value="Thetford" className="bg-slate-900">Thetford</option>
                  <option value="Caerleon" className="bg-slate-900">Caerleon</option>
                </select>
              </div>
            </div>

            {/* Quick Tier Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedTiers([4, 5, 6, 7, 8])}
                className="text-xs font-black px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-all uppercase tracking-wider"
              >
                All Tiers
              </button>
              <button
                onClick={() => setSelectedTiers([6, 7, 8])}
                className="text-xs font-black px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all uppercase tracking-wider"
              >
                High Tier
              </button>
              <button
                onClick={() => setSelectedTiers([])}
                className="text-xs font-black px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all uppercase tracking-wider"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Row 2: Tier Selection & Power Settings */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
            {/* Tier Buttons */}
            <div className="flex items-center gap-2">
              <label className="text-micro font-black text-primary/60 uppercase tracking-tighter">Item Tiers</label>
              <div className="flex bg-black/30 p-1.5 rounded-lg border border-primary/10 gap-1">
                {[4, 5, 6, 7, 8].map(tier => (
                  <button
                    key={tier}
                    onClick={() => {
                      setSelectedTiers(prev => 
                        prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier]
                      );
                    }}
                    className={`w-9 h-9 rounded-md text-xs font-black transition-all ${
                      selectedTiers.includes(tier) 
                        ? "bg-primary text-black shadow-lg shadow-primary/50" 
                        : "text-primary/50 hover:text-primary/80 border border-white/10"
                    }`}
                  >
                    T{tier}
                  </button>
                ))}
              </div>
            </div>

            {/* Power Settings */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* RRR Display */}
              <div className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded-lg border border-primary/10">
                <div className="text-micro font-black text-primary/60 uppercase tracking-tighter">RRR</div>
                <div className="text-sm font-black text-primary">{rrr.toFixed(1)}%</div>
              </div>

              {/* Focus Toggle */}
              <button
                onClick={() => setRrrConfig(prev => ({ ...prev, focus: !prev.focus }))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition-all uppercase tracking-wider border ${
                  rrrConfig.focus
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/20"
                    : "bg-white/5 text-gray-500 border-white/10 hover:bg-white/8"
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> {rrrConfig.focus ? "Focus On" : "Focus Off"}
              </button>

              {/* Refresh Button */}
              <button
                onClick={() => { clearAllPrices(); scanRecommendations(true); }}
                disabled={loading}
                className="p-2.5 text-primary/60 hover:text-primary hover:bg-primary/10 rounded-lg border border-primary/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS & RECOMMENDATIONS */}
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
                className="group relative glass-panel border border-primary/8 rounded-xl overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/15"
              >
                {/* Accent Bar */}
                <div className="absolute top-0 left-0 w-1 h-full bg-primary/25 group-hover:bg-primary/50 transition-all duration-300" />
                
                <div className="p-4 flex flex-col lg:flex-row items-start lg:items-center gap-4">
                  {/* Item Ident */}
                  <div className="flex items-center gap-3 w-full lg:w-auto shrink-0">
                    <div className="relative">
                      <div className="glass-panel p-2.5 rounded-xl border border-primary/30 bg-primary/10 group-hover:border-primary/60 group-hover:bg-primary/20 transition-all">
                        <img src={rec.icon} alt={rec.itemName} className="w-10 h-10 object-contain group-hover:scale-125 transition-transform duration-500" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 lg:flex-none">
                      <h4 className="text-white font-bold text-sm truncate group-hover:text-primary transition-colors">{rec.itemName}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-micro font-mono text-primary/70 uppercase bg-primary/10 px-1.5 py-0 rounded-sm border border-primary/20">
                          T{rec.itemId.split('_')[0]}
                        </span>
                        <span className="text-micro font-bold text-emerald-400/70 uppercase">Craftable</span>
                      </div>
                    </div>
                  </div>

                  {/* Profit Stats - Compact Grid */}
                  <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-2 w-full">
                    {/* Potential Profit */}
                    <div className="flex flex-col p-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20 group-hover:bg-emerald-500/12 group-hover:border-emerald-500/35 transition-all">
                      <span className="text-micro text-emerald-400/50 font-black uppercase tracking-tighter mb-0.5">Profit</span>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-base font-mono font-black text-emerald-400">+{formatSilver(rec.profit).replace(' Silver', '')}</span>
                      </div>
                    </div>

                    {/* ROI */}
                    <div className="flex flex-col p-2.5 rounded-lg bg-blue-500/8 border border-blue-500/20 group-hover:bg-blue-500/12 group-hover:border-blue-500/35 transition-all">
                      <span className="text-micro text-blue-400/50 font-black uppercase tracking-tighter mb-0.5">ROI</span>
                      <div className="flex items-center gap-1 text-blue-400 font-mono font-black text-sm">
                        <Zap className="w-3 h-3 fill-current" />
                        {rec.roi.toFixed(1)}%
                      </div>
                    </div>

                    {/* Route */}
                    <div className="flex flex-col p-2.5 rounded-lg bg-purple-500/8 border border-purple-500/20 group-hover:bg-purple-500/12 group-hover:border-purple-500/35 transition-all">
                      <span className="text-micro text-purple-400/50 font-black uppercase tracking-tighter mb-0.5">Route</span>
                      {fixedCity === "Global" ? (
                        <div className="flex items-center gap-1 text-purple-300 text-xs font-bold">
                          <span className="text-purple-400">{rec.craftCity}</span>
                          <ArrowRight className="w-2 h-2 text-purple-400/50" />
                          <span className="text-purple-400">{rec.sellCity}</span>
                        </div>
                      ) : (
                        <div className="text-purple-300 text-xs font-bold">{fixedCity}</div>
                      )}
                    </div>

                    {/* Investment */}
                    <div className="flex flex-col p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20 group-hover:bg-amber-500/12 group-hover:border-amber-500/35 transition-all">
                      <span className="text-micro text-amber-400/50 font-black uppercase tracking-tighter mb-0.5">Investment</span>
                      <span className="text-sm font-mono text-amber-300/70 group-hover:text-amber-300 transition-colors">{formatSilver(rec.totalCost)}</span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="shrink-0">
                    <button 
                      onClick={() => handleInjectToCalculator(rec)}
                      className="flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 rounded-lg px-4 py-2 transition-all font-black uppercase text-xs tracking-wider hover:shadow-lg hover:shadow-emerald-500/20"
                    >
                      <Hammer className="w-3.5 h-3.5" /> Analyse
                    </button>
                  </div>
                </div>

                {/* Ingredients Footer with Pricing - Compact */}
                <div className="px-4 pb-3 border-t border-white/5 pt-3">
                   <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-micro font-black text-gray-500/70 uppercase tracking-wider flex items-center gap-1.5">
                          <TrendingUp className="w-2.5 h-2.5 opacity-40" />
                          Sourcing Budget
                        </span>
                        <span className="text-micro font-mono text-amber-400/60">Total: {formatSilver(rec.ingredients.reduce((sum, ing) => sum + (ing.buyPrice * ing.count), 0))}</span>
                      </div>
                      
                      <div className="grid gap-1.5">
                         {rec.ingredients.map(ing => {
                           const itemBudget = ing.buyPrice * ing.count;
                           const budgetPercent = (itemBudget / rec.totalCost) * 100;
                           return (
                            <div key={ing.id} className="relative flex items-center justify-between gap-2 text-xs bg-white/5 px-2.5 py-1.5 rounded-md border border-white/8 hover:border-white/15 hover:bg-white/8 transition-all group/ingredient">
                               <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <span className="font-mono font-bold text-blue-400/80 text-xs">{ing.count}x</span>
                                  <span className="font-bold text-white/70 text-xs truncate">{ing.id.split('_').pop()}</span>
                                  <span className="text-micro bg-white/8 px-1 py-0 rounded border border-white/10 text-white/40 shrink-0 hidden sm:inline">{ing.buyCity}</span>
                               </div>
                               
                               <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right">
                                     <div className="text-micro text-white/40 uppercase tracking-tighter leading-none">Unit</div>
                                     <div className="font-mono text-white/70 text-xs">{(ing.buyPrice / 1000).toFixed(1)}k</div>
                                  </div>
                                  <div className="text-right">
                                     <div className="text-micro text-white/40 uppercase tracking-tighter leading-none">Budget</div>
                                     <div className="font-mono font-bold text-emerald-400/80 text-xs">{(itemBudget / 1000).toFixed(1)}k</div>
                                  </div>
                               </div>
                               
                               {/* Budget Bar */}
                               <div className="absolute left-2.5 right-2.5 bottom-0 h-0.5 bg-white/5 rounded-full">
                                  <div className="h-full bg-linear-to-r from-emerald-500/50 to-emerald-500/20 rounded-full" style={{ width: `${budgetPercent}%` }} />
                               </div>
                            </div>
                           );
                         })}
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








