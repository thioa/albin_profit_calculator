import React, { useState, useEffect, useMemo } from "react";
import { AlbionPrice, AlbionCity, AlbionServer, ItemQuality, AlbionItem } from "../../types/albion";
import { fetchPrices, fetchHistory } from "../../lib/albion-api";
import { calculateProfit, formatSilver, formatTimeAgo, getFreshnessLevel, getProfitPercentage, FreshnessLevel, getQualityName } from "../../lib/economy-utils";
import { HOT_ITEMS } from "../../config/constants";
import itemsDataRaw from "../../data/items-lite.json";
import { processItems } from "../../lib/item-utils";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);
import { Loader2, RefreshCw, Info, Clock, ArrowRight, Zap, TrendingUp, AlertTriangle, ShieldCheck, Star, ShieldAlert } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useWatchlist } from "../../contexts/WatchlistContext";
import { motion } from "motion/react";

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
  server, 
  selectedCities, 
  qualities, 
  maxAgeHours, 
  hideSuspicious,
  allowedStatuses,
  preferredEnchantments,
  selectedCategories,
  selectedSubCategory,
  sortBy
}: MarketOpportunitiesProps) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanIdRef = React.useRef(0);
  const { user, toggleWatchlist } = useAuth();
  const { addNotification } = useWatchlist();

  const itemsMap = useMemo(() => {
    const map: Record<string, AlbionItem> = {};
    itemsData.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, []);

  const scanOpportunities = async () => {
    const currentScanId = ++scanIdRef.current;
    setLoading(true);
    setError(null);
    setDisplayLimit(10); // Reset limit on new scan
    try {
      // Expand HOT_ITEMS with selected enchantments and filter by category
      const itemsToFetch: string[] = [];
      HOT_ITEMS.forEach(baseId => {
        const item = itemsMap[baseId];
        if (!item) return;
        
        if (!selectedCategories.includes("All") && !selectedCategories.includes(item.category)) return;
        if (selectedSubCategory !== "All" && item.subCategory !== selectedSubCategory) return;

        preferredEnchantments.forEach(enchant => {
          const itemId = enchant === 0 ? baseId : `${baseId}@${enchant}`;
          itemsToFetch.push(itemId);
        });
      });

      if (itemsToFetch.length === 0) {
        setOpportunities([]);
        setLoading(false);
        return;
      }

      const data = await fetchPrices(itemsToFetch, selectedCities, qualities, server);
      
      if (currentScanId !== scanIdRef.current) return;

      const results: Opportunity[] = [];
      
      // Group by item
      const grouped = data.reduce((acc, curr) => {
        if (!acc[curr.item_id]) acc[curr.item_id] = [];
        acc[curr.item_id].push(curr);
        return acc;
      }, {} as Record<string, AlbionPrice[]>);

      Object.entries(grouped).forEach(([itemId, prices]) => {
        const item = itemsMap[itemId];
        if (!item) return;

        // Find best buy (min sell price > 0)
        const validBuyPrices = prices.filter(p => p.sell_price_min > 0);
        if (validBuyPrices.length < 2) return;

        validBuyPrices.forEach(buySource => {
          prices.forEach(sellTarget => {
            if (buySource.city === sellTarget.city) return;
            if (buySource.quality !== sellTarget.quality) return;
            if (sellTarget.sell_price_min <= 0) return;

            const profit = calculateProfit(sellTarget.sell_price_min, true, buySource.sell_price_min);
            
            // Check freshness
            const buyFreshness = getFreshnessLevel(buySource.sell_price_min_date);
            const sellFreshness = getFreshnessLevel(sellTarget.sell_price_min_date);
            
            // Determine overall freshness (worst of the two)
            const levels: FreshnessLevel[] = ["excellent", "good", "fair", "stale"];
            const buyIdx = levels.indexOf(buyFreshness);
            const sellIdx = levels.indexOf(sellFreshness);
            const overallFreshness = levels[Math.max(buyIdx, sellIdx)];

            // Filter by maxAgeHours
            const now = new Date();
            const buyAge = (now.getTime() - new Date(buySource.sell_price_min_date).getTime()) / (1000 * 60 * 60);
            const sellAge = (now.getTime() - new Date(sellTarget.sell_price_min_date).getTime()) / (1000 * 60 * 60);
            
            if (maxAgeHours > 0 && (buyAge > maxAgeHours || sellAge > maxAgeHours)) return;

            if (profit.finalProfit > 0) {
              const profitPercent = getProfitPercentage(buySource.sell_price_min, profit.finalProfit);
              
              if (hideSuspicious && profitPercent > 100) return;

              results.push({
                itemId,
                itemName: item.name,
                icon: item.icon,
                quality: buySource.quality,
                buyCity: buySource.city,
                buyPrice: buySource.sell_price_min,
                buyDate: buySource.sell_price_min_date,
                sellCity: sellTarget.city,
                sellPrice: sellTarget.sell_price_min,
                sellDate: sellTarget.sell_price_min_date,
                netProfit: profit.netProfit,
                totalFees: profit.totalFees,
                finalProfit: profit.finalProfit,
                profitPercent,
                freshness: overallFreshness,
              });
            }
          });
        });
      });

      // Sort and take top 100 (larger buffer to find enough verified items)
      // Deduplicate by item and route (keep best quality)
      const deduplicated: Record<string, Opportunity> = {};
      results.forEach(opp => {
        const key = `${opp.itemId}-${opp.buyCity}-${opp.sellCity}`;
        if (!deduplicated[key] || opp.finalProfit > deduplicated[key].finalProfit) {
          deduplicated[key] = opp;
        }
      });

      const topOpportunities = Object.values(deduplicated)
        .sort((a, b) => b.finalProfit - a.finalProfit)
        .slice(0, 30); // Only verify top 30 — enough to fill any display limit

      if (currentScanId !== scanIdRef.current) return;

      // Cache for historical data to avoid redundant API calls
      const historyCache = new Map<string, any>();

      // Second pass: Verify top opportunities with historical data in chunks to avoid 429s
      const verifiedOpportunities: Opportunity[] = [];
      const CHUNK_SIZE = 10; // Increased from 3 → 10 for faster parallel fetching
      
      for (let i = 0; i < topOpportunities.length; i += CHUNK_SIZE) {
        if (currentScanId !== scanIdRef.current) return;
        
        const chunk = topOpportunities.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(chunk.map(async (opp) => {
          try {
            const cacheKey = `${opp.itemId}-${opp.sellCity}`;
            let history = historyCache.get(cacheKey);
            
            if (!history) {
              history = await fetchHistory(opp.itemId, [opp.sellCity], [qualities[0] || 1], server);
              historyCache.set(cacheKey, history);
            }
            
            if (history && history.length > 0 && history[0].data.length > 0) {
              const dataPoints = history[0].data;
              const recentPoints = dataPoints.slice(-72); 
              const avgPrice = recentPoints.reduce((sum, p) => sum + p.avg_price, 0) / recentPoints.length;
              const avgDailyVolume = recentPoints.reduce((sum, p) => sum + p.item_count, 0) / (recentPoints.length / 24 || 1);
              
              let status: 'verified' | 'suspicious' | 'unknown' = 'unknown';
              const diffPercent = Math.abs(opp.sellPrice - avgPrice) / avgPrice;
              
              if (diffPercent < 0.3) {
                status = 'verified';
              } else if (opp.sellPrice > avgPrice * 2 || opp.sellPrice < avgPrice * 0.5) {
                status = 'suspicious';
              }

              return {
                ...opp,
                historicalAvg: avgPrice,
                historicalCount: Math.round(avgDailyVolume),
                verificationStatus: status
              };
            }
          } catch (e) {
            console.error("Verification failed for", opp.itemId, e);
          }
          return { ...opp, verificationStatus: 'unknown' as const };
        }));
        
        verifiedOpportunities.push(...chunkResults);
        
        // Reduced delay between chunks: 300ms is enough to avoid 429s
        if (i + CHUNK_SIZE < topOpportunities.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      if (currentScanId !== scanIdRef.current) return;

      // Final filter and sort
      let finalOpportunities = verifiedOpportunities;
      
      finalOpportunities = finalOpportunities.filter(opp => {
        const status = opp.verificationStatus || 'unknown';
        const isStatusAllowed = allowedStatuses.includes(status);
        
        if (hideSuspicious) {
          // If hideSuspicious is on, we also enforce the ROI check
          return isStatusAllowed && opp.profitPercent <= 100 && status !== 'suspicious';
        }
        
        return isStatusAllowed;
      });

      setOpportunities(finalOpportunities);
      localStorage.setItem("albion_last_scan_time", new Date().toISOString());
      window.dispatchEvent(new Event('albion_market_updated'));
    } catch (err) {
      if (currentScanId === scanIdRef.current) {
        setError("Failed to scan market. Please try again.");
      }
    } finally {
      if (currentScanId === scanIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Small initial delay to avoid hammering API on first page load
    // and to let other concurrent requests settle first
    const timer = setTimeout(() => {
      scanOpportunities();
    }, 1500);
    return () => clearTimeout(timer);
  }, [server, selectedCities, qualities, maxAgeHours, hideSuspicious, allowedStatuses, preferredEnchantments, selectedCategories, selectedSubCategory]);

  const sortedOpportunities = useMemo(() => {
    return [...opportunities].sort((a, b) => {
      switch (sortBy) {
        case 'roi': return b.profitPercent - a.profitPercent;
        case 'freshness': {
          const levels: FreshnessLevel[] = ["excellent", "good", "fair", "stale"];
          return levels.indexOf(a.freshness) - levels.indexOf(b.freshness);
        }
        case 'demand': return (b.historicalCount || 0) - (a.historicalCount || 0);
        case 'profit':
        default: return b.finalProfit - a.finalProfit;
      }
    });
  }, [opportunities, sortBy]);

  const getFreshnessUI = (level: FreshnessLevel) => {
    switch (level) {
      case "excellent": return { 
        color: "text-green-500", 
        label: "Excellent", 
        icon: ShieldCheck,
        description: "Data is less than 1 hour old. Very high accuracy."
      };
      case "good": return { 
        color: "text-blue-500", 
        label: "Good", 
        icon: ShieldCheck,
        description: "Data is less than 6 hours old. Generally reliable."
      };
      case "fair": return { 
        color: "text-yellow-500", 
        label: "Fair", 
        icon: ShieldAlert,
        description: "Data is 6-24 hours old. Market may have shifted."
      };
      case "stale": return { 
        color: "text-red-500", 
        label: "Stale", 
        icon: ShieldAlert,
        description: "Data is over 24 hours old. High risk of inaccuracy."
      };
    }
  };

  return (
    <div className="space-y-4">

      {/* ── ALWAYS-VISIBLE HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tight">Top <span className="text-primary">Flipping</span> Opportunities</h3>
          <p className="text-primary/60 text-sm mt-2">
            Identify price discrepancies between different cities to find profitable flipping opportunities.
          </p>
          <p className="text-primary/30 text-[10px] flex items-center gap-1 mt-1">
            <Info className="w-3 h-3" /> Data provided by Albion Data Project. High profit margins may indicate price errors or low volume.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Stats + Limit Dropdown */}
          <div className="flex items-center gap-2 glass-panel px-4 py-2 rounded-xl border border-primary/10">
            <span className="text-primary/40 text-xs font-bold uppercase tracking-widest">Showing</span>
            <span className="text-white font-black text-sm">
              {Math.min(displayLimit, sortedOpportunities.length)}
            </span>
            <span className="text-primary/30 text-xs">of</span>
            <span className="text-primary font-black text-sm">{sortedOpportunities.length}</span>
            <div className="w-[1px] h-4 bg-primary/10 mx-1" />
            <select
              value={displayLimit}
              onChange={(e) => setDisplayLimit(Number(e.target.value))}
              className="bg-transparent text-primary/60 text-xs font-bold uppercase tracking-widest focus:outline-none cursor-pointer hover:text-primary transition-colors"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <button
            onClick={scanOpportunities}
            disabled={loading}
            className={`flex items-center gap-2 glass-panel px-4 py-2 rounded-xl border border-primary/10 transition-colors ${
              loading ? 'text-primary/30 cursor-not-allowed' : 'text-primary/60 hover:text-white hover:border-primary/40'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-xs font-bold uppercase tracking-widest">{loading ? 'Scanning...' : 'Rescan'}</span>
          </button>
        </div>
      </div>

      {/* ── LOADING SKELETONS ── */}
      {loading && opportunities.length === 0 && (
        <div className="grid grid-cols-1 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-panel border border-primary/10 rounded-xl h-[88px] w-full animate-pulse flex items-center px-5 gap-5">
               <div className="w-10 h-10 rounded-xl bg-white/5 shrink-0" />
               <div className="w-48 space-y-2 shrink-0">
                 <div className="h-3 w-32 bg-white/10 rounded" />
                 <div className="h-2 w-20 bg-white/5 rounded" />
               </div>
               <div className="w-64 space-y-2 shrink-0 border-l border-white/5 pl-4">
                 <div className="h-2 w-3/4 bg-white/10 rounded" />
                 <div className="h-2 w-1/2 bg-white/5 rounded" />
               </div>
               <div className="flex-1 space-y-2 border-l border-white/5 pl-4 flex items-center gap-8">
                 <div className="h-6 w-16 bg-white/5 rounded" />
                 <div className="h-6 w-16 bg-white/5 rounded" />
                 <div className="h-6 w-16 bg-white/5 rounded" />
               </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ERROR STATE ── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 p-8 rounded-3xl text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="text-red-500 font-bold">{error}</p>
          <button onClick={scanOpportunities} className="bg-red-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-600 transition-colors">Retry Scan</button>
        </div>
      )}

      {/* ── RESULTS ── */}
      {!loading && !error && opportunities.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {sortedOpportunities.slice(0, displayLimit).map((opp, idx) => {
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
                    isSuspicious ? "border-red-500/20" : 
                    isVerified ? "border-green-500/20" : "border-primary/10"
                  }`}
                >
                  {/* Left Accent Bar */}
                  <div className={`absolute top-0 left-0 w-1 h-full ${ 
                    isSuspicious ? "bg-red-500" : 
                    isVerified ? "bg-green-500" : "bg-primary/30"
                  }`} />

                  <div className="pl-5 pr-4 py-3 flex flex-row items-center gap-5">

                    {/* ── ITEM ── */}
                    <div className="flex items-center gap-3 w-48 shrink-0">
                      <div className="relative shrink-0">
                        <div className="glass-panel p-2.5 rounded-xl border border-primary/20">
                          <img 
                            src={opp.icon} 
                            alt={opp.itemName} 
                            className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-500" 
                            referrerPolicy="no-referrer" 
                          />
                        </div>
                        {isSuspicious && (
                          <div className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full p-1 border-2 border-[#0d0d0f]">
                            <AlertTriangle className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                        {isVerified && !isSuspicious && (
                          <div className="absolute -top-1.5 -right-1.5 bg-green-500 rounded-full p-1 border-2 border-[#0d0d0f]">
                            <ShieldCheck className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Name + Star on same row */}
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-white font-bold text-xs truncate group-hover:text-primary transition-colors">
                            {opp.itemName}
                          </h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!user) { alert("Please login to watchlist items."); return; }
                              toggleWatchlist(opp.itemId);
                              if (!user.watchlist.includes(opp.itemId)) {
                                addNotification(opp.itemId, opp.itemName, `Added ${opp.itemName} to your watchlist. We'll notify you of price changes!`, 'system');
                              }
                            }}
                            className={`p-1 rounded transition-all shrink-0 ${ 
                              user?.watchlist.includes(opp.itemId) 
                              ? "text-primary" 
                              : "text-primary/20 hover:text-primary"
                            }`}
                          >
                            <Star className={`w-3 h-3 ${user?.watchlist.includes(opp.itemId) ? "fill-current" : ""}`} />
                          </button>
                        </div>
                        {/* Badges */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[8px] font-mono text-primary/40 uppercase bg-white/5 px-1.5 py-0.5 rounded">
                            {getQualityName(opp.quality)}
                          </span>
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${ 
                            isVerified ? "bg-green-500/10 text-green-400" : 
                            isSuspicious ? "bg-red-500/10 text-red-400" : "bg-white/5 text-gray-500"
                          }`}>
                            {opp.verificationStatus || 'unknown'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ── ROUTE ── */}
                    <div className="flex items-center gap-3 w-64 shrink-0 bg-white/[0.03] border border-primary/10 rounded-xl px-4 py-3">
                      {/* Origin */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[8px] text-primary/40 font-black uppercase tracking-widest mb-1">Buy</div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                          <span className="text-white font-bold text-xs truncate">{opp.buyCity}</span>
                        </div>
                        <div className="font-mono text-xs text-primary font-bold mt-0.5">{formatSilver(opp.buyPrice).replace(' Silver','')}</div>
                        <div className="text-[8px] text-primary/30 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />{formatTimeAgo(opp.buyDate)}
                        </div>
                      </div>
                      {/* Arrow */}
                      <ArrowRight className="w-3.5 h-3.5 text-primary/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                      {/* Target */}
                      <div className="flex-1 min-w-0 text-right">
                        <div className="text-[8px] text-primary/40 font-black uppercase tracking-widest mb-1">Sell</div>
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="text-white font-bold text-xs truncate">{opp.sellCity}</span>
                          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        </div>
                        <div className="font-mono text-xs text-primary font-bold mt-0.5">{formatSilver(opp.sellPrice).replace(' Silver','')}</div>
                        <div className="text-[8px] text-primary/30 flex items-center gap-1 justify-end mt-0.5">
                          {formatTimeAgo(opp.sellDate)}<Clock className="w-2.5 h-2.5" />
                        </div>
                      </div>
                    </div>

                    {/* ── METRICS ── */}
                    <div className="flex items-center gap-px flex-1 min-w-0">
                      {/* Market Size */}
                      <div className="flex-1 flex flex-col items-center gap-1 border-r border-white/5 px-4">
                        <span className="text-[8px] text-primary/40 font-black uppercase tracking-widest">Volume</span>
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3 text-blue-400/60" />
                          <span className="text-sm font-mono text-on-surface font-bold">
                            {opp.historicalCount ? opp.historicalCount.toLocaleString() : "—"}
                          </span>
                        </div>
                      </div>
                      {/* Yield */}
                      <div className="flex-1 flex flex-col items-center gap-1 border-r border-white/5 px-4">
                        <span className="text-[8px] text-primary/40 font-black uppercase tracking-widest">ROI</span>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-mono font-black ${isSuspicious ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                          <Zap className="w-3 h-3 fill-current opacity-60" />
                          {opp.profitPercent.toFixed(1)}%
                        </div>
                      </div>
                      {/* Reliability */}
                      <div className="flex-1 flex flex-col items-center gap-1 border-r border-white/5 px-4 group/fresh relative">
                        <span className="text-[8px] text-primary/40 font-black uppercase tracking-widest">Data Age</span>
                        <div className={`flex items-center gap-1.5 cursor-help ${freshnessUI.color}`}>
                          <freshnessUI.icon className="w-3.5 h-3.5" />
                          <span className="text-xs font-black uppercase">{freshnessUI.label}</span>
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-52 p-3 bg-[#0a0a0b] border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/fresh:opacity-100 group-hover/fresh:visible transition-all z-50 pointer-events-none">
                          <p className="text-[10px] text-primary/60 leading-relaxed">{freshnessUI.description}</p>
                        </div>
                      </div>
                      {/* Net Profit */}
                      <div className="flex-1 flex flex-col items-center gap-1 pl-4">
                        <span className="text-[8px] text-primary/40 font-black uppercase tracking-widest">Net Profit</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-mono font-black text-green-400 tracking-tighter">
                            {formatSilver(opp.finalProfit).replace(' Silver', '')}
                          </span>
                          <span className="text-[9px] font-black text-green-700 uppercase">SLV</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </motion.div>
            );
          })}
        </div>
      )}

      {/* ── LOAD MORE ── */}
      {!loading && !error && opportunities.length > displayLimit && (
        <div className="flex justify-center mt-6">
          <button 
            onClick={() => setDisplayLimit(d => d + 20)}
            className="glass-panel px-6 py-3 rounded-xl border border-primary/20 hover:border-primary/50 text-white font-bold tracking-widest uppercase text-xs transition-all hover:bg-primary/10 flex items-center gap-2 group"
          >
            Load More <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
}
