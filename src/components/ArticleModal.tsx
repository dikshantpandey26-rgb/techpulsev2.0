// ─────────────────────────────────────────────────────────────────────────────
// src/components/ArticleModal.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { DS, getCatMeta, FALLBACK_IMAGE } from "../data/designSystem";
import { callClaude } from "../utils/claude";
import { useTypewriter } from "../hooks";
import { SentimentBadge, ShareMenu } from "./atoms";
import type { Article, AIPanelMode, AIPanelButton } from "../types";

// ── AIPanel ───────────────────────────────────────────────────────────────────
interface AIPanelProps {
  article: Article;
}

export const AIPanel: React.FC<AIPanelProps> = ({ article }) => {
  const [mode, setMode]       = useState<AIPanelMode | null>(null);
  const [result, setResult]   = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const typed = useTypewriter(result);

  const run = async (m: AIPanelMode): Promise<void> => {
    if (loading) return;
    setMode(m);
    setResult("");
    setLoading(true);

    const prompts: Record<AIPanelMode, string> = {
      summary: `Tech article analysis:\n"${article.title}" — ${article.summary}\n\nProvide:\n• 3 key insights (start each with •)\n• Why this matters for the industry (2 sentences)\n• What to watch next (1 sentence)`,
      eli5:    `Explain this tech news to a curious 12-year-old using simple analogies and 3 short paragraphs:\n"${article.title}" — ${article.summary}`,
      market:  `Market/industry sentiment analysis of this tech news:\n"${article.title}" — ${article.summary}\n\nProvide: bull/bear signals, who wins, who loses, competitive impact, 90-day outlook. Use clear headers.`,
    };

    try {
      const r = await callClaude(
        [{ role: "user", content: prompts[m] }],
        "You are a senior tech analyst at a top-tier research firm. Be sharp, specific, and insightful. No generic statements.",
        700
      );
      setResult(r);
    } catch {
      setResult("• AI analysis temporarily unavailable.\n• Please try again in a moment.");
    }

    setLoading(false);
  };

  const buttons: AIPanelButton[] = [
    { id: "summary", label: "✦ AI Summary",    color: DS.cyan   },
    { id: "eli5",    label: "⬡ Explain Simply", color: DS.violet },
    { id: "market",  label: "◈ Market Take",    color: DS.amber  },
  ];

  return (
    <div style={{ background: `${DS.cyan}08`, border: `1px solid ${DS.cyan}20`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ color: DS.cyan, fontSize: 16 }}>✦</span>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.cyan, letterSpacing: 1.5 }}>
          AI INTELLIGENCE
        </span>
      </div>

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: result ? 16 : 0 }}>
        {buttons.map((b) => (
          <button
            key={b.id}
            onClick={() => void run(b.id)}
            disabled={loading}
            style={{
              padding: "7px 14px", borderRadius: 9,
              border:  `1px solid ${mode === b.id ? b.color : DS.line2}`,
              background: mode === b.id ? `${b.color}18` : "transparent",
              color:      mode === b.id ? b.color : DS.text1,
              fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, fontWeight: 600,
              cursor: loading ? "default" : "pointer", transition: "all .2s",
            }}
          >
            {loading && mode === b.id ? "Analyzing…" : b.label}
          </button>
        ))}
      </div>

      {result && (
        <div style={{
          fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 14, color: DS.text1,
          lineHeight: 1.8, whiteSpace: "pre-line",
          paddingTop: 14, borderTop: `1px solid ${DS.line}`,
        }}>
          {typed}
        </div>
      )}
    </div>
  );
};

// ── ArticleModal ──────────────────────────────────────────────────────────────
interface ArticleModalProps {
  article: Article;
  onClose: () => void;
  allArticles: Article[];
}

