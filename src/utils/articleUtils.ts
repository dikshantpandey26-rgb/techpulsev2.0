// =============================================================================
// src/utils/articleUtils.ts — Article transformation and scoring utilities
// =============================================================================

/** Convert a headline to a URL-safe slug */
export function slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);
  }
  
  /** Estimate reading time from word count */
  export function estimateReadTime(text: string): string {
    const words = text.trim().split(/\s+/).length;
    const mins  = Math.max(1, Math.round(words / 200));
    return `${mins} min`;
  }
  
  /** Score 0–100 hype based on keywords and signals */
  export function scoreHype(text: string): number {
    const lower    = text.toLowerCase();
    const signals  = [
      { kw: "breakthrough",    pts: 15 },
      { kw: "first ever",      pts: 15 },
      { kw: "record",          pts: 10 },
      { kw: "raises",          pts:  8 },
      { kw: "billion",         pts: 10 },
      { kw: "critical",        pts: 12 },
      { kw: "zero-day",        pts: 18 },
      { kw: "launches",        pts:  7 },
      { kw: "new model",       pts: 10 },
      { kw: "agi",             pts: 20 },
      { kw: "revolutionary",   pts: 12 },
      { kw: "surpasses human", pts: 20 },
    ];
    const base  = 40;
    const bonus = signals.reduce((acc, { kw, pts }) => acc + (lower.includes(kw) ? pts : 0), 0);
    return Math.min(99, base + bonus);
  }
  
  /** Truncate text to N words with ellipsis */
  export function truncate(text: string, maxWords: number): string {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(" ") + "…";
  }
  
  /** Format large numbers: 48200 → "48.2K" */
  export function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }
  
  /** ISO timestamp → relative string ("2h ago") */
  export function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m    = Math.floor(diff / 60_000);
    if (m < 1)   return "just now";
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
  
  /** Compute a simple engagement score for trending algorithm */
  export function computeEngagementScore(views: number, shares: number, bookmarks: number, ageMinutes: number): number {
    const raw     = views + shares * 5 + bookmarks * 3;
    const decay   = Math.max(1, ageMinutes / 60); // decay over hours
    return Math.round(raw / decay);
  }
  
  /** Check if two articles are likely duplicates (title similarity > 80%) */
  export function isDuplicate(a: string, b: string): boolean {
    const clean = (s: string): string => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    const wordsA = new Set(clean(a).split(/\s+/));
    const wordsB = clean(b).split(/\s+/);
    const overlap = wordsB.filter((w) => wordsA.has(w)).length;
    const similarity = overlap / Math.max(wordsA.size, wordsB.length);
    return similarity > 0.8;
  }