// =============================================================================
// src/types/index.ts
//
// EXTENSION STRATEGY (Phase 2):
// All existing types are preserved byte-for-byte below their original comments.
// New Phase 2 types are appended in clearly-marked sections so existing
// consumers (App.tsx, NewsCard, Sidebar, store) compile unchanged.
//
// CategoryKey gains "Web3" and "Robotics" — both backward-safe additions
// because TypeScript union extension never removes members.
//
// NormalizedArticle extends Article so the ingestion pipeline produces objects
// that are valid wherever Article is accepted, with richer optional fields.
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING TYPES — DO NOT MODIFY (Phase 1 contracts)
// ─────────────────────────────────────────────────────────────────────────────

export type Sentiment = "bullish" | "bearish" | "neutral";

// Phase 2 adds Web3 and Robotics — union extension is fully backward-safe.
export type CategoryKey =
  | "AI"
  | "Startups"
  | "Cybersecurity"
  | "Gadgets"
  | "Programming"
  | "Space"
  | "Apple"
  | "Android"
  | "Gaming"
  | "Cloud & DevOps"
  | "Science"
  | "Crypto"
  | "Web3"       // Phase 2
  | "Robotics";  // Phase 2

export interface Article {
  id:              number;
  slug:            string;
  category:        CategoryKey;
  title:           string;
  summary:         string;
  source:          string;
  author:          string;
  time:            string;       // human-relative e.g. "2h ago"
  publishedAt:     string;       // ISO 8601
  readTime:        string;
  views:           string;       // formatted e.g. "48.2K"
  sentiment:       Sentiment;
  hype:            number;       // 0–100
  trending?:       boolean;
  breaking?:       boolean;
  tags:            string[];
  image:           string;
  url:             string;
  aiSummary?:      string;
  aiTags?:         string[];
  engagementScore?: number;
}

export interface CatMeta { color: string; emoji: string; }

export interface Platform {
  id:    string;
  label: string;
  bg:    string;
  icon:  string;
  url:   (encodedUrl: string, encodedTitle: string) => string;
}

export type AIPanelMode = "summary" | "eli5" | "market";

export interface AIPanelButton { id: AIPanelMode; label: string; color: string; }

export interface ClaudeMessage { role: "user" | "assistant"; content: string; }

export interface ClaudeContentBlock { type: string; text?: string; }

export interface ClaudeApiResponse {
  content: ClaudeContentBlock[];
  error?:  { message: string };
}

export interface AIRequest {
  mode:            AIPanelMode | "digest" | "search" | "recommend";
  articleTitle?:   string;
  articleSummary?: string;
  query?:          string;
  headlines?:      string[];
}

export interface AIResponse { result: string; cached?: boolean; error?: string; }

export interface UserProfile {
  id:                    string;
  email:                 string;
  displayName?:          string;
  avatarUrl?:            string;
  followedTopics:        CategoryKey[];
  bookmarkedArticleIds:  number[];
  readArticleIds:        number[];
  newsletterSubscribed:  boolean;
  createdAt:             string;
  updatedAt:             string;
}

export interface ArticleAnalyticsEvent {
  articleId:  number;
  event:      "view" | "share" | "bookmark" | "read_complete" | "ai_interaction";
  userId?:    string;
  sessionId:  string;
  timestamp:  string;
  metadata?:  Record<string, unknown>;
}

export interface DbArticle {
  id:              number;
  slug:            string;
  category:        string;
  title:           string;
  summary:         string;
  source:          string;
  author:          string;
  published_at:    string;
  read_time:       string;
  sentiment:       string;
  hype:            number;
  trending:        boolean;
  breaking:        boolean;
  tags:            string[];
  image_url:       string;
  original_url:    string;
  ai_summary:      string | null;
  ai_tags:         string[] | null;
  engagement_score: number;
  views:           number;
  created_at:      string;
  updated_at:      string;
}

export interface DbSubscriber {
  id:                string;
  email:             string;
  subscribed_topics: string[];
  confirmed:         boolean;
  created_at:        string;
}

export interface StatItem { label: string; value: number; color: string; }

export type Theme = "dark" | "light";

export interface FeedFilters { category: string; searchQuery: string; page: number; }

