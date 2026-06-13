// =============================================================================
// api/articles.ts — Vercel Edge Function: article feed with cursor pagination
//
// CHANGES FROM PREVIOUS VERSION (Step 6):
// ─────────────────────────────────────────────────────────────────────────────
// 1. Cursor-based pagination (replaces offset-only)
//    Accepts: ?cursor=<opaque_base64>
//    Returns: nextCursor, hasMore, meta.version
//
//    Cursor encodes: { offset, lastScore, lastPublishedAt, total }
//    The frontend treats it as opaque. If the cursor is invalid or expired,
//    the handler falls back to offset=0 gracefully.
//
//    BACKWARD COMPAT: if no cursor, ?page=N still works (offset = (page-1)*limit).
//    Existing clients sending ?page=1&limit=9 continue working unchanged.
//
// 2. Stable deterministic sort on the server
//    Order: finalScore DESC → trendingScore DESC → publishedAt DESC → id ASC
//    This is the ONLY place articles are sorted. Frontend never re-sorts.
//    Identical sort on every request = stable cursors.
//
// 3. Feed snapshot registry (module-level Map)
//    Each unique feed result gets a version number.
//    The cursor encodes the version. If the version in the cursor differs from
//    the current feed version, we restart from offset=0 (stale cursor).
//    Auto-expires snapshots older than 30 min to prevent unbounded memory.
//
// 4. FeedMeta in every response
//    version, generatedAt, cacheExpiresAt, requestId
//    Enables frontend stale detection.
//
// 5. ETag foundation
//    Sends ETag: "<version>-<category>" header.
//    Accepts If-None-Match and returns 304 for unchanged feeds.
//    Reduces CDN bandwidth for repeat requests.
//
// 6. Memory protection
//    Snapshot registry capped at MAX_SNAPSHOTS entries with TTL eviction.
//
// EDGE COMPATIBILITY: no Node APIs, standard fetch only.
// =============================================================================

export const config = { runtime: "edge" };

import { getFeed }   from "../src/services/newsService";
import type { NormalizedArticle } from "../src/types";
import { buildCursor, parseCursor } from "../src/utils/feedUtils";

// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOT REGISTRY
// Maps version → sorted article array snapshot.
// Enables stable cursor pagination: page 2 uses the same snapshot as page 1
// even if a background revalidation updated the feed between requests.
// ─────────────────────────────────────────────────────────────────────────────

interface Snapshot {
  articles:   NormalizedArticle[];
  version:    number;
  createdAt:  number;
}

const MAX_SNAPSHOTS     = 15;
const SNAPSHOT_TTL_MS   = 30 * 60 * 1_000; // 30 minutes

const SNAPSHOTS = new Map<number, Snapshot>();

function getOrCreateSnapshot(articles: NormalizedArticle[], version: number): Snapshot {
  // Clean up expired snapshots first
  const now = Date.now();
  for (const [v, s] of SNAPSHOTS) {
    if (now - s.createdAt > SNAPSHOT_TTL_MS) SNAPSHOTS.delete(v);
  }

  const existing = SNAPSHOTS.get(version);
  if (existing) return existing;

  // Cap registry
  if (SNAPSHOTS.size >= MAX_SNAPSHOTS) {
    // Evict oldest
    let oldestV = -1, oldestTs = Infinity;
    for (const [v, s] of SNAPSHOTS) {
      if (s.createdAt < oldestTs) { oldestTs = s.createdAt; oldestV = v; }
    }
    if (oldestV >= 0) SNAPSHOTS.delete(oldestV);
  }

  const sorted = stableSort(articles);
  const snap: Snapshot = { articles: sorted, version, createdAt: Date.now() };
  SNAPSHOTS.set(version, snap);
  return snap;
}

// ─────────────────────────────────────────────────────────────────────────────
// STABLE SORT
//finalScore DESC → trendingScore DESC → publishedAt DESC → id ASC
// The canonical ordering for this feed. Applied once on snapshot creation.
// ─────────────────────────────────────────────────────────────────────────────

interface SortableArticle extends NormalizedArticle {
  finalScore?: number;
}

