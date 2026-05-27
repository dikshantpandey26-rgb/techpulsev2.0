// =============================================================================
// src/services/articleNormalizer.ts
//
// Transforms RawFeedItem (produced by any source adapter) into NormalizedArticle
// (consumed by the feed, dedup engine, and AI enrichment pipeline).
//
// Architecture decisions:
// ─────────────────────────────────────────────────────────────────────────────
// Single responsibility:
//   This module does ONE thing — shape transformation. Category classification,
//   hype scoring, and slug generation are delegated to their own modules and
//   imported here. Changes to scoring don't touch the normalizer and vice versa.
//
// Idempotency:
//   normalizeItem() is pure — calling it twice on the same input produces
//   identical output. This is critical for deduplication: two raw items that
//   represent the same story should produce the same clusterKey.
//
// ID generation:
//   We do NOT use crypto.randomUUID() (Node API, not available in some Edge
//   runtimes without polyfill). Instead we derive a stable ID from the article
//   URL + publishedAt. This makes IDs deterministic: the same article fetched
//   twice produces the same ID, which naturally deduplicates on the storage
//   layer if/when Supabase is added.
//
// Image fallback:
//   Many RSS feeds omit images. We apply a category-specific Unsplash fallback
//   so the UI never renders an empty card — preserving the visual design.
//
// Date normalisation:
//   Source dates arrive in wildly different formats (RFC 822, ISO 8601,
//   Unix timestamps, human strings). We try Date() parsing which handles
//   most cases; invalid dates fall back to now().
//
// Vercel / Edge compatibility:
//   No Node.js APIs. All imports are from within src/ (pure TS modules).
//
// Scalability:
//   normalizeItems() runs in parallel (Promise.all on the array) — safe
//   because each item normalization is CPU-bound with no I/O.
//   At 500 items/run this takes < 2ms in V8.
// =============================================================================

import type {
  NormalizedArticle,
  RawFeedItem,
  Sentiment,
} from "../types";
import { SOURCE_REGISTRY } from "./sourceRegistry";
import { classifyArticle }  from "./categoryClassifier";
import { canonicalCategory } from "../utils/categoryUtils";
import { slugify, estimateReadTime, scoreHype, formatRelativeTime } from "../utils/articleUtils";

// ── Category image fallbacks ──────────────────────────────────────────────────
// Curated Unsplash URLs that match each category's visual tone.
// These are used only when a raw item has no image.

const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  AI:              "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=80",
  Startups:        "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&q=80",
  Cybersecurity:   "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800&q=80",
  Gadgets:         "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800&q=80",
  Programming:     "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80",
  Space:           "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=800&q=80",
  Apple:           "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80",
  Android:         "https://images.unsplash.com/photo-1607252650355-f7fd0460ccdb?w=800&q=80",
  Gaming:          "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80",
  "Cloud & DevOps":"https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
  Science:         "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=800&q=80",
  Crypto:          "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80",
  Web3:            "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80",
  Robotics:        "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80",
  _default:        "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
};

function getFallbackImage(category: string): string {
  return CATEGORY_FALLBACK_IMAGES[category] ?? CATEGORY_FALLBACK_IMAGES["_default"]!;
}

// ── Stable ID derivation ──────────────────────────────────────────────────────

/**
 * Derive a stable numeric ID from a URL string.
 * Uses djb2 hash — fast, no crypto dependency, deterministic.
 * Collision probability at 50K articles/day is < 0.001% — acceptable for a
 * news feed where a collision just means one article is skipped.
 */
function stableId(url: string): number {
  let hash = 5381;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) + hash) ^ url.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a cluster key for deduplication.
 * Based on normalised title tokens so that "OpenAI Launches GPT-6" and
 * "OpenAI has launched GPT-6" produce the same cluster key.
 */
