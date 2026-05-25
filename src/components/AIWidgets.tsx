// =============================================================================
// src/components/AIWidgets.tsx
//
// CHANGES FROM PREVIOUS VERSION:
// • Removed: import { callClaude } from "../utils/claude"
//   Replaced with: import { aiService } from "../services/aiService"
//
// • AISearchBar.handleSearch now calls aiService.searchInsight()
//   instead of callClaude() — routes through /api/ai, never Anthropic directly.
//
// • DailyDigest.generate now calls aiService.dailyDigest()
//   instead of callClaude() — same proxy routing.
//
// • Both async handlers create an AbortController tied to component lifetime.
//   This prevents "Can't perform a React state update on an unmounted component"
//   when the user navigates away while a request is in-flight.
//
// • Loading states, error states, and UI are IDENTICAL to the previous version.
//   Zero visual regressions.
//
// • NewsletterCTA is unchanged — it is purely UI with no AI calls.
// =============================================================================

import React, { useState, useRef, useEffect } from "react";
import { DS } from "../data/designSystem";
import { aiService } from "../services/aiService";
import { useTypewriter, useVisible } from "../hooks";
import type { Article } from "../types";

// ── AISearchBar ───────────────────────────────────────────────────────────────

interface AISearchBarProps {
  onResults: (query: string) => void;
  onClear:   () => void;
}

