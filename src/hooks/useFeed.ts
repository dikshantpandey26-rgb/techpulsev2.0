// =============================================================================
// src/hooks/useFeed.ts
//
// Production-grade feed hook extracted from App.tsx.
// Adds cursor pagination, category-isolated sessions, and append-dedup
// on top of the hardened useLiveFeed foundation.
//
// ARCHITECTURE:
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CategorySession (one per category, module-level)                       │
// │   cursor:        last received cursor string                            │
// │   articles:      loaded article Set (id → Article, O(1) dedup)         │
// │   orderedIds:    stable insert-order array of IDs (preserves sort)      │
// │   hasMore:       server says more pages exist                           │
// │   feedVersion:   version of the feed snapshot these IDs belong to       │
// └─────────────────────────────────────────────────────────────────────────┘
//
// CURSOR STRATEGY:
//   The server produces opaque base64 cursors encoding {offset, lastScore,
//   lastPublishedAt, total}. The client treats them as opaque strings.
//   On feed version change (background revalidation produced new articles),
//   the client restarts pagination from page 1 of the new snapshot rather
//   than continuing with a stale cursor — preventing duplicate/skipped articles.
//
// APPEND DEDUP:
//   Each CategorySession keeps a Set<number> of loaded article IDs.
//   Before appending a new page, every article ID is checked against this
//   set — O(1) per article. Articles already loaded are silently dropped.
//   This handles the case where a background revalidation re-ranks articles
//   such that the next cursor page overlaps with the previous one.
//
// MEMORY BOUNDS:
//   Sessions are capped at MAX_CATEGORY_SESSIONS (currently 20).
//   Each session's orderedIds array is capped at MAX_ARTICLES_PER_SESSION (500).
//   Old sessions are evicted by insertion order when the cap is exceeded.
//
// REQUEST SAFETY:
//   Inherits the request-token strategy from the existing useLiveFeed pattern.
//   Each pagination request gets a token; only the latest token's response
//   may call setState or append to the session.
//
// BACKWARD COMPATIBILITY:
//   useLiveFeed (in App.tsx) is NOT touched — it remains the single-page
//   feed loader for the main feed view.
//   useFeed extends the architecture additively.
//   Both hooks share the module-level FEED_CACHE but do NOT share state.
// =============================================================================

