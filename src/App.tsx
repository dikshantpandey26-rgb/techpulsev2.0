import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM — Editorial Dark Luxury
// Fonts: Fraunces (display), Cabinet Grotesk (UI), IBM Plex Mono (mono/tags)
// Palette: Near-black · Warm ivory · Electric amber · Coral red
// ─────────────────────────────────────────────────────────────────────────────
const DS = {
  bg0: '#09090e',
  bg1: '#0f0f18',
  bg2: '#16161f',
  bg3: '#1e1e2a',
  bg4: '#252535',
  line: 'rgba(255,255,255,0.07)',
  line2: 'rgba(255,255,255,0.12)',
  text0: '#f5f0e8',
  text1: '#bfbba8',
  text2: '#7a7669',
  amber: '#f5a623',
  amberD: '#c4831a',
  coral: '#ff5c4d',
  coralD: '#cc3d31',
  cyan: '#00d4c8',
  violet: '#9b7fe8',
  green: '#2dbe8c',
  red: '#e84040',
};

const CAT_META = {
  AI: { color: '#00d4c8', emoji: '✦' },
  Startups: { color: '#f5a623', emoji: '⚡' },
  Cybersecurity: { color: '#e84040', emoji: '⚔' },
  Gadgets: { color: '#9b7fe8', emoji: '◈' },
  Programming: { color: '#2dbe8c', emoji: '⌥' },
  Space: { color: '#60a5fa', emoji: '◎' },
  Apple: { color: '#c8c8c8', emoji: '◆' },
  Android: { color: '#4ade80', emoji: '⬡' },
  Gaming: { color: '#fb923c', emoji: '▶' },
  'Cloud & DevOps': { color: '#38bdf8', emoji: '◻' },
  Science: { color: '#a78bfa', emoji: '⬡' },
  Crypto: { color: '#fbbf24', emoji: '◉' },
};

const CATEGORIES = ['All', ...Object.keys(CAT_META)];

