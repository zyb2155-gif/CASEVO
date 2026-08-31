/**
 * CASEVO AI — Sourcing Worker
 * Version: 4.0.0
 *
 * Purpose:
 * - Receive sourcing requirements from CASEVO frontend
 * - Search public web through Tavily
 * - Clean raw search content
 * - Remove HTML / Markdown / Shopify / WordPress / navigation garbage
 * - Filter irrelevant results
 * - Normalize supplier candidates
 * - Score supplier relevance
 * - Return frontend-safe JSON
 *
 * Required Cloudflare Worker secret:
 *   TAVILY_API_KEY
 */

const VERSION = "4.0.0";
const SERVICE = "CASEVO AI Sourcing";
const ENGINE = "CASEVO Real Supplier Discovery";

const ALLOWED_METHODS = ["GET", "POST", "OPTIONS"];

/* =========================================================
   BASIC HELPERS
========================================================= */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400"
  };
}

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSpace(value) {
  return clean(value)
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, max = 900) {
  const text = normalizeSpace(value);

  if (text.length <= max) return text;

  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function lower(value) {
  return normalizeSpace(value).toLowerCase();
}

function unique(array) {
  return [...new Set(array.filter(Boolean))];
}

/* =========================================================
   TEXT / HTML CLEANING
========================================================= */

function stripHtml(input) {
  let text = String(input || "");

  // Remove scripts/styles/noscript
  text = text.replace(
    /<(script|style|noscript|template|svg|iframe|canvas|form)[^>]*>[\s\S]*?<\/\1>/gi,
    " "
  );

  // Remove comments
  text = text.replace(/<!--[\s\S]*?-->/g, " ");

  // Remove HTML tags
  text = text.replace(/<\/?[^>]+>/g, " ");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  return normalizeSpace(text);
}

function stripMarkdown(input) {
  let text = String(input || "");

  // Images
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, " ");

  // Links: [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Reference links
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");

  // Markdown headings
  text = text.replace(/^\s{0,3}#{1,6}\s*/gm, "");

  // Bold / italic
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");

  // Code
  text = text.replace(/`{1,3}[^`]*`{1,3}/g, " ");

  // Block quotes
  text = text.replace(/^\s*>\s?/gm, "");

  // Horizontal rules
  text = text.replace(/^\s*([-*_]){3,}\s*$/gm, "");

  // Raw URLs
  text = text.replace(/https?:\/\/\S+/gi, " ");

  return normalizeSpace(text);
}

function removeWebGarbage(input) {
  let text = String(input || "");

  const garbagePatterns = [
    // Shopify
    /\/cdn\/shop\/[^\s"'<>]+/gi,
    /cdn\.shopify\.com\/[^\s"'<>]+/gi,
    /\/collections\/[^\s"'<>]+/gi,
    /\/products\/[^\s"'<>]+/gi,
    /\/pages\/[^\s"'<>]+/gi,
    /\/blogs\/[^\s"'<>]+/gi,
    /\/cart[^\s"'<>]*/gi,
    /\/account[^\s"'<>]*/gi,

    // WordPress
    /\/wp-content\/[^\s"'<>]+/gi,
    /\/wp-includes\/[^\s"'<>]+/gi,

    // Common image references
    /https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s"'<>]*)?/gi,

    // Data / tracking
    /utm_[a-z_]+=[^\s&]+/gi,
    /fbclid=[^\s&]+/gi,

    // Template remnants
    /\{\{[\s\S]*?\}\}/g,
    /\{%[\s\S]*?%\}/g,

    // CSS / JS fragments
    /javascript:[^\s]+/gi,
    /data:image\/[^\s]+/gi,

    // Common scraping artifacts
    /\bskip to content\b/gi,
    /\bskip to main content\b/gi,
    /\bskip to navigation\b/gi,
    /\bmenu\b/gi,
    /\bsearch\b/gi,
    /\blogin\b/gi,
    /\bsign in\b/gi,
    /\bsubscribe\b/gi,
    /\bcart\b/gi,
    /\bwishlist\b/gi,
    /\bmy account\b/gi,
    /\bprivacy policy\b/gi,
    /\bterms and conditions\b/gi,
    /\bcookie policy\b/gi,
    /\baccept cookies\b/gi,

    // Repeated ecommerce labels
    /\badd to cart\b/gi,
    /\bquick view\b/gi,
    /\bcompare\b/gi,
    /\bcheckout\b/gi,

    // Image alt syntax
    /\balt="[^"]*"/gi,
    /\btitle="[^"]*"/gi,

    // Escaped HTML
    /&lt;[^&]+&gt;/gi
  ];

  for (const pattern of garbagePatterns) {
    text = text.replace(pattern, " ");
  }

  // Remove suspicious long URL-like fragments
  text = text.replace(
    /\b(?:https?:\/\/|www\.)[^\s]+/gi,
    " "
  );

  // Remove strings that are mostly symbols
  text = text.replace(
    /(?:[A-Za-z0-9+/=_-]{80,})/g,
    " "
  );

  return normalizeSpace(text);
}

function cleanContent(input) {
  let text = String(input || "");

  text = stripHtml(text);
  text = stripMarkdown(text);
  text = removeWebGarbage(text);

  // Remove duplicated punctuation
  text = text
    .replace(/\.{3,}/g, "…")
    .replace(/,{2,}/g, ",")
    .replace(/\|{2,}/g, " ")
    .replace(/-{4,}/g, " ");

  // Remove common search-page boilerplate
  text = text.replace(
    /\b(?:home|about us|contact us|our story|services|products|categories|resources)\b/gi,
    " "
  );

  return truncate(text, 1000);
}

/* =========================================================
   REQUIREMENT EXTRACTION
========================================================= */

function parseQuantity(value) {
  const text = normalizeSpace(value);

  if (!text) return "";

  const match = text.match(
    /([\d,]+(?:\.\d+)?)\s*(pairs?|pcs?|pieces?|units?|kg|tons?|tonnes?|sq\s*ft|sqft|m2|㎡|meters?|metres?)/i
  );

  return match ? normalizeSpace(match[0]) : text;
}

function parsePrice(value) {
  const text = normalizeSpace(value);

  if (!text) return "";

  const match = text.match(
    /(?:[$€£¥]\s*)?[\d,.]+(?:\s*[-–]\s*[$€£¥]?\s*[\d,.]+)?(?:\s*\/\s*[A-Za-z0-9 ]+)?/i
  );

  return match ? normalizeSpace(match[0]) : text;
}

function buildRequirement(body) {
  const requirement =
    body.requirement ||
    body.sourcingRequirement ||
    body.description ||
    body.query ||
    body.prompt ||
    body.whatAreYouSourcing ||
    "";

  const product =
    body.product ||
    body.material ||
    body.productMaterial ||
    body.product_material ||
    "";

  const quantity =
    body.quantity ||
    body.qty ||
    "";

  const targetPrice =
    body.targetPrice ||
    body.target_price ||
    body.price ||
    "";

  const destination =
    body.destination ||
    body.country ||
    body.market ||
    "";

  return {
    requirement: normalizeSpace(requirement),
    product: normalizeSpace(product),
    quantity: parseQuantity(quantity),
    targetPrice: parsePrice(targetPrice),
    destination: normalizeSpace(destination)
  };
}

/* =========================================================
   REQUIREMENT NORMALIZATION
========================================================= */

function normalizeRequirement(data) {
  let requirement = data.requirement;

  if (!requirement) {
    const parts = [];

    if (data.product) {
      parts.push(`Product / Material: ${data.product}`);
    }

    if (data.quantity) {
      parts.push(`Quantity: ${data.quantity}`);
    }

    if (data.targetPrice) {
      parts.push(`Target price: ${data.targetPrice}`);
    }

    if (data.destination) {
      parts.push(`Destination: ${data.destination}`);
    }

    requirement = parts.join(". ");
  }

  return {
    ...data,
    requirement: normalizeSpace(requirement)
  };
}

/* =========================================================
   KEYWORD EXTRACTION
========================================================= */

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "are",
  "you",
  "your",
  "want",
  "need",
  "needs",
  "sourcing",
  "source",
  "supplier",
  "suppliers",
  "manufacturing",
  "manufacturer",
  "company",
  "companies",
  "product",
  "material",
  "quantity",
  "destination",
  "target",
  "price",
  "shipping",
  "to",
  "of",
  "in",
  "on",
  "a",
  "an",
  "is",
  "be",
  "as",
  "at",
  "by",
  "or",
  "our",
  "their",
  "we",
  "it",
  "will",
  "can",
  "could",
  "would",
  "about",
  "into",
  "per"
]);

function tokenize(text) {
  return unique(
    lower(text)
      .replace(/[^a-z0-9\u4e00-\u9fff\s.-]/gi, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter((word) => word.length >= 3)
      .filter((word) => !STOP_WORDS.has(word))
  );
}

function importantKeywords(requirement) {
  const source = [
    requirement.product,
    requirement.requirement
  ].join(" ");

  return tokenize(source).slice(0, 30);
}

/* =========================================================
   SEARCH QUERY GENERATION
========================================================= */

function buildSearchQueries(requirement) {
  const product =
    requirement.product ||
    requirement.requirement ||
    "industrial product";

  const destination = requirement.destination;

  const base = cleanContent(product);

  const queries = [
    `"${base}" manufacturer supplier`,
    `"${base}" OEM manufacturer`,
    `"${base}" factory supplier`,
    `"${base}" wholesale manufacturer`,
    `${base} supplier factory manufacturing`
  ];

  if (destination) {
    queries.push(
      `"${base}" supplier ${destination}`,
      `${base} manufacturer export ${destination}`
    );
  }

  return unique(
    queries
      .map(normalizeSpace)
      .filter(Boolean)
  ).slice(0, 5);
}

/* =========================================================
   TAVILY
========================================================= */

async function tavilySearch(apiKey, query) {
  const response = await fetch(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        topic: "general",
        max_results: 8,
        include_answer: false,
        include_raw_content: false,
        include_images: false
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Tavily search failed (${response.status}): ${errorText.slice(0, 500)}`
    );
  }

  const data = await response.json();

  return Array.isArray(data.results)
    ? data.results
    : [];
}

