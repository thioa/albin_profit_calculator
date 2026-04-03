import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AlbionItem, AlbionServer, ALBION_CITIES } from "../../types/albion";
import { fetchHistory } from "../../lib/albion-api";
import { formatSilver } from "../../lib/economy-utils";
import {
  getCached, getAllCached, setCachedBatch, getStaleIds, clearAll,
  calculateTrend, PulseCacheEntry
} from "../../lib/market-pulse-cache";
import {
  TrendingUp, TrendingDown, Minus, Flame, RefreshCw, Filter,
  Package, ArrowUpRight, Search, Zap, Clock, BarChart2,
  ChevronRight, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import itemsDataRaw from "../../data/items-lite.json";
import { processItems } from "../../lib/item-utils";
import { Badge, Label, Mono } from "../ui";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);

const CATEGORIES = ["All", "Weapons", "Armor", "Off-Hand", "Accessories", "Mounts", "Bags", "Capes", "Resources", "Food", "Potions"];
const TIERS = ["All", "T4", "T5", "T6", "T7", "T8"];

const TREND_CONFIG = {
  surging: { label: "Surging", icon: Flame, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  rising: { label: "Rising", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  stable: { label: "Stable", icon: Minus, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  cooling: { label: "Cooling", icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  unknown: { label: "Unknown", icon: Minus, color: "text-primary/30", bg: "bg-white/5", border: "border-white/5" },
};

const BATCH_SIZE = 5;
const BATCH_DELAY = 350;

function buildTargetItems(category: string, tier: string): { id: string; item: AlbionItem }[] {
  return itemsData
    .filter(item => {
      if (category !== "All") {
        if (category === "Mounts" && item.category !== "Mounts") return false;
        if (category !== "Mounts" && item.category !== category) return false;
      }
      if (tier !== "All") {
        const tierNum = parseInt(tier.replace("T", ""));
        if (item.tier !== tierNum) return false;
      }
      return true;
    })
    .slice(0, 2000) // Cap at 2000 items
    .map(item => ({ id: item.id, item }));
}

export default function HighValueSales({ server, onTradeItem }: { server: AlbionServer; onTradeItem?: (item: AlbionItem) => void }) {
  const [entries, setEntries] = useState<PulseCacheEntry[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [tier, setTier] = useState("All");
  const [sortBy, setSortBy] = useState<"volume" | "demand" | "price" | "trend">("demand");
  const [timeRange, setTimeRange] = useState<24 | 48>(24);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const scanAbortRef = useRef(false);

  // Load from cache instantly on mount
  useEffect(() => {
    const cached = getAllCached();
    if (cached.length > 0) {
      setEntries(cached);
      setLastUpdated(new Date(Math.max(...cached.map(e => e.cachedAt))));
    }
  }, []);

  const runScan = useCallback(async (forceRefresh = false) => {
    scanAbortRef.current = false;
    const targets = buildTargetItems(category, tier);
    const toScan = forceRefresh ? targets : targets.filter(t => getStaleIds([t.id]).length > 0);

    if (toScan.length === 0) {
      setEntries(getAllCached());
      return;
    }

    setScanning(true);
    setProgress({ current: 0, total: toScan.length });

    const newEntries: PulseCacheEntry[] = [];
    const now = new Date();
    const cutoff = new Date(now.getTime() - timeRange * 60 * 60 * 1000);

    for (let i = 0; i < toScan.length; i += BATCH_SIZE) {
      if (scanAbortRef.current) break;

      const batch = toScan.slice(i, i + BATCH_SIZE);
      const batchIds = batch.map(b => b.id).join(",");

      try {
        const history = await fetchHistory(batchIds, [...ALBION_CITIES], [1, 2, 3, 4, 5], server);

        batch.forEach(target => {
          const itemHistory = history.filter((h: any) => h.item_id === target.id);
          if (itemHistory.length === 0) return;

          const allData = itemHistory.flatMap((h: any) =>
            h.data.map((d: any) => ({ ...d, location: h.location }))
          );
          const recentData = allData.filter((d: any) => new Date(d.timestamp + 'Z') >= cutoff);
          if (recentData.length === 0) return;

          const totalVolume = recentData.reduce((s: number, d: any) => s + d.item_count, 0);
          const totalValue = recentData.reduce((s: number, d: any) => s + d.item_count * d.avg_price, 0);

          // Per-city breakdown
          const cityMap: Record<string, { volume: number; valueSum: number }> = {};
          recentData.forEach((d: any) => {
            if (!cityMap[d.location]) cityMap[d.location] = { volume: 0, valueSum: 0 };
            cityMap[d.location].volume += d.item_count;
            cityMap[d.location].valueSum += d.item_count * d.avg_price;
          });
          const perCity = Object.entries(cityMap)
            .map(([city, { volume, valueSum }]) => ({ city, volume, avgPrice: Math.round(valueSum / volume) }))
            .sort((a, b) => b.volume - a.volume);

          const topCity = perCity[0]?.city || "";
          const prices = recentData.map((d: any) => d.avg_price);
          const highestPrice = Math.max(...prices);
          const lowestPrice = Math.min(...prices);
          const avgPrice = totalValue / totalVolume;

          // Trend
          const { trend, trendPercent } = calculateTrend(allData);

          const lastDataPoint = recentData
            .map((d: any) => d.timestamp)
            .sort()
            .pop() + 'Z';

          // Demand score: volume × trend multiplier × city diversity
          newEntries.push({
            itemId: target.id,
            totalVolume,
            avgPrice,
            highestPrice,
            lowestPrice,
            trend,
            trendPercent,
            perCity,
            topCity,
            lastDataPoint,
            cachedAt: Date.now(),
          });
        });
      } catch (e) {
        console.error("Pulse batch failed:", e);
      }

      setProgress({ current: Math.min(i + BATCH_SIZE, toScan.length), total: toScan.length });

      // Progressive update: write to cache and update UI as each batch comes in
      if (newEntries.length > 0) {
        setCachedBatch([...newEntries]);
        setEntries(getAllCached());
        setLastUpdated(new Date());
      }

      if (i + BATCH_SIZE < toScan.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }

    setScanning(false);
  }, [server, category, tier, timeRange]);

  // Start background scan on mount and when filters change
  useEffect(() => {
    runScan(false);
    return () => { scanAbortRef.current = true; };
  }, [server, category, tier, timeRange]);

  const getDemandScore = (e: PulseCacheEntry) => {
    const trendMultiplier = { surging: 3, rising: 2, stable: 1, cooling: 0.5, unknown: 0.8 }[e.trend];
    const cityDiversity = Math.min(e.perCity.length / 5, 1); // max bonus at 5+ cities
    return Math.round(e.totalVolume * trendMultiplier * (0.7 + 0.3 * cityDiversity));
  };

  const sorted = useMemo(() => {
    return entries
      .filter(e => {
        if (search) {
          const item = itemsData.find(i => i.id === e.itemId);
          if (!item) return false;
          if (!item.name.toLowerCase().includes(search.toLowerCase()) &&
              !e.itemId.toLowerCase().includes(search.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "volume") return b.totalVolume - a.totalVolume;
        if (sortBy === "price") return b.avgPrice - a.avgPrice;
        if (sortBy === "trend") {
          const order = { surging: 4, rising: 3, stable: 2, cooling: 1, unknown: 0 };
          return order[b.trend] - order[a.trend];
        }
        return getDemandScore(b) - getDemandScore(a);
      })
      .slice(0, 500);
  }, [entries, search, sortBy]);

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div>
        <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
          <Flame className="w-6 h-6 text-orange-400" />
          Market <span className="text-primary">Pulse</span>
        </h3>
        <p className="text-primary/60 text-sm mt-1">
          Discover which items are trending by analyzing real transaction history across all cities.
        </p>
        {lastUpdated && (
          <p className="text-primary/40 text-xs flex items-center gap-1.5 mt-1">
            <Clock className="w-3.5 h-3.5" />
            Cache updated {Math.round((Date.now() - lastUpdated.getTime()) / 60000)} min ago • 45-min TTL
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-45">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
          <input
            type="text" placeholder="Search items..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/20 border border-primary/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-primary/20 focus:outline-none focus:border-primary/40 transition-all"
          />
        </div>

        {/* Category */}
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="h-12 bg-black/20 border border-primary/20 rounded-xl px-4 text-white text-sm font-bold focus:outline-none cursor-pointer appearance-none min-w-32">
          {CATEGORIES.map(c => <option key={c} value={c} style={{background: '#151a21'}}>{c}</option>)}
        </select>

        {/* Tier */}
        <select value={tier} onChange={e => setTier(e.target.value)}
          className="h-12 bg-black/20 border border-primary/20 rounded-xl px-4 text-white text-sm font-bold focus:outline-none cursor-pointer appearance-none min-w-24">
          {TIERS.map(t => <option key={t} value={t} style={{background: '#151a21'}}>{t}</option>)}
        </select>

        {/* Time Range */}
        <div className="flex glass-panel p-1 rounded-xl border border-primary/10 gap-1 h-12">
          {([24, 48] as const).map(r => (
            <button key={r} onClick={() => setTimeRange(r)}
              className={`px-4 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${timeRange === r ? 'bg-primary text-black' : 'text-primary/50 hover:text-primary'}`}>
              {r}H
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-3 glass-panel px-4 py-2 rounded-xl border border-primary/10 h-12">
          <Filter className="w-5 h-5 text-primary" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="bg-transparent text-primary text-sm font-bold focus:outline-none cursor-pointer appearance-none uppercase tracking-wider">
            <option value="demand" style={{background: '#151a21'}}>Demand Score</option>
            <option value="volume" style={{background: '#151a21'}}>Volume</option>
            <option value="trend" style={{background: '#151a21'}}>Trend</option>
            <option value="price" style={{background: '#151a21'}}>Avg Price</option>
          </select>
        </div>

        {/* Divider */}
        <div className="w-px h-12 bg-primary/10" />

        {/* Showing count */}
        <div className="flex items-center gap-3 glass-panel px-4 rounded-xl border border-primary/10 h-12">
          <span className="text-primary/50 text-sm font-bold uppercase tracking-wider">Showing</span>
          <span className="text-white font-bold text-base">{sorted.length}</span>
          <span className="text-primary/40 text-sm">of</span>
          <span className="text-primary font-bold text-base">{entries.length}</span>
        </div>

        {/* Scan progress */}
        {scanning && (
          <div className="flex items-center gap-2 glass-panel px-4 rounded-xl border border-primary/10 h-12">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm font-bold text-primary/60 uppercase tracking-wider">
              {progress.current}/{progress.total}
            </span>
          </div>
        )}

        {/* Force Refresh */}
        <button
          onClick={() => { clearAll(); setEntries([]); runScan(true); }}
          disabled={scanning}
          className="flex items-center gap-2 glass-panel px-4 rounded-xl border border-primary/10 text-primary/60 hover:text-white hover:border-primary/30 transition-all disabled:opacity-40 text-sm font-bold uppercase tracking-wider h-12"
        >
          <RefreshCw className={`w-5 h-5 ${scanning ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Progress bar (background scan) */}
      {scanning && (
        <div className="space-y-2">
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <p className="text-xs text-primary/40 uppercase tracking-wider">
            Background scan — showing cached results while loading...
          </p>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && !scanning && (
        <div className="flex flex-col items-center justify-center py-24 glass-panel rounded-3xl border border-dashed border-primary/10 space-y-4">
          <BarChart2 className="w-12 h-12 text-primary/20" />
          <p className="text-white font-bold">No data yet</p>
          <p className="text-primary/40 text-sm">Select a category and the scan will begin automatically.</p>
        </div>
      )}

      {/* Results */}
      {sorted.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          <AnimatePresence mode="popLayout">
            {sorted.map((entry, idx) => {
              const item = itemsData.find(i => i.id === entry.itemId);
              if (!item) return null;
              const trendCfg = TREND_CONFIG[entry.trend];
              const demandScore = getDemandScore(entry);

              return (
                <motion.div
                  key={entry.itemId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`group relative glass-panel border rounded-xl overflow-hidden transition-all duration-500 ${
                    trendCfg.border.replace('border', 'border')
                  } hover:border-primary/40`}
                >
                  {/* Trend color bar */}
                  <div className={`absolute top-0 left-0 w-1 h-full ${trendCfg.border.replace('border', 'bg')}`} />

                  <div className="pl-5 pr-4 py-3 flex flex-row items-center gap-5">
                    {/* Item */}
                    <div className="flex items-center gap-3 w-48 shrink-0">
                      <div className="relative shrink-0">
                        <div className="glass-panel p-2.5 rounded-xl border border-primary/20 group-hover:border-primary/40 transition-all">
                          <img src={item.icon} alt={item.name} className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-white font-bold text-sm truncate group-hover:text-primary transition-colors">{item.name}</h4>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="subtle" size="sm">T{item.tier}</Badge>
                          <Badge
                            variant={
                              entry.trend === 'surging' ? 'warning' :
                              entry.trend === 'rising' ? 'success' :
                              entry.trend === 'cooling' ? 'error' :
                              entry.trend === 'stable' ? 'info' : 'default'
                            }
                            size="sm"
                          >
                            {trendCfg.label}
                          </Badge>
                          {entry.trendPercent !== 0 && (
                            <span className={`text-xs font-bold ${trendCfg.color}`}>
                              {entry.trendPercent > 0 ? '+' : ''}{entry.trendPercent}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center gap-px flex-1 min-w-0">
                      <div className="flex-1 flex flex-col items-center gap-1.5 border-r border-white/5 px-4">
                        <Label size="sm" color="primary">Demand</Label>
                        <div className="flex items-center gap-1.5 text-primary font-bold text-sm">
                          <Zap className="w-4 h-4" />{demandScore.toLocaleString()}
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-1.5 border-r border-white/5 px-4">
                        <Label size="sm" color="primary">Volume</Label>
                        <div className="flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-info/60" />
                          <span className="text-white font-bold text-sm">{entry.totalVolume.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-1.5 border-r border-white/5 px-4">
                        <Label size="sm" color="primary">Avg Price</Label>
                        <Mono size="sm" weight="bold" className="text-primary">{formatSilver(entry.avgPrice).replace(' Silver', '')}</Mono>
                      </div>
                      <div className="flex-1 flex flex-col gap-2 pl-4 overflow-hidden">
                        <Label size="sm" color="primary">City Prices</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.perCity.map(({ city, avgPrice }) => {
                            const cityColors: Record<string, string> = {
                              Lymhurst: 'border-green-400/70 bg-green-500/10',
                              'Fort Sterling': 'border-white/40 bg-white/5',
                              Thetford: 'border-primary/40 bg-primary/10',
                              Martlock: 'border-blue-400/70 bg-blue-500/10',
                              Bridgewatch: 'border-orange-400/70 bg-orange-500/10',
                              Caerleon: 'border-red-400/70 bg-red-500/10',
                              Brecilien: 'border-pink-300/70 bg-pink-500/10',
                            };
                            const colorClass = cityColors[city] || 'border-white/20 bg-white/5';
                            return (
                              <div key={city} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 border ${colorClass}`}>
                                <span className="text-xs font-mono uppercase text-white/70">{city.slice(0, 3)}</span>
                                <span className="text-xs text-primary font-mono font-bold">{formatSilver(avgPrice).replace(' Silver', '')}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    {onTradeItem && (
                      <button
                        onClick={() => onTradeItem(item)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-black border border-primary/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 group/btn min-h-11"
                      >
                        <ArrowUpRight className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                        Trade
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