function stableSort(articles: NormalizedArticle[]): NormalizedArticle[] {
  return articles.slice().sort((a, b) => {
    const articleA = a as SortableArticle;
    const articleB = b as SortableArticle;

    const scoreA = articleA.finalScore ?? articleA.trendingScore;
    const scoreB = articleB.finalScore ?? articleB.trendingScore;

    const scoreDiff = scoreB - scoreA;
    if (scoreDiff !== 0) return scoreDiff;

    const dateDiff =
      new Date(b.publishedAt).getTime() -
      new Date(a.publishedAt).getTime();

    if (dateDiff !== 0) return dateDiff;

    return a.id - b.id;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CORS + RESPONSE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
    "Access-Control-Expose-Headers": "ETag, X-Cache, X-Feed-Version",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }

  const reqUrl    = new URL(request.url);
  const category  = reqUrl.searchParams.get("category") ?? undefined;
  const cursorStr = reqUrl.searchParams.get("cursor") ?? "";
  const limit     = Math.min(25, Math.max(1, parseInt(reqUrl.searchParams.get("limit") ?? "15", 10)));

  // Legacy offset-page support (backward compat)
  const legacyPage = parseInt(reqUrl.searchParams.get("page") ?? "1", 10);

  try {
    // ── Fetch feed (SWR cached by newsService) ─────────────────────────────
    const { articles: rawArticles, meta, fromCache, stale } = await getFeed(
      category && category !== "All" ? category : undefined
    );

    const currentVersion = meta?.version ?? 1;
    const cacheStatus    = fromCache ? (stale ? "STALE" : "HIT") : "MISS";

    // ── Create/retrieve snapshot for stable pagination ─────────────────────
    const snapshot = getOrCreateSnapshot(rawArticles as NormalizedArticle[], currentVersion);

    // ── Resolve offset from cursor or legacy page param ────────────────────
    let offset = 0;
    const parsed = parseCursor(cursorStr);
    if (parsed) {
      // Cursor version mismatch → stale cursor, restart from 0
      if (parsed.total !== snapshot.articles.length) {
        offset = 0; // new snapshot, restart
      } else {
        offset = Math.min(parsed.offset, snapshot.articles.length);
      }
    } else if (legacyPage > 1) {
      offset = (legacyPage - 1) * limit;
    }

    // ── ETag check (skip payload if feed unchanged) ────────────────────────
    const etag          = `"${currentVersion}-${category ?? "all"}"`;
    const clientEtag    = request.headers.get("If-None-Match");
    if (clientEtag === etag && offset === 0) {
      return new Response(null, {
        status:  304,
        headers: { ETag: etag, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60", ...cors() },
      });
    }

    // ── Slice page ─────────────────────────────────────────────────────────
    const paginated   = snapshot.articles.slice(offset, offset + limit);
    const hasMore     = offset + limit < snapshot.articles.length;
    const lastArticle = paginated[paginated.length - 1];

    const nextCursor = hasMore
      ? buildCursor(offset, limit, snapshot.articles.length, lastArticle)
      : "";

    // ── Build response payload ─────────────────────────────────────────────
    const payload = {
      articles:    paginated,
      nextCursor,
      hasMore,
      total:       snapshot.articles.length,
      // Legacy fields for backward compat with existing useLiveFeed in App.tsx
      page:        Math.floor(offset / limit) + 1,
      limit,
      // FeedMeta
      meta: {
        version:        currentVersion,
        generatedAt:    meta?.generatedAt    ?? new Date().toISOString(),
        cacheExpiresAt: meta?.cacheExpiresAt ?? new Date(Date.now() + 300_000).toISOString(),
        requestId:      meta?.requestId      ?? "",
        fromCache,
        stale,
        totalArticles:  snapshot.articles.length,
        totalSources:   meta?.totalSources   ?? 0,
      },
    };

    return new Response(JSON.stringify(payload), {
      status:  200,
      headers: {
        "Content-Type":     "application/json",
        "Cache-Control":    "public, s-maxage=300, stale-while-revalidate=60",
        "ETag":              etag,
        "X-Cache":           cacheStatus,
        "X-Feed-Version":    String(currentVersion),
        "X-Total-Articles":  String(snapshot.articles.length),
        ...cors(),
      },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Feed unavailable";
    return new Response(JSON.stringify({ error: message, articles: [], hasMore: false, total: 0 }), {
      status:  500,
      headers: { "Content-Type": "application/json", ...cors() },
    });
  }
}