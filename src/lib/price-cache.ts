/**
 * Generic price cache for features that need multi-item price data.
 * Used by: Top Flips (MarketOpportunities), Profit Scanner (CraftingRecommendations)
 *
 * Format stored: per-item price snapshots keyed by `${itemId}:${city}:${quality}`
 */

const PRICE_CACHE_KEY = 'albion_price_cache_v1';
const SINGLE_ITEM_CACHE_KEY = 'albion_single_item_cache_v1';

// TTLs
export const TTL = {
  TOP_FLIPS: 15 * 60 * 1000,     // 15 min — price data is volatile
  PROFIT_SCANNER: 20 * 60 * 1000, // 20 min — ingredient prices change slowly
  SINGLE_ITEM: 5 * 60 * 1000,     // 5 min — user expects freshness here
  HISTORY: 45 * 60 * 1000,        // 45 min — history is slow-moving (same as Market Pulse)
} as const;

export interface PriceCacheEntry {
  itemId: string;
  city: string;
  quality: number;
  sellPriceMin: number;
  sellPriceMax: number;
  buyPriceMin: number;
  buyPriceMax: number;
  sellDate: string;
  buyDate: string;
  cachedAt: number;
}

type PriceCacheStore = Record<string, PriceCacheEntry>;

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeKey(itemId: string, city: string, quality: number) {
  return `${itemId}:${city}:${quality}`;
}

function loadStore(storageKey: string): PriceCacheStore {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '{}');
  } catch { return {}; }
}

function saveStore(storageKey: string, store: PriceCacheStore) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(store));
  } catch {
    // Quota: evict oldest 20% entries and retry
    const entries = Object.entries(store).sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const trimmed = Object.fromEntries(entries.slice(Math.floor(entries.length * 0.2)));
    try { localStorage.setItem(storageKey, JSON.stringify(trimmed)); } catch {}
  }
}

// ─── Price Cache API ─────────────────────────────────────────────────────────

/** Get one entry. Returns null if missing or older than ttlMs. */
export function getPriceCached(
  itemId: string, city: string, quality: number, ttlMs: number,
  storageKey = PRICE_CACHE_KEY
): PriceCacheEntry | null {
  const store = loadStore(storageKey);
  const entry = store[makeKey(itemId, city, quality)];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ttlMs) return null;
  return entry;
}

/** Get all non-expired entries for an item across all cities/qualities */
export function getPriceCachedForItem(
  itemId: string, ttlMs: number,
  storageKey = PRICE_CACHE_KEY
): PriceCacheEntry[] {
  const store = loadStore(storageKey);
  const now = Date.now();
  return Object.values(store).filter(
    e => e.itemId === itemId && now - e.cachedAt <= ttlMs
  );
}

/** Write multiple entries from a fetchPrices() response. */
export function setPriceCacheBatch(
  priceData: any[], // AlbionPrice[]
  storageKey = PRICE_CACHE_KEY
) {
  const store = loadStore(storageKey);
  const now = Date.now();
  priceData.forEach(p => {
    const key = makeKey(p.item_id, p.city, p.quality);
    store[key] = {
      itemId: p.item_id,
      city: p.city,
      quality: p.quality,
      sellPriceMin: p.sell_price_min,
      sellPriceMax: p.sell_price_max,
      buyPriceMin: p.buy_price_min,
      buyPriceMax: p.buy_price_max,
      sellDate: p.sell_price_min_date,
      buyDate: p.buy_price_max_date,
      cachedAt: now,
    };
  });
  saveStore(storageKey, store);
}

/**
 * Get cached data that matches a list of item IDs.
 * Returns:
 *  - `cached`: AlbionPrice-shaped objects from cache (ready to use)
 *  - `staleIds`: item IDs that need fresh fetching
 */
export function getOrMarkStale(
  itemIds: string[],
  cities: string[],
  qualities: number[],
  ttlMs: number,
  storageKey = PRICE_CACHE_KEY
): { cached: any[]; staleIds: string[] } {
  const store = loadStore(storageKey);
  const now = Date.now();
  const staleIds = new Set<string>();
  const cached: any[] = [];

  itemIds.forEach(itemId => {
    let hasAll = true;
    cities.forEach(city => {
      qualities.forEach(quality => {
        const entry = store[makeKey(itemId, city, quality)];
        if (!entry || now - entry.cachedAt > ttlMs) {
          hasAll = false;
        } else {
          cached.push({
            item_id: entry.itemId,
            city: entry.city,
            quality: entry.quality,
            sell_price_min: entry.sellPriceMin,
            sell_price_max: entry.sellPriceMax,
            buy_price_min: entry.buyPriceMin,
            buy_price_max: entry.buyPriceMax,
            sell_price_min_date: entry.sellDate,
            buy_price_max_date: entry.buyDate,
          });
        }
      });
    });
    if (!hasAll) staleIds.add(itemId);
  });

  return { cached, staleIds: Array.from(staleIds) };
}

/** Remove all entries older than their TTL for both cache stores. */
export function clearStalePrices() {
  [PRICE_CACHE_KEY, SINGLE_ITEM_CACHE_KEY].forEach(key => {
    try {
      const store: PriceCacheStore = JSON.parse(localStorage.getItem(key) || '{}');
      const now = Date.now();
      const fresh: PriceCacheStore = {};
      Object.entries(store).forEach(([k, v]) => {
        if (now - v.cachedAt <= TTL.HISTORY) fresh[k] = v; // keep anything within max TTL
      });
      localStorage.setItem(key, JSON.stringify(fresh));
    } catch {}
  });
}

/** Force-clear all price caches. */
export function clearAllPrices() {
  localStorage.removeItem(PRICE_CACHE_KEY);
  localStorage.removeItem(SINGLE_ITEM_CACHE_KEY);
}

/** Get the cache key for single item searches. */
export const SINGLE_ITEM_CACHE_KEY_EXPORT = SINGLE_ITEM_CACHE_KEY;
