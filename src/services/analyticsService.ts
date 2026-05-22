// =============================================================================
// src/services/analyticsService.ts
// Unified analytics facade: PostHog + GA4 + Sentry + custom backend events.
// All calls are fire-and-forget and never block the UI.
// =============================================================================

import { clientEnv } from "../config/env";
import type { ArticleAnalyticsEvent } from "../types";

// ── Session ID (lightweight, no auth required) ────────────────────────────────

function getSessionId(): string {
  const key = "tp_session";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

// ── PostHog ───────────────────────────────────────────────────────────────────

type PHEventProps = Record<string, string | number | boolean | undefined>;

function phCapture(event: string, props: PHEventProps = {}): void {
  if (!clientEnv.postHogKey) return;
  try {
    // posthog is loaded via script tag in index.html
    const ph = (window as unknown as { posthog?: { capture: (e: string, p: PHEventProps) => void } }).posthog;
    ph?.capture(event, props);
  } catch { /* non-fatal */ }
}

// ── Google Analytics (GA4) ────────────────────────────────────────────────────

function gtag(...args: unknown[]): void {
  if (!clientEnv.gaId) return;
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    (w.dataLayer ?? (w.dataLayer = [])).push(args);
  } catch { /* non-fatal */ }
}

// ── Sentry ────────────────────────────────────────────────────────────────────

function sentryCaptureException(err: unknown, context?: Record<string, unknown>): void {
  if (!clientEnv.sentryDsn) return;
  try {
    const Sentry = (window as unknown as { Sentry?: { captureException: (e: unknown, c?: unknown) => void } }).Sentry;
    Sentry?.captureException(err, { extra: context });
  } catch { /* non-fatal */ }
}

// ── Backend event ─────────────────────────────────────────────────────────────

function sendBackendEvent(payload: ArticleAnalyticsEvent): void {
  const origin = window.location.origin;
  void fetch(`${origin}/api/analytics`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
    keepalive: true, // survives page navigation
  }).catch(() => { /* non-fatal */ });
}

// ── Public API ────────────────────────────────────────────────────────────────

export const analytics = {
  /** Track article view */
  articleView(articleId: number, category: string, source: string): void {
    phCapture("article_view", { articleId, category, source });
    gtag("event", "page_view", { article_id: articleId });
    sendBackendEvent({
      articleId, event: "view", sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
      metadata: { category, source },
    });
  },

  /** Track social share */
  articleShare(articleId: number, platform: string): void {
    phCapture("article_share", { articleId, platform });
    gtag("event", "share", { article_id: articleId, platform });
    sendBackendEvent({
      articleId, event: "share", sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
      metadata: { platform },
    });
  },

  /** Track bookmark */
  articleBookmark(articleId: number, added: boolean): void {
    phCapture("article_bookmark", { articleId, added });
    sendBackendEvent({
      articleId, event: "bookmark", sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
      metadata: { added },
    });
  },

  /** Track AI panel usage */
  aiInteraction(articleId: number, mode: string): void {
    phCapture("ai_interaction", { articleId, mode });
    sendBackendEvent({
      articleId, event: "ai_interaction", sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
      metadata: { mode },
    });
  },

  /** Track search */
  search(query: string, resultCount: number): void {
    phCapture("search", { query, resultCount });
    gtag("event", "search", { search_term: query });
  },

  /** Track errors */
  captureError(err: unknown, context?: Record<string, unknown>): void {
    sentryCaptureException(err, context);
    console.error("[TechPulse Error]", err, context);
  },

  /** Initialize GA4 */
  initGA(): void {
    if (!clientEnv.gaId) return;
    gtag("js", new Date());
    gtag("config", clientEnv.gaId, { send_page_view: false });
  },
};