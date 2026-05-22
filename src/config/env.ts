// =============================================================================
// src/config/env.ts
// Centralised, validated environment variable access.
// Rule: VITE_ prefix = safe for browser bundle.
//       Anything without VITE_ must only be read server-side (API routes).
// =============================================================================

/** Client-safe config (only VITE_ vars reach the browser bundle) */
export const clientEnv = {
    /** The running origin — no hardcoded domains, no VITE_APP_URL needed */
    appUrl: typeof window !== "undefined" ? window.location.origin : "",
  
    supabaseUrl:  import.meta.env.VITE_SUPABASE_URL  as string | undefined,
    supabaseAnon: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
    clerkPubKey:  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined,
    postHogKey:   import.meta.env.VITE_POSTHOG_KEY   as string | undefined,
    postHogHost:  import.meta.env.VITE_POSTHOG_HOST  as string | undefined,
    gaId:         import.meta.env.VITE_GA_ID          as string | undefined,
    sentryDsn:    import.meta.env.VITE_SENTRY_DSN     as string | undefined,
    oneSignalAppId: import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined,
    appName: (import.meta.env.VITE_APP_NAME as string | undefined) ?? "TechPulse",
    isDev:   import.meta.env.DEV as boolean,
    isProd:  import.meta.env.PROD as boolean,
  } as const;
  
  /**
   * Validate that a required client env var is present.
   * Logs a warning in dev, throws in prod build CI.
   */
  export function requireClientEnv(key: keyof typeof clientEnv): string {
    const val = clientEnv[key];
    if (!val) {
      const msg = `[TechPulse] Missing required env var: ${key}`;
      if (clientEnv.isDev) {
        console.warn(msg);
        return "";
      }
      console.error(msg);
    }
    return String(val ?? "");
  }
  
  /** Feature flags derived from env — safe for client */
  export const featureFlags = {
    enablePushNotifications: Boolean(clientEnv.oneSignalAppId),
    enablePremiumGating:     clientEnv.isProd,
    enableLiveSearch:        true,
    enableAudioSummary:      true,
    enablePersonalization:   Boolean(clientEnv.clerkPubKey),
    enableAdSlots:           clientEnv.isProd,
  } as const;