export const ArticleModal: React.FC<ArticleModalProps> = ({ article, onClose, allArticles }) => {
  const [tts, setTts]         = useState<boolean>(false);
  const [sharing, setSharing] = useState<boolean>(false);
  const cat = getCatMeta(article.category);

  const related = allArticles
    .filter(
      (a) =>
        a.id !== article.id &&
        (a.category === article.category ||
          a.tags.some((t) => article.tags.includes(t)))
    )
    .slice(0, 3);

  const handleSpeak = (): void => {
    if (tts) {
      window.speechSynthesis.cancel();
      setTts(false);
      return;
    }
    const utt = new SpeechSynthesisUtterance(`${article.title}. ${article.summary}`);
    utt.rate  = 0.92;
    utt.pitch = 1.02;
    utt.onend = () => setTts(false);
    window.speechSynthesis.speak(utt);
    setTts(true);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.9)", backdropFilter: "blur(16px)" }} />

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative", background: DS.bg1, border: `1px solid ${DS.line2}`,
          borderRadius: 20, maxWidth: 760, width: "100%", maxHeight: "90vh",
          overflowY: "auto", zIndex: 1, animation: "slideUp .3s cubic-bezier(.4,0,.2,1)",
        }}
      >
        {/* Header image */}
        <div style={{ position: "relative", height: 300 }}>
          <img
            src={article.image}
            alt={article.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "20px 20px 0 0" }}
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.src = FALLBACK_IMAGE; }}
          />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${DS.bg1} 0%, transparent 55%)`, borderRadius: "20px 20px 0 0" }} />
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 16, right: 16,
              background: "rgba(0,0,0,.6)", border: `1px solid ${DS.line2}`,
              borderRadius: "50%", width: 36, height: 36,
              color: "#fff", cursor: "pointer", fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ×
          </button>
          <span style={{
            position: "absolute", bottom: 20, left: 24,
            background: cat.color, color: "#000",
            padding: "4px 12px", borderRadius: 100,
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: 1,
          }}>
            {cat.emoji} {article.category.toUpperCase()}
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: "4px 28px 32px" }}>
          <h1 style={{
            fontFamily: "'Fraunces',serif", fontSize: 27, fontWeight: 800,
            color: DS.text0, lineHeight: 1.28, margin: "20px 0 14px",
          }}>
            {article.title}
          </h1>

          {/* Meta */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <SentimentBadge sentiment={article.sentiment} hype={article.hype} />
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: cat.color, fontWeight: 700 }}>{article.source}</span>
            <span style={{ color: DS.text2 }}>·</span>
            <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, color: DS.text2 }}>by {article.author}</span>
            <span style={{ color: DS.text2 }}>·</span>
            <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, color: DS.text2 }}>{article.time}</span>
            <span style={{ color: DS.text2 }}>·</span>
            <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, color: DS.text2 }}>
              ⏱ {article.readTime} read · 👁 {article.views}
            </span>
          </div>

          <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 16, color: DS.text1, lineHeight: 1.8, marginBottom: 26 }}>
            {article.summary}
          </p>

          <AIPanel article={article} />

          {/* Tags */}
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "20px 0" }}>
            {article.tags.map((tag) => (
              <span key={tag} style={{
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.text2,
                background: DS.bg3, padding: "4px 11px", borderRadius: 100, border: `1px solid ${DS.line}`,
              }}>
                #{tag}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 28, position: "relative" }}>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, minWidth: 160, padding: "13px 22px", borderRadius: 11,
                background: `linear-gradient(135deg,${cat.color},${cat.color}99)`,
                color: "#000", fontFamily: "'Cabinet Grotesk',sans-serif",
                fontWeight: 800, fontSize: 14, textDecoration: "none", textAlign: "center",
              }}
            >
              Read Full Article ↗
            </a>

            <button
              onClick={handleSpeak}
              style={{
                padding: "13px 20px", borderRadius: 11,
                background: tts ? `${DS.red}20` : DS.bg3,
                border: `1px solid ${tts ? DS.red : DS.line2}`,
                color: tts ? DS.red : DS.text1,
                fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              {tts ? "⏹ Stop" : "🔊 Listen"}
            </button>

            <div style={{ position: "relative" }}>
              <button
                onClick={() => setSharing((s) => !s)}
                style={{
                  padding: "13px 20px", borderRadius: 11,
                  background: DS.bg3, border: `1px solid ${DS.line2}`,
                  color: DS.text1, fontFamily: "'Cabinet Grotesk',sans-serif",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                ↗ Share
              </button>
              {sharing && <ShareMenu article={article} onClose={() => setSharing(false)} />}
            </div>
          </div>

          {/* Related articles */}
          {related.length > 0 && (
            <div>
              <h4 style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.text2, letterSpacing: 1.5, marginBottom: 14 }}>
                RELATED ARTICLES
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {related.map((r) => (
                  <div key={r.id} style={{
                    display: "flex", gap: 12, padding: "12px 14px",
                    borderRadius: 12, background: DS.bg2, border: `1px solid ${DS.line}`, cursor: "pointer",
                  }}>
                    <img
                      src={r.image}
                      alt={r.title}
                      style={{ width: 64, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = "none"; }}
                    />
                    <div>
                      <p style={{ fontFamily: "'Fraunces',serif", fontSize: 13, fontWeight: 700, color: DS.text0, lineHeight: 1.35, margin: "0 0 5px" }}>
                        {r.title}
                      </p>
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: DS.text2 }}>
                        {r.source} · {r.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};