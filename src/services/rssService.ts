// =============================================================================
// src/services/rssService.ts  (Phase 9 hardening — Edge-safe XML parsing)
//
// ROOT CAUSE ADDRESSED:
//   DOMParser is a browser DOM API. Vercel's Edge Runtime is a bare V8
//   isolate with NO DOM implementation — DOMParser is not guaranteed to
//   exist there. Previously, `new DOMParser()` failing would throw, get
//   silently caught by parseXml()'s catch-all, and return [] with zero
//   indication of why. Every RSS source would appear to "fetch successfully"
//   while parsing nothing.
//
// FIX:
//   1. Detect DOMParser availability ONCE at module load (DOMPARSER_AVAILABLE).
//   2. If available, use it exactly as before (zero behavior change for
//      environments where it works, e.g. local dev in a browser-like runtime).
//   3. If NOT available, fall back to a lightweight regex-based RSS/Atom
//      parser (parseXmlFallback) — no DOM dependency, Edge-safe, handles
//      CDATA sections, RSS 2.0 <item> and Atom <entry> formats.
//   4. Errors are no longer silently swallowed into an empty array without
//      a trace — diagnoseRssSource() (new) surfaces the exact failure point.
//
// Existing fetchAllRss() / fetchRssSource() keep their EXACT same exported
// signatures and behavior contract — this is a transparent internal fix,
// not a rewrite. New diagnostic functions are additive only.
// =============================================================================

import type { RawFeedItem, SourceFetchResult, SourceId } from "../types";
import { RSS_SOURCES, SOURCE_REGISTRY } from "./sourceRegistry";
import { sourceCache } from "./cacheService";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_RETRIES      = 1;

// ── Runtime capability detection ──────────────────────────────────────────────

/**
 * Detected once at module load. Vercel Edge Runtime does not expose DOMParser;
 * Node.js (api routes running in Node runtime) does not either by default;
 * only browser-like environments do. This flag drives which parser path
 * parseXml() takes — computed once, not per-call, for performance.
 */
export const DOMPARSER_AVAILABLE: boolean = typeof DOMParser !== "undefined";

// ── CDATA + entity helpers (shared by both parser paths) ──────────────────────

/** Strip a single CDATA wrapper if present, otherwise return the input unchanged. */
function unwrapCdata(text: string): string {
  const match = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(text);
  return match ? match[1]! : text;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&hellip;/g, "…");
}

/** Remove HTML tags from a string */
function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract first <img src="..."> from HTML string */
function extractOgImage(html: string): string {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? "";
}

// ── PATH A: DOMParser-based parsing (used when available) ────────────────────

function getText(parent: Element, ...selectors: string[]): string {
  for (const sel of selectors) {
    const el = parent.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return "";
}

function getAttr(parent: Element, selector: string, attr: string): string {
  return parent.querySelector(selector)?.getAttribute(attr)?.trim() ?? "";
}

function parseXmlWithDomParser(
  xml:      string,
  sourceId: SourceId,
  limit:    number
): RawFeedItem[] {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xml, "text/xml");

  if (doc.querySelector("parsererror")) return [];

  const itemSelector = doc.querySelector("item") ? "item" : "entry";
  const items        = Array.from(doc.querySelectorAll(itemSelector)).slice(0, limit);

  return items.map((item): RawFeedItem => {
    const title = getText(item, "title");
    const url =
      getText(item, "link") ||
      getAttr(item, "link[rel='alternate']", "href") ||
      getAttr(item, "link", "href");
    const description =
      getText(item, "description", "summary", "content\\:encoded", "content");
    const author =
      getText(item, "author name", "author", "dc\\:creator", "creator");
    const publishedAt =
      getText(item, "pubDate", "published", "updated", "dc\\:date");
    const imageUrl =
      getAttr(item, "media\\:content", "url") ||
      getAttr(item, "media\\:thumbnail", "url") ||
      getAttr(item, "enclosure[type^='image']", "url") ||
      extractOgImage(description);
    const tags = Array.from(item.querySelectorAll("category"))
      .map((el) => el.textContent?.trim() ?? "")
      .filter(Boolean)
      .slice(0, 6);

    return {
      sourceId,
      title:       title.slice(0, 250),
      url:         url.split(/\s/)[0] ?? "",
      description: stripHtml(description).slice(0, 600),
      author:      author.slice(0, 100),
      imageUrl,
      publishedAt,
      tags,
    };
  }).filter((item) => item.title.length > 0 && item.url.length > 0);
}

