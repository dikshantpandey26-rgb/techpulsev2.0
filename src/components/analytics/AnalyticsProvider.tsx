// =============================================================================
// src/components/analytics/AnalyticsProvider.tsx
// Initialises PostHog, GA4, and Sentry on mount.
// Loads all analytics scripts lazily to avoid blocking initial render.
// =============================================================================

import React, { useEffect } from "react";
import { clientEnv } from "../../config/env";
import { analytics } from "../../services/analyticsService";

interface Props { children: React.ReactNode; }

export const AnalyticsProvider: React.FC<Props> = ({ children }) => {
  useEffect(() => {
    // ── PostHog ──────────────────────────────────────────────────────────────
    if (clientEnv.postHogKey) {
      const script = document.createElement("script");
      script.defer = true;
      script.src   = `${clientEnv.postHogHost ?? "https://app.posthog.com"}/static/array.js`;
      script.onload = () => {
        const w = window as unknown as { posthog?: { init: (k: string, c: Record<string, unknown>) => void } };
        w.posthog?.init(clientEnv.postHogKey!, {
          api_host:             clientEnv.postHogHost ?? "https://app.posthog.com",
          capture_pageview:     false,
          autocapture:          false,
          disable_session_recording: !clientEnv.isProd,
        });
      };
      document.head.appendChild(script);
    }

    // ── Google Analytics 4 ───────────────────────────────────────────────────
    if (clientEnv.gaId) {
      const script  = document.createElement("script");
      script.async  = true;
      script.src    = `https://www.googletagmanager.com/gtag/js?id=${clientEnv.gaId}`;
      document.head.appendChild(script);
      analytics.initGA();
    }

    // ── Sentry ────────────────────────────────────────────────────────────────
    if (clientEnv.sentryDsn && clientEnv.isProd) {
      const script  = document.createElement("script");
      script.async  = true;
      script.src    = "https://browser.sentry-cdn.com/7.x/bundle.min.js";
      script.onload = () => {
        const Sentry = (window as unknown as { Sentry?: { init: (c: Record<string, unknown>) => void } }).Sentry;
        Sentry?.init({
          dsn:              clientEnv.sentryDsn,
          environment:      "production",
          tracesSampleRate: 0.1,
          replaysOnErrorSampleRate: 1.0,
        });
      };
      document.head.appendChild(script);
    }
  }, []);

  return <>{children}</>;
};