/* =========================================================
   URL / DOMAIN HELPERS
========================================================= */

function getDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname
      .replace(/^www\./i, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function isValidUrl(url) {
  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch {
    return false;
  }
}

const BLOCKED_DOMAINS = [
  "picclick.com",
  "pinterest.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "reddit.com",
  "quora.com",
  "wikipedia.org",
  "amazon.com",
  "ebay.com",
  "etsy.com",
  "aliexpress.com",
  "alibaba.com",
  "made-in-china.com",
  "globalsources.com",
  "indiamart.com",
  "yellowpages.com",
  "yelp.com",
  "tripadvisor.com"
];

const BLOCKED_TITLE_WORDS = [
  "picclick",
  "cat treats",
  "raketten",
  "1win",
  "casino",
  "ivermectin",
  "stromectol",
  "aids no brasil",
  "download",
  "torrent",
  "recipe",
  "news article",
  "blog post",
  "how to"
];

function isBlockedDomain(domain) {
  if (!domain) return true;

  return BLOCKED_DOMAINS.some(
    (blocked) =>
      domain === blocked ||
      domain.endsWith("." + blocked)
  );
}

function isBlockedTitle(title) {
  const text = lower(title);

  return BLOCKED_TITLE_WORDS.some(
    (word) => text.includes(word)
  );
}

/* =========================================================
   COUNTRY DETECTION
========================================================= */

const COUNTRY_RULES = [
  ["China", [".cn", "china", "shenzhen", "guangzhou", "dongguan", "quanzhou", "fujian", "zhejiang", "jiangsu"]],
  ["India", [".in", "india", "kanpur", "agra", "delhi", "noida", "mumbai", "kolkata", "chennai"]],
  ["Vietnam", [".vn", "vietnam", "ho chi minh", "hanoi", "binh duong"]],
  ["Italy", [".it", "italy", "italian", "milan", "florence", "tuscany"]],
  ["Turkey", [".tr", "turkey", "istanbul", "izmir"]],
  ["Pakistan", [".pk", "pakistan", "sialkot", "karachi", "lahore"]],
  ["Bangladesh", [".bd", "bangladesh", "dhaka"]],
  ["Portugal", [".pt", "portugal"]],
  ["Spain", [".es", "spain", "spanish"]],
  ["Germany", [".de", "germany", "german"]],
  ["United States", [".us", "usa", "united states", "american"]],
  ["United Kingdom", [".uk", "uk", "united kingdom", "britain"]],
  ["Brazil", [".br", "brazil", "brasil"]]
];

function detectCountry(url, text, destination = "") {
  const haystack = lower(
    `${url} ${text} ${destination}`
  );

  for (const [country, rules] of COUNTRY_RULES) {
    for (const rule of rules) {
      if (haystack.includes(rule)) {
        return country;
      }
    }
  }

  return "Not determined";
}

/* =========================================================
   SUPPLIER DETECTION
========================================================= */

function cleanTitle(title) {
  let value = cleanContent(title);

  value = value
    .replace(/\s*[-|–—]\s*(home|homepage)$/i, "")
    .replace(/\s*\|\s*.*$/i, "")
    .replace(/\s*-\s*home$/i, "")
    .trim();

  return truncate(value, 180);
}

function inferCompany(title, domain) {
  let value = cleanTitle(title);

  // Remove obvious page-specific prefixes
  value = value
    .replace(
      /^(shoe upper leather archives|products?|services?|home)\s*[-|:]\s*/i,
      ""
    )
    .trim();

  if (!value && domain) {
    const root = domain.split(".")[0];

    return root
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return value || "Potential supplier";
}

function looksLikeSupplier(result) {
  const title = lower(result.title);
  const content = lower(result.content);
  const combined = `${title} ${content}`;

  const supplierSignals = [
    "manufacturer",
    "manufacturing",
    "factory",
    "supplier",
    "oem",
    "odm",
    "wholesale",
    "production",
    "producer",
    "workshop",
    "leather",
    "shoe",
    "footwear",
    "material"
  ];

  const score = supplierSignals.reduce(
    (total, word) =>
      total + (combined.includes(word) ? 1 : 0),
    0
  );

  return score >= 2;
}

/* =========================================================
   RELEVANCE SCORING
========================================================= */

function scoreSupplier(result, requirement) {
  const title = lower(result.title);
  const content = lower(result.cleanedContent);
  const url = lower(result.url);

  const combined = `${title} ${content} ${url}`;

  const keywords = importantKeywords(requirement);

  let score = 25;

  let keywordHits = 0;

  for (const keyword of keywords) {
    if (combined.includes(keyword)) {
      keywordHits++;
    }
  }

  score += Math.min(
    30,
    keywordHits * 4
  );

  // Supplier capability
  const capabilityWords = [
    "manufacturer",
    "manufacturing",
    "factory",
    "supplier",
    "oem",
    "odm",
    "production",
    "wholesale"
  ];

  const capabilityHits = capabilityWords.filter(
    (word) => combined.includes(word)
  ).length;

  score += Math.min(
    20,
    capabilityHits * 3
  );

  // Product-specific terms
  const productTerms = tokenize(
    requirement.product || requirement.requirement
  );

  const productHits = productTerms.filter(
    (term) => combined.includes(term)
  ).length;

  score += Math.min(
    15,
    productHits * 3
  );

  // Destination relevance
  if (
    requirement.destination &&
    combined.includes(lower(requirement.destination))
  ) {
    score += 5;
  }

  // Exact phrase bonus
  if (
    requirement.product &&
    combined.includes(lower(requirement.product))
  ) {
    score += 10;
  }

  // Penalties
  if (
    title.includes("guide") ||
    title.includes("article") ||
    title.includes("blog")
  ) {
    score -= 15;
  }

  if (
    combined.includes("marketplace") ||
    combined.includes("classifieds")
  ) {
    score -= 20;
  }

  if (
    combined.includes("cat treats") ||
    combined.includes("ivermectin") ||
    combined.includes("casino") ||
    combined.includes("1win")
  ) {
    score -= 60;
  }

  return Math.max(
    0,
    Math.min(
      99,
      Math.round(score)
    )
  );
}

/* =========================================================
   EVIDENCE EXTRACTION
========================================================= */

function extractEvidence(content, requirement) {
  const text = cleanContent(content);

  if (!text) {
    return "Public-web evidence was limited. Independent supplier verification is required.";
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(normalizeSpace)
    .filter(Boolean);

  const keywords = importantKeywords(requirement);

  const relevant = sentences.filter(
    (sentence) => {
      const lowerSentence = lower(sentence);

      return keywords.some(
        (keyword) =>
          lowerSentence.includes(keyword)
      );
    }
  );

  const selected =
    relevant.length > 0
      ? relevant.slice(0, 3)
      : sentences.slice(0, 2);

  const evidence = selected.join(" ");

  return truncate(
    evidence ||
      "Public-web evidence indicates potential manufacturing or supply capability. Independent verification is required.",
    850
  );
}

/* =========================================================
   RESULT NORMALIZATION
========================================================= */

function normalizeSearchResult(result, requirement) {
  const title = cleanTitle(result.title);
  const url = clean(result.url);
  const domain = getDomain(url);

  const rawContent =
    result.content ||
    result.description ||
    "";

  const cleanedContent =
    cleanContent(rawContent);

  const country = detectCountry(
    url,
    `${title} ${cleanedContent}`,
    requirement.destination
  );

  const normalized = {
    title,
    company: inferCompany(title, domain),
    url,
    website: url,
    domain,
    country,

    matchScore: 0,
    match: 0,

    evidence: "",
    description: "",

    verificationStatus:
      "Unverified — due diligence required",

    verified: false,

    sourceType: "Public web search",
    source: "Tavily",

    rawContent: undefined,
    cleanedContent
  };

  normalized.matchScore =
    scoreSupplier(
      normalized,
      requirement
    );

  normalized.match =
    normalized.matchScore;

  normalized.evidence =
    extractEvidence(
      cleanedContent,
      requirement
    );

  normalized.description =
    normalized.evidence;

  // Never expose raw scraped content to frontend
  delete normalized.rawContent;

  return normalized;
}

/* =========================================================
   RESULT VALIDATION
========================================================= */

function validSupplierCandidate(candidate, requirement) {
  if (!candidate.url) return false;

  if (!isValidUrl(candidate.url)) {
    return false;
  }

  if (!candidate.title) {
    return false;
  }

  if (isBlockedDomain(candidate.domain)) {
    return false;
  }

  if (isBlockedTitle(candidate.title)) {
    return false;
  }

  if (!looksLikeSupplier(candidate)) {
    return false;
  }

  if (candidate.matchScore < 35) {
    return false;
  }

  // Reject obviously polluted content
  const text = lower(
    `${candidate.title} ${candidate.evidence}`
  );

  const garbageSignals = [
    "{{",
    "}}",
    "cdn/shop",
    "skip to content",
    "javascript:",
    "utm_source",
    "data:image",
    "cat treats",
    "ivermectin",
    "stromectol",
    "1win"
  ];

  if (
    garbageSignals.some(
      (signal) =>
        text.includes(signal)
    )
  ) {
    return false;
  }

  // A supplier card should have actual evidence
  if (
    !candidate.evidence ||
    candidate.evidence.length < 25
  ) {
    return false;
  }

  return true;
}

/* =========================================================
   DEDUPLICATION
========================================================= */

function dedupeSuppliers(results) {
  const map = new Map();

  for (const result of results) {
    const key =
      result.domain ||
      result.url;

    if (!key) continue;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, result);
      continue;
    }

    if (
      result.matchScore >
      existing.matchScore
    ) {
      map.set(key, result);
    }
  }

  return [...map.values()];
}

/* =========================================================
   SORTING
========================================================= */

function sortSuppliers(results) {
  return [...results].sort(
    (a, b) => {
      if (
        b.matchScore !==
        a.matchScore
      ) {
        return (
          b.matchScore -
          a.matchScore
        );
      }

      return (
        a.title.length -
        b.title.length
      );
    }
  );
}

/* =========================================================
   READINESS
========================================================= */

function calculateReadiness(requirement) {
  const hasProduct =
    Boolean(requirement.product);

  const hasRequirement =
    Boolean(requirement.requirement);

  const hasQuantity =
    Boolean(requirement.quantity);

  const hasPrice =
    Boolean(requirement.targetPrice);

  const hasDestination =
    Boolean(requirement.destination);

  let requirementClarity = 40;
  let specificationQuality = 35;
  let commercialReadiness = 25;

  if (hasRequirement) {
    requirementClarity += 25;
  }

  if (hasProduct) {
    requirementClarity += 20;
    specificationQuality += 20;
  }

  if (hasQuantity) {
    commercialReadiness += 25;
    specificationQuality += 10;
  }

  if (hasPrice) {
    commercialReadiness += 30;
  }

  if (hasDestination) {
    requirementClarity += 15;
    commercialReadiness += 20;
  }

  return {
    requirementClarity: Math.min(
      100,
      requirementClarity
    ),

    specificationQuality: Math.min(
      100,
      specificationQuality
    ),

    commercialReadiness: Math.min(
      100,
      commercialReadiness
    )
  };
}

/* =========================================================
   CASEVO SCORE
========================================================= */

function calculateCasevoScore(
  requirement,
  suppliers,
  readiness
) {
  const supplierQuality =
    suppliers.length > 0
      ? Math.max(
          ...suppliers.map(
            (supplier) =>
              supplier.matchScore
          )
        )
      : 0;

  const readinessAverage =
    (
      readiness.requirementClarity +
      readiness.specificationQuality +
      readiness.commercialReadiness
    ) / 3;

  if (
    !requirement.product &&
    !requirement.requirement
  ) {
    return 0;
  }

  return Math.round(
    (
      readinessAverage * 0.45 +
      supplierQuality * 0.55
    )
  );
}

/* =========================================================
   REQUEST ID
========================================================= */

function createRequestId() {
  const random =
    crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random()
          .toString(36)
          .slice(2);

  return (
    "CASEVO-" +
    random
      .replace(/-/g, "")
      .slice(0, 12)
      .toUpperCase()
  );
}

/* =========================================================
   MAIN SOURCING ENGINE
========================================================= */

async function runSourcing(env, body) {
  const requestId =
    createRequestId();

  const parsed =
    normalizeRequirement(
      buildRequirement(body)
    );

  if (
    !parsed.requirement &&
    !parsed.product
  ) {
    return {
      ok: false,
      requestId,
      error: {
        code: "MISSING_REQUIREMENT",
        message:
          "Please describe what you want to source before running the analysis."
      }
    };
  }

  const apiKey =
    env.TAVILY_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      requestId,
      error: {
        code: "MISSING_TAVILY_API_KEY",
        message:
          "TAVILY_API_KEY is not configured in the Cloudflare Worker."
      }
    };
  }

  const queries =
    buildSearchQueries(parsed);

  const allResults = [];

  for (const query of queries) {
    try {
      const results =
        await tavilySearch(
          apiKey,
          query
        );

      for (const result of results) {
        allResults.push({
          ...result,
          searchQuery: query
        });
      }
    } catch (error) {
      console.error(
        "Tavily query failed:",
        query,
        error
      );
    }
  }

  const normalizedResults =
    allResults
      .filter(Boolean)
      .map((result) =>
        normalizeSearchResult(
          result,
          parsed
        )
      );

  const validResults =
    normalizedResults.filter(
      (candidate) =>
        validSupplierCandidate(
          candidate,
          parsed
        )
    );

  const suppliers =
    sortSuppliers(
      dedupeSuppliers(
        validResults
      )
    ).slice(0, 8);

  const readiness =
    calculateReadiness(
      parsed
    );

  const casevoScore =
    calculateCasevoScore(
      parsed,
      suppliers,
      readiness
    );

  const supplierMatches =
    suppliers.map(
      (supplier, index) => ({
        id:
          `supplier-${index + 1}`,

        rank:
          index + 1,

        supplier:
          supplier.company,

        company:
          supplier.company,

        title:
          supplier.title,

        name:
          supplier.title,

        country:
          supplier.country,

        location:
          supplier.country,

        matchScore:
          supplier.matchScore,

        match:
          supplier.matchScore,

        score:
          supplier.matchScore,

        url:
          supplier.url,

        website:
          supplier.website,

        evidence:
          supplier.evidence,

        description:
          supplier.description,

        verificationStatus:
          supplier.verificationStatus,

        verification:
          supplier.verificationStatus,

        verified:
          false
      })
    );

  return {
    ok: true,

    service:
      SERVICE,

    version:
      VERSION,

    engine:
      ENGINE,

    searchProvider:
      "Tavily",

    timestamp:
      new Date().toISOString(),

    requestId,

    // Frontend compatibility
    requestID:
      requestId,

    request: {
      requirement:
        parsed.requirement,

      product:
        parsed.product,

      material:
        parsed.product,

      quantity:
        parsed.quantity,

      targetPrice:
        parsed.targetPrice,

      destination:
        parsed.destination
    },

    sourcingRequirement: {
      product:
        parsed.product ||
        "Sourcing Requirement",

      material:
        parsed.product ||
        "Sourcing Requirement",

      quantity:
        parsed.quantity ||
        "Not specified",

      targetPrice:
        parsed.targetPrice ||
        "Not specified",

      destination:
        parsed.destination ||
        "Not specified"
    },

    analysis: {
      completed:
        true,

      status:
        "completed",

      message:
        "CASEVO supplier discovery completed successfully.",

      casevoScore,

      score:
        casevoScore,

      readiness,

      sourcingReadiness:
        readiness,

      supplierCount:
        supplierMatches.length,

      supplierMatches,

      suppliers:
        supplierMatches,

      results:
        supplierMatches
    },

    // Also expose results at root level
    supplierMatches,

    suppliers:
      supplierMatches,

    results:
      supplierMatches,

    casevoScore,

    score:
      casevoScore,

    readiness,

    sourcingReadiness:
      readiness,

    verificationNotice:
      "CASEVO identifies potential supplier capabilities from public-web information. Company identity, manufacturing capability, certifications, MOQ, production capacity, pricing and contact information should be independently verified before placing an order.",

    nextStep:
      "Human Verification",

    notice:
      "These public-web supplier matches are illustrative and unverified. CASEVO recommends independent due diligence before commercial engagement."
  };
}