// ── PATH B: Regex-based fallback parser (Edge-safe, no DOM dependency) ───────
//
// This is NOT a general-purpose XML parser. It targets exactly the subset
// of RSS 2.0 / Atom structure needed to extract feed items: it splits the
// document into <item>/<entry> blocks, then runs small targeted regexes
// against each block for known tag patterns. This is intentionally narrow
// in scope — broad enough to cover every source in SOURCE_REGISTRY, not
// broad enough to handle arbitrary XML.

function extractTag(block: string, ...tagNames: string[]): string {
  for (const tag of tagNames) {
    // Escape special regex chars in tag name (handles "dc:creator", "content:encoded")
    const escaped = tag.replace(/[.*+?^${}()|[\]\\:]/g, "\\$&");
    const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i");
    const match = re.exec(block);
    if (match?.[1]?.trim()) {
      return decodeEntities(unwrapCdata(match[1].trim()));
    }
  }
  return "";
}

/**
 * Dedicated author extractor. Atom feeds nest the author name inside the
 * outer <author> tag: <author><name>X</name><email>...</email></author>.
 * A generic extractTag("author") returns the raw inner HTML including the
 * <name> tags verbatim — caught via real-sample testing during the Phase 9
 * RSS hardening pass. RSS feeds (flat <dc:creator>X</dc:creator>) are
 * unaffected and fall through to the plain-text path.
 */
function extractAuthor(block: string): string {
  const authorBlock = extractTag(block, "author");
  if (authorBlock) {
    const nameMatch = /<name[^>]*>([\s\S]*?)<\/name>/i.exec(authorBlock);
    if (nameMatch?.[1]?.trim()) {
      return decodeEntities(unwrapCdata(nameMatch[1].trim()));
    }
    const stripped = authorBlock.replace(/<[^>]+>/g, "").trim();
    if (stripped) return decodeEntities(stripped);
  }
  return extractTag(block, "dc:creator", "creator");
}

/** Extract href attribute from a self-closing or content-bearing <link> tag (Atom style) */
function extractLinkHref(block: string): string {
  // Atom: <link rel="alternate" href="..."/> — prefer rel="alternate", fall back to any href
  const altMatch = /<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i.exec(block);
  if (altMatch?.[1]) return altMatch[1];

  const anyHrefMatch = /<link[^>]+href=["']([^"']+)["']/i.exec(block);
  if (anyHrefMatch?.[1]) return anyHrefMatch[1];

  // RSS: <link>https://...</link> (plain text content)
  const plainMatch = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(block);
  if (plainMatch?.[1]?.trim()) return plainMatch[1].trim();

  return "";
}

/** Extract an attribute value from the first matching self-closing tag */
function extractAttr(block: string, tagPattern: string, attr: string): string {
  const re = new RegExp(`<${tagPattern}[^>]+${attr}=["']([^"']+)["']`, "i");
  return re.exec(block)?.[1] ?? "";
}

/**
 * Extract <category> tags, handling both real-world forms:
 *   RSS:  <category>Text</category>            (content-bearing, no attr)
 *   Atom: <category term="Text"/>              (self-closing, term attribute)
 *   Atom: <category term="Text"></category>    (term attribute + empty body)
 *
 * The original single-regex version required a closing </category> tag,
 * which silently produced zero tags for self-closing Atom feeds — caught
 * via real-sample testing (martin-fowler's feed uses the self-closing form).
 */