import {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
  } from "react";
  import type { Article } from "../types";
  import { BASE_ARTICLES }      from "../data/articles";
  import { isCategoryMatch }    from "../utils/categoryUtils";
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────────────────────────────────────
  
  const PAGE_SIZE               = 15;
  const FETCH_TIMEOUT_MS        = 12_000;
  const POLL_INTERVAL_MS        = 10 * 60 * 1_000;
  const FOCUS_STALE_MS          = 5 * 60 * 1_000;
  const MAX_CATEGORY_SESSIONS   = 20;
  const MAX_ARTICLES_PER_SESSION = 500;
  const CACHE_TTL_MS            = POLL_INTERVAL_MS;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MODULE-LEVEL SHARED CACHE (shared with useLiveFeed in App.tsx)
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface CacheEntry {
    articles:     Article[];
    timestamp:    number;
    isLive:       boolean;
    nextCursor?:  string;
    feedVersion?: number;
  }
  
  // NOTE: This is a SEPARATE instance from the FEED_CACHE in App.tsx.
  // They serve different roles:
  //   App.tsx FEED_CACHE   → full article list cache for the main single-page feed
  //   PAGINATED_CACHE here → per-category page-1 cache for paginated infinite scroll
  const PAGINATED_CACHE = new Map<string, CacheEntry>();
  
  function getCached(key: string): CacheEntry | null {
    return PAGINATED_CACHE.get(key) ?? null;
  }
  
  function setCached(key: string, entry: CacheEntry): void {
    PAGINATED_CACHE.set(key, entry);
    if (PAGINATED_CACHE.size > MAX_CATEGORY_SESSIONS) {
      // Evict LRU: entry with oldest timestamp
      let oldestKey = "";
      let oldestTs  = Infinity;
      for (const [k, v] of PAGINATED_CACHE) {
        if (v.timestamp < oldestTs) { oldestTs = v.timestamp; oldestKey = k; }
      }
      if (oldestKey) PAGINATED_CACHE.delete(oldestKey);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CATEGORY SESSION REGISTRY
  // Module-level so sessions survive React re-renders and StrictMode double-invokes.
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface CategorySession {
    /** Opaque cursor from the last server response. Empty string = start from page 1. */
    cursor:       string;
    /** O(1) dedup set: article IDs already loaded in this session. */
    loadedIds:    Set<number>;
    /** Stable insertion-order article list. */
    articles:     Article[];
    hasMore:      boolean;
    feedVersion:  number;  // server feed version when this session started
    lastRefresh:  number;  // timestamp of last successful page fetch
  }
  
  const SESSIONS = new Map<string, CategorySession>();
  
  function getSession(category: string): CategorySession {
    const existing = SESSIONS.get(category);
    if (existing) return existing;
    const session: CategorySession = {
      cursor:      "",
      loadedIds:   new Set(),
      articles:    [],
      hasMore:     true,
      feedVersion: 0,
      lastRefresh: 0,
    };
    SESSIONS.set(category, session);
    return session;
  }
  
  function resetSession(category: string): CategorySession {
    const fresh: CategorySession = {
      cursor:      "",
      loadedIds:   new Set(),
      articles:    [],
      hasMore:     true,
      feedVersion: 0,
      lastRefresh: 0,
    };
    SESSIONS.set(category, fresh);
    // Evict old sessions
    if (SESSIONS.size > MAX_CATEGORY_SESSIONS) {
      const keys = Array.from(SESSIONS.keys());
      // Keep the current category, evict the oldest others
      for (const k of keys) {
        if (k !== category && SESSIONS.size > MAX_CATEGORY_SESSIONS) {
          SESSIONS.delete(k);
        }
      }
    }
    return fresh;
  }
  
  /** Append new articles to a session, deduplicating by ID in O(n_new). */
  function appendToSession(
    session:     CategorySession,
    newArticles: Article[],
    nextCursor:  string,
    hasMore:     boolean,
    feedVersion: number
  ): void {
    // Feed version mismatch → the server has a new snapshot; reset pagination
    if (session.feedVersion !== 0 && session.feedVersion !== feedVersion) {
      session.cursor      = "";
      session.loadedIds   = new Set();
      session.articles    = [];
    }
  
    session.feedVersion = feedVersion;
    session.cursor      = nextCursor;
    session.hasMore     = hasMore;
    session.lastRefresh = Date.now();
  
    let appended = 0;
    for (const article of newArticles) {
      if (session.loadedIds.has(article.id)) continue;         // O(1) dedup check
      if (session.articles.length >= MAX_ARTICLES_PER_SESSION) break; // memory cap
      session.loadedIds.add(article.id);
      session.articles.push(article);
      appended++;
    }
  
    if (import.meta.env.DEV) {
      console.info(
        `[Feed] Appended ${appended}/${newArticles.length} to "${session.cursor ? "page+" : "page1"}" ` +
        `session for category. Total: ${session.articles.length}. HasMore: ${hasMore}.`
      );
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // REQUEST COUNTER (shared global, same pattern as App.tsx)
  // ─────────────────────────────────────────────────────────────────────────────
  
  let paginationCounter = 0;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // API RESPONSE TYPES
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface FeedPageResponse {
    articles:    Article[];
    nextCursor?: string;
    hasMore:     boolean;
    total:       number;
    meta?: {
      version?:     number;
      fromCache?:   boolean;
      stale?:       boolean;
      requestId?:   string;
    };
    // Legacy fields (backward compat with old api/articles.ts shape)
    page?:  number;
    limit?: number;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HOOK PUBLIC INTERFACE
  // ─────────────────────────────────────────────────────────────────────────────
  
  export interface UseFeedState {
    articles:       Article[];
    loading:        boolean;
    loadingMore:    boolean;
    hasMore:        boolean;
    isLive:         boolean;
    lastUpdated:    Date | null;
    fetchNextPage:  () => void;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN HOOK
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Production feed hook with cursor pagination, category session isolation,
   * and append-dedup. Designed for infinite-scroll usage.
   *
   * @param category - Active category filter ("All" or a CategoryKey)
   * @param searchQuery - Active search string (disables pagination when set)
   */
  export function useFeed(
    category:    string,
    searchQuery: string
  ): UseFeedState {
    const session        = getSession(category);
    const [, forceRender] = useState<number>(0);
    const latestTokenRef  = useRef<number>(0);
    const inFlightRef     = useRef<boolean>(false);
    const [isLive, setIsLive]               = useState<boolean>(session.articles.length > 0);
    const [loading, setLoading]             = useState<boolean>(session.articles.length === 0);
    const [loadingMore, setLoadingMore]     = useState<boolean>(false);
    const [lastUpdated, setLastUpdated]     = useState<Date | null>(
      session.lastRefresh > 0 ? new Date(session.lastRefresh) : null
    );
  
    // ── Single page fetch ───────────────────────────────────────────────────────
    const fetchPage = useCallback(async (
      cursor:       string,
      isFirstPage:  boolean,
      isBackground: boolean
    ): Promise<void> => {
      if (inFlightRef.current && !isFirstPage) return; // prevent concurrent appends
      if (isBackground && Date.now() - session.lastRefresh < CACHE_TTL_MS) return;
  
      const token = ++paginationCounter;
      latestTokenRef.current = token;
      inFlightRef.current    = true;
  
      if (isFirstPage && !isBackground) setLoading(true);
      if (!isFirstPage)                 setLoadingMore(true);
  
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort("timeout"), FETCH_TIMEOUT_MS);
  
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
        });
        if (category && category !== "All") params.set("category", category);
        if (cursor) params.set("cursor", cursor);
  
        const res = await fetch(
          `${window.location.origin}/api/articles?${params.toString()}`,
          { signal: controller.signal, headers: { Accept: "application/json" } }
        );
  
        clearTimeout(timeoutId);
        if (token !== latestTokenRef.current) return; // superseded
  
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as FeedPageResponse;
        if (token !== latestTokenRef.current) return; // superseded after parse
  
        const newArticles  = data.articles ?? [];
        const nextCursor   = data.nextCursor ?? "";
        const hasMore      = data.hasMore ?? false;
        const feedVersion  = data.meta?.version ?? 1;
  
        if (isFirstPage && newArticles.length === 0 && session.articles.length > 0) {
          // Empty first page from API but we have cached data — don't blank the feed
          setLoading(false);
          return;
        }
  
        if (isFirstPage) {
          // Reset session for fresh first-page load
          const fresh = resetSession(category);
          appendToSession(fresh, newArticles, nextCursor, hasMore, feedVersion);
          setCached(category, {
            articles: fresh.articles,
            timestamp: Date.now(),
            isLive: true,
            nextCursor,
            feedVersion,
          });
        } else {
          // Append to existing session
          const current = getSession(category);
          appendToSession(current, newArticles, nextCursor, hasMore, feedVersion);
        }
  
        setIsLive(true);
        setLastUpdated(new Date());
        setLoading(false);
        setLoadingMore(false);
        forceRender((n) => n + 1); // signal that session.articles changed
  
      } catch (err) {
        clearTimeout(timeoutId);
        if (token !== latestTokenRef.current) return;
  
        const isAbort = err instanceof Error && err.name === "AbortError";
        if (!isAbort && import.meta.env.DEV) {
          console.warn(`[Feed] Page fetch error:`, err);
        }
  
        // On failure: show seed data if nothing loaded yet
        if (session.articles.length === 0) {
          const fresh = resetSession(category);
          const seeds = BASE_ARTICLES.filter(
            (a) => category === "All" || isCategoryMatch(a.category, category)
          );
          appendToSession(fresh, seeds, "", false, 0);
          forceRender((n) => n + 1);
        }
  
        setLoading(false);
        setLoadingMore(false);
      } finally {
        if (token === latestTokenRef.current) {
          inFlightRef.current = false;
        }
      }
    }, [category]); // eslint-disable-line react-hooks/exhaustive-deps
  
    // ── Initial load / category change ─────────────────────────────────────────
    useEffect(() => {
      const cached = getCached(category);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        // Warm cache hit: populate session from cache immediately
        const existing = getSession(category);
        if (existing.articles.length === 0) {
          appendToSession(existing, cached.articles, cached.nextCursor ?? "", true, cached.feedVersion ?? 1);
          forceRender((n) => n + 1);
          setLoading(false);
          setIsLive(cached.isLive);
          // Background revalidation
          void fetchPage("", true, true);
        }
        return;
      }
      // Cold start: fetch page 1
      void fetchPage("", true, false);
      return () => { latestTokenRef.current = ++paginationCounter; };
    }, [fetchPage, category]); // eslint-disable-line react-hooks/exhaustive-deps
  
    // ── Background poll ─────────────────────────────────────────────────────────
    useEffect(() => {
      const id = setInterval(() => void fetchPage("", true, true), POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [fetchPage]);
  
    // ── Tab focus refresh ───────────────────────────────────────────────────────
    useEffect(() => {
      const onFocus = (): void => {
        if (Date.now() - session.lastRefresh >= FOCUS_STALE_MS) {
          void fetchPage("", true, true);
        }
      };
      window.addEventListener("focus", onFocus);
      return () => window.removeEventListener("focus", onFocus);
    }, [fetchPage, session]);
  
    // ── fetchNextPage (called by infinite-scroll sentinel) ──────────────────────
    const fetchNextPage = useCallback((): void => {
      if (inFlightRef.current || !session.hasMore || loadingMore) return;
      void fetchPage(session.cursor, false, false);
    }, [fetchPage, session, loadingMore]);
  
    // ── Derive visible articles (search applies client-side over session data) ──
    const articles = useMemo<Article[]>(() => {
      const all = getSession(category).articles;
      if (!searchQuery) return all;
      const q = searchQuery.toLowerCase();
      return all.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q)) ||
          a.source.toLowerCase().includes(q)
      );
    }, [category, searchQuery, loading, loadingMore]); // eslint-disable-line react-hooks/exhaustive-deps
    // (forceRender is the real trigger; category/searchQuery for correctness)
  
    return {
      articles,
      loading,
      loadingMore,
      hasMore:    session.hasMore && !searchQuery,
      isLive,
      lastUpdated,
      fetchNextPage,
    };
  }