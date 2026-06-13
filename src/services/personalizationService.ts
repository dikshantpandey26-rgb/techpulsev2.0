// =============================================================================
// src/services/personalizationService.ts
//
// Local-only personalization infrastructure.
// No backend. No cookies. No auth required.
// Fully optional — all ranking functions degrade gracefully when profile is empty.
//
// STORAGE:
//   localStorage under key "tp_affinity_profile".
//   sessionStorage is NOT used here (unlike feedUtils.ts trackers) because
//   affinity should persist across sessions to build a meaningful profile.
//   Data is non-sensitive: only category names and article IDs.
//
// PRIVACY:
//   No PII. No tracking pixels. No external calls.
//   Profile lives entirely on the user's device.
//   resetProfile() provides a clean-slate GDPR-style wipe.
//
// FUTURE USE:
//   getProfile().topCategories → soft ranking modifier in applyFeedIntelligence()
//   getProfile().recentOpens → "you already read this" visual indicator
//   getProfile().dwellTimes  → weighted interest signal for personalized sorting
//
//   Phase 9 will introduce the actual ranking modifier.
//   This module is infrastructure-only — it does NOT affect ranking yet.
//
// EDGE COMPATIBILITY:
//   localStorage is browser-only. All functions guard with
//   `typeof localStorage !== "undefined"` so this module is safe to
//   import in SSR or edge contexts (calls become no-ops).
// =============================================================================

import type { CategoryKey } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryInteraction {
  category:    CategoryKey;
  opens:       number;
  totalDwellMs: number;
  lastOpenedAt: string; // ISO timestamp
}

export interface ArticleInteraction {
  articleId:   number;
  openedAt:    string;  // ISO
  dwellMs:     number;  // ms spent with article open
  saved:       boolean;
  shared:      boolean;
}

