// =============================================================================
// src/services/rssService.ts
//
// RSS/Atom feed ingestion. Runs exclusively in Vercel Edge Functions (api/).
// NEVER imported into the browser bundle — it is only called from api/ingest.ts.
//
// XML parsing strategy:
//   We do NOT use any Node.js XML library (xml2js, fast-xml-parser etc.) for
//   two reasons: (1) they are Node-only; (2) they add hundreds of KB to the
//   edge bundle. Instead we use a hand-rolled DOMParser-based parser.
//   Vercel Edge Runtime exposes the WHATWG DOMParser, so this works without
//   any polyfill.
//
// Graceful degradation:
//   Each source fetch is independent. A timeout, parse error, or HTTP failure
//   on one source returns an empty SourceFetchResult with an error string —
//   it never throws, so the orchestrator can continue with other sources.
//
// Timeout handling:
//   AbortController with configurable per-source timeout (default 8s).
//   RSS feeds from personal blogs can be slow; major publications rarely exceed 3s.
//
// Retry logic:
//   One retry on transient network errors (5xx, timeout). Two retries would
//   add too much latency in a cron job that already fans out to 20+ sources.
// =============================================================================

import type { RawFeedItem, SourceFetchResult, SourceId } from "../types";
import { RSS_SOURCES, SOURCE_REGISTRY } from "./sourceRegistry";
import { sourceCache } from "./cacheService";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_RETRIES      = 1;

// ── XML parsing helpers ───────────────────────────────────────────────────────

/**
 * Extract text content from first matching element inside a parent node.
 * Handles both RSS 2.0 (<item>) and Atom (<entry>) feeds.
 */
function getText(parent: Element, ...selectors: string[]): string {
  for (const sel of selectors) {
    const el = parent.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return "";
}

/**
 * Extract an attribute value from first matching element.
 */
function getAttr(parent: Element, selector: string, attr: string): string {
  return parent.querySelector(selector)?.getAttribute(attr)?.trim() ?? "";
}

/**
 * Parse an RSS 2.0 or Atom feed XML string into RawFeedItems.
 * Returns [] on any parse error — never throws.
 */
function parseXml(
  xml:      string,
  sourceId: SourceId,
  limit:    number
): RawFeedItem[] {
  try {
    const parser = new DOMParser();
    const doc    = parser.parseFromString(xml, "text/xml");

    // Detect parse error (DOMParser signals this with a <parsererror> root)
    if (doc.querySelector("parsererror")) return [];

    // RSS 2.0: <item> elements
    // Atom:    <entry> elements
    const itemSelector = doc.querySelector("item") ? "item" : "entry";
    const items        = Array.from(doc.querySelectorAll(itemSelector)).slice(0, limit);

    return items.map((item): RawFeedItem => {
      // Title
      const title = getText(item, "title");

      // URL — RSS uses <link>, Atom uses <link href="...">
      const url =
        getText(item, "link") ||
        getAttr(item, "link[rel='alternate']", "href") ||
        getAttr(item, "link", "href");

      // Description / summary
      const description =
        getText(item, "description", "summary", "content\\:encoded", "content");

      // Author
      const author =
        getText(item, "author name", "author", "dc\\:creator", "creator");

      // Publication date
      const publishedAt =
        getText(item, "pubDate", "published", "updated", "dc\\:date");

      // Image — multiple common patterns
      const imageUrl =
        getAttr(item, "media\\:content", "url") ||
        getAttr(item, "media\\:thumbnail", "url") ||
        getAttr(item, "enclosure[type^='image']", "url") ||
        extractOgImage(description);

      // Tags
      const tags = Array.from(item.querySelectorAll("category"))
        .map((el) => el.textContent?.trim() ?? "")
        .filter(Boolean)
        .slice(0, 6);

      return {
        sourceId,
        title:       title.slice(0, 250),
        url:         url.split(/\s/)[0] ?? "",  // some feeds have spaces in URLs
        description: stripHtml(description).slice(0, 600),
        author:      author.slice(0, 100),
        imageUrl,
        publishedAt,
        tags,
      };
    }).filter((item) => item.title.length > 0 && item.url.length > 0);

  } catch {
    return [];
  }
}

/** Extract first <img src="..."> from HTML string — used for RSS items that embed images in description */
function extractOgImage(html: string): string {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? "";
}

/** Remove HTML tags from a string */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Single source fetcher ─────────────────────────────────────────────────────

async function fetchRssSource(
  sourceId:  SourceId,
  attempt = 0
): Promise<SourceFetchResult> {
  const config = SOURCE_REGISTRY[sourceId];
  const start  = Date.now();

  if (!config.endpoint) {
    return { sourceId, items: [], fetchedAt: new Date().toISOString(), durationMs: 0, fromCache: false, error: "No endpoint configured" };
  }

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(config.endpoint, {
      headers: {
        // Many RSS servers block requests with no User-Agent
        "User-Agent": "TechPulse/2.0 (+https://techpulse.ai/bot)",
        "Accept":     "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      // Retry once on server errors
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        await delay(600);
        return fetchRssSource(sourceId, attempt + 1);
      }
      return { sourceId, items: [], fetchedAt: new Date().toISOString(), durationMs: Date.now() - start, fromCache: false, error: `HTTP ${res.status}` };
    }

    const xml   = await res.text();
    const items = parseXml(xml, sourceId, config.maxArticlesPerFetch);

    return {
      sourceId,
      items,
      fetchedAt:  new Date().toISOString(),
      durationMs: Date.now() - start,
      fromCache:  false,
    };

  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === "AbortError";

    if (!isTimeout && attempt < MAX_RETRIES) {
      await delay(600);
      return fetchRssSource(sourceId, attempt + 1);
    }

    return {
      sourceId,
      items:      [],
      fetchedAt:  new Date().toISOString(),
      durationMs: Date.now() - start,
      fromCache:  false,
      error:      isTimeout ? `Timeout after ${FETCH_TIMEOUT_MS}ms` : String(err),
    };
  }
}

// ── Parallel multi-source fetch ───────────────────────────────────────────────

/**
 * Fetch all enabled RSS sources in parallel with SWR caching.
 * Returns one SourceFetchResult per source — failures included (not thrown).
 */
export async function fetchAllRss(): Promise<SourceFetchResult[]> {
  const rssSources = RSS_SOURCES.filter((s) => s.enabled);

  const results = await Promise.allSettled(
    rssSources.map(async (source): Promise<SourceFetchResult> => {
      const cacheKey = source.id;
      const cached   = sourceCache.get<SourceFetchResult>(cacheKey);

      if (cached && !cached.isStale) {
        return { ...cached.data, fromCache: true };
      }

      const result = await fetchRssSource(source.id);

      // Cache even on error (avoids hammering broken feeds on every request)
      if (!result.error || result.items.length > 0) {
        sourceCache.set(cacheKey, result, { ttl: source.cacheTtlSeconds });
      }

      return result;
    })
  );

  return results.map((r): SourceFetchResult => {
    if (r.status === "fulfilled") return r.value;
    return {
      sourceId:   "seed",
      items:      [],
      fetchedAt:  new Date().toISOString(),
      durationMs: 0,
      fromCache:  false,
      error:      r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}