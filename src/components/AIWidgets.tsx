// ─────────────────────────────────────────────────────────────────────────────
// src/components/AIWidgets.tsx  — AISearchBar + DailyDigest
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef } from "react";
import { DS } from "../data/designSystem";
import { callClaude } from "../utils/claude";
import { useTypewriter, useVisible } from "../hooks";
import type { Article } from "../types";

// ── AISearchBar ───────────────────────────────────────────────────────────────
interface AISearchBarProps {
  onResults: (query: string) => void;
  onClear: () => void;
}

export const AISearchBar: React.FC<AISearchBarProps> = ({ onResults, onClear }) => {
  const [query, setQuery]     = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [insight, setInsight] = useState<string>("");
  const typed = useTypewriter(insight, 10);

  const handleSearch = async (): Promise<void> => {
    if (!query.trim()) return;
    setLoading(true);
    setInsight("");
    try {
      const r = await callClaude(
        [{ role: "user", content: `Tech topic: "${query}"\nProvide: 1) 2-sentence expert context 2) 3 key recent developments to watch 3) One contrarian take. Be sharp.` }],
        "You are a senior tech journalist with 20 years experience. Be specific, direct, insightful. No fluff.",
        500
      );
      setInsight(r);
      onResults(query);
    } catch {
      setInsight("AI context unavailable. Showing filtered results.");
      onResults(query);
    }
    setLoading(false);
  };

  const handleClear = (): void => {
    setQuery("");
    setInsight("");
    onClear();
  };

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            color: DS.text2, fontSize: 17,
          }}>
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSearch(); }}
            placeholder="Search topics, companies, technologies…"
            style={{
              width: "100%", padding: "13px 16px 13px 44px", borderRadius: 12,
              background: DS.bg2, border: `1px solid ${DS.line}`,
              color: DS.text0, fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 14,
              outline: "none", boxSizing: "border-box", transition: "border .2s",
            }}
            onFocus={(e) => { e.currentTarget.style.border = `1px solid ${DS.cyan}60`; }}
            onBlur={(e)  => { e.currentTarget.style.border = `1px solid ${DS.line}`; }}
          />
        </div>

        <button
          onClick={() => void handleSearch()}
          disabled={loading || !query.trim()}
          style={{
            padding: "13px 22px", borderRadius: 12,
            background: `linear-gradient(135deg,${DS.cyan},${DS.cyan}99)`,
            color: "#000", fontFamily: "'Cabinet Grotesk',sans-serif",
            fontWeight: 800, fontSize: 14, border: "none",
            cursor: loading || !query.trim() ? "default" : "pointer",
            opacity: !query.trim() ? 0.5 : 1,
          }}
        >
          {loading ? "…" : "AI Search"}
        </button>

        {query && (
          <button
            onClick={handleClear}
            style={{
              padding: "13px 16px", borderRadius: 12,
              background: DS.bg2, border: `1px solid ${DS.line}`,
              color: DS.text2, cursor: "pointer", fontSize: 18,
            }}
          >
            ×
          </button>
        )}
      </div>

      {insight && (
        <div style={{
          marginTop: 10, padding: "14px 16px",
          background: `${DS.cyan}08`, border: `1px solid ${DS.cyan}20`, borderRadius: 11,
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: DS.cyan, letterSpacing: 1.5 }}>
            ✦ AI CONTEXT{"  "}
          </span>
          <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 13, color: DS.text1, lineHeight: 1.7 }}>
            {typed}
          </span>
        </div>
      )}
    </div>
  );
};

// ── DailyDigest ───────────────────────────────────────────────────────────────
interface DailyDigestProps {
  articles: Article[];
}

