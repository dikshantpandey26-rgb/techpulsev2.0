// =============================================================================
// src/services/seoService.ts
// Manages all SEO metadata: <title>, <meta>, OG, Twitter cards, JSON-LD.
// Works in Vite SPA mode; ready for SSR/Next.js migration.
// =============================================================================

import { APP_NAME, APP_DESCRIPTION, TWITTER_HANDLE } from "../config/constants";
import type { Article } from "../types";

interface MetaConfig {
  title:       string;
  description: string;
  url:         string;
  image?:      string;
  type?:       string;
}

// ── Core meta setter ──────────────────────────────────────────────────────────

function setMeta(name: string, content: string, attr: "name" | "property" = "name"): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(url: string): void {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="canonical"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

function setJsonLd(data: Record<string, unknown>): void {
  const id = "tp-json-ld";
  let el   = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el       = document.createElement("script");
    el.id    = id;
    el.type  = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

// ── Public API ────────────────────────────────────────────────────────────────

export const seo = {
  /** Set homepage metadata */
  setHome(): void {
    const origin = window.location.origin;
    document.title = `${APP_NAME} — ${APP_DESCRIPTION.split(".")[0]}`;

    setMeta("description", APP_DESCRIPTION);
    setMeta("og:title",       `${APP_NAME} — AI-Powered Tech News`, "property");
    setMeta("og:description", APP_DESCRIPTION, "property");
    setMeta("og:type",        "website", "property");
    setMeta("og:url",         origin, "property");
    setMeta("og:image",       `${origin}/og-default.png`, "property");
    setMeta("twitter:card",        "summary_large_image");
    setMeta("twitter:site",        TWITTER_HANDLE);
    setMeta("twitter:title",       `${APP_NAME} — AI-Powered Tech News`);
    setMeta("twitter:description", APP_DESCRIPTION);
    setCanonical(origin);

    setJsonLd({
      "@context":   "https://schema.org",
      "@type":      "WebSite",
      name:         APP_NAME,
      url:          origin,
      description:  APP_DESCRIPTION,
      publisher: {
        "@type": "Organization",
        name:    APP_NAME,
        logo:    { "@type": "ImageObject", url: `${origin}/logo.png` },
      },
    });
  },

  /** Set article page metadata */
  setArticle(article: Article): void {
    const origin = window.location.origin;
    const url    = `${origin}/article/${article.slug}`;
    const image  = article.image || `${origin}/og-default.png`;

    document.title = `${article.title} — ${APP_NAME}`;

    const config: MetaConfig = { title: article.title, description: article.summary, url, image, type: "article" };

    setMeta("description",          config.description);
    setMeta("og:title",             config.title, "property");
    setMeta("og:description",       config.description, "property");
    setMeta("og:type",              config.type ?? "article", "property");
    setMeta("og:url",               config.url, "property");
    setMeta("og:image",             image, "property");
    setMeta("og:site_name",         APP_NAME, "property");
    setMeta(
        "article:published_time",
        article.publishedAt ?? new Date().toISOString(),
        "property"
      );
    setMeta("article:section",      article.category, "property");
    article.tags.forEach((tag) => setMeta("article:tag", tag, "property"));
    setMeta("twitter:card",         "summary_large_image");
    setMeta("twitter:site",         TWITTER_HANDLE);
    setMeta("twitter:creator",      TWITTER_HANDLE);
    setMeta("twitter:title",        config.title);
    setMeta("twitter:description",  config.description);
    setMeta("twitter:image",        image);
    setCanonical(url);

    setJsonLd({
      "@context":         "https://schema.org",
      "@type":            "NewsArticle",
      headline:           article.title,
      description:        article.summary,
      image:              [image],
      datePublished:      article.publishedAt,
      dateModified:       article.publishedAt,
      author:             [{ "@type": "Person", name: article.author }],
      publisher: {
        "@type": "Organization",
        name:    APP_NAME,
        logo:    { "@type": "ImageObject", url: `${origin}/logo.png` },
      },
      mainEntityOfPage:   { "@type": "WebPage", "@id": url },
      keywords:           article.tags.join(", "),
      articleSection:     article.category,
    });
  },

  /** Set category page metadata */
  setCategory(category: string): void {
    const origin = window.location.origin;
    const desc   = `Latest ${category} news, analysis and insights — powered by AI. Updated in real-time.`;
    document.title = `${category} News — ${APP_NAME}`;
    setMeta("description", desc);
    setMeta("og:title",       `${category} News — ${APP_NAME}`, "property");
    setMeta("og:description", desc, "property");
    setMeta("og:url",         `${origin}/${category.toLowerCase().replace(/ /g, "-")}`, "property");
    setCanonical(`${origin}/${category.toLowerCase().replace(/ /g, "-")}`);
  },
};