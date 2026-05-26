// =============================================================================
// src/services/redditService.ts
//
// Reddit tech subreddit ingestion via the public JSON API.
// No OAuth required — Reddit's public .json endpoint works without auth
// for top/hot posts on public subreddits.
//
// Design notes:
// • Fetches r/{sub}/top.json?limit=10&t=day for each subreddit.
// • Filters: min score 10, no NSFW, no stickied, external links only.
// • Score carries into RawFeedItem.score for trendingService weighting.
// • Self posts (is_self=true) with no external URL are skipped unless
//   they have score > 200 (high-quality discussion worth surfacing).
// • Rate limiting: Reddit limits ~60 requests/min for unauthenticated clients.
//   We only make 6 requests total per ingest run — well within limits.
// =============================================================================

import type { RawFeedItem, SourceFetchResult, RedditListing, RedditPost } from "../types";
import { REDDIT_SUBREDDITS } from "./sourceRegistry";
import { sourceCache } from "./cacheService";

const REDDIT_BASE    = "https://www.reddit.com";
const TIMEOUT_MS     = 8_000;
const MIN_SCORE      = 10;
const SELF_POST_MIN  = 200;  // allow high-quality self posts
const MAX_PER_SUB    = 10;

async function fetchSubreddit(subreddit: string): Promise<RedditPost[]> {
  const cacheKey = `reddit:${subreddit}`;
  const cached   = sourceCache.get<RedditPost[]>(cacheKey);
  if (cached && !cached.isStale) return cached.data;

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${REDDIT_BASE}/r/${subreddit}/top.json?limit=${MAX_PER_SUB}&t=day`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "TechPulse/2.0 (+https://techpulse.ai/bot)",
        "Accept":     "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!res.ok) return [];

    const data = await res.json() as RedditListing;
    const posts = data?.data?.children ?? [];

    sourceCache.set(cacheKey, posts, { ttl: 300 });
    return posts;

  } catch {
    clearTimeout(timer);
    return [];
  }
}

function redditPostToRawItem(post: RedditPost): RawFeedItem | null {
  const d = post.data;

  // Filter out NSFW and stickied posts
  if ((d as Record<string, unknown>)["over_18"] === true) return null;
  if ((d as Record<string, unknown>)["stickied"] === true) return null;

  const isSelf = d.is_self;

  // For self-posts: only include if very high score (rich discussion)
  if (isSelf && d.score < SELF_POST_MIN) return null;
  if (!isSelf && d.score < MIN_SCORE)   return null;

  // URL: for self-posts use the Reddit discussion link; for links use the link
  const url = isSelf
    ? `${REDDIT_BASE}${d.permalink}`
    : d.url;

  // Thumbnail — Reddit provides "self", "default", "nsfw", or actual URLs
  const thumbnail = !d.thumbnail.startsWith("http") ? "" : d.thumbnail;

  return {
    sourceId:    "reddit",
    title:       d.title.slice(0, 250),
    url,
    description: d.selftext
      ? d.selftext.slice(0, 400)
      : `r/${d.subreddit} · ${d.score} upvotes · ${d.num_comments} comments`,
    author:      d.author,
    imageUrl:    thumbnail,
    publishedAt: new Date(d.created_utc * 1000).toISOString(),
    tags:        [d.subreddit.toLowerCase()],
    score:       d.score,
    comments:    d.num_comments,
    rawData:     { subreddit: d.subreddit, redditId: d.id },
  };
}

export async function fetchReddit(): Promise<SourceFetchResult> {
  const start = Date.now();

  try {
    // Fetch all subreddits in parallel
    const allPosts = await Promise.all(
      REDDIT_SUBREDDITS.map((s) => fetchSubreddit(s.name))
    );

    const items: RawFeedItem[] = [];
    const seenUrls = new Set<string>();

    for (const posts of allPosts) {
      for (const post of posts) {
        const item = redditPostToRawItem(post);
        if (!item) continue;

        // URL-level dedup within Reddit (same post can appear in multiple subs)
        const normUrl = item.url.split("?")[0] ?? item.url;
        if (seenUrls.has(normUrl)) continue;
        seenUrls.add(normUrl);

        items.push(item);
      }
    }

    // Sort by score descending so trendingService sees best posts first
    items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return {
      sourceId:   "reddit",
      items:      items.slice(0, 25),
      fetchedAt:  new Date().toISOString(),
      durationMs: Date.now() - start,
      fromCache:  false,
    };

  } catch (err) {
    return {
      sourceId:   "reddit",
      items:      [],
      fetchedAt:  new Date().toISOString(),
      durationMs: Date.now() - start,
      fromCache:  false,
      error:      err instanceof Error ? err.message : String(err),
    };
  }
}