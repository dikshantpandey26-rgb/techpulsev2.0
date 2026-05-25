// =============================================================================
// src/services/aiService.ts
//
// Production-grade AI service layer.
//
// Design decisions:
// ─────────────────
// • Every method creates its own AbortController so in-flight requests can
//   be cancelled when a component unmounts — prevents setState-after-unmount.
// • Timeout is enforced client-side (30s) independently of server timeout.
// • Retries use exponential back-off with jitter to avoid thundering herds.
// • All errors are logged with structured context for Sentry/PostHog.
// • The service is a plain object (not a class with `this`) to avoid issues
//   with React hooks calling methods in async contexts.
// • Endpoint resolves via window.location.origin — no hardcoded URLs,
//   works on localhost, PR previews, and production unchanged.
//
// Vercel compatibility:
// ─────────────────────
// • Only calls /api/ai — never calls Anthropic directly.
// • No Node.js-only APIs (Buffer, fs, etc.) — safe in browser bundles.
// • Edge-runtime-friendly fetch everywhere.
//
// Streaming-ready:
// ─────────────────
// • requestStream() returns an async generator that yields chunks.
//   When /api/ai adds streaming support, consumers need no changes.
// =============================================================================

import type { AIRequest, AIResponse, AIPanelMode } from "../types";

// ── Constants ─────────────────────────────────────────────────────────────────

const ENDPOINT         = (): string => `${window.location.origin}/api/ai`;
const TIMEOUT_MS       = 30_000;
const MAX_RETRIES      = 2;
const BASE_DELAY_MS    = 500;

// ── Logger ────────────────────────────────────────────────────────────────────

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const ts  = new Date().toISOString();
  const tag = `[AI:${level.toUpperCase()}]`;
  if (level === "error") {
    console.error(ts, tag, message, context ?? "");
  } else if (level === "warn") {
    console.warn(ts, tag, message, context ?? "");
  } else if (import.meta.env.DEV) {
    console.info(ts, tag, message, context ?? "");
  }
}

// ── Core fetch with timeout + retry ──────────────────────────────────────────

interface FetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function fetchWithRetry(
  payload: AIRequest,
  opts: FetchOptions = {}
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const url       = ENDPOINT();
  let   lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ctrl      = new AbortController();
    const timerId   = setTimeout(() => ctrl.abort("timeout"), timeoutMs);

    // Propagate caller cancellation
    const onAbort = (): void => ctrl.abort("cancelled");
    opts.signal?.addEventListener("abort", onAbort);

    try {
      const res = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
        signal:  ctrl.signal,
      });

      if (!res.ok) {
        const body   = await res.json().catch(() => ({})) as { error?: string };
        const errMsg = body.error ?? `HTTP ${res.status}`;
        const isRetryable = res.status === 429 || res.status >= 500;

        if (isRetryable && attempt < MAX_RETRIES) {
          lastErr = new Error(errMsg);
          log("warn", `Retryable error (attempt ${attempt + 1})`, { status: res.status, msg: errMsg });
          continue; // go to delay below
        }
        throw new Error(errMsg);
      }

      const data = await res.json() as AIResponse;
      if (data.error) throw new Error(data.error);

      log("info", "AI response received", {
        mode:   payload.mode,
        cached: data.cached,
        attempt,
      });

      return data.result;

    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        const reason = ctrl.signal.reason as string | undefined;
        if (reason === "cancelled") throw new Error("Request cancelled");
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      lastErr = err;
      log("warn", `Attempt ${attempt + 1} failed`, {
        mode: payload.mode,
        err:  err instanceof Error ? err.message : String(err),
      });
    } finally {
      clearTimeout(timerId);
      opts.signal?.removeEventListener("abort", onAbort);
    }

    if (attempt < MAX_RETRIES) {
      const jitter = Math.random() * 200;
      const delay  = BASE_DELAY_MS * Math.pow(2, attempt) + jitter;
      await new Promise<void>((res) => setTimeout(res, delay));
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : "AI request failed after retries";
  log("error", "All retries exhausted", { mode: payload.mode, msg });
  throw new Error(msg);
}

