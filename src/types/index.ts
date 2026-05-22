// ─────────────────────────────────────────────────────────────────────────────
// src/types/index.ts  — All shared TypeScript types & interfaces
// ─────────────────────────────────────────────────────────────────────────────
 
export type Sentiment = "bullish" | "bearish" | "neutral";
 
export type CategoryKey =
  | "AI"
  | "Startups"
  | "Cybersecurity"
  | "Gadgets"
  | "Programming"
  | "Space"
  | "Apple"
  | "Android"
  | "Gaming"
  | "Cloud & DevOps"
  | "Science"
  | "Crypto";
 
export interface Article {
  id: number;
  category: CategoryKey;
  title: string;
  summary: string;
  source: string;
  author: string;
  time: string;
  readTime: string;
  views: string;
  sentiment: Sentiment;
  hype: number;
  trending?: boolean;
  breaking?: boolean;
  tags: string[];
  image: string;
  url: string;
}
 
export interface CatMeta {
  color: string;
  emoji: string;
}
 
export interface Platform {
  id: string;
  label: string;
  bg: string;
  icon: string;
  url: (encodedUrl: string, encodedTitle: string) => string;
}
 
export type AIPanelMode = "summary" | "eli5" | "market";
 
export interface AIPanelButton {
  id: AIPanelMode;
  label: string;
  color: string;
}
 
export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}
 
export interface ClaudeContentBlock {
  type: string;
  text?: string;
}
 
export interface ClaudeApiResponse {
  content: ClaudeContentBlock[];
}
 
export interface StatItem {
  label: string;
  value: number;
  color: string;
}