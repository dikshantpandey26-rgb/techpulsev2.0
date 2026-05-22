// src/hooks/index.ts — All custom hooks

import { useState, useEffect, useRef, RefObject, useCallback } from "react";

export function useTypewriter(text: string, speed = 12): string {
  const [displayed, setDisplayed] = useState<string>("");
  useEffect(() => {
    setDisplayed("");
    if (!text) return;
    let i = 0;
    const id = setInterval(() => { setDisplayed(text.slice(0, ++i)); if (i >= text.length) clearInterval(id); }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return displayed;
}

export function useScrollProgress(): number {
  const [progress, setProgress] = useState<number>(0);
  useEffect(() => {
    const handler = (): void => {
      const el = document.documentElement;
      const scrollable = el.scrollHeight - el.clientHeight;
      if (scrollable === 0) return;
      setProgress(Math.round((el.scrollTop / scrollable) * 100));
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return progress;
}

export function useVisible(ref: RefObject<HTMLElement | null>, threshold = 0.1): boolean {
  const [visible, setVisible] = useState<boolean>(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return visible;
}

export function useVisibleRef(): [RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const visible = useVisible(ref);
  return [ref, visible];
}

export function useInfiniteScroll(onLoadMore: () => void, hasMore: boolean): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && hasMore) onLoadMore(); }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore]);
  return ref;
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (v: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try { const item = window.localStorage.getItem(key); return item ? (JSON.parse(item) as T) : initialValue; }
    catch { return initialValue; }
  });
  const setValue = useCallback((value: T) => {
    try { setStoredValue(value); window.localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* non-fatal */ }
  }, [key]);
  return [storedValue, setValue];
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent): void => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export function useIsMobile(): boolean { return useMediaQuery("(max-width: 768px)"); }