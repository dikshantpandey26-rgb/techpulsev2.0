// ─────────────────────────────────────────────────────────────────────────────
// src/components/Sidebar.tsx  — TrendingWidget, StatsBar, CategoryBreakdown
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { DS, CAT_META, getCatMeta } from "../data/designSystem";
import type { Article, StatItem } from "../types";

// ── TrendingWidget ─────────────────────────────────────────────────────────────
interface TrendingWidgetProps {
  articles: Article[];
}

export const TrendingWidget: React.FC<TrendingWidgetProps> = ({ articles }) => (
  <div style={{ background: DS.bg1, border: `1px solid ${DS.line}`, borderRadius: 16, padding: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
      <span style={{ fontSize: 14 }}>🔥</span>
      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.text2, letterSpacing: 1.5 }}>
        TRENDING NOW
      </span>
    </div>

    {articles.slice(0, 7).map((a, i) => {
      const cat = getCatMeta(a.category);
      return (
        <div
          key={a.id}
          style={{
            display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-start",
            paddingBottom: 16, borderBottom: i < 6 ? `1px solid ${DS.line}` : "none",
          }}
        >
          <span style={{
            fontFamily: "'Fraunces',serif", fontSize: 30, fontWeight: 900,
            color: DS.bg4, lineHeight: 1, minWidth: 34, paddingTop: 2,
          }}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <div>
            <p style={{
              fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 13, fontWeight: 600,
              color: DS.text1, lineHeight: 1.4, margin: "0 0 5px",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }}>
              {a.title}
            </p>
            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8.5, color: cat.color }}>
                {a.category}
              </span>
              <span style={{ color: DS.text2, fontSize: 9 }}>·</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8.5, color: DS.text2 }}>
                👁 {a.views}
              </span>
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

// ── StatsBar ──────────────────────────────────────────────────────────────────
interface StatsBarProps {
  articles: Article[];
}

export const StatsBar: React.FC<StatsBarProps> = ({ articles }) => {
  const stats: StatItem[] = [
    { label: "Stories Today", value: articles.length,                          color: DS.cyan   },
    { label: "Trending Now",  value: articles.filter((a) => a.trending).length, color: DS.amber  },
    { label: "Breaking",      value: articles.filter((a) => a.breaking).length, color: DS.red    },
    { label: "Sources",       value: new Set(articles.map((a) => a.source)).size, color: DS.violet },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
      {stats.map((s) => (
        <div key={s.label} style={{ background: DS.bg2, border: `1px solid ${DS.line}`, borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 30, fontWeight: 800, color: s.color, lineHeight: 1 }}>
            {s.value}
          </div>
          <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 11, color: DS.text2, marginTop: 5 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── CategoryBreakdown ─────────────────────────────────────────────────────────
interface CategoryBreakdownProps {
  articles: Article[];
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ articles }) => (
  <div style={{ background: DS.bg1, border: `1px solid ${DS.line}`, borderRadius: 16, padding: 20 }}>
    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.text2, letterSpacing: 1.5, display: "block", marginBottom: 14 }}>
      📊 BY CATEGORY
    </span>
    {(Object.entries(CAT_META) as [string, { color: string; emoji: string }][])
      .slice(0, 7)
      .map(([cat, meta]) => {
        const count = articles.filter((a) => a.category === cat).length;
        const pct   = articles.length > 0 ? Math.round((count / articles.length) * 100) : 0;
        return (
          <div key={cat} style={{ marginBottom: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, color: DS.text1 }}>
                {meta.emoji} {cat}
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.text2 }}>
                {count}
              </span>
            </div>
            <div style={{ height: 3, background: DS.bg3, borderRadius: 2 }}>
              <div style={{ height: "100%", width: `${Math.min(pct * 4, 100)}%`, background: meta.color, borderRadius: 2, transition: "width 1s" }} />
            </div>
          </div>
        );
      })}
  </div>
);

// ── SourcesList ───────────────────────────────────────────────────────────────
const SOURCES: string[] = [
  "TechCrunch", "Wired", "Ars Technica", "The Verge", "Bloomberg",
  "Nature", "9to5Mac", "Android Auth", "Hacker News", "Dev.to", "CoinDesk", "Space.com",
];

export const SourcesList: React.FC = () => (
  <div style={{ background: DS.bg1, border: `1px solid ${DS.line}`, borderRadius: 16, padding: 20 }}>
    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.text2, letterSpacing: 1.5, display: "block", marginBottom: 14 }}>
      📡 TRUSTED SOURCES
    </span>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {SOURCES.map((s) => (
        <span
          key={s}
          style={{
            fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 11, color: DS.text2,
            background: DS.bg3, padding: "4px 10px", borderRadius: 100,
            border: `1px solid ${DS.line}`, cursor: "pointer",
          }}
        >
          {s}
        </span>
      ))}
    </div>
  </div>
);

// ── PremiumCTA ────────────────────────────────────────────────────────────────
export const PremiumCTA: React.FC = () => (
  <div style={{
    background: `linear-gradient(135deg,${DS.bg2},${DS.bg3})`,
    border: `1px solid ${DS.amber}30`, borderRadius: 16, padding: 20, textAlign: "center",
  }}>
    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: DS.amber, letterSpacing: 1.5 }}>PREMIUM</span>
    <h4 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 800, color: DS.text0, margin: "8px 0 6px" }}>
      Go Ad-Free
    </h4>
    <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, color: DS.text2, lineHeight: 1.5, marginBottom: 14 }}>
      Full AI features, no ads, daily digest emails, push notifications.
    </p>
    <button style={{
      width: "100%", padding: 10, borderRadius: 9,
      background: `linear-gradient(135deg,${DS.amber},${DS.amberD})`,
      border: "none", color: "#000",
      fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 800, fontSize: 13, cursor: "pointer",
    }}>
      Upgrade · $9/mo
    </button>
  </div>
);

// ── AdSlot ────────────────────────────────────────────────────────────────────
export const AdSlot: React.FC = () => (
  <div style={{
    margin: "24px 0", padding: 20, background: DS.bg2,
    border: `1px dashed ${DS.amber}25`, borderRadius: 14, textAlign: "center",
  }}>
    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: DS.text2, letterSpacing: 1 }}>
      SPONSORED CONTENT
    </span>
    <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, color: DS.text2, marginTop: 6 }}>
      Premium ad placement available — contact ads@techpulse.ai
    </p>
  </div>
);