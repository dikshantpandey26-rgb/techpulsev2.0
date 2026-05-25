// ─────────────────────────────────────────────────────────────────────────────
// src/data/designSystem.ts  — Design tokens, category metadata, share platforms
// ─────────────────────────────────────────────────────────────────────────────
 
import type { CatMeta, CategoryKey, Platform } from "../types";
 
export const DS = {
  bg0: "#09090e",
  bg1: "#0f0f18",
  bg2: "#16161f",
  bg3: "#1e1e2a",
  bg4: "#252535",
  line: "rgba(255,255,255,0.07)",
  line2: "rgba(255,255,255,0.12)",
  text0: "#f5f0e8",
  text1: "#bfbba8",
  text2: "#7a7669",
  amber: "#f5a623",
  amberD: "#c4831a",
  coral: "#ff5c4d",
  coralD: "#cc3d31",
  cyan: "#00d4c8",
  violet: "#9b7fe8",
  green: "#2dbe8c",
  red: "#e84040",
} as const;
 
// Typed so CategoryKey can index it safely
export const CAT_META: Record<CategoryKey, CatMeta> = {
  AI:              { color: "#00d4c8", emoji: "✦" },
  Startups:        { color: "#f5a623", emoji: "⚡" },
  Cybersecurity:   { color: "#e84040", emoji: "⚔" },
  Gadgets:         { color: "#9b7fe8", emoji: "◈" },
  Programming:     { color: "#2dbe8c", emoji: "⌥" },
  Space:           { color: "#60a5fa", emoji: "◎" },
  Apple:           { color: "#c8c8c8", emoji: "◆" },
  Android:         { color: "#4ade80", emoji: "⬡" },
  Gaming:          { color: "#fb923c", emoji: "▶" },
  "Cloud & DevOps":{ color: "#38bdf8", emoji: "◻" },
  Science:         { color: "#a78bfa", emoji: "⬡" },
  Crypto:          { color: "#fbbf24", emoji: "◉" },
  Web3:            { color: "#8B5CF6", emoji: "⛓️",},
  Robotics:        { color: "#14B8A6", emoji: "🤖",},
};
 
export const FALLBACK_CAT: CatMeta = { color: "#f5a623", emoji: "◆" };
 
/** Safe lookup — always returns a CatMeta, never undefined */
export function getCatMeta(category: string): CatMeta {
  return CAT_META[category as CategoryKey] ?? FALLBACK_CAT;
}
 
export const CATEGORIES: string[] = ["All", ...Object.keys(CAT_META)];
 
export const PLATFORMS: Platform[] = [
  {
    id: "x", label: "X", bg: "#000000", icon: "𝕏",
    url: (u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
  },
  {
    id: "li", label: "LinkedIn", bg: "#0A66C2", icon: "in",
    url: (u) => `https://linkedin.com/sharing/share-offsite/?url=${u}`,
  },
  {
    id: "wa", label: "WhatsApp", bg: "#25D366", icon: "W",
    url: (u, t) => `https://wa.me/?text=${t}%20${u}`,
  },
  {
    id: "tg", label: "Telegram", bg: "#229ED9", icon: "TG",
    url: (u, t) => `https://t.me/share/url?url=${u}&text=${t}`,
  },
  {
    id: "fb", label: "Facebook", bg: "#1877F2", icon: "f",
    url: (u) => `https://facebook.com/sharer/sharer.php?u=${u}`,
  },
  {
    id: "rd", label: "Reddit", bg: "#FF4500", icon: "R",
    url: (u, t) => `https://reddit.com/submit?url=${u}&title=${t}`,
  },
];
 
export const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80";