// ─────────────────────────────────────────────────────────────────────────────
// src/components/NewsCard.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef } from "react";
import { DS, getCatMeta, FALLBACK_IMAGE } from "../data/designSystem";
import { useVisible } from "../hooks";
import { SentimentBadge, ShareMenu } from "./atoms";
import type { Article } from "../types";
import type { ArticleWithCoverage } from "../services/dedupEngine";
import { SourceClusterBadge } from "./SourceCluster";

export type CardVariant = "default" | "featured" | "compact";

interface NewsCardProps {
  article:  Article | ArticleWithCoverage;
  onClick:  (article: Article | ArticleWithCoverage) => void;
  variant?: CardVariant;
  delay?:   number;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  article,
  onClick,
  variant = "default",
  delay = 0,
}) => {
  const [bookmarked, setBookmarked] = useState<boolean>(false);
  const [sharing, setSharing]       = useState<boolean>(false);
  const [hovered, setHovered]       = useState<boolean>(false);

  const ref = useRef<HTMLDivElement | null>(null);
  const visible = useVisible(ref);
  const cat = getCatMeta(article.category);

  const featured = variant === "featured";
  const compact  = variant === "compact";

  const handleBookmark = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setBookmarked((b) => !b);
  };

  const handleShare = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setSharing((s) => !s);
  };

  return (
    <div
      ref={ref}
      onClick={() => onClick(article)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   hovered ? DS.bg2 : DS.bg1,
        border:       `1px solid ${hovered ? DS.line2 : DS.line}`,
        borderRadius: 16,
        overflow:     "hidden",
        cursor:       "pointer",
        position:     "relative",
        transition:   "all .25s cubic-bezier(.4,0,.2,1)",
        transform:    hovered ? "translateY(-3px)" : visible ? "translateY(0)" : "translateY(22px)",
        opacity:      visible ? 1 : 0,
        transitionDelay: `${delay}ms`,
        boxShadow:    hovered ? `0 16px 40px rgba(0,0,0,.5), 0 0 0 1px ${cat.color}20` : "none",
        ...(featured ? { gridColumn: "span 2" } : {}),
      }}
    >
      {article.breaking && (
        <div
          style={{
            position: "absolute", top: 0, left: 0, right: 0,
            height: 3, background: `linear-gradient(90deg,${DS.red},${DS.coral})`, zIndex: 5,
          }}
        />
      )}

      {/* Thumbnail */}
      {!compact && (
        <div style={{ position: "relative", height: featured ? 320 : 195, overflow: "hidden" }}>
          <img
            src={article.image}
            alt={article.title}
            loading="lazy"
            style={{
              width: "100%", height: "100%", objectFit: "cover",
              transition: "transform .5s",
              transform: hovered ? "scale(1.05)" : "scale(1)",
            }}
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              e.currentTarget.src = FALLBACK_IMAGE;
            }}
          />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${DS.bg1} 0%, transparent 55%)` }} />
          <span style={{
            position: "absolute", top: 12, left: 12,
            background: cat.color, color: "#000",
            padding: "3px 10px", borderRadius: 100,
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: 1,
          }}>
            {cat.emoji} {article.category.toUpperCase()}
          </span>
          {article.trending && (
            <span style={{
              position: "absolute", top: 12, right: 12,
              background: `${DS.amber}20`, border: `1px solid ${DS.amber}50`,
              color: DS.amber, padding: "3px 9px", borderRadius: 100,
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: .5,
            }}>
              🔥 TRENDING
            </span>
          )}
        </div>
      )}

      {/* Body */}
      <div style={{ padding: featured ? "22px 26px 26px" : compact ? "14px 16px" : "16px 18px 18px" }}>
        {compact && (
          <span style={{
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 9,
            color: cat.color, letterSpacing: .5, display: "block", marginBottom: 5,
          }}>
            {cat.emoji} {article.category.toUpperCase()}
          </span>
        )}

        <h3
          style={{
            fontFamily: "'Fraunces',serif",
            fontSize:   featured ? 23 : compact ? 14 : 16,
            fontWeight: featured ? 800 : 700,
            color:      DS.text0, lineHeight: 1.32, margin: "0 0 8px",
            ...(compact ? {
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            } : {}),
          }}
        >
          {article.title}
        </h3>

        {!compact && (
          <p style={{
            fontFamily: "'Cabinet Grotesk',sans-serif",
            fontSize:   featured ? 15 : 13,
            color:      DS.text1, lineHeight: 1.65, margin: "0 0 13px",
            display:    "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as const,
            overflow:   "hidden",
          }}>
            {article.summary}
          </p>
        )}

        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <SentimentBadge sentiment={article.sentiment} hype={article.hype} />
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: cat.color, fontWeight: 700 }}>
              {article.source}
            </span>
            <span style={{ color: DS.text2, fontSize: 10 }}>·</span>
            <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 11, color: DS.text2 }}>{article.time}</span>
            <span style={{ color: DS.text2, fontSize: 10 }}>·</span>
            <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 11, color: DS.text2 }}>⏱ {article.readTime}</span>
            <span style={{ color: DS.text2, fontSize: 10 }}>·</span>
            <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 11, color: DS.text2 }}>👁 {article.views}</span>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 5, position: "relative" }}>
            <button
              onClick={handleBookmark}
              style={{
                background:   bookmarked ? `${DS.cyan}20` : "rgba(255,255,255,.05)",
                border:       `1px solid ${bookmarked ? `${DS.cyan}40` : DS.line}`,
                borderRadius: 8, width: 30, height: 30, cursor: "pointer",
                color:        bookmarked ? DS.cyan : DS.text2,
                fontSize:     13, transition: "all .2s",
              }}
            >
              {bookmarked ? "🔖" : "⊕"}
            </button>

            <button
              onClick={handleShare}
              style={{
                background:   "rgba(255,255,255,.05)",
                border:       `1px solid ${DS.line}`,
                borderRadius: 8, width: 30, height: 30, cursor: "pointer",
                color:        DS.text2, fontSize: 13,
              }}
            >
              ↗
            </button>

            {sharing && <ShareMenu article={article} onClose={() => setSharing(false)} />}
          </div>
        </div>

        {/* Coverage badge — visible only when multiple sources covered this story */}
        {"coveredByLabel" in article && article.coveredByLabel && (
          <div style={{ marginTop: 10 }}>
            <SourceClusterBadge
              sourceCount={article.sourceCount ?? 0}
              coveredByLabel={article.coveredByLabel}
            />
          </div>
        )}

        {/* Tags */}
        <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
          {article.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: DS.text2,
                background: "rgba(255,255,255,.05)", padding: "2px 8px", borderRadius: 100, letterSpacing: .3,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};