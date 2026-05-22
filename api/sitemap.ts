// =============================================================================
// api/sitemap.ts — Dynamic sitemap.xml generator
// Fetches latest articles from Supabase and outputs valid sitemap XML.
// Submit to Google Search Console: https://yourdomain.com/api/sitemap
// =============================================================================

export const config = { runtime: "edge" };

const STATIC_PAGES = [
  { loc: "/",             priority: "1.0", changefreq: "hourly"  },
  { loc: "/ai",           priority: "0.9", changefreq: "hourly"  },
  { loc: "/startups",     priority: "0.9", changefreq: "hourly"  },
  { loc: "/cybersecurity",priority: "0.9", changefreq: "hourly"  },
  { loc: "/programming",  priority: "0.8", changefreq: "daily"   },
  { loc: "/space",        priority: "0.8", changefreq: "daily"   },
  { loc: "/gaming",       priority: "0.7", changefreq: "daily"   },
];

interface ArticleRow { slug: string; published_at: string; updated_at: string; }

async function fetchArticleSlugs(): Promise<ArticleRow[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const res  = await fetch(`${url}/rest/v1/articles?select=slug,published_at,updated_at&order=published_at.desc&limit=1000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return (await res.json()) as ArticleRow[];
  } catch { return []; }
}

export default async function handler(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const articles = await fetchArticleSlugs();

  const urls = [
    ...STATIC_PAGES.map((p) => `
  <url>
    <loc>${origin}${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`),
    ...articles.map((a: Article) => `
  <url>
    <loc>${origin}/article/${a.slug}</loc>
    <lastmod>${new Date(a.updated_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`),
  ].join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    status:  200,
    headers: {
      "Content-Type":  "application/xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}