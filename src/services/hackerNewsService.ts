// =============================================================================
// src/services/hackerNewsService.ts
//
// Hacker News ingestion via the official Firebase REST API.
// No auth required. Edge-compatible (standard fetch only).
//
// Strategy:
//   1. Fetch /topstories.json → array of up to 500 story IDs
//   2. Take the top N IDs (20 by default)
//   3. Fetch individual story items in parallel with concurrency cap
//   4. Filter out Ask HN, Show HN, job posts, and self-posts with no URL
//   5. Map to RawFeedItem normalised format
//
// Concurrency cap:
//   Fetching 20 items simultaneously is fine; fetching 500 would hit Firebase
//   rate limits and slow down the entire ingest run.
//
// Caching:
//   Top story IDs are cached for 3 minutes (HN updates fast).
//   Individual item details are cached for 10 minutes.
// =============================================================================

import type { RawFeedItem, SourceFetchResult, HNStory } from "../types";
import { sourceCache } from "./cacheService";

const HN_API        = "https://hacker-news.firebaseio.com/v0";
const STORY_LIMIT   = 20;
const CONCURRENCY   = 5;   // max parallel item fetches
const TIMEOUT_MS    = 6_000;

const SKIP_PREFIXES = ["Ask HN:", "Tell HN:", "Show HN:", "Launch HN:", "Poll:"];

// ── Firebase fetch helpers ────────────────────────────────────────────────────

async function hnFetch<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${HN_API}${path}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function fetchStoryIds(): Promise<number[]> {
  const cached = sourceCache.get<number[]>("hn:top-ids");
  if (cached && !cached.isStale) return cached.data;

  const ids = await hnFetch<number[]>("/topstories.json");
  if (!ids || !Array.isArray(ids)) return [];

  sourceCache.set("hn:top-ids", ids, { ttl: 180 });
  return ids;
}

async function fetchStory(id: number): Promise<HNStory | null> {
  const cacheKey = `hn:item:${id}`;
  const cached   = sourceCache.get<HNStory>(cacheKey);
  if (cached) return cached.data;

  const story = await hnFetch<HNStory>(`/item/${id}.json`);
  if (story) sourceCache.set(cacheKey, story, { ttl: 600 });
  return story;
}

// ── Parallel fetch with concurrency limit ─────────────────────────────────────

async function fetchWithConcurrency<T, R>(
  items:     T[],
  fn:        (item: T) => Promise<R | null>,
  limit:     number
): Promise<Array<R | null>> {
  const results: Array<R | null> = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch  = items.slice(i, i + limit);
    const chunk  = await Promise.all(batch.map(fn));
    results.push(...chunk);
  }
  return results;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchHackerNews(): Promise<SourceFetchResult> {
  const start = Date.now();

  try {
    const ids = await fetchStoryIds();
    if (ids.length === 0) {
      return { sourceId: "hackernews", items: [], fetchedAt: new Date().toISOString(), durationMs: Date.now() - start, fromCache: false, error: "No story IDs returned" };
    }

    const topIds  = ids.slice(0, STORY_LIMIT * 2); // fetch extra to allow filtering
    const stories = await fetchWithConcurrency(topIds, fetchStory, CONCURRENCY);

    const items: RawFeedItem[] = stories
      .filter((s): s is HNStory => s !== null && !!s.url && s.score >= 10)
      .filter((s) => !SKIP_PREFIXES.some((p) => s.title.startsWith(p)))
      .slice(0, STORY_LIMIT)
      .map((s): RawFeedItem => ({
        sourceId:    "hackernews",
        title:       s.title,
        url:         s.url ?? `https://news.ycombinator.com/item?id=${s.id}`,
        description: `${s.score} points · ${s.descendants ?? 0} comments · by ${s.by}`,
        author:      s.by,
        imageUrl:    "",
        publishedAt: new Date(s.time * 1000).toISOString(),
        tags:        [],
        score:       s.score,
        comments:    s.descendants ?? 0,
        rawData:     { hnId: s.id },
      }));

    return {
      sourceId:   "hackernews",
      items,
      fetchedAt:  new Date().toISOString(),
      durationMs: Date.now() - start,
      fromCache:  false,
    };

  } catch (err) {
    return {
      sourceId:   "hackernews",
      items:      [],
      fetchedAt:  new Date().toISOString(),
      durationMs: Date.now() - start,
      fromCache:  false,
      error:      err instanceof Error ? err.message : String(err),
    };
  }
}