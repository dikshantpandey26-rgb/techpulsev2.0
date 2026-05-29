// =============================================================================
// src/utils/feedUtils.ts
//
// STEP 5 — Performance + incremental processing foundations.
//
// EXPORTED UTILITIES:
//
// 1. articleFingerprint(url, title)
//    Stable djb2 hash of URL + normalized title.
//    Same article from different sources → same fingerprint.
//    Enables incremental processing: skip already-seen articles.
//    Pure function. O(len(url) + len(title)).
//
// 2. DateCache
//    Module-level Map<string, number> caching ISO → timestamp parses.
//    Date.parse() is called 3–5 times per article (sorting, recency scoring, formatting).
//    At 500 articles × 4 calls = 2,000 Date.parse() calls per pipeline run.
//    Cache reduces this to 500 parses + 1,500 Map lookups.
//
// 3. LowercaseCache
//    Same pattern for repeated .toLowerCase() calls on titles during dedup/search.
//
// 4. sourceFresnessScore(sourceId, lastFetchedAt)
//    Returns 0–1 freshness multiplier for source freshness decay.
//    Sources silent for >18h decay toward 0.5 (not 0 — they don't disappear).
//    Used by the ranking pipeline to downweight stale sources.
//    Does NOT modify trendingService — purely additive signal.
//
// 5. Personalization foundation
//    Pure, local-only, no cookies, no backend.
//    CategoryAffinityTracker: records which categories the user reads.
//    ReadingTimeTracker: tracks time spent per article for future weighted ranking.
//    ArticleImpressionTracker: records which article IDs have been shown.
//    All stored in sessionStorage (not localStorage — clears on tab close,
//    so no privacy surface and no stale data issues).
//
// DESIGN PRINCIPLES:
//   - All functions are pure where possible (no side effects outside their cache)
//   - No React imports — usable in both API routes and browser
//   - No Node APIs — edge-safe
//   - Cache entries are bounded (MAX_CACHE entries each)
// =============================================================================

import type { SourceId } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// 1. STABLE ARTICLE FINGERPRINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * djb2 hash of (url + normalised title).
 * Produces the same fingerprint for the same story across sources.
 * Used as cache key for incremental processing.
 *
 * Collision probability at 10K articles: ~0.005% — acceptable for a cache key
 * (a collision means one article is re-processed, not a correctness error).
 */
