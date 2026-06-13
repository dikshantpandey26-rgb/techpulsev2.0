// =============================================================================
// src/services/sourceReliabilityService.ts
//
// Source authority and bias scoring system.
// Used by trendingService.ts to weight articles from authoritative sources
// more heavily than low-credibility ones.
//
// Architecture: pure data + pure functions, zero I/O, zero deps.
// All scores are manually calibrated editorial judgements, not ML-derived,
// so they can be audited and overridden by ops without re-deploying code.
// =============================================================================

import type { SourceId } from "../types";

export type BiasLevel = "left" | "center-left" | "center" | "center-right" | "right" | "technical";

export interface SourceProfile {
  reliabilityScore:  number;   // 0–1 overall trustworthiness
  technicalDepth:    number;   // 0–1 how deeply technical the coverage is
  freshnessScore:    number;   // 0–1 how quickly they break news
  biasLevel:         BiasLevel;
  // Weighted authority = reliabilityScore * 0.5 + technicalDepth * 0.3 + freshnessScore * 0.2
  authority:         number;
}

// ── Source profiles ───────────────────────────────────────────────────────────

//const PROFILES: Record<SourceId, SourceProfile> = {
const PROFILES: Partial<Record<SourceId, SourceProfile>> = {
  newsapi:          { reliabilityScore: 0.80, technicalDepth: 0.50, freshnessScore: 0.85, biasLevel: "center",        authority: 0 },
  gnews:            { reliabilityScore: 0.75, technicalDepth: 0.45, freshnessScore: 0.80, biasLevel: "center",        authority: 0 },
  hackernews:       { reliabilityScore: 0.85, technicalDepth: 0.90, freshnessScore: 0.90, biasLevel: "technical",     authority: 0 },
  reddit:           { reliabilityScore: 0.65, technicalDepth: 0.60, freshnessScore: 0.85, biasLevel: "center",        authority: 0 },
  devto:            { reliabilityScore: 0.70, technicalDepth: 0.85, freshnessScore: 0.70, biasLevel: "technical",     authority: 0 },
  "github-trending":{ reliabilityScore: 0.75, technicalDepth: 0.95, freshnessScore: 0.70, biasLevel: "technical",     authority: 0 },
  producthunt:      { reliabilityScore: 0.72, technicalDepth: 0.55, freshnessScore: 0.80, biasLevel: "center",        authority: 0 },
  techcrunch:       { reliabilityScore: 0.88, technicalDepth: 0.65, freshnessScore: 0.92, biasLevel: "center-left",   authority: 0 },
  theverge:         { reliabilityScore: 0.87, technicalDepth: 0.60, freshnessScore: 0.90, biasLevel: "center-left",   authority: 0 },
  "ars-technica":   { reliabilityScore: 0.92, technicalDepth: 0.95, freshnessScore: 0.80, biasLevel: "technical",     authority: 0 },
  wired:            { reliabilityScore: 0.88, technicalDepth: 0.75, freshnessScore: 0.80, biasLevel: "center-left",   authority: 0 },
  "bloomberg-tech": { reliabilityScore: 0.93, technicalDepth: 0.70, freshnessScore: 0.88, biasLevel: "center",        authority: 0 },
  coindesk:         { reliabilityScore: 0.80, technicalDepth: 0.75, freshnessScore: 0.88, biasLevel: "center",        authority: 0 },
  "android-authority":{ reliabilityScore: 0.82, technicalDepth: 0.80, freshnessScore: 0.85, biasLevel: "technical",  authority: 0 },
  macrumors:        { reliabilityScore: 0.83, technicalDepth: 0.75, freshnessScore: 0.88, biasLevel: "technical",     authority: 0 },
  appleinsider:     { reliabilityScore: 0.82, technicalDepth: 0.80, freshnessScore: 0.85, biasLevel: "technical",     authority: 0 },
  "space-com":      { reliabilityScore: 0.85, technicalDepth: 0.82, freshnessScore: 0.80, biasLevel: "technical",     authority: 0 },
  "openai-blog":    { reliabilityScore: 0.95, technicalDepth: 0.90, freshnessScore: 0.70, biasLevel: "technical",     authority: 0 },
  "anthropic-blog": { reliabilityScore: 0.95, technicalDepth: 0.92, freshnessScore: 0.65, biasLevel: "technical",     authority: 0 },
  "google-ai-blog": { reliabilityScore: 0.93, technicalDepth: 0.95, freshnessScore: 0.65, biasLevel: "technical",     authority: 0 },
  "meta-engineering":{ reliabilityScore: 0.90, technicalDepth: 0.93, freshnessScore: 0.60, biasLevel: "technical",   authority: 0 },
  "microsoft-ai":   { reliabilityScore: 0.90, technicalDepth: 0.90, freshnessScore: 0.60, biasLevel: "technical",     authority: 0 },
  seed:             { reliabilityScore: 0.80, technicalDepth: 0.70, freshnessScore: 0.50, biasLevel: "technical",     authority: 0 },
};

// Pre-compute authority scores (weighted composite)
for (const id of Object.keys(PROFILES) as SourceId[]) {
  const profile = PROFILES[id];

  if (!profile) continue;

  profile.authority = parseFloat(
    (
      profile.reliabilityScore * 0.5 +
      profile.technicalDepth * 0.3 +
      profile.freshnessScore * 0.2
    ).toFixed(3)
  );
}

const DEFAULT_PROFILE: SourceProfile = {
  reliabilityScore: 0.75,
  technicalDepth: 0.70,
  freshnessScore: 0.80,
  biasLevel: "center",
  authority: 0.70,
};

export function getSourceProfile(id: SourceId): SourceProfile {
  return PROFILES[id] ?? DEFAULT_PROFILE;
}

/**
 * Returns a normalised authority multiplier in [0.5, 1.5].
 * Used as a multiplicative factor in the trending score formula.
 * Score of 1.0 = average source; 1.5 = highly authoritative (e.g. Ars Technica);
 * 0.5 = low-trust source (applied to heavily SEO-optimised aggregators).
 */
export function authorityMultiplier(id: SourceId): number {
  const authority = PROFILES[id]?.authority ?? 0.75;
  // Map [0, 1] → [0.5, 1.5]
  return 0.5 + authority;
}