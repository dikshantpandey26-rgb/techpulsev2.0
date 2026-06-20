// =============================================================================
// src/services/categoryClassifier.ts  (Phase 9 — Web3/Robotics classification fix)
//
// CHANGES FROM PREVIOUS VERSION:
// ─────────────────────────────────────────────────────────────────────────────
// 1. TOKEN-AWARE MATCHING (replaces substring .includes())
//    Root cause confirmed via direct execution: `.includes("ar")` matched
//    inside "researchers" (se-AR-chers), incorrectly contributing to Gadgets'
//    score. Every keyword is now compiled ONCE at module load into a
//    word-boundary regex (\bkeyword\b), built via a pre-compilation step so
//    the hot classification loop pays zero extra cost per call — regex
//    compilation happens once, not per-article.
//
// 2. WEB3 vs CRYPTO REBALANCING
//    Root cause confirmed via direct execution: real Ethereum/Polygon blog
//    titles ("Ethereum Mainnet Upgrade Improves Staking Rewards", "Polygon
//    zkEVM Mainnet Beta Launches") classified as Crypto 4/4 times, because
//    Crypto's table held "ethereum"(4) and "polygon"(3) while Web3's table
//    held none of the vocabulary these sources actually use.
//    Fix: infrastructure/ecosystem terms (ethereum, polygon, layer2, zkevm,
//    rollup, staking, validator, bridge, dao, danksharding, gas fees) moved
//    to Web3 or added there with strong weights. Crypto keeps bitcoin,
//    trading/exchange/price/ETF signals — terms that genuinely indicate
//    market/trading content rather than protocol/infrastructure content.
//
// 3. ROBOTICS EXPANSION
//    Added bare "robot", "robotic", "automation", "warehouse robot",
//    "robotaxi" — previously only compound phrases existed, so titles like
//    "Researchers Develop Soft Robotic Gripper" scored zero Robotics signal
//    and lost to Gadgets (which already had bare "robot").
//
// 4. PRIORITY REORDER
//    Web3 moved ahead of Crypto; Robotics moved ahead of Gadgets — so that
//    on a genuine tie, the more specific category wins, matching the
//    intent confirmed in the root-cause audit.
//
// Architecture is otherwise unchanged: pure functions, no side effects,
// Edge-safe, zero external dependencies.
// =============================================================================

import type { CategoryKey, ClassificationResult } from "../types";

// ── Signal table ──────────────────────────────────────────────────────────────

interface Signal {
  kw:     string;   // lowercase keyword
  weight: number;   // 1 = weak signal, 4 = near-definitive
}

type CategorySignals = {
  [K in CategoryKey]: Signal[];
};

