// ─────────────────────────────────────────────────────────────────────────────
// src/components/atoms.tsx  — Small reusable UI pieces
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { DS, PLATFORMS, FALLBACK_IMAGE } from "../data/designSystem";
import type { Article, Sentiment } from "../types";

// ── SentimentBadge ────────────────────────────────────────────────────────────
interface SentimentBadgeProps {
  sentiment: Sentiment;
  hype: number;
}

export const SentimentBadge: React.FC<SentimentBadgeProps> = ({ sentiment, hype }) => {
  const c =
    sentiment === "bullish" ? DS.green :
    sentiment === "bearish" ? DS.red   : DS.amber;

  const label =
    sentiment === "bullish" ? "↑ Bullish" :
    sentiment === "bearish" ? "↓ Bearish" : "→ Neutral";

  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5,
        color: c, background: `${c}18`,
        padding: "3px 9px", borderRadius: 100,
        border: `1px solid ${c}30`,
      }}
    >
      {label}
      <span style={{ color: DS.text2, fontSize: 9 }}>·</span>
      <span style={{ color: DS.amber, fontSize: 9 }}>🔥{hype}</span>
    </span>
  );
};

// ── Skeleton loader ───────────────────────────────────────────────────────────
export const Skeleton: React.FC = () => (
  <div style={{ background: DS.bg2, borderRadius: 16, overflow: "hidden", border: `1px solid ${DS.line}` }}>
    <div style={{ height: 190, background: DS.bg3, animation: "shimmer 1.6s ease-in-out infinite" }} />
    <div style={{ padding: 18 }}>
      {([90, 72, 58, 42] as number[]).map((w, i) => (
        <div
          key={i}
          style={{
            height: 10, background: DS.bg3, borderRadius: 5,
            marginBottom: 9, width: `${w}%`,
            animation: "shimmer 1.6s ease-in-out infinite",
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  </div>
);

// ── ShareMenu ─────────────────────────────────────────────────────────────────
interface ShareMenuProps {
  article: Article;
  onClose: () => void;
}

export const ShareMenu: React.FC<ShareMenuProps> = ({ article, onClose }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const articleUrl = `https://techpulse.ai/a/${article.id}`;
  const encodedUrl   = encodeURIComponent(articleUrl);
  const encodedTitle = encodeURIComponent(article.title);

  const handleCopy = (): void => {
    navigator.clipboard?.writeText(articleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute", bottom: "calc(100% + 8px)", right: 0, zIndex: 200,
        background: DS.bg3, border: `1px solid ${DS.line2}`, borderRadius: 14,
        padding: "14px 16px", minWidth: 240, boxShadow: "0 24px 56px rgba(0,0,0,.75)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.text2, letterSpacing: 1.5 }}>
          SHARE ARTICLE
        </span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: DS.text2, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {PLATFORMS.map((p) => (
          <a
            key={p.id}
            href={p.url(encodedUrl, encodedTitle)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 11px", borderRadius: 8,
              background: p.bg, color: "#fff", textDecoration: "none",
              fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, fontWeight: 700,
            }}
          >
            <span style={{ fontSize: 11 }}>{p.icon}</span>
            {p.label}
          </a>
        ))}

        <button
          onClick={handleCopy}
          style={{
            padding: "6px 11px", borderRadius: 8,
            background: copied ? DS.green : DS.bg4,
            border: `1px solid ${DS.line2}`,
            color: copied ? "#000" : DS.text1,
            fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {copied ? "✓ Copied" : "⧉ Copy Link"}
        </button>
      </div>
    </div>
  );
};

// ── FallbackImg ───────────────────────────────────────────────────────────────
interface FallbackImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

export const FallbackImg: React.FC<FallbackImgProps> = ({ src, alt, ...rest }) => (
  <img
    src={src}
    alt={alt}
    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
      e.currentTarget.src = FALLBACK_IMAGE;
    }}
    {...rest}
  />
);