export const DailyDigest: React.FC<DailyDigestProps> = ({ articles }) => {
  const [digest, setDigest]   = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const typed = useTypewriter(digest, 8);

  const ref = useRef<HTMLDivElement | null>(null);
  const visible = useVisible(ref);

  const generate = async (): Promise<void> => {
    setLoading(true);
    setDigest("");
    try {
      const headlines = articles
        .slice(0, 8)
        .map((a) => `- ${a.title} (${a.source})`)
        .join("\n");

      const r = await callClaude(
        [{ role: "user", content: `Today's top tech stories:\n${headlines}\n\nWrite a punchy 5-sentence executive digest. Start with the biggest story, connect the themes, end with the key takeaway. Tone: sharp Bloomberg morning brief.` }],
        "You are a world-class tech journalist writing an executive morning brief. Be sharp, insightful, and connect dots between stories.",
        500
      );
      setDigest(r);
    } catch {
      setDigest("AI digest unavailable. Top stories are displayed below.");
    }
    setLoading(false);
  };

  return (
    <div
      ref={ref}
      style={{
        background: `linear-gradient(135deg,${DS.bg2},${DS.bg3})`,
        border: `1px solid ${DS.line2}`, borderRadius: 18, padding: 28, marginBottom: 28,
        opacity:   visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "all .5s cubic-bezier(.4,0,.2,1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.amber, letterSpacing: 1.5 }}>
            ✦ AI DAILY DIGEST
          </span>
          <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, color: DS.text2 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </span>
        </div>

        {!digest && (
          <button
            onClick={() => void generate()}
            disabled={loading}
            style={{
              padding: "8px 18px", borderRadius: 9,
              background: loading ? DS.bg4 : `linear-gradient(135deg,${DS.amber},${DS.amberD})`,
              border: "none", color: "#000",
              fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 800, fontSize: 13,
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Generating…" : "Generate Digest ✦"}
          </button>
        )}
      </div>

      {digest ? (
        <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 15, color: DS.text1, lineHeight: 1.85 }}>
          {typed}
        </p>
      ) : (
        <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 14, color: DS.text2, lineHeight: 1.65, fontStyle: "italic" }}>
          Click "Generate Digest" for an AI-powered summary of today's most important tech stories, curated and analyzed in real-time by Claude.
        </p>
      )}
    </div>
  );
};

// ── NewsletterCTA ─────────────────────────────────────────────────────────────
export const NewsletterCTA: React.FC = () => {
  const [email, setEmail]         = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const visible = useVisible(ref);

  const handleSubmit = (): void => {
    if (email.trim()) setSubmitted(true);
  };

  return (
    <div
      ref={ref}
      style={{
        background: `linear-gradient(135deg,${DS.bg2},${DS.bg3})`,
        border: `1px solid ${DS.amber}30`, borderRadius: 18, padding: 32, textAlign: "center",
        opacity: visible ? 1 : 0, transition: "opacity .6s", marginBottom: 28,
      }}
    >
      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.amber, letterSpacing: 2 }}>
        DAILY BRIEFING
      </span>
      <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 800, color: DS.text0, margin: "10px 0 8px" }}>
        Never Miss a Breakthrough
      </h3>
      <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 14, color: DS.text2, marginBottom: 20, maxWidth: 380, margin: "0 auto 20px" }}>
        10,000+ tech founders, engineers and VCs start their day with TechPulse. Join them.
      </p>

      {!submitted ? (
        <div style={{ display: "flex", gap: 8, maxWidth: 420, margin: "0 auto" }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 10,
              background: DS.bg1, border: `1px solid ${DS.line2}`,
              color: DS.text0, fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 14, outline: "none",
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              padding: "12px 20px", borderRadius: 10,
              background: `linear-gradient(135deg,${DS.amber},${DS.amberD})`,
              color: "#000", fontFamily: "'Cabinet Grotesk',sans-serif",
              fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Subscribe →
          </button>
        </div>
      ) : (
        <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 16, color: DS.green, fontWeight: 700 }}>
          ✓ You're in! First issue arrives tomorrow morning.
        </div>
      )}
    </div>
  );
};