const PLATFORMS = [
  {
    id: 'x',
    label: 'X',
    bg: '#000',
    icon: '𝕏',
    url: (u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
  },
  {
    id: 'li',
    label: 'LinkedIn',
    bg: '#0A66C2',
    icon: 'in',
    url: (u) => `https://linkedin.com/sharing/share-offsite/?url=${u}`,
  },
  {
    id: 'wa',
    label: 'WhatsApp',
    bg: '#25D366',
    icon: 'W',
    url: (u, t) => `https://wa.me/?text=${t}%20${u}`,
  },
  {
    id: 'tg',
    label: 'Telegram',
    bg: '#229ED9',
    icon: 'TG',
    url: (u, t) => `https://t.me/share/url?url=${u}&text=${t}`,
  },
  {
    id: 'fb',
    label: 'Facebook',
    bg: '#1877F2',
    icon: 'f',
    url: (u) => `https://facebook.com/sharer/sharer.php?u=${u}`,
  },
  {
    id: 'rd',
    label: 'Reddit',
    bg: '#FF4500',
    icon: 'R',
    url: (u, t) => `https://reddit.com/submit?url=${u}&title=${t}`,
  },
];

// ── Articles ──────────────────────────────────────────────────────────────────
const BASE_ARTICLES = [
  {
    id: 1,
    category: 'AI',
    title:
      'OpenAI Releases o4-Pro: First Model to Score 100% on GPQA Diamond Benchmark',
    summary:
      'The new flagship reasoning model achieves perfect scores on graduate-level scientific questions, surpassing PhD experts in biology, chemistry, and physics. OpenAI claims inference-time compute scaling alone drove the breakthrough, marking a new frontier in AI capabilities.',
    source: 'TechCrunch',
    author: 'Sarah Chen',
    time: '32m ago',
    readTime: '5 min',
    views: '48.2K',
    sentiment: 'bullish',
    hype: 94,
    trending: true,
    tags: ['OpenAI', 'LLM', 'Reasoning', 'AGI'],
    image:
      'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=85',
    url: 'https://techcrunch.com',
  },
  {
    id: 2,
    category: 'Cybersecurity',
    title:
      'Critical Zero-Day in OpenSSH Exposes 14M Enterprise Servers to Remote Root Access',
    summary:
      'A pre-authentication buffer overflow in sshd versions 8.5p1-9.8p1 enables unauthenticated remote code execution as root. CISA issues emergency directive; patch available in OpenSSH 9.9p1. System administrators urged to patch immediately.',
    source: 'Wired',
    author: 'Ivan Petrov',
    time: '1h ago',
    readTime: '6 min',
    views: '91.7K',
    sentiment: 'bearish',
    hype: 97,
    trending: true,
    breaking: true,
    tags: ['CVE', 'OpenSSH', 'RCE', 'CISA'],
    image:
      'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800&q=85',
    url: 'https://wired.com',
  },
  {
    id: 3,
    category: 'Startups',
    title:
      'Anduril Raises $1.5B Series F at $28B Valuation to Scale Autonomous Defense Systems',
    summary:
      'The defense-tech unicorn founded by Palmer Luckey will use the funds to mass-produce Ghost autonomous aircraft and expand its Lattice AI battlefield operating system across five NATO nations this year.',
    source: 'Bloomberg',
    author: 'Marcus Lee',
    time: '2h ago',
    readTime: '4 min',
    views: '32.1K',
    sentiment: 'bullish',
    hype: 78,
    tags: ['Defense', 'Funding', 'Autonomy', 'NATO'],
    image:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=85',
    url: 'https://bloomberg.com',
  },
  {
    id: 4,
    category: 'AI',
    title:
      "Google DeepMind's Gemini 3 Ultra Achieves Human-Level Performance on IQ Tests",
    summary:
      'DeepMind releases internal benchmarks showing Gemini 3 Ultra scoring 145 on standardized IQ assessments — higher than 99.85% of humans — while maintaining strong alignment properties verified by external auditors.',
    source: 'The Verge',
    author: 'Jordan Park',
    time: '3h ago',
    readTime: '7 min',
    views: '55.4K',
    sentiment: 'bullish',
    hype: 89,
    tags: ['Google', 'Gemini', 'Benchmark', 'DeepMind'],
    image:
      'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=85',
    url: 'https://theverge.com',
  },
  {
    id: 5,
    category: 'Gadgets',
    title:
      'Apple Vision Pro 3 Introduces Neural Band: Control Apps With Your Mind',
    summary:
      'The third-generation headset integrates a non-invasive neural interface wristband that reads motor cortex signals with 94% accuracy, enabling hands-free UI navigation without eye or voice input for the first time.',
    source: '9to5Mac',
    author: 'Tanisha Brooks',
    time: '4h ago',
    readTime: '5 min',
    views: '79.3K',
    sentiment: 'bullish',
    hype: 92,
    tags: ['Apple', 'VisionPro', 'BCI', 'XR'],
    image:
      'https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800&q=85',
    url: 'https://9to5mac.com',
  },
  {
    id: 6,
    category: 'Programming',
    title:
      'Rust 2.0 Eliminates Lifetime Annotations Through New ML Borrow Inference Engine',
    summary:
      "The biggest language revision in a decade ships with an ML-powered borrow checker that infers 98% of lifetime annotations automatically. Linus Torvalds calls it 'the update that makes Rust viable for all kernel subsystems'.",
    source: 'Hacker News',
    author: 'Dev Community',
    time: '5h ago',
    readTime: '8 min',
    views: '41.8K',
    sentiment: 'bullish',
    hype: 85,
    tags: ['Rust', 'Systems', 'Programming', 'Linux'],
    image:
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=85',
    url: 'https://news.ycombinator.com',
  },
  {
    id: 7,
    category: 'Space',
    title:
      'SpaceX Starship Flight 12 Achieves Full Orbital Insertion and Pacific Landing',
    summary:
      'After eleven test flights, Starship becomes the first vehicle to reach orbit, complete a full trip around Earth, and land propulsively in the Pacific Ocean. Elon Musk announces the crewed Mars mission window for 2027.',
    source: 'Space.com',
    author: 'Elena Vasquez',
    time: '6h ago',
    readTime: '6 min',
    views: '112K',
    sentiment: 'bullish',
    hype: 96,
    trending: true,
    tags: ['SpaceX', 'Starship', 'Mars', 'Orbital'],
    image:
      'https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=800&q=85',
    url: 'https://space.com',
  },
  {
    id: 8,
    category: 'Cloud & DevOps',
    title:
      'AWS Graviton 5 Delivers 3.8x Faster LLM Inference at 45% Lower Cost Per Token',
    summary:
      "Amazon's latest ARM chip, manufactured on TSMC's N2 process, benchmarks at 3.8x faster token generation versus Graviton 4. EC2 instances available in all 32 AWS regions starting today with spot pricing.",
    source: 'AWS Blog',
    author: 'Werner Vogels',
    time: '7h ago',
    readTime: '4 min',
    views: '28.6K',
    sentiment: 'bullish',
    hype: 72,
    tags: ['AWS', 'ARM', 'Cloud', 'Inference'],
    image:
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=85',
    url: 'https://aws.amazon.com',
  },
  {
    id: 9,
    category: 'Gaming',
    title:
      'NVIDIA RTX 6090: 24 TFLOPS FP64, Real-Time Path Tracing at 8K 120fps Stable',
    summary:
      'The Blackwell Ultra flagship GPU features 96GB GDDR7 and a dedicated Neural Rendering Engine for AI-reconstructed geometry. Cyberpunk 2077 at 8K native with full path tracing now runs at 120fps stable on a single card.',
    source: 'Digital Foundry',
    author: 'Alex Mercer',
    time: '8h ago',
    readTime: '5 min',
    views: '63.2K',
    sentiment: 'bullish',
    hype: 88,
    tags: ['NVIDIA', 'RTX', 'GPU', 'Gaming'],
    image:
      'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=85',
    url: 'https://digitalfoundry.net',
  },
  {
    id: 10,
    category: 'Science',
    title:
      'MIT Researchers Develop Room-Temperature Superconductor Stable at Ambient Pressure',
    summary:
      'A copper-doped bismuth selenide compound superconducts at 24 degrees Celsius and standard atmospheric pressure — conditions achievable anywhere on Earth. Independent replication confirmed in Geneva and Tokyo.',
    source: 'Nature',
    author: 'Dr. Kim Yoon',
    time: '9h ago',
    readTime: '10 min',
    views: '204K',
    sentiment: 'bullish',
    hype: 99,
    trending: true,
    tags: ['Superconductor', 'Physics', 'MIT', 'Breakthrough'],
    image:
      'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=800&q=85',
    url: 'https://nature.com',
  },
  {
    id: 11,
    category: 'Crypto',
    title:
      "Ethereum Completes 'Surge' Upgrade: 100,000 TPS With Full Decentralization Maintained",
    summary:
      'The long-awaited Layer-1 scaling milestone delivers 100K TPS via danksharding and PeerDAS, maintaining the same trust assumptions as the base chain. Gas fees on L2s drop to under $0.0001 per transaction.',
    source: 'CoinDesk',
    author: 'Rachel Simmons',
    time: '10h ago',
    readTime: '5 min',
    views: '87.4K',
    sentiment: 'bullish',
    hype: 91,
    tags: ['Ethereum', 'Scaling', 'DeFi', 'Crypto'],
    image:
      'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=85',
    url: 'https://coindesk.com',
  },
  {
    id: 12,
    category: 'Startups',
    title:
      'Y Combinator W26 Demo Day: 15 Fusion Companies, $2B in First-Day Commitments',
    summary:
      "The winter batch featured an unprecedented cluster of nuclear fusion startups using AI-designed plasma containment geometries. Total first-day commitments broke YC's single-session funding record set in 2021.",
    source: 'TechCrunch',
    author: 'Priya Nair',
    time: '11h ago',
    readTime: '7 min',
    views: '36.8K',
    sentiment: 'bullish',
    hype: 81,
    tags: ['YC', 'Fusion', 'CleanEnergy', 'Fundraising'],
    image:
      'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=85',
    url: 'https://techcrunch.com',
  },
  {
    id: 13,
    category: 'Android',
    title:
      'Android 17 Ships AI Runtime: Install Any App by Describing It in Natural Language',
    summary:
      "Google's next major release replaces the APK install model with an on-device AI runtime that generates, signs, and runs app experiences from a text description in under 3 seconds using Gemini Nano on-device.",
    source: 'Android Authority',
    author: 'James Park',
    time: '12h ago',
    readTime: '6 min',
    views: '71.2K',
    sentiment: 'bullish',
    hype: 87,
    tags: ['Android', 'Google', 'AI', 'Mobile'],
    image:
      'https://images.unsplash.com/photo-1607252650355-f7fd0460ccdb?w=800&q=85',
    url: 'https://androidauthority.com',
  },
  {
    id: 14,
    category: 'Apple',
    title:
      'macOS Tahoe: Sherlock AI Agent Replaces Spotlight With Fully Autonomous Task Execution',
    summary:
      "Apple's new OS ships with a fully integrated AI agent that executes multi-step tasks across apps, manages files intelligently, and writes and runs code in a sandboxed environment — entirely on-device with M4 Ultra.",
    source: 'MacRumors',
    author: 'Lisa Wong',
    time: '13h ago',
    readTime: '5 min',
    views: '58.9K',
    sentiment: 'bullish',
    hype: 86,
    tags: ['Apple', 'macOS', 'AI', 'Sherlock'],
    image:
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=85',
    url: 'https://macrumors.com',
  },
  {
    id: 15,
    category: 'AI',
    title:
      "Meta's Llama 5 405B Tops Every Open-Source Benchmark, Matches GPT-4o on Most Tasks",
    summary:
      'Released under a commercial-friendly license, the 405B parameter model achieves state-of-the-art results on MMLU, HumanEval, and GSM8K while running on a single 8xH100 node. Fine-tuning cookbooks published simultaneously.',
    source: 'Ars Technica',
    author: 'Timothy Chen',
    time: '14h ago',
    readTime: '6 min',
    views: '43.1K',
    sentiment: 'bullish',
    hype: 88,
    tags: ['Meta', 'Llama', 'OpenSource', 'LLM'],
    image:
      'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=85',
    url: 'https://arstechnica.com',
  },
];

// ── Claude API ────────────────────────────────────────────────────────────────
async function callClaude(messages, system = '', maxTokens = 800) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    }),
  });
  const data = await res.json();
  return (
    data.content
      ?.filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n') || ''
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useTypewriter(text, speed = 12) {
  const [disp, setDisp] = useState('');
  useEffect(() => {
    setDisp('');
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      setDisp(text.slice(0, ++i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text]);
  return disp;
}

function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const h = () => {
      const el = document.documentElement;
      setP(
        Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100)
      );
    };
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return p;
}

function useVisible(ref, threshold = 0.1) {
  const [v, setV] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const o = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setV(true);
      },
      { threshold }
    );
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return v;
}