export interface UserAffinityProfile {
  /** Schema version — bump to force migration on breaking changes */
  version:          1;
  createdAt:        string;
  updatedAt:        string;
  /** Category engagement map */
  categories:       Partial<Record<CategoryKey, CategoryInteraction>>;
  /** Most recent N article interactions (capped at MAX_ARTICLE_HISTORY) */
  recentArticles:   ArticleInteraction[];
  /** Total articles opened this session */
  totalOpens:       number;
  /** Computed: sorted category keys by descending engagement score */
  topCategories:    CategoryKey[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY          = "tp_affinity_profile";
const MAX_ARTICLE_HISTORY  = 200;
const SCHEMA_VERSION       = 1 as const;

// Category engagement score weights
const WEIGHT_OPENS    = 2.0;
const WEIGHT_DWELL_MS = 0.001; // 1000ms = 1 point

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isLocalStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function loadRaw(): UserAffinityProfile | null {
  if (!isLocalStorageAvailable()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserAffinityProfile>;
    if (parsed.version !== SCHEMA_VERSION) return null; // schema mismatch → start fresh
    return parsed as UserAffinityProfile;
  } catch { return null; }
}

function save(profile: UserAffinityProfile): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch { /* localStorage full or blocked — non-fatal */ }
}

function emptyProfile(): UserAffinityProfile {
  return {
    version:        SCHEMA_VERSION,
    createdAt:      new Date().toISOString(),
    updatedAt:      new Date().toISOString(),
    categories:     {},
    recentArticles: [],
    totalOpens:     0,
    topCategories:  [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

function computeTopCategories(
  categories: Partial<Record<CategoryKey, CategoryInteraction>>
): CategoryKey[] {
  return (Object.entries(categories) as Array<[CategoryKey, CategoryInteraction]>)
    .map(([cat, ci]) => ({
      cat,
      score: ci.opens * WEIGHT_OPENS + ci.totalDwellMs * WEIGHT_DWELL_MS,
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ cat }) => cat);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load (or create) the current user's affinity profile.
 * Always returns a valid object — never throws.
 */
export function getProfile(): UserAffinityProfile {
  return loadRaw() ?? emptyProfile();
}

/**
 * Record that the user opened an article.
 * Updates category interaction counts.
 * Returns a "stop" function to call when the article is closed
 * (records dwell time).
 */
export function recordArticleOpen(
  articleId: number,
  category:  CategoryKey
): () => void {
  const openedAt = new Date().toISOString();
  const startMs  = Date.now();

  // Eagerly update category opens (don't wait for close)
  const profile = getProfile();
  const existing = profile.categories[category];
  profile.categories[category] = {
    category,
    opens:         (existing?.opens ?? 0) + 1,
    totalDwellMs:  existing?.totalDwellMs ?? 0,
    lastOpenedAt:  openedAt,
  };
  profile.totalOpens += 1;
  profile.updatedAt   = openedAt;
  profile.topCategories = computeTopCategories(profile.categories);
  save(profile);

  // Return stop function — caller invokes this on modal close
  return (): void => {
    const dwellMs = Date.now() - startMs;
    if (dwellMs < 500) return; // ignore accidental opens

    const p = getProfile();

    // Update dwell time on category
    const cat = p.categories[category];
    if (cat) {
      cat.totalDwellMs += dwellMs;
      p.categories[category] = cat;
    }

    // Record article interaction
    const interaction: ArticleInteraction = {
      articleId, openedAt, dwellMs, saved: false, shared: false,
    };
    p.recentArticles.unshift(interaction);
    if (p.recentArticles.length > MAX_ARTICLE_HISTORY) {
      p.recentArticles = p.recentArticles.slice(0, MAX_ARTICLE_HISTORY);
    }

    p.updatedAt       = new Date().toISOString();
    p.topCategories   = computeTopCategories(p.categories);
    save(p);
  };
}

/**
 * Record that the user bookmarked an article.
 */
export function recordBookmark(articleId: number): void {
  const p = getProfile();
  const idx = p.recentArticles.findIndex((a) => a.articleId === articleId);
  if (idx >= 0) {
    p.recentArticles[idx]!.saved = true;
    p.updatedAt = new Date().toISOString();
    save(p);
  }
}

/**
 * Record that the user shared an article.
 */
export function recordShare(articleId: number): void {
  const p = getProfile();
  const idx = p.recentArticles.findIndex((a) => a.articleId === articleId);
  if (idx >= 0) {
    p.recentArticles[idx]!.shared = true;
    p.updatedAt = new Date().toISOString();
    save(p);
  }
}

/**
 * Update affinity based on a completed reading session.
 * Called externally when reading-time tracker fires.
 */
export function updateProfile(
  update: Partial<Pick<UserAffinityProfile, "categories" | "recentArticles">>
): void {
  const p = getProfile();
  if (update.categories) {
    for (const [cat, ci] of Object.entries(update.categories) as Array<[CategoryKey, CategoryInteraction]>) {
      const existing = p.categories[cat];
      p.categories[cat] = {
        category:     cat,
        opens:        (existing?.opens ?? 0) + (ci.opens ?? 0),
        totalDwellMs: (existing?.totalDwellMs ?? 0) + (ci.totalDwellMs ?? 0),
        lastOpenedAt: ci.lastOpenedAt || new Date().toISOString(),
      };
    }
  }
  if (update.recentArticles) {
    p.recentArticles.unshift(...update.recentArticles);
    p.recentArticles = p.recentArticles.slice(0, MAX_ARTICLE_HISTORY);
  }
  p.updatedAt       = new Date().toISOString();
  p.topCategories   = computeTopCategories(p.categories);
  save(p);
}

/**
 * Wipe all personalization data. GDPR-compliant clean slate.
 */
export function resetProfile(): void {
  if (!isLocalStorageAvailable()) return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Returns the user's top N categories by engagement.
 * Used by future personalized ranking modifier.
 */
export function getTopCategories(n = 5): CategoryKey[] {
  return getProfile().topCategories.slice(0, n);
}

/**
 * Returns true if the user has already opened this article.
 * Used for "already read" visual indicator.
 */
export function hasRead(articleId: number): boolean {
  return getProfile().recentArticles.some((a) => a.articleId === articleId);
}