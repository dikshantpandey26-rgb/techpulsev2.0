// =============================================================================
// api/ingest.ts — Vercel Edge Cron Job
//
// Runs on schedule (every 10 minutes via vercel.json crons).
// Triggers the full ingestion pipeline: fetch → normalize → dedup → rank → cache.
//
// Also accepts manual POST requests for immediate refresh (e.g. from admin panel).
// Protected by CRON_SECRET header to prevent abuse.
//
// Cache-Control response headers:
//   no-store — the ingest endpoint itself should never be cached by CDN.
//   The data it produces is cached server-side in the module-level Map.
// =============================================================================

export const config = { runtime: "edge" };

import { runIngestion } from "../src/services/newsService";
import type { IngestionStats } from "../src/types";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-cron-secret",
  };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Verify caller — required in production to prevent external trigger abuse
  const cronSecret = request.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status:  401,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  const start = Date.now();

  try {
    const result = await runIngestion();
    const stats: IngestionStats = result.stats;

    return new Response(JSON.stringify({
      ok:       true,
      batchId:  stats.batchId,
      articles: result.articles.length,
      stats,
      durationMs: Date.now() - start,
    }), {
      status:  200,
      headers: {
        "Content-Type":  "application/json",
        "Cache-Control": "no-store",
        ...corsHeaders(),
      },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ingest] Fatal error:", message);

    return new Response(JSON.stringify({
      ok:        false,
      error:     message,
      durationMs: Date.now() - start,
    }), {
      status:  500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders() },
    });
  }
}