// =============================================================================
// src/components/layout/NavBar.tsx
// =============================================================================

import React from "react";
import { DS, CAT_META, CATEGORIES, getCatMeta } from "../../data/designSystem";
import { APP_NAME } from "../../config/constants";
import { useFeedStore } from "../../store/feedStore";

export const NavBar: React.FC = () => {
  const { filters, setCategory, theme, toggleTheme } = useFeedStore();
  const { category: activeCategory } = filters;

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        position: "sticky", top: 0, zIndex: 900,
        background: `${DS.bg0}ee`, backdropFilter: "blur(24px)",
        borderBottom: `1px solid ${DS.line}`,
      }}
    >
      {/* Top bar */}
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 24px", height: 62, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Logo */}
        <a href="/" aria-label={`${APP_NAME} home`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg,${DS.amber},${DS.coral})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 900, color: "#000" }}>T</span>
          </div>
          <div>
            <span style={{ fontFamily: "'Fraunces',serif", fontSize: 21, fontWeight: 900, color: DS.text0, letterSpacing: "-0.5px" }}>{APP_NAME}</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 8, color: DS.amber, letterSpacing: 1, display: "block", lineHeight: 1, marginTop: 1 }}>AI-POWERED</span>
          </div>
        </a>

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: DS.green, boxShadow: `0 0 8px ${DS.green}`, animation: "pulse 2s ease-in-out infinite", display: "inline-block" }} />
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: DS.text2, letterSpacing: .5 }}>LIVE</span>
          </div>
        </div>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            style={{ padding: "7px 12px", borderRadius: 9, background: "transparent", border: `1px solid ${DS.line2}`, color: DS.text1, fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 14, cursor: "pointer" }}
          >
            {theme === "dark" ? "☀" : "◑"}
          </button>
          <button
            style={{ padding: "7px 15px", borderRadius: 9, background: "transparent", border: `1px solid ${DS.line2}`, color: DS.text1, fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Sign In
          </button>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg,${DS.violet},${DS.cyan})`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15 }}
            role="button" aria-label="User account" tabIndex={0}>
            👤
          </div>
        </div>
      </div>

      {/* Category strip */}
      <div
        className="hide-scrollbar"
        role="tablist"
        aria-label="News categories"
        style={{ borderTop: `1px solid ${DS.line}`, overflowX: "auto", display: "flex", gap: 2, padding: "8px 24px", maxWidth: 1360, margin: "0 auto" }}
      >
        {CATEGORIES.map((c) => {
          const meta   = getCatMeta(c);
          const active = activeCategory === c;
          const color  = CAT_META[c as keyof typeof CAT_META]?.color ?? DS.text0;
          return (
            <button
              key={c}
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(c)}
              className="focus-ring"
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
  );
};