export interface RawArticle {
  title:       string;
  description: string | null;
  url:         string;
  urlToImage:  string | null;
  publishedAt: string;
  source:      { name: string };
  author:      string | null;
}

export interface HNStory {
  id:          number;
  title:       string;
  url?:        string;
  score:       number;
  time:        number;
  by:          string;
  descendants: number;
}

export interface FeatureFlags {
  enablePushNotifications: boolean;
  enablePremiumGating:     boolean;
  enableLiveSearch:        boolean;
  enableAudioSummary:      boolean;
  enablePersonalization:   boolean;
  enableAdSlots:           boolean;
}

export type AdSlotPosition =
  | "feed-inline"
  | "sidebar-top"
  | "sidebar-mid"
  | "header-banner";

export interface AdSlotConfig {
  position:     AdSlotPosition;
  label:        string;
  sponsorName?: string;
  ctaUrl?:      string;
  ctaLabel?:    string;
}

export interface IngestionResult {
  fetched:    number;
  stored:     number;
  duplicates: number;
  errors:     string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — NORMALIZED ARTICLE SCHEMA
// The full richness produced by the ingestion pipeline.
// Extends Article so it is valid everywhere Article is accepted.
// All new fields are optional — normalizer fills what it can per source.
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizedArticle extends Article {
  // Source provenance
  sourceId:         SourceId;        // canonical source identifier
  sourceUrl:        string;          // homepage of the source, not article URL
  language:         string;          // ISO 639-1 e.g. "en"

  // Scoring — separate from legacy `hype` field
  hypeScore:        number;          // 0–100 keyword-signal hype
  trendingScore:    number;          // 0–100 velocity + engagement composite
  reliabilityScore: number;          // 0–1 source trust rating

  // Deduplication metadata
  canonicalSource?: boolean;         // true = this is the chosen representative
  coveredBy?:       string[];        // other source names covering same story
  clusterKey?:      string;          // hash used to group duplicate articles

  // AI enrichment (populated async, not at ingest time)
  aiInsights?:       string[];       // bullet-point insights
  aiMarketTake?:     string;         // bull/bear analysis
  aiRelatedTopics?:  string[];       // AI-inferred related topic names

  // Classification confidence
  categoryConfidence: number;        // 0–1 from categoryClassifier

  // Relations
  relatedArticleIds?: string[];      // NormalizedArticle ids of related items
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — SOURCE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical identifier for every news source.
 * Adding a new source = add one member here + one record in sourceRegistry.ts.
 * This union is the single source of truth for source identity across the app.
 */
export type SourceId =
  | "newsapi"
  | "gnews"
  | "hackernews"
  | "reddit"
  | "devto"
  | "github-trending"
  | "producthunt"
  | "techcrunch"
  | "theverge"
  | "ars-technica"
  | "wired"
  | "bloomberg-tech"
  | "coindesk"
  | "android-authority"
  | "macrumors"
  | "appleinsider"
  | "space-com"
  | "openai-blog"
  | "anthropic-blog"
  | "google-ai-blog"
  | "meta-engineering"
  | "microsoft-ai"
  | "seed";              // fallback source ID for static mock data

/** Ingestion transport mechanism used to fetch a source */
export type SourceTransport = "rss" | "json-api" | "html-scrape" | "static";

/** Metadata record for a single news source */
export interface SourceConfig {
  id:               SourceId;
  displayName:      string;           // human label used in UI
  homepage:         string;           // canonical homepage URL
  transport:        SourceTransport;
  endpoint?:        string;           // RSS/API URL if applicable
  apiKeyEnvVar?:    string;           // process.env key for secret, if needed
  reliabilityScore: number;           // 0–1; used in ranking
  defaultCategory?: CategoryKey;      // fallback when classifier is uncertain
  categoryHints:    CategoryKey[];    // categories this source commonly covers
  maxArticlesPerFetch: number;        // cap to avoid flooding the feed
  cacheTtlSeconds:  number;           // how long to cache results from this source
  enabled:          boolean;          // toggle without code change
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — RAW FEED TYPES (per-transport payloads before normalization)
// ─────────────────────────────────────────────────────────────────────────────

/** Normalized payload that every source adapter must produce */
export interface RawFeedItem {
  sourceId:    SourceId;
  title:       string;
  url:         string;
  description: string;
  author:      string;
  imageUrl:    string;
  publishedAt: string;       // ISO 8601 or parseable date string
  tags:        string[];     // source-supplied tags (may be empty)
  score?:      number;       // HN/Reddit/PH score if available
  comments?:   number;       // comment count if available
  rawData?:    Record<string, unknown>; // original payload for debugging
}

/** Reddit-specific post shape from JSON API */
export interface RedditPost {
  data: {
    id:           string;
    title:        string;
    url:          string;
    selftext:     string;
    author:       string;
    score:        number;
    num_comments: number;
    created_utc:  number;
    thumbnail:    string;
    subreddit:    string;
    permalink:    string;
    is_self:      boolean;
  };
}

export interface RedditListing {
  data: {
    children: RedditPost[];
    after:    string | null;
  };
}

/** Dev.to article shape */
export interface DevToArticle {
  id:              number;
  title:           string;
  description:     string;
  url:             string;
  cover_image:     string | null;
  social_image:    string | null;
  published_at:    string;
  tag_list:        string[];
  user:            { name: string; username: string };
  reading_time_minutes: number;
  public_reactions_count: number;
  comments_count:  number;
}

/** Product Hunt post shape */
export interface ProductHuntPost {
  id:          number;
  name:        string;
  tagline:     string;
  url:         string;
  thumbnail?:  { image_url: string };
  votes_count: number;
  comments_count: number;
  created_at:  string;
  topics?:     Array<{ name: string }>;
}

/** GNews article shape */
export interface GNewsArticle {
  title:       string;
  description: string;
  content:     string;
  url:         string;
  image:       string;
  publishedAt: string;
  source:      { name: string; url: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — INGESTION PIPELINE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Result produced by a single source adapter */
export interface SourceFetchResult {
  sourceId:    SourceId;
  items:       RawFeedItem[];
  fetchedAt:   string;              // ISO timestamp
  durationMs:  number;
  error?:      string;              // set if fetch partially/fully failed
  fromCache:   boolean;
}

/** The aggregated batch produced by running all adapters */
export interface IngestionBatch {
  batchId:     string;              // UUID-style run identifier
  startedAt:   string;
  completedAt: string;
  sources:     SourceFetchResult[];
  totalFetched: number;
  afterDedup:  number;
  articles:    NormalizedArticle[];
}

/** Per-run ingestion statistics surfaced to the /api/ingest response */
export interface IngestionStats {
  batchId:     string;
  startedAt:   string;
  durationMs:  number;
  sources: Array<{
    sourceId:  SourceId;
    fetched:   number;
    durationMs: number;
    fromCache: boolean;
    error?:    string;
  }>;
  totalFetched:    number;
  afterDedup:      number;
  duplicatesDropped: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — DEDUPLICATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** A cluster of articles that represent the same real-world story */
export interface DedupCluster {
  clusterKey:  string;              // stable hash / fingerprint
  canonical:   NormalizedArticle;  // the chosen representative article
  duplicates:  NormalizedArticle[]; // the others (not shown in feed)
  sources:     string[];            // all source displayNames in cluster
  totalCoverage: number;            // count of unique sources
}

/** Similarity verdict between two articles */
export interface SimilarityResult {
  score:       number;              // 0–1; ≥0.72 = duplicate
  isDuplicate: boolean;
  method:      "exact-url" | "title-token" | "cosine" | "prefix";
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — CATEGORY CLASSIFIER TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ClassificationResult {
  category:   CategoryKey;
  confidence: number;               // 0–1
  signals:    string[];             // matched keywords (for debugging)
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — CACHE SERVICE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data:        T;
  storedAt:    number;              // Date.now() when written
  expiresAt:   number;              // Date.now() + ttl; after this: stale
  staleUntil:  number;              // Date.now() + staleTtl; after this: drop
}

export interface CacheGetResult<T> {
  data:        T;
  isStale:     boolean;             // true = data served but revalidation needed
  fromCache:   boolean;
}

export interface CacheOptions {
  /** Time in seconds before data becomes stale (but still served). */
  ttl: number;
  /**
   * Time in seconds after ttl expires before the entry is evicted entirely.
   * During this window data is returned as stale while revalidation runs.
   * Defaults to ttl * 2.
   */
  staleTtl?: number;
}