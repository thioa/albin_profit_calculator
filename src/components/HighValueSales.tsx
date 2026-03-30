import { useState, useEffect, useMemo } from "react";
import { AlbionItem, AlbionHistory, AlbionServer, ALBION_CITIES } from "../types/albion";
import { fetchHistory } from "../lib/albion-api";
import { formatSilver } from "../lib/economy-utils";
import { Loader2, TrendingUp, Clock, DollarSign, Package, MapPin, ChevronRight, Filter, Search, ArrowUpRight, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import itemsDataRaw from "../data/items-lite.json";
import { processItems } from "../lib/item-utils";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);

interface HighValueItem {
  item: AlbionItem;
  totalVolume: number;
  totalValue: number;
  avgPrice: number;
  lastSold: string;
  topCity: string;
  history: {
    timestamp: string;
    count: number;
    price: number;
  }[];
}

export default function HighValueSales({ server }: { server: AlbionServer }) {
  const [items, setItems] = useState<HighValueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [timeRange, setTimeRange] = useState<12 | 24>(12);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"volume" | "value" | "price">("value");

  // Curated list of high-value items to monitor
  const highValueBaseIds = useMemo(() => {
    return itemsData
      .filter(item => {
        const isHighTier = item.tier >= 6;
        const isArtifact = item.id.includes("_ARTIFACT_") || item.id.includes("_LEVEL");
        const isMount = item.id.includes("_MOUNT_");
        // Broaden the filter to include T6+ artifacts and mounts
        return (item.tier >= 7) || (item.tier >= 6 && isArtifact) || isMount;
      })
      .slice(0, 60) // Increase to 60 items for better coverage
      .map(item => item.id);
  }, []);

  const fetchData = async () => {
    if (loading) return;
    setLoading(true);
    setLoadingProgress(0);
    try {
      const results: HighValueItem[] = [];
      const now = new Date();
      const cutoff = new Date(now.getTime() - timeRange * 60 * 60 * 1000);

      const BATCH_SIZE = 6;
      for (let i = 0; i < highValueBaseIds.length; i += BATCH_SIZE) {
        setLoadingProgress(Math.round((i / highValueBaseIds.length) * 100));
        const batch = highValueBaseIds.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (id) => {
            try {
              // Fetch history for all qualities to get better volume data
              const history = await fetchHistory(id, [...ALBION_CITIES], [1, 2, 3, 4, 5], server);
              if (!history || history.length === 0) return null;

              const item = itemsData.find(it => it.id === id);
              if (!item) return null;

              const allData = history.flatMap(h => h.data.map(d => ({ ...d, location: h.location })));
              const recentData = allData.filter(d => new Date(d.timestamp) >= cutoff);
              
              if (recentData.length === 0) return null;

              const totalVolume = recentData.reduce((sum, d) => sum + d.item_count, 0);
              const totalValue = recentData.reduce((sum, d) => sum + (d.item_count * d.avg_price), 0);
              const avgPrice = totalValue / totalVolume;
              
              const cityVolumes: Record<string, number> = {};
              recentData.forEach(d => {
                cityVolumes[d.location] = (cityVolumes[d.location] || 0) + d.item_count;
              });
              const topCity = Object.entries(cityVolumes).sort((a, b) => b[1] - a[1])[0][0];
              const lastSold = recentData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp;

              return {
                item,
                totalVolume,
                totalValue,
                avgPrice,
                lastSold,
                topCity,
                history: recentData.map(d => ({
                  timestamp: d.timestamp,
                  count: d.item_count,
                  price: d.avg_price
                }))
              };
            } catch (e) {
              return null;
            }
          })
        );
        
        batchResults.forEach(res => {
          if (res) results.push(res);
        });

        if (i + BATCH_SIZE < highValueBaseIds.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      setItems(results);
      setLoadingProgress(100);
    } catch (error) {
      console.error("Error fetching high value sales:", error);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange, server]);

  const filteredAndSortedItems = useMemo(() => {
    return items
      .filter(item => 
        item.item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === "volume") return b.totalVolume - a.totalVolume;
        if (sortBy === "value") return b.totalValue - a.totalValue;
        if (sortBy === "price") return b.avgPrice - a.avgPrice;
        return 0;
      });
  }, [items, searchTerm, sortBy]);

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-[#121214] p-6 rounded-2xl border border-white/5">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-[#D4AF37]" />
            High Value Sales
          </h2>
          <p className="text-gray-500 text-sm font-medium">
            Monitoring the most valuable market movements in the last {timeRange} hours.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Refresh Button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className={`p-2 rounded-xl border border-white/5 bg-black/40 text-gray-400 hover:text-[#D4AF37] transition-all ${loading ? 'animate-spin opacity-50' : ''}`}
          >
            <Clock className="w-4 h-4" />
          </button>

          {/* Time Range Toggle */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
            {[12, 24].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as 12 | 24)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  timeRange === range 
                  ? "bg-[#D4AF37] text-black shadow-lg" 
                  : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {range}H
              </button>
            ))}
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
            <Filter className="w-3 h-3 text-gray-600 ml-2" />
            {[
              { id: 'value', label: 'Total Value' },
              { id: 'volume', label: 'Volume' },
              { id: 'price', label: 'Avg Price' }
            ].map((sort) => (
              <button
                key={sort.id}
                onClick={() => setSortBy(sort.id as any)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  sortBy === sort.id 
                  ? "bg-white/10 text-white" 
                  : "text-gray-600 hover:text-gray-400"
                }`}
              >
                {sort.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 group-focus-within:text-[#D4AF37] transition-colors" />
            <input 
              type="text"
              placeholder="Filter items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-black/40 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-gray-700 focus:outline-none focus:border-[#D4AF37]/50 transition-all w-48"
            />
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {loading ? (
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
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
                {loadingProgress}%
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <h3 className="text-white font-black uppercase tracking-[0.4em] text-sm animate-pulse flex items-center gap-3">
              <span className="w-2 h-2 bg-[#D4AF37] rounded-full" />
              Analyzing <span className="text-[#D4AF37]">High Value</span>
              <span className="w-2 h-2 bg-[#D4AF37] rounded-full" />
            </h3>
            <div className="flex flex-col items-center gap-1">
              <div className="h-1 w-48 bg-white/5 rounded-full overflow-hidden relative">
                <motion.div 
                  className="absolute inset-0 bg-[#D4AF37]"
                  initial={{ width: 0 }}
                  animate={{ width: `${loadingProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="text-gray-600 font-mono text-[9px] uppercase tracking-[0.3em] mt-2">
                Processing historical data nodes...
              </p>
            </div>
          </div>
        </div>
      ) : filteredAndSortedItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredAndSortedItems.map((data, idx) => (
              <motion.div
                key={data.item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group relative bg-[#0d0d0f] border border-white/5 rounded-xl overflow-hidden hover:border-[#D4AF37]/40 transition-all duration-500"
              >
                {/* Shimmer Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />

                <div className="p-4 flex flex-col lg:flex-row items-center gap-6">
                  {/* Rank & Item */}
                  <div className="flex items-center gap-6 w-full lg:w-[30%] shrink-0">
                    <div className="text-2xl font-black text-white/5 font-mono italic w-8">
                      {(idx + 1).toString().padStart(2, '0')}
                    </div>
                    
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-[#D4AF37] rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-700" />
                      <div className="relative bg-[#16161a] p-3 rounded-2xl border border-white/10 shadow-inner">
                        <img 
                          src={data.item.icon} 
                          alt={data.item.name} 
                          className="w-12 h-12 object-contain group-hover:scale-110 transition-transform duration-700" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-white font-black text-sm truncate tracking-tight group-hover:text-[#D4AF37] transition-colors">
                        {data.item.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-mono text-gray-500 uppercase bg-white/5 px-1.5 py-0.5 rounded">
                          {data.item.id.split('_').slice(1).join(' ')}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          data.item.tier >= 8 ? "bg-purple-500/10 text-purple-400" :
                          data.item.tier >= 7 ? "bg-blue-500/10 text-blue-400" : "bg-gray-500/10 text-gray-400"
                        }`}>
                          Tier {data.item.tier}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Market Details */}
                  <div className="flex items-center justify-between flex-1 w-full px-6 py-4 bg-white/[0.02] rounded-xl border border-white/5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Top Market</span>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-[#D4AF37]" />
                        <span className="text-white font-bold text-xs">{data.topCity}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Avg Unit Price</span>
                      <div className="text-white font-mono text-xs font-bold">
                        {formatSilver(data.avgPrice)}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Last Activity</span>
                      <div className="flex items-center gap-1.5 text-gray-400 text-[10px] font-medium">
                        <Clock className="w-3 h-3" />
                        {new Date(data.lastSold).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="flex items-center gap-8 lg:gap-12 shrink-0">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Total Volume</span>
                      <div className="flex items-center gap-2">
                        <Package className="w-3 h-3 text-blue-500/60" />
                        <span className="text-xs font-mono text-gray-300 font-bold">
                          {data.totalVolume.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end pl-8 border-l border-white/10">
                      <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest mb-1">Trade Value</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-mono font-black text-[#D4AF37] tracking-tighter">
                          {formatSilver(data.totalValue).replace(' Silver', '')}
                        </span>
                        <span className="text-[10px] font-black text-[#D4AF37]/40 uppercase tracking-widest">SLV</span>
                      </div>
                    </div>

                    <div className="pl-4">
                      <button className="p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-[#D4AF37] hover:text-black transition-all group/btn">
                        <ArrowUpRight className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-[#121214] rounded-2xl border border-dashed border-white/5">
          <div className="p-4 bg-white/5 rounded-full">
            <TrendingUp className="w-8 h-8 text-gray-700" />
          </div>
          <div className="text-center">
            <p className="text-white font-bold">No high-value sales detected</p>
            <p className="text-gray-500 text-xs mt-1">Try expanding the time range or checking back later.</p>
          </div>
        </div>
      )}
    </div>
  );
}
