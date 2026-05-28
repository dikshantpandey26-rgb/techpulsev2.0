// =============================================================================
// src/services/newsService.ts
//
// Central news aggregation orchestrator.
//
// This is the ONLY file that api/ingest.ts and api/articles.ts interact with
// for article data. All source adapters are called from here.
//
// Pipeline:
//   1. Parallel fetch from all enabled sources (RSS + HN + Reddit + GitHub)
//   2. Normalise raw items → NormalizedArticle[]
//   3. Deduplicate: collapse N articles about the same story → 1 canonical
//   4. Rank: compute trendingScore for every article
//   5. Cache the ranked result with SWR headers
//   6. Return — or fall back to seed data if all sources fail
//
// Fallback strategy (in order):
//   a) Stale cached result (served immediately, revalidation fires in background)
//   b) Partial results (some sources succeeded, return what we have)
//   c) Static seed articles from src/data/articles.ts (never empty feed)
//
// Vercel Edge compatibility:
//   All adapters use standard fetch + AbortController. No Node-only APIs.
//   The orchestrator itself is also Edge-safe.
//
// Performance:
//   All source fetches run in parallel (Promise.allSettled).
//   Normalisation is synchronous O(n) on a small n (< 300).
//   Dedup is O(n²) in the worst case but bounded by per-source limits.
//   Total wall-clock time is dominated by the slowest source, typically < 4s.
//
// This file ONLY runs server-side (imported by api/).
// Never import it into the browser bundle.
// =============================================================================

import type {
    NormalizedArticle,
    SourceFetchResult,
    IngestionStats,
    RawFeedItem,
  } from "../types";
  import { BASE_ARTICLES }           from "../data/articles";
  import { normalizeItems }          from "./articleNormalizer";
  //import { deduplicateArticles }     from "./articleDedupService";
  //import { rankArticles }            from "./trendingService";
  import { processArticleBatch } from "./dedupEngine";
  import { feedCache }               from "./cacheService";
  import { fetchAllRss }             from "./rssService";
  import { fetchHackerNews }         from "./hackerNewsService";
  import { fetchReddit }             from "./redditService";
  import { fetchGithubTrending }     from "./githubTrendingService";
  import { fetchProductHunt }        from "./productHuntService";
  import { SOURCE_REGISTRY }         from "./sourceRegistry";
  
  // ── Types ─────────────────────────────────────────────────────────────────────
  
  export interface FeedResult {
    articles:    NormalizedArticle[];
    stats:       IngestionStats;
    fromCache:   boolean;
    stale:       boolean;
  }
  
  // ── Seed data fallback ────────────────────────────────────────────────────────
  
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
  
  // ── Fetch all JSON-API sources ────────────────────────────────────────────────
  
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
    return { sourceId, items: [], fetchedAt: new Date().toISOString(), durationMs: 0, fromCache: false, error: "Fetch failed" };
  }
  
  // ── Main aggregation ──────────────────────────────────────────────────────────
  
  async function aggregate(): Promise<FeedResult> {
    const batchStart = Date.now();
    const batchId    = `${batchStart}-${Math.random().toString(36).slice(2, 8)}`;
  
    // ── Step 1: Parallel source fetching
    const [rssResults, apiResults] = await Promise.allSettled([
      fetchAllRss(),
      fetchApiSources(),
    ]);
  
    const allResults: SourceFetchResult[] = [
      ...(rssResults.status  === "fulfilled" ? rssResults.value  : []),
      ...(apiResults.status  === "fulfilled" ? apiResults.value  : []),
    ];
  
    // ── Step 2: Collect all raw items
    const allRawItems: RawFeedItem[] = [];
    for (const result of allResults) {
      allRawItems.push(...result.items);
    }
  
    // ── Step 3: Normalise
    const normalised = normalizeItems(allRawItems);
  
    // ── Step 4 + 5: Dedup + annotate + rank
    const processed = processArticleBatch(normalised);

// ── Step 6: If pipeline produced nothing, use seed data
    const articles =
        processed.articles.length > 0
          ? processed.articles
          : seedArticles();
  
    // ── Step 7: Build stats
    const stats: IngestionStats = {
      batchId,
      startedAt:   new Date(batchStart).toISOString(),
      durationMs:  Date.now() - batchStart,
      sources:     allResults.map((r) => ({
        sourceId:   r.sourceId,
        fetched:    r.items.length,
        durationMs: r.durationMs,
        fromCache:  r.fromCache,
        error:      r.error,
      })),
      totalFetched:     allRawItems.length,
      afterDedup: processed.articles.length,
      duplicatesDropped: processed.stats.duplicatesDropped,
    };
  
    return { articles, stats, fromCache: false, stale: false };
  }
  
  // ── Cached feed getter ────────────────────────────────────────────────────────
  
  const FEED_CACHE_KEY = "all:v1";
  
  /**
   * Get the current article feed.
   *
   * SWR behaviour:
   *   FRESH  → return cache immediately
   *   STALE  → return cache immediately, revalidate in background
   *   MISS   → aggregate now, cache, return
   *
   * @param category - Optional CategoryKey to filter; omit for all categories
   */
  export async function getFeed(category?: string): Promise<FeedResult> {
    const cacheKey = category ? `${FEED_CACHE_KEY}:${category}` : FEED_CACHE_KEY;
  
    const cached = feedCache.get<FeedResult>(cacheKey);
  
    if (cached && !cached.isStale) {
      return { ...cached.data, fromCache: true, stale: false };
    }
  
    if (cached && cached.isStale) {
      // Return stale data immediately; fire revalidation in background
      void revalidateFeed(cacheKey, category);
      return { ...cached.data, fromCache: true, stale: true };
    }
  
    // Cache miss — aggregate now
    const result = await aggregate();
  
    const toCache = category
      ? { ...result, articles: result.articles.filter((a) => a.category === category) }
      : result;
  
    feedCache.set(cacheKey, toCache, { ttl: 300, staleTtl: 900 });
    return result;
  }
  
  async function revalidateFeed(cacheKey: string, category?: string): Promise<void> {
    try {
      const result = await aggregate();
      const toCache = category
        ? { ...result, articles: result.articles.filter((a) => a.category === category) }
        : result;
      feedCache.set(cacheKey, toCache, { ttl: 300, staleTtl: 900 });
    } catch {
      // Background revalidation failure is non-fatal — stale data continues serving
    }
  }
  
  /**
   * Force a fresh aggregation run regardless of cache state.
   * Called by api/ingest.ts on the cron schedule.
   */
  export async function runIngestion(): Promise<FeedResult> {
    feedCache.evictAll();
    const result = await aggregate();
    feedCache.set(FEED_CACHE_KEY, result, { ttl: 300, staleTtl: 900 });
    return result;
  }