// ── Share Menu ────────────────────────────────────────────────────────────────
function ShareMenu({ article, onClose }) {
  const [copied, setCopied] = useState(false);
  const url = encodeURIComponent(`https://techpulse.ai/a/${article.id}`);
  const title = encodeURIComponent(article.title);
  const copy = () => {
    navigator.clipboard?.writeText(`https://techpulse.ai/a/${article.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        right: 0,
        zIndex: 200,
        background: DS.bg3,
        border: `1px solid ${DS.line2}`,
        borderRadius: 14,
        padding: '14px 16px',
        minWidth: 240,
        boxShadow: '0 24px 56px rgba(0,0,0,.75)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 10,
            color: DS.text2,
            letterSpacing: 1.5,
          }}
        >
          SHARE ARTICLE
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: DS.text2,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {PLATFORMS.map((p) => (
          <a
            key={p.id}
            href={p.url(url, title)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 11px',
              borderRadius: 8,
              background: p.bg,
              color: '#fff',
              textDecoration: 'none',
              fontFamily: "'Cabinet Grotesk',sans-serif",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <span style={{ fontSize: 11 }}>{p.icon}</span>
            {p.label}
          </a>
        ))}
        <button
          onClick={copy}
          style={{
            padding: '6px 11px',
            borderRadius: 8,
            background: copied ? DS.green : DS.bg4,
            border: `1px solid ${DS.line2}`,
            color: copied ? '#000' : DS.text1,
            fontFamily: "'Cabinet Grotesk',sans-serif",
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {copied ? '✓ Copied' : '⧉ Copy Link'}
        </button>
      </div>
    </div>
  );
}

// ── Sentiment badge ───────────────────────────────────────────────────────────
function SentimentBadge({ sentiment, hype }) {
  const c =
    sentiment === 'bullish'
      ? DS.green
      : sentiment === 'bearish'
      ? DS.red
      : DS.amber;
  const label =
    sentiment === 'bullish'
      ? '↑ Bullish'
      : sentiment === 'bearish'
      ? '↓ Bearish'
      : '→ Neutral';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: 9.5,
        color: c,
        background: `${c}18`,
        padding: '3px 9px',
        borderRadius: 100,
        border: `1px solid ${c}30`,
      }}
    >
      {label}
      <span style={{ color: DS.text2, fontSize: 9 }}>·</span>
      <span style={{ color: DS.amber, fontSize: 9 }}>🔥{hype}</span>
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div
      style={{
        background: DS.bg2,
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${DS.line}`,
      }}
    >
      <div
        style={{
          height: 190,
          background: DS.bg3,
          animation: 'shimmer 1.6s ease-in-out infinite',
        }}
      />
      <div style={{ padding: 18 }}>
        {[90, 72, 58, 42].map((w, i) => (
          <div
            key={i}
            style={{
              height: 10,
              background: DS.bg3,
              borderRadius: 5,
              marginBottom: 9,
              width: `${w}%`,
              animation: 'shimmer 1.6s ease-in-out infinite',
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── News Card ─────────────────────────────────────────────────────────────────
function NewsCard({ article, onClick, variant = 'default', delay = 0 }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef();
  const visible = useVisible(ref);
  const cat = CAT_META[article.category] || { color: DS.amber, emoji: '◆' };
  const featured = variant === 'featured';
  const compact = variant === 'compact';

  return (
    <div
      ref={ref}
      onClick={() => onClick(article)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? DS.bg2 : DS.bg1,
        border: `1px solid ${hovered ? DS.line2 : DS.line}`,
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all .25s cubic-bezier(.4,0,.2,1)',
        transform: hovered
          ? 'translateY(-3px)'
          : visible
          ? 'translateY(0)'
          : 'translateY(22px)',
        opacity: visible ? 1 : 0,
        transitionDelay: `${delay}ms`,
        boxShadow: hovered
          ? `0 16px 40px rgba(0,0,0,.5), 0 0 0 1px ${cat.color}20`
          : 'none',
        ...(featured ? { gridColumn: 'span 2' } : {}),
      }}
    >
      {article.breaking && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg,${DS.red},${DS.coral})`,
            zIndex: 5,
          }}
        />
      )}
      {!compact && (
        <div
          style={{
            position: 'relative',
            height: featured ? 320 : 195,
            overflow: 'hidden',
          }}
        >
          <img
            src={article.image}
            alt={article.title}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform .5s',
              transform: hovered ? 'scale(1.05)' : 'scale(1)',
            }}
            onError={(e) => {
              e.target.src =
                'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80';
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to top, ${DS.bg1} 0%, transparent 55%)`,
            }}
          />
          <span
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              background: cat.color,
              color: '#000',
              padding: '3px 10px',
              borderRadius: 100,
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {cat.emoji} {article.category.toUpperCase()}
          </span>
          {article.trending && (
            <span
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: `${DS.amber}20`,
                border: `1px solid ${DS.amber}50`,
                color: DS.amber,
                padding: '3px 9px',
                borderRadius: 100,
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 9,
                letterSpacing: 0.5,
              }}
            >
              🔥 TRENDING
            </span>
          )}
        </div>
      )}
      <div
        style={{
          padding: featured
            ? '22px 26px 26px'
            : compact
            ? '14px 16px'
            : '16px 18px 18px',
        }}
      >
        {compact && (
          <span
            style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 9,
              color: cat.color,
              letterSpacing: 0.5,
              display: 'block',
              marginBottom: 5,
            }}
          >
            {cat.emoji} {article.category.toUpperCase()}
          </span>
        )}
        <h3
          style={{
            fontFamily: "'Fraunces',serif",
            fontSize: featured ? 23 : compact ? 14 : 16,
            fontWeight: featured ? 800 : 700,
            color: DS.text0,
            lineHeight: 1.32,
            margin: '0 0 8px',
            display: compact ? '-webkit-box' : 'block',
            WebkitLineClamp: compact ? 2 : undefined,
            WebkitBoxOrient: compact ? 'vertical' : undefined,
            overflow: compact ? 'hidden' : undefined,
          }}
        >
          {article.title}
        </h3>
        {!compact && (
          <p
            style={{
              fontFamily: "'Cabinet Grotesk',sans-serif",
              fontSize: featured ? 15 : 13,
              color: DS.text1,
              lineHeight: 1.65,
              margin: '0 0 13px',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {article.summary}
          </p>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              flexWrap: 'wrap',
            }}
          >
            <SentimentBadge sentiment={article.sentiment} hype={article.hype} />
            <span
              style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 9.5,
                color: cat.color,
                fontWeight: 700,
              }}
            >
              {article.source}
            </span>
            <span style={{ color: DS.text2, fontSize: 10 }}>·</span>
            <span
              style={{
                fontFamily: "'Cabinet Grotesk',sans-serif",
                fontSize: 11,
                color: DS.text2,
              }}
            >
              {article.time}
            </span>
            <span style={{ color: DS.text2, fontSize: 10 }}>·</span>
            <span
              style={{
                fontFamily: "'Cabinet Grotesk',sans-serif",
                fontSize: 11,
                color: DS.text2,
              }}
            >
              ⏱ {article.readTime}
            </span>
            <span style={{ color: DS.text2, fontSize: 10 }}>·</span>
            <span
              style={{
                fontFamily: "'Cabinet Grotesk',sans-serif",
                fontSize: 11,
                color: DS.text2,
              }}
            >
              👁 {article.views}
            </span>
          </div>
          <div
            style={{ display: 'flex', gap: 5, position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setBookmarked(!bookmarked)}
              style={{
                background: bookmarked
                  ? `${DS.cyan}20`
                  : 'rgba(255,255,255,.05)',
                border: `1px solid ${bookmarked ? DS.cyan + '40' : DS.line}`,
                borderRadius: 8,
                width: 30,
                height: 30,
                cursor: 'pointer',
                color: bookmarked ? DS.cyan : DS.text2,
                fontSize: 13,
                transition: 'all .2s',
              }}
            >
              {bookmarked ? '🔖' : '⊕'}
            </button>
            <button
              onClick={() => setSharing(!sharing)}
              style={{
                background: 'rgba(255,255,255,.05)',
                border: `1px solid ${DS.line}`,
                borderRadius: 8,
                width: 30,
                height: 30,
                cursor: 'pointer',
                color: DS.text2,
                fontSize: 13,
              }}
            >
              ↗
            </button>
            {sharing && (
              <ShareMenu article={article} onClose={() => setSharing(false)} />
            )}
          </div>
        </div>
        <div
          style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}
        >
          {article.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 9,
                color: DS.text2,
                background: 'rgba(255,255,255,.05)',
                padding: '2px 8px',
                borderRadius: 100,
                letterSpacing: 0.3,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Breaking Ticker ───────────────────────────────────────────────────────────
function BreakingTicker({ articles }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(
      () => setIdx((i) => (i + 1) % articles.length),
      4200
    );
    return () => clearInterval(id);
  }, [paused, articles.length]);
  const a = articles[idx] || articles[0];
  return (
    <div
      style={{
        background: `linear-gradient(90deg,${DS.red}cc,${DS.coral}cc)`,
        backdropFilter: 'blur(8px)',
        padding: '7px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: 2,
          whiteSpace: 'nowrap',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      >
        ● BREAKING
      </span>
      <span
        style={{ width: 1, height: 14, background: 'rgba(255,255,255,.3)' }}
      />
      <span
        style={{
          fontFamily: "'Cabinet Grotesk',sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: '#fff',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {a.title}
      </span>
      <span
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 10,
          color: 'rgba(255,255,255,.65)',
          whiteSpace: 'nowrap',
        }}
      >
        {a.source} · {a.time}
      </span>
      <div style={{ display: 'flex', gap: 5 }}>
        {articles.map((_, i) => (
          <span
            key={i}
            onClick={() => setIdx(i)}
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: i === idx ? '#fff' : 'rgba(255,255,255,.3)',
              cursor: 'pointer',
              transition: 'background .3s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── AI Panel ──────────────────────────────────────────────────────────────────
function AIPanel({ article }) {
  const [mode, setMode] = useState(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const typed = useTypewriter(result);

  const run = async (m) => {
    if (loading) return;
    setMode(m);
    setResult('');
    setLoading(true);
    const prompts = {
      summary: `Tech article analysis:\n"${article.title}" — ${article.summary}\n\nProvide:\n• 3 key insights (start each with •)\n• Why this matters for the industry (2 sentences)\n• What to watch next (1 sentence)`,
      eli5: `Explain this tech news to a curious 12-year-old using simple analogies and 3 short paragraphs:\n"${article.title}" — ${article.summary}`,
      market: `Market/industry sentiment analysis of this tech news:\n"${article.title}" — ${article.summary}\n\nProvide: bull/bear signals, who wins, who loses, competitive impact, 90-day outlook. Use clear headers.`,
    };
    try {
      const r = await callClaude(
        [{ role: 'user', content: prompts[m] }],
        'You are a senior tech analyst at a top-tier research firm. Be sharp, specific, and insightful. No generic statements.',
        700
      );
      setResult(r);
    } catch {
      setResult(
        '• AI analysis temporarily unavailable.\n• Please try again in a moment.'
      );
    }
    setLoading(false);
  };

  const btns = [
    { id: 'summary', label: '✦ AI Summary', color: DS.cyan },
    { id: 'eli5', label: '⬡ Explain Simply', color: DS.violet },
    { id: 'market', label: '◈ Market Take', color: DS.amber },
  ];

  return (
    <div
      style={{
        background: `${DS.cyan}08`,
        border: `1px solid ${DS.cyan}20`,
        borderRadius: 14,
        padding: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
        }}
      >
        <span style={{ color: DS.cyan, fontSize: 16 }}>✦</span>
        <span
          style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 10,
            color: DS.cyan,
            letterSpacing: 1.5,
          }}
        >
          AI INTELLIGENCE
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 7,
          flexWrap: 'wrap',
          marginBottom: result ? 16 : 0,
        }}
      >
        {btns.map((b) => (
          <button
            key={b.id}
            onClick={() => run(b.id)}
            disabled={loading}
            style={{
              padding: '7px 14px',
              borderRadius: 9,
              border: `1px solid ${mode === b.id ? b.color : DS.line2}`,
              background: mode === b.id ? `${b.color}18` : 'transparent',
              color: mode === b.id ? b.color : DS.text1,
              fontFamily: "'Cabinet Grotesk',sans-serif",
              fontSize: 12,
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              transition: 'all .2s',
            }}
          >
            {loading && mode === b.id ? 'Analyzing…' : b.label}
          </button>
        ))}
      </div>
      {result && (
        <div
          style={{
            fontFamily: "'Cabinet Grotesk',sans-serif",
            fontSize: 14,
            color: DS.text1,
            lineHeight: 1.8,
            whiteSpace: 'pre-line',
            paddingTop: 14,
            borderTop: `1px solid ${DS.line}`,
          }}
        >
          {typed}
        </div>
      )}
    </div>
  );
}

// ── Article Modal ─────────────────────────────────────────────────────────────
function ArticleModal({ article, onClose, allArticles }) {
  const [tts, setTts] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cat = CAT_META[article.category] || { color: DS.amber, emoji: '◆' };
  const related = allArticles
    .filter(
      (a) =>
        a.id !== article.id &&
        (a.category === article.category ||
          a.tags.some((t) => article.tags.includes(t)))
    )
    .slice(0, 3);

  const speak = () => {
    if (tts) {
      window.speechSynthesis.cancel();
      setTts(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(
      `${article.title}. ${article.summary}`
    );
    u.rate = 0.92;
    u.pitch = 1.02;
    u.onend = () => setTts(false);
    window.speechSynthesis.speak(u);
    setTts(true);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.9)',
          backdropFilter: 'blur(16px)',
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: DS.bg1,
          border: `1px solid ${DS.line2}`,
          borderRadius: 20,
          maxWidth: 760,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          zIndex: 1,
          animation: 'slideUp .3s cubic-bezier(.4,0,.2,1)',
        }}
      >
        <div style={{ position: 'relative', height: 300 }}>
          <img
            src={article.image}
            alt={article.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '20px 20px 0 0',
            }}
            onError={(e) => {
              e.target.src =
                'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80';
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to top, ${DS.bg1} 0%, transparent 55%)`,
              borderRadius: '20px 20px 0 0',
            }}
          />
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'rgba(0,0,0,.6)',
              border: `1px solid ${DS.line2}`,
              borderRadius: '50%',
              width: 36,
              height: 36,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
          <span
            style={{
              position: 'absolute',
              bottom: 20,
              left: 24,
              background: cat.color,
              color: '#000',
              padding: '4px 12px',
              borderRadius: 100,
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {cat.emoji} {article.category.toUpperCase()}
          </span>
        </div>
        <div style={{ padding: '4px 28px 32px' }}>
          <h1
            style={{
              fontFamily: "'Fraunces',serif",
              fontSize: 27,
              fontWeight: 800,
              color: DS.text0,
              lineHeight: 1.28,
              margin: '20px 0 14px',
            }}
          >
            {article.title}
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
              flexWrap: 'wrap',
            }}
          >
            <SentimentBadge sentiment={article.sentiment} hype={article.hype} />
            <span
              style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 10,
                color: cat.color,
                fontWeight: 700,
              }}
            >
              {article.source}
            </span>
            <span style={{ color: DS.text2 }}>·</span>
            <span
              style={{
                fontFamily: "'Cabinet Grotesk',sans-serif",
                fontSize: 12,
                color: DS.text2,
              }}
            >
              by {article.author}
            </span>
            <span style={{ color: DS.text2 }}>·</span>
            <span
              style={{
                fontFamily: "'Cabinet Grotesk',sans-serif",
                fontSize: 12,
                color: DS.text2,
              }}
            >
              {article.time}
            </span>
            <span style={{ color: DS.text2 }}>·</span>
            <span
              style={{
                fontFamily: "'Cabinet Grotesk',sans-serif",
                fontSize: 12,
                color: DS.text2,
              }}
            >
              ⏱ {article.readTime} read · 👁 {article.views}
            </span>
          </div>
          <p
            style={{
              fontFamily: "'Cabinet Grotesk',sans-serif",
              fontSize: 16,
              color: DS.text1,
              lineHeight: 1.8,
              marginBottom: 26,
            }}
          >
            {article.summary}
          </p>
          <AIPanel article={article} />
          <div
            style={{
              display: 'flex',
              gap: 7,
              flexWrap: 'wrap',
              margin: '20px 0',
            }}
          >
            {article.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 10,
                  color: DS.text2,
                  background: DS.bg3,
                  padding: '4px 11px',
                  borderRadius: 100,
                  border: `1px solid ${DS.line}`,
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 9,
              flexWrap: 'wrap',
              marginBottom: 28,
              position: 'relative',
            }}
          >
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                minWidth: 160,
                padding: '13px 22px',
                borderRadius: 11,
                background: `linear-gradient(135deg,${cat.color},${cat.color}99)`,
                color: '#000',
                fontFamily: "'Cabinet Grotesk',sans-serif",
                fontWeight: 800,
                fontSize: 14,
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              Read Full Article ↗
            </a>
            <button
              onClick={speak}
              style={{
                padding: '13px 20px',
                borderRadius: 11,
                background: tts ? `${DS.red}20` : DS.bg3,
                border: `1px solid ${tts ? DS.red : DS.line2}`,
                color: tts ? DS.red : DS.text1,
                fontFamily: "'Cabinet Grotesk',sans-serif",
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tts ? '⏹ Stop' : '🔊 Listen'}
            </button>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setSharing(!sharing)}
                style={{
                  padding: '13px 20px',
                  borderRadius: 11,
                  background: DS.bg3,
                  border: `1px solid ${DS.line2}`,
                  color: DS.text1,
                  fontFamily: "'Cabinet Grotesk',sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ↗ Share
              </button>
              {sharing && (
                <ShareMenu
                  article={article}
                  onClose={() => setSharing(false)}
                />
              )}
            </div>
          </div>
          {related.length > 0 && (
            <div>
              <h4
                style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 10,
                  color: DS.text2,
                  letterSpacing: 1.5,
                  marginBottom: 14,
                }}
              >
                RELATED ARTICLES
              </h4>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {related.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: DS.bg2,
                      border: `1px solid ${DS.line}`,
                      cursor: 'pointer',
                    }}
                  >
                    <img
                      src={r.image}
                      alt={r.title}
                      style={{
                        width: 64,
                        height: 56,
                        objectFit: 'cover',
                        borderRadius: 8,
                        flexShrink: 0,
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div>
                      <p
                        style={{
                          fontFamily: "'Fraunces',serif",
                          fontSize: 13,
                          fontWeight: 700,
                          color: DS.text0,
                          lineHeight: 1.35,
                          margin: '0 0 5px',
                        }}
                      >
                        {r.title}
                      </p>
                      <span
                        style={{
                          fontFamily: "'IBM Plex Mono',monospace",
                          fontSize: 9,
                          color: DS.text2,
                        }}
                      >
                        {r.source} · {r.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Trending Sidebar ──────────────────────────────────────────────────────────
function TrendingWidget({ articles }) {
  return (
    <div
      style={{
        background: DS.bg1,
        border: `1px solid ${DS.line}`,
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 18,
        }}
      >
        <span style={{ fontSize: 14 }}>🔥</span>
        <span
          style={{
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 10,
            color: DS.text2,
            letterSpacing: 1.5,
          }}
        >
          TRENDING NOW
        </span>
      </div>
      {articles.slice(0, 7).map((a, i) => {
        const cat = CAT_META[a.category] || { color: DS.amber };
        return (
          <div
            key={a.id}
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: 16,
              alignItems: 'flex-start',
              paddingBottom: 16,
              borderBottom: i < 6 ? `1px solid ${DS.line}` : 'none',
            }}
          >
            <span
              style={{
                fontFamily: "'Fraunces',serif",
                fontSize: 30,
                fontWeight: 900,
                color: DS.bg4,
                lineHeight: 1,
                minWidth: 34,
                paddingTop: 2,
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <p
                style={{
                  fontFamily: "'Cabinet Grotesk',sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  color: DS.text1,
                  lineHeight: 1.4,
                  margin: '0 0 5px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {a.title}
              </p>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 8.5,
                    color: cat.color,
                  }}
                >
                  {a.category}
                </span>
                <span style={{ color: DS.text2, fontSize: 9 }}>·</span>
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono',monospace",
                    fontSize: 8.5,
                    color: DS.text2,
                  }}
                >
                  👁 {a.views}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── AI Search Bar ─────────────────────────────────────────────────────────────
function AISearchBar({ onResults, onClear }) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState('');
  const typed = useTypewriter(insight, 10);

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setInsight('');
    try {
      const r = await callClaude(
        [
          {
            role: 'user',
            content: `Tech topic: "${q}"\nProvide: 1) 2-sentence expert context 2) 3 key recent developments to watch 3) One contrarian take. Be sharp.`,
          },
        ],
        'You are a senior tech journalist with 20 years experience. Be specific, direct, insightful. No fluff.',
        500
      );
      setInsight(r);
      onResults(q);
    } catch {
      setInsight('AI context unavailable. Showing filtered results.');
      onResults(q);
    }
    setLoading(false);
  };

  const clear = () => {
    setQ('');
    setInsight('');
    onClear();
  };

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: DS.text2,
              fontSize: 17,
            }}
          >
            ⌕
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Search topics, companies, technologies…"
            style={{
              width: '100%',
              padding: '13px 16px 13px 44px',
              borderRadius: 12,
              background: DS.bg2,
              border: `1px solid ${DS.line}`,
              color: DS.text0,
              fontFamily: "'Cabinet Grotesk',sans-serif",
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border .2s',
            }}
            onFocus={(e) => {
              e.target.style.border = `1px solid ${DS.cyan}60`;
            }}
            onBlur={(e) => {
              e.target.style.border = `1px solid ${DS.line}`;
            }}
          />
        </div>
        <button
          onClick={search}
          disabled={loading || !q.trim()}
          style={{
            padding: '13px 22px',
            borderRadius: 12,
            background: `linear-gradient(135deg,${DS.cyan},${DS.cyan}99)`,
            color: '#000',
            fontFamily: "'Cabinet Grotesk',sans-serif",
            fontWeight: 800,
            fontSize: 14,
            border: 'none',
            cursor: loading || !q.trim() ? 'default' : 'pointer',
            opacity: !q.trim() ? 0.5 : 1,
          }}
        >
          {loading ? '…' : 'AI Search'}
        </button>
        {q && (
          <button
            onClick={clear}
            style={{
              padding: '13px 16px',
              borderRadius: 12,
              background: DS.bg2,
              border: `1px solid ${DS.line}`,
              color: DS.text2,
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ×
          </button>
        )}
      </div>
      {insight && (
        <div
          style={{
            marginTop: 10,
            padding: '14px 16px',
            background: `${DS.cyan}08`,
            border: `1px solid ${DS.cyan}20`,
            borderRadius: 11,
          }}
        >
          <span
            style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 9,
              color: DS.cyan,
              letterSpacing: 1.5,
            }}
          >
            ✦ AI CONTEXT{' '}
          </span>
          <span
            style={{
              fontFamily: "'Cabinet Grotesk',sans-serif",
              fontSize: 13,
              color: DS.text1,
              lineHeight: 1.7,
            }}
          >
            {typed}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Daily Digest ──────────────────────────────────────────────────────────────
function DailyDigest({ articles }) {
  const [digest, setDigest] = useState('');
  const [loading, setLoading] = useState(false);
  const typed = useTypewriter(digest, 8);
  const ref = useRef();
  const visible = useVisible(ref);

  const generate = async () => {
    setLoading(true);
    setDigest('');
    try {
      const headlines = articles
        .slice(0, 8)
        .map((a) => `- ${a.title} (${a.source})`)
        .join('\n');
      const r = await callClaude(
        [
          {
            role: 'user',
            content: `Today's top tech stories:\n${headlines}\n\nWrite a punchy 5-sentence executive digest. Start with the biggest story, connect the themes, end with the key takeaway. Tone: sharp Bloomberg morning brief.`,
          },
        ],
        'You are a world-class tech journalist writing an executive morning brief. Be sharp, insightful, and connect dots between stories.',
        500
      );
      setDigest(r);
    } catch {
      setDigest('AI digest unavailable. Top stories are displayed below.');
    }
    setLoading(false);
  };

  return (
    <div
      ref={ref}
      style={{
        background: `linear-gradient(135deg,${DS.bg2},${DS.bg3})`,
        border: `1px solid ${DS.line2}`,
        borderRadius: 18,
        padding: 28,
        marginBottom: 28,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all .5s cubic-bezier(.4,0,.2,1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 10,
              color: DS.amber,
              letterSpacing: 1.5,
            }}
          >
            ✦ AI DAILY DIGEST
          </span>
          <span
            style={{
              fontFamily: "'Cabinet Grotesk',sans-serif",
              fontSize: 12,
              color: DS.text2,
            }}
          >
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
        {!digest && (
          <button
            onClick={generate}
            disabled={loading}
            style={{
              padding: '8px 18px',
              borderRadius: 9,
              background: loading
                ? DS.bg4
                : `linear-gradient(135deg,${DS.amber},${DS.amberD})`,
              border: 'none',
              color: '#000',
              fontFamily: "'Cabinet Grotesk',sans-serif",
              fontWeight: 800,
              fontSize: 13,
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Generating…' : 'Generate Digest ✦'}
          </button>
        )}
      </div>
      {digest ? (
        <p
          style={{
            fontFamily: "'Cabinet Grotesk',sans-serif",
            fontSize: 15,
            color: DS.text1,
            lineHeight: 1.85,
          }}
        >
          {typed}
        </p>
      ) : (
        <p
          style={{
            fontFamily: "'Cabinet Grotesk',sans-serif",
            fontSize: 14,
            color: DS.text2,
            lineHeight: 1.65,
            fontStyle: 'italic',
          }}
        >
          Click "Generate Digest" for an AI-powered summary of today's most
          important tech stories, curated and analyzed in real-time by Claude.
        </p>
      )}
    </div>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar({ articles }) {
  const stats = [
    { label: 'Stories Today', value: articles.length, color: DS.cyan },
    {
      label: 'Trending Now',
      value: articles.filter((a) => a.trending).length,
      color: DS.amber,
    },
    {
      label: 'Breaking',
      value: articles.filter((a) => a.breaking).length,
      color: DS.red,
    },
    {
      label: 'Sources',
      value: new Set(articles.map((a) => a.source)).size,
      color: DS.violet,
    },
  ];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4,1fr)',
        gap: 12,
        marginBottom: 28,
      }}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            background: DS.bg2,
            border: `1px solid ${DS.line}`,
            borderRadius: 14,
            padding: '16px 18px',
          }}
        >
          <div
            style={{
              fontFamily: "'Fraunces',serif",
              fontSize: 30,
              fontWeight: 800,
              color: s.color,
              lineHeight: 1,
            }}
          >
            {s.value}
          </div>
          <div
            style={{
              fontFamily: "'Cabinet Grotesk',sans-serif",
              fontSize: 11,
              color: DS.text2,
              marginTop: 5,
            }}
          >
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Newsletter CTA ────────────────────────────────────────────────────────────
function NewsletterCTA() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const ref = useRef();
  const visible = useVisible(ref);
  return (
    <div
      ref={ref}
      style={{
        background: `linear-gradient(135deg,${DS.bg2},${DS.bg3})`,
        border: `1px solid ${DS.amber}30`,
        borderRadius: 18,
        padding: 32,
        textAlign: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity .6s',
        marginBottom: 28,
      }}
    >
      <span
        style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 10,
          color: DS.amber,
          letterSpacing: 2,
        }}
      >
        DAILY BRIEFING
      </span>
      <h3
        style={{
          fontFamily: "'Fraunces',serif",
          fontSize: 26,
          fontWeight: 800,
          color: DS.text0,
          margin: '10px 0 8px',
        }}
      >
        Never Miss a Breakthrough
      </h3>
      <p
        style={{
          fontFamily: "'Cabinet Grotesk',sans-serif",
          fontSize: 14,
          color: DS.text2,
          marginBottom: 20,
          maxWidth: 380,
          margin: '0 auto 20px',
        }}
      >
        10,000+ tech founders, engineers and VCs start their day with TechPulse.
        Join them.
      </p>
      {!submitted ? (
        <div
          style={{ display: 'flex', gap: 8, maxWidth: 420, margin: '0 auto' }}
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 10,
              background: DS.bg1,
              border: `1px solid ${DS.line2}`,
              color: DS.text0,
              fontFamily: "'Cabinet Grotesk',sans-serif",
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            onClick={() => {
              if (email) setSubmitted(true);
            }}
            style={{
              padding: '12px 20px',
              borderRadius: 10,
              background: `linear-gradient(135deg,${DS.amber},${DS.amberD})`,
              color: '#000',
              fontFamily: "'Cabinet Grotesk',sans-serif",
              fontWeight: 800,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Subscribe →
          </button>
        </div>
      ) : (
        <div
          style={{
            fontFamily: "'Cabinet Grotesk',sans-serif",
            fontSize: 16,
            color: DS.green,
            fontWeight: 700,
          }}
        >
          ✓ You're in! First issue arrives tomorrow morning.
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function TechPulse() {
  const [articles] = useState(BASE_ARTICLES);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selected, setSelected] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const scrollProg = useScrollProgress();
  const loaderRef = useRef();
  const PERPAGE = 9;

  useEffect(() => {
    setTimeout(() => setLoading(false), 800);
  }, []);

  const filtered = useMemo(() => {
    let list = articles;
    if (activeCategory !== 'All')
      list = list.filter((a) => a.category === activeCategory);
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
    return list;
  }, [articles, activeCategory, searchQuery]);

  const paginated = filtered.slice(0, page * PERPAGE);
  const hasMore = paginated.length < filtered.length;

  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && hasMore) setPage((p) => p + 1);
      },
      { threshold: 0.1 }
    );
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,600,700,800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        html{scroll-behavior:smooth;}
        body{background:${DS.bg0};color:${DS.text0};-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${DS.bg4};border-radius:2px;}
        @keyframes shimmer{0%,100%{opacity:.3}50%{opacity:.7}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .cats::-webkit-scrollbar{display:none;}.cats{scrollbar-width:none;}
      `}</style>

      {/* Reading progress bar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: 2,
          width: `${scrollProg}%`,
          background: `linear-gradient(90deg,${DS.amber},${DS.coral})`,
          zIndex: 1000,
          transition: 'width .1s',
        }}
      />

      {/* Breaking ticker */}
      {!loading && (
        <BreakingTicker
          articles={articles.filter((a) => a.breaking || a.trending)}
        />
      )}

      {/* Navbar */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 900,
          background: `${DS.bg0}ee`,
          backdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${DS.line}`,
        }}
      >
        <div
          style={{
            maxWidth: 1360,
            margin: '0 auto',
            padding: '0 24px',
            height: 62,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: `linear-gradient(135deg,${DS.amber},${DS.coral})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: "'Fraunces',serif",
                  fontSize: 17,
                  fontWeight: 900,
                  color: '#000',
                }}
              >
                T
              </span>
            </div>
            <div>
              <span
                style={{
                  fontFamily: "'Fraunces',serif",
                  fontSize: 21,
                  fontWeight: 900,
                  color: DS.text0,
                  letterSpacing: '-0.5px',
                }}
              >
                TechPulse
              </span>
              <span
                style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 8,
                  color: DS.amber,
                  letterSpacing: 1,
                  display: 'block',
                  lineHeight: 1,
                  marginTop: 1,
                }}
              >
                AI-POWERED
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: DS.green,
                  boxShadow: `0 0 8px ${DS.green}`,
                  animation: 'pulse 2s ease-in-out infinite',
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 9.5,
                  color: DS.text2,
                  letterSpacing: 0.5,
                }}
              >
                LIVE
              </span>
            </div>
            <span
              style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 9.5,
                color: DS.text2,
              }}
            >
              {filtered.length} ARTICLES
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              style={{
                padding: '7px 15px',
                borderRadius: 9,
                background: 'transparent',
                border: `1px solid ${DS.line2}`,
                color: DS.text1,
                fontFamily: "'Cabinet Grotesk',sans-serif",
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign In
            </button>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: `linear-gradient(135deg,${DS.violet},${DS.cyan})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 15,
              }}
            >
              👤
            </div>
          </div>
        </div>
        {/* Category strip */}
        <div
          className="cats"
          style={{
            borderTop: `1px solid ${DS.line}`,
            overflowX: 'auto',
            display: 'flex',
            gap: 2,
            padding: '8px 24px',
            maxWidth: 1360,
            margin: '0 auto',
          }}
        >
          {CATEGORIES.map((c) => {
            const meta = CAT_META[c];
            const active = activeCategory === c;
            const color = meta?.color || DS.text0;
            return (
              <button
                key={c}
                onClick={() => {
                  setActiveCategory(c);
                  setPage(1);
                }}
                style={{
                  padding: '6px 16px',
                  borderRadius: 100,
                  border: active ? 'none' : `1px solid ${DS.line}`,
                  background: active ? color : 'transparent',
                  color: active ? '#000' : DS.text2,
                  fontFamily: "'Cabinet Grotesk',sans-serif",
                  fontSize: 12.5,
                  fontWeight: active ? 800 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all .2s',
                  boxShadow: active ? `0 0 20px ${color}40` : 'none',
                }}
              >
                {meta ? `${meta.emoji} ` : ''}
                {c}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Hero */}
      <div
        style={{
          background: `linear-gradient(180deg,${DS.bg1} 0%,${DS.bg0} 100%)`,
          borderBottom: `1px solid ${DS.line}`,
          padding: '52px 24px 44px',
        }}
      >
        <div style={{ maxWidth: 1360, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 10,
                color: DS.red,
                letterSpacing: 2,
              }}
            >
              ● LIVE TECH INTELLIGENCE
            </span>
            <span style={{ color: DS.line2 }}>·</span>
            <span
              style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 10,
                color: DS.text2,
              }}
            >
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <h1
            style={{
              fontFamily: "'Fraunces',serif",
              fontSize: 'clamp(38px,5.5vw,70px)',
              fontWeight: 900,
              lineHeight: 1.08,
              marginBottom: 16,
              maxWidth: 700,
            }}
          >
            The World's Tech News,
            <br />
            <span
              style={{
                background: `linear-gradient(90deg,${DS.amber},${DS.coral})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Intelligently Curated.
            </span>
          </h1>
          <p
            style={{
              fontFamily: "'Cabinet Grotesk',sans-serif",
              fontSize: 16,
              color: DS.text2,
              maxWidth: 520,
              lineHeight: 1.65,
            }}
          >
            AI-analyzed stories from 50+ trusted sources. Sentiment scores, hype
            ratings, and expert context — updated in real-time.
          </p>
        </div>
      </div>

      {/* Main grid */}
      <main
        style={{
          maxWidth: 1360,
          margin: '0 auto',
          padding: '32px 24px 60px',
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 28,
          alignItems: 'start',
        }}
      >
        <div>
          <AISearchBar
            onResults={(q) => {
              setSearchQuery(q);
              setPage(1);
            }}
            onClear={() => {
              setSearchQuery('');
              setPage(1);
            }}
          />

          {!loading && !searchQuery && activeCategory === 'All' && (
            <StatsBar articles={articles} />
          )}
          {!loading && !searchQuery && activeCategory === 'All' && (
            <DailyDigest articles={articles} />
          )}

          {loading ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))',
                gap: 18,
              }}
            >
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '80px 20px',
                animation: 'fadeIn .5s',
              }}
            >
              <div style={{ fontSize: 52, marginBottom: 16 }}>🔍</div>
              <h3
                style={{
                  fontFamily: "'Fraunces',serif",
                  fontSize: 22,
                  color: DS.text1,
                  marginBottom: 8,
                }}
              >
                No results found
              </h3>
              <p
                style={{
                  fontFamily: "'Cabinet Grotesk',sans-serif",
                  fontSize: 14,
                  color: DS.text2,
                }}
              >
                Try a different search term or category
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))',
                  gap: 18,
                }}
              >
                {paginated.map((a, i) => (
                  <NewsCard
                    key={a.id}
                    article={a}
                    onClick={setSelected}
                    variant={
                      i === 0 && activeCategory === 'All' && !searchQuery
                        ? 'featured'
                        : 'default'
                    }
                    delay={Math.min(i * 40, 200)}
                  />
                ))}
              </div>
              {paginated.length >= 6 && !searchQuery && (
                <div
                  style={{
                    margin: '24px 0',
                    padding: 20,
                    background: DS.bg2,
                    border: `1px dashed ${DS.amber}25`,
                    borderRadius: 14,
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontSize: 9,
                      color: DS.text2,
                      letterSpacing: 1,
                    }}
                  >
                    SPONSORED CONTENT
                  </span>
                  <p
                    style={{
                      fontFamily: "'Cabinet Grotesk',sans-serif",
                      fontSize: 12,
                      color: DS.text2,
                      marginTop: 6,
                    }}
                  >
                    Premium ad placement available — contact ads@techpulse.ai
                  </p>
                </div>
              )}
              <div
                ref={loaderRef}
                style={{ textAlign: 'center', padding: '28px 0' }}
              >
                {hasMore ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        border: `2px solid ${DS.amber}`,
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "'IBM Plex Mono',monospace",
                        fontSize: 10,
                        color: DS.text2,
                        letterSpacing: 1,
                      }}
                    >
                      LOADING MORE
                    </span>
                  </div>
                ) : filtered.length > PERPAGE ? (
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontSize: 10,
                      color: DS.text2,
                    }}
                  >
                    — END OF FEED —
                  </span>
                ) : null}
              </div>
            </>
          )}
          {!loading && <NewsletterCTA />}
        </div>

        {/* Sidebar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            position: 'sticky',
            top: 130,
          }}
        >
          {!loading && (
            <TrendingWidget
              articles={articles.filter((a) => a.trending || a.hype > 85)}
            />
          )}

          <div
            style={{
              background: DS.bg1,
              border: `1px solid ${DS.line}`,
              borderRadius: 16,
              padding: 20,
            }}
          >
            <span
              style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 10,
                color: DS.text2,
                letterSpacing: 1.5,
                display: 'block',
                marginBottom: 14,
              }}
            >
              📡 TRUSTED SOURCES
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {[
                'TechCrunch',
                'Wired',
                'Ars Technica',
                'The Verge',
                'Bloomberg',
                'Nature',
                '9to5Mac',
                'Android Auth',
                'Hacker News',
                'Dev.to',
                'CoinDesk',
                'Space.com',
              ].map((s) => (
                <span
                  key={s}
                  style={{
                    fontFamily: "'Cabinet Grotesk',sans-serif",
                    fontSize: 11,
                    color: DS.text2,
                    background: DS.bg3,
                    padding: '4px 10px',
                    borderRadius: 100,
                    border: `1px solid ${DS.line}`,
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              background: DS.bg1,
              border: `1px solid ${DS.line}`,
              borderRadius: 16,
              padding: 20,
            }}
          >
            <span
              style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 10,
                color: DS.text2,
                letterSpacing: 1.5,
                display: 'block',
                marginBottom: 14,
              }}
            >
              📊 BY CATEGORY
            </span>
            {Object.entries(CAT_META)
              .slice(0, 7)
              .map(([cat, meta]) => {
                const count = articles.filter((a) => a.category === cat).length;
                const pct = Math.round((count / articles.length) * 100);
                return (
                  <div key={cat} style={{ marginBottom: 11 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Cabinet Grotesk',sans-serif",
                          fontSize: 12,
                          color: DS.text1,
                        }}
                      >
                        {meta.emoji} {cat}
                      </span>
                      <span
                        style={{
                          fontFamily: "'IBM Plex Mono',monospace",
                          fontSize: 10,
                          color: DS.text2,
                        }}
                      >
                        {count}
                      </span>
                    </div>
                    <div
                      style={{ height: 3, background: DS.bg3, borderRadius: 2 }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct * 4}%`,
                          background: meta.color,
                          borderRadius: 2,
                          maxWidth: '100%',
                          transition: 'width 1s',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>

          <div
            style={{
              background: `linear-gradient(135deg,${DS.bg2},${DS.bg3})`,
              border: `1px solid ${DS.amber}30`,
              borderRadius: 16,
              padding: 20,
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 9,
                color: DS.amber,
                letterSpacing: 1.5,
              }}
            >
              PREMIUM
            </span>
            <h4
              style={{
                fontFamily: "'Fraunces',serif",
                fontSize: 18,
                fontWeight: 800,
                color: DS.text0,
                margin: '8px 0 6px',
              }}
            >
              Go Ad-Free
            </h4>
            <p
              style={{
                fontFamily: "'Cabinet Grotesk',sans-serif",
                fontSize: 12,
                color: DS.text2,
                lineHeight: 1.5,
                marginBottom: 14,
              }}
            >
              Full AI features, no ads, daily digest emails, push notifications.
            </p>
            <button
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 9,
                background: `linear-gradient(135deg,${DS.amber},${DS.amberD})`,
                border: 'none',
                color: '#000',
                fontFamily: "'Cabinet Grotesk',sans-serif",
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Upgrade · $9/mo
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{ borderTop: `1px solid ${DS.line}`, padding: '32px 24px 28px' }}
      >
        <div
          style={{
            maxWidth: 1360,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <span
              style={{
                fontFamily: "'Fraunces',serif",
                fontSize: 18,
                fontWeight: 900,
                color: DS.text0,
              }}
            >
              TechPulse
            </span>
            <p
              style={{
                fontFamily: "'Cabinet Grotesk',sans-serif",
                fontSize: 12,
                color: DS.text2,
                marginTop: 3,
              }}
            >
              AI-powered tech intelligence · Built for builders
            </p>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {['About', 'Advertise', 'API', 'Privacy', 'Terms', 'Contact'].map(
              (l) => (
                <span
                  key={l}
                  style={{
                    fontFamily: "'Cabinet Grotesk',sans-serif",
                    fontSize: 12,
                    color: DS.text2,
                    cursor: 'pointer',
                  }}
                >
                  {l}
                </span>
              )
            )}
          </div>
          <span
            style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 10,
              color: DS.text2,
            }}
          >
            © 2026 TechPulse · Powered by Claude
          </span>
        </div>
      </footer>

      {selected && (
        <ArticleModal
          article={selected}
          onClose={() => setSelected(null)}
          allArticles={articles}
        />
      )}
    </>
  );
}
