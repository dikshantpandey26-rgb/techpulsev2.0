// ─────────────────────────────────────────────────────────────────────────────
// src/utils/claude.ts  — Typed Anthropic API helper with web-search tool
// ─────────────────────────────────────────────────────────────────────────────

import type { ClaudeMessage, ClaudeApiResponse } from "../types";

export async function callClaude(
  messages: ClaudeMessage[],
  system = "",
  maxTokens = 800
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude API error: ${res.status} ${res.statusText}`);
  }

  const data: ClaudeApiResponse = await res.json();

  return (
    data.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n") ?? ""
  );
}