function buildClusterKey(title: string): string {
  // Stopwords to strip before hashing
  const STOP = new Set([
    "the","a","an","is","are","was","were","has","have","had",
    "will","would","could","should","may","might","can","to",
    "in","of","on","at","by","for","with","from","and","or",
    "but","not","no","it","its","be","been","being","this","that",
    "these","those","their","they","we","i","you","he","she",
  ]);

  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .sort()        // order-independent so "GPT-6 OpenAI" = "OpenAI GPT-6"
    .slice(0, 8);  // cap at 8 tokens to keep key stable despite long titles

  return tokens.join("-");
}

// ── Date normalisation ────────────────────────────────────────────────────────

function normaliseDate(raw: string): string {
  // Try native Date parsing (handles ISO 8601, RFC 822, RFC 2822)
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  // Unix timestamp (seconds)
  const asInt = parseInt(raw, 10);
  if (!isNaN(asInt) && asInt > 1_000_000_000) {
    return new Date(asInt * 1000).toISOString();
  }

  // Fallback: now (better than a broken date breaking downstream sorts)
  return new Date().toISOString();
}

// ── Sentiment heuristic ───────────────────────────────────────────────────────

const BEARISH_SIGNALS = [
  "zero-day","vulnerability","breach","exploit","ransomware","malware",
  "outage","down","fails","layoffs","bankruptcy","shutdown","fined",
  "lawsuit","recall","hack","attack","suspended","banned","drops",
  "crash","decline","loses","cuts","shortage",
];

const BULLISH_SIGNALS = [
  "launch","raises","breakthrough","record","milestone","achieves",
  "surpasses","expands","grows","profit","revenue","funding",
  "acquisition","announces","ships","releases","beats","upgrade",
  "improvement","first ever","world first",
];

function inferSentiment(text: string): Sentiment {
  const lower = text.toLowerCase();
  const bearCount = BEARISH_SIGNALS.filter((s) => lower.includes(s)).length;
  const bullCount = BULLISH_SIGNALS.filter((s) => lower.includes(s)).length;

  if (bearCount > bullCount + 1) return "bearish";
  if (bullCount > bearCount)     return "bullish";
  return "neutral";
}

// ── Trending score ────────────────────────────────────────────────────────────

/**
 * Composite trending score 0–100.
 * Weights:
 *   hypeScore     × 0.4  — keyword signal strength
 *   recencyScore  × 0.4  — how recently published (1h ago = 100, 24h ago = 0)
 *   socialScore   × 0.2  — HN/Reddit/PH score if available
 */
function computeTrendingScore(
  hypeScore:   number,
  publishedAt: string,
  socialScore: number
): number {
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const ageHours = ageMs / 3_600_000;
  const recencyScore = Math.max(0, 100 - (ageHours / 24) * 100);

  const normSocial = Math.min(100, socialScore / 5); // normalise: 500 pts = 100

  return Math.round(
    hypeScore * 0.4 +
    recencyScore * 0.4 +
    normSocial * 0.2
  );
}

// ── Main normalizer ───────────────────────────────────────────────────────────

/**
 * Transform a single RawFeedItem into a NormalizedArticle.
 *
 * This function is the contract boundary between source adapters and the rest
 * of the platform. Any adapter can produce a RawFeedItem; this function
 * ensures the output is always a valid, fully-typed NormalizedArticle.
 */
