// =============================================================================
// src/config/constants.ts — App-wide magic numbers and string constants
// =============================================================================

export const APP_NAME        = "TechPulse";
export const APP_TAGLINE     = "AI-Powered Tech Intelligence";
export const APP_DESCRIPTION = "Real-time AI-curated tech news from 50+ trusted sources. Sentiment scores, hype ratings, and expert context on every story.";
export const TWITTER_HANDLE  = "@techpulseai";

export const ARTICLES_PER_PAGE     = 9;
export const SIDEBAR_TRENDING_MAX  = 7;
export const AI_CACHE_TTL_SECONDS  = 60 * 60 * 6;   // 6 hours
export const FEED_CACHE_TTL_SECONDS = 60 * 5;        // 5 minutes
export const TRENDING_REFRESH_MS   = 5 * 60 * 1000; // 5 minutes

export const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80";

export const PREMIUM_PLANS = [
  { id: "free",  name: "Free",    priceMonthly: 0,  features: ["10 articles/day", "Basic AI summaries"] },
  { id: "pro",   name: "Pro",     priceMonthly: 9,  features: ["Unlimited articles", "Full AI suite", "No ads", "Daily digest email", "Push notifications"] },
  { id: "team",  name: "Team",    priceMonthly: 29, features: ["Everything in Pro", "5 seats", "API access", "Custom digest"] },
] as const;

export const TRUSTED_SOURCES = [
  "TechCrunch","Wired","Ars Technica","The Verge","Bloomberg",
  "Nature","9to5Mac","Android Authority","Hacker News",
  "Dev.to","CoinDesk","Space.com","Digital Foundry","MacRumors",
] as const;

export const AI_SYSTEM_PROMPT =
  "You are a senior tech analyst at a world-class research firm. Be sharp, specific, and insightful. No generic statements, no hedging, no fluff. Deliver value in every sentence.";

export const AI_JOURNALIST_PROMPT =
  "You are a world-class tech journalist writing for a sophisticated audience of founders, engineers, and investors. Be direct, sharp, and data-driven.";

export const RATE_LIMIT = {
  aiRequests:    { windowMs: 60_000, max: 10  }, // 10 AI calls/min per IP
  apiRequests:   { windowMs: 60_000, max: 100 }, // 100 general API calls/min
  ingestRequests:{ windowMs: 60_000, max: 5   }, // 5 ingest triggers/min
} as const;

export const HTTP_STATUS = {
  OK:                  200,
  CREATED:             201,
  NO_CONTENT:          204,
  BAD_REQUEST:         400,
  UNAUTHORIZED:        401,
  FORBIDDEN:           403,
  NOT_FOUND:           404,
  TOO_MANY_REQUESTS:   429,
  INTERNAL_ERROR:      500,
} as const;