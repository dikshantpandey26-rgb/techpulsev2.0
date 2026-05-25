// =============================================================================
// src/services/sourceRegistry.ts
//
// Single source of truth for every news source the platform can ingest.
//
// Architecture decisions:
// • Pure static data — zero runtime cost, fully tree-shakeable.
// • Keyed by SourceId union so TypeScript enforces completeness: adding a new
//   SourceId without a registry entry is a compile error.
// • `enabled` flag lets ops toggle a source without a code deployment.
// • `cacheTtlSeconds` is per-source because HN updates every minute while
//   blog RSS feeds update at most once a day — one-size caching wastes quota.
// • `reliabilityScore` (0–1) feeds directly into the trending ranking formula;
//   a score from Nature carries more weight than an anonymous Reddit post.
// • `apiKeyEnvVar` is the process.env key NAME, not the value — the registry
//   never holds secrets, only references to where secrets live server-side.
//
// Vercel compatibility:
// • This file is imported by both src/ (frontend) and api/ (edge functions).
//   It contains zero Node.js APIs, no fetch calls, no side effects — safe
//   in every runtime context.
//
// Scalability:
// • New source = one new SourceConfig record. No other file needs changing
//   unless the source uses a new transport type.
// =============================================================================

import type { SourceConfig, SourceId, CategoryKey } from "../types";

// ── Registry map (SourceId → SourceConfig) ────────────────────────────────────
//
// Using Record<SourceId, SourceConfig> forces TypeScript to flag a missing
// entry when SourceId union is extended. This is intentional — the compiler
// enforces registry completeness at build time.

