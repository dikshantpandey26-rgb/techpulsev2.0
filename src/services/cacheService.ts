// =============================================================================
// src/services/cacheService.ts
//
// Edge-safe in-memory cache with TTL, stale-while-revalidate, and
// in-flight request deduplication.
//
// Architecture decisions:
// ─────────────────────────────────────────────────────────────────────────────
// Module-level Map as storage:
//   Vercel Edge Functions run in V8 isolates. Within one isolate (one warm
//   function instance in one edge region), module-level state persists across
//   invocations — exactly like a process-level singleton in Node.js.
//   This gives us sub-millisecond cache hits for repeated requests to the
//   same edge node, with no external dependency.
//
// Stale-while-revalidate (SWR):
//   Each entry stores two TTLs:
//     expiresAt  = storedAt + ttl       → after this: data is "stale"
//     staleUntil = storedAt + ttl * 3   → after this: data is evicted entirely
//   While stale: we return the old data immediately AND kick off a background
//   revalidation. The next request gets fresh data. This eliminates the
//   "thundering herd" problem where all concurrent callers block on a slow fetch.
//
// In-flight deduplication:
//   If 50 concurrent requests arrive for the same uncached key, only one
//   actual fetch fires. The rest await the same Promise. This is critical
//   for news ingestion where many articles can trigger simultaneous enrichment.
//
// Future Redis migration:
//   The public API (get / set / evict) is transport-agnostic. Swapping the
//   Map for Upstash Redis REST calls requires changing only the storage
//   primitives inside this file — all callers stay unchanged.
//
// Vercel compatibility:
//   No Node.js APIs (fs, crypto, Buffer). Uses only Map, Promise, Date.now().
//   Identical behaviour in Edge, Node (serverless), and browser bundle.
//
// Memory management:
//   evictExpired() prunes the Map on every set() call (amortised O(n) where n
//   is small in practice). For very high-volume scenarios, switch to
//   a sorted-expiry structure; fine for news aggregation scale.
// =============================================================================

import type { CacheEntry, CacheGetResult, CacheOptions } from "../types";

// ── Storage ───────────────────────────────────────────────────────────────────

// Module-level singletons — persist across warm invocations in the same isolate
const store    = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

// Hard cap on cache entries to prevent unbounded memory growth in long-lived
// Edge Function isolates. When exceeded, we evict the 20% oldest entries.
const MAX_STORE_SIZE = 500;

// ── Internals ─────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

/** Remove entries that have passed their staleUntil deadline */
function evictExpired(): void {
  const t = now();

  // Pass 1: remove fully expired entries
  for (const [key, entry] of store) {
    if (t >= entry.staleUntil) {
      store.delete(key);
    }
  }

  // Pass 2: enforce memory cap
  if (store.size > MAX_STORE_SIZE) {
    const evictCount = Math.ceil(store.size * 0.2);

    const oldestEntries = Array.from(store.entries())
      .sort((a, b) => a[1].storedAt - b[1].storedAt)
      .slice(0, evictCount);

    for (const [key] of oldestEntries) {
      store.delete(key);
    }
  }
}

// ── Core operations ───────────────────────────────────────────────────────────

/**
 * Write a value into the cache with a TTL.
 *
 * @param key      - Cache key
 * @param data     - Any serialisable value
 * @param options  - TTL and optional staleTtl
 */
function set<T>(key: string, data: T, options: CacheOptions): void {
  const ttlMs      = options.ttl * 1_000;
  const staleTtlMs = (options.staleTtl ?? options.ttl * 3) * 1_000;
  const t          = now();

  const entry: CacheEntry<T> = {
    data,
    storedAt:   t,
    expiresAt:  t + ttlMs,
    staleUntil: t + ttlMs + staleTtlMs,
  };

  store.set(key, entry as CacheEntry<unknown>);

  // Amortised eviction — keeps memory bounded without a background timer
  // (which would be problematic in short-lived Edge Function invocations)
  evictExpired();
}

/**
 * Read from cache. Returns null if evicted or never set.
 */
function get<T>(key: string): CacheGetResult<T> | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  const t = now();

  if (t >= entry.staleUntil) {
    // Fully expired — evict and treat as miss
    store.delete(key);
    return null;
  }

  const isStale = t >= entry.expiresAt;

  return {
    data:      entry.data,
    isStale,
    fromCache: true,
  };
}

/**
 * Delete a specific key from the cache.
 */
function evict(key: string): void {
  store.delete(key);
}

/**
 * Delete all keys matching a prefix (e.g. "feed:" to bust all feed caches).
 */
function evictPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Return cache statistics — useful for /api/status endpoints.
 */
function stats(): { size: number; keys: string[] } {
  evictExpired();
  return { size: store.size, keys: Array.from(store.keys()) };
}

// ── SWR fetch wrapper ─────────────────────────────────────────────────────────

/**
 * Stale-while-revalidate data fetcher.
 *
 * Behaviour:
 *   FRESH  → return cached data immediately, no fetch
 *   STALE  → return cached data immediately, trigger background revalidation
 *   MISS   → fetch, cache, return result
 *
 * In-flight deduplication: if multiple callers request the same missing key
 * simultaneously, only one fetch fires. All callers await the same Promise.
 *
 * @param key        - Cache key
 * @param fetcher    - Async function that returns fresh data
 * @param options    - TTL configuration
 * @returns          - CacheGetResult with isStale indicating freshness
 */
async function getOrFetch<T>(
  key:     string,
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<CacheGetResult<T>> {
  // 1. Try cache
  const cached = get<T>(key);

  if (cached && !cached.isStale) {
    // Fresh hit — return immediately
    return cached;
  }

  if (cached && cached.isStale) {
    // Stale hit — serve immediately, revalidate in background
    void revalidate(key, fetcher, options);
    return cached;
  }

  // 2. Cache miss — deduplicate in-flight requests for the same key
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) {
    const data = await existing;
    return { data, isStale: false, fromCache: false };
  }

  // 3. Fire the actual fetch
  const promise = fetcher().then((data) => {
    set(key, data, options);
    inFlight.delete(key);
    return data;
  }).catch((err: unknown) => {
    inFlight.delete(key);
    throw err;
  });

  inFlight.set(key, promise as Promise<unknown>);

  const data = await promise;
  return { data, isStale: false, fromCache: false };
}

/**
 * Background revalidation — called internally for stale entries.
 * Errors are swallowed (we already returned stale data to the caller).
 */
async function revalidate<T>(
  key:     string,
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<void> {
  // Prevent concurrent revalidation of the same key
  if (inFlight.has(key)) return;

  const promise = fetcher().then((data) => {
    set(key, data, options);
    inFlight.delete(key);
    return data;
  }).catch(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, promise as Promise<unknown>);
  await promise;
}

// ── Typed convenience builders ────────────────────────────────────────────────

/**
 * Create a namespaced cache instance with a fixed key prefix and default options.
 * Keeps callers from needing to manage key naming conventions manually.
 *
 * @example
 *   const feedCache = createNamespacedCache("feed:", { ttl: 300 });
 *   const result = await feedCache.getOrFetch("all:page1", fetchFeed);
 */
function createNamespacedCache(
  prefix:   string,
  defaults: CacheOptions
) {
  return {
    get<T>(key: string): CacheGetResult<T> | null {
      return get<T>(`${prefix}${key}`);
    },

    set<T>(key: string, data: T, opts?: Partial<CacheOptions>): void {
      set<T>(`${prefix}${key}`, data, { ...defaults, ...opts });
    },

    evict(key: string): void {
      evict(`${prefix}${key}`);
    },

    evictAll(): void {
      evictPrefix(prefix);
    },

    async getOrFetch<T>(
      key:     string,
      fetcher: () => Promise<T>,
      opts?:   Partial<CacheOptions>
    ): Promise<CacheGetResult<T>> {
      return getOrFetch<T>(`${prefix}${key}`, fetcher, { ...defaults, ...opts });
    },
  };
}

// ── Pre-built namespaced caches ───────────────────────────────────────────────
// Each cache namespace has a TTL tuned to the volatility of its data.

/** Article feed cache — 5 min fresh, 15 min stale window */
export const feedCache = createNamespacedCache("feed:", {
  ttl:      300,
  staleTtl: 900,
});

/** Per-source fetch results — TTL matches source.cacheTtlSeconds */
export const sourceCache = createNamespacedCache("source:", {
  ttl:      300,
  staleTtl: 1800,
});

/** AI enrichment results — 6 hours (expensive to regenerate) */
export const aiCache = createNamespacedCache("ai:", {
  ttl:      21_600,
  staleTtl: 86_400,
});

/** Trending score cache — refreshed every 5 minutes */
export const trendingCache = createNamespacedCache("trending:", {
  ttl:      300,
  staleTtl: 600,
});

// ── Raw exports for direct use ────────────────────────────────────────────────

export const cache = {
  get,
  set,
  evict,
  evictPrefix,
  getOrFetch,
  stats,
} as const;