// ── Streaming generator (future-ready) ───────────────────────────────────────

/**
 * Streams text chunks as the server sends them.
 * Currently falls back to a single resolved chunk because /api/ai returns
 * full JSON, not a stream. When streaming is added to the backend, this
 * generator will yield real chunks with no consumer-side changes needed.
 */
async function* requestStream(
  payload: AIRequest,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  // Fallback: yield the full result as one chunk
  const result = await fetchWithRetry(payload, { signal });
  yield result;
}

// ── Public service API ────────────────────────────────────────────────────────

export const aiService = {
  /**
   * Generic typed request. All named methods below delegate here.
   * @param payload  - Structured AI request
   * @param signal   - Optional AbortSignal for cancellation
   */
  async request(payload: AIRequest, signal?: AbortSignal): Promise<string> {
    return fetchWithRetry(payload, { signal });
  },

  // ── Article intelligence ──────────────────────────────────────────────────

  /** 3 key insights + industry impact + what to watch */
  async summarize(
    articleTitle: string,
    articleSummary: string,
    signal?: AbortSignal
  ): Promise<string> {
    log("info", "summarize()", { articleTitle: articleTitle.slice(0, 60) });
    return fetchWithRetry({ mode: "summary", articleTitle, articleSummary }, { signal });
  },

  /** Explain the article to a curious 12-year-old */
  async explainSimply(
    articleTitle: string,
    articleSummary: string,
    signal?: AbortSignal
  ): Promise<string> {
    log("info", "explainSimply()", { articleTitle: articleTitle.slice(0, 60) });
    return fetchWithRetry({ mode: "eli5", articleTitle, articleSummary }, { signal });
  },

  /** Bull/bear signals, competitive impact, 90-day outlook */
  async marketTake(
    articleTitle: string,
    articleSummary: string,
    signal?: AbortSignal
  ): Promise<string> {
    log("info", "marketTake()", { articleTitle: articleTitle.slice(0, 60) });
    return fetchWithRetry({ mode: "market", articleTitle, articleSummary }, { signal });
  },

  // ── Feed intelligence ─────────────────────────────────────────────────────

  /** Bloomberg-style morning brief from today's headlines */
  async dailyDigest(headlines: string[], signal?: AbortSignal): Promise<string> {
    log("info", "dailyDigest()", { count: headlines.length });
    return fetchWithRetry({ mode: "digest", headlines }, { signal });
  },

  /** Expert context + contrarian take for a searched topic */
  async searchInsight(query: string, signal?: AbortSignal): Promise<string> {
    log("info", "searchInsight()", { query: query.slice(0, 60) });
    return fetchWithRetry({ mode: "search", query }, { signal });
  },

  /** Topic recommendations based on reading interests */
  async recommend(interests: string, signal?: AbortSignal): Promise<string> {
    log("info", "recommend()", { interests: interests.slice(0, 60) });
    return fetchWithRetry({ mode: "recommend", query: interests }, { signal });
  },

  // ── Unified panel dispatcher ──────────────────────────────────────────────

  /**
   * Dispatch any AIPanelMode call in one line.
   * Used by AIPanel in ArticleModal.tsx.
   */
  async panelRequest(
    mode: AIPanelMode,
    articleTitle: string,
    articleSummary: string,
    signal?: AbortSignal
  ): Promise<string> {
    return fetchWithRetry({ mode, articleTitle, articleSummary }, { signal });
  },

  // ── Streaming (future-ready) ──────────────────────────────────────────────

  /**
   * Returns an AsyncGenerator that yields text chunks.
   * Currently yields one chunk (full response); will yield real chunks
   * once the backend supports streaming.
   */
  stream: requestStream,
} as const;

// Named export for tree-shaking-friendly imports
export type AIServiceType = typeof aiService;