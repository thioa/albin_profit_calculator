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
import { Badge, Label, Mono } from "../ui";

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

export default function MarketOpportunities({
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tight">
            Top <span className="text-primary">Flipping</span> Opportunities
          </h3>
          <p className="text-primary/60 text-sm mt-1">
            Identify price discrepancies between cities for profitable flipping.
          </p>
          {cacheAge && (
            <p className="text-primary/25 text-[10px] flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              {backgroundScan ? "Refreshing stale items in background..." : `Cached ${Math.round((Date.now() - cacheAge.getTime()) / 60000)}m ago • 15-min TTL`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Background scan indicator */}
          {backgroundScan && (
            <div className="flex items-center gap-2 glass-panel px-3 py-2 rounded-xl border border-primary/10">
              <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
              <span className="text-[10px] font-black text-primary/50 uppercase tracking-widest">Updating...</span>
            </div>
          )}

          {/* Showing count */}
          <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-xl border border-primary/10">
            <span className="text-primary/40 text-xs font-bold uppercase tracking-widest">Showing</span>
            <span className="text-white font-black text-sm">{displayLimit === 0 ? sortedOpportunities.length : Math.min(displayLimit, sortedOpportunities.length)}</span>
            <span className="text-primary/30 text-xs">of</span>
            <span className="text-primary font-black text-sm">{sortedOpportunities.length}</span>
            <div className="w-px h-4 bg-primary/10 mx-1" />
            <select value={displayLimit} onChange={e => setDisplayLimit(Number(e.target.value))}
              className="bg-transparent text-primary/60 text-xs font-bold uppercase tracking-widest focus:outline-none cursor-pointer hover:text-primary transition-colors">
              <option value={0}>All</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <button onClick={() => { clearAllPrices(); scanOpportunities(true); }} disabled={loading}
            className={`flex items-center gap-2 glass-panel px-4 py-2 rounded-xl border border-primary/10 transition-colors ${loading ? 'text-primary/30 cursor-not-allowed' : 'text-primary/60 hover:text-white hover:border-primary/40'}`}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-xs font-bold uppercase tracking-widest">{loading ? 'Scanning...' : 'Force Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && opportunities.length === 0 && (
        <div className="grid grid-cols-1 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-panel border border-primary/10 rounded-xl h-[88px] w-full animate-pulse flex items-center px-5 gap-5">
              <div className="w-10 h-10 rounded-xl bg-white/5 shrink-0" />
              <div className="w-48 space-y-2 shrink-0">
                <div className="h-3 w-32 bg-white/10 rounded" />
                <div className="h-2 w-20 bg-white/5 rounded" />
              </div>
              <div className="flex-1 space-y-2 border-l border-white/5 pl-4 flex items-center gap-8">
                <div className="h-6 w-16 bg-white/5 rounded" />
                <div className="h-6 w-16 bg-white/5 rounded" />
                <div className="h-6 w-20 bg-white/5 rounded" />
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
          <button onClick={() => scanOpportunities(true)} className="bg-red-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-600 transition-colors">Retry Scan</button>
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
                className={`group relative glass-panel border rounded-xl overflow-hidden transition-all duration-500 hover:border-primary/40 w-full ${
                  isSuspicious ? "border-red-500/20" : isVerified ? "border-green-500/20" : "border-primary/10"
                }`}
              >
                <div className={`absolute top-0 left-0 w-1 h-full ${isSuspicious ? "bg-red-500" : isVerified ? "bg-green-500" : "bg-primary/30"}`} />

                <div className="pl-5 pr-4 py-3 flex flex-row items-center gap-5">
                  {/* Item */}
                  <div className="flex items-center gap-3 w-48 shrink-0">
                    <div className="relative shrink-0">
                      <div className="glass-panel p-2.5 rounded-xl border border-primary/20">
                        <img src={opp.icon} alt={opp.itemName} className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                      </div>
                      {isSuspicious && <div className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full p-1 border-2 border-[#0d0d0f]"><AlertTriangle className="w-2.5 h-2.5 text-white" /></div>}
                      {isVerified && !isSuspicious && <div className="absolute -top-1.5 -right-1.5 bg-green-500 rounded-full p-1 border-2 border-[#0d0d0f]"><ShieldCheck className="w-2.5 h-2.5 text-white" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-white font-bold text-xs truncate group-hover:text-primary transition-colors">{opp.itemName}</h4>
                        <button onClick={e => { e.stopPropagation(); if (!user) { alert("Please login to watchlist items."); return; } toggleWatchlist(opp.itemId); if (!user.watchlist.includes(opp.itemId)) addNotification(opp.itemId, opp.itemName, `Added ${opp.itemName} to your watchlist.`, 'system'); }}
                          className={`p-1 rounded transition-all shrink-0 ${user?.watchlist.includes(opp.itemId) ? "text-primary" : "text-primary/20 hover:text-primary"}`}>
                          <Star className={`w-3 h-3 ${user?.watchlist.includes(opp.itemId) ? "fill-current" : ""}`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="subtle" size="sm">{getQualityName(opp.quality)}</Badge>
                        <Badge
                          variant={isVerified ? 'success' : isSuspicious ? 'error' : 'default'}
                          size="sm"
                          dot={!isVerified && !isSuspicious}
                          pulse={isSuspicious}
                        >
                          {opp.verificationStatus || 'unknown'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Route */}
                  <div className="flex items-center gap-3 w-64 shrink-0 bg-white/[0.03] border border-primary/10 rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <Label size="sm" color="primary" className="mb-1 block">Buy</Label>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-info shrink-0" /><span className="text-white font-bold text-sm truncate">{opp.buyCity}</span></div>
                      <Mono size="sm" weight="bold" className="text-primary mt-1">{formatSilver(opp.buyPrice).replace(' Silver', '')}</Mono>
                      <div className="text-xs text-primary/40 flex items-center gap-1.5 mt-1"><Clock className="w-3 h-3" />{formatTimeAgo(opp.buyDate)}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    <div className="flex-1 min-w-0 text-right">
                      <Label size="sm" color="primary" className="mb-1 block">Sell</Label>
                      <div className="flex items-center gap-2 justify-end"><span className="text-white font-bold text-sm truncate">{opp.sellCity}</span><div className="w-2 h-2 rounded-full bg-primary shrink-0" /></div>
                      <Mono size="sm" weight="bold" className="text-primary mt-1">{formatSilver(opp.sellPrice).replace(' Silver', '')}</Mono>
                      <div className="text-xs text-primary/40 flex items-center gap-1.5 justify-end mt-1">{formatTimeAgo(opp.sellDate)}<Clock className="w-3 h-3" /></div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center gap-px flex-1 min-w-0">
                    <div className="flex-1 flex flex-col items-center gap-1.5 border-r border-white/5 px-4">
                      <Label size="sm" color="primary">Volume</Label>
                      <div className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-info/60" /><span className="text-sm font-mono text-white font-bold">{opp.historicalCount ? opp.historicalCount.toLocaleString() : "—"}</span></div>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-1.5 border-r border-white/5 px-4">
                      <Label size="sm" color="primary">ROI</Label>
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-bold ${isSuspicious ? 'bg-error/10 text-error' : 'bg-info/10 text-info'}`}>
                        <Zap className="w-4 h-4 fill-current opacity-70" />{opp.profitPercent.toFixed(1)}%
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-1.5 border-r border-white/5 px-4 group/fresh relative">
                      <Label size="sm" color="primary">Data Age</Label>
                      <div className={`flex items-center gap-1.5 cursor-help ${freshnessUI.color}`}>
                        <freshnessUI.icon className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">{freshnessUI.label}</span>
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-52 p-3 bg-surface border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/fresh:opacity-100 group-hover/fresh:visible transition-all z-50 pointer-events-none">
                        <p className="text-xs text-primary/60">{freshnessUI.description}</p>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-1.5 pl-4">
                      <Label size="sm" color="primary">Net Profit</Label>
                      <div className="flex items-baseline gap-1.5">
                        <Mono size="2xl" weight="black" className="text-success">{formatSilver(opp.finalProfit).replace(' Silver', '')}</Mono>
                        <span className="text-xs font-bold text-success/70 uppercase">SLV</span>
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
            className="glass-panel px-6 py-3 rounded-xl border border-primary/20 hover:border-primary/50 text-white font-bold tracking-widest uppercase text-xs transition-all hover:bg-primary/10 flex items-center gap-2 group">
            Load More <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
}
