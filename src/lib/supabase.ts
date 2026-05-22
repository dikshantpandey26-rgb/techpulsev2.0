// =============================================================================
// src/lib/supabase.ts — Typed Supabase client + query helpers
//
// Uses the lightweight REST API directly (no Supabase JS SDK needed) to keep
// the bundle lean. Falls back gracefully if credentials are missing.
// =============================================================================

import { clientEnv } from "../config/env";
import { BASE_ARTICLES } from "../data/articles";
import type { Article, DbArticle, DbSubscriber } from "../types";

// ── Client ────────────────────────────────────────────────────────────────────

class SupabaseClient {
  private readonly url:  string;
  private readonly anon: string;

  constructor(url: string, anon: string) {
    this.url  = url;
    this.anon = anon;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type":  "application/json",
      apikey:          this.anon,
      Authorization:   `Bearer ${this.anon}`,
    };
  }

  async get<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.url}/rest/v1${path}`, { headers: this.headers() });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch { return null; }
  }

  async post<T>(path: string, body: unknown): Promise<T | null> {
    try {
      const res = await fetch(`${this.url}/rest/v1${path}`, {
        method:  "POST",
        headers: { ...this.headers(), Prefer: "return=representation" },
        body:    JSON.stringify(body),
      });
      if (!res.ok) return null;
      const text = await res.text();
      return text ? (JSON.parse(text) as T) : null;
    } catch { return null; }
  }

  async delete(path: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.url}/rest/v1${path}`, {
        method: "DELETE", headers: this.headers(),
      });
      return res.ok;
    } catch { return false; }
  }
}

// Singleton — only created if credentials are present
function createClient(): SupabaseClient | null {
  const { supabaseUrl, supabaseAnon } = clientEnv;
  if (!supabaseUrl || !supabaseAnon) return null;
  return new SupabaseClient(supabaseUrl, supabaseAnon);
}

const supabase = createClient();
const isConfigured = Boolean(supabase);

// ── Article helpers ───────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

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

/** Fetch paginated articles, falls back to static seed data */
export async function getArticles(category?: string, page = 1, limit = 9): Promise<Article[]> {
  if (!isConfigured) return BASE_ARTICLES;
  const offset = (page - 1) * limit;
  let path = `/articles?select=*&order=published_at.desc&limit=${limit}&offset=${offset}`;
  if (category && category !== "All") path += `&category=eq.${encodeURIComponent(category)}`;
  const rows = await supabase!.get<DbArticle[]>(path);
  return rows ? rows.map(dbToArticle) : BASE_ARTICLES;
}

/** Fetch single article by slug */
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  if (!isConfigured) {
    return BASE_ARTICLES.find((a: Article) => a.slug === slug) ?? null;
  }
  const rows = await supabase!.get<DbArticle[]>(`/articles?slug=eq.${encodeURIComponent(slug)}&limit=1`);
  return rows?.[0] ? dbToArticle(rows[0]) : null;
}

// ── Bookmark helpers ──────────────────────────────────────────────────────────

export async function getBookmarks(userId: string): Promise<number[]> {
  if (!isConfigured) return [];
  const rows = await supabase!.get<Array<{ article_id: number }>>(`/bookmarks?user_id=eq.${userId}&select=article_id`);
  return rows?.map((r) => r.article_id) ?? [];
}

export async function addBookmark(userId: string, articleId: number): Promise<boolean> {
  if (!isConfigured) return true;
  const res = await supabase!.post("/bookmarks", { user_id: userId, article_id: articleId });
  return Boolean(res);
}

export async function removeBookmark(userId: string, articleId: number): Promise<boolean> {
  if (!isConfigured) return true;
  return supabase!.delete(`/bookmarks?user_id=eq.${userId}&article_id=eq.${articleId}`);
}

// ── Newsletter ────────────────────────────────────────────────────────────────

export async function subscribeNewsletter(email: string, topics: string[] = []): Promise<boolean> {
  try {
    const origin = window.location.origin; // No hardcoded URL
    const res = await fetch(`${origin}/api/newsletter`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, topics }),
    });
    return res.ok;
  } catch { return false; }
}

export { isConfigured as supabaseConfigured };