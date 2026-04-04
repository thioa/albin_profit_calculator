import React, { useState, useEffect, useMemo } from "react";
import { AlbionPrice, AlbionCity, AlbionServer, ItemQuality, AlbionItem } from "../../types/albion";
import { fetchPrices, fetchHistory } from "../../lib/albion-api";
import { calculateProfit, formatSilver, formatTimeAgo, getFreshnessLevel, getProfitPercentage, FreshnessLevel, getQualityName } from "../../lib/economy-utils";
import { HOT_ITEMS } from "../../config/constants";
import itemsDataRaw from "../../data/items-lite.json";
import { processItems } from "../../lib/item-utils";
import { Loader2, RefreshCw, Info, Clock, ArrowRight, Zap, TrendingUp, AlertTriangle, ShieldCheck, Star, ShieldAlert } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useWatchlist } from "../../contexts/WatchlistContext";
import { motion } from "motion/react";
import { getOrMarkStale, setPriceCacheBatch, TTL, clearAllPrices } from "../../lib/price-cache";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);

interface Opportunity {
  itemId: string;
  itemName: string;
  icon: string;
  buyCity: string;
  buyPrice: number;
  buyDate: string;
  sellCity: string;
  sellPrice: number;
  sellDate: string;
  netProfit: number;
  totalFees: number;
  finalProfit: number;
  profitPercent: number;
  freshness: FreshnessLevel;
  quality: number;
  historicalAvg?: number;
  historicalCount?: number;
  verificationStatus?: 'verified' | 'suspicious' | 'unknown';
}

export type VerificationStatus = 'verified' | 'suspicious' | 'unknown';
export type SortOption = 'profit' | 'roi' | 'freshness' | 'demand';

interface MarketOpportunitiesProps {
  server: AlbionServer;
  selectedCities: AlbionCity[];
  qualities: ItemQuality[];
  maxAgeHours: number;
  hideSuspicious: boolean;
  allowedStatuses: VerificationStatus[];
  preferredEnchantments: number[];
  selectedCategories: string[];
  selectedSubCategory: string;
  sortBy: SortOption;
}

