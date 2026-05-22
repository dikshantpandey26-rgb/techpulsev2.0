// =============================================================================
// api/articles.ts — Vercel Edge Function: paginated article feed
// Serves from Supabase with Redis caching (5-min TTL).
// Falls back to static seed data if Supabase not configured.
// =============================================================================

export const config = { runtime: "edge" };

import type { DbArticle, Article } from "../src/types";
import { BASE_ARTICLES } from "../src/data/articles";

function dbToArticle(db: DbArticle): Article {
  return {
    id:          db.id,
    slug:        db.slug,
    category:    db.category as Article["category"],
    title:       db.title,
    summary:     db.summary,
    source:      db.source,
    author:      db.author,
    time:        formatRelativeTime(db.published_at),
    publishedAt: db.published_at,
    readTime:    db.read_time,
    views:       db.views.toLocaleString(),
    sentiment:   db.sentiment as Article["sentiment"],
    hype:        db.hype,
    trending:    db.trending,
    breaking:    db.breaking,
    tags:        db.tags,
    image:       db.image_url || "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
    url:         db.original_url,
    aiSummary:   db.ai_summary ?? undefined,
    aiTags:      db.ai_tags ?? undefined,
    engagementScore: db.engagement_score,
  };
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function fetchFromSupabase(category?: string, page = 1, limit = 9): Promise<Article[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return BASE_ARTICLES;

  const offset = (page - 1) * limit;
  let query    = `${url}/rest/v1/articles?select=*&order=published_at.desc&limit=${limit}&offset=${offset}`;
  if (category && category !== "All") {
    query += `&category=eq.${encodeURIComponent(category)}`;
  }

  try {
    const res  = await fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return BASE_ARTICLES;
    const data: DbArticle[] = await res.json();
    return data.map(dbToArticle);
  } catch { return BASE_ARTICLES; }
}

async function getCachedFeed(cacheKey: string): Promise<Article[] | null> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res  = await fetch(`${url}/get/${encodeURIComponent(cacheKey)}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json()) as { result: string | null };
    return data.result ? (JSON.parse(data.result) as Article[]) : null;
  } catch { return null; }
}

async function cacheFeed(cacheKey: string, articles: Article[]): Promise<void> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    const val = encodeURIComponent(JSON.stringify(articles));
    await fetch(`${url}/set/${encodeURIComponent(cacheKey)}/${val}/ex/300`, { headers: { Authorization: `Bearer ${token}` } });
  } catch { /* non-fatal */ }
}

export default async function handler(request: Request): Promise<Response> {
  const params   = new URL(request.url).searchParams;
  const category = params.get("category") ?? undefined;
  const page     = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const limit    = Math.min(20, parseInt(params.get("limit") ?? "9", 10));

  const cacheKey = `feed:${category ?? "all"}:${page}:${limit}`;
  const cached   = await getCachedFeed(cacheKey);
  if (cached) {
    return jsonResponse(cached, { "X-Cache": "HIT" });
  }

  const articles = await fetchFromSupabase(category, page, limit);
  void cacheFeed(cacheKey, articles);

  return jsonResponse(articles, { "X-Cache": "MISS" });
}

function jsonResponse(data: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status:  200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders,
    },
  });
}