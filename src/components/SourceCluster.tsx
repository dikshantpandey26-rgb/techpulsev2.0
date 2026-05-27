// =============================================================================
// src/components/SourceCluster.tsx
//
// Two exported components:
//
// 1. SourceClusterBadge
//    Renders "Covered by N sources" inline on a NewsCard.
//    Shown only when sourceCount > 1.
//
// 2. SourceClusterPanel
//    Rendered inside ArticleModal when the article has coverage.
//    Shows all sources with their reliability scores in chronological order.
//
// Both components are self-contained with no external data fetching.
// They receive pre-computed coverage data from the dedupEngine.
// =============================================================================

import React, { useState } from "react";
import { DS } from "../data/designSystem";
import type { CoverageSource } from "../services/dedupEngine";

// ── SourceClusterBadge ────────────────────────────────────────────────────────

interface BadgeProps {
  sourceCount:    number;
  coveredByLabel: string;
  onClick?:       (e: React.MouseEvent) => void;
}

export const SourceClusterBadge: React.FC<BadgeProps> = ({ sourceCount, coveredByLabel, onClick }) => {
  if (sourceCount <= 1 || !coveredByLabel) return null;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      title="Click to see all sources covering this story"
      style={{
        display:    "inline-flex",
        alignItems: "center",
        gap:        5,
        padding:    "3px 9px",
        borderRadius: 100,
        background: `${DS.amber}15`,
        border:     `1px solid ${DS.amber}35`,
        color:      DS.amber,
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize:   9.5,
        letterSpacing: 0.3,
        cursor:     onClick ? "pointer" : "default",
        lineHeight: 1.4,
        transition: "background .2s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${DS.amber}25`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${DS.amber}15`; }}
    >
      <span style={{ fontSize: 10 }}>◈</span>
      {coveredByLabel}
    </button>
  );
};

// ── SourceClusterPanel ────────────────────────────────────────────────────────

interface PanelProps {
  coverageDetails: CoverageSource[];
}

export const SourceClusterPanel: React.FC<PanelProps> = ({ coverageDetails }) => {
  const [expanded, setExpanded] = useState(false);

  if (!coverageDetails || coverageDetails.length <= 1) return null;

  // Default: show top 3, expand on click
  const visible = expanded ? coverageDetails : coverageDetails.slice(0, 3);
  const hasMore = coverageDetails.length > 3;

  function reliabilityColor(label: string): string {
    if (label === "High")   return DS.green;
    if (label === "Medium") return DS.amber;
    return DS.text2;
  }

  function formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      const now = Date.now();
      const diff = now - d.getTime();
      const mins = Math.floor(diff / 60_000);
      if (mins < 60)  return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24)   return `${hrs}h ago`;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch { return ""; }
  }

  return (
    <div style={{
      background: `${DS.amber}07`,
      border:     `1px solid ${DS.amber}20`,
      borderRadius: 12,
      padding:    "14px 16px",
      marginTop:  16,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ color: DS.amber, fontSize: 14 }}>◈</span>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: DS.amber, letterSpacing: 1.5 }}>
          COVERED BY {coverageDetails.length} SOURCES
        </span>
      </div>

      {/* Source list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((src, i) => (
          <a
            key={i}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
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
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = DS.bg4; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = DS.bg3; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Reliability indicator */}
              <span style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: reliabilityColor(src.reliabilityLabel),
              }} />
              <span style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 13, fontWeight: 600, color: DS.text0 }}>
                {src.sourceName}
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: reliabilityColor(src.reliabilityLabel), background: `${reliabilityColor(src.reliabilityLabel)}18`, padding: "2px 6px", borderRadius: 100 }}>
                {src.reliabilityLabel}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5, color: DS.text2 }}>
                {formatTime(src.publishedAt)}
              </span>
              <span style={{ color: DS.text2, fontSize: 12 }}>↗</span>
            </div>
          </a>
        ))}
      </div>

      {/* Expand / collapse */}
      {hasMore && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          style={{
            marginTop:  10,
            display:    "block",
            width:      "100%",
            padding:    "7px",
            borderRadius: 8,
            background: "transparent",
            border:     `1px solid ${DS.line}`,
            color:      DS.text2,
            fontFamily: "'Cabinet Grotesk',sans-serif",
            fontSize:   12,
            cursor:     "pointer",
            textAlign:  "center",
            transition: "border .2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = DS.amber; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = DS.line; }}
        >
          {expanded
            ? "Show fewer sources ↑"
            : `Show ${coverageDetails.length - 3} more source${coverageDetails.length - 3 === 1 ? "" : "s"} ↓`}
        </button>
      )}
    </div>
  );
};