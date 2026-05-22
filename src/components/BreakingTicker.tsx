// ─────────────────────────────────────────────────────────────────────────────
// src/components/BreakingTicker.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react";
import { DS } from "../data/designSystem";
import type { Article } from "../types";

interface BreakingTickerProps {
  articles: Article[];
}

export const BreakingTicker: React.FC<BreakingTickerProps> = ({ articles }) => {
  const [idx, setIdx]     = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);

  useEffect(() => {
    if (paused || articles.length === 0) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % articles.length), 4200);
    return () => clearInterval(id);
  }, [paused, articles.length]);

  if (articles.length === 0) return null;

  const article = articles[idx];

  return (
    <div
      style={{
        background: `linear-gradient(90deg,${DS.red}cc,${DS.coral}cc)`,
        backdropFilter: "blur(8px)",
        padding: "7px 20px",
        display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span style={{
        fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 700,
        color: "#fff", letterSpacing: 2, whiteSpace: "nowrap",
        animation: "pulse 1.5s ease-in-out infinite",
      }}>
        ● BREAKING
      </span>
      <span style={{ width: 1, height: 14, background: "rgba(255,255,255,.3)" }} />
      <span style={{
        fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 13, fontWeight: 600,
        color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
      }}>
        {article.title}
      </span>
      <span style={{
        fontFamily: "'IBM Plex Mono',monospace", fontSize: 10,
        color: "rgba(255,255,255,.65)", whiteSpace: "nowrap",
      }}>
        {article.source} · {article.time}
      </span>
      <div style={{ display: "flex", gap: 5 }}>
        {articles.map((_, i) => (
          <span
            key={i}
            onClick={() => setIdx(i)}
            style={{
              width: 5, height: 5, borderRadius: "50%",
              background: i === idx ? "#fff" : "rgba(255,255,255,.3)",
              cursor: "pointer", transition: "background .3s",
            }}
          />
        ))}
      </div>
    </div>
  );
};