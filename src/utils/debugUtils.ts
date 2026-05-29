// =============================================================================
// src/utils/debugUtils.ts
//
// Production-safe diagnostics. All exported functions are no-ops in production
// builds — Vite's dead-code elimination removes them entirely when
// import.meta.env.DEV is false (which it is after `vite build`).
//
// Usage pattern:
//   const t = dbg.time("dedup");
//   ... expensive work ...
//   t.end();   // prints in DEV, no-op in PROD
//
// Design:
//   - No side effects in PROD (zero bundle cost after tree-shaking)
//   - No external dependencies
//   - No persistent state — only ephemeral console output
//   - Grouped console output to reduce log noise
//   - Edge-runtime safe (uses Date.now(), not performance.now(), for compatibility)
// =============================================================================

const IS_DEV = typeof import.meta !== "undefined" && import.meta.env?.DEV === true;

// ── Timer ─────────────────────────────────────────────────────────────────────

export interface TimerHandle {
  /** Call when the timed operation completes */
  end: (extraLabel?: string) => void;
}

const NOOP_TIMER: TimerHandle = { end: () => {} };

/**
 * Start a named timer. In DEV: logs duration on .end(). In PROD: no-op.
 */
function time(label: string): TimerHandle {
  if (!IS_DEV) return NOOP_TIMER;
  const start = Date.now();
  return {
    end(extraLabel = "") {
      const ms = Date.now() - start;
      console.info(`⏱ [TechPulse] ${label}${extraLabel ? ` (${extraLabel})` : ""}: ${ms}ms`);
    },
  };
}

// ── Metric counters ───────────────────────────────────────────────────────────

interface PipelineMetrics {
  fetchDurationMs:  number;
  normCount:        number;
  dedupDropped:     number;
  finalCount:       number;
  totalDurationMs:  number;
  cacheHits:        number;
  cacheMisses:      number;
  sourceErrors:     string[];
}

/**
 * Log a structured pipeline summary in DEV. No-op in PROD.
 */
function logPipeline(metrics: PipelineMetrics): void {
  if (!IS_DEV) return;
  console.groupCollapsed(
    `📰 [TechPulse] Pipeline complete — ${metrics.finalCount} articles in ${metrics.totalDurationMs}ms`
  );
  console.table({
    "Fetch (ms)":     metrics.fetchDurationMs,
    "Normalised":     metrics.normCount,
    "Dedup dropped":  metrics.dedupDropped,
    "Final":          metrics.finalCount,
    "Cache hits":     metrics.cacheHits,
    "Cache misses":   metrics.cacheMisses,
  });
  if (metrics.sourceErrors.length > 0) {
    console.warn("Source errors:", metrics.sourceErrors);
  }
  console.groupEnd();
}

/**
 * Log a cache event in DEV.
 */
function logCache(key: string, event: "HIT" | "MISS" | "STALE" | "WRITE"): void {
  if (!IS_DEV) return;
  const icons = { HIT: "✅", MISS: "❌", STALE: "🕐", WRITE: "💾" };
  console.info(`${icons[event]} [Cache] ${event} — ${key}`);
}

/**
 * Log a fetch lifecycle event in DEV.
 */
function logFetch(
  source: string,
  event:  "start" | "done" | "error" | "cached",
  detail?: string
): void {
  if (!IS_DEV) return;
  const icons = { start: "🔄", done: "✓", error: "✗", cached: "📦" };
  console.info(`${icons[event]} [Fetch] ${source} — ${event}${detail ? `: ${detail}` : ""}`);
}

// ── Export ────────────────────────────────────────────────────────────────────

export const dbg = {
  time,
  logPipeline,
  logCache,
  logFetch,
} as const;

export type { PipelineMetrics };