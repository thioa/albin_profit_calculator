import React, { useState, useEffect, useMemo } from "react";
import { AlbionPrice, AlbionCity, AlbionServer, ItemQuality, AlbionItem } from "../../types/albion";
import { fetchPrices, fetchHistory } from "../../lib/albion-api";
import { calculateProfit, formatSilver, formatTimeAgo, getFreshnessLevel, getProfitPercentage, FreshnessLevel, getQualityName } from "../../lib/economy-utils";
import { HOT_ITEMS } from "../../config/constants";
import itemsDataRaw from "../../data/items-lite.json";
import { processItems } from "../../lib/item-utils";
import { Loader2, RefreshCw, Info, Clock, ArrowRight, Zap, AlertTriangle, ShieldCheck, Star, ShieldAlert, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
  historicalCount?: number; // 24h volume at sell city
  demandLevel?: 'hot' | 'warm' | 'cold'; // high/medium/low demand
  verificationStatus?: 'verified' | 'suspicious' | 'unknown';
}

export type VerificationStatus = 'verified' | 'suspicious' | 'unknown';
export type SortOption = 'profit' | 'roi' | 'freshness' | 'demand';
export type ColumnSort = 'name' | 'buyCity' | 'sellCity' | 'volume' | 'roi' | 'age' | 'profit';

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
  const [columnSort, setColumnSort] = useState<ColumnSort>('profit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterBuyCity, setFilterBuyCity] = useState<string>('');
  const [filterSellCity, setFilterSellCity] = useState<string>('');

  const handleSort = (col: ColumnSort) => {
    if (columnSort === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setColumnSort(col);
      setSortDir(['name', 'buyCity', 'sellCity'].includes(col) ? 'asc' : 'desc');
    }
  };
  const [loading, setLoading] = useState(false);
  const [backgroundScan, setBackgroundScan] = useState(false);
  const [cacheAge, setCacheAge] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scanIdRef = React.useRef(0);
  const dataGenRef = React.useRef(0); // increments each scan; stale verifyHistory results are discarded
  const { user, toggleWatchlist } = useAuth();
  const { addNotification } = useWatchlist();

  const itemsMap = useMemo(() => {
    const map: Record<string, AlbionItem> = {};
    itemsData.forEach(item => { map[item.id] = item; });
    return map;
  }, []);

  // â”€â”€â”€ Build item list from HOT_ITEMS + filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ Core: Convert raw price data â†’ Opportunity[] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ Historical verification pass â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const verifyWithHistory = async (opps: Opportunity[], scanId: number): Promise<Opportunity[]> => {
    console.log('[Demand] verifyWithHistory START, opps count:', opps.length, 'scanId:', scanId, 'currentScanIdRef:', scanIdRef.current);
    const top = opps.slice(0, 30);
    console.log('[Demand] processing top', top.length, 'opportunities');
    const cache = new Map<string, any>();
    const verified: Opportunity[] = [];
    const CHUNK = 10;

    for (let i = 0; i < top.length; i += CHUNK) {
      // scanId === -1 means "never abort" (used by the dedicated useEffect)
      if (scanId !== -1 && scanId !== scanIdRef.current) {
        console.log('[Demand] ABORTED â€” scanId mismatch', scanId, '!=', scanIdRef.current);
        return opps;
      }
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
            const allPts = h[0].data;

            // Auto-detect data resolution: figure out how many data points per day
            // by looking at timestamp gaps in the first few points
            const ptsPerDay = (() => {
              if (allPts.length < 2) return 1;
              const first = new Date(allPts[0]?.timestamp).getTime();
              const second = new Date(allPts[1]?.timestamp).getTime();
              if (!first || !second || second === first) return 1;
              const hoursDiff = (second - first) / 3600000;
              return Math.max(1, Math.round(24 / hoursDiff));
            })();

            const estimatedDays = Math.max(allPts.length / ptsPerDay, 1);
            const avgDailyVol = allPts.reduce((s: number, p: any) => s + p.item_count, 0) / estimatedDays;
            const avgPrice = allPts.reduce((s: number, p: any) => s + p.avg_price, 0) / allPts.length;

            // Take the last "ptsPerDay" points as "last 24h" to match actual resolution
            const lastN = Math.min(ptsPerDay, allPts.length);
            const last24h = allPts.slice(-lastN);
            const vol24h = last24h.reduce((s: number, p: any) => s + p.item_count, 0);

            // Demand: compare last 24h vs average daily volume
            let demandLevel: 'hot' | 'warm' | 'cold' = 'cold';
            if (avgDailyVol < 1) {
              demandLevel = 'warm'; // sparse â€” don't penalize
            } else if (vol24h >= avgDailyVol * 1.5) {
              demandLevel = 'hot';
            } else if (vol24h >= avgDailyVol * 0.5) {
              demandLevel = 'warm';
            }

            const diff = Math.abs(opp.sellPrice - avgPrice) / avgPrice;
            console.log(`[Demand] ${opp.itemName} @ ${opp.sellCity}: vol24h=${vol24h}, avgDaily=${avgDailyVol.toFixed(0)}, level=${demandLevel}, pts=${allPts.length}, ptsPerDay=${ptsPerDay}`);
            return {
              ...opp,
              historicalAvg: avgPrice,
              historicalCount: Math.round(vol24h),
              demandLevel,
              verificationStatus: diff < 0.3 ? 'verified' : (opp.sellPrice > avgPrice * 2 || opp.sellPrice < avgPrice * 0.5) ? 'suspicious' : 'unknown',
            } as Opportunity;
          } else {
            console.log(`[Demand] NO DATA for ${opp.itemName} @ ${opp.sellCity}: h=`, h);
          }
        } catch (e) {
          console.log(`[Demand] ERROR for ${opp.itemName}:`, e);
        }
        return { ...opp, verificationStatus: 'unknown' as const };
      }));
      verified.push(...results);
      if (i + CHUNK < top.length) await new Promise(r => setTimeout(r, 300));
    }
    // append un-verified rest
    verified.push(...opps.slice(30).map(o => ({ ...o, verificationStatus: 'unknown' as const })));
    console.log('[Demand] DONE, verified count:', verified.length);
    return verified;
  };

  // â”€â”€â”€ Main scan with progressive caching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        if (staleIds.length === 0) return; // 100% cache hit â€” verifyHistory effect handles the rest

        // Background-refresh only the stale items
        setBackgroundScan(true);
        try {
          const fresh = await fetchPrices(staleIds, selectedCities, qualities, server);
          if (currentScanId !== scanIdRef.current) return;
          setPriceCacheBatch(fresh);
          const combined = buildOpportunities([...cached.filter(c => !staleIds.includes(c.item_id)), ...fresh]);
          if (combined.length > 0) setOpportunities(combined);
          setCacheAge(new Date());
        } catch { /* keep showing cached */ } finally {
          setBackgroundScan(false);
        }
        return;
      }
    }

    // Step 2: Full fetch â€” nothing in cache
    setLoading(true);
    try {
      const data = await fetchPrices(ids, selectedCities, qualities, server);
      if (currentScanId !== scanIdRef.current) return;
      setPriceCacheBatch(data);
      setCacheAge(new Date());
      const rawOpps = buildOpportunities(data);
      setOpportunities(rawOpps);
      setLoading(false);
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

  // â”€â”€â”€ Dedicated effect: fetch history independently (decoupled from scan) â”€â”€â”€
  useEffect(() => {
    if (opportunities.length === 0) return;

    const myGen = ++dataGenRef.current;
    let cancelled = false;
    let mounted = true;

    const run = async () => {
      // Small delay to let the UI render first
      await new Promise(r => setTimeout(r, 800));
      if (cancelled || !mounted) return;

      console.log('[Demand] effect START, gen:', myGen, 'opps:', opportunities.length);
      const verified = await verifyWithHistory(opportunities, -1); // -1 = never aborts from scanId
      if (!mounted || cancelled) return;

      // Discard if a newer scan has since updated opportunities
      if (myGen !== dataGenRef.current) {
        console.log('[Demand] effect DISCARDED, stale gen', myGen, 'vs current', dataGenRef.current);
        return;
      }

      const filtered = verified.filter(o => allowedStatuses.includes(o.verificationStatus || 'unknown'));
      setOpportunities(filtered.length > 0 ? filtered : verified);
      console.log('[Demand] effect DONE, verified:', verified.length, 'gen:', myGen);
    };

    run();
    return () => { cancelled = true; mounted = false; };
  }, [opportunities.length]);

  // Persist displayLimit
  useEffect(() => {
    localStorage.setItem("albion_display_limit", JSON.stringify(displayLimit));
  }, [displayLimit]);

  // â”€â”€â”€ Unique cities for dropdown filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const uniqueBuyCities = useMemo(() => [...new Set(opportunities.map(o => o.buyCity))].sort(), [opportunities]);
  const uniqueSellCities = useMemo(() => [...new Set(opportunities.map(o => o.sellCity))].sort(), [opportunities]);

  // â”€â”€â”€ Sort + Filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sortedOpportunities = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...opportunities].sort((a, b) => {
      switch (columnSort) {
        case 'name':    return dir * a.itemName.localeCompare(b.itemName);
        case 'buyCity': return dir * a.buyCity.localeCompare(b.buyCity);
        case 'sellCity':return dir * a.sellCity.localeCompare(b.sellCity);
        case 'volume':  return dir * ((a.historicalCount || 0) - (b.historicalCount || 0));
        case 'roi':     return dir * (a.profitPercent - b.profitPercent);
        case 'age': {
          const levels: FreshnessLevel[] = ["excellent", "good", "fair", "stale"];
          return dir * (levels.indexOf(a.freshness) - levels.indexOf(b.freshness));
        }
        case 'profit':  return dir * (a.finalProfit - b.finalProfit);
        default:        return dir * (a.finalProfit - b.finalProfit);
      }
    });
  }, [opportunities, columnSort, sortDir]);

  const filteredOpportunities = useMemo(() => {
    return sortedOpportunities.filter(o => {
      if (filterBuyCity && o.buyCity !== filterBuyCity) return false;
      if (filterSellCity && o.sellCity !== filterSellCity) return false;
      return true;
    });
  }, [sortedOpportunities, filterBuyCity, filterSellCity]);

  const getFreshnessUI = (level: FreshnessLevel) => {
    switch (level) {
      case "excellent": return { color: "text-green-500", label: "Excellent", icon: ShieldCheck, description: "Data is < 1 hour old. Very high accuracy." };
      case "good":      return { color: "text-blue-500",  label: "Good",      icon: ShieldCheck, description: "Data is < 6 hours old. Generally reliable." };
      case "fair":      return { color: "text-yellow-500",label: "Fair",      icon: ShieldAlert, description: "Data is 6â€“24 hours old. Market may have shifted." };
      case "stale":     return { color: "text-red-500",   label: "Stale",     icon: ShieldAlert, description: "Data is > 24 hours old. High risk of inaccuracy." };
    }
  };

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            <p className="text-primary/25 text-label flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              {backgroundScan ? "Refreshing stale items..." : `Cached ${Math.round((Date.now() - cacheAge.getTime()) / 60000)}m ago â€¢ 15-min TTL`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Background scan indicator */}
          {backgroundScan && (
            <div className="flex items-center gap-1 sm:gap-2 glass-panel px-2 sm:px-3 py-1 sm:py-2 rounded-lg sm:rounded-xl border border-primary/10">
              <RefreshCw className="w-3 h-3.5 text-primary animate-spin" />
              <span className="text-label sm:text-label font-black text-primary/75 uppercase tracking-widest hidden sm:inline">Updating...</span>
            </div>
          )}

          {/* Showing count */}
          <div className="flex items-center gap-1 sm:gap-2 glass-panel px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border border-primary/10">
            <span className="text-primary/70 text-label sm:text-xs font-bold uppercase tracking-widest hidden sm:inline">Showing</span>
            <span className="text-foreground font-black text-xs sm:text-sm">{displayLimit === 0 ? filteredOpportunities.length : Math.min(displayLimit, filteredOpportunities.length)}</span>
            <span className="text-primary/30 text-label sm:text-xs hidden sm:inline">of</span>
            <span className="text-primary font-black text-xs sm:text-sm">{filteredOpportunities.length}</span>
            <div className="w-px h-3 sm:h-4 bg-primary/10 mx-1 hidden sm:block" />
            <select value={displayLimit} onChange={e => setDisplayLimit(Number(e.target.value))}
              className="bg-transparent text-primary/60 text-label sm:text-xs font-bold uppercase tracking-widest focus:outline-none cursor-pointer hover:text-primary transition-colors border border-transparent hover:border-primary/20 rounded px-1 py-0.5">
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
            <span className="text-label sm:text-xs font-bold uppercase tracking-widest">{loading ? 'Scan' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* â”€â”€â”€ Sort Bar Header (desktop) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="hidden lg:flex items-stretch glass-panel border border-white/10 rounded-xl overflow-hidden min-h-10">
        {/* Status strip placeholder */}
        <div className="w-1 shrink-0 bg-primary/10" />
        {/* Icon placeholder */}
        <div className="w-14.5 shrink-0" />

        {/* Name */}
        <div className="flex-3 flex items-center border-r border-white/5 px-2">
          {(() => { const a = columnSort==='name'; const I = a?(sortDir==='desc'?ArrowDown:ArrowUp):ArrowUpDown; return (
            <button onClick={()=>handleSort('name')} className={`flex items-center gap-1 text-label font-bold uppercase tracking-widest transition-colors ${a?'text-primary':'text-primary/30 hover:text-primary/70'}`}>
              Name <I className="w-3 h-3" />
            </button>
          ); })()}
        </div>

        {/* Buy City */}
        <div className="flex-2 flex items-center gap-2 border-r border-white/5 px-2">
          {(() => { const a = columnSort==='buyCity'; const I = a?(sortDir==='desc'?ArrowDown:ArrowUp):ArrowUpDown; return (
            <button onClick={()=>handleSort('buyCity')} className={`flex items-center gap-1 text-label font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${a?'text-primary':'text-primary/30 hover:text-primary/70'}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              Buy <I className="w-3 h-3" />
            </button>
          ); })()}
          <select value={filterBuyCity} onChange={e=>setFilterBuyCity(e.target.value)}
            className={`text-tiny font-bold uppercase tracking-widest bg-transparent focus:outline-none cursor-pointer border rounded px-1 py-0.5 transition-colors max-w-17.5 ${ filterBuyCity ? 'text-primary border-primary/40 bg-primary/5' : 'text-primary/60 border-primary/20 hover:text-primary/90' }`}>
            <option value="">All</option>
            {uniqueBuyCities.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Arrow spacer */}
        <div className="w-7 shrink-0" />

        {/* Sell City */}
        <div className="flex-2 flex items-center gap-2 border-r border-white/5 px-2">
          {(() => { const a = columnSort==='sellCity'; const I = a?(sortDir==='desc'?ArrowDown:ArrowUp):ArrowUpDown; return (
            <button onClick={()=>handleSort('sellCity')} className={`flex items-center gap-1 text-label font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${a?'text-primary':'text-primary/30 hover:text-primary/70'}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              Sell <I className="w-3 h-3" />
            </button>
          ); })()}
          <select value={filterSellCity} onChange={e=>setFilterSellCity(e.target.value)}
            className={`text-tiny font-bold uppercase tracking-widest bg-transparent focus:outline-none cursor-pointer border rounded px-1 py-0.5 transition-colors max-w-17.5 ${ filterSellCity ? 'text-primary border-primary/40 bg-primary/5' : 'text-primary/60 border-primary/20 hover:text-primary/90' }`}>
            <option value="">All</option>
            {uniqueSellCities.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Volume */}
        <div className="flex-1 flex items-center justify-center border-r border-white/5">
          {(() => { const a = columnSort==='volume'; const I = a?(sortDir==='desc'?ArrowDown:ArrowUp):ArrowUpDown; return (
            <button onClick={()=>handleSort('volume')} className={`flex items-center gap-1 text-label font-bold uppercase tracking-widest transition-colors ${a?'text-primary':'text-primary/30 hover:text-primary/70'}`}>
              Volume <I className="w-3 h-3" />
            </button>
          ); })()}
        </div>

        {/* ROI */}
        <div className="flex-1 flex items-center justify-center border-r border-white/5">
          {(() => { const a = columnSort==='roi'; const I = a?(sortDir==='desc'?ArrowDown:ArrowUp):ArrowUpDown; return (
            <button onClick={()=>handleSort('roi')} className={`flex items-center gap-1 text-label font-bold uppercase tracking-widest transition-colors ${a?'text-primary':'text-primary/30 hover:text-primary/70'}`}>
              ROI <I className="w-3 h-3" />
            </button>
          ); })()}
        </div>

        {/* Age */}
        <div className="flex-1 flex items-center justify-center border-r border-white/5">
          {(() => { const a = columnSort==='age'; const I = a?(sortDir==='desc'?ArrowDown:ArrowUp):ArrowUpDown; return (
            <button onClick={()=>handleSort('age')} className={`flex items-center gap-1 text-label font-bold uppercase tracking-widest transition-colors ${a?'text-primary':'text-primary/30 hover:text-primary/70'}`}>
              Age <I className="w-3 h-3" />
            </button>
          ); })()}
        </div>

        {/* Profit */}
        <div className="flex-[1.5] flex items-center justify-center">
          {(() => { const a = columnSort==='profit'; const I = a?(sortDir==='desc'?ArrowDown:ArrowUp):ArrowUpDown; return (
            <button onClick={()=>handleSort('profit')} className={`flex items-center gap-1 text-label font-bold uppercase tracking-widest transition-colors ${a?'text-primary':'text-primary/30 hover:text-primary/70'}`}>
              Profit <I className="w-3 h-3" />
            </button>
          ); })()}
        </div>
      </div>

      {/* Mobile sort bar */}
      <div className="flex lg:hidden flex-wrap items-center gap-1.5 px-1">
        <span className="text-label text-primary/30 font-bold uppercase tracking-widest mr-1 shrink-0">Sort</span>
        {(['name','buyCity','sellCity','volume','roi','age','profit'] as ColumnSort[]).map(key => {
          const label = { name:'Name', buyCity:'Buy', sellCity:'Sell', volume:'Vol', roi:'ROI', age:'Age', profit:'Profit' }[key];
          const isActive = columnSort === key;
          const Icon = isActive ? (sortDir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown;
          return (
            <button key={key} onClick={() => handleSort(key)}
              className={`flex items-center gap-0.5 px-2 py-0.5 rounded-md text-label font-bold uppercase tracking-wider transition-all duration-200 border ${ isActive ? 'bg-primary text-black border-primary' : 'border-white/10 text-primary/70 hover:text-primary' }`}>
              {label}<Icon className="w-2.5 h-2.5" />
            </button>
          );
        })}
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
          <p className="text-primary/70 text-sm">Please wait while we analyze the market.</p>
        </div>
      )}

      {/* Results */}
      {!loading && !error && opportunities.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {(displayLimit === 0 ? filteredOpportunities : filteredOpportunities.slice(0, displayLimit)).map((opp, idx) => {
            const freshnessUI = getFreshnessUI(opp.freshness);
            const isSuspicious = opp.profitPercent > 100 || opp.verificationStatus === 'suspicious';
            const isVerified = opp.verificationStatus === 'verified';

            return (
              <motion.div
                key={`${opp.itemId}-${opp.quality}-${opp.buyCity}-${opp.sellCity}-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`group relative glass-panel border border-white/10 rounded-xl transition-all duration-300 hover:border-primary/30 ${
                  isSuspicious ? "border-red-500/30" : isVerified ? "border-green-500/30" : ""
                }`}
              >
                {/* Desktop: Full-width flex row â€” matches sort bar flex proportions exactly */}
                <div className="hidden lg:flex items-stretch w-full min-h-15.5">

                  {/* Status strip */}
                  <div className={`w-1 shrink-0 ${isSuspicious ? 'bg-red-500' : isVerified ? 'bg-green-500' : 'bg-primary/30'}`} />

                  {/* Icon (w-14.5) */}
                  <div className="w-14.5 shrink-0 flex items-center pl-2 pr-1">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-lg bg-muted/30 border border-border overflow-hidden shrink-0">
                        <img src={opp.icon} alt={opp.itemName} className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                      </div>
                      {isSuspicious && <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 border-2 border-[#0d0d0f]"><AlertTriangle className="w-2 h-2 text-white" /></div>}
                      {isVerified && !isSuspicious && <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5 border-2 border-[#0d0d0f]"><ShieldCheck className="w-2 h-2 text-white" /></div>}
                    </div>
                  </div>

                  {/* Name (flex-3) */}
                  <div className="flex-3 flex flex-col justify-center min-w-0 px-3 border-r border-white/5">
                    {/* CSS Tooltip wrapper */}
                    <div className="relative group/tooltip min-w-0">
                      <h4 className="text-foreground font-bold text-sm truncate group-hover:text-primary transition-colors">
                        {opp.itemName}
                      </h4>
                      {/* Tooltip popup */}
                      <div className="absolute bottom-full left-0 mb-2 z-999 pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150">
                        <div className="bg-[#0a0e14] border border-primary/30 rounded-lg px-3 py-2 shadow-2xl whitespace-nowrap">
                          <span className="text-xs text-foreground font-semibold">{opp.itemName}</span>
                          <div className="absolute top-full left-4 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-primary/30" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-label text-primary/75 font-medium">{getQualityName(opp.quality)}</span>
                      <span className={`text-tiny font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isSuspicious ? 'bg-red-500/10 text-red-400 border border-red-500/30' : isVerified ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-muted/30 text-muted-foreground border border-border'}`}>
                        {opp.verificationStatus || 'unknown'}
                      </span>
                      <button onClick={e => { e.stopPropagation(); if (!user) { alert('Please login.'); return; } toggleWatchlist(opp.itemId); if (!user.watchlist.includes(opp.itemId)) addNotification(opp.itemId, opp.itemName, `Added ${opp.itemName} to your watchlist.`, 'system'); }}
                        className={`p-0.5 shrink-0 rounded transition-all ml-auto ${user?.watchlist.includes(opp.itemId) ? 'text-primary' : 'text-primary/20 hover:text-primary'}`}>
                        <Star className={`w-3 h-3 ${user?.watchlist.includes(opp.itemId) ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Buy (flex-2) */}
                  <div className="flex-2 flex flex-col items-center justify-center border-r border-white/5 px-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      <span className="text-xs font-bold text-foreground">{opp.buyCity}</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-primary tabular-nums">{formatSilver(opp.buyPrice)}</span>
                    <span className="text-label text-primary/35 font-mono mt-0.5">{formatTimeAgo(opp.buyDate)}</span>
                  </div>

                  {/* Arrow (w-7) */}
                  <div className="w-7 shrink-0 flex items-center justify-center">
                    <ArrowRight className="w-3.5 h-3.5 text-primary/30" />
                  </div>

                  {/* Sell (flex-2) */}
                  <div className="flex-2 flex flex-col items-center justify-center border-r border-white/5 px-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-bold text-foreground">{opp.sellCity}</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    </div>
                    <span className="text-sm font-mono font-bold text-primary tabular-nums">{formatSilver(opp.sellPrice)}</span>
                    <span className="text-label text-primary/35 font-mono mt-0.5">{formatTimeAgo(opp.sellDate)}</span>
                  </div>

                  {/* Volume (flex-1) */}
                  <div className="flex-1 flex flex-col items-center justify-center border-r border-white/5 gap-0.5 py-1.5">
                    <div className="flex items-center gap-1">
                      {opp.demandLevel === 'hot' ? (
                        <span className="text-label font-black text-red-400 bg-red-500/10 border border-red-500/30 px-1 py-0.5 rounded uppercase tracking-wider">Hot</span>
                      ) : opp.demandLevel === 'warm' ? (
                        <span className="text-label font-black text-orange-400 bg-orange-500/10 border border-orange-500/30 px-1 py-0.5 rounded uppercase tracking-wider">Warm</span>
                      ) : (
                        <span className="text-label font-black text-primary/30 bg-muted/30 border border-white/10 px-1 py-0.5 rounded uppercase tracking-wider">Cold</span>
                      )}
                    </div>
                    <span className="text-label font-mono font-bold text-primary/60 tabular-nums">{opp.historicalCount ? opp.historicalCount.toLocaleString() : '-'}<span className="text-primary/30"> /24h</span></span>
                  </div>

                  {/* ROI (flex-1) */}
                  <div className="flex-1 flex items-center justify-center border-r border-white/5">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isSuspicious ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                      <Zap className="w-3.5 h-3.5 fill-current opacity-70 shrink-0" />
                      <span className="text-xs font-bold tabular-nums">{opp.profitPercent.toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Age (flex-1) */}
                  <div className="flex-1 flex items-center justify-center border-r border-white/5">
                    <div className={`flex items-center gap-1 ${freshnessUI.color}`}>
                      <freshnessUI.icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-sm font-bold uppercase">{freshnessUI.label}</span>
                    </div>
                  </div>

                  {/* Profit (flex-[1.5]) */}
                  <div className="flex-[1.5] flex items-center justify-center pr-3">
                    <span className="text-base font-mono font-black text-green-400 tabular-nums">{formatSilver(opp.finalProfit)}</span>
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
                        <h4 title={opp.itemName} className="text-foreground font-bold truncate group-hover:text-primary transition-colors">{opp.itemName}</h4>
                        <button onClick={e => { e.stopPropagation(); if (!user) { alert("Please login to watchlist items."); return; } toggleWatchlist(opp.itemId); }}
                          className={`p-1 rounded transition-all shrink-0 ${user?.watchlist.includes(opp.itemId) ? "text-primary" : "text-primary/20 hover:text-primary"}`}>
                          <Star className={`w-3 h-3 ${user?.watchlist.includes(opp.itemId) ? "fill-current" : ""}`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-primary/60 font-medium">{getQualityName(opp.quality)}</span>
                        <span className={`text-label font-bold px-1.5 py-0.5 rounded-full ${isSuspicious ? 'bg-red-500/10 text-red-400' : isVerified ? 'bg-green-500/10 text-green-400' : 'bg-muted/30 text-muted-foreground'}`}>
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
                      <span className="text-label text-primary/35 font-mono block mt-0.5">{formatTimeAgo(opp.buyDate)}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary/70" />
                    <div className="flex-1 text-right">
                      <div className="flex items-center justify-end gap-1.5 mb-1">
                        <span className="text-xs text-foreground/70">{opp.sellCity}</span>
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                      <span className="text-sm font-mono font-bold text-primary">{formatSilver(opp.sellPrice).replace(' Silver', '')}</span>
                      <span className="text-label text-primary/35 font-mono block mt-0.5">{formatTimeAgo(opp.sellDate)}</span>
                    </div>
                  </div>

                  {/* Row 3: Metrics */}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="flex flex-col items-center p-2 bg-muted/30 rounded-xl">
                      <span className="text-label text-primary/75 font-semibold uppercase tracking-wider">ROI</span>
                      <div className={`flex items-center gap-1 mt-1 ${isSuspicious ? 'text-red-400' : 'text-blue-400'}`}>
                        <Zap className="w-3 h-3 fill-current opacity-70" />
                        <span className="text-xs font-bold">{opp.profitPercent.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-muted/30 rounded-xl">
                      <span className="text-label text-primary/75 font-semibold uppercase tracking-wider">Demand</span>
                      <div className="flex items-center gap-1 mt-1">
                        {opp.demandLevel === 'hot' ? (
                          <span className="text-label font-black text-red-400">Hot</span>
                        ) : opp.demandLevel === 'warm' ? (
                          <span className="text-label font-black text-orange-400">Warm</span>
                        ) : (
                          <span className="text-label font-black text-primary/30">Cold</span>
                        )}
                      </div>
                      <span className="text-label font-mono text-primary/60 mt-0.5">{opp.historicalCount ? opp.historicalCount.toLocaleString() : '-'}/24h</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-muted/30 rounded-xl">
                      <span className="text-label text-primary/75 font-semibold uppercase tracking-wider">Age</span>
                      <div className={`flex items-center gap-1 mt-1 ${freshnessUI.color}`}>
                        <freshnessUI.icon className="w-3 h-3" />
                        <span className="text-label font-bold uppercase">{freshnessUI.label}</span>
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
      {!loading && !error && displayLimit > 0 && filteredOpportunities.length > displayLimit && (
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








