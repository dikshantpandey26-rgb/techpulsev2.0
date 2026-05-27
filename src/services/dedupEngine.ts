// =============================================================================
// src/services/dedupEngine.ts
//
// High-level deduplication orchestrator that wraps articleDedupService.ts
// and enriches canonical articles with UI-ready coverage metadata.
//
// SEPARATION OF CONCERNS:
//   articleDedupService.ts  — low-level similarity algorithms (cosine, Jaccard)
//   dedupEngine.ts          — orchestration + coverage annotations for the UI
//
// WHAT THIS ADDS OVER articleDedupService:
//   1. Formats `coveredByLabel` ("Covered by 7 sources") for direct card rendering
//   2. Builds `coverageDetails` array with reliability scores for the modal
//   3. Sorts coverage by reliability so the most authoritative source is first
//   4. Exposes `sourceCount` as a top-level number (used by NewsCard)
// =============================================================================

import type { NormalizedArticle } from "../types";
import { deduplicateArticles, type DeduplicationResult } from "./articleDedupService";
import { getSourceProfile } from "./sourceReliabilityService";

// ── Coverage detail item for the modal ───────────────────────────────────────

export interface CoverageSource {
  sourceName:       string;
  url:              string;
  publishedAt:      string;
  reliabilityScore: number;
  reliabilityLabel: string; // "High" | "Medium" | "Low"
}

/** Extended canonical article with UI-ready coverage fields */
export interface ArticleWithCoverage extends NormalizedArticle {
  sourceCount:      number;
  coveredByLabel:   string;           // e.g. "Covered by 7 sources"
  coverageDetails:  CoverageSource[]; // sorted by reliability desc
}

// ── Label formatting ──────────────────────────────────────────────────────────

function reliabilityLabel(score: number): string {
  if (score >= 0.85) return "High";
  if (score >= 0.70) return "Medium";
  return "Low";
}

function coveredByLabel(count: number): string {
  if (count <= 1) return "";
  return `Covered by ${count} source${count === 1 ? "" : "s"}`;
}

// ── Main dedup + annotate ─────────────────────────────────────────────────────

/**
 * Run deduplication on a batch of normalised articles and annotate each
 * canonical article with UI-ready coverage metadata.
 *
 * @returns ArticleWithCoverage[] sorted by trendingScore descending
 */
export function deduplicateAndAnnotate(
  articles: NormalizedArticle[]
): ArticleWithCoverage[] {
  const result: DeduplicationResult = deduplicateArticles(articles);

  return result.articles.map((canonical): ArticleWithCoverage => {
    // Find the cluster for this canonical article
    const cluster = result.clusters.find(
      (c) => c.canonical.id === canonical.id
    );

    const allInCluster: NormalizedArticle[] = cluster
      ? [cluster.canonical, ...cluster.duplicates]
      : [canonical];

    const sourceCount = allInCluster.length;

    // Build per-source coverage details
    const coverageDetails: CoverageSource[] = allInCluster
      .map((a): CoverageSource => {
        const profile    = getSourceProfile(a.sourceId);
        const reliability = profile?.reliabilityScore ?? 0.70;
        return {
          sourceName:       a.source,
          url:              a.url,
          publishedAt:      a.publishedAt,
          reliabilityScore: reliability,
          reliabilityLabel: reliabilityLabel(reliability),
        };
      })
      .sort((a, b) => b.reliabilityScore - a.reliabilityScore);

    return {
      ...canonical,
      sourceCount,
      coveredByLabel:  coveredByLabel(sourceCount),
      coverageDetails,
    };
  });
}

/**
 * Convenience: run dedup + annotate + sort by trendingScore.
 */
export function processArticleBatch(raw: NormalizedArticle[]): ArticleWithCoverage[] {
  return deduplicateAndAnnotate(raw).sort(
    (a, b) => b.trendingScore - a.trendingScore
  );
}