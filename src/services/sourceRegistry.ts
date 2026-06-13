// =============================================================================
// src/services/sourceRegistry.ts  (Phase 2 Step 9 — full source expansion)
//
// 24 → 62 sources across 14 categories.
// All RSS feeds are publicly accessible with no authentication.
// All JSON APIs either require no key or use a key referenced by env var name.
//
// New SourceConfig fields (optional, backward-safe):
//   freshnessWeight    — how quickly content from this source ages (0–1)
//   thumbnailQuality   — expected image availability/quality
//   categoryStrength   — confidence that defaultCategory is correct (0–1)
//   averageDailyVolume — estimated articles/day for capacity planning
//
// Record<SourceId, SourceConfig> enforces completeness at compile time:
// adding a new SourceId member without a registry entry → TypeScript error.
// =============================================================================

import type { SourceConfig, SourceId, CategoryKey } from "../types";

export const SOURCE_REGISTRY: Record<SourceId, SourceConfig> = {

  // ── Aggregation APIs ────────────────────────────────────────────────────────

  newsapi: {
    id: "newsapi", displayName: "NewsAPI", homepage: "https://newsapi.org",
    transport: "json-api",
    endpoint: "https://newsapi.org/v2/top-headlines?category=technology&pageSize=20&language=en",
    apiKeyEnvVar: "NEWS_API_KEY",
    reliabilityScore: 0.80, freshnessWeight: 0.90, thumbnailQuality: "medium",
    categoryHints: ["AI","Startups","Cybersecurity","Gadgets","Programming"],
    maxArticlesPerFetch: 20, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 50,
  },

  gnews: {
    id: "gnews", displayName: "GNews", homepage: "https://gnews.io",
    transport: "json-api",
    endpoint: "https://gnews.io/api/v4/top-headlines?category=technology&lang=en&max=10",
    apiKeyEnvVar: "GNEWS_API_KEY",
    reliabilityScore: 0.75, freshnessWeight: 0.85, thumbnailQuality: "medium",
    categoryHints: ["AI","Gadgets","Science"],
    maxArticlesPerFetch: 10, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 20,
  },

  // ── Community ──────────────────────────────────────────────────────────────

  hackernews: {
    id: "hackernews", displayName: "Hacker News", homepage: "https://news.ycombinator.com",
    transport: "json-api",
    endpoint: "https://hacker-news.firebaseio.com/v0/topstories.json",
    reliabilityScore: 0.85, freshnessWeight: 0.95, thumbnailQuality: "none",
    categoryHints: ["Programming","AI","Startups","Cloud & DevOps"],
    maxArticlesPerFetch: 15, cacheTtlSeconds: 180, enabled: true,
    averageDailyVolume: 30,
  },

  reddit: {
    id: "reddit", displayName: "Reddit", homepage: "https://reddit.com",
    transport: "json-api",
    endpoint: "https://www.reddit.com/r/{subreddit}/top.json?limit=10&t=day",
    reliabilityScore: 0.65, freshnessWeight: 0.90, thumbnailQuality: "low",
    categoryHints: ["AI","Programming","Startups","Cybersecurity","Crypto"],
    maxArticlesPerFetch: 25, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 40,
  },

  devto: {
    id: "devto", displayName: "Dev.to", homepage: "https://dev.to",
    transport: "json-api",
    endpoint: "https://dev.to/api/articles?per_page=10&top=1",
    reliabilityScore: 0.70, freshnessWeight: 0.70, thumbnailQuality: "medium",
    categoryHints: ["Programming","Cloud & DevOps","AI"],
    maxArticlesPerFetch: 10, cacheTtlSeconds: 600, enabled: true,
    averageDailyVolume: 20,
  },

  "github-trending": {
    id: "github-trending", displayName: "GitHub Trending", homepage: "https://github.com/trending",
    transport: "json-api",
    endpoint: "https://api.gitterapp.com/repositories?language=&since=daily",
    reliabilityScore: 0.75, freshnessWeight: 0.50, thumbnailQuality: "none",
    categoryHints: ["Programming","AI","Cloud & DevOps"],
    maxArticlesPerFetch: 10, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 10,
  },

  producthunt: {
    id: "producthunt", displayName: "Product Hunt", homepage: "https://www.producthunt.com",
    transport: "json-api",
    endpoint: "https://api.producthunt.com/v2/api/graphql",
    apiKeyEnvVar: "PRODUCTHUNT_TOKEN",
    reliabilityScore: 0.72, freshnessWeight: 0.80, thumbnailQuality: "high",
    categoryHints: ["Startups","AI","Gadgets"],
    maxArticlesPerFetch: 8, cacheTtlSeconds: 900, enabled: true,
    averageDailyVolume: 15,
  },

  // ── Tier-1 Tech Publications ───────────────────────────────────────────────

  techcrunch: {
    id: "techcrunch", displayName: "TechCrunch", homepage: "https://techcrunch.com",
    transport: "rss", endpoint: "https://techcrunch.com/feed/",
    reliabilityScore: 0.88, freshnessWeight: 0.92, thumbnailQuality: "high",
    categoryHints: ["Startups","AI","Gadgets"],
    maxArticlesPerFetch: 15, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 30,
  },

  theverge: {
    id: "theverge", displayName: "The Verge", homepage: "https://www.theverge.com",
    transport: "rss", endpoint: "https://www.theverge.com/rss/index.xml",
    reliabilityScore: 0.87, freshnessWeight: 0.90, thumbnailQuality: "high",
    categoryHints: ["Gadgets","AI","Apple","Android","Gaming"],
    maxArticlesPerFetch: 15, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 25,
  },

  "ars-technica": {
    id: "ars-technica", displayName: "Ars Technica", homepage: "https://arstechnica.com",
    transport: "rss", endpoint: "https://feeds.arstechnica.com/arstechnica/index",
    reliabilityScore: 0.92, freshnessWeight: 0.80, thumbnailQuality: "high",
    categoryHints: ["Science","Programming","AI","Space","Cybersecurity"],
    maxArticlesPerFetch: 12, cacheTtlSeconds: 600, enabled: true,
    averageDailyVolume: 20,
  },

  wired: {
    id: "wired", displayName: "Wired", homepage: "https://www.wired.com",
    transport: "rss", endpoint: "https://www.wired.com/feed/rss",
    reliabilityScore: 0.88, freshnessWeight: 0.80, thumbnailQuality: "high",
    categoryHints: ["Cybersecurity","AI","Science","Startups"],
    maxArticlesPerFetch: 12, cacheTtlSeconds: 600, enabled: true,
    averageDailyVolume: 15,
  },

  "bloomberg-tech": {
    id: "bloomberg-tech", displayName: "Bloomberg Technology", homepage: "https://bloomberg.com/technology",
    transport: "rss", endpoint: "https://feeds.bloomberg.com/technology/news.rss",
    reliabilityScore: 0.93, freshnessWeight: 0.88, thumbnailQuality: "high",
    categoryHints: ["Startups","Crypto","AI","Cloud & DevOps"],
    maxArticlesPerFetch: 10, cacheTtlSeconds: 600, enabled: true,
    averageDailyVolume: 12,
  },

  venturebeat: {
    id: "venturebeat", displayName: "VentureBeat", homepage: "https://venturebeat.com",
    transport: "rss", endpoint: "https://feeds.feedburner.com/venturebeat/SZYF",
    reliabilityScore: 0.82, freshnessWeight: 0.85, thumbnailQuality: "high",
    categoryHints: ["AI","Startups","Gaming"],
    maxArticlesPerFetch: 12, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 25,
  },

  zdnet: {
    id: "zdnet", displayName: "ZDNet", homepage: "https://www.zdnet.com",
    transport: "rss", endpoint: "https://www.zdnet.com/news/rss.xml",
    reliabilityScore: 0.80, freshnessWeight: 0.85, thumbnailQuality: "medium",
    categoryHints: ["Cloud & DevOps","Cybersecurity","Programming","Gadgets"],
    maxArticlesPerFetch: 12, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 20,
  },

  engadget: {
    id: "engadget", displayName: "Engadget", homepage: "https://www.engadget.com",
    transport: "rss", endpoint: "https://www.engadget.com/rss.xml",
    reliabilityScore: 0.82, freshnessWeight: 0.88, thumbnailQuality: "high",
    categoryHints: ["Gadgets","AI","Apple","Android","Gaming"],
    maxArticlesPerFetch: 12, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 20,
  },

  cnet: {
    id: "cnet", displayName: "CNET", homepage: "https://www.cnet.com",
    transport: "rss", endpoint: "https://www.cnet.com/rss/news/",
    reliabilityScore: 0.80, freshnessWeight: 0.88, thumbnailQuality: "high",
    categoryHints: ["Gadgets","AI","Apple","Android"],
    maxArticlesPerFetch: 12, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 25,
  },

  "mit-tech-review": {
    id: "mit-tech-review", displayName: "MIT Technology Review", homepage: "https://technologyreview.com",
    transport: "rss", endpoint: "https://www.technologyreview.com/stories.rss",
    reliabilityScore: 0.94, freshnessWeight: 0.60, thumbnailQuality: "high",
    categoryHints: ["AI","Science","Startups"],
    maxArticlesPerFetch: 8, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 5,
  },

  // ── AI Sources ─────────────────────────────────────────────────────────────

  "openai-blog": {
    id: "openai-blog", displayName: "OpenAI Blog", homepage: "https://openai.com/blog",
    transport: "rss", endpoint: "https://openai.com/blog/rss.xml",
    reliabilityScore: 0.97, freshnessWeight: 0.70, thumbnailQuality: "high",
    defaultCategory: "AI", categoryHints: ["AI"],
    categoryStrength: 0.99,
    maxArticlesPerFetch: 5, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 1,
  },

  "anthropic-blog": {
    id: "anthropic-blog", displayName: "Anthropic", homepage: "https://www.anthropic.com/news",
    transport: "rss", endpoint: "https://www.anthropic.com/rss.xml",
    reliabilityScore: 0.97, freshnessWeight: 0.70, thumbnailQuality: "high",
    defaultCategory: "AI", categoryHints: ["AI"],
    categoryStrength: 0.99,
    maxArticlesPerFetch: 5, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 1,
  },

  "google-ai-blog": {
    id: "google-ai-blog", displayName: "Google AI Blog", homepage: "https://ai.googleblog.com",
    transport: "rss", endpoint: "https://blog.research.google/feeds/posts/default?alt=rss",
    reliabilityScore: 0.95, freshnessWeight: 0.65, thumbnailQuality: "high",
    defaultCategory: "AI", categoryHints: ["AI","Science"],
    maxArticlesPerFetch: 5, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 2,
  },

  "meta-engineering": {
    id: "meta-engineering", displayName: "Meta Engineering", homepage: "https://engineering.fb.com",
    transport: "rss", endpoint: "https://engineering.fb.com/feed/",
    reliabilityScore: 0.90, freshnessWeight: 0.65, thumbnailQuality: "high",
    categoryHints: ["AI","Programming","Cloud & DevOps"],
    maxArticlesPerFetch: 5, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 2,
  },

  "microsoft-ai": {
    id: "microsoft-ai", displayName: "Microsoft AI Blog", homepage: "https://blogs.microsoft.com/ai",
    transport: "rss", endpoint: "https://blogs.microsoft.com/ai/feed/",
    reliabilityScore: 0.90, freshnessWeight: 0.65, thumbnailQuality: "high",
    categoryHints: ["AI","Cloud & DevOps"],
    maxArticlesPerFetch: 5, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 2,
  },

  "deepmind-blog": {
    id: "deepmind-blog", displayName: "Google DeepMind", homepage: "https://deepmind.google/research/publications/",
    transport: "rss", endpoint: "https://deepmind.google/blog/feed/basic",
    reliabilityScore: 0.96, freshnessWeight: 0.60, thumbnailQuality: "high",
    defaultCategory: "AI", categoryHints: ["AI","Science"],
    categoryStrength: 0.98,
    maxArticlesPerFetch: 5, cacheTtlSeconds: 3600, enabled: true,
    averageDailyVolume: 1,
  },

  "huggingface-blog": {
    id: "huggingface-blog", displayName: "Hugging Face Blog", homepage: "https://huggingface.co/blog",
    transport: "rss", endpoint: "https://huggingface.co/blog/feed.xml",
    reliabilityScore: 0.88, freshnessWeight: 0.75, thumbnailQuality: "medium",
    defaultCategory: "AI", categoryHints: ["AI","Programming"],
    categoryStrength: 0.95,
    maxArticlesPerFetch: 8, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 3,
  },

  "nvidia-ai-blog": {
    id: "nvidia-ai-blog", displayName: "NVIDIA AI Blog", homepage: "https://blogs.nvidia.com/blog/category/deep-learning/",
    transport: "rss", endpoint: "https://blogs.nvidia.com/feed/",
    reliabilityScore: 0.87, freshnessWeight: 0.70, thumbnailQuality: "high",
    categoryHints: ["AI","Gaming","Cloud & DevOps"],
    maxArticlesPerFetch: 6, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 3,
  },

  "stability-ai-blog": {
    id: "stability-ai-blog", displayName: "Stability AI", homepage: "https://stability.ai/news",
    transport: "rss", endpoint: "https://stability.ai/news/rss.xml",
    reliabilityScore: 0.83, freshnessWeight: 0.65, thumbnailQuality: "high",
    defaultCategory: "AI", categoryHints: ["AI"],
    categoryStrength: 0.95,
    maxArticlesPerFetch: 5, cacheTtlSeconds: 3600, enabled: true,
    averageDailyVolume: 1,
  },

  // ── Startups ───────────────────────────────────────────────────────────────

  "yc-blog": {
    id: "yc-blog", displayName: "Y Combinator Blog", homepage: "https://www.ycombinator.com/blog",
    transport: "rss", endpoint: "https://www.ycombinator.com/blog/rss",
    reliabilityScore: 0.90, freshnessWeight: 0.70, thumbnailQuality: "medium",
    defaultCategory: "Startups", categoryHints: ["Startups","AI","Programming"],
    categoryStrength: 0.90,
    maxArticlesPerFetch: 5, cacheTtlSeconds: 3600, enabled: true,
    averageDailyVolume: 1,
  },

  sifted: {
    id: "sifted", displayName: "Sifted", homepage: "https://sifted.eu",
    transport: "rss", endpoint: "https://sifted.eu/feed",
    reliabilityScore: 0.82, freshnessWeight: 0.80, thumbnailQuality: "high",
    defaultCategory: "Startups", categoryHints: ["Startups"],
    maxArticlesPerFetch: 8, cacheTtlSeconds: 900, enabled: true,
    averageDailyVolume: 8,
  },

  "first-round-review": {
    id: "first-round-review", displayName: "First Round Review", homepage: "https://review.firstround.com",
    transport: "rss", endpoint: "https://review.firstround.com/feed.xml",
    reliabilityScore: 0.88, freshnessWeight: 0.40, thumbnailQuality: "high",
    defaultCategory: "Startups", categoryHints: ["Startups"],
    maxArticlesPerFetch: 4, cacheTtlSeconds: 7200, enabled: true,
    averageDailyVolume: 1,
  },

  // ── Cybersecurity ──────────────────────────────────────────────────────────

  "krebs-on-security": {
    id: "krebs-on-security", displayName: "Krebs on Security", homepage: "https://krebsonsecurity.com",
    transport: "rss", endpoint: "https://krebsonsecurity.com/feed/",
    reliabilityScore: 0.95, freshnessWeight: 0.85, thumbnailQuality: "medium",
    defaultCategory: "Cybersecurity", categoryHints: ["Cybersecurity"],
    categoryStrength: 0.99,
    maxArticlesPerFetch: 8, cacheTtlSeconds: 600, enabled: true,
    averageDailyVolume: 5,
  },

  "bleeping-computer": {
    id: "bleeping-computer", displayName: "BleepingComputer", homepage: "https://www.bleepingcomputer.com",
    transport: "rss", endpoint: "https://www.bleepingcomputer.com/feed/",
    reliabilityScore: 0.88, freshnessWeight: 0.92, thumbnailQuality: "medium",
    defaultCategory: "Cybersecurity", categoryHints: ["Cybersecurity"],
    categoryStrength: 0.98,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 15,
  },

  "dark-reading": {
    id: "dark-reading", displayName: "Dark Reading", homepage: "https://www.darkreading.com",
    transport: "rss", endpoint: "https://www.darkreading.com/rss.xml",
    reliabilityScore: 0.85, freshnessWeight: 0.88, thumbnailQuality: "medium",
    defaultCategory: "Cybersecurity", categoryHints: ["Cybersecurity"],
    categoryStrength: 0.99,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 600, enabled: true,
    averageDailyVolume: 10,
  },

  "the-hacker-news-sec": {
    id: "the-hacker-news-sec", displayName: "The Hacker News", homepage: "https://thehackernews.com",
    transport: "rss", endpoint: "https://feeds.feedburner.com/TheHackersNews",
    reliabilityScore: 0.83, freshnessWeight: 0.92, thumbnailQuality: "medium",
    defaultCategory: "Cybersecurity", categoryHints: ["Cybersecurity"],
    categoryStrength: 0.98,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 12,
  },

  "security-week": {
    id: "security-week", displayName: "SecurityWeek", homepage: "https://www.securityweek.com",
    transport: "rss", endpoint: "https://feeds.feedburner.com/Securityweek",
    reliabilityScore: 0.85, freshnessWeight: 0.88, thumbnailQuality: "medium",
    defaultCategory: "Cybersecurity", categoryHints: ["Cybersecurity"],
    categoryStrength: 0.98,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 600, enabled: true,
    averageDailyVolume: 8,
  },

  // ── Programming ────────────────────────────────────────────────────────────

  infoq: {
    id: "infoq", displayName: "InfoQ", homepage: "https://www.infoq.com",
    transport: "rss", endpoint: "https://feed.infoq.com/",
    reliabilityScore: 0.86, freshnessWeight: 0.75, thumbnailQuality: "medium",
    defaultCategory: "Programming", categoryHints: ["Programming","Cloud & DevOps","AI"],
    categoryStrength: 0.85,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 900, enabled: true,
    averageDailyVolume: 8,
  },

  "stackoverflow-blog": {
    id: "stackoverflow-blog", displayName: "Stack Overflow Blog", homepage: "https://stackoverflow.blog",
    transport: "rss", endpoint: "https://stackoverflow.blog/feed/",
    reliabilityScore: 0.85, freshnessWeight: 0.65, thumbnailQuality: "medium",
    defaultCategory: "Programming", categoryHints: ["Programming","AI"],
    categoryStrength: 0.90,
    maxArticlesPerFetch: 6, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 3,
  },

  "github-blog": {
    id: "github-blog", displayName: "GitHub Blog", homepage: "https://github.blog",
    transport: "rss", endpoint: "https://github.blog/feed/",
    reliabilityScore: 0.88, freshnessWeight: 0.70, thumbnailQuality: "high",
    defaultCategory: "Programming", categoryHints: ["Programming","AI","Cloud & DevOps"],
    categoryStrength: 0.88,
    maxArticlesPerFetch: 6, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 3,
  },

  "netflix-tech-blog": {
    id: "netflix-tech-blog", displayName: "Netflix Tech Blog", homepage: "https://netflixtechblog.com",
    transport: "rss", endpoint: "https://netflixtechblog.com/feed",
    reliabilityScore: 0.90, freshnessWeight: 0.45, thumbnailQuality: "high",
    categoryHints: ["Programming","Cloud & DevOps","AI"],
    maxArticlesPerFetch: 5, cacheTtlSeconds: 7200, enabled: true,
    averageDailyVolume: 1,
  },

  "martin-fowler": {
    id: "martin-fowler", displayName: "Martin Fowler", homepage: "https://martinfowler.com",
    transport: "rss", endpoint: "https://martinfowler.com/feed.atom",
    reliabilityScore: 0.92, freshnessWeight: 0.30, thumbnailQuality: "none",
    defaultCategory: "Programming", categoryHints: ["Programming"],
    categoryStrength: 0.99,
    maxArticlesPerFetch: 4, cacheTtlSeconds: 86400, enabled: true,
    averageDailyVolume: 0.5,
  },

  // ── Cloud & DevOps ─────────────────────────────────────────────────────────

  "aws-blog": {
    id: "aws-blog", displayName: "AWS Blog", homepage: "https://aws.amazon.com/blogs/aws/",
    transport: "rss", endpoint: "https://aws.amazon.com/blogs/aws/feed/",
    reliabilityScore: 0.90, freshnessWeight: 0.80, thumbnailQuality: "medium",
    defaultCategory: "Cloud & DevOps", categoryHints: ["Cloud & DevOps","AI"],
    categoryStrength: 0.92,
    maxArticlesPerFetch: 8, cacheTtlSeconds: 600, enabled: true,
    averageDailyVolume: 5,
  },

  "google-cloud-blog": {
    id: "google-cloud-blog", displayName: "Google Cloud Blog", homepage: "https://cloud.google.com/blog",
    transport: "rss", endpoint: "https://feeds.feedburner.com/CloudPlatform",
    reliabilityScore: 0.88, freshnessWeight: 0.78, thumbnailQuality: "high",
    defaultCategory: "Cloud & DevOps", categoryHints: ["Cloud & DevOps","AI"],
    categoryStrength: 0.90,
    maxArticlesPerFetch: 8, cacheTtlSeconds: 900, enabled: true,
    averageDailyVolume: 4,
  },

  "azure-blog": {
    id: "azure-blog", displayName: "Azure Blog", homepage: "https://azure.microsoft.com/en-us/blog/",
    transport: "rss", endpoint: "https://azure.microsoft.com/en-us/blog/feed/",
    reliabilityScore: 0.88, freshnessWeight: 0.78, thumbnailQuality: "medium",
    defaultCategory: "Cloud & DevOps", categoryHints: ["Cloud & DevOps","AI"],
    categoryStrength: 0.90,
    maxArticlesPerFetch: 8, cacheTtlSeconds: 900, enabled: true,
    averageDailyVolume: 4,
  },

  "hashicorp-blog": {
    id: "hashicorp-blog", displayName: "HashiCorp Blog", homepage: "https://www.hashicorp.com/blog",
    transport: "rss", endpoint: "https://www.hashicorp.com/blog/feed.xml",
    reliabilityScore: 0.86, freshnessWeight: 0.65, thumbnailQuality: "medium",
    defaultCategory: "Cloud & DevOps", categoryHints: ["Cloud & DevOps","Programming"],
    categoryStrength: 0.95,
    maxArticlesPerFetch: 6, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 2,
  },

  "cncf-blog": {
    id: "cncf-blog", displayName: "CNCF Blog", homepage: "https://www.cncf.io/blog/",
    transport: "rss", endpoint: "https://www.cncf.io/blog/feed/",
    reliabilityScore: 0.84, freshnessWeight: 0.65, thumbnailQuality: "medium",
    defaultCategory: "Cloud & DevOps", categoryHints: ["Cloud & DevOps","Programming"],
    categoryStrength: 0.95,
    maxArticlesPerFetch: 6, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 2,
  },

  "docker-blog": {
    id: "docker-blog", displayName: "Docker Blog", homepage: "https://www.docker.com/blog/",
    transport: "rss", endpoint: "https://www.docker.com/blog/feed/",
    reliabilityScore: 0.84, freshnessWeight: 0.65, thumbnailQuality: "medium",
    defaultCategory: "Cloud & DevOps", categoryHints: ["Cloud & DevOps","Programming"],
    categoryStrength: 0.95,
    maxArticlesPerFetch: 6, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 2,
  },

  // ── Apple ──────────────────────────────────────────────────────────────────

  macrumors: {
    id: "macrumors", displayName: "MacRumors", homepage: "https://www.macrumors.com",
    transport: "rss", endpoint: "https://feeds.macrumors.com/MacRumors-All",
    reliabilityScore: 0.83, freshnessWeight: 0.88, thumbnailQuality: "medium",
    defaultCategory: "Apple", categoryHints: ["Apple","Gadgets"],
    categoryStrength: 0.96,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 600, enabled: true,
    averageDailyVolume: 15,
  },

  appleinsider: {
    id: "appleinsider", displayName: "AppleInsider", homepage: "https://appleinsider.com",
    transport: "rss", endpoint: "https://appleinsider.com/rss/news/",
    reliabilityScore: 0.82, freshnessWeight: 0.85, thumbnailQuality: "medium",
    defaultCategory: "Apple", categoryHints: ["Apple","Gadgets"],
    categoryStrength: 0.97,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 600, enabled: true,
    averageDailyVolume: 12,
  },

  "9to5mac": {
    id: "9to5mac", displayName: "9to5Mac", homepage: "https://9to5mac.com",
    transport: "rss", endpoint: "https://9to5mac.com/feed/",
    reliabilityScore: 0.83, freshnessWeight: 0.88, thumbnailQuality: "high",
    defaultCategory: "Apple", categoryHints: ["Apple","Gadgets"],
    categoryStrength: 0.97,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 600, enabled: true,
    averageDailyVolume: 15,
  },

  "apple-newsroom": {
    id: "apple-newsroom", displayName: "Apple Newsroom", homepage: "https://www.apple.com/newsroom/",
    transport: "rss", endpoint: "https://www.apple.com/newsroom/rss-feed.rss",
    reliabilityScore: 0.98, freshnessWeight: 0.70, thumbnailQuality: "high",
    defaultCategory: "Apple", categoryHints: ["Apple"],
    categoryStrength: 1.0,
    maxArticlesPerFetch: 5, cacheTtlSeconds: 3600, enabled: true,
    averageDailyVolume: 1,
  },

  // ── Android ────────────────────────────────────────────────────────────────

  "android-authority": {
    id: "android-authority", displayName: "Android Authority", homepage: "https://www.androidauthority.com",
    transport: "rss", endpoint: "https://www.androidauthority.com/feed/",
    reliabilityScore: 0.82, freshnessWeight: 0.85, thumbnailQuality: "high",
    defaultCategory: "Android", categoryHints: ["Android","Gadgets"],
    categoryStrength: 0.95,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 600, enabled: true,
    averageDailyVolume: 20,
  },

  "android-developers-blog": {
    id: "android-developers-blog", displayName: "Android Developers Blog", homepage: "https://android-developers.googleblog.com",
    transport: "rss", endpoint: "https://android-developers.googleblog.com/feeds/posts/default",
    reliabilityScore: 0.92, freshnessWeight: 0.65, thumbnailQuality: "medium",
    defaultCategory: "Android", categoryHints: ["Android","Programming"],
    categoryStrength: 0.98,
    maxArticlesPerFetch: 6, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 2,
  },

  "9to5google": {
    id: "9to5google", displayName: "9to5Google", homepage: "https://9to5google.com",
    transport: "rss", endpoint: "https://9to5google.com/feed/",
    reliabilityScore: 0.81, freshnessWeight: 0.85, thumbnailQuality: "high",
    defaultCategory: "Android", categoryHints: ["Android","Gadgets"],
    categoryStrength: 0.93,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 600, enabled: true,
    averageDailyVolume: 12,
  },

  // ── Gaming ─────────────────────────────────────────────────────────────────

  ign: {
    id: "ign", displayName: "IGN", homepage: "https://www.ign.com",
    transport: "rss", endpoint: "https://feeds.feedburner.com/ign/all",
    reliabilityScore: 0.78, freshnessWeight: 0.90, thumbnailQuality: "high",
    defaultCategory: "Gaming", categoryHints: ["Gaming","Gadgets"],
    categoryStrength: 0.92,
    maxArticlesPerFetch: 12, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 30,
  },

  "pc-gamer": {
    id: "pc-gamer", displayName: "PC Gamer", homepage: "https://www.pcgamer.com",
    transport: "rss", endpoint: "https://www.pcgamer.com/rss/",
    reliabilityScore: 0.79, freshnessWeight: 0.88, thumbnailQuality: "high",
    defaultCategory: "Gaming", categoryHints: ["Gaming","Programming"],
    categoryStrength: 0.93,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 20,
  },

  polygon: {
    id: "polygon", displayName: "Polygon", homepage: "https://www.polygon.com",
    transport: "rss", endpoint: "https://www.polygon.com/rss/index.xml",
    reliabilityScore: 0.80, freshnessWeight: 0.88, thumbnailQuality: "high",
    defaultCategory: "Gaming", categoryHints: ["Gaming"],
    categoryStrength: 0.95,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 15,
  },

  eurogamer: {
    id: "eurogamer", displayName: "Eurogamer", homepage: "https://www.eurogamer.net",
    transport: "rss", endpoint: "https://www.eurogamer.net/?format=rss",
    reliabilityScore: 0.79, freshnessWeight: 0.85, thumbnailQuality: "medium",
    defaultCategory: "Gaming", categoryHints: ["Gaming"],
    categoryStrength: 0.95,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 15,
  },

  // ── Space ──────────────────────────────────────────────────────────────────

  "space-com": {
    id: "space-com", displayName: "Space.com", homepage: "https://www.space.com",
    transport: "rss", endpoint: "https://www.space.com/feeds/all",
    reliabilityScore: 0.85, freshnessWeight: 0.80, thumbnailQuality: "high",
    defaultCategory: "Space", categoryHints: ["Space","Science"],
    categoryStrength: 0.95,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 900, enabled: true,
    averageDailyVolume: 10,
  },

  "nasa-news": {
    id: "nasa-news", displayName: "NASA News", homepage: "https://www.nasa.gov/news",
    transport: "rss", endpoint: "https://www.nasa.gov/news-release/feed/",
    reliabilityScore: 0.98, freshnessWeight: 0.65, thumbnailQuality: "high",
    defaultCategory: "Space", categoryHints: ["Space","Science"],
    categoryStrength: 0.99,
    maxArticlesPerFetch: 6, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 2,
  },

  spacenews: {
    id: "spacenews", displayName: "SpaceNews", homepage: "https://spacenews.com",
    transport: "rss", endpoint: "https://spacenews.com/feed/",
    reliabilityScore: 0.87, freshnessWeight: 0.78, thumbnailQuality: "medium",
    defaultCategory: "Space", categoryHints: ["Space"],
    categoryStrength: 0.97,
    maxArticlesPerFetch: 8, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 5,
  },

  "planetary-society": {
    id: "planetary-society", displayName: "Planetary Society", homepage: "https://www.planetary.org/articles",
    transport: "rss", endpoint: "https://www.planetary.org/rss/articles",
    reliabilityScore: 0.90, freshnessWeight: 0.55, thumbnailQuality: "high",
    defaultCategory: "Space", categoryHints: ["Space","Science"],
    categoryStrength: 0.97,
    maxArticlesPerFetch: 5, cacheTtlSeconds: 3600, enabled: true,
    averageDailyVolume: 1,
  },

  // ── Science ────────────────────────────────────────────────────────────────

  "science-daily": {
    id: "science-daily", displayName: "ScienceDaily", homepage: "https://www.sciencedaily.com",
    transport: "rss", endpoint: "https://www.sciencedaily.com/rss/computers_math.xml",
    reliabilityScore: 0.86, freshnessWeight: 0.82, thumbnailQuality: "medium",
    defaultCategory: "Science", categoryHints: ["Science","AI"],
    categoryStrength: 0.90,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 900, enabled: true,
    averageDailyVolume: 10,
  },

  "phys-org": {
    id: "phys-org", displayName: "Phys.org", homepage: "https://phys.org",
    transport: "rss", endpoint: "https://phys.org/rss-feed/",
    reliabilityScore: 0.84, freshnessWeight: 0.82, thumbnailQuality: "medium",
    defaultCategory: "Science", categoryHints: ["Science","Space","AI"],
    categoryStrength: 0.88,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 900, enabled: true,
    averageDailyVolume: 15,
  },

  "new-scientist": {
    id: "new-scientist", displayName: "New Scientist", homepage: "https://www.newscientist.com",
    transport: "rss", endpoint: "https://www.newscientist.com/feed/home/",
    reliabilityScore: 0.88, freshnessWeight: 0.78, thumbnailQuality: "high",
    defaultCategory: "Science", categoryHints: ["Science","Space","AI"],
    categoryStrength: 0.90,
    maxArticlesPerFetch: 8, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 8,
  },

  "nature-news": {
    id: "nature-news", displayName: "Nature News", homepage: "https://www.nature.com/news",
    transport: "rss", endpoint: "https://www.nature.com/nature.rss",
    reliabilityScore: 0.97, freshnessWeight: 0.65, thumbnailQuality: "high",
    defaultCategory: "Science", categoryHints: ["Science","AI"],
    categoryStrength: 0.95,
    maxArticlesPerFetch: 8, cacheTtlSeconds: 3600, enabled: true,
    averageDailyVolume: 5,
  },

  // ── Crypto ─────────────────────────────────────────────────────────────────

  coindesk: {
    id: "coindesk", displayName: "CoinDesk", homepage: "https://www.coindesk.com",
    transport: "rss", endpoint: "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml",
    reliabilityScore: 0.80, freshnessWeight: 0.90, thumbnailQuality: "medium",
    defaultCategory: "Crypto", categoryHints: ["Crypto","Web3","Startups"],
    categoryStrength: 0.92,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 15,
  },

  cointelegraph: {
    id: "cointelegraph", displayName: "Cointelegraph", homepage: "https://cointelegraph.com",
    transport: "rss", endpoint: "https://cointelegraph.com/rss",
    reliabilityScore: 0.76, freshnessWeight: 0.92, thumbnailQuality: "high",
    defaultCategory: "Crypto", categoryHints: ["Crypto","Web3"],
    categoryStrength: 0.94,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 20,
  },

  "the-block": {
    id: "the-block", displayName: "The Block", homepage: "https://www.theblock.co",
    transport: "rss", endpoint: "https://www.theblock.co/rss.xml",
    reliabilityScore: 0.83, freshnessWeight: 0.90, thumbnailQuality: "medium",
    defaultCategory: "Crypto", categoryHints: ["Crypto","Startups"],
    categoryStrength: 0.95,
    maxArticlesPerFetch: 8, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 10,
  },

  "decrypt-co": {
    id: "decrypt-co", displayName: "Decrypt", homepage: "https://decrypt.co",
    transport: "rss", endpoint: "https://decrypt.co/feed",
    reliabilityScore: 0.79, freshnessWeight: 0.90, thumbnailQuality: "high",
    defaultCategory: "Crypto", categoryHints: ["Crypto","Web3","AI"],
    categoryStrength: 0.90,
    maxArticlesPerFetch: 8, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 10,
  },

  // ── Web3 ───────────────────────────────────────────────────────────────────

  "ethereum-blog": {
    id: "ethereum-blog", displayName: "Ethereum Blog", homepage: "https://blog.ethereum.org",
    transport: "rss", endpoint: "https://blog.ethereum.org/en/feed.xml",
    reliabilityScore: 0.90, freshnessWeight: 0.60, thumbnailQuality: "medium",
    defaultCategory: "Web3", categoryHints: ["Web3","Crypto"],
    categoryStrength: 0.98,
    maxArticlesPerFetch: 5, cacheTtlSeconds: 3600, enabled: true,
    averageDailyVolume: 1,
  },

  "polygon-blog": {
    id: "polygon-blog", displayName: "Polygon (Web3)", homepage: "https://polygon.technology/blog",
    transport: "rss", endpoint: "https://polygon.technology/blog/rss.xml",
    reliabilityScore: 0.82, freshnessWeight: 0.65, thumbnailQuality: "medium",
    defaultCategory: "Web3", categoryHints: ["Web3","Crypto"],
    categoryStrength: 0.95,
    maxArticlesPerFetch: 5, cacheTtlSeconds: 3600, enabled: true,
    averageDailyVolume: 1,
  },

  // ── Robotics ───────────────────────────────────────────────────────────────

  "ieee-robotics": {
    id: "ieee-robotics", displayName: "IEEE Robotics", homepage: "https://spectrum.ieee.org/topic/robotics",
    transport: "rss", endpoint: "https://spectrum.ieee.org/feeds/topic/robotics.rss",
    reliabilityScore: 0.92, freshnessWeight: 0.65, thumbnailQuality: "high",
    defaultCategory: "Robotics", categoryHints: ["Robotics","AI","Science"],
    categoryStrength: 0.96,
    maxArticlesPerFetch: 8, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 3,
  },

  "robot-report": {
    id: "robot-report", displayName: "The Robot Report", homepage: "https://www.therobotreport.com",
    transport: "rss", endpoint: "https://www.therobotreport.com/feed/",
    reliabilityScore: 0.83, freshnessWeight: 0.72, thumbnailQuality: "medium",
    defaultCategory: "Robotics", categoryHints: ["Robotics","AI"],
    categoryStrength: 0.97,
    maxArticlesPerFetch: 8, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 4,
  },

  // ── Gadgets ────────────────────────────────────────────────────────────────

  "gsmarena-news": {
    id: "gsmarena-news", displayName: "GSMArena News", homepage: "https://www.gsmarena.com",
    transport: "rss", endpoint: "https://www.gsmarena.com/rss-news-articles.php3",
    reliabilityScore: 0.78, freshnessWeight: 0.92, thumbnailQuality: "medium",
    defaultCategory: "Gadgets", categoryHints: ["Gadgets","Android","Apple"],
    categoryStrength: 0.88,
    maxArticlesPerFetch: 10, cacheTtlSeconds: 300, enabled: true,
    averageDailyVolume: 20,
  },

  "rtings-news": {
    id: "rtings-news", displayName: "RTINGS News", homepage: "https://www.rtings.com/news",
    transport: "rss", endpoint: "https://www.rtings.com/news.rss",
    reliabilityScore: 0.84, freshnessWeight: 0.65, thumbnailQuality: "high",
    defaultCategory: "Gadgets", categoryHints: ["Gadgets"],
    categoryStrength: 0.92,
    maxArticlesPerFetch: 6, cacheTtlSeconds: 1800, enabled: true,
    averageDailyVolume: 2,
  },

  // ── Seed / Fallback ────────────────────────────────────────────────────────

  seed: {
    id: "seed", displayName: "TechPulse Editorial", homepage: "https://techpulse.ai",
    transport: "static",
    reliabilityScore: 0.80, freshnessWeight: 0.50, thumbnailQuality: "high",
    categoryHints: ["AI","Startups","Programming","Cybersecurity"],
    maxArticlesPerFetch: 15, cacheTtlSeconds: 86400, enabled: true,
    averageDailyVolume: 0,
  },
};

// ── Derived helpers ────────────────────────────────────────────────────────────

export const ENABLED_SOURCES  = Object.values(SOURCE_REGISTRY).filter((s) => s.enabled);
export const RSS_SOURCES       = ENABLED_SOURCES.filter((s) => s.transport === "rss");
export const API_SOURCES       = ENABLED_SOURCES.filter((s) => s.transport === "json-api");

export function getSource(id: SourceId): SourceConfig { return SOURCE_REGISTRY[id]; }

export const REDDIT_SUBREDDITS: Array<{ name: string; category: import("../types").CategoryKey }> = [
  { name: "artificial",    category: "AI"            },
  { name: "singularity",   category: "AI"            },
  { name: "MachineLearning",category: "AI"           },
  { name: "technology",    category: "Startups"      },
  { name: "programming",   category: "Programming"   },
  { name: "startups",      category: "Startups"      },
  { name: "cybersecurity", category: "Cybersecurity" },
  { name: "devops",        category: "Cloud & DevOps"},
  { name: "crypto",        category: "Crypto"        },
  { name: "Android",       category: "Android"       },
  { name: "apple",         category: "Apple"         },
  { name: "gaming",        category: "Gaming"        },
  { name: "space",         category: "Space"         },
];