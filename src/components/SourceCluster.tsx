// =============================================================================
// src/components/SourceCluster.tsx  (Phase 2 Part 4 — STEP 3 update)
//
// CHANGES:
// 1. SourceClusterBadge: added aria-label with full count text for screen readers,
//    role="status" so assistive tech announces "Covered by 5 sources" without
//    the user having to navigate to it. Removed color-only reliability meaning
//    in SourceClusterPanel — now shows text label alongside the color dot.
//
// 2. SourceClusterPanel: added aria-label on each source link, keyboard focus
//    ring, role="list" + role="listitem" for screen reader navigation.
//
// 3. CompactCoverageBadge: NEW compact variant for NewsCard density.
//    Shows "5 sources" (short form) with minimal visual weight.
//    Used in compact/default cards; full "Covered by N sources" on featured.
// =============================================================================

import React, { useState } from "react";
import { DS } from "../data/designSystem";
import type { CoverageSource } from "../services/dedupEngine";

// ─────────────────────────────────────────────────────────────────────────────
// SourceClusterBadge — full "Covered by N sources" pill (featured cards)
// ─────────────────────────────────────────────────────────────────────────────

interface BadgeProps {
  sourceCount:    number;
  coveredByLabel: string;
  /** If provided, clicking the badge calls this (e.g. open coverage modal panel) */
  onClick?:       (e: React.MouseEvent) => void;
}

export const SourceClusterBadge: React.FC<BadgeProps> = ({
  sourceCount,
  coveredByLabel,
  onClick,
}) => {
  if (sourceCount <= 1 || !coveredByLabel) return null;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      // Screen-reader friendly: describes the full count even when abbreviated
      aria-label={coveredByLabel}
      role="status"
      title={coveredByLabel}
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          5,
        padding:      "3px 9px",
        borderRadius: 100,
        background:   `${DS.amber}15`,
        border:       `1px solid ${DS.amber}35`,
        color:        DS.amber,
        fontFamily:   "'IBM Plex Mono',monospace",
        fontSize:     9.5,
        letterSpacing: 0.3,
        cursor:       onClick ? "pointer" : "default",
        lineHeight:   1.4,
        transition:   "background .2s",
        // Explicit focus ring for keyboard navigation
        outline:      "none",
      }}
      onMouseEnter={(e) => { (e.currentTarget).style.background = `${DS.amber}25`; }}
      onMouseLeave={(e) => { (e.currentTarget).style.background = `${DS.amber}15`; }}
      onFocus={(e)      => { (e.currentTarget).style.boxShadow = `0 0 0 2px ${DS.amber}60`; }}
      onBlur={(e)       => { (e.currentTarget).style.boxShadow = "none"; }}
    >
      {/* ◈ is decorative — aria-hidden prevents double-reading */}
      <span aria-hidden="true" style={{ fontSize: 10 }}>◈</span>
      {coveredByLabel}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CompactCoverageBadge — short form "5 sources" for default/compact cards
// ─────────────────────────────────────────────────────────────────────────────

interface CompactBadgeProps {
  sourceCount: number;
  onClick?:    (e: React.MouseEvent) => void;
}

export const CompactCoverageBadge: React.FC<CompactBadgeProps> = ({
  sourceCount,
  onClick,
}) => {
  if (sourceCount <= 1) return null;

  const label = `${sourceCount} sources`;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      aria-label={`Covered by ${sourceCount} sources`}
      title={`Covered by ${sourceCount} sources`}
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          4,
        padding:      "2px 7px",
        borderRadius: 100,
        background:   "rgba(245,166,35,0.10)",
        border:       "1px solid rgba(245,166,35,0.25)",
        color:        DS.amber,
        fontFamily:   "'IBM Plex Mono',monospace",
        fontSize:     8.5,
        letterSpacing: 0.2,
        cursor:       onClick ? "pointer" : "default",
        lineHeight:   1.4,
        transition:   "background .2s",
        outline:      "none",
        // Does NOT grow the card — fixed height via line-height only
        flexShrink:   0,
      }}
      onMouseEnter={(e) => { (e.currentTarget).style.background = `${DS.amber}20`; }}
      onMouseLeave={(e) => { (e.currentTarget).style.background = `${DS.amber}10`; }}
      onFocus={(e)      => { (e.currentTarget).style.boxShadow = `0 0 0 2px ${DS.amber}50`; }}
      onBlur={(e)       => { (e.currentTarget).style.boxShadow = "none"; }}
    >
      <span aria-hidden="true">◈</span>
      {label}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SourceClusterPanel — full coverage list inside ArticleModal
// ─────────────────────────────────────────────────────────────────────────────

interface PanelProps {
  coverageDetails: CoverageSource[];
}

