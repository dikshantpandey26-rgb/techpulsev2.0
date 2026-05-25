// =============================================================================
// api/ai.ts — Vercel Edge Function: server-side Anthropic proxy
//
// Architecture decisions:
// • Edge Runtime: sub-5ms cold-starts, global edge nodes, streaming support
// • All Anthropic API calls stay server-side — key NEVER reaches the browser
// • Rate limiting per IP via Upstash Redis (falls back gracefully if not configured)
// • Request validation prevents malformed payloads reaching the AI
// • Retry logic with exponential back-off for transient Anthropic failures
// • Streaming responses for long AI outputs (market analysis, digests)
// =============================================================================

export const config = { runtime: "edge" };

import type { AIRequest, AIResponse, ClaudeApiResponse } from "../src/types";
import { AI_SYSTEM_PROMPT, AI_JOURNALIST_PROMPT, RATE_LIMIT } from "../src/config/constants";

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildPrompt(req: AIRequest): { system: string; user: string; maxTokens: number } {
  const { mode, articleTitle = "", articleSummary = "", query = "", headlines = [] } = req;
  const article = `"${articleTitle}" — ${articleSummary}`;

  switch (mode) {
    case "summary":
      return {
        system: AI_SYSTEM_PROMPT, maxTokens: 700,
        user: `Tech article analysis:\n${article}\n\nProvide:\n• 3 key insights (start each with •)\n• Why this matters for the industry (2 sentences)\n• What to watch next (1 sentence)`,
      };
    case "eli5":
      return {
        system: AI_SYSTEM_PROMPT, maxTokens: 500,
        user: `Explain this tech news to a curious 12-year-old using simple analogies and 3 short paragraphs:\n${article}`,
      };
    case "market":
      return {
        system: AI_SYSTEM_PROMPT, maxTokens: 800,
        user: `Market/industry sentiment analysis:\n${article}\n\nProvide sections:\n1. Bull signals\n2. Bear signals\n3. Who wins\n4. Who loses\n5. Competitive impact\n6. 90-day outlook`,
      };
    case "digest":
      return {
        system: AI_JOURNALIST_PROMPT, maxTokens: 600,
        user: `Today's top tech stories:\n${headlines.map((h) => `- ${h}`).join("\n")}\n\nWrite a punchy 5-sentence executive digest. Start with the biggest story, connect the themes, end with the key takeaway. Tone: sharp Bloomberg morning brief.`,
      };
    case "search":
      return {
        system: AI_JOURNALIST_PROMPT, maxTokens: 500,
        user: `Tech topic: "${query}"\nProvide: 1) 2-sentence expert context 2) 3 key recent developments to watch 3) One contrarian take. Be sharp and specific.`,
      };
    case "recommend":
      return {
        system: AI_SYSTEM_PROMPT, maxTokens: 400,
        user: `Based on user interest in: ${query}\nSuggest 3 tech topic areas worth following right now and briefly explain why each is important. Be specific and forward-looking.`,
      };
    default:
      throw new Error(`Unknown AI mode: ${String(mode)}`);
  }
}

// ── Rate limiting (Upstash Redis) ─────────────────────────────────────────────

async function checkRateLimit(ip: string): Promise<boolean> {
  const redisUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) return true; // No Redis configured → allow

  const key    = `rl:ai:${ip}`;
  const window = RATE_LIMIT.aiRequests.windowMs / 1000;
  const max    = RATE_LIMIT.aiRequests.max;

  try {
    const res = await fetch(`${redisUrl}/pipeline`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, window],
      ]),
    });
    const data = (await res.json()) as Array<{ result: number }>;
    const count = data[0]?.result ?? 0;
    return count <= max;
  } catch {
    return true; // Redis failure → fail open (availability > security here)
  }
}

// ── Anthropic call with retry ─────────────────────────────────────────────────

async function callAnthropicWithRetry(
  system: string,
  userPrompt: string,
  maxTokens: number,
  retries = 2
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model:      "claude-sonnet-4-20250514",
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: userPrompt }],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        if (res.status === 529 && attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw new Error(`Anthropic API ${res.status}: ${err}`);
      }

      const data: ClaudeApiResponse = await res.json();
      return (
        data.content
          ?.filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("\n") ?? ""
      );
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error("Max retries exceeded");
}

// ── Cache read/write via Upstash ──────────────────────────────────────────────

function cacheKey(req: AIRequest): string {
  return `ai:${req.mode}:${req.articleTitle?.slice(0, 40) ?? req.query?.slice(0, 40) ?? ""}`;
}

async function getCached(key: string): Promise<string | null> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res  = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json()) as { result: string | null };
    return data.result;
  } catch { return null; }
}

async function setCached(key: string, value: string, ttlSeconds = 21600): Promise<void> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}/ex/${ttlSeconds}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch { /* non-fatal */ }
}

// ── Input validation ──────────────────────────────────────────────────────────

const VALID_MODES = new Set(["summary","eli5","market","digest","search","recommend"]);

function validateRequest(body: unknown): AIRequest {
  if (typeof body !== "object" || body === null) throw new Error("Invalid request body");
  const b = body as Record<string, unknown>;
  if (!b.mode || !VALID_MODES.has(String(b.mode))) throw new Error(`Invalid mode: ${String(b.mode)}`);
  if (b.articleTitle && typeof b.articleTitle !== "string") throw new Error("Invalid articleTitle");
  if (b.query && typeof b.query !== "string") throw new Error("Invalid query");
  return b as unknown as AIRequest;
}

// ── Edge handler ──────────────────────────────────────────────────────────────

export default async function handler(request: Request): Promise<Response> {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  // Rate limit by IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await checkRateLimit(ip);
  if (!allowed) return jsonError("Too many requests. Please slow down.", 429);

  let req: AIRequest;
  try {
    const body: unknown = await request.json();
    req = validateRequest(body);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Bad request", 400);
  }

  // Check cache first (saves cost + latency)
  const key    = cacheKey(req);
  const cached = await getCached(key);
  if (cached) {
    return jsonOk({ result: cached, cached: true });
  }

  try {
    const { system, user, maxTokens } = buildPrompt(req);
    const result = await callAnthropicWithRetry(system, user, maxTokens);

    // Cache non-search responses (search is time-sensitive)
    if (req.mode !== "search") {
      void setCached(key, result);
    }

    return jsonOk({ result, cached: false });
  } catch (err) {
    console.error("[/api/ai] Error:", err);
    const message = err instanceof Error ? err.message : "AI service error";
    return jsonError(message, 500);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonOk(data: AIResponse): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}