export const SOURCE_REGISTRY: Record<SourceId, SourceConfig> = {
  // ── Aggregation APIs ──────────────────────────────────────────────────────

  newsapi: {
    id:               "newsapi",
    displayName:      "NewsAPI",
    homepage:         "https://newsapi.org",
    transport:        "json-api",
    endpoint:         "https://newsapi.org/v2/top-headlines?category=technology&pageSize=20&language=en",
    apiKeyEnvVar:     "NEWS_API_KEY",
    reliabilityScore: 0.80,
    categoryHints:    ["AI", "Startups", "Cybersecurity", "Gadgets", "Programming"],
    maxArticlesPerFetch: 20,
    cacheTtlSeconds:  300,      // 5 min — NewsAPI refreshes often
    enabled:          true,
  },

  gnews: {
    id:               "gnews",
    displayName:      "GNews",
    homepage:         "https://gnews.io",
    transport:        "json-api",
    endpoint:         "https://gnews.io/api/v4/top-headlines?category=technology&lang=en&max=10",
    apiKeyEnvVar:     "GNEWS_API_KEY",
    reliabilityScore: 0.75,
    categoryHints:    ["AI", "Gadgets", "Science"],
    maxArticlesPerFetch: 10,
    cacheTtlSeconds:  300,
    enabled:          true,
  },

  // ── Community sources ─────────────────────────────────────────────────────

  hackernews: {
    id:               "hackernews",
    displayName:      "Hacker News",
    homepage:         "https://news.ycombinator.com",
    transport:        "json-api",
    endpoint:         "https://hacker-news.firebaseio.com/v0/topstories.json",
    reliabilityScore: 0.85,     // curated by a discerning tech community
    categoryHints:    ["Programming", "AI", "Startups", "Cloud & DevOps"],
    maxArticlesPerFetch: 15,
    cacheTtlSeconds:  180,      // HN top stories rotate quickly
    enabled:          true,
  },

  reddit: {
    id:               "reddit",
    displayName:      "Reddit",
    homepage:         "https://reddit.com",
    transport:        "json-api",
    // Endpoint is per-subreddit; fetcher iterates over REDDIT_SUBREDDITS below
    endpoint:         "https://www.reddit.com/r/{subreddit}/top.json?limit=10&t=day",
    reliabilityScore: 0.65,
    categoryHints:    ["AI", "Programming", "Startups", "Cybersecurity", "Crypto"],
    maxArticlesPerFetch: 25,    // across all subreddits
    cacheTtlSeconds:  300,
    enabled:          true,
  },

  devto: {
    id:               "devto",
    displayName:      "Dev.to",
    homepage:         "https://dev.to",
    transport:        "json-api",
    endpoint:         "https://dev.to/api/articles?per_page=10&top=1",
    reliabilityScore: 0.70,
    categoryHints:    ["Programming", "Cloud & DevOps", "AI"],
    maxArticlesPerFetch: 10,
    cacheTtlSeconds:  600,
    enabled:          true,
  },

  "github-trending": {
    id:               "github-trending",
    displayName:      "GitHub Trending",
    homepage:         "https://github.com/trending",
    transport:        "json-api",
    // Uses the unofficial GitHub trending scraper (no auth needed)
    endpoint:         "https://api.gitterapp.com/repositories?language=&since=daily",
    reliabilityScore: 0.75,
    categoryHints:    ["Programming", "AI", "Cloud & DevOps"],
    maxArticlesPerFetch: 10,
    cacheTtlSeconds:  1800,     // GitHub trending updates once a day
    enabled:          true,
  },

  producthunt: {
    id:               "producthunt",
    displayName:      "Product Hunt",
    homepage:         "https://www.producthunt.com",
    transport:        "json-api",
    endpoint:         "https://api.producthunt.com/v2/api/graphql",
    apiKeyEnvVar:     "PRODUCTHUNT_TOKEN",
    reliabilityScore: 0.72,
    categoryHints:    ["Startups", "AI", "Gadgets"],
    maxArticlesPerFetch: 8,
    cacheTtlSeconds:  900,
    enabled:          true,
  },

  // ── RSS sources — Major tech publications ─────────────────────────────────

  techcrunch: {
    id:               "techcrunch",
    displayName:      "TechCrunch",
    homepage:         "https://techcrunch.com",
    transport:        "rss",
    endpoint:         "https://techcrunch.com/feed/",
    reliabilityScore: 0.88,
    categoryHints:    ["Startups", "AI", "Gadgets"],
    maxArticlesPerFetch: 12,
    cacheTtlSeconds:  300,
    enabled:          true,
  },

  theverge: {
    id:               "theverge",
    displayName:      "The Verge",
    homepage:         "https://www.theverge.com",
    transport:        "rss",
    endpoint:         "https://www.theverge.com/rss/index.xml",
    reliabilityScore: 0.87,
    categoryHints:    ["Gadgets", "AI", "Apple", "Android", "Gaming"],
    maxArticlesPerFetch: 12,
    cacheTtlSeconds:  300,
    enabled:          true,
  },

  "ars-technica": {
    id:               "ars-technica",
    displayName:      "Ars Technica",
    homepage:         "https://arstechnica.com",
    transport:        "rss",
    endpoint:         "https://feeds.arstechnica.com/arstechnica/index",
    reliabilityScore: 0.90,
    categoryHints:    ["Science", "Programming", "AI", "Space", "Cybersecurity"],
    maxArticlesPerFetch: 10,
    cacheTtlSeconds:  600,
    enabled:          true,
  },

  wired: {
    id:               "wired",
    displayName:      "Wired",
    homepage:         "https://www.wired.com",
    transport:        "rss",
    endpoint:         "https://www.wired.com/feed/rss",
    reliabilityScore: 0.88,
    categoryHints:    ["Cybersecurity", "AI", "Science", "Startups"],
    maxArticlesPerFetch: 10,
    cacheTtlSeconds:  600,
    enabled:          true,
  },

  "bloomberg-tech": {
    id:               "bloomberg-tech",
    displayName:      "Bloomberg Technology",
    homepage:         "https://bloomberg.com/technology",
    transport:        "rss",
    endpoint:         "https://feeds.bloomberg.com/technology/news.rss",
    reliabilityScore: 0.92,
    categoryHints:    ["Startups", "Crypto", "AI", "Cloud & DevOps"],
    maxArticlesPerFetch: 8,
    cacheTtlSeconds:  600,
    enabled:          true,
  },

  coindesk: {
    id:               "coindesk",
    displayName:      "CoinDesk",
    homepage:         "https://www.coindesk.com",
    transport:        "rss",
    endpoint:         "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml",
    reliabilityScore: 0.80,
    defaultCategory:  "Crypto",
    categoryHints:    ["Crypto", "Web3", "Startups"],
    maxArticlesPerFetch: 8,
    cacheTtlSeconds:  300,
    enabled:          true,
  },

  "android-authority": {
    id:               "android-authority",
    displayName:      "Android Authority",
    homepage:         "https://www.androidauthority.com",
    transport:        "rss",
    endpoint:         "https://www.androidauthority.com/feed/",
    reliabilityScore: 0.82,
    defaultCategory:  "Android",
    categoryHints:    ["Android", "Gadgets"],
    maxArticlesPerFetch: 8,
    cacheTtlSeconds:  600,
    enabled:          true,
  },

  macrumors: {
    id:               "macrumors",
    displayName:      "MacRumors",
    homepage:         "https://www.macrumors.com",
    transport:        "rss",
    endpoint:         "https://feeds.macrumors.com/MacRumors-All",
    reliabilityScore: 0.83,
    defaultCategory:  "Apple",
    categoryHints:    ["Apple", "Gadgets"],
    maxArticlesPerFetch: 8,
    cacheTtlSeconds:  600,
    enabled:          true,
  },

  appleinsider: {
    id:               "appleinsider",
    displayName:      "AppleInsider",
    homepage:         "https://appleinsider.com",
    transport:        "rss",
    endpoint:         "https://appleinsider.com/rss/news/",
    reliabilityScore: 0.82,
    defaultCategory:  "Apple",
    categoryHints:    ["Apple", "Gadgets"],
    maxArticlesPerFetch: 8,
    cacheTtlSeconds:  600,
    enabled:          true,
  },

  "space-com": {
    id:               "space-com",
    displayName:      "Space.com",
    homepage:         "https://www.space.com",
    transport:        "rss",
    endpoint:         "https://www.space.com/feeds/all",
    reliabilityScore: 0.85,
    defaultCategory:  "Space",
    categoryHints:    ["Space", "Science"],
    maxArticlesPerFetch: 8,
    cacheTtlSeconds:  900,
    enabled:          true,
  },

  // ── Official AI company blogs ─────────────────────────────────────────────

  "openai-blog": {
    id:               "openai-blog",
    displayName:      "OpenAI Blog",
    homepage:         "https://openai.com/blog",
    transport:        "rss",
    endpoint:         "https://openai.com/blog/rss.xml",
    reliabilityScore: 0.95,     // primary source for OpenAI news
    defaultCategory:  "AI",
    categoryHints:    ["AI"],
    maxArticlesPerFetch: 5,
    cacheTtlSeconds:  1800,     // official blogs update infrequently
    enabled:          true,
  },

  "anthropic-blog": {
    id:               "anthropic-blog",
    displayName:      "Anthropic",
    homepage:         "https://www.anthropic.com/news",
    transport:        "rss",
    endpoint:         "https://www.anthropic.com/rss.xml",
    reliabilityScore: 0.95,
    defaultCategory:  "AI",
    categoryHints:    ["AI"],
    maxArticlesPerFetch: 5,
    cacheTtlSeconds:  1800,
    enabled:          true,
  },

  "google-ai-blog": {
    id:               "google-ai-blog",
    displayName:      "Google AI Blog",
    homepage:         "https://ai.googleblog.com",
    transport:        "rss",
    endpoint:         "https://blog.research.google/feeds/posts/default?alt=rss",
    reliabilityScore: 0.93,
    defaultCategory:  "AI",
    categoryHints:    ["AI", "Science"],
    maxArticlesPerFetch: 5,
    cacheTtlSeconds:  1800,
    enabled:          true,
  },

  "meta-engineering": {
    id:               "meta-engineering",
    displayName:      "Meta Engineering",
    homepage:         "https://engineering.fb.com",
    transport:        "rss",
    endpoint:         "https://engineering.fb.com/feed/",
    reliabilityScore: 0.90,
    categoryHints:    ["AI", "Programming", "Cloud & DevOps"],
    maxArticlesPerFetch: 5,
    cacheTtlSeconds:  1800,
    enabled:          true,
  },

  "microsoft-ai": {
    id:               "microsoft-ai",
    displayName:      "Microsoft AI Blog",
    homepage:         "https://blogs.microsoft.com/ai",
    transport:        "rss",
    endpoint:         "https://blogs.microsoft.com/ai/feed/",
    reliabilityScore: 0.90,
    categoryHints:    ["AI", "Cloud & DevOps"],
    maxArticlesPerFetch: 5,
    cacheTtlSeconds:  1800,
    enabled:          true,
  },

  // ── Internal — static fallback data ──────────────────────────────────────

  seed: {
    id:               "seed",
    displayName:      "TechPulse Editorial",
    homepage:         "https://techpulse.ai",
    transport:        "static",
    reliabilityScore: 0.80,
    categoryHints:    ["AI", "Startups", "Programming", "Cybersecurity"],
    maxArticlesPerFetch: 15,
    cacheTtlSeconds:  86400,    // seed data is permanent fallback
    enabled:          true,
  },
};

