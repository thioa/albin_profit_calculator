import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AlbionItem, AlbionServer, ALBION_CITIES } from "../../types/albion";
import { fetchHistory } from "../../lib/albion-api";
import { formatSilver } from "../../lib/economy-utils";
import {
  getCached, getAllCached, setCachedBatch, getStaleIds, clearAll,
  calculateTrend, PulseCacheEntry
} from "../../lib/market-pulse-cache";
import {
  TrendingUp, TrendingDown, Minus, Flame, RefreshCw,
  ArrowUpRight, Search, Zap, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import itemsDataRaw from "../../data/items-lite.json";
import { processItems } from "../../lib/item-utils";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const itemsData = processItems(itemsDataRaw as AlbionItem[]);

const CATEGORIES = ["All", "Weapons", "Armor", "Off-Hand", "Accessories", "Mounts", "Bags", "Capes", "Resources", "Food", "Potions"];
const TIERS = ["All", "T4", "T5", "T6", "T7", "T8"];

// City config â€” active state (has value)
const CITY_ACTIVE: Record<string, { label: string; className: string }> = {
  'Lymhurst':      { label: "LYM", className: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" },
  'Fort Sterling': { label: "FST", className: "bg-zinc-500/20 border-zinc-500/40 text-zinc-400" },
  'Thetford':      { label: "THF", className: "bg-purple-500/20 border-purple-500/40 text-purple-400" },
  'Martlock':      { label: "MAR", className: "bg-blue-500/20 border-blue-500/40 text-blue-400" },
  'Bridgewatch':   { label: "BRW", className: "bg-orange-500/20 border-orange-500/40 text-orange-400" },
  'Caerleon':      { label: "CAE", className: "bg-red-500/20 border-red-500/40 text-red-400" },
  'Brecilien':     { label: "BRC", className: "bg-pink-500/20 border-pink-500/40 text-pink-400" },
};

// City config â€” inactive state (no data)
const CITY_INACTIVE: Record<string, { label: string; className: string }> = {
  'Lymhurst':      { label: "LYM", className: "bg-white/5 border-white/10 text-white/30" },
  'Fort Sterling': { label: "FST", className: "bg-white/5 border-white/10 text-white/30" },
  'Thetford':      { label: "THF", className: "bg-white/5 border-white/10 text-white/30" },
  'Martlock':      { label: "MAR", className: "bg-white/5 border-white/10 text-white/30" },
  'Bridgewatch':   { label: "BRW", className: "bg-white/5 border-white/10 text-white/30" },
  'Caerleon':      { label: "CAE", className: "bg-white/5 border-white/10 text-white/30" },
  'Brecilien':     { label: "BRC", className: "bg-white/5 border-white/10 text-white/30" },
};

// Trend badge config
const TREND_BADGE: Record<string, { label: string; icon: any; color: string; bg: string; borderColor: string }> = {
  surging: { label: "Surging", icon: Flame, color: "text-orange-400", bg: "bg-orange-500/20", borderColor: "border-orange-500/30" },
  rising:  { label: "Rising",  icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/20", borderColor: "border-emerald-500/30" },
  stable:  { label: "Stable",  icon: Minus, color: "text-blue-400", bg: "bg-blue-500/20", borderColor: "border-blue-500/30" },
  cooling: { label: "Cooling", icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/20", borderColor: "border-red-500/30" },
  unknown: { label: "Unknown", icon: Minus, color: "text-white/30", bg: "bg-white/5", borderColor: "border-white/10" },
};

// Trend color strip (left border)
const TREND_STRIP: Record<string, string> = {
  surging: "bg-orange-500",
  rising:  "bg-emerald-500",
  stable:  "bg-blue-500",
  cooling: "bg-red-500",
  unknown: "bg-white/10",
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
    .slice(0, 2000)
    .map(item => ({ id: item.id, item }));
}

export default function MarketPulse({ server, onTradeItem }: { server: AlbionServer; onTradeItem?: (item: AlbionItem) => void }) {
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
          const { trend, trendPercent } = calculateTrend(allData);

          const lastDataPoint = recentData
            .map((d: any) => d.timestamp)
            .sort()
            .pop() + 'Z';

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

  useEffect(() => {
    runScan(false);
    return () => { scanAbortRef.current = true; };
  }, [server, category, tier, timeRange]);

  const getDemandScore = (e: PulseCacheEntry) => {
    const trendMultiplier = { surging: 3, rising: 2, stable: 1, cooling: 0.5, unknown: 0.8 }[e.trend];
    const cityDiversity = Math.min(e.perCity.length / 5, 1);
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
      {/* Header */}
      <div>
        <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
          <Flame className="w-6 h-6 text-orange-400" />
          Market <span className="text-primary">Pulse</span>
        </h3>
        <p className="text-primary/60 text-sm mt-1">
          Discover which items are trending by analyzing real transaction history across all cities.
        </p>
        {lastUpdated && (
          <p className="text-primary/70 text-xs flex items-center gap-1.5 mt-1">
            <Clock className="w-3.5 h-3.5" />
            Cache updated {Math.round((Date.now() - lastUpdated.getTime()) / 60000)} min ago
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
        <div className="relative flex-1 min-w-35 sm:min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
          <input
            type="text" placeholder="Search..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/20 border border-primary/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-primary/20 focus:outline-none focus:border-primary/40 transition-all"
          />
        </div>

        <select value={category} onChange={e => setCategory(e.target.value)}
          className="h-10 sm:h-12 bg-black/20 border border-primary/20 rounded-lg sm:rounded-xl px-2 sm:px-4 text-white text-xs sm:text-sm font-bold focus:outline-none cursor-pointer appearance-none min-w-20 sm:min-w-25">
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={tier} onChange={e => setTier(e.target.value)}
          className="h-10 sm:h-12 bg-black/20 border border-primary/20 rounded-lg sm:rounded-xl px-2 sm:px-4 text-white text-xs sm:text-sm font-bold focus:outline-none cursor-pointer appearance-none min-w-15 sm:min-w-20">
          {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="flex glass-panel p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-primary/10 gap-1 h-10 sm:h-12">
          {([24, 48] as const).map(r => (
            <button key={r} onClick={() => setTimeRange(r)}
              className={cn(
                "px-2 sm:px-4 rounded-md sm:rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wider transition-all",
                timeRange === r ? "bg-primary text-black" : "text-primary/75 hover:text-primary"
              )}>
              {r}H
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 glass-panel px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border border-primary/10 h-10 sm:h-12">
          <svg className="w-4 h-4 text-primary/70 hidden sm:block shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="bg-transparent text-primary text-xs sm:text-sm font-bold focus:outline-none cursor-pointer appearance-none uppercase tracking-wider">
            <option value="demand">Demand</option>
            <option value="volume">Volume</option>
            <option value="trend">Trend</option>
            <option value="price">Price</option>
          </select>
        </div>

        <div className="hidden sm:flex items-center gap-3 glass-panel px-4 rounded-xl border border-primary/10 h-12">
          <span className="text-primary/75 text-sm font-bold uppercase tracking-wider">Showing</span>
          <span className="text-white font-bold text-base">{sorted.length}</span>
          <span className="text-primary/70 text-sm">of</span>
          <span className="text-primary font-bold text-base">{entries.length}</span>
        </div>

        <div className="sm:hidden flex items-center gap-1 glass-panel px-2 py-1 rounded-lg border border-primary/10">
          <span className="text-primary/75 text-xs font-bold">{sorted.length}</span>
          <span className="text-primary/30 text-xs">/</span>
          <span className="text-primary font-bold text-xs">{entries.length}</span>
        </div>

        {scanning && (
          <div className="flex items-center gap-2 glass-panel px-2 sm:px-4 rounded-lg sm:rounded-xl border border-primary/10 h-10 sm:h-12">
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-primary animate-spin" />
            <span className="text-xs sm:text-sm font-bold text-primary/60 uppercase tracking-wider hidden sm:inline">
              {progress.current}/{progress.total}
            </span>
          </div>
        )}

        <button
          onClick={() => { clearAll(); setEntries([]); runScan(true); }}
          disabled={scanning}
          className="flex items-center gap-1 sm:gap-2 glass-panel px-2 sm:px-4 rounded-lg sm:rounded-xl border border-primary/10 text-primary/60 hover:text-white hover:border-primary/30 transition-all disabled:opacity-40 text-xs sm:text-sm font-bold uppercase tracking-wider h-10 sm:h-12"
        >
          <RefreshCw className={cn("w-4 h-4 sm:w-5 sm:h-5", scanning && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Progress bar */}
      {scanning && (
        <div className="space-y-2">
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <p className="text-xs text-primary/70 uppercase tracking-wider">
            Background scan â€” showing cached results while loading...
          </p>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && !scanning && (
        <div className="flex flex-col items-center justify-center py-24 glass-panel rounded-3xl border border-dashed border-primary/10 space-y-4">
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' rx='15' fill='%23151a21'/%3E%3Cpath d='M30 100 L50 70 L70 85 L90 50 L110 65 L130 40' stroke='%23f59e0b' stroke-width='4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='50' cy='70' r='6' fill='%23f59e0b'/%3E%3Ccircle cx='90' cy='50' r='6' fill='%23f59e0b'/%3E%3Ccircle cx='130' cy='40' r='6' fill='%23f59e0b'/%3E%3C/svg%3E"
            alt="Market Pulse illustration"
            className="w-32 h-32 opacity-60"
          />
          <p className="text-white font-bold">No data yet</p>
          <p className="text-primary/70 text-sm">Select a category and the scan will begin automatically.</p>
        </div>
      )}

      {/* Results */}
      {sorted.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          <AnimatePresence mode="popLayout">
            {sorted.map((entry, idx) => {
              const item = itemsData.find(i => i.id === entry.itemId);
              if (!item) return null;
              const trendCfg = TREND_BADGE[entry.trend];
              const trendStrip = TREND_STRIP[entry.trend];
              const demandScore = getDemandScore(entry);

              return (
                <motion.div
                  key={entry.itemId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="group relative glass-panel border border-white/10 rounded-xl overflow-hidden transition-all duration-300 hover:border-primary/30"
                >
                  {/* â”€â”€ DESKTOP ROW â”€â”€ */}
                  <div className="hidden lg:flex items-stretch min-w-0">

                    {/* Trend strip */}
                    <div className={cn("w-1 shrink-0 rounded-l-xl", trendStrip)} />

                    {/* Icon */}
                    <div className="flex items-center px-3 shrink-0">
                      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 overflow-hidden">
                        <img src={item.icon} alt={item.name} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                      </div>
                    </div>

                    {/* Item name + tier + trend â€” single line */}
                    <div className="flex items-center gap-2 px-3 border-r border-white/5 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <h4 className="text-sm font-bold text-white max-w-36 truncate group-hover:text-primary transition-colors leading-tight cursor-help">{item.name}</h4>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-xs font-bold text-primary/70 shrink-0">T{item.tier}</span>
                      <span className={cn(
                        "inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-full border shrink-0",
                        trendCfg.bg, trendCfg.color, trendCfg.borderColor
                      )}>
                        <trendCfg.icon className="w-2.5 h-2.5" />
                        {trendCfg.label}
                        <span className="text-label opacity-70">{entry.trendPercent > 0 ? '+' : ''}{entry.trendPercent}%</span>
                      </span>
                    </div>

                    {/* Metrics: Demand | Volume | Avg â€” inline, no wrapping */}
                    <div className="flex items-center gap-0 border-r border-white/5 shrink-0">
                      {/* Demand */}
                      <div className="flex items-center gap-1.5 px-3 py-2">
                        <Zap className="w-3.5 h-3.5 text-primary/75 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-label font-bold text-primary/30 uppercase tracking-widest leading-none">Demand</span>
                          <span className="text-sm font-black text-primary tabular-nums leading-none">{demandScore >= 1000 ? `${(demandScore/1000).toFixed(1)}K` : demandScore.toLocaleString()}</span>
                        </div>
                      </div>
                      {/* Volume */}
                      <div className="flex items-center gap-1.5 px-3 py-2 border-l border-white/5">
                        <div className="flex flex-col">
                          <span className="text-label font-bold text-white/20 uppercase tracking-widest leading-none">Volume</span>
                          <span className="text-sm font-bold text-white/50 tabular-nums leading-none">{entry.totalVolume >= 1000 ? `${(entry.totalVolume/1000).toFixed(1)}K` : entry.totalVolume.toLocaleString()}</span>
                        </div>
                      </div>
                      {/* Avg */}
                      <div className="flex items-center gap-1.5 px-3 py-2 border-l border-white/5">
                        <div className="flex flex-col">
                          <span className="text-label font-bold text-white/20 uppercase tracking-widest leading-none">Avg</span>
                          <span className="text-sm font-mono font-bold text-primary/60 tabular-nums leading-none">{formatSilver(entry.avgPrice).replace(' Silver', '')}</span>
                        </div>
                      </div>
                    </div>

                    {/* City prices â€” compact single row */}
                    <div className="flex items-center gap-1 px-3 overflow-x-auto scrollbar-hide shrink-0">
                      {ALBION_CITIES.map(city => {
                        const cityData = entry.perCity.find(c => c.city === city);
                        const hasValue = !!cityData;
                        const cfg = hasValue ? CITY_ACTIVE[city] : CITY_INACTIVE[city];
                        return (
                          <div
                            key={city}
                            className={cn(
                              "shrink-0 flex flex-col items-center justify-center px-1.5 py-1.5 rounded-lg border min-w-11 gap-0.5",
                              cfg.className,
                              !hasValue && "opacity-40"
                            )}
                          >
                            <span className="text-label font-bold uppercase tracking-wider leading-none">{cfg.label}</span>
                            <span className="text-sm font-mono font-bold leading-none tabular-nums">
                              {hasValue ? formatSilver(cityData.avgPrice).replace(' Silver', '') : 'â€”'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Trade */}
                    {onTradeItem && (
                      <div className="flex items-center px-4 shrink-0">
                        <button
                          onClick={() => onTradeItem(item)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-black border border-primary/20 rounded-xl font-bold text-xs transition-all"
                        >
                          Trade <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* â”€â”€ MOBILE / TABLET STACKED â”€â”€ */}
                  <div className="lg:hidden p-4 flex flex-col gap-3">
                    {/* Row 1: Item + trade â€” single line */}
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 shrink-0 overflow-hidden">
                        <img src={item.icon} alt={item.name} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <h4 className="text-sm font-bold text-white max-w-36 truncate group-hover:text-primary transition-colors leading-tight cursor-help shrink-0">{item.name}</h4>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-xs font-bold text-primary/70 shrink-0">T{item.tier}</span>
                      <span className={cn(
                        "inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-full border shrink-0",
                        trendCfg.bg, trendCfg.color, trendCfg.borderColor
                      )}>
                        <trendCfg.icon className="w-2.5 h-2.5" />
                        {trendCfg.label} <span className="text-label opacity-70">{entry.trendPercent > 0 ? '+' : ''}{entry.trendPercent}%</span>
                      </span>
                      {onTradeItem && (
                        <button
                          onClick={() => onTradeItem(item)}
                          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-black border border-primary/20 rounded-lg font-bold text-xs transition-all shrink-0"
                        >
                          Trade <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Row 2: Metrics â€” compact inline */}
                    <div className="flex items-center gap-0">
                      <div className="flex items-center gap-1.5 px-3 py-1.5">
                        <Zap className="w-3.5 h-3.5 text-primary/75 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-label font-bold text-primary/30 uppercase tracking-widest leading-none">Demand</span>
                          <span className="text-sm font-black text-primary tabular-nums leading-none">{demandScore >= 1000 ? `${(demandScore/1000).toFixed(1)}K` : demandScore.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 border-l border-white/5">
                        <div className="flex flex-col">
                          <span className="text-label font-bold text-white/20 uppercase tracking-widest leading-none">Volume</span>
                          <span className="text-sm font-bold text-white/50 tabular-nums leading-none">{entry.totalVolume >= 1000 ? `${(entry.totalVolume/1000).toFixed(1)}K` : entry.totalVolume.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 border-l border-white/5">
                        <div className="flex flex-col">
                          <span className="text-label font-bold text-white/20 uppercase tracking-widest leading-none">Avg</span>
                          <span className="text-sm font-mono font-bold text-primary/60 tabular-nums leading-none">{formatSilver(entry.avgPrice).replace(' Silver', '')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Row 3: All city prices */}
                    <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
                      {ALBION_CITIES.map(city => {
                        const cityData = entry.perCity.find(c => c.city === city);
                        const hasValue = !!cityData;
                        const cfg = hasValue ? CITY_ACTIVE[city] : CITY_INACTIVE[city];
                        return (
                          <div
                            key={city}
                            className={cn(
                              "shrink-0 flex flex-col items-center justify-center px-1.5 py-1.5 rounded-lg border min-w-11 gap-0.5",
                              cfg.className,
                              !hasValue && "opacity-40"
                            )}
                          >
                            <span className="text-label font-bold uppercase tracking-wider leading-none">{cfg.label}</span>
                            <span className="text-sm font-mono font-bold leading-none tabular-nums">
                              {hasValue ? formatSilver(cityData.avgPrice).replace(' Silver', '') : 'â€”'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
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







