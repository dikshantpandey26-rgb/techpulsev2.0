// =============================================================================
// src/services/githubTrendingService.ts
//
// GitHub Trending ingestion.
//
// GitHub has no official trending API, but the unofficial gitterapp.com
// aggregator provides a stable JSON endpoint that mirrors the trending page
// without requiring authentication or scraping.
//
// Each trending repo is converted into a RawFeedItem framed as a news story:
//   Title:   "{owner}/{repo} — {description}"
//   URL:     GitHub repo URL
//   Summary: language + stars + trend context
//
// AI repo detection:
//   We check repo name/description/topics against a curated keyword list.
//   AI repos are tagged with ["ai", "github"] so the classifier promotes them.
//
// Note on image:
//   GitHub repo pages don't have article images. We return "" and let
//   articleNormalizer apply the Programming/AI category fallback image.
// =============================================================================

import type { RawFeedItem, SourceFetchResult } from "../types";
import { sourceCache } from "./cacheService";

const ENDPOINT    = "https://api.gitterapp.com/repositories?language=&since=daily";
const TIMEOUT_MS  = 6_000;
const MAX_REPOS   = 12;

// ── GitHub repo shape ─────────────────────────────────────────────────────────

interface GithubRepo {
  author:           string;
  name:             string;
  href:             string;
  description:      string;
  language:         string | null;
  stars:            number;
  forks:            number;
  currentPeriodStars: number;
  builtBy:          Array<{ username: string; href: string; avatar: string }>;
}

// ── AI detection keywords ─────────────────────────────────────────────────────

const AI_KEYWORDS = [
  "llm","gpt","ai","ml","neural","transformer","diffusion","embedding",
  "langchain","rag","agent","openai","anthropic","ollama","llama","mistral",
  "stable diffusion","huggingface","pytorch","tensorflow","jax","cuda",
  "inference","fine-tun","model","vector","semantic",
];

function isAIRepo(name: string, description: string): boolean {
  const text = `${name} ${description}`.toLowerCase();
  return AI_KEYWORDS.some((kw) => text.includes(kw));
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchGithubTrending(): Promise<SourceFetchResult> {
  const start = Date.now();

  // Check cache first
  const cached = sourceCache.get<GithubRepo[]>("github:trending");
  let repos: GithubRepo[];

  if (cached && !cached.isStale) {
    repos = cached.data;
  } else {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(ENDPOINT, {
        headers: { "User-Agent": "TechPulse/2.0 (+https://techpulse.ai/bot)" },
        signal:  controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        return { sourceId: "github-trending", items: [], fetchedAt: new Date().toISOString(), durationMs: Date.now() - start, fromCache: false, error: `HTTP ${res.status}` };
      }

      repos = await res.json() as GithubRepo[];
      sourceCache.set("github:trending", repos, { ttl: 1800 }); // 30-min cache

    } catch (err) {
      clearTimeout(timer);
      return {
        sourceId:   "github-trending",
        items:      [],
        fetchedAt:  new Date().toISOString(),
        durationMs: Date.now() - start,
        fromCache:  false,
        error:      err instanceof Error ? err.message : String(err),
      };
    }
  }

  const items: RawFeedItem[] = repos
    .filter((r) => r.name && r.href)
    .slice(0, MAX_REPOS)
    .map((repo): RawFeedItem => {
      const isAI = isAIRepo(repo.name, repo.description ?? "");
      const lang = repo.language ? `[${repo.language}]` : "";
      const stars = repo.currentPeriodStars ?? repo.stars;

      return {
        sourceId:    "github-trending",
        title:       `${repo.author}/${repo.name}${repo.description ? ` — ${repo.description.slice(0, 80)}` : ""}`,
        url:         repo.href.startsWith("http") ? repo.href : `https://github.com${repo.href}`,
        description: `${lang} ${stars} new stars today · ${repo.description ?? "Open-source repository trending on GitHub"}`.trim(),
        author:      repo.author,
        imageUrl:    "",
        publishedAt: new Date().toISOString(), // trending is "today"
        tags:        [
          ...(isAI ? ["ai"] : []),
          ...(repo.language ? [repo.language.toLowerCase()] : []),
          "github",
          "open-source",
        ],
        score:    stars,
        comments: repo.forks,
      };
    });

  return {
    sourceId:   "github-trending",
    items,
    fetchedAt:  new Date().toISOString(),
    durationMs: Date.now() - start,
    fromCache:  cached?.fromCache ?? false,
  };
}