// Market Pulse localStorage cache utility
// TTL: 45 minutes — fresh enough for trading decisions, conservative enough for API limits

const CACHE_KEY = 'albion_pulse_cache_v1';
const TTL_MS = 45 * 60 * 1000; // 45 minutes

export interface PulseCacheEntry {
  itemId: string;
  totalVolume: number;
  avgPrice: number;
  highestPrice: number;
  lowestPrice: number;
  trend: 'surging' | 'rising' | 'stable' | 'cooling' | 'unknown';
  trendPercent: number; // % change from prev 12h
  perCity: { city: string; volume: number; avgPrice: number }[];
  topCity: string;
  lastDataPoint: string;
  cachedAt: number;
}

type CacheStore = Record<string, PulseCacheEntry>;

function loadStore(): CacheStore {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStore(store: CacheStore) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch (e) {
    // Quota exceeded — clear old entries and retry
    clearStale();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(store)); } catch {}
  }
}

/** Get a single item from cache. Returns null if missing or expired. */
export function getCached(itemId: string): PulseCacheEntry | null {
  const store = loadStore();
  const entry = store[itemId];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) return null;
  return entry;
}

/** Get all non-expired entries from cache. */
export function getAllCached(): PulseCacheEntry[] {
  const store = loadStore();
  const now = Date.now();
  return Object.values(store).filter(e => now - e.cachedAt <= TTL_MS);
}

/** Write/update a single entry. */
export function setCached(entry: PulseCacheEntry) {
  const store = loadStore();
  store[entry.itemId] = { ...entry, cachedAt: Date.now() };
  saveStore(store);
}

/** Write multiple entries at once. */
export function setCachedBatch(entries: PulseCacheEntry[]) {
  const store = loadStore();
  const now = Date.now();
  entries.forEach(e => { store[e.itemId] = { ...e, cachedAt: now }; });
  saveStore(store);
}

/** Returns itemIds that are missing or stale. */
export function getStaleIds(itemIds: string[]): string[] {
  const store = loadStore();
  const now = Date.now();
  return itemIds.filter(id => {
    const entry = store[id];
    return !entry || now - entry.cachedAt > TTL_MS;
  });
}

/** Remove all expired entries to free up localStorage space. */
export function clearStale() {
  const store = loadStore();
  const now = Date.now();
  const fresh: CacheStore = {};
  Object.entries(store).forEach(([id, entry]) => {
    if (now - entry.cachedAt <= TTL_MS) fresh[id] = entry;
  });
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch {}
}

/** Force-invalidate all entries (user-triggered refresh). */
export function clearAll() {
  localStorage.removeItem(CACHE_KEY);
}

/** Calculate trend from history data */
export function calculateTrend(data: { timestamp: string; item_count: number }[]): {
  trend: PulseCacheEntry['trend'];
  trendPercent: number;
} {
  if (data.length < 2) return { trend: 'unknown', trendPercent: 0 };

  const now = new Date();
  const cutoff12h = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recent = data.filter(d => new Date(d.timestamp + 'Z') >= cutoff12h);
  const previous = data.filter(d => {
    const t = new Date(d.timestamp + 'Z');
    return t >= cutoff24h && t < cutoff12h;
  });

  const recentVol = recent.reduce((s, d) => s + d.item_count, 0);
  const prevVol = previous.reduce((s, d) => s + d.item_count, 0);

  if (prevVol === 0) return { trend: recentVol > 0 ? 'rising' : 'unknown', trendPercent: 0 };

  const change = ((recentVol - prevVol) / prevVol) * 100;

  let trend: PulseCacheEntry['trend'];
  if (change >= 50) trend = 'surging';
  else if (change >= 10) trend = 'rising';
  else if (change <= -10) trend = 'cooling';
  else trend = 'stable';

  return { trend, trendPercent: Math.round(change) };
}
