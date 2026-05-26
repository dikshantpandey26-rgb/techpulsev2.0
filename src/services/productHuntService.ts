// =============================================================================
// src/services/productHuntService.ts
//
// Product Hunt ingestion — surfaces new AI tools, developer utilities, and
// startup launches as articles.
//
// API strategy:
//   Product Hunt has a GraphQL API (v2) that requires a developer token, and
//   a legacy REST endpoint that still works unauthenticated for daily top posts.
//   We use the legacy endpoint as primary and the public "featured" RSS feed
//   as a no-auth fallback, so the service degrades gracefully if the token
//   is absent from env.
//
// Frame:  Each Product Hunt post becomes an article titled:
//         "{name} — {tagline}"
//   URL:  The product's PH discussion page (not the product URL itself, to
//         keep traffic attributable and avoid violating PH's terms).
//
// Edge compatibility: standard fetch + AbortController only. No Node APIs.
// =============================================================================

import type { RawFeedItem, SourceFetchResult, ProductHuntPost } from "../types";
import { sourceCache } from "./cacheService";

const TIMEOUT_MS = 8_000;
const MAX_POSTS  = 8;

// ── GraphQL query (used when PRODUCTHUNT_TOKEN is present) ────────────────────

const GQL_QUERY = `
  query TopPosts {
    posts(first: ${MAX_POSTS}, order: VOTES) {
      edges {
        node {
          id
          name
          tagline
          url
          votesCount
          commentsCount
          createdAt
          topics { edges { node { name } } }
          thumbnail { url }
        }
      }
    }
  }
`.trim();

interface GQLPost {
  id:            string;
  name:          string;
  tagline:       string;
  url:           string;
  votesCount:    number;
  commentsCount: number;
  createdAt:     string;
  topics:        { edges: Array<{ node: { name: string } }> };
  thumbnail?:    { url: string };
}

interface GQLResponse {
  data?: { posts?: { edges?: Array<{ node: GQLPost }> } };
  errors?: Array<{ message: string }>;
}

// ── RSS fallback (no auth, always available) ──────────────────────────────────

const PH_RSS = "https://www.producthunt.com/feed";

async function fetchFromRss(): Promise<RawFeedItem[]> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(PH_RSS, {
      headers: {
        "User-Agent": "TechPulse/2.0 (+https://techpulse.ai/bot)",
        "Accept":     "application/rss+xml, application/xml, */*",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];

    const xml    = await res.text();
    const parser = new DOMParser();
    const doc    = parser.parseFromString(xml, "text/xml");
    if (doc.querySelector("parsererror")) return [];

    const items = Array.from(doc.querySelectorAll("item")).slice(0, MAX_POSTS);

    return items.map((item): RawFeedItem => {
      const title = item.querySelector("title")?.textContent?.trim() ?? "";
      const url   = item.querySelector("link")?.textContent?.trim() ?? "";
      const desc  = item.querySelector("description")?.textContent
        ?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ?? "";
      const pubDate = item.querySelector("pubDate")?.textContent?.trim() ?? new Date().toISOString();

      return {
        sourceId:    "producthunt",
        title:       title.slice(0, 200),
        url,
        description: desc.slice(0, 400),
        author:      "Product Hunt",
        imageUrl:    "",
        publishedAt: pubDate,
        tags:        ["product-hunt", "launch"],
        score:       0,
        comments:    0,
      };
    }).filter((i) => i.title.length > 0 && i.url.length > 0);

  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ── GraphQL fetch (requires PRODUCTHUNT_TOKEN server-side env var) ────────────

async function fetchFromGraphQL(token: string): Promise<RawFeedItem[]> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
        "User-Agent":    "TechPulse/2.0 (+https://techpulse.ai/bot)",
      },
      body:   JSON.stringify({ query: GQL_QUERY }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];

    const json = await res.json() as GQLResponse;
    if (json.errors?.length) return [];

    const posts = json.data?.posts?.edges ?? [];

    return posts.map(({ node: p }): RawFeedItem => {
      const topics = p.topics.edges.map((e) => e.node.name.toLowerCase());

      return {
        sourceId:    "producthunt",
        title:       `${p.name} — ${p.tagline}`.slice(0, 200),
        url:         `https://www.producthunt.com/posts/${p.url.split("/").pop() ?? p.id}`,
        description: `${p.tagline} — ${p.votesCount} upvotes · ${p.commentsCount} comments`,
        author:      "Product Hunt",
        imageUrl:    p.thumbnail?.url ?? "",
        publishedAt: p.createdAt,
        tags:        [...topics.slice(0, 4), "product-hunt", "launch"],
        score:       p.votesCount,
        comments:    p.commentsCount,
        rawData:     { phId: p.id },
      };
    });

  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ── Exported service function ─────────────────────────────────────────────────

export async function fetchProductHunt(): Promise<SourceFetchResult> {
  const start = Date.now();

  // Check cache
  const cached = sourceCache.get<RawFeedItem[]>("ph:posts");
  if (cached && !cached.isStale) {
    return { sourceId: "producthunt", items: cached.data, fetchedAt: new Date().toISOString(), durationMs: Date.now() - start, fromCache: true };
  }

  try {
    // Try GraphQL with token first, fall back to RSS
    // process.env is only available server-side (api/ edge functions).
    // In the browser this guard returns undefined safely.
    const nodeProcess = typeof process !== "undefined" ? process : null;
    const token = nodeProcess?.env?.["PRODUCTHUNT_TOKEN"] as string | undefined;
    const items  = token
      ? await fetchFromGraphQL(token).then((r) => r.length > 0 ? r : fetchFromRss())
      : await fetchFromRss();

    sourceCache.set("ph:posts", items, { ttl: 900, staleTtl: 1800 });

    return {
      sourceId:   "producthunt",
      items,
      fetchedAt:  new Date().toISOString(),
      durationMs: Date.now() - start,
      fromCache:  false,
    };

  } catch (err) {
    return {
      sourceId:   "producthunt",
      items:      [],
      fetchedAt:  new Date().toISOString(),
      durationMs: Date.now() - start,
      fromCache:  false,
      error:      err instanceof Error ? err.message : String(err),
    };
  }
}