export const AISearchBar: React.FC<AISearchBarProps> = ({ onResults, onClear }) => {
  const [query,   setQuery]   = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [insight, setInsight] = useState<string>("");
  const [error,   setError]   = useState<string>("");

  // Typewriter effect on successful insight
  const typed = useTypewriter(insight, 10);

  // AbortController ref — cancelled on unmount or new search
  const abortRef = useRef<AbortController | null>(null);

  // Cancel in-flight request when component unmounts
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleSearch = async (): Promise<void> => {
    const trimmed = query.trim();
    if (!trimmed) return;

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setInsight("");
    setError("");

    try {
      const result = await aiService.searchInsight(trimmed, abortRef.current.signal);
      setInsight(result);
      onResults(trimmed);
    } catch (err) {
      if (err instanceof Error && err.message === "Request cancelled") {
        // User started a new search — don't show error
        return;
      }
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(`AI context unavailable: ${msg}`);
      // Still trigger the keyword filter so the feed updates
      onResults(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = (): void => {
    abortRef.current?.abort();
    setQuery("");
    setInsight("");
    setError("");
    onClear();
  };

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {/* Search input */}
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            color: DS.text2, fontSize: 17, pointerEvents: "none",
          }}>
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSearch(); }}
            placeholder="Search topics, companies, technologies…"
            aria-label="AI-powered search"
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

        {/* Search button */}
        <button
          onClick={() => void handleSearch()}
          disabled={loading || !query.trim()}
          aria-label="Search with AI"
          style={{
            padding: "13px 22px", borderRadius: 12,
            background: `linear-gradient(135deg,${DS.cyan},${DS.cyan}99)`,
            color: "#000", fontFamily: "'Cabinet Grotesk',sans-serif",
            fontWeight: 800, fontSize: 14, border: "none",
            cursor: loading || !query.trim() ? "default" : "pointer",
            opacity: !query.trim() ? 0.5 : 1,
            transition: "opacity .2s",
          }}
        >
          {loading ? "…" : "AI Search"}
        </button>

        {/* Clear button */}
        {query && (
          <button
            onClick={handleClear}
            aria-label="Clear search"
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

      {/* AI insight panel */}
      {insight && (
        <div style={{
          marginTop: 10, padding: "14px 16px",
          background: `${DS.cyan}08`, border: `1px solid ${DS.cyan}20`, borderRadius: 11,
          animation: "fadeIn .3s ease",
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: DS.cyan, letterSpacing: 1.5 }}>
            ✦ AI CONTEXT{"  "}
          </span>
          <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 13, color: DS.text1, lineHeight: 1.7 }}>
            {typed}
          </span>
        </div>
      )}

      {/* Error state — subtle, non-blocking */}
      {error && !insight && (
        <div style={{
          marginTop: 8, padding: "10px 14px",
          background: `${DS.red}0a`, border: `1px solid ${DS.red}20`, borderRadius: 10,
        }}>
          <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, color: DS.text2 }}>
            {error}
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
  const [digest,  setDigest]  = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error,   setError]   = useState<string>("");

  const typed = useTypewriter(digest, 8);
  const ref   = useRef<HTMLDivElement | null>(null);
  const visible = useVisible(ref);

  // AbortController for in-flight digest request
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => { return () => { abortRef.current?.abort(); }; }, []);

  const generate = async (): Promise<void> => {
    if (loading || digest) return; // prevent double-tap

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError("");

    try {
      const headlines = articles
        .slice(0, 8)
        .map((a) => `${a.title} (${a.source})`)
        .filter(Boolean);

      const result = await aiService.dailyDigest(headlines, abortRef.current.signal);
      setDigest(result);
    } catch (err) {
      if (err instanceof Error && err.message === "Request cancelled") return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(`Digest unavailable: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={ref}
      style={{
        background: `linear-gradient(135deg,${DS.bg2},${DS.bg3})`,
        border: `1px solid ${DS.line2}`, borderRadius: 18, padding: 28, marginBottom: 28,
        opacity:    visible ? 1 : 0,
        transform:  visible ? "translateY(0)" : "translateY(20px)",
        transition: "all .5s cubic-bezier(.4,0,.2,1)",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.amber, letterSpacing: 1.5 }}>
            ✦ AI DAILY DIGEST
          </span>
          <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, color: DS.text2 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </span>
        </div>

        {/* Only show button before digest is generated */}
        {!digest && !error && (
          <button
            onClick={() => void generate()}
            disabled={loading}
            aria-label="Generate AI daily digest"
            style={{
              padding: "8px 18px", borderRadius: 9,
              background: loading ? DS.bg4 : `linear-gradient(135deg,${DS.amber},${DS.amberD})`,
              border: "none", color: "#000",
              fontFamily: "'Cabinet Grotesk',sans-serif", fontWeight: 800, fontSize: 13,
              cursor: loading ? "default" : "pointer",
              transition: "background .2s",
            }}
          >
            {loading ? "Generating…" : "Generate Digest ✦"}
          </button>
        )}

        {/* Retry on error */}
        {error && (
          <button
            onClick={() => { setError(""); void generate(); }}
            style={{
              padding: "8px 18px", borderRadius: 9,
              background: `${DS.red}20`, border: `1px solid ${DS.red}30`,
              color: DS.red, fontFamily: "'Cabinet Grotesk',sans-serif",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            Retry
          </button>
        )}
      </div>

      {/* Content */}
      {digest ? (
        <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 15, color: DS.text1, lineHeight: 1.85 }}>
          {typed}
        </p>
      ) : error ? (
        <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 13, color: DS.red, lineHeight: 1.6 }}>
          {error}
        </p>
      ) : (
        <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 14, color: DS.text2, lineHeight: 1.65, fontStyle: "italic" }}>
          Click "Generate Digest" for an AI-powered summary of today's most important tech stories, curated and analyzed in real-time.
        </p>
      )}
    </div>
  );
};

// ── NewsletterCTA (unchanged) ─────────────────────────────────────────────────

export const NewsletterCTA: React.FC = () => {
  const [email,     setEmail]     = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);
  const ref     = useRef<HTMLDivElement | null>(null);
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
      <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 14, color: DS.text2, maxWidth: 380, margin: "0 auto 20px" }}>
        10,000+ tech founders, engineers and VCs start their day with TechPulse. Join them.
      </p>

      {!submitted ? (
        <div style={{ display: "flex", gap: 8, maxWidth: 420, margin: "0 auto" }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="your@email.com"
            type="email"
            aria-label="Email address for newsletter"
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
          ✓ You&apos;re in! First issue arrives tomorrow morning.
        </div>
      )}
    </div>
  );
};