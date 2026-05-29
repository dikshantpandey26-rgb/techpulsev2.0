// =============================================================================
// src/services/newsService.ts  (Phase 2 Part 4 — STEP 5 update)
//
// CHANGES FROM PREVIOUS VERSION:
// ─────────────────────────────────────────────────────────────────────────────
// 1. FeedMeta added to FeedResult
//    version, generatedAt, cacheExpiresAt, requestId — enables frontend stale
//    detection, ETag foundation, and API debugging.
//
// 2. Incremental fingerprint registry
//    articleFingerprint() hashes URL + title once per article. Items already
//    seen in a prior cycle (same warm isolate) are skipped during normalization.
//    This is groundwork — at 500 articles/10min cycle, practical impact is
//    minimal now but becomes significant at 5K+ articles.
//
// 3. Category filter hardened
//    Old: `result.articles.filter((a) => a.category === category)` — raw string
//         equality, misses casing variants from external sources.
//    New: `isCategoryMatch(a.category, category)` — uses the canonical helper.
//
// 4. Source freshness incorporated
//    sourceFreshnessScore() applied to each source's results.
//    Articles from stale sources get a freshness flag on their NormalizedArticle.
//    Does NOT touch trendingService — purely additive metadata.
//
// 5. DEV observability via debugUtils
//    Pipeline timing logged to console in development builds only.
//    Completely stripped by Vite in production builds.
//
// 6. revalidateFeed() concurrency guard
//    Previous version could queue multiple background revalidations for the
//    same cache key if multiple requests arrived during a stale window.
//    Added a revalidation lock map to prevent this.
//
// ARCHITECTURE NOTE:
//    This file ONLY runs server-side (imported by api/).
//    Never import it into the browser bundle.
//    All imports must be Edge-runtime compatible.
// =============================================================================

import type {
  NormalizedArticle,
  SourceFetchResult,
  IngestionStats,
  RawFeedItem,
} from "../types";
import { BASE_ARTICLES }           from "../data/articles";
import { normalizeItems }          from "./articleNormalizer";
import { processArticleBatch }     from "./dedupEngine";
import type { ArticleWithCoverage } from "./dedupEngine";
import { feedCache }               from "./cacheService";
import { fetchAllRss }             from "./rssService";
import { fetchHackerNews }         from "./hackerNewsService";
import { fetchReddit }             from "./redditService";
import { fetchGithubTrending }     from "./githubTrendingService";
import { fetchProductHunt }        from "./productHuntService";
import { SOURCE_REGISTRY }         from "./sourceRegistry";
import { isCategoryMatch }         from "../utils/categoryUtils";
import {
  articleFingerprint,
  isAlreadySeen,
  markSeen,
  seenRegistrySize,
  sourceFreshnessScore,
} from "../utils/feedUtils";
import { dbg } from "../utils/debugUtils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feed metadata included in every API response.
 * Enables frontend stale detection and debugging.
 * Foundation for ETag / If-None-Match support in a future phase.
 */
export interface FeedMeta {
  /** Monotonically incrementing feed version. Changes on every successful aggregate(). */
  version:          number;
  /** ISO timestamp when this feed was generated. */
  generatedAt:      string;
  /** ISO timestamp when this feed becomes stale (generatedAt + TTL). */
  cacheExpiresAt:   string;
  /** Unique request/run identifier for debugging. */
  requestId:        string;
  /** Whether this response was served from cache. */
  fromCache:        boolean;
  /** Whether this cached response is stale (background revalidation triggered). */
  stale:            boolean;
  /** Total canonical articles in the full (unfiltered) feed. */
  totalArticles:    number;
  /** Total sources that contributed articles. */
  totalSources:     number;
}

