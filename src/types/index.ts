
// =============================================================================
// src/types/index.ts — Complete platform type system
// =============================================================================

export type Sentiment = "bullish" | "bearish" | "neutral";

export type CategoryKey =
  | "AI" | "Startups" | "Cybersecurity" | "Gadgets" | "Programming"
  | "Space" | "Apple" | "Android" | "Gaming" | "Cloud & DevOps"
  | "Science" | "Crypto";

export interface Article {
  id: number;
  slug?: string;
  category: CategoryKey;
  title: string;
  summary: string;
  source: string;
  author: string;
  time: string;
  publishedAt?: string;
  readTime: string;
  views: string;
  sentiment: Sentiment;
  hype: number;
  trending?: boolean;
  breaking?: boolean;
  tags: string[];
  image: string;
  url: string;
  aiSummary?: string;
  aiTags?: string[];
  engagementScore?: number;
}

export interface CatMeta { color: string; emoji: string; }

export interface Platform {
  id: string; label: string; bg: string; icon: string;
  url: (encodedUrl: string, encodedTitle: string) => string;
}

export type AIPanelMode = "summary" | "eli5" | "market";

export interface AIPanelButton { id: AIPanelMode; label: string; color: string; }

export interface ClaudeMessage { role: "user" | "assistant"; content: string; }

export interface ClaudeContentBlock { type: string; text?: string; }

export interface ClaudeApiResponse {
  content: ClaudeContentBlock[];
  error?: { message: string };
}

export interface AIRequest {
  mode: AIPanelMode | "digest" | "search" | "recommend";
  articleTitle?: string;
  articleSummary?: string;
  query?: string;
  headlines?: string[];
}

export interface AIResponse { result: string; cached?: boolean; error?: string; }

export interface UserProfile {
  id: string; email: string; displayName?: string; avatarUrl?: string;
  followedTopics: CategoryKey[]; bookmarkedArticleIds: number[];
  readArticleIds: number[]; newsletterSubscribed: boolean;
  createdAt: string; updatedAt: string;
}

export interface ArticleAnalyticsEvent {
  articleId: number;
  event: "view" | "share" | "bookmark" | "read_complete" | "ai_interaction";
  userId?: string; sessionId: string; timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface DbArticle {
  id: number; slug: string; category: string; title: string; summary: string;
  source: string; author: string; published_at: string; read_time: string;
  sentiment: string; hype: number; trending: boolean; breaking: boolean;
  tags: string[]; image_url: string; original_url: string;
  ai_summary: string | null; ai_tags: string[] | null;
  engagement_score: number; views: number; created_at: string; updated_at: string;
}

export interface DbSubscriber {
  id: string; email: string; subscribed_topics: string[];
  confirmed: boolean; created_at: string;
}

export interface StatItem { label: string; value: number; color: string; }

export type Theme = "dark" | "light";

export interface FeedFilters { category: string; searchQuery: string; page: number; }

export interface RawArticle {
  title: string; description: string | null; url: string;
  urlToImage: string | null; publishedAt: string;
  source: { name: string }; author: string | null;
}

export interface HNStory {
  id: number; title: string; url?: string; score: number;
  time: number; by: string; descendants: number;
}

export interface FeatureFlags {
  enablePushNotifications: boolean; enablePremiumGating: boolean;
  enableLiveSearch: boolean; enableAudioSummary: boolean;
  enablePersonalization: boolean; enableAdSlots: boolean;
}

export type AdSlotPosition = "feed-inline" | "sidebar-top" | "sidebar-mid" | "header-banner";

export interface AdSlotConfig {
  position: AdSlotPosition; label: string;
  sponsorName?: string; ctaUrl?: string; ctaLabel?: string;
}

export interface IngestionResult {
  fetched: number; stored: number; duplicates: number; errors: string[];
}