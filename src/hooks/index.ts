// ─────────────────────────────────────────────────────────────────────────────
// src/hooks/index.ts  — All custom hooks, fully typed
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, RefObject } from "react";

/** Animates text character-by-character. */
export function useTypewriter(text: string, speed = 12): string {
  const [displayed, setDisplayed] = useState<string>("");

  useEffect(() => {
    setDisplayed("");
    if (!text) return;

    let i = 0;
    const id = setInterval(() => {
      setDisplayed(text.slice(0, ++i));
      if (i >= text.length) clearInterval(id);
    }, speed);

    return () => clearInterval(id);
  }, [text, speed]);

  return displayed;
}

/** Returns 0–100 scroll progress percentage. */
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

/** Returns true once the referenced element enters the viewport. */
export function useVisible(
  ref: RefObject<HTMLElement | null>,
  threshold = 0.1
): boolean {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return visible;
}

/** Convenience wrapper: creates a ref and returns [ref, visible]. */
export function useVisibleRef(): [RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const visible = useVisible(ref);
  return [ref, visible];
}