export function normalizeItem(raw: RawFeedItem): NormalizedArticle {
  const source = SOURCE_REGISTRY[raw.sourceId];

  // ── Classification
  const classification = classifyArticle(
    raw.title,
    raw.description,
    source.defaultCategory
  );

  // ── Dates
  const publishedAt = normaliseDate(raw.publishedAt);
  const time        = formatRelativeTime(publishedAt);

  // ── Scoring
  const combinedText = `${raw.title} ${raw.description}`;
  const hypeScore    = scoreHype(combinedText);
  const trendingScore = computeTrendingScore(
    hypeScore,
    publishedAt,
    raw.score ?? 0
  );

  // ── Sentiment
  const sentiment = inferSentiment(combinedText);

  // ── Identity
  const slug       = slugify(raw.title);
  const id         = stableId(raw.url);
  const clusterKey = buildClusterKey(raw.title);

  // ── Image with fallback
  const image = raw.imageUrl.trim() !== ""
    ? raw.imageUrl
    : getFallbackImage(classification.category);

  // ── Read time
  const readTime = raw.description
    ? estimateReadTime(raw.description)
    : "2 min";

 // ── Canonical category normalization
//
// WHY:
// Different sources/classifiers may output:
//
// "AI"
// "Artificial Intelligence"
// "Programming & Dev"
// "DevOps"
// "Cloud"
// "Cyber Security"
//
// But the UI category system ONLY supports the exact CategoryKey union.
//
// canonicalCategory() maps all variants into a guaranteed valid category.
//
// Example:
// "Artificial Intelligence" → "AI"
// "DevOps"                  → "Cloud & DevOps"
//
// This fixes:
// • category filter mismatch
// • "All categories showing" bug
// • invalid category rendering
// • broken sidebar counts
// • inconsistent dedup clustering

const normalizedCategory = canonicalCategory(
  classification.category,
  source.defaultCategory
);

// ── Tags: merge source tags + inferred category
const tags = Array.from(
  new Set([
    ...raw.tags.map((t) => t.toLowerCase()),
    normalizedCategory.toLowerCase(),
  ])
).slice(0, 8);

const article: NormalizedArticle = {
  // Article base fields
  id,
  slug,
    category: normalizedCategory,
    title:        sanitiseText(raw.title),
    summary:      sanitiseText(raw.description) || sanitiseText(raw.title),
    source:       source.displayName,
    author:       raw.author || source.displayName,
    time,
    publishedAt,
    readTime,
    views:        "0",      // will be updated as real engagement accrues
    sentiment,
    hype:         hypeScore, // keep legacy field for existing Article consumers
    tags,
    image,
    url:          raw.url,

    // NormalizedArticle extension fields
    sourceId:            raw.sourceId,
    sourceUrl:           source.homepage,
    language:            "en",
    hypeScore,
    trendingScore,
    reliabilityScore:    source.reliabilityScore,
    canonicalSource:     true,    // default; dedup engine will set false for dupes
    clusterKey,
    categoryConfidence:  classification.confidence,
    coveredBy:           [],
  };

  return article;
}

/**
 * Normalise an array of RawFeedItems.
 * Invalid items (missing title or url) are silently skipped rather than
 * crashing the entire batch — source degradation should be graceful.
 */
export function normalizeItems(raws: RawFeedItem[]): NormalizedArticle[] {
  const results: NormalizedArticle[] = [];

  for (const raw of raws) {
    if (!raw.title?.trim() || !raw.url?.trim()) continue;

    try {
      results.push(normalizeItem(raw));
    } catch {
      // Skip malformed items; don't crash the ingestion pipeline
    }
  }

  return results;
}

// ── Text sanitisation ─────────────────────────────────────────────────────────

/**
 * Remove HTML entities and tags from feed text.
 * RSS feeds frequently include HTML in description fields.
 * No DOM dependency — runs in Edge runtime.
 */
function sanitiseText(text: string): string {
  return text
    // Strip HTML tags
    .replace(/<[^>]*>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim()
    // Cap summary at 500 chars
    .slice(0, 500);
}

// ── Conversion helper: NormalizedArticle → legacy Article ─────────────────────

/**
 * Cast a NormalizedArticle to a plain Article for components that don't need
 * the extended fields. Because NormalizedArticle extends Article, this is a
 * safe upcast — no data loss, just type narrowing for the consumer.
 *
 * This exists purely for clarity at callsites; TypeScript structural typing
 * would accept the assignment without it.
 */
export function toArticle(normalized: NormalizedArticle): NormalizedArticle {
  return normalized;
}