export const SourceClusterPanel: React.FC<PanelProps> = ({ coverageDetails }) => {
  const [expanded, setExpanded] = useState(false);

  if (!coverageDetails || coverageDetails.length <= 1) return null;

  const visible = expanded ? coverageDetails : coverageDetails.slice(0, 3);
  const hasMore = coverageDetails.length > 3;

  // Color by reliability — but NOT color-only: text label always present
  function reliabilityColor(label: string): string {
    if (label === "High")   return DS.green;
    if (label === "Medium") return DS.amber;
    return DS.text2;
  }

  function formatTime(iso: string): string {
    try {
      const d    = new Date(iso);
      const diff = Date.now() - d.getTime();
      const m    = Math.floor(diff / 60_000);
      if (m < 60)  return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24)  return `${h}h ago`;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch { return ""; }
  }

  return (
    <section
      aria-label={`Coverage from ${coverageDetails.length} sources`}
      style={{
        background:   `${DS.amber}07`,
        border:       `1px solid ${DS.amber}20`,
        borderRadius: 12,
        padding:      "14px 16px",
        marginTop:    16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span aria-hidden="true" style={{ color: DS.amber, fontSize: 14 }}>◈</span>
        <span style={{
          fontFamily:   "'IBM Plex Mono',monospace", fontSize: 10,
          color:        DS.amber, letterSpacing: 1.5,
        }}>
          COVERED BY {coverageDetails.length} SOURCES
        </span>
      </div>

      {/* Source list */}
      <ul
        role="list"
        style={{ display: "flex", flexDirection: "column", gap: 8, listStyle: "none", padding: 0, margin: 0 }}
      >
        {visible.map((src, i) => {
          const rColor = reliabilityColor(src.reliabilityLabel);
          return (
            <li key={i} role="listitem">
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Read coverage from ${src.sourceName} (${src.reliabilityLabel} reliability) — published ${formatTime(src.publishedAt)}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "space-between",
                  padding:        "8px 12px",
                  borderRadius:   9,
                  background:     DS.bg3,
                  border:         `1px solid ${DS.line}`,
                  textDecoration: "none",
                  transition:     "background .2s",
                  outline:        "none",
                }}
                onMouseEnter={(e) => { (e.currentTarget).style.background = DS.bg4; }}
                onMouseLeave={(e) => { (e.currentTarget).style.background = DS.bg3; }}
                onFocus={(e)      => { (e.currentTarget).style.boxShadow = `0 0 0 2px ${DS.amber}50`; }}
                onBlur={(e)       => { (e.currentTarget).style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Colored dot (decorative — aria-hidden, text label follows) */}
                  <span
                    aria-hidden="true"
                    style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: rColor }}
                  />
                  <span style={{
                    fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 13,
                    fontWeight: 600, color: DS.text0,
                  }}>
                    {src.sourceName}
                  </span>
                  {/* Text reliability label — NOT color-only */}
                  <span style={{
                    fontFamily: "'IBM Plex Mono',monospace", fontSize: 9,
                    color:      rColor,
                    background: `${rColor}18`,
                    padding:    "2px 6px", borderRadius: 100,
                  }}>
                    {src.reliabilityLabel}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: DS.text2,
                  }}>
                    {formatTime(src.publishedAt)}
                  </span>
                  <span aria-hidden="true" style={{ color: DS.text2, fontSize: 12 }}>↗</span>
                </div>
              </a>
            </li>
          );
        })}
      </ul>

      {/* Expand / collapse */}
      {hasMore && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          aria-expanded={expanded}
          aria-label={expanded ? "Show fewer sources" : `Show ${coverageDetails.length - 3} more sources`}
          style={{
            marginTop:    10,
            display:      "block",
            width:        "100%",
            padding:      "7px",
            borderRadius: 8,
            background:   "transparent",
            border:       `1px solid ${DS.line}`,
            color:        DS.text2,
            fontFamily:   "'Cabinet Grotesk',sans-serif",
            fontSize:     12,
            cursor:       "pointer",
            textAlign:    "center",
            transition:   "border .2s",
            outline:      "none",
          }}
          onMouseEnter={(e) => { (e.currentTarget).style.borderColor = DS.amber; }}
          onMouseLeave={(e) => { (e.currentTarget).style.borderColor = DS.line; }}
          onFocus={(e)      => { (e.currentTarget).style.boxShadow = `0 0 0 2px ${DS.amber}50`; }}
          onBlur={(e)       => { (e.currentTarget).style.boxShadow = "none"; }}
        >
          {expanded
            ? "Show fewer sources ↑"
            : `Show ${coverageDetails.length - 3} more source${coverageDetails.length - 3 === 1 ? "" : "s"} ↓`}
        </button>
      )}
    </section>
  );
};