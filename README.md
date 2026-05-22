# TechPulse — AI-Powered Tech News Aggregator

> Production-grade · Vite + React 18 + TypeScript strict mode · Vercel-ready

---

## 🗂 Folder Structure

```
techpulse/
├── src/
│   ├── types/
│   │   └── index.ts          # All shared TypeScript interfaces & types
│   ├── data/
│   │   ├── designSystem.ts   # Design tokens, CAT_META, PLATFORMS, getCatMeta()
│   │   └── articles.ts       # Seed articles (swap for live API in production)
│   ├── utils/
│   │   └── claude.ts         # Anthropic API helper (typed, error-safe)
│   ├── hooks/
│   │   └── index.ts          # useTypewriter, useScrollProgress, useVisible, useVisibleRef
│   ├── components/
│   │   ├── atoms.tsx          # SentimentBadge, Skeleton, ShareMenu, FallbackImg
│   │   ├── NewsCard.tsx       # Card variants: default | featured | compact
│   │   ├── BreakingTicker.tsx # Auto-cycling breaking news bar
│   │   ├── ArticleModal.tsx   # Full article view with AIPanel
│   │   ├── Sidebar.tsx        # TrendingWidget, StatsBar, CategoryBreakdown, ...
│   │   └── AIWidgets.tsx      # AISearchBar, DailyDigest, NewsletterCTA
│   ├── App.tsx                # Main shell — routing, filtering, layout
│   └── main.tsx               # React DOM entry point
├── index.html
├── vite.config.ts
├── tsconfig.json              # strict: true + skipLibCheck: true
├── tsconfig.node.json
├── vercel.json                # SPA rewrites + asset caching headers
├── package.json
├── .env.example
└── .gitignore
```

---

## ⚡ Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Copy env template
cp .env.example .env.local
# (no API key needed for local dev — AI features degrade gracefully)

# 3. Run dev server
npm run dev
# → http://localhost:5173

# 4. Type-check (mirrors Vercel build)
npx tsc --noEmit

# 5. Production build
npm run build
```

---

## 🚀 Deploy to Vercel

### Option A — Vercel CLI (recommended)

```bash
npm i -g vercel
vercel login
vercel --prod
```

### Option B — GitHub Integration

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Framework Preset: **Vite**
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Click **Deploy**

### Environment Variables on Vercel

In the Vercel dashboard → Settings → Environment Variables, add:

| Variable | Value | Environment |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Production, Preview |
| `VITE_NEWS_API_KEY` | your key | Production, Preview |
| `VITE_APP_URL` | `https://your-domain.vercel.app` | Production |

> ⚠️ **Security:** `VITE_` prefix exposes variables to the browser bundle.
> Move your Anthropic key behind a Vercel serverless function (`/api/ai.ts`) before going public.

---

## 🔒 TypeScript Fixes Applied

All 9 original Vercel build errors were resolved:

| Error | Fix Applied |
|---|---|
| `TS7006` — Parameter 'a' implicitly has 'any' | Added `Article[]` typed `.filter((a: Article) =>` via typed arrays |
| `TS7006` — Parameter 'q' implicitly has 'any' | `.filter()` callbacks typed via `Article[]` parameter |
| `TS2554` — Expected 1 argument, got 0 | `useVisible(ref)` signature updated; `useVisibleRef()` helper added |
| `TS2322` — `RefObject<T>` not assignable to `Ref` | All refs typed as `useRef<HTMLDivElement \| null>(null)` |
| `TS2345` — `{}` not assignable to `Element` | `IntersectionObserver` entry checked via `entry.isIntersecting` |
| `TS7053` — String can't index typed object | `CAT_META` typed as `Record<CategoryKey, CatMeta>`; `getCatMeta()` safe accessor added |
| `TS2322` — `RefObject` type mismatch (line 2558) | All component refs use `useRef<HTMLDivElement \| null>(null)` consistently |

---

## 🤖 AI Features

All AI features call the Anthropic API via the `/v1/messages` endpoint with the
`web_search_20250305` tool enabled:

- **AI Search** — Expert context for any tech topic
- **AI Daily Digest** — 5-sentence Bloomberg-style morning brief
- **AI Summary** — 3 key insights per article
- **Explain Simply** — ELI12 explanation with analogies
- **Market Take** — Bull/bear analysis with 90-day outlook
- **Text-to-Speech** — Browser native `SpeechSynthesis` API

---

## 🏗 Extending the Platform

### Add live NewsAPI feed

```ts
// src/data/articles.ts
export async function fetchLiveArticles(): Promise<Article[]> {
  const res = await fetch(
    `https://newsapi.org/v2/top-headlines?category=technology&apiKey=${import.meta.env.VITE_NEWS_API_KEY}`
  );
  const data = await res.json();
  return data.articles.map(normalizeNewsApiArticle);
}
```

### Add a Vercel serverless AI proxy

```ts
// api/ai.ts  (Vercel Edge Function)
export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const body = await req.json();
  const res  = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key":    process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  return new Response(res.body, { headers: { "Content-Type": "application/json" } });
}
```

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 5 |
| Language | TypeScript 5.5 (strict mode) |
| Styling | Inline CSS-in-JS with design tokens |
| Fonts | Fraunces · Cabinet Grotesk · IBM Plex Mono |
| AI | Anthropic Claude (claude-sonnet-4) |
| Deployment | Vercel |

---

© 2026 TechPulse · Powered by Claude