export function articleFingerprint(url: string, title: string): string {
  const input = `${url.toLowerCase().replace(/[?#].*$/, "")}|${title.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    hash = hash & hash; // 32-bit
  }
  return (hash >>> 0).toString(36); // unsigned, base-36 for compactness
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DATE PARSE CACHE
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DATE_CACHE = 2000; // max cached ISO strings (bounded memory)

/** Module-level cache: ISO string → timestamp (ms). */
const _dateCache = new Map<string, number>();

/**
 * Parse an ISO date string to timestamp, using a module-level cache.
 * Avoids repeated Date.parse() calls on the same string.
 * Returns Date.now() for invalid/empty inputs.
 */
export function cachedDateMs(iso: string): number {
  if (!iso) return Date.now();

  const cached = _dateCache.get(iso);
  if (cached !== undefined) return cached;

  const ms = Date.parse(iso);
  const result = isNaN(ms) ? Date.now() : ms;

  if (_dateCache.size >= MAX_DATE_CACHE) {
    // Evict oldest 20% when full
    const keys = Array.from(_dateCache.keys()).slice(0, Math.ceil(MAX_DATE_CACHE * 0.2));
    for (const k of keys) _dateCache.delete(k);
  }

  _dateCache.set(iso, result);
  return result;
}

/** Format a cached timestamp as relative time string ("2h ago"). */
export function cachedRelativeTime(iso: string): string {
  const ms   = cachedDateMs(iso);
  const diff = Date.now() - ms;
  const m    = Math.floor(diff / 60_000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LOWERCASE CACHE
// ─────────────────────────────────────────────────────────────────────────────

const MAX_LCASE_CACHE = 1000;
const _lcaseCache = new Map<string, string>();

/**
 * .toLowerCase() with module-level caching.
 * Titles are lowercased during search filtering, dedup tokenization, and
 * category classification — potentially 4-8× per article per pipeline run.
 */
export function cachedLower(s: string): string {
  const cached = _lcaseCache.get(s);
  if (cached !== undefined) return cached;

  const result = s.toLowerCase();

  if (_lcaseCache.size >= MAX_LCASE_CACHE) {
    const keys = Array.from(_lcaseCache.keys()).slice(0, Math.ceil(MAX_LCASE_CACHE * 0.2));
    for (const k of keys) _lcaseCache.delete(k);
  }

  _lcaseCache.set(s, result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SOURCE FRESHNESS DECAY
// ─────────────────────────────────────────────────────────────────────────────

const FRESHNESS_FULL_HOURS  = 6;   // ≤ 6h since last fetch → freshness = 1.0
const FRESHNESS_FLOOR       = 0.5; // floor: silent sources still get 50% weight
const FRESHNESS_DECAY_HOURS = 24;  // 24h silence → reaches the floor

/**
 * Source freshness score [0.5, 1.0].
 *
 * Returns 1.0 when the source was fetched in the last 6 hours.
 * Decays linearly from 1.0 to 0.5 between 6h and 24h of silence.
 * Never drops below 0.5 — a silent source is uncertain, not wrong.
 *
 * @param lastFetchedAt ISO timestamp of the source's most recent successful fetch
 */
export function sourceFreshnessScore(lastFetchedAt: string | undefined): number {
  if (!lastFetchedAt) return 0.8; // unknown freshness → assume recent-ish

  const ageMs    = Date.now() - cachedDateMs(lastFetchedAt);
  const ageHours = ageMs / 3_600_000;

  if (ageHours <= FRESHNESS_FULL_HOURS) return 1.0;

  const decay = (ageHours - FRESHNESS_FULL_HOURS) / (FRESHNESS_DECAY_HOURS - FRESHNESS_FULL_HOURS);
  return Math.max(FRESHNESS_FLOOR, 1.0 - decay * (1.0 - FRESHNESS_FLOOR));
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. INCREMENTAL PROCESSING REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Module-level registry of article fingerprints seen in the CURRENT server
 * isolate's lifetime. Bounded at MAX_SEEN entries.
 *
 * Purpose: skip re-normalizing articles that appeared in a previous ingest
 * cycle and haven't changed. This is the groundwork for incremental processing.
 *
 * NOT a cache of article data — only a seen-set of fingerprints.
 * Size is small: a fingerprint is a 6-char base-36 string (~6 bytes each).
 * MAX_SEEN = 5000 → ~30KB overhead.
 *
 * Edge isolate lifetime: Vercel Edge Functions share module state within one
 * warm instance, across multiple requests. This is intentional — the registry
 * persists across the 5-minute poll cycle, enabling skip logic.
 */
const MAX_SEEN  = 5000;

/** { fingerprint → ingestCycleId } */
const _seenRegistry = new Map<string, string>();

/**
 * Returns true if this article was already processed in a recent cycle.
 * The caller can skip re-normalization and re-dedup for these articles.
 */
export function isAlreadySeen(fingerprint: string, cycleId: string): boolean {
  const seenIn = _seenRegistry.get(fingerprint);
  // Seen in the SAME cycle → skip. Seen in a DIFFERENT cycle → re-process.
  return seenIn === cycleId;
}

/**
 * Mark an article fingerprint as processed in this cycle.
 */
export function markSeen(fingerprint: string, cycleId: string): void {
  if (_seenRegistry.size >= MAX_SEEN) {
    // Evict oldest 20% — simple FIFO (Map insertion order)
    let evicted = 0;
    const limit = Math.ceil(MAX_SEEN * 0.2);
    for (const key of _seenRegistry.keys()) {
      _seenRegistry.delete(key);
      if (++evicted >= limit) break;
    }
  }
  _seenRegistry.set(fingerprint, cycleId);
}

/**
 * Count currently registered fingerprints (for observability).
 */
export function seenRegistrySize(): number {
  return _seenRegistry.size;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PAGINATION CURSOR UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export interface FeedCursor {
  /** Index of the last item delivered. Deterministic under stable sort. */
  offset:    number;
  /** trendingScore of the last item — used for keyset pagination in future. */
  lastScore: number;
  /** ISO timestamp — for time-based cursor pagination in future. */
  lastPublishedAt: string;
  /** Total available articles at time of cursor creation. */
  total:     number;
}

/**
 * Build a cursor for the current page response.
 * Clients can pass this back as `?cursor=<encoded>` in future API versions.
 * Currently: base64-encoded JSON (lightweight, no crypto needed).
 */
export function buildCursor(
  offset:         number,
  limit:          number,
  total:          number,
  lastArticle:    { trendingScore: number; publishedAt: string } | undefined
): string {
  const cursor: FeedCursor = {
    offset:          offset + limit,
    lastScore:       lastArticle?.trendingScore ?? 0,
    lastPublishedAt: lastArticle?.publishedAt  ?? new Date().toISOString(),
    total,
  };
  // btoa is available in Edge Runtime (WHATWG global)
  try {
    return btoa(JSON.stringify(cursor));
  } catch {
    return "";
  }
}

/**
 * Parse a cursor string back to FeedCursor.
 * Returns null on any parse failure — callers fall back to offset=0.
 */
export function parseCursor(encoded: string): FeedCursor | null {
  if (!encoded) return null;
  try {
    return JSON.parse(atob(encoded)) as FeedCursor;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PERSONALIZATION FOUNDATION (client-side only, no persistence)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Category affinity tracker.
 * Records how many article opens come from each category.
 * Stored in sessionStorage so it clears on tab close (no privacy surface).
 *
 * Usage in components:
 *   categoryAffinity.record("AI");
 *   const top = categoryAffinity.top(3); // ["AI", "Startups", "Crypto"]
 *
 * Future use: weight article ranking by affinity score.
 * Currently: infrastructure only — no ranking integration yet.
 */
const AFFINITY_KEY = "tp_cat_affinity";

export const categoryAffinity = {
  record(category: string): void {
    if (typeof sessionStorage === "undefined") return;
    try {
      const raw    = sessionStorage.getItem(AFFINITY_KEY) ?? "{}";
      const scores = JSON.parse(raw) as Record<string, number>;
      scores[category] = (scores[category] ?? 0) + 1;
      sessionStorage.setItem(AFFINITY_KEY, JSON.stringify(scores));
    } catch { /* non-fatal */ }
  },

  top(n: number): string[] {
    if (typeof sessionStorage === "undefined") return [];
    try {
      const raw    = sessionStorage.getItem(AFFINITY_KEY) ?? "{}";
      const scores = JSON.parse(raw) as Record<string, number>;
      return Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([cat]) => cat);
    } catch { return []; }
  },

  all(): Record<string, number> {
    if (typeof sessionStorage === "undefined") return {};
    try {
      return JSON.parse(sessionStorage.getItem(AFFINITY_KEY) ?? "{}") as Record<string, number>;
    } catch { return {}; }
  },

  clear(): void {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(AFFINITY_KEY);
  },
};

/**
 * Article impression tracker.
 * Records which article IDs have been shown in the current session.
 * Future use: avoid re-showing seen articles or weight unseen articles higher.
 */
const IMPRESSIONS_KEY = "tp_impressions";

export const articleImpressions = {
  record(articleId: number): void {
    if (typeof sessionStorage === "undefined") return;
    try {
      const raw  = sessionStorage.getItem(IMPRESSIONS_KEY) ?? "[]";
      const seen = JSON.parse(raw) as number[];
      if (!seen.includes(articleId)) {
        seen.push(articleId);
        // Cap at 500 to avoid sessionStorage bloat
        const trimmed = seen.slice(-500);
        sessionStorage.setItem(IMPRESSIONS_KEY, JSON.stringify(trimmed));
      }
    } catch { /* non-fatal */ }
  },

  has(articleId: number): boolean {
    if (typeof sessionStorage === "undefined") return false;
    try {
      const raw  = sessionStorage.getItem(IMPRESSIONS_KEY) ?? "[]";
      return (JSON.parse(raw) as number[]).includes(articleId);
    } catch { return false; }
  },

  count(): number {
    if (typeof sessionStorage === "undefined") return 0;
    try {
      return (JSON.parse(sessionStorage.getItem(IMPRESSIONS_KEY) ?? "[]") as unknown[]).length;
    } catch { return 0; }
  },
};

/**
 * Reading time tracker.
 * Records how long a user spent viewing each article (article open → article close).
 * Future use: "time spent" is a strong engagement signal for personalized ranking.
 */
const READING_KEY = "tp_reading";

export const readingTimeTracker = {
  start(articleId: number): () => void {
    const began = Date.now();
    return () => {
      const seconds = Math.round((Date.now() - began) / 1000);
      if (seconds < 2 || typeof sessionStorage === "undefined") return;
      try {
        const raw     = sessionStorage.getItem(READING_KEY) ?? "{}";
        const times   = JSON.parse(raw) as Record<number, number>;
        times[articleId] = Math.max(times[articleId] ?? 0, seconds);
        sessionStorage.setItem(READING_KEY, JSON.stringify(times));
      } catch { /* non-fatal */ }
    };
  },

  get(articleId: number): number {
    if (typeof sessionStorage === "undefined") return 0;
    try {
      const raw = JSON.parse(sessionStorage.getItem(READING_KEY) ?? "{}") as Record<number, number>;
      return raw[articleId] ?? 0;
    } catch { return 0; }
  },
};