// =============================================================================
// src/utils/claude.ts
//
// ARCHITECTURAL CHANGE — Phase 1 Core Stabilisation
// --------------------------------------------------
// BEFORE: This file called api.anthropic.com DIRECTLY from the browser.
//         That caused two separate failure modes:
//           1. ANTHROPIC_API_KEY is a server-only secret; it cannot exist in
//              the browser bundle. Any call would return 401 Unauthorized.
//           2. Anthropic's servers reject cross-origin browser requests
//              (CORS policy) — the request never even reached the model.
//         Result: every AI feature silently fell back to the error string
//         "AI context unavailable. Showing filtered results."
//
// AFTER:  All AI calls are routed through POST /api/ai — a Vercel Edge
//         Function that holds the key server-side, applies rate limiting,
//         and uses Upstash Redis caching. The browser never touches Anthropic.
//
// This file is kept as a thin adapter so that existing callsites in
// AIWidgets.tsx and ArticleModal.tsx continue to compile without changes
// to their call signatures. It is the ONLY place that knows the proxy URL.
//
// Scalability: adding streaming, auth tokens, or new AI modes only requires
// changing this one file — all consumers are decoupled from transport.
// =============================================================================

import type { AIRequest, AIResponse } from "../types";

// ── Configuration ─────────────────────────────────────────────────────────────

/** Default per-request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 30_000;

/** How many times to retry a failed request before giving up. */
const MAX_RETRIES = 2;

/** Base delay (ms) for exponential back-off between retries. */
const RETRY_BASE_DELAY_MS = 600;

// ── Internal types ────────────────────────────────────────────────────────────

interface CallOptions {
  /** Override the default timeout. */
  timeoutMs?: number;
  /** Signal from an external AbortController. */
  signal?: AbortSignal;
}

// ── Logger ────────────────────────────────────────────────────────────────────

function log(level: "info" | "warn" | "error", msg: string, data?: unknown): void {
  const prefix = `[TechPulse/AI ${level.toUpperCase()}]`;
  if (level === "error") {
    console.error(prefix, msg, data ?? "");
  } else if (level === "warn") {
    console.warn(prefix, msg, data ?? "");
  } else if (import.meta.env.DEV) {
    // Only log info in development to avoid noise in production
    console.info(prefix, msg, data ?? "");
  }
}

// ── Core proxy request ────────────────────────────────────────────────────────

/**
 * Send one request to the /api/ai proxy with timeout + retry.
 * All AI features in the app route through this function.
 *
 * @param payload  - Validated AIRequest body
 * @param options  - Optional timeout override and abort signal
 * @returns        - The AI-generated text string
 * @throws         - On final failure after all retries
 */
async function requestAI(payload: AIRequest, options: CallOptions = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  // Resolve endpoint relative to current origin — works on any domain,
  // localhost, preview deployments, and production without any env vars.
  const endpoint = `${window.location.origin}/api/ai`;

  log("info", `AI request → mode=${payload.mode}`, {
    mode: payload.mode,
    hasTitle: Boolean(payload.articleTitle),
    hasQuery: Boolean(payload.query),
  });

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Fresh AbortController per attempt; merge with caller signal if provided
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort("timeout"), timeoutMs);

    // If the caller cancels, we propagate immediately
    const callerSignal = options.signal;
    const onCallerAbort = (): void => controller.abort("caller_cancelled");
    callerSignal?.addEventListener("abort", onCallerAbort);

    try {
      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
        signal:  controller.signal,
      });

      if (!res.ok) {
        // 429 = rate limited, 5xx = server error — both are retryable
        const retryable = res.status === 429 || res.status >= 500;
        const body = await res.json().catch(() => ({} as Record<string, unknown>)) as { error?: string };
        const msg  = body.error ?? `HTTP ${res.status}`;

        if (retryable && attempt < MAX_RETRIES) {
          log("warn", `Retryable error on attempt ${attempt + 1}/${MAX_RETRIES + 1}: ${msg}`);
          lastError = new Error(msg);
          continue;
        }

        throw new Error(msg);
      }

      const data = await res.json() as AIResponse;

      if (data.error) {
        throw new Error(data.error);
      }

      log("info", `AI response ← mode=${payload.mode}`, { cached: data.cached });
      return data.result;

    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        const reason = controller.signal.reason as string | undefined;
        if (reason === "caller_cancelled") {
          log("info", "AI request cancelled by caller");
          throw new Error("Request cancelled");
        }
        log("warn", `AI request timed out after ${timeoutMs}ms`);
        lastError = new Error(`Request timed out after ${timeoutMs}ms`);
      } else {
        lastError = err;
      }

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        log("warn", `Attempt ${attempt + 1} failed, retrying in ${delay}ms`, lastError);
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    } finally {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  }

  log("error", `All ${MAX_RETRIES + 1} attempts failed for mode=${payload.mode}`, lastError);
  throw lastError instanceof Error ? lastError : new Error("AI request failed");
}

