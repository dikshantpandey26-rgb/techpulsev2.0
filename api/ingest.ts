// =============================================================================
// api/ingest.ts — Vercel Cron Job (runs every 5 minutes)
// Pipeline: fetch → normalize → deduplicate → AI-score → store in Supabase
//
// Configure in vercel.json:
// "crons": [{ "path": "/api/ingest", "schedule": "*/5 * * * *" }]
// =============================================================================

export const config = { runtime: "edge" };

import type { RawArticle, HNStory, DbArticle, IngestionResult } from "../src/types";
import { slugify, estimateReadTime, scoreHype } from "../src/utils/articleUtils";

// ── Source fetchers ───────────────────────────────────────────────────────────

async function fetchNewsAPI(): Promise<RawArticle[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) return [];
  try {
    const url = `https://newsapi.org/v2/top-headlines?category=technology&pageSize=20&language=en&apiKey=${key}`;
    const res  = await fetch(url, { next: { revalidate: 300 } } as RequestInit);
    if (!res.ok) return [];
    const data = (await res.json()) as { articles?: RawArticle[] };
    return data.articles ?? [];
  } catch { return []; }
}

async function fetchHackerNews(): Promise<RawArticle[]> {
  try {
    const idsRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    const ids    = ((await idsRes.json()) as number[]).slice(0, 10);

    const stories = await Promise.allSettled(
      ids.map((id: number) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(
          (r) => r.json() as Promise<HNStory>
        )
      )
    );

    return stories
      .filter((r): r is PromiseFulfilledResult<HNStory> => r.status === "fulfilled" && !!r.value.url)
      .map(({ value: s }) => ({
        title:        s.title,
        description:  `${s.score} points · ${s.descendants ?? 0} comments`,
        url:          s.url ?? `https://news.ycombinator.com/item?id=${s.id}`,
        urlToImage:   null,
        publishedAt:  new Date(s.time * 1000).toISOString(),
        source:       { name: "Hacker News" },
        author:       s.by,
      }));
  } catch { return []; }
}

// ── Normalization ─────────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  AI:             ["ai", "artificial intelligence", "llm", "gpt", "machine learning", "openai", "anthropic"],
  Cybersecurity:  ["security", "hack", "vulnerability", "breach", "malware", "cve", "ransomware"],
  Startups:       ["startup", "funding", "series", "valuation", "venture", "raised", "yc"],
  Space:          ["spacex", "nasa", "rocket", "orbit", "mars", "satellite"],
  Crypto:         ["bitcoin", "ethereum", "crypto", "blockchain", "defi", "nft"],
  Gaming:         ["game", "gaming", "nvidia", "xbox", "playstation", "steam"],
  Programming:    ["javascript", "python", "rust", "typescript", "developer", "open source"],
  Apple:          ["apple", "iphone", "macos", "ios", "wwdc", "tim cook"],
  Android:        ["android", "google pixel", "samsung", "oneplus"],
  Gadgets:        ["gadget", "device", "wearable", "headset", "robot"],
  Science:        ["research", "study", "scientists", "breakthrough", "physics", "biology"],
  "Cloud & DevOps": ["aws", "azure", "gcp", "kubernetes", "docker", "devops", "cloud"],
};

function inferCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return cat;
  }
  return "AI"; // default
}

function normalizeArticle(raw: RawArticle, id: number): DbArticle {
  const category = inferCategory(raw.title, raw.description ?? "");
  const text     = `${raw.title} ${raw.description ?? ""}`;
  return {
    id,
    slug:             slugify(raw.title),
    category,
    title:            raw.title.slice(0, 255),
    summary:          (raw.description ?? raw.title).slice(0, 500),
    source:           raw.source.name,
    author:           raw.author ?? raw.source.name,
    published_at:     raw.publishedAt,
    read_time:        estimateReadTime(raw.description ?? ""),
    sentiment:        "neutral",
    hype:             scoreHype(text),
    trending:         false,
    breaking:         false,
    tags:             [],
    image_url:        raw.urlToImage ?? "",
    original_url:     raw.url,
    ai_summary:       null,
    ai_tags:          null,
    engagement_score: 0,
    views:            0,
    created_at:       new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  };
}

// ── Duplicate detection (URL fingerprint) ────────────────────────────────────

function deduplicate(articles: DbArticle[], existingUrls: Set<string>): DbArticle[] {
  const seen = new Set<string>();
  return articles.filter((a: DbArticle) => {
    if (existingUrls.has(a.original_url)) return false;
    if (seen.has(a.original_url)) return false;
    seen.add(a.original_url);
    return true;
  });
}

// ── Supabase upsert ───────────────────────────────────────────────────────────

async function upsertArticles(articles: DbArticle[]): Promise<number> {
  const url   = process.env.SUPABASE_URL;
  const key   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || articles.length === 0) return 0;

  const res = await fetch(`${url}/rest/v1/articles`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        key,
      "Authorization": `Bearer ${key}`,
      "Prefer":        "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(articles),
  });

  return res.ok ? articles.length : 0;
}

async function getExistingUrls(): Promise<Set<string>> {
  const url   = process.env.SUPABASE_URL;
  const key   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Set();
  try {
    const res  = await fetch(`${url}/rest/v1/articles?select=original_url&limit=500`, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` },
    });
    const data = (await res.json()) as Array<{ original_url: string }>;
    return new Set(data.map((r) => r.original_url));
  } catch { return new Set(); }
}

// ── Cron handler ──────────────────────────────────────────────────────────────

export default async function handler(request: Request): Promise<Response> {
  // Secure cron endpoint — only Vercel or manual triggers allowed
  const cronSecret = request.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const result: IngestionResult = { fetched: 0, stored: 0, duplicates: 0, errors: [] };

  try {
    const [newsApiArticles, hnArticles] = await Promise.allSettled([
      fetchNewsAPI(),
      fetchHackerNews(),
    ]);

    const rawArticles: RawArticle[] = [
      ...(newsApiArticles.status === "fulfilled" ? newsApiArticles.value : []),
      ...(hnArticles.status === "fulfilled"      ? hnArticles.value      : []),
    ];

    result.fetched = rawArticles.length;

    const normalized = rawArticles.map((r, i) => normalizeArticle(r, Date.now() + i));
    const existing   = await getExistingUrls();
    const fresh      = deduplicate(normalized, existing);

    result.duplicates = normalized.length - fresh.length;
    result.stored     = await upsertArticles(fresh);
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}