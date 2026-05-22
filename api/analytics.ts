// =============================================================================
// api/analytics.ts — Article event ingestion (views, shares, AI interactions)
// Lightweight fire-and-forget; clients don't wait for a response.
// =============================================================================

export const config = { runtime: "edge" };

import type { ArticleAnalyticsEvent } from "../src/types";

const VALID_EVENTS = new Set(["view","share","bookmark","read_complete","ai_interaction"]);

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let event: ArticleAnalyticsEvent;
  try {
    const body = (await request.json()) as Partial<ArticleAnalyticsEvent>;
    if (!body.articleId || !body.event || !VALID_EVENTS.has(body.event)) {
      return new Response(JSON.stringify({ error: "Invalid event" }), { status: 400 });
    }
    event = {
      articleId: Number(body.articleId),
      event:     body.event,
      userId:    body.userId,
      sessionId: body.sessionId ?? "anonymous",
      timestamp: new Date().toISOString(),
      metadata:  body.metadata,
    };
  } catch { return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 }); }

  // Store in Supabase (non-blocking)
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    void fetch(`${url}/rest/v1/article_events`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body:    JSON.stringify(event),
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status:  202,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}

function cors(): Record<string, string> {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
}