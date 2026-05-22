// =============================================================================
// src/services/aiService.ts
// All AI calls go through the /api/ai server-side proxy.
// The Anthropic API key is NEVER exposed in the browser bundle.
// =============================================================================

import type { AIRequest, AIResponse } from "../types";

class AIService {
  private readonly endpoint: string;

  constructor() {
    // Use window.location.origin — no hardcoded domain
    this.endpoint = `${typeof window !== "undefined" ? window.location.origin : ""}/api/ai`;
  }

  async request(payload: AIRequest): Promise<string> {
    const res = await fetch(this.endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `AI request failed: ${res.status}`);
    }

    const data: AIResponse = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  }

  async summarize(articleTitle: string, articleSummary: string): Promise<string> {
    return this.request({ mode: "summary", articleTitle, articleSummary });
  }

  async explainSimply(articleTitle: string, articleSummary: string): Promise<string> {
    return this.request({ mode: "eli5", articleTitle, articleSummary });
  }

  async marketTake(articleTitle: string, articleSummary: string): Promise<string> {
    return this.request({ mode: "market", articleTitle, articleSummary });
  }

  async dailyDigest(headlines: string[]): Promise<string> {
    return this.request({ mode: "digest", headlines });
  }

  async searchInsight(query: string): Promise<string> {
    return this.request({ mode: "search", query });
  }

  async recommend(interests: string): Promise<string> {
    return this.request({ mode: "recommend", query: interests });
  }
}

// Singleton export
export const aiService = new AIService();