const CATEGORY_SIGNALS: CategorySignals = {
  AI: [
    { kw: "artificial intelligence", weight: 4 },
    { kw: "machine learning",        weight: 4 },
    { kw: "large language model",    weight: 4 },
    { kw: "llm",                     weight: 3 },
    { kw: "neural network",          weight: 3 },
    { kw: "generative ai",           weight: 4 },
    { kw: "openai",                  weight: 3 },
    { kw: "anthropic",               weight: 3 },
    { kw: "deepmind",                weight: 3 },
    { kw: "gpt",                     weight: 3 },
    { kw: "claude",                  weight: 2 },
    { kw: "gemini",                  weight: 2 },
    { kw: "llama",                   weight: 2 },
    { kw: "diffusion model",         weight: 3 },
    { kw: "transformer",             weight: 2 },
    { kw: "fine-tuning",             weight: 2 },
    { kw: "inference",               weight: 1 },
    { kw: "foundation model",        weight: 3 },
    { kw: "agi",                     weight: 4 },
    { kw: "benchmark",               weight: 1 },
    { kw: "embedding",               weight: 2 },
    { kw: "rag",                     weight: 2 },
    { kw: "multimodal",              weight: 2 },
    { kw: "prompt",                  weight: 1 },
    { kw: "hallucination",           weight: 2 },
    { kw: "alignment",               weight: 2 },
    { kw: "ai safety",               weight: 3 },
    { kw: "stable diffusion",        weight: 3 },
    { kw: "midjourney",              weight: 3 },
    { kw: "copilot",                 weight: 2 },
  ],

  Startups: [
    { kw: "startup",                 weight: 4 },
    { kw: "series a",                weight: 4 },
    { kw: "series b",                weight: 4 },
    { kw: "series c",                weight: 4 },
    { kw: "series f",                weight: 4 },
    { kw: "seed round",              weight: 4 },
    { kw: "raises",                  weight: 2 },
    { kw: "valuation",               weight: 3 },
    { kw: "venture capital",         weight: 3 },
    { kw: "vc funding",              weight: 3 },
    { kw: "y combinator",            weight: 4 },
    { kw: "yc",                      weight: 2 },
    { kw: "demo day",                weight: 3 },
    { kw: "unicorn",                 weight: 3 },
    { kw: "ipo",                     weight: 3 },
    { kw: "acquisition",             weight: 2 },
    { kw: "merger",                  weight: 2 },
    { kw: "founder",                 weight: 2 },
    { kw: "entrepreneur",            weight: 2 },
    { kw: "pivot",                   weight: 2 },
    { kw: "product hunt",            weight: 2 },
    { kw: "launch",                  weight: 1 },
  ],

  Cybersecurity: [
    { kw: "zero-day",                weight: 4 },
    { kw: "zero day",                weight: 4 },
    { kw: "vulnerability",           weight: 4 },
    { kw: "exploit",                 weight: 4 },
    { kw: "ransomware",              weight: 4 },
    { kw: "malware",                 weight: 4 },
    { kw: "data breach",             weight: 4 },
    { kw: "cve",                     weight: 4 },
    { kw: "cisa",                    weight: 3 },
    { kw: "phishing",                weight: 3 },
    { kw: "cyberattack",             weight: 4 },
    { kw: "hacker",                  weight: 2 },
    { kw: "remote code execution",   weight: 4 },
    { kw: "rce",                     weight: 3 },
    { kw: "patch",                   weight: 1 },
    { kw: "security flaw",           weight: 3 },
    { kw: "encryption",              weight: 2 },
    { kw: "backdoor",                weight: 3 },
    { kw: "nation-state",            weight: 3 },
    { kw: "apt",                     weight: 3 },
    { kw: "botnet",                  weight: 3 },
    { kw: "ddos",                    weight: 3 },
    { kw: "openssh",                 weight: 2 },
    { kw: "buffer overflow",         weight: 3 },
    { kw: "authentication bypass",   weight: 3 },
  ],

  Gadgets: [
    { kw: "headset",                 weight: 3 },
    { kw: "wearable",                weight: 3 },
    { kw: "smartwatch",              weight: 3 },
    { kw: "earbuds",                 weight: 3 },
    { kw: "laptop",                  weight: 2 },
    { kw: "tablet",                  weight: 2 },
    { kw: "drone",                   weight: 3 },
    { kw: "camera",                  weight: 2 },
    { kw: "display",                 weight: 1 },
    { kw: "monitor",                 weight: 1 },
    { kw: "vr",                      weight: 3 },
    { kw: "ar",                      weight: 2 },
    { kw: "xr",                      weight: 2 },
    { kw: "vision pro",              weight: 4 },
    { kw: "smart home",              weight: 3 },
    { kw: "iot",                     weight: 2 },
    { kw: "3d printing",             weight: 2 },
    { kw: "hands-free",              weight: 2 },
    // NOTE: bare "robot" intentionally removed — moved to Robotics (Phase 9 fix).
    // Token-aware matching means it no longer leaks into Gadgets via "robotics"/
    // "robotic" substrings anyway, but removing it outright avoids ambiguous
    // ties for genuinely consumer-robot content like robot vacuums, which now
    // route through Robotics' own "robot" keyword with priority tiebreak intact.
  ],

  Programming: [
    { kw: "javascript",              weight: 3 },
    { kw: "typescript",              weight: 3 },
    { kw: "python",                  weight: 3 },
    { kw: "rust",                    weight: 3 },
    { kw: "go lang",                 weight: 3 },
    { kw: "open source",             weight: 2 },
    { kw: "github",                  weight: 2 },
    { kw: "developer",               weight: 2 },
    { kw: "programming language",    weight: 4 },
    { kw: "compiler",                weight: 3 },
    { kw: "linux kernel",            weight: 3 },
    { kw: "framework",               weight: 1 },
    { kw: "library",                 weight: 1 },
    { kw: "api",                     weight: 1 },
    { kw: "borrow checker",          weight: 3 },
    { kw: "memory safety",           weight: 3 },
    { kw: "webassembly",             weight: 3 },
    { kw: "wasm",                    weight: 3 },
    { kw: "react",                   weight: 2 },
    { kw: "node.js",                 weight: 2 },
    { kw: "software engineer",       weight: 2 },
    { kw: "stack overflow",          weight: 2 },
    { kw: "dev.to",                  weight: 2 },
  ],

  Space: [
    { kw: "spacex",                  weight: 4 },
    { kw: "starship",                weight: 4 },
    { kw: "rocket",                  weight: 3 },
    { kw: "nasa",                    weight: 4 },
    { kw: "orbit",                   weight: 3 },
    { kw: "satellite",               weight: 3 },
    { kw: "mars",                    weight: 3 },
    { kw: "moon",                    weight: 2 },
    { kw: "launch vehicle",          weight: 3 },
    { kw: "astronaut",               weight: 3 },
    { kw: "iss",                     weight: 3 },
    { kw: "telescope",               weight: 3 },
    { kw: "exoplanet",               weight: 4 },
    { kw: "solar system",            weight: 2 },
    { kw: "blue origin",             weight: 4 },
    { kw: "boeing starliner",        weight: 4 },
    { kw: "deep space",              weight: 3 },
    { kw: "propulsion",              weight: 2 },
  ],

  Apple: [
    { kw: "apple",                   weight: 3 },
    { kw: "iphone",                  weight: 4 },
    { kw: "ipad",                    weight: 4 },
    { kw: "macos",                   weight: 4 },
    { kw: "ios",                     weight: 4 },
    { kw: "wwdc",                    weight: 4 },
    { kw: "tim cook",                weight: 3 },
    { kw: "apple silicon",           weight: 4 },
    { kw: "macbook",                 weight: 4 },
    { kw: "airpods",                 weight: 4 },
    { kw: "apple watch",             weight: 4 },
    { kw: "app store",               weight: 3 },
    { kw: "swift",                   weight: 3 },
    { kw: "xcode",                   weight: 3 },
    { kw: "apple tv",                weight: 3 },
    { kw: "icloud",                  weight: 3 },
  ],

  Android: [
    { kw: "android",                 weight: 4 },
    { kw: "google pixel",            weight: 4 },
    { kw: "samsung galaxy",          weight: 4 },
    { kw: "oneplus",                 weight: 4 },
    { kw: "google play",             weight: 3 },
    { kw: "apk",                     weight: 3 },
    { kw: "material design",         weight: 3 },
    { kw: "google android",          weight: 4 },
    { kw: "android studio",          weight: 3 },
    { kw: "kotlin",                  weight: 3 },
  ],

  Gaming: [
    { kw: "gaming",                  weight: 3 },
    { kw: "game",                    weight: 2 },
    { kw: "nvidia",                  weight: 3 },
    { kw: "gpu",                     weight: 3 },
    { kw: "rtx",                     weight: 3 },
    { kw: "xbox",                    weight: 4 },
    { kw: "playstation",             weight: 4 },
    { kw: "ps5",                     weight: 4 },
    { kw: "nintendo",                weight: 4 },
    { kw: "steam",                   weight: 3 },
    { kw: "esports",                 weight: 3 },
    { kw: "fps",                     weight: 2 },
    { kw: "ray tracing",             weight: 3 },
    { kw: "path tracing",            weight: 3 },
    { kw: "4k gaming",               weight: 3 },
    { kw: "cyberpunk",               weight: 2 },
  ],

  "Cloud & DevOps": [
    { kw: "aws",                     weight: 3 },
    { kw: "azure",                   weight: 3 },
    { kw: "gcp",                     weight: 3 },
    { kw: "google cloud",            weight: 3 },
    { kw: "kubernetes",              weight: 4 },
    { kw: "docker",                  weight: 3 },
    { kw: "serverless",              weight: 3 },
    { kw: "devops",                  weight: 4 },
    { kw: "ci/cd",                   weight: 3 },
    { kw: "infrastructure",          weight: 2 },
    { kw: "microservices",           weight: 3 },
    { kw: "terraform",               weight: 3 },
    { kw: "graviton",                weight: 3 },
    { kw: "lambda",                  weight: 2 },
    { kw: "cloud computing",         weight: 3 },
    { kw: "edge computing",          weight: 3 },
    { kw: "vercel",                  weight: 2 },
    { kw: "cloudflare",              weight: 2 },
  ],

  Science: [
    { kw: "superconductor",          weight: 4 },
    { kw: "quantum",                 weight: 3 },
    { kw: "physicists",              weight: 3 },
    { kw: "researchers",             weight: 2 },
    { kw: "breakthrough",            weight: 2 },
    { kw: "clinical trial",          weight: 3 },
    { kw: "crispr",                  weight: 4 },
    { kw: "protein folding",         weight: 4 },
    { kw: "neuroscience",            weight: 3 },
    { kw: "genomics",                weight: 3 },
    { kw: "nuclear fusion",          weight: 4 },
    { kw: "plasma",                  weight: 2 },
    { kw: "materials science",       weight: 3 },
    { kw: "peer-reviewed",           weight: 3 },
    { kw: "nature journal",          weight: 3 },
    { kw: "mit",                     weight: 2 },
    { kw: "stanford",                weight: 2 },
    { kw: "particle physics",        weight: 4 },
  ],

  // ── Crypto: trading/market/currency focus ───────────────────────────────────
  // Infrastructure/ecosystem terms (ethereum, polygon, layer2, staking, etc.)
  // moved to Web3 — see Phase 9 rebalancing rationale at top of file.
  // Crypto retains terms that genuinely signal market/trading content.
  Crypto: [
    { kw: "bitcoin",                 weight: 4 },
    { kw: "cryptocurrency",          weight: 4 },
    { kw: "blockchain",              weight: 2 },
    { kw: "nft",                     weight: 3 },
    { kw: "stablecoin",              weight: 4 },
    { kw: "crypto",                  weight: 3 },
    { kw: "solana",                  weight: 4 },
    { kw: "wallet",                  weight: 2 },
    { kw: "exchange",                weight: 3 },
    { kw: "coinbase",                weight: 3 },
    { kw: "binance",                 weight: 3 },
    { kw: "etf",                     weight: 4 },
    { kw: "trading",                 weight: 2 },
    { kw: "market cap",              weight: 3 },
    { kw: "token price",             weight: 3 },
    { kw: "price surge",             weight: 3 },
    { kw: "all-time high",           weight: 3 },
  ],

  // ── Web3: infrastructure, protocol, developer ecosystem focus ──────────────
  // Phase 9 fix: ethereum/polygon and L2/scaling vocabulary added here since
  // this is the actual language used by Ethereum Foundation, Polygon, and
  // similar protocol-focused sources — confirmed via direct testing.
  Web3: [
    { kw: "web3",                    weight: 4 },
    { kw: "decentralized",           weight: 3 },
    { kw: "smart contract",          weight: 4 },
    { kw: "dapp",                    weight: 4 },
    { kw: "decentralized app",       weight: 4 },
    { kw: "metaverse",               weight: 3 },
    { kw: "token",                   weight: 2 },
    { kw: "nft market",              weight: 3 },
    { kw: "ipfs",                    weight: 3 },
    { kw: "ethereum",                weight: 4 },
    { kw: "polygon",                 weight: 4 },
    { kw: "layer2",                  weight: 4 },
    { kw: "layer-2",                 weight: 4 },
    { kw: "layer 2",                 weight: 4 },
    { kw: "zkevm",                   weight: 4 },
    { kw: "rollup",                  weight: 4 },
    { kw: "staking",                 weight: 3 },
    { kw: "validator",               weight: 3 },
    { kw: "bridge",                  weight: 2 },
    { kw: "dao",                     weight: 4 },
    { kw: "defi",                    weight: 4 },
    { kw: "danksharding",            weight: 4 },
    { kw: "gas fees",                weight: 3 },
    { kw: "mainnet",                 weight: 2 },
  ],

  // ── Robotics: expanded per Phase 9 fix ──────────────────────────────────────
  // Added bare "robot"/"robotic"/"automation" — previously only compound
  // phrases existed, so generic robotics-research titles scored zero and
  // lost to Gadgets (confirmed via direct testing).
  Robotics: [
    { kw: "robotics",                weight: 4 },
    { kw: "robot",                   weight: 3 },
    { kw: "robotic",                 weight: 3 },
    { kw: "automation",              weight: 2 },
    { kw: "autonomous robot",        weight: 4 },
    { kw: "humanoid",                weight: 4 },
    { kw: "boston dynamics",         weight: 4 },
    { kw: "figure ai",               weight: 4 },
    { kw: "bipedal",                 weight: 4 },
    { kw: "robotic arm",             weight: 3 },
    { kw: "self-driving",            weight: 3 },
    { kw: "autonomous vehicle",      weight: 3 },
    { kw: "tesla bot",               weight: 4 },
    { kw: "industrial robot",        weight: 3 },
    { kw: "warehouse robot",         weight: 3 },
    { kw: "drone delivery",          weight: 3 },
    { kw: "robotaxi",                weight: 4 },
  ],
};