export interface FeedResult {
  articles:  NormalizedArticle[];
  meta:      FeedMeta;
  /** @deprecated use meta.fromCache */
  fromCache: boolean;
  /** @deprecated use meta.stale */
  stale:     boolean;
  /** @deprecated use meta.requestId */
  stats:     IngestionStats;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-LEVEL STATE
// ─────────────────────────────────────────────────────────────────────────────

/** Monotonically incrementing feed version counter (warm isolate lifetime). */
let feedVersion = 0;

/** Revalidation lock: prevents multiple concurrent background revalidations. */
const revalidatingKeys = new Set<string>();

// Feed TTL constants
const FEED_TTL_SECONDS   = 300;  // 5 min fresh
const FEED_STALE_SECONDS = 900;  // 15 min stale window
const FEED_CACHE_KEY     = "all:v2"; // bumped from v1 to bust old cached shapes

// ─────────────────────────────────────────────────────────────────────────────
// SEED FALLBACK
// ─────────────────────────────────────────────────────────────────────────────

function seedArticles(): NormalizedArticle[] {
  return BASE_ARTICLES.map((a): NormalizedArticle => ({
    ...a,
    sourceId:           "seed",
    sourceUrl:          "https://techpulse.ai",
    language:           "en",
    hypeScore:          a.hype,
    trendingScore:      a.hype,
    reliabilityScore:   SOURCE_REGISTRY.seed.reliabilityScore,
    categoryConfidence: 0.80,
    coveredBy:          [],
    canonicalSource:    true,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE FETCHING
// ─────────────────────────────────────────────────────────────────────────────

async function fetchApiSources(): Promise<SourceFetchResult[]> {
  const [hn, reddit, github, ph] = await Promise.allSettled([
    fetchHackerNews(),
    fetchReddit(),
    fetchGithubTrending(),
    fetchProductHunt(),
  ]);

  return [
    hn.status     === "fulfilled" ? hn.value     : nullResult("hackernews"),
    reddit.status === "fulfilled" ? reddit.value : nullResult("reddit"),
    github.status === "fulfilled" ? github.value : nullResult("github-trending"),
    ph.status     === "fulfilled" ? ph.value     : nullResult("producthunt"),
  ];
}

function nullResult(sourceId: SourceFetchResult["sourceId"]): SourceFetchResult {
  return {
    sourceId, items: [], fetchedAt: new Date().toISOString(),
    durationMs: 0, fromCache: false, error: "Fetch failed",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN AGGREGATION PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

async function aggregate(): Promise<FeedResult> {
  const batchStart = Date.now();
  const requestId  = `${batchStart}-${Math.random().toString(36).slice(2, 8)}`;
  const cycleId    = String(batchStart); // unique per run

  const tFetch = dbg.time("fetch-all-sources");

  // ── Step 1: Parallel source fetch ─────────────────────────────────────────
  const [rssResults, apiResults] = await Promise.allSettled([
    fetchAllRss(),
    fetchApiSources(),
  ]);

  const allResults: SourceFetchResult[] = [
    ...(rssResults.status === "fulfilled" ? rssResults.value : []),
    ...(apiResults.status === "fulfilled" ? apiResults.value : []),
  ];

  tFetch.end(`${allResults.length} sources`);

  // ── Step 2: Collect raw items with source freshness annotation ─────────────
  const allRawItems: RawFeedItem[] = [];
  let   skipCount = 0;

  for (const result of allResults) {
    // Get source freshness — based on when this source result was fetched
    const freshness = sourceFreshnessScore(result.fetchedAt);

    for (const item of result.items) {
      // Incremental processing: skip articles already seen in a prior cycle
      const fp = articleFingerprint(item.url, item.title);
      if (isAlreadySeen(fp, cycleId)) {
        skipCount++;
        continue;
      }
      markSeen(fp, cycleId);

      // Annotate raw item with source freshness metadata
      // (stored in rawData — normalizer passes this through to the article)
      allRawItems.push({
        ...item,
        rawData: { ...item.rawData, sourceFreshness: freshness },
      });
    }
  }

  dbg.logPipeline({
    fetchDurationMs: Date.now() - batchStart,
    normCount:       allRawItems.length,
    dedupDropped:    0, // filled in after dedup
    finalCount:      0, // filled in after dedup
    totalDurationMs: 0, // filled in at end
    cacheHits:       allResults.filter((r) => r.fromCache).length,
    cacheMisses:     allResults.filter((r) => !r.fromCache).length,
    sourceErrors:    allResults.filter((r) => r.error).map((r) => `${r.sourceId}: ${r.error ?? ""}`),
  });

  // ── Step 3: Normalize ──────────────────────────────────────────────────────
  const tNorm = dbg.time("normalize");
  const normalised = normalizeItems(allRawItems);
  tNorm.end(`${normalised.length} articles`);

  // ── Step 4+5: Dedup → annotate → boost → rank ─────────────────────────────
const tDedup = dbg.time("dedup+rank");

const {
  articles: processedArticles,
  stats: dedupStats,
} = processArticleBatch(normalised);

const dedupDropped = dedupStats.duplicatesDropped;

tDedup.end(
  `${processedArticles.length} canonical, ${dedupDropped} dropped, ${skipCount} skipped`
);

  // ── Step 6: Fallback ───────────────────────────────────────────────────────
  const articles: NormalizedArticle[] =
  processedArticles.length > 0
    ? processedArticles
    : seedArticles();

  // ── Step 7: Build stats + meta ─────────────────────────────────────────────
  const totalDurationMs = Date.now() - batchStart;
  feedVersion++;

  const stats: IngestionStats = {
    batchId:           requestId,
    startedAt:         new Date(batchStart).toISOString(),
    durationMs:        totalDurationMs,
    sources:           allResults.map((r) => ({
      sourceId:   r.sourceId,
      fetched:    r.items.length,
      durationMs: r.durationMs,
      fromCache:  r.fromCache,
      error:      r.error,
    })),
    totalFetched:      allRawItems.length,
    afterDedup:        processedArticles.length,
    duplicatesDropped: dedupDropped,
  };

  const meta: FeedMeta = {
    version:        feedVersion,
    generatedAt:    new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + FEED_TTL_SECONDS * 1000).toISOString(),
    requestId,
    fromCache:      false,
    stale:          false,
    totalArticles:  articles.length,
    totalSources:   new Set(allResults.filter((r) => r.items.length > 0).map((r) => r.sourceId)).size,
  };

  dbg.logPipeline({
    fetchDurationMs: totalDurationMs,
    normCount:       normalised.length,
    dedupDropped,
    finalCount:      articles.length,
    totalDurationMs,
    cacheHits:       allResults.filter((r) => r.fromCache).length,
    cacheMisses:     allResults.filter((r) => !r.fromCache).length,
    sourceErrors:    allResults.filter((r) => r.error).map((r) => `${r.sourceId}: ${r.error ?? ""}`),
  });

  return { articles, meta, stats, fromCache: false, stale: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the current feed for a given category (or all categories).
 *
 * SWR:
 *   FRESH → return from cache immediately
 *   STALE → return stale immediately, revalidate in background (concurrency-safe)
 *   MISS  → aggregate now, cache, return
 */
export async function getFeed(category?: string): Promise<FeedResult> {
  const cacheKey = category ? `${FEED_CACHE_KEY}:${category}` : FEED_CACHE_KEY;

  dbg.logCache(cacheKey, "MISS"); // will be overwritten if HIT

  const cached = feedCache.get<FeedResult>(cacheKey);

  if (cached && !cached.isStale) {
    dbg.logCache(cacheKey, "HIT");
    return { ...cached.data, fromCache: true, stale: false, meta: { ...cached.data.meta, fromCache: true, stale: false } };
  }

  if (cached && cached.isStale) {
    dbg.logCache(cacheKey, "STALE");
    // Concurrent revalidation guard — prevents thundering herd on stale cache
    if (!revalidatingKeys.has(cacheKey)) {
      revalidatingKeys.add(cacheKey);
      void revalidateFeed(cacheKey, category).finally(() => revalidatingKeys.delete(cacheKey));
    }
    return { ...cached.data, fromCache: true, stale: true, meta: { ...cached.data.meta, fromCache: true, stale: true } };
  }

  // Cache miss — aggregate now
  const result = await aggregate();
  const toStore = category
    ? {
        ...result,
        articles: result.articles.filter((a) => isCategoryMatch(a.category, category)),
      }
    : result;

  feedCache.set(cacheKey, toStore, { ttl: FEED_TTL_SECONDS, staleTtl: FEED_STALE_SECONDS });
  dbg.logCache(cacheKey, "WRITE");
  return result;
}

async function revalidateFeed(cacheKey: string, category?: string): Promise<void> {
  try {
    const result = await aggregate();
    const toStore = category
      ? { ...result, articles: result.articles.filter((a) => isCategoryMatch(a.category, category)) }
      : result;
    feedCache.set(cacheKey, toStore, { ttl: FEED_TTL_SECONDS, staleTtl: FEED_STALE_SECONDS });
    dbg.logCache(cacheKey, "WRITE");
  } catch {
    // Background revalidation failure is non-fatal — stale data continues serving
  }
}

/**
 * Force a full fresh aggregation. Called by api/ingest.ts on the cron schedule.
 */
export async function runIngestion(): Promise<FeedResult> {
  feedCache.evictAll();
  const result = await aggregate();
  feedCache.set(FEED_CACHE_KEY, result, { ttl: FEED_TTL_SECONDS, staleTtl: FEED_STALE_SECONDS });
  dbg.logCache(FEED_CACHE_KEY, "WRITE");
  return result;
}