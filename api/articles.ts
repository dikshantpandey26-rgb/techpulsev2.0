// =============================================================================
// api/articles.ts — Vercel Edge Function: article feed endpoint
//
// Serves the article feed to the frontend with:
//   • SWR caching (Cache-Control: s-maxage + stale-while-revalidate)
//   • Category filtering
//   • Pagination
//   • Graceful fallback to seed data when all sources are unavailable
//
// Response headers guide Vercel's CDN:
//   s-maxage=300              → CDN caches for 5 minutes
//   stale-while-revalidate=60 → CDN serves stale for 1 min while revalidating
//
// This means near-zero latency for cached responses and fresh data within 6 min.
// =============================================================================

export const config = { runtime: "edge" };

import { getFeed } from "../src/services/newsService";
import type { NormalizedArticle } from "../src/types";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url      = new URL(request.url);
  const category = url.searchParams.get("category") ?? undefined;
  const page     = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit    = Math.min(20, parseInt(url.searchParams.get("limit") ?? "9", 10));

  try {
    const { articles, fromCache, stale } = await getFeed(
      category && category !== "All" ? category : undefined
    );

    // Paginate
    const offset   = (page - 1) * limit;
    const paginated: NormalizedArticle[] = articles.slice(offset, offset + limit);

    const cacheStatus = fromCache ? (stale ? "STALE" : "HIT") : "MISS";

    return new Response(JSON.stringify({
      articles:  paginated,
      total:     articles.length,
      page,
      limit,
      hasMore:   offset + limit < articles.length,
    }), {
      status:  200,
      headers: {
        "Content-Type":    "application/json",
        "Cache-Control":   "public, s-maxage=300, stale-while-revalidate=60",
        "X-Cache":         cacheStatus,
        "X-Total-Articles": String(articles.length),
        ...corsHeaders(),
      },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Feed unavailable";
    return new Response(JSON.stringify({ error: message, articles: [] }), {
      status:  500,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }
}