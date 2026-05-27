// =============================================================================
// src/services/trendingService.ts
//
// Trending score computation and article ranking.
//
// Score formula (0–100):
//   trendingScore =
//     recencyScore    × 0.35   ← recency decay over 48 h
//     hypeScore       × 0.25   ← keyword signal from articleUtils
//     socialScore     × 0.20   ← HN / Reddit / PH engagement normalised
//     authorityBonus  × 0.20   ← source reliability multiplier
//
// Design rationale:
//   Recency is weighted highest because tech news has a 24-hour shelf life.
//   Hype keywords capture breakthrough stories regardless of social signals
//   (many important AI paper releases have low social scores initially).
//   Social score rewards community validation.
//   Authority prevents clickbait-heavy sources from dominating the feed.
// =============================================================================

import type { NormalizedArticle } from "../types";
import { authorityMultiplier } from "./sourceReliabilityService";
import { scoreHype } from "../utils/articleUtils";

// ── Recency decay ─────────────────────────────────────────────────────────────

/**
 * Returns 100 for articles published < 1 hour ago,
 * decaying to 0 at 48 hours using a square-root curve
 * (faster decay early, slower at the tail vs linear).
 */
function recencyScore(publishedAt: string): number {
  const ageMs    = Math.max(0, Date.now() - new Date(publishedAt).getTime());
  const ageHours = ageMs / 3_600_000;
  if (ageHours >= 48) return 0;
  // sqrt gives faster early decay than linear but gentler than exponential
  return Math.round(100 * (1 - Math.sqrt(ageHours / 48)));
}

// ── Social score normalisation ────────────────────────────────────────────────

/**
 * Normalise a raw social score (HN points, Reddit upvotes, PH votes) to 0–100.
 * Uses a log curve so that going from 0→100 points matters more than 1000→1100.
 * Cap: 5000 raw points → 100 normalised.
 */
function normaliseSocialScore(raw: number): number {
  if (raw <= 0) return 0;
  const capped = Math.min(raw, 5000);
  return Math.round((Math.log(capped + 1) / Math.log(5001)) * 100);
}

// ── Main scorer ───────────────────────────────────────────────────────────────

export function computeTrendingScore(article: NormalizedArticle): number {
  const recency   = recencyScore(article.publishedAt);
  const hype      = scoreHype(`${article.title} ${article.summary}`);
  const social    = normaliseSocialScore(article.engagementScore ?? 0);
  const authority = authorityMultiplier(article.sourceId) * 50;

  // Reliability bonus
  const reliabilityBonus =
    Math.min(5, (article.reliabilityScore - 0.70) * 25);

  // Multi-source coverage bonus
  const coverageBonus =
    Math.min(10, ((article.coveredBy?.length ?? 1) - 1) * 2);

  // Breaking news boost
  const breakingBonus =
    article.breaking ? 15 : 0;

  const raw = (
    recency            * 0.33 +
    hype               * 0.24 +
    social             * 0.18 +
    authority          * 0.20 +
    reliabilityBonus +
    coverageBonus +
    breakingBonus
  );

  return Math.min(100, Math.round(raw));
}

// ── Batch ranking ─────────────────────────────────────────────────────────────

/**
 * Score and sort a batch of articles for the feed.
 * Articles are sorted descending by trendingScore, then by publishedAt for ties.
 * Mutates trendingScore in-place so downstream consumers (dedup, cache) see
 * the score without a separate pass.
 */
export function rankArticles(articles: NormalizedArticle[]): NormalizedArticle[] {
  // Score in-place
  for (const a of articles) {
    a.trendingScore = computeTrendingScore(a);
    // Also update the legacy `hype` field so existing UI (NewsCard) still works
    a.hype = a.hypeScore;
    // Mark trending if score ≥ 70
    a.trending = a.trendingScore >= 70;
  }

  return articles.slice().sort((a, b) => {
    if (b.trendingScore !== a.trendingScore) return b.trendingScore - a.trendingScore;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

/**
 * Returns the top N trending articles from a scored + ranked array.
 * Useful for the sidebar TrendingWidget.
 */
export function getTopTrending(articles: NormalizedArticle[], n = 7): NormalizedArticle[] {
  return rankArticles(articles).slice(0, n);
}