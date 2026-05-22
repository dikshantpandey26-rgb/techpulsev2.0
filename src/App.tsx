// ─────────────────────────────────────────────────────────────────────────────
// src/App.tsx  — Main application shell
// Production-grade · Vercel-compatible · Strict TypeScript
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useMemo } from "react";
import { DS, CAT_META, CATEGORIES, getCatMeta } from "./data/designSystem";
import { BASE_ARTICLES } from "./data/articles";
import { useScrollProgress } from "./hooks";
import { BreakingTicker } from "./components/BreakingTicker";
import { NewsCard } from "./components/NewsCard";
import { ArticleModal } from "./components/ArticleModal";
import { Skeleton } from "./components/atoms";
import { TrendingWidget, StatsBar, CategoryBreakdown, SourcesList, PremiumCTA, AdSlot } from "./components/Sidebar";
import { AISearchBar, DailyDigest, NewsletterCTA } from "./components/AIWidgets";
import type { Article } from "./types";

const PERPAGE = 9;

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=IBM+Plex+Mono:wght@400;600;700&display=swap');
  @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,600,700,800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{background:#09090e;color:#f5f0e8;-webkit-font-smoothing:antialiased;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:#252535;border-radius:2px;}
  @keyframes shimmer{0%,100%{opacity:.3}50%{opacity:.7}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  @keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .cats::-webkit-scrollbar{display:none;}
  .cats{scrollbar-width:none;}
`;

export default function App(): React.ReactElement {
  const [articles]                    = useState<Article[]>(BASE_ARTICLES);
  const [loading, setLoading]         = useState<boolean>(true);
  const [activeCategory, setCategory] = useState<string>("All");
  const [selected, setSelected]       = useState<Article | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage]               = useState<number>(1);

  const scrollProg = useScrollProgress();
  const loaderRef  = useRef<HTMLDivElement | null>(null);

  // Simulate initial data fetch
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  // Filtered + searched articles
  const filtered = useMemo<Article[]>(() => {
    let list = articles;

    if (activeCategory !== "All") {
      list = list.filter((a) => a.category === activeCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q)) ||
          a.source.toLowerCase().includes(q)
      );
    }

    return list;
  }, [articles, activeCategory, searchQuery]);

  const paginated = filtered.slice(0, page * PERPAGE);
  const hasMore   = paginated.length < filtered.length;

  // Infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasMore) setPage((p) => p + 1); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  const handleCategoryChange = (cat: string): void => {
    setCategory(cat);
    setPage(1);
  };

  const handleSearchResults = (q: string): void => {
    setSearchQuery(q);
    setPage(1);
  };

  const handleSearchClear = (): void => {
    setSearchQuery("");
    setPage(1);
  };

  const trendingArticles = articles.filter((a) => a.trending || a.hype > 85);
  const breakingArticles = articles.filter((a) => a.breaking || a.trending);
  const showHomeSections = !searchQuery && activeCategory === "All";

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      {/* Reading progress bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, height: 2,
        width: `${scrollProg}%`,
        background: `linear-gradient(90deg,${DS.amber},${DS.coral})`,
        zIndex: 1000, transition: "width .1s",
      }} />

      {/* Breaking ticker */}
      {!loading && <BreakingTicker articles={breakingArticles} />}

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 900,
        background: `${DS.bg0}ee`, backdropFilter: "blur(24px)",
        borderBottom: `1px solid ${DS.line}`,
      }}>
        <div style={{
          maxWidth: 1360, margin: "0 auto", padding: "0 24px",
          height: 62, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: `linear-gradient(135deg,${DS.amber},${DS.coral})`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 900, color: "#000" }}>T</span>
            </div>
            <div>
              <span style={{ fontFamily: "'Fraunces',serif", fontSize: 21, fontWeight: 900, color: DS.text0, letterSpacing: "-0.5px" }}>
                TechPulse
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: DS.amber, letterSpacing: 1, display: "block", lineHeight: 1, marginTop: 1 }}>
                AI-POWERED
              </span>
            </div>
          </div>

          {/* Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: DS.green, boxShadow: `0 0 8px ${DS.green}`,
                animation: "pulse 2s ease-in-out infinite", display: "inline-block",
              }} />
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: DS.text2, letterSpacing: .5 }}>LIVE</span>
            </div>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: DS.text2 }}>
              {filtered.length} ARTICLES
            </span>
          </div>

          {/* Auth */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button style={{
              padding: "7px 15px", borderRadius: 9, background: "transparent",
              border: `1px solid ${DS.line2}`, color: DS.text1,
              fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              Sign In
            </button>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `linear-gradient(135deg,${DS.violet},${DS.cyan})`,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15,
            }}>
              👤
            </div>
          </div>
        </div>

        {/* Category strip */}
        <div
          className="cats"
          style={{
            borderTop: `1px solid ${DS.line}`, overflowX: "auto",
            display: "flex", gap: 2, padding: "8px 24px",
            maxWidth: 1360, margin: "0 auto",
          }}
        >
          {CATEGORIES.map((c) => {
            const meta   = getCatMeta(c);
            const active = activeCategory === c;
            const color  = CAT_META[c as keyof typeof CAT_META]?.color ?? DS.text0;
            return (
              <button
                key={c}
                onClick={() => handleCategoryChange(c)}
                style={{
                  padding: "6px 16px", borderRadius: 100,
                  border:     active ? "none" : `1px solid ${DS.line}`,
                  background: active ? color : "transparent",
                  color:      active ? "#000" : DS.text2,
                  fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12.5,
                  fontWeight: active ? 800 : 500,
                  cursor: "pointer", whiteSpace: "nowrap", transition: "all .2s",
                  boxShadow: active ? `0 0 20px ${color}40` : "none",
                }}
              >
                {c !== "All" ? `${meta.emoji} ` : ""}{c}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(180deg,${DS.bg1} 0%,${DS.bg0} 100%)`,
        borderBottom: `1px solid ${DS.line}`, padding: "52px 24px 44px",
      }}>
        <div style={{ maxWidth: 1360, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.red, letterSpacing: 2 }}>
              ● LIVE TECH INTELLIGENCE
            </span>
            <span style={{ color: DS.line2 }}>·</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.text2 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>

          <h1 style={{
            fontFamily: "'Fraunces',serif",
            fontSize: "clamp(38px,5.5vw,70px)",
            fontWeight: 900, lineHeight: 1.08, marginBottom: 16, maxWidth: 700,
          }}>
            The World's Tech News,<br />
            <span style={{ background: `linear-gradient(90deg,${DS.amber},${DS.coral})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Intelligently Curated.
            </span>
          </h1>

          <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 16, color: DS.text2, maxWidth: 520, lineHeight: 1.65 }}>
            AI-analyzed stories from 50+ trusted sources. Sentiment scores, hype ratings, and expert context — updated in real-time.
          </p>
        </div>
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <main style={{
        maxWidth: 1360, margin: "0 auto", padding: "32px 24px 60px",
        display: "grid", gridTemplateColumns: "1fr 320px", gap: 28, alignItems: "start",
      }}>
        {/* Left column */}
        <div>
          <AISearchBar onResults={handleSearchResults} onClear={handleSearchClear} />

          {!loading && showHomeSections && <StatsBar articles={articles} />}
          {!loading && showHomeSections && <DailyDigest articles={articles} />}

          {/* Feed */}
          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 18 }}>
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 20px", animation: "fadeIn .5s" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🔍</div>
              <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, color: DS.text1, marginBottom: 8 }}>
                No results found
              </h3>
              <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 14, color: DS.text2 }}>
                Try a different search term or category
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 18 }}>
                {paginated.map((a, i) => (
                  <NewsCard
                    key={a.id}
                    article={a}
                    onClick={setSelected}
                    variant={i === 0 && showHomeSections ? "featured" : "default"}
                    delay={Math.min(i * 40, 200)}
                  />
                ))}
              </div>

              {/* Inline ad after 6th article */}
              {paginated.length >= 6 && showHomeSections && <AdSlot />}

              {/* Infinite scroll sentinel */}
              <div ref={loaderRef} style={{ textAlign: "center", padding: "28px 0" }}>
                {hasMore ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <div style={{
                      width: 16, height: 16,
                      border: `2px solid ${DS.amber}`, borderTopColor: "transparent",
                      borderRadius: "50%", animation: "spin 1s linear infinite",
                    }} />
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.text2, letterSpacing: 1 }}>
                      LOADING MORE
                    </span>
                  </div>
                ) : filtered.length > PERPAGE ? (
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.text2 }}>
                    — END OF FEED —
                  </span>
                ) : null}
              </div>
            </>
          )}

          {!loading && <NewsletterCTA />}
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, position: "sticky", top: 130 }}>
          {!loading && <TrendingWidget articles={trendingArticles} />}
          <SourcesList />
          <CategoryBreakdown articles={articles} />
          <PremiumCTA />
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${DS.line}`, padding: "32px 24px 28px" }}>
        <div style={{
          maxWidth: 1360, margin: "0 auto",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 16,
        }}>
          <div>
            <span style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 900, color: DS.text0 }}>TechPulse</span>
            <p style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, color: DS.text2, marginTop: 3 }}>
              AI-powered tech intelligence · Built for builders
            </p>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {(["About", "Advertise", "API", "Privacy", "Terms", "Contact"] as const).map((l) => (
              <span key={l} style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 12, color: DS.text2, cursor: "pointer" }}>
                {l}
              </span>
            ))}
          </div>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.text2 }}>
            © 2026 TechPulse · Powered by Claude
          </span>
        </div>
      </footer>

      {/* Article modal */}
      {selected && (
        <ArticleModal
          article={selected}
          onClose={() => setSelected(null)}
          allArticles={articles}
        />
      )}
    </>
  );
}