function extractCategories(block: string): string[] {
  const tags: string[] = [];

  // Self-closing / term-attribute form (Atom) — checked first since it's
  // the more specific, more reliable signal when present.
  const selfClosingRe = /<category[^>]*\bterm=["']([^"']+)["'][^>]*\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = selfClosingRe.exec(block)) !== null && tags.length < 6) {
    if (match[1]?.trim()) tags.push(decodeEntities(match[1].trim()));
  }

  // Content-bearing form (RSS) — only attempted if no term-attribute tags found,
  // to avoid double-counting feeds that happen to use both conventions.
  if (tags.length === 0) {
    const contentRe = /<category(?![^>]*\bterm=)[^>]*>([\s\S]*?)<\/category>/gi;
    while ((match = contentRe.exec(block)) !== null && tags.length < 6) {
      const val = match[1]?.trim();
      if (val) tags.push(decodeEntities(unwrapCdata(val)));
    }
  }

  return tags;
}

function parseXmlFallback(
  xml:      string,
  sourceId: SourceId,
  limit:    number
): RawFeedItem[] {
  // Determine item delimiter: RSS uses <item>, Atom uses <entry>
  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const tagName = isAtom ? "entry" : "item";

  const blockRe = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(xml)) !== null && blocks.length < limit) {
    blocks.push(match[1] ?? "");
  }

  return blocks.map((block): RawFeedItem => {
    const title       = extractTag(block, "title");
    const url         = extractLinkHref(block);
    const description = extractTag(block, "description", "summary", "content:encoded", "content");
    const author      = extractAuthor(block);
    const publishedAt = extractTag(block, "pubDate", "published", "updated", "dc:date");

    const imageUrl =
      extractAttr(block, "media:content", "url") ||
      extractAttr(block, "media:thumbnail", "url") ||
      extractAttr(block, "enclosure", "url") ||
      extractOgImage(description);

    const tags = extractCategories(block);

    return {
      sourceId,
      title:       title.slice(0, 250),
      url:         url.trim().split(/\s/)[0] ?? "",
      description: stripHtml(description).slice(0, 600),
      author:      author.slice(0, 100),
      imageUrl,
      publishedAt,
      tags,
    };
  }).filter((item) => item.title.length > 0 && item.url.length > 0);
}

// ── Unified dispatcher ─────────────────────────────────────────────────────────

interface ParseOutcome {
  items:       RawFeedItem[];
  method:      "domparser" | "regex-fallback";
  parseError?: string;
}

/**
 * Parse an RSS 2.0 or Atom feed XML string into RawFeedItems.
 * Dispatches to DOMParser when available, otherwise the Edge-safe regex parser.
 * Never throws — returns an empty items array with parseError set on failure.
 */