/* =========================================================
   HEALTH CHECK
========================================================= */

function healthResponse(env) {
  return {
    ok: true,

    service:
      SERVICE,

    version:
      VERSION,

    engine:
      ENGINE,

    searchProvider:
      "Tavily",

    tavilyConfigured:
      Boolean(
        env.TAVILY_API_KEY
      ),

    timestamp:
      new Date().toISOString()
  };
}

/* =========================================================
   REQUEST BODY
========================================================= */

async function parseBody(request) {
  const contentType =
    request.headers.get(
      "content-type"
    ) || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }

  const text =
    await request.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    const params =
      new URLSearchParams(text);

    return Object.fromEntries(
      params.entries()
    );
  }
}

/* =========================================================
   CLOUDFLARE ENTRYPOINT
========================================================= */

export default {
  async fetch(request, env) {
    try {
      const method =
        request.method.toUpperCase();

      if (
        !ALLOWED_METHODS.includes(
          method
        )
      ) {
        return json(
          {
            ok: false,
            error: {
              code:
                "METHOD_NOT_ALLOWED",
              message:
                "Only GET, POST and OPTIONS are supported."
            }
          },
          405
        );
      }

      if (
        method === "OPTIONS"
      ) {
        return new Response(
          null,
          {
            status: 204,
            headers:
              corsHeaders()
          }
        );
      }

      const url =
        new URL(request.url);

      /* -----------------------------------------
         HEALTH / ROOT
      ----------------------------------------- */

      if (
        method === "GET"
      ) {
        return json(
          healthResponse(env)
        );
      }

      /* -----------------------------------------
         POST SOURCING
      ----------------------------------------- */

      if (
        method === "POST"
      ) {
        const body =
          await parseBody(
            request
          );

        const result =
          await runSourcing(
            env,
            body
          );

        if (!result.ok) {
          return json(
            result,
            400
          );
        }

        return json(
          result,
          200
        );
      }

      return json(
        {
          ok: false,
          error: {
            code:
              "UNSUPPORTED_REQUEST",
            message:
              "Unsupported request."
          }
        },
        400
      );
    } catch (error) {
      console.error(
        "CASEVO Worker error:",
        error
      );

      return json(
        {
          ok: false,

          service:
            SERVICE,

          version:
            VERSION,

          error: {
            code:
              "WORKER_ERROR",

            message:
              "The sourcing analysis request failed.",

            detail:
              error &&
              error.message
                ? error.message
                : "Unknown error"
          },

          requestId:
            createRequestId()
        },
        500
      );
    }
  }
};