// ── Token-aware matching engine ────────────────────────────────────────────────
//
// Root cause fix: the previous implementation used `haystack.includes(kw)`,
// a plain substring search. This matched short keywords inside unrelated
// words — confirmed via direct execution: "ar" (Gadgets, AR/VR signal)
// matched inside "researchers" (...se-AR-chers...), incorrectly boosting
// Gadgets' score for science/robotics articles that happened to mention
// "researchers".
//
// Fix: every keyword is compiled ONCE at module load into a word-boundary
// regex (\bkeyword\b). This is done at module initialization — NOT inside
// the hot classification loop — so there is zero added per-call cost;
// regex compilation happens exactly once per keyword for the lifetime of
// the warm Edge Function isolate.

interface CompiledSignal {
  kw:     string;
  weight: number;
  regex:  RegExp;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileSignal(s: Signal): CompiledSignal {
  // \b on both sides ensures "robot" matches "the robot moved" but NOT
  // "robotic" or "robots-only" as a substring of a larger token.
  // Hyphens and spaces inside multi-word keywords are non-word characters,
  // so \b correctly anchors at the keyword's true start/end either way.
  return { kw: s.kw, weight: s.weight, regex: new RegExp(`\\b${escapeRegex(s.kw)}\\b`, "i") };
}

const COMPILED_SIGNALS: Record<CategoryKey, CompiledSignal[]> = Object.fromEntries(
  (Object.entries(CATEGORY_SIGNALS) as Array<[CategoryKey, Signal[]]>).map(
    ([cat, signals]) => [cat, signals.map(compileSignal)]
  )
) as Record<CategoryKey, CompiledSignal[]>;

// ── Category priority tiebreaker ──────────────────────────────────────────────
// When two categories tie in score, the one with the lower index wins.
// Phase 9: Web3 moved ahead of Crypto, Robotics moved ahead of Gadgets —
// so genuine ties resolve toward the more specific category, matching the
// behavior confirmed correct in the root-cause audit's test cases.
const CATEGORY_PRIORITY: CategoryKey[] = [
  "AI", "Cybersecurity", "Startups", "Programming", "Science",
  "Cloud & DevOps", "Web3", "Crypto", "Robotics", "Gadgets",
  "Space", "Apple", "Android", "Gaming",
];

// ── Core classifier ───────────────────────────────────────────────────────────

/**
 * Classify an article into a CategoryKey with a confidence score.
 *
 * @param title       - Article headline
 * @param description - Article summary/description
 * @param hint        - Optional source-level default category (used as tiebreaker)
 * @returns ClassificationResult with category, confidence 0–1, and matched signals
 */
export function classifyArticle(
  title:       string,
  description: string,
  hint?:       CategoryKey
): ClassificationResult {
  // Normalise input once — called in a hot path during ingestion
  const haystack = `${title} ${description}`.toLowerCase();

  // Score each category using pre-compiled word-boundary regexes
  const scores = new Map<CategoryKey, number>();

  for (const [cat, signals] of Object.entries(COMPILED_SIGNALS) as Array<[CategoryKey, CompiledSignal[]]>) {
    let catScore = 0;
    for (const { regex, weight } of signals) {
      if (regex.test(haystack)) {
        catScore += weight;
      }
    }
    if (catScore > 0) scores.set(cat, catScore);
  }

  // No signals matched — fall back to hint or AI
  if (scores.size === 0) {
    return {
      category:   hint ?? "AI",
      confidence: 0.20,
      signals:    [],
    };
  }

  // Find best category (highest score, with priority as tiebreaker)
  let bestCategory: CategoryKey = hint ?? "AI";
  let bestScore = 0;
  let totalScore = 0;

  for (const [cat, score] of scores) {
    totalScore += score;
    const currentPriority = CATEGORY_PRIORITY.indexOf(cat);
    const bestPriority    = CATEGORY_PRIORITY.indexOf(bestCategory);

    if (
      score > bestScore ||
      (score === bestScore && currentPriority < bestPriority)
    ) {
      bestScore    = score;
      bestCategory = cat;
    }
  }

  const confidence = Math.min(1, bestScore / Math.max(totalScore, 1));

  // Collect which keywords drove the winning category (word-boundary aware)
  const winnerSignals = COMPILED_SIGNALS[bestCategory]
    .filter(({ regex }) => regex.test(haystack))
    .map(({ kw }) => kw)
    .slice(0, 5);

  return {
    category:   bestCategory,
    confidence: parseFloat(confidence.toFixed(3)),
    signals:    winnerSignals,
  };
}

/**
 * Convenience wrapper that returns just the CategoryKey.
 * When confidence is below the threshold, the source hint is used as fallback.
 */
export function inferCategory(
  title:       string,
  description: string,
  hint?:       CategoryKey,
  minConfidence = 0.25
): CategoryKey {
  const result = classifyArticle(title, description, hint);
  if (result.confidence < minConfidence && hint) return hint;
  return result.category;
}