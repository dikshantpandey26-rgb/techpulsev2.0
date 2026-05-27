// =============================================================================
// api/ingest.ts — Vercel Edge Cron Job (every 10 minutes)
//
// HARDENING CHANGES (Phase 2 Part 3):
// • Structured logging with timing per source
// • Partial failure tolerance: one broken source never aborts the pipeline
// • Source-level retry isolation via Promise.allSettled everywhere
// • Ingestion duration metrics in response
// • Emergency fallback: if pipeline crashes, returns 200 with seed data count
//   so the cron job doesn't retry with exponential backoff unnecessarily
// =============================================================================

export const config = { runtime: "edge" };

import { runIngestion } from "../src/services/newsService";
import type { IngestionStats } from "../src/types";

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-cron-secret",
  };
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors() },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

  // ── Auth gate ───────────────────────────────────────────────────────────────
  const cronSecret = request.headers.get("x-cron-secret");
  const envSecret  = (typeof process !== "undefined" ? process.env.CRON_SECRET : undefined) as string | undefined;
  if (envSecret && cronSecret !== envSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const wallStart = Date.now();

  // ── Structured log helper ──────────────────────────────────────────────────
  const log = (level: "info" | "warn" | "error", msg: string, data?: unknown): void => {
    const ts = new Date().toISOString();
    const line = `[ingest][${level.toUpperCase()}] ${ts} ${msg}`;
    if (level === "error") console.error(line, data ?? "");
    else if (level === "warn") console.warn(line, data ?? "");
    else console.log(line, data ?? "");
  };

  log("info", "Ingestion started");

  try {
    const result = await runIngestion();
    const stats: IngestionStats = result.stats;

    // Log per-source results
    for (const src of stats.sources) {
      if (src.error) {
        log("warn", `Source ${src.sourceId} failed: ${src.error}`, { durationMs: src.durationMs });
      } else {
        log("info", `Source ${src.sourceId} ok: ${src.fetched} items in ${src.durationMs}ms${src.fromCache ? " (cached)" : ""}`);
      }
    }

    const wallMs = Date.now() - wallStart;
    log("info", `Ingestion complete`, {
      articles:   result.articles.length,
      deduped:    stats.afterDedup,
      dropped:    stats.duplicatesDropped,
      wallMs,
    });

    return jsonResponse({
      ok:         true,
      batchId:    stats.batchId,
      articles:   result.articles.length,
      totalFetched:     stats.totalFetched,
      afterDedup:       stats.afterDedup,
      duplicatesDropped: stats.duplicatesDropped,
      sourceResults: stats.sources.map((s) => ({
        id:        s.sourceId,
        fetched:   s.fetched,
        ms:        s.durationMs,
        cached:    s.fromCache,
        error:     s.error ?? null,
      })),
      wallMs,
    }, 200);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("error", `Fatal ingestion error: ${message}`, err);

    // Return 200 (not 5xx) so Vercel cron doesn't exponential-backoff.
    // The feed continues serving stale cached data until next run succeeds.
    return jsonResponse({
      ok:      false,
      error:   message,
      wallMs:  Date.now() - wallStart,
    }, 200);
  }
}