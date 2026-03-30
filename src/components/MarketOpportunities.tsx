import React, { useState, useEffect, useMemo } from "react";
import { AlbionPrice, AlbionCity, AlbionServer, ItemQuality, AlbionItem } from "../types/albion";
import { fetchPrices, fetchHistory } from "../lib/albion-api";
import { calculateProfit, formatSilver, formatTimeAgo, getFreshnessLevel, getProfitPercentage, FreshnessLevel, getQualityName } from "../lib/economy-utils";
import { HOT_ITEMS } from "../constants";
import itemsDataRaw from "../data/items-lite.json";
import { processItems } from "../lib/item-utils";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);
import { Loader2, TrendingUp, ArrowRight, MapPin, RefreshCw, AlertCircle, Clock, ShieldAlert, ShieldCheck, Info, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
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
        .slice(0, 100);

      if (currentScanId !== scanIdRef.current) return;

      // Cache for historical data to avoid redundant API calls
      const historyCache = new Map<string, any>();

      // Second pass: Verify top opportunities with historical data in chunks to avoid 429s
      const verifiedOpportunities: Opportunity[] = [];
      const CHUNK_SIZE = 3;
      
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
              // User wants average order with max past 3 days (72 hours)
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
        
        // Small delay between chunks if we have many items
        if (i + CHUNK_SIZE < topOpportunities.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
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
    scanOpportunities();
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-8 relative overflow-hidden">
        {/* Background Scanning Effect */}
        <div className="absolute inset-0 pointer-events-none opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(#D4AF37_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />
          <motion.div 
            className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"
            animate={{ top: ["0%", "100%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <div className="relative">
          <div className="absolute inset-0 blur-2xl bg-[#D4AF37]/20 rounded-full animate-pulse" />
          <div className="relative bg-[#16161a] p-6 rounded-full border border-[#D4AF37]/30 shadow-[0_0_40px_rgba(212,175,55,0.1)]">
            <RefreshCw className="w-12 h-12 text-[#D4AF37] animate-spin" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <h3 className="text-white font-black uppercase tracking-[0.4em] text-sm animate-pulse flex items-center gap-3">
            <span className="w-2 h-2 bg-[#D4AF37] rounded-full" />
            Scanning <span className="text-[#D4AF37]">Market</span>
            <span className="w-2 h-2 bg-[#D4AF37] rounded-full" />
          </h3>
          <div className="flex flex-col items-center gap-1">
            <div className="h-1 w-48 bg-white/5 rounded-full overflow-hidden relative">
              <motion.div 
                className="absolute inset-0 bg-[#D4AF37]"
                initial={{ left: "-100%" }}
                animate={{ left: "100%" }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <p className="text-gray-600 font-mono text-[9px] uppercase tracking-[0.3em] mt-2">
              Processing global economy nodes...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 p-8 rounded-3xl text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <p className="text-red-500 font-bold">{error}</p>
        <button onClick={scanOpportunities} className="bg-red-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-600 transition-colors">Retry Scan</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">Top <span className="text-[#D4AF37]">Flipping</span> Opportunities</h3>
          <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
            <Info className="w-3 h-3" /> Data provided by Albion Data Project. High profit margins may indicate price errors or low volume.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={scanOpportunities}
            className="flex items-center gap-2 bg-[#1e1e1e] border border-gray-800 px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Rescan</span>
          </button>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div className="bg-[#1e1e1e] border border-gray-800 p-12 rounded-3xl text-center">
          <p className="text-gray-500 italic">No profitable flips found for the current items and cities.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
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
                  className={`group relative bg-[#0d0d0f] border rounded-xl overflow-hidden transition-all duration-700 hover:border-[#D4AF37]/60 min-h-[140px] w-full mx-auto ${
                    isSuspicious ? "border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)]" : 
                    isVerified ? "border-green-500/10 shadow-[0_0_20px_rgba(34,197,94,0.05)]" : "border-white/5"
                  }`}
                >
                  {/* Interactive Hover Shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />

                  {/* Left Accent Bar */}
                  <div className={`absolute top-0 left-0 w-1 h-full transition-all duration-500 group-hover:w-1.5 ${
                    isSuspicious ? "bg-red-500" : 
                    isVerified ? "bg-green-500" : "bg-gray-800"
                  }`} />

                  <div className="p-4 flex flex-col lg:flex-row items-center gap-4 lg:gap-10">
                    {/* Item Section */}
                    <div className="flex items-center gap-5 w-full lg:w-[24%] shrink-0">
                      <div className="relative shrink-0">
                        {/* Dynamic Background Glow */}
                        <div className={`absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-700 ${
                          isSuspicious ? "bg-red-500" : isVerified ? "bg-green-500" : "bg-[#D4AF37]"
                        }`} />
                        
                        <div className="relative bg-[#16161a] p-3 rounded-2xl border border-white/10 shadow-inner group-hover:border-[#D4AF37]/30 transition-colors duration-500">
                          <img 
                            src={opp.icon} 
                            alt={opp.itemName} 
                            className="w-12 h-12 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] group-hover:scale-110 transition-transform duration-700 ease-out" 
                            referrerPolicy="no-referrer" 
                          />
                        </div>
                        
                        {/* Status Badge Overlays */}
                        <div className="absolute -top-2 -right-2 flex flex-col gap-1 scale-90 group-hover:scale-100 transition-transform duration-500">
                          {isSuspicious && (
                            <div className="bg-red-500 rounded-full p-1.5 shadow-lg border-2 border-[#0d0d0f] animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-white" />
                            </div>
                          )}
                          {isVerified && (
                            <div className="bg-green-500 rounded-full p-1.5 shadow-lg border-2 border-[#0d0d0f]">
                              <ShieldCheck className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-white font-black text-sm truncate tracking-tight group-hover:text-[#D4AF37] transition-colors duration-300">
                          {opp.itemName}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-mono text-gray-500 uppercase bg-white/5 px-1.5 py-0.5 rounded">
                            {opp.itemId.split('_').slice(1).join(' ')}
                          </span>
                          <span className="text-[9px] font-bold text-[#D4AF37] uppercase tracking-widest">
                            {getQualityName(opp.quality)}
                          </span>
                        </div>
                        <div className={`text-[8px] font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2 ${
                          isVerified ? "text-green-500" : isSuspicious ? "text-red-500" : "text-gray-600"
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${
                            isVerified ? "bg-green-500" : isSuspicious ? "bg-red-500" : "bg-gray-700"
                          }`} />
                          {opp.verificationStatus || 'unverified'}
                        </div>
                      </div>
                    </div>

                    {/* Route Section - Glassmorphism Style */}
                    <div className="flex items-center justify-between flex-1 min-w-[300px] px-8 py-4 bg-white/[0.03] backdrop-blur-sm rounded-xl border border-white/5 group-hover:bg-white/[0.05] transition-colors duration-500">
                      <div className="flex flex-col gap-2">
                        <span className="text-[8px] text-gray-500 uppercase font-black tracking-[0.25em]">Origin</span>
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                          <span className="text-white font-bold text-sm tracking-tight">{opp.buyCity}</span>
                        </div>
                        <div className="font-mono text-xs text-gray-300 font-bold">
                          {formatSilver(opp.buyPrice)}
                        </div>
                        <div className="text-[10px] text-gray-600 flex items-center gap-2">
                          <Clock className="w-3 h-3" /> {formatTimeAgo(opp.buyDate)}
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center px-6">
                        <div className="relative">
                          <div className="w-20 h-[1px] bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0d0d0f] p-1.5 rounded-full border border-white/5">
                            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-[#D4AF37] group-hover:translate-x-0.5 transition-all duration-500" />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 text-right">
                        <span className="text-[8px] text-gray-500 uppercase font-black tracking-[0.25em]">Target</span>
                        <div className="flex items-center gap-2.5 justify-end">
                          <span className="text-white font-bold text-sm tracking-tight">{opp.sellCity}</span>
                          <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.5)]" />
                        </div>
                        <div className="font-mono text-xs text-gray-300 font-bold">
                          {formatSilver(opp.sellPrice)}
                        </div>
                        <div className="text-[10px] text-gray-600 flex items-center gap-2 justify-end">
                          {formatTimeAgo(opp.sellDate)} <Clock className="w-3 h-3" />
                        </div>
                      </div>
                    </div>

                    {/* Metrics Section */}
                    <div className="flex items-center gap-10 lg:gap-16 shrink-0">
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Market Size</span>
                        <div className="flex items-center gap-2.5">
                          <TrendingUp className="w-3.5 h-3.5 text-blue-500/60" />
                          <span className="text-sm font-mono text-gray-300 font-bold">
                            {opp.historicalCount ? opp.historicalCount.toLocaleString() : "0"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Yield</span>
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 ${isSuspicious ? 'text-red-400' : 'text-blue-400'}`}>
                          <Zap className="w-3.5 h-3.5 fill-current opacity-50" />
                          <span className="text-sm font-mono font-black">{opp.profitPercent.toFixed(1)}%</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 group/fresh relative">
                        <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Reliability</span>
                        <div className={`flex items-center gap-2.5 cursor-help transition-colors duration-300 ${freshnessUI.color}`}>
                          <freshnessUI.icon className="w-4 h-4" />
                          <span className="text-[11px] font-black uppercase tracking-tight">{freshnessUI.label}</span>
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full right-0 mb-4 w-56 p-4 bg-[#0a0a0b] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 invisible group-hover/fresh:opacity-100 group-hover/fresh:visible transition-all duration-300 translate-y-2 group-hover/fresh:translate-y-0 z-50 pointer-events-none">
                          <div className="flex items-center gap-2 mb-2">
                            <freshnessUI.icon className={`w-4 h-4 ${freshnessUI.color}`} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${freshnessUI.color}`}>{freshnessUI.label}</span>
                          </div>
                          <p className="text-[10px] text-gray-400 normal-case leading-relaxed font-medium">
                            {freshnessUI.description}
                          </p>
                          <div className="absolute top-full right-6 border-[6px] border-transparent border-t-[#0a0a0b]"></div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end pl-8 border-l border-white/10">
                        <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest mb-1">Net Profit</span>
                        <div className="relative group/profit">
                          <div className="absolute -inset-2 bg-green-500/10 blur-lg opacity-0 group-hover/profit:opacity-100 transition-opacity duration-500" />
                          <div className="relative flex items-baseline gap-2">
                            <span className="text-2xl font-mono font-black text-green-500 tracking-tighter drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                              {formatSilver(opp.finalProfit).replace(' Silver', '')}
                            </span>
                            <span className="text-[10px] font-black text-green-800 uppercase tracking-widest">SLV</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {opportunities.length > displayLimit && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setDisplayLimit(prev => prev + 10)}
                className="bg-[#1e1e1e] border border-gray-800 px-8 py-3 rounded-xl text-gray-400 hover:text-white hover:border-[#D4AF37] transition-all font-bold uppercase tracking-widest text-xs flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Load More Opportunities
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
