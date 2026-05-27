// =============================================================================
// src/utils/categoryUtils.ts
//
// THE single source of truth for all category comparisons across the app.
//
// WHY THIS EXISTS:
//   The category filtering bug was caused by each component doing its own ad-hoc
//   comparison:  article.category.toLowerCase().includes(q)
//   That "includes" check meant searching for "AI" would also match "Startups"
//   if the article description mentioned "AI startups".
//
// RULE: Every place in the app that compares or normalises categories must
//   use these functions. Never compare .category strings directly.
// =============================================================================

import type { CategoryKey } from "../types";

// ── Canonical set (kept in sync with CategoryKey union in types/index.ts) ──────

const VALID_CATEGORIES = new Set<string>([
  "AI","Startups","Cybersecurity","Gadgets","Programming",
  "Space","Apple","Android","Gaming","Cloud & DevOps",
  "Science","Crypto","Web3","Robotics",
]);

/**
 * Normalise a raw category string to the canonical CategoryKey casing.
 * Handles common variations from external sources:
 *   "cloud" → "Cloud & DevOps"
 *   "cyber" → "Cybersecurity"
 *   "javascript" → "Programming"
 * Returns undefined when no canonical match can be found — caller
 * should then fall back to the source's defaultCategory.
 */
export function normalizeCategory(raw: string | undefined | null): CategoryKey | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();

  // Direct match (most common case — already canonical)
  if (VALID_CATEGORIES.has(trimmed)) return trimmed as CategoryKey;

  // Case-insensitive exact match
  const lower = trimmed.toLowerCase();
  for (const cat of VALID_CATEGORIES) {
    if (cat.toLowerCase() === lower) return cat as CategoryKey;
  }

  // Common alias mappings
  const ALIASES: Record<string, CategoryKey> = {
    "artificial intelligence": "AI",
    "machine learning":        "AI",
    "ml":                      "AI",
    "llm":                     "AI",
    "cloud":                   "Cloud & DevOps",
    "devops":                  "Cloud & DevOps",
    "cloud computing":         "Cloud & DevOps",
    "infrastructure":          "Cloud & DevOps",
    "cyber":                   "Cybersecurity",
    "cybersec":                "Cybersecurity",
    "security":                "Cybersecurity",
    "infosec":                 "Cybersecurity",
    "startup":                 "Startups",
    "venture":                 "Startups",
    "funding":                 "Startups",
    "programming":             "Programming",
    "developer":               "Programming",
    "javascript":              "Programming",
    "python":                  "Programming",
    "rust":                    "Programming",
    "technology":              "Startups",
    "tech":                    "AI",
    "apple":                   "Apple",
    "ios":                     "Apple",
    "macos":                   "Apple",
    "android":                 "Android",
    "google android":          "Android",
    "gaming":                  "Gaming",
    "game":                    "Gaming",
    "games":                   "Gaming",
    "space":                   "Space",
    "astronomy":               "Space",
    "nasa":                    "Space",
    "science":                 "Science",
    "research":                "Science",
    "crypto":                  "Crypto",
    "cryptocurrency":          "Crypto",
    "blockchain":              "Crypto",
    "bitcoin":                 "Crypto",
    "ethereum":                "Crypto",
    "web3":                    "Web3",
    "defi":                    "Web3",
    "nft":                     "Web3",
    "gadgets":                 "Gadgets",
    "gadget":                  "Gadgets",
    "hardware":                "Gadgets",
    "devices":                 "Gadgets",
    "robotics":                "Robotics",
    "robot":                   "Robotics",
    "autonomous":              "Robotics",
  };

  return ALIASES[lower];
}

/**
 * Strict equality check between an article's category and a selected filter.
 * The ONLY function to use when deciding whether to show an article in a filter.
 *
 * Uses exact string equality — no includes(), no partial matching.
 * Both sides are normalised through normalizeCategory() first.
 */
export function isCategoryMatch(articleCategory: string, selectedCategory: string): boolean {
  if (selectedCategory === "All" || selectedCategory === "") return true;
  const normArticle   = normalizeCategory(articleCategory);
  const normSelected  = normalizeCategory(selectedCategory);
  if (!normArticle || !normSelected) return false;
  return normArticle === normSelected;
}

/**
 * Given a raw category string, return the canonical CategoryKey,
 * falling back to `fallback` when no match found.
 */
export function canonicalCategory(
  raw:      string | undefined | null,
  fallback: CategoryKey = "AI"
): CategoryKey {
  return normalizeCategory(raw) ?? fallback;
}

/**
 * All valid category keys as a typed array.
 * Use this instead of hardcoding lists elsewhere.
 */
export const ALL_CATEGORIES: CategoryKey[] = Array.from(VALID_CATEGORIES) as CategoryKey[];

/**
 * Type guard: true if `value` is a valid CategoryKey.
 */
export function isCategoryKey(value: string): value is CategoryKey {
  return VALID_CATEGORIES.has(value);
}