// ── Derived helpers ───────────────────────────────────────────────────────────

/** All enabled source configs as an array */
export const ENABLED_SOURCES: SourceConfig[] = Object.values(SOURCE_REGISTRY)
  .filter((s) => s.enabled);

/** Enabled RSS sources only */
export const RSS_SOURCES: SourceConfig[] = ENABLED_SOURCES
  .filter((s) => s.transport === "rss");

/** Enabled JSON-API sources only */
export const API_SOURCES: SourceConfig[] = ENABLED_SOURCES
  .filter((s) => s.transport === "json-api");

/** Look up a source config by id — always defined because SourceId is exhaustive */
export function getSource(id: SourceId): SourceConfig {
  return SOURCE_REGISTRY[id];
}

/**
 * Reddit subreddits to aggregate, with their primary category mapping.
 * Kept here (not in redditService) so sourceRegistry is the single place
 * that lists all data sources for the platform.
 */
export const REDDIT_SUBREDDITS: Array<{ name: string; category: CategoryKey }> = [
  { name: "artificial",    category: "AI"           },
  { name: "singularity",   category: "AI"           },
  { name: "technology",    category: "Startups"     },
  { name: "programming",   category: "Programming"  },
  { name: "startups",      category: "Startups"     },
  { name: "cybersecurity", category: "Cybersecurity"},
  { name: "devops",        category: "Cloud & DevOps"},
  { name: "crypto",        category: "Crypto"       },
];