// ── Public API — backward-compatible with existing callsites ──────────────────

/**
 * Legacy-compatible wrapper.
 * Maps the old (messages, system, maxTokens) signature onto the new
 * AIRequest shape so that AIWidgets.tsx and ArticleModal.tsx require
 * zero changes to their call sites during Phase 1.
 *
 * @deprecated  Prefer `aiService` (src/services/aiService.ts) for new code.
 *              This function will be removed once all consumers are migrated
 *              to the typed service layer in a future phase.
 */
export async function callClaude(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  _system = "",       // kept for signature compat; prompt is built server-side
  _maxTokens = 800,   // kept for signature compat; controlled server-side
  options: CallOptions = {}
): Promise<string> {
  // Extract the user message content (always the last user turn)
  //const userMessage = messages.findLast((m) => m.role === "user")?.content ?? "";
  const reversedMessages = [...messages].reverse();

  const userMessage =
    reversedMessages.find(
     (m: { role: "user" | "assistant"; content: string }) =>
        m.role === "user"
    )?.content ?? "";

  // Detect which AI mode to use based on message content patterns.
  // This heuristic lets us keep old callsites as-is while routing through
  // the correctly typed backend.
  const payload = detectAndBuildPayload(userMessage);

  return requestAI(payload, options);
}

/**
 * Inspect the raw user prompt text and map it to the correct AIRequest mode.
 * This is necessary because the legacy callClaude() API passed raw prompts;
 * the new /api/ai backend requires an explicit mode + structured fields.
 */
function detectAndBuildPayload(userMessage: string): AIRequest {
  const lower = userMessage.toLowerCase();

  // Daily digest — headline list pattern
  if (lower.includes("today's top tech stories") || lower.includes("executive digest")) {
    const headlines = userMessage
      .split("\n")
      .filter((l) => l.trim().startsWith("-"))
      .map((l) => l.replace(/^-\s*/, "").trim())
      .filter(Boolean);
    return { mode: "digest", headlines };
  }

  // Search insight — topic context pattern
  if (lower.includes("tech topic:") || lower.includes("2-sentence expert context")) {
    const match = userMessage.match(/tech topic:\s*"([^"]+)"/i);
    return { mode: "search", query: match?.[1] ?? userMessage.slice(0, 100) };
  }

  // ELI5 — explain to a child pattern
  if (lower.includes("12-year-old") || lower.includes("simple analogies")) {
    return extractArticlePayload("eli5", userMessage);
  }

  // Market analysis — bull/bear pattern
  if (lower.includes("bull signals") || lower.includes("market/industry sentiment")) {
    return extractArticlePayload("market", userMessage);
  }

  // Default: article summary
  return extractArticlePayload("summary", userMessage);
}

/**
 * Extract article title + summary from a legacy prompt string.
 * Pattern: "article title" — article summary
 */
function extractArticlePayload(mode: AIRequest["mode"], text: string): AIRequest {
  // Try to extract quoted title
  const titleMatch = text.match(/"([^"]+)"/);
  const articleTitle   = titleMatch?.[1] ?? "";

  // Summary is everything after the em-dash separator
  const dashIndex      = text.indexOf(" — ");
  const articleSummary = dashIndex !== -1 ? text.slice(dashIndex + 3, dashIndex + 303).trim() : "";

  return { mode, articleTitle, articleSummary };
}

// Re-export the structured service for new callsites
export { requestAI };