function parseXml(xml: string, sourceId: SourceId, limit: number): ParseOutcome {
  if (DOMPARSER_AVAILABLE) {
    try {
      const items = parseXmlWithDomParser(xml, sourceId, limit);
      return { items, method: "domparser" };
    } catch (err) {
      // DOMParser exists but failed on this specific document — fall back
      try {
        const items = parseXmlFallback(xml, sourceId, limit);
        return { items, method: "regex-fallback", parseError: `DOMParser failed: ${String(err)}` };
      } catch (fallbackErr) {
        return { items: [], method: "regex-fallback", parseError: `Both parsers failed: ${String(fallbackErr)}` };
      }
    }
  }

  try {
    const items = parseXmlFallback(xml, sourceId, limit);
    return { items, method: "regex-fallback" };
  } catch (err) {
    return { items: [], method: "regex-fallback", parseError: String(err) };
  }
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
        "User-Agent": "TechPulse/2.0 (+https://techpulse.ai/bot)",
        "Accept":     "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        await delay(600);
        return fetchRssSource(sourceId, attempt + 1);
      }
      return { sourceId, items: [], fetchedAt: new Date().toISOString(), durationMs: Date.now() - start, fromCache: false, error: `HTTP ${res.status}` };
    }

    const xml      = await res.text();
    const outcome  = parseXml(xml, sourceId, config.maxArticlesPerFetch);

    return {
      sourceId,
      items:      outcome.items,
      fetchedAt:  new Date().toISOString(),
      durationMs: Date.now() - start,
      fromCache:  false,
      // Surface parse failures even when HTTP succeeded — previously invisible
      error:      outcome.parseError && outcome.items.length === 0 ? outcome.parseError : undefined,
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

// ── Parallel multi-source fetch (unchanged external contract) ────────────────

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

// ── DIAGNOSTIC API (Phase 9 addition — used by /api/debug/rss only) ──────────

export interface RssDiagnosticResult {
  sourceId:           SourceId;
  displayName:        string;
  rssUrl:              string;
  enabled:             boolean;
  fetchSuccess:        boolean;
  httpStatus:          number | null;
  xmlLength:           number;
  parseMethod:         "domparser" | "regex-fallback" | "not-attempted";
  parseSuccess:        boolean;
  parsedItemCount:     number;
  domParserAvailable:  boolean;
  durationMs:          number;
  error?:              string;
}

/**
 * Run a single, uncached, fully-instrumented fetch+parse for one RSS source.
 * Never touches sourceCache — always hits the network fresh.
 * Used exclusively by the /api/debug/rss diagnostic endpoint.
 */
export async function diagnoseRssSource(sourceId: SourceId): Promise<RssDiagnosticResult> {
  const config = SOURCE_REGISTRY[sourceId];
  const start  = Date.now();

  const base: Omit<RssDiagnosticResult, "fetchSuccess" | "httpStatus" | "xmlLength" | "parseMethod" | "parseSuccess" | "parsedItemCount" | "durationMs" | "error"> = {
    sourceId,
    displayName:        config.displayName,
    rssUrl:              config.endpoint ?? "",
    enabled:             config.enabled,
    domParserAvailable:  DOMPARSER_AVAILABLE,
  };

  if (!config.enabled) {
    return { ...base, fetchSuccess: false, httpStatus: null, xmlLength: 0, parseMethod: "not-attempted", parseSuccess: false, parsedItemCount: 0, durationMs: 0, error: "Source disabled in registry" };
  }
  if (config.transport !== "rss" || !config.endpoint) {
    return { ...base, fetchSuccess: false, httpStatus: null, xmlLength: 0, parseMethod: "not-attempted", parseSuccess: false, parsedItemCount: 0, durationMs: 0, error: "Not an RSS source" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(config.endpoint, {
      headers: {
        "User-Agent": "TechPulse/2.0 (+https://techpulse.ai/bot)",
        "Accept":     "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { ...base, fetchSuccess: false, httpStatus: res.status, xmlLength: 0, parseMethod: "not-attempted", parseSuccess: false, parsedItemCount: 0, durationMs: Date.now() - start, error: `HTTP ${res.status}` };
    }

    const xml = await res.text();
    const outcome = parseXml(xml, sourceId, config.maxArticlesPerFetch);

    return {
      ...base,
      fetchSuccess:    true,
      httpStatus:      res.status,
      xmlLength:       xml.length,
      parseMethod:     outcome.method,
      parseSuccess:    outcome.items.length > 0,
      parsedItemCount: outcome.items.length,
      durationMs:      Date.now() - start,
      error:           outcome.parseError,
    };

  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      ...base,
      fetchSuccess:    false,
      httpStatus:      null,
      xmlLength:       0,
      parseMethod:     "not-attempted",
      parseSuccess:    false,
      parsedItemCount: 0,
      durationMs:       Date.now() - start,
      error:            isTimeout ? `Timeout after ${FETCH_TIMEOUT_MS}ms` : String(err),
    };
  }
}

/**
 * Diagnose every enabled RSS source in parallel. Used by /api/debug/rss.
 */
export async function diagnoseAllRssSources(): Promise<RssDiagnosticResult[]> {
  const sources = RSS_SOURCES.filter((s) => s.enabled);
  const results = await Promise.allSettled(sources.map((s) => diagnoseRssSource(s.id)));

  return results.map((r, i): RssDiagnosticResult => {
    if (r.status === "fulfilled") return r.value;
    const source = sources[i]!;
    return {
      sourceId: source.id, displayName: source.displayName, rssUrl: source.endpoint ?? "",
      enabled: source.enabled, domParserAvailable: DOMPARSER_AVAILABLE,
      fetchSuccess: false, httpStatus: null, xmlLength: 0,
      parseMethod: "not-attempted", parseSuccess: false, parsedItemCount: 0,
      durationMs: 0, error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}