export default function TopFlipping({
  server, selectedCities, qualities, maxAgeHours,
  hideSuspicious, allowedStatuses, preferredEnchantments,
  selectedCategories, selectedSubCategory, sortBy
}: MarketOpportunitiesProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [displayLimit, setDisplayLimit] = useState(() => {
    const saved = localStorage.getItem("albion_display_limit");
    return saved !== null ? JSON.parse(saved) : 0; // 0 = show all
  });
  const [loading, setLoading] = useState(false);
  const [backgroundScan, setBackgroundScan] = useState(false);
  const [cacheAge, setCacheAge] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scanIdRef = React.useRef(0);
  const { user, toggleWatchlist } = useAuth();
  const { addNotification } = useWatchlist();

  const itemsMap = useMemo(() => {
    const map: Record<string, AlbionItem> = {};
    itemsData.forEach(item => { map[item.id] = item; });
    return map;
  }, []);

  // ─── Build item list from HOT_ITEMS + filters ─────────────────────────────
  const buildItemList = () => {
    const ids: string[] = [];
    HOT_ITEMS.forEach(baseId => {
      const item = itemsMap[baseId];
      if (!item) return;
      if (!selectedCategories.includes("All") && !selectedCategories.includes(item.category)) return;
      if (selectedSubCategory !== "All" && item.subCategory !== selectedSubCategory) return;
      preferredEnchantments.forEach(enchant => {
        ids.push(enchant === 0 ? baseId : `${baseId}@${enchant}`);
      });
    });
    return ids;
  };

  // ─── Core: Convert raw price data → Opportunity[] ──────────────────────────
  const buildOpportunities = (data: any[]): Opportunity[] => {
    const grouped = data.reduce((acc, curr) => {
      if (!acc[curr.item_id]) acc[curr.item_id] = [];
      acc[curr.item_id].push(curr);
      return acc;
    }, {} as Record<string, AlbionPrice[]>);

    const results: Opportunity[] = [];

    Object.entries(grouped).forEach(([itemId, prices]) => {
      const item = itemsMap[itemId];
      if (!item) return;
      const validBuy = (prices as AlbionPrice[]).filter(p => p.sell_price_min > 0);
      if (validBuy.length < 2) return;

      validBuy.forEach(buy => {
        (prices as AlbionPrice[]).forEach(sell => {
          if (buy.city === sell.city || buy.quality !== sell.quality || sell.sell_price_min <= 0) return;
          const profit = calculateProfit(sell.sell_price_min, true, buy.sell_price_min);
          const levels: FreshnessLevel[] = ["excellent", "good", "fair", "stale"];
          const freshness = levels[Math.max(
            levels.indexOf(getFreshnessLevel(buy.sell_price_min_date)),
            levels.indexOf(getFreshnessLevel(sell.sell_price_min_date))
          )];
          const buyAge = (Date.now() - new Date(buy.sell_price_min_date).getTime()) / 3600000;
          const sellAge = (Date.now() - new Date(sell.sell_price_min_date).getTime()) / 3600000;
          if (maxAgeHours > 0 && (buyAge > maxAgeHours || sellAge > maxAgeHours)) return;
          if (profit.finalProfit <= 0) return;
          const profitPercent = getProfitPercentage(buy.sell_price_min, profit.finalProfit);
          if (hideSuspicious && profitPercent > 100) return;
          results.push({
            itemId, itemName: item.name, icon: item.icon, quality: buy.quality,
            buyCity: buy.city, buyPrice: buy.sell_price_min, buyDate: buy.sell_price_min_date,
            sellCity: sell.city, sellPrice: sell.sell_price_min, sellDate: sell.sell_price_min_date,
            netProfit: profit.netProfit, totalFees: profit.totalFees, finalProfit: profit.finalProfit,
            profitPercent, freshness,
          });
        });
      });
    });

    const dedup: Record<string, Opportunity> = {};
    results.forEach(o => {
      const key = `${o.itemId}-${o.buyCity}-${o.sellCity}-${o.quality}`;
      if (!dedup[key] || o.finalProfit > dedup[key].finalProfit) dedup[key] = o;
    });
    console.debug('[TopFlips] buildOpportunities:', {
      rawApiEntries: data.length,
      uniqueItems: Object.keys(grouped).length,
      preDedup: results.length,
      postDedup: Object.values(dedup).length,
      topItems: Object.values(dedup).sort((a, b) => b.finalProfit - a.finalProfit).slice(0, 3).map(o => o.itemName + ' ' + o.finalProfit),
    });
    return Object.values(dedup).sort((a, b) => b.finalProfit - a.finalProfit);
  };

  // ─── Historical verification pass ──────────────────────────────────────────
  const verifyWithHistory = async (opps: Opportunity[], scanId: number): Promise<Opportunity[]> => {
    const top = opps.slice(0, 30);
    const cache = new Map<string, any>();
    const verified: Opportunity[] = [];
    const CHUNK = 10;

    for (let i = 0; i < top.length; i += CHUNK) {
      if (scanId !== scanIdRef.current) return opps; // aborted
      const chunk = top.slice(i, i + CHUNK);
      const results = await Promise.all(chunk.map(async opp => {
        try {
          const key = `${opp.itemId}-${opp.sellCity}`;
          let h = cache.get(key);
          if (!h) {
            h = await fetchHistory(opp.itemId, [opp.sellCity], [qualities[0] || 1], server);
            cache.set(key, h);
          }
          if (h?.length > 0 && h[0].data.length > 0) {
            const pts = h[0].data.slice(-72);
            const avgPrice = pts.reduce((s: number, p: any) => s + p.avg_price, 0) / pts.length;
            const avgVol = pts.reduce((s: number, p: any) => s + p.item_count, 0) / (pts.length / 24 || 1);
            const diff = Math.abs(opp.sellPrice - avgPrice) / avgPrice;
            return {
              ...opp,
              historicalAvg: avgPrice,
              historicalCount: Math.round(avgVol),
              verificationStatus: diff < 0.3 ? 'verified' : (opp.sellPrice > avgPrice * 2 || opp.sellPrice < avgPrice * 0.5) ? 'suspicious' : 'unknown',
            } as Opportunity;
          }
        } catch {}
        return { ...opp, verificationStatus: 'unknown' as const };
      }));
      verified.push(...results);
      if (i + CHUNK < top.length) await new Promise(r => setTimeout(r, 300));
    }
    // append un-verified rest
    verified.push(...opps.slice(30).map(o => ({ ...o, verificationStatus: 'unknown' as const })));
    return verified;
  };

  // ─── Main scan with progressive caching ────────────────────────────────────
  const scanOpportunities = async (forceRefresh = false) => {
    const currentScanId = ++scanIdRef.current;
    setError(null);

    const ids = buildItemList();
    console.log('[TopFlips] scanOpportunities called, ids count:', ids.length, 'forceRefresh:', forceRefresh);
    if (ids.length === 0) { setOpportunities([]); return; }

    // Step 1: Serve from cache instantly (stale-while-revalidate)
    if (!forceRefresh) {
      const { cached, staleIds } = getOrMarkStale(ids, selectedCities as string[], qualities, TTL.TOP_FLIPS);
      if (cached.length > 0) {
        const fromCache = buildOpportunities(cached);
        if (currentScanId === scanIdRef.current && fromCache.length > 0) {
          console.log('[TopFlips] cache hit, setting', fromCache.length, 'opportunities');
          setOpportunities(fromCache);
          setCacheAge(new Date());
        }
        if (staleIds.length === 0) return; // 100% cache hit — done

        // Background-refresh only the stale items
        setBackgroundScan(true);
        try {
          const fresh = await fetchPrices(staleIds, selectedCities, qualities, server);
          if (currentScanId !== scanIdRef.current) return;
          setPriceCacheBatch(fresh);
          const combined = buildOpportunities([...cached.filter(c => !staleIds.includes(c.item_id)), ...fresh]);
          if (combined.length > 0) setOpportunities(combined);
          setCacheAge(new Date());
        } catch { /* keep showing cached */ }
        setBackgroundScan(false);
        return;
      }
    }

    // Step 2: Full fetch — nothing in cache
    setLoading(true);
    try {
      const data = await fetchPrices(ids, selectedCities, qualities, server);
      if (currentScanId !== scanIdRef.current) return;
      setPriceCacheBatch(data);
      setCacheAge(new Date());
      const rawOpps = buildOpportunities(data);
      setOpportunities(rawOpps);
      setLoading(false);

      // Kick off history verification
      const verified = await verifyWithHistory(rawOpps, currentScanId);
      if (currentScanId === scanIdRef.current) {
        const filtered = verified.filter(o => allowedStatuses.includes(o.verificationStatus || 'unknown'));
        setOpportunities(filtered.length > 0 ? filtered : verified);
      }
    } catch (err) {
      if (currentScanId === scanIdRef.current) {
        setError("Failed to fetch opportunities. Please try again.");
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => scanOpportunities(), 1200);
    return () => clearTimeout(timer);
  }, [server, selectedCities, qualities, maxAgeHours, hideSuspicious, allowedStatuses, preferredEnchantments, selectedCategories, selectedSubCategory]);

  // Persist displayLimit
  useEffect(() => {
    localStorage.setItem("albion_display_limit", JSON.stringify(displayLimit));
  }, [displayLimit]);

  // ─── Sort ─────────────────────────────────────────────────────────────────
  const sortedOpportunities = useMemo(() => {
    return [...opportunities].sort((a, b) => {
      switch (sortBy) {
        case 'roi': return b.profitPercent - a.profitPercent;
        case 'freshness': {
          const levels: FreshnessLevel[] = ["excellent", "good", "fair", "stale"];
          return levels.indexOf(a.freshness) - levels.indexOf(b.freshness);
        }
        case 'demand': return (b.historicalCount || 0) - (a.historicalCount || 0);
        default: return b.finalProfit - a.finalProfit;
      }
    });
  }, [opportunities, sortBy]);

  const getFreshnessUI = (level: FreshnessLevel) => {
    switch (level) {
      case "excellent": return { color: "text-green-500", label: "Excellent", icon: ShieldCheck, description: "Data is < 1 hour old. Very high accuracy." };
      case "good":      return { color: "text-blue-500",  label: "Good",      icon: ShieldCheck, description: "Data is < 6 hours old. Generally reliable." };
      case "fair":      return { color: "text-yellow-500",label: "Fair",      icon: ShieldAlert, description: "Data is 6–24 hours old. Market may have shifted." };
      case "stale":     return { color: "text-red-500",   label: "Stale",     icon: ShieldAlert, description: "Data is > 24 hours old. High risk of inaccuracy." };
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-foreground uppercase tracking-tight">
            Top <span className="text-primary">Flipping</span>
          </h3>
          <p className="text-primary/60 text-xs sm:text-sm mt-1">
            Identify price discrepancies between cities for profitable flipping.
          </p>
          {cacheAge && (
            <p className="text-primary/25 text-[10px] flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              {backgroundScan ? "Refreshing stale items..." : `Cached ${Math.round((Date.now() - cacheAge.getTime()) / 60000)}m ago • 15-min TTL`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Background scan indicator */}
          {backgroundScan && (
            <div className="flex items-center gap-1 sm:gap-2 glass-panel px-2 sm:px-3 py-1 sm:py-2 rounded-lg sm:rounded-xl border border-primary/10">
              <RefreshCw className="w-3 h-3.5 text-primary animate-spin" />
              <span className="text-[10px] sm:text-[10px] font-black text-primary/50 uppercase tracking-widest hidden sm:inline">Updating...</span>
            </div>
          )}

          {/* Showing count */}
          <div className="flex items-center gap-1 sm:gap-2 glass-panel px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border border-primary/10">
            <span className="text-primary/40 text-[10px] sm:text-xs font-bold uppercase tracking-widest hidden sm:inline">Showing</span>
            <span className="text-foreground font-black text-xs sm:text-sm">{displayLimit === 0 ? sortedOpportunities.length : Math.min(displayLimit, sortedOpportunities.length)}</span>
            <span className="text-primary/30 text-[10px] sm:text-xs hidden sm:inline">of</span>
            <span className="text-primary font-black text-xs sm:text-sm">{sortedOpportunities.length}</span>
            <div className="w-px h-3 sm:h-4 bg-primary/10 mx-1 hidden sm:block" />
            <select value={displayLimit} onChange={e => setDisplayLimit(Number(e.target.value))}
              className="bg-transparent text-primary/60 text-[10px] sm:text-xs font-bold uppercase tracking-widest focus:outline-none cursor-pointer hover:text-primary transition-colors">
              <option value={0}>All</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <button onClick={() => { clearAllPrices(); scanOpportunities(true); }} disabled={loading}
            className={`flex items-center gap-1 sm:gap-2 glass-panel px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border border-primary/10 transition-colors ${loading ? 'text-primary/30 cursor-not-allowed' : 'text-primary/60 hover:text-white hover:border-primary/40'}`}>
            <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">{loading ? 'Scan' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && opportunities.length === 0 && (
        <div className="grid grid-cols-1 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-panel border border-primary/10 rounded-xl animate-pulse">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:w-48 sm:shrink-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-muted/50 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-24 sm:w-32 bg-muted/50 rounded" />
                    <div className="h-2 w-16 sm:w-20 bg-muted/30 rounded" />
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-3 sm:flex items-center gap-2 sm:gap-4 sm:border-l sm:border-border sm:pl-4">
                  <div className="h-5 sm:h-6 bg-muted/30 rounded" />
                  <div className="h-5 sm:h-6 bg-muted/30 rounded" />
                  <div className="h-5 sm:h-6 bg-muted/30 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 p-8 rounded-3xl text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="text-red-500 font-bold">{error}</p>
          <Button variant="destructive" onClick={() => scanOpportunities(true)}>Retry Scan</Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && opportunities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 glass-panel rounded-3xl border border-dashed border-primary/10 space-y-4">
          {/* TODO: Replace with actual Top Flips illustration - recommended size: 150x150px */}
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' rx='15' fill='%23151a21'/%3E%3Cpath d='M40 100 L70 60 L100 80 L130 40' stroke='%23f59e0b' stroke-width='4' fill='none' stroke-linecap='round'/%3E%3Cpolygon points='75,55 85,75 65,65' fill='%23f59e0b'/%3E%3C/svg%3E"
            alt="Top Flips illustration"
            className="w-32 h-32 opacity-60"
          />
          <p className="text-foreground font-bold">Scanning for opportunities...</p>
          <p className="text-primary/40 text-sm">Please wait while we analyze the market.</p>
        </div>
      )}

      {/* Results */}
      {!loading && !error && opportunities.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {(displayLimit === 0 ? sortedOpportunities : sortedOpportunities.slice(0, displayLimit)).map((opp, idx) => {
            const freshnessUI = getFreshnessUI(opp.freshness);
            const isSuspicious = opp.profitPercent > 100 || opp.verificationStatus === 'suspicious';
            const isVerified = opp.verificationStatus === 'verified';

            return (
              <motion.div
                key={`${opp.itemId}-${opp.quality}-${opp.buyCity}-${opp.sellCity}-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`group relative glass-panel border border-white/10 rounded-xl overflow-hidden transition-all duration-300 hover:border-primary/30 ${
                  isSuspicious ? "border-red-500/30" : isVerified ? "border-green-500/30" : ""
                }`}
              >
                {/* Desktop: Single row layout */}
                <div className="hidden lg:flex items-stretch gap-0">
                  {/* Status indicator */}
                  <div className={`w-1 shrink-0 ${isSuspicious ? "bg-red-500" : isVerified ? "bg-green-500" : "bg-primary/30"}`} />

                  {/* Icon */}
                  <div className="flex items-center pl-4 pr-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-muted/30 border border-border overflow-hidden">
                        <img src={opp.icon} alt={opp.itemName} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                      </div>
                      {isSuspicious && <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1 border-2 border-[#0d0d0f]"><AlertTriangle className="w-2.5 h-2.5 text-white" /></div>}
                      {isVerified && !isSuspicious && <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-[#0d0d0f]"><ShieldCheck className="w-2.5 h-2.5 text-white" /></div>}
                    </div>
                  </div>

                  {/* Item info */}
                  <div className="flex flex-col justify-center min-w-0 px-4 border-r border-white/5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-foreground font-bold text-sm truncate group-hover:text-primary transition-colors">{opp.itemName}</h4>
                      <button onClick={e => { e.stopPropagation(); if (!user) { alert("Please login to watchlist items."); return; } toggleWatchlist(opp.itemId); if (!user.watchlist.includes(opp.itemId)) addNotification(opp.itemId, opp.itemName, `Added ${opp.itemName} to your watchlist.`, 'system'); }}
                        className={`p-1 rounded transition-all ${user?.watchlist.includes(opp.itemId) ? "text-primary" : "text-primary/20 hover:text-primary"}`}>
                        <Star className={`w-4 h-4 ${user?.watchlist.includes(opp.itemId) ? "fill-current" : ""}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-primary/60 font-medium">{getQualityName(opp.quality)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSuspicious ? 'bg-red-500/10 text-red-400 border border-red-500/30' : isVerified ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-muted/30 text-muted-foreground border border-border'}`}>
                        {opp.verificationStatus || 'unknown'}
                      </span>
                    </div>
                  </div>

                  {/* Route */}
                  <div className="flex items-center px-6 border-r border-white/5 gap-4">
                    <div className="text-center min-w-20">
                      <span className="text-[10px] text-primary/50 font-semibold uppercase tracking-wider block mb-2">Buy</span>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="text-xs font-bold text-foreground">{opp.buyCity}</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-primary">{formatSilver(opp.buyPrice)}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary/30 shrink-0 mt-4" />
                    <div className="text-center min-w-20">
                      <span className="text-[10px] text-primary/50 font-semibold uppercase tracking-wider block mb-2">Sell</span>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className="text-xs font-bold text-foreground">{opp.sellCity}</span>
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                      <span className="text-sm font-mono font-bold text-primary">{formatSilver(opp.sellPrice)}</span>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex items-stretch flex-1 gap-0">
                    <div className="flex-1 flex flex-col items-center justify-center px-3 border-r border-white/5">
                      <span className="text-[10px] text-primary/50 font-semibold uppercase tracking-wider mb-2">Volume</span>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs font-bold text-foreground">{opp.historicalCount ? opp.historicalCount.toLocaleString() : '—'}</span>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center px-3 border-r border-white/5">
                      <span className="text-[10px] text-primary/50 font-semibold uppercase tracking-wider mb-2">ROI</span>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isSuspicious ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        <Zap className="w-3.5 h-3.5 fill-current opacity-70" />
                        <span className="text-xs font-bold">{opp.profitPercent.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center px-3 border-r border-white/5">
                      <span className="text-[10px] text-primary/50 font-semibold uppercase tracking-wider mb-2">Age</span>
                      <div className={`flex items-center gap-1 ${freshnessUI.color}`}>
                        <freshnessUI.icon className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold uppercase">{freshnessUI.label}</span>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center px-3">
                      <span className="text-[10px] text-primary/50 font-semibold uppercase tracking-wider mb-2">Profit</span>
                      <span className="text-lg font-mono font-black text-green-400">{formatSilver(opp.finalProfit)}</span>
                    </div>
                  </div>
                </div>

                {/* Mobile/Tablet: Compact stacked layout */}
                <div className="lg:hidden p-4">
                  {/* Row 1: Item info */}
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-xl bg-muted/30 border border-border overflow-hidden">
                        <img src={opp.icon} alt={opp.itemName} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                      </div>
                      {isSuspicious && <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 border-2 border-[#0d0d0f]"><AlertTriangle className="w-2 h-2 text-white" /></div>}
                      {isVerified && !isSuspicious && <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5 border-2 border-[#0d0d0f]"><ShieldCheck className="w-2 h-2 text-white" /></div>}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-foreground font-bold truncate group-hover:text-primary transition-colors">{opp.itemName}</h4>
                        <button onClick={e => { e.stopPropagation(); if (!user) { alert("Please login to watchlist items."); return; } toggleWatchlist(opp.itemId); }}
                          className={`p-1 rounded transition-all shrink-0 ${user?.watchlist.includes(opp.itemId) ? "text-primary" : "text-primary/20 hover:text-primary"}`}>
                          <Star className={`w-3 h-3 ${user?.watchlist.includes(opp.itemId) ? "fill-current" : ""}`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-primary/60 font-medium">{getQualityName(opp.quality)}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isSuspicious ? 'bg-red-500/10 text-red-400' : isVerified ? 'bg-green-500/10 text-green-400' : 'bg-muted/30 text-muted-foreground'}`}>
                          {opp.verificationStatus || 'unknown'}
                        </span>
                      </div>
                    </div>

                    {/* Profit */}
                    <div className="text-right shrink-0">
                      <span className="text-lg font-mono font-black text-green-400">{formatSilver(opp.finalProfit).replace(' Silver', '')}</span>
                    </div>
                  </div>

                  {/* Row 2: Route */}
                  <div className="flex items-center gap-3 mt-3 p-3 bg-muted/30 rounded-xl">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="text-xs text-foreground/70">{opp.buyCity}</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-primary">{formatSilver(opp.buyPrice).replace(' Silver', '')}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary/40" />
                    <div className="flex-1 text-right">
                      <div className="flex items-center justify-end gap-1.5 mb-1">
                        <span className="text-xs text-foreground/70">{opp.sellCity}</span>
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                      <span className="text-sm font-mono font-bold text-primary">{formatSilver(opp.sellPrice).replace(' Silver', '')}</span>
                    </div>
                  </div>

                  {/* Row 3: Metrics */}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="flex flex-col items-center p-2 bg-muted/30 rounded-xl">
                      <span className="text-[10px] text-primary/50 font-semibold uppercase tracking-wider">ROI</span>
                      <div className={`flex items-center gap-1 mt-1 ${isSuspicious ? 'text-red-400' : 'text-blue-400'}`}>
                        <Zap className="w-3 h-3 fill-current opacity-70" />
                        <span className="text-xs font-bold">{opp.profitPercent.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-muted/30 rounded-xl">
                      <span className="text-[10px] text-primary/50 font-semibold uppercase tracking-wider">Volume</span>
                      <span className="text-xs font-bold text-foreground mt-1">{opp.historicalCount ? opp.historicalCount.toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-muted/30 rounded-xl">
                      <span className="text-[10px] text-primary/50 font-semibold uppercase tracking-wider">Age</span>
                      <div className={`flex items-center gap-1 mt-1 ${freshnessUI.color}`}>
                        <freshnessUI.icon className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase">{freshnessUI.label}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Load More */}
      {!loading && !error && displayLimit > 0 && opportunities.length > displayLimit && (
        <div className="flex justify-center mt-6">
          <button onClick={() => setDisplayLimit(d => d + 20)}
            className="glass-panel px-6 py-3 rounded-xl border border-primary/20 hover:border-primary/50 text-foreground font-bold tracking-widest uppercase text-xs transition-all hover:bg-primary/10 flex items-center gap-2 group">
            Load More <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
}
