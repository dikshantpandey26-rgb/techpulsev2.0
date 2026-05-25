// =============================================================================
// src/store/feedStore.ts — Zustand global state
// Replaces prop-drilling throughout the component tree.
// Persists bookmarks + theme to localStorage.
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Article, Theme, FeedFilters } from "../types";
import { ARTICLES_PER_PAGE } from "../config/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeedState {
  // Articles
  articles:       Article[];
  loading:        boolean;
  setArticles:    (a: Article[]) => void;
  setLoading:     (l: boolean) => void;

  // Selected article (modal)
  selected:       Article | null;
  setSelected:    (a: Article | null) => void;

  // Filters
  filters:        FeedFilters;
  setCategory:    (c: string) => void;
  setSearchQuery: (q: string) => void;
  nextPage:       () => void;
  resetPage:      () => void;

  // Theme (persisted)
  theme:          Theme;
  toggleTheme:    () => void;

  // Bookmarks (persisted)
  bookmarks:      number[];
  toggleBookmark: (id: number) => void;
  isBookmarked:   (id: number) => boolean;

  // Reading history (persisted)
  readHistory:    number[];
  markRead:       (id: number) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => ({
      // Articles
      articles:    [],
      loading:     true,
      setArticles: (articles) => set({ articles }),
      setLoading:  (loading)  => set({ loading }),

      // Modal
      selected:    null,
      setSelected: (selected) => set({ selected }),

      // Filters
      filters: { category: "All", searchQuery: "", page: 1 },

      setCategory: (category) =>
        set((s) => ({ filters: { ...s.filters, category, page: 1 } })),

      setSearchQuery: (searchQuery) =>
        set((s) => ({ filters: { ...s.filters, searchQuery, page: 1 } })),

      nextPage: () =>
        set((s) => ({ filters: { ...s.filters, page: s.filters.page + 1 } })),

      resetPage: () =>
        set((s) => ({ filters: { ...s.filters, page: 1 } })),

      // Theme
      theme:       "dark",
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      // Bookmarks
      bookmarks:      [],
      toggleBookmark: (id) =>
        set((s) => ({
          bookmarks: s.bookmarks.includes(id)
            ? s.bookmarks.filter((b) => b !== id)
            : [...s.bookmarks, id],
        })),
      isBookmarked: (id) => get().bookmarks.includes(id),

      // History
      readHistory: [],
      markRead:    (id) =>
        set((s) => ({
          readHistory: s.readHistory.includes(id)
            ? s.readHistory
            : [id, ...s.readHistory].slice(0, 100), // keep last 100
        })),
    }),
    {
      name:    "techpulse-store",
      storage: createJSONStorage(() => localStorage),
      // Only persist user preferences, not fetched data
      partialize: (s) => ({
        theme:       s.theme,
        bookmarks:   s.bookmarks,
        readHistory: s.readHistory,
      }),
    }
  )
);

// ── Derived selectors ─────────────────────────────────────────────────────────

export function useFilteredArticles(): Article[] {
  const { articles, filters } = useFeedStore();
  const { category, searchQuery, page } = filters;

  let list = articles;
  if (category !== "All") {
    list = list.filter((a) => a.category === category);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        a.source.toLowerCase().includes(q)
    );
  }
  return list.slice(0, page * ARTICLES_PER_PAGE);
}