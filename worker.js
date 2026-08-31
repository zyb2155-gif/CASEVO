/**
 * ============================================================
 * CASEVO AI SOURCING ENGINE
 * FINAL CLEAN SUPPLIER DISCOVERY WORKER
 * ============================================================
 *
 * Endpoints:
 *   POST /api/sourcing
 *   GET  /api/health
 *
 * Frontend contract:
 *   analysis.product
 *   analysis.quantity
 *   analysis.targetPrice
 *   analysis.destination
 *   analysis.requirement
 *
 *   matches[]
 *     name
 *     location
 *     website
 *     sourceUrl
 *     domain
 *     supplierType
 *     capability
 *     matchScore
 *     source
 *     verificationStatus
 *     contactEmail
 *     contactPhone
 *     evidence
 *
 * Important:
 * - Public-web candidates are NOT verified suppliers.
 * - No supplier identity is invented.
 * - Directory / marketplace / article / spam pages are filtered.
 * - Raw webpage content is never returned directly to frontend.
 * ============================================================
 */

const VERSION = "4.0.0";

const MAX_SEARCH_RESULTS_PER_QUERY = 10;
const MAX_SUPPLIERS_RETURNED = 10;

const MIN_SUPPLIER_SCORE = 48;

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

const EXCLUDED_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "pinterest.com",
  "reddit.com",
  "tiktok.com",
  "x.com",
  "twitter.com",

  "amazon.com",
  "ebay.com",
  "alibaba.com",
  "aliexpress.com",
  "made-in-china.com",
  "globalsources.com",
  "indiamart.com",
  "tradeindia.com",

  "justdial.com",
  "yellowpages.com",
  "yelp.com",
  "thomasnet.com",
  "kompass.com",
  "europages.com",
  "picclick.com",

  "wikipedia.org",

  "quora.com",
  "medium.com",
  "substack.com",

  "wordpress.com",
  "blogspot.com",

  "craigslist.org",

  "reddit.com"
];

const EXCLUDED_TLDS = [
  ".gov",
  ".edu"
];

const ARTICLE_KEYWORDS = [
  "top 5",
  "top 10",
  "top 20",
  "top 50",
  "top manufacturers",
  "top suppliers",
  "top factories",
  "best manufacturers",
  "best suppliers",
  "best factories",
  "best companies",
  "list of suppliers",
  "list of manufacturers",
  "supplier list",
  "manufacturer list",
  "factory list",

  "directory",
  "directories",
  "marketplace",
  "supplier directory",
  "manufacturer directory",

  "buyer guide",
  "buyers guide",
  "buyer's guide",
  "ultimate guide",
  "quick guide",
  "how to",
  "what is",
  "why choose",

  "blog",
  "blogs",
  "article",
  "articles",
  "news",
  "journal",
  "magazine",
  "press release",

  "review",
  "reviews",
  "comparison",
  "comparisons",

  "market report",
  "industry report",
  "market analysis",
  "industry analysis",

  "price list",
  "catalog",
  "catalogue"
];

const DIRECTORY_PATHS = [
  "/directory/",
  "/directories/",
  "/listing/",
  "/listings/",
  "/category/",
  "/categories/",
  "/tag/",
  "/tags/",
  "/blog/",
  "/blogs/",
  "/news/",
  "/article/",
  "/articles/",
  "/magazine/",
  "/journal/",
  "/search/",
  "/search?",
  "/reviews/",
  "/review/"
];

const STRONG_MANUFACTURER_SIGNALS = [
  "manufacturer",
  "manufacturing",
  "factory",
  "production facility",
  "manufacturing facility",
  "manufacturing plant",
  "production plant",
  "production line",
  "own factory",
  "our factory",
  "our manufacturing",
  "our production"
];

const COMMERCIAL_SIGNALS = [
  "oem",
  "odm",
  "private label",
  "custom manufacturing",
  "custom production",
  "export",
  "exporter",
  "wholesale",
  "b2b"
];

const COMPANY_SIGNALS = [
  "about us",
  "about our company",
  "contact us",
  "contact",
  "company profile",
  "our company",
  "our products",
  "our factory",
  "our facility",
  "our production"
];

const PRODUCT_SIGNAL_GROUPS = [
  ["leather", "hide", "cowhide", "full grain"],
  ["shoe", "footwear", "upper"],
  ["sneaker"],
  ["rubber", "eva", "tpr"],
  ["textile", "fabric", "mesh"],
  ["microfiber", "synthetic leather", "pu leather"]
];


/* ============================================================
   ENTRY
   ============================================================ */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (
      url.pathname === "/api/health" &&
      request.method === "GET"
    ) {
      return jsonResponse({
        ok: true,
        service: "CASEVO AI Sourcing",
        version: VERSION,
        engine: "CASEVO Real Supplier Discovery",
        searchProvider: "Tavily",
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/sourcing") {
      if (request.method !== "POST") {
        return jsonResponse(
          {
            ok: false,
            error: "Method not allowed. Use POST /api/sourcing."
          },
          405
        );
      }

      return handleSourcingRequest(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      "CASEVO Worker is running, but ASSETS binding is missing.",
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain;charset=UTF-8"
        }
      }
    );
  }
};


/* ============================================================
   SOURCING REQUEST
   ============================================================ */

async function handleSourcingRequest(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid JSON request body."
      },
      400
    );
  }

  const requirement = clean(body?.requirement);
  const inputProduct = clean(body?.product);
  const inputQuantity = clean(body?.quantity);
  const inputTargetPrice = clean(body?.targetPrice);
  const inputDestination = clean(body?.destination);

  if (!requirement) {
    return jsonResponse(
      {
        ok: false,
        error: "Please enter a sourcing requirement."
      },
      400
    );
  }

  const analysis = {
    requirement,

    product:
      inputProduct ||
      extractProduct(requirement),

    quantity:
      inputQuantity ||
      extractQuantity(requirement),

    targetPrice:
      inputTargetPrice ||
      extractPrice(requirement),

    destination:
      inputDestination ||
      extractDestination(requirement)
  };

  if (!env.TAVILY_API_KEY) {
    return jsonResponse(
      {
        ok: false,
        error:
          "TAVILY_API_KEY is not configured in Cloudflare Worker secrets."
      },
      500
    );
  }

  try {
    const searchResult =
      await searchSuppliersWithTavily(
        analysis,
        env.TAVILY_API_KEY
      );

    const matches =
      normalizeSupplierResults(
        searchResult.results || [],
        analysis
      );

    const requestId =
      createRequestId();

    return jsonResponse({
      ok: true,

      requestId,

      message:
        "CASEVO supplier discovery completed successfully.",

      analysis,

      matches,

      meta: {
        source:
          "CASEVO AI Sourcing Engine",

        engine:
          "CASEVO Real Supplier Discovery",

        supplierData:
          "Public web search",

        verified:
          false,

        verificationNote:
          "CASEVO identifies public-web supplier candidates. Supplier identity, manufacturing capability, certifications, MOQ and commercial terms require independent verification before placing an order.",

        searchQueries:
          searchResult.searchQueries || [],

        resultsScanned:
          searchResult.results?.length || 0,

        suppliersReturned:
          matches.length,

        creditsUsed:
          searchResult.usage?.credits ?? null,

        timestamp:
          new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(
      "CASEVO sourcing error:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error: "Supplier web search failed.",
        details:
          error?.message ||
          "Unknown search error."
      },
      502
    );
  }
}


/* ============================================================
   SEARCH
   ============================================================ */

async function searchSuppliersWithTavily(
  analysis,
  apiKey
) {
  const product =
    analysis.product ||
    analysis.requirement;

  const requirement =
    analysis.requirement;

  const queries =
    buildSearchQueries(
      product,
      requirement
    );

  const responses =
    await Promise.all(
      queries.map(
        query =>
          tavilySearch(
            query,
            apiKey
          )
      )
    );

  const allResults = [];

  for (
    let i = 0;
    i < responses.length;
    i++
  ) {
    const data =
      responses[i];

    const results =
      Array.isArray(data?.results)
        ? data.results
        : [];

    for (const result of results) {
      if (
        !result ||
        !result.url
      ) {
        continue;
      }

      allResults.push({
        ...result,

        _searchQuery:
          queries[i]
      });
    }
  }

  const deduplicated =
    deduplicateResults(
      allResults
    );

  return {
    results:
      deduplicated,

    searchQueries:
      queries,

    usage: {
      credits:
        responses.reduce(
          (sum, item) =>
            sum +
            Number(
              item?.usage?.credits || 0
            ),
          0
        )
    }
  };
}


/* ============================================================
   QUERY BUILDERS
   ============================================================ */

function buildSearchQueries(
  product,
  requirement
) {
  const cleanProduct =
    clean(product);

  const queries = [];

  queries.push(
    `"${cleanProduct}" China manufacturer factory`
  );

  queries.push(
    `"${cleanProduct}" China OEM manufacturer`
  );

  queries.push(
    `"${cleanProduct}" China factory supplier`
  );

  /*
   * Requirement-specific query.
   * Limit its size so a huge user description does not
   * pollute Tavily search.
   */

  const shortRequirement =
    clean(requirement)
      .slice(0, 280);

  if (
    shortRequirement &&
    shortRequirement
      .toLowerCase()
      !==
      cleanProduct
        .toLowerCase()
  ) {
    queries.push(
      `"${cleanProduct}" China manufacturer "${shortRequirement}"`
    );
  }

  return uniqueStrings(
    queries
      .map(clean)
      .filter(Boolean)
  );
}


/* ============================================================
   TAVILY
   ============================================================ */

async function tavilySearch(
  query,
  apiKey
) {
  const response =
    await fetch(
      TAVILY_ENDPOINT,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${apiKey}`
        },

        body:
          JSON.stringify({
            query,

            topic:
              "general",

            search_depth:
              "advanced",

            max_results:
              MAX_SEARCH_RESULTS_PER_QUERY,

            include_answer:
              false,

            include_raw_content:
              false,

            include_images:
              false,

            exclude_domains:
              EXCLUDED_DOMAINS
          })
      }
    );

  const data =
    await safeJson(response);

  if (!response.ok) {
    throw new Error(
      data?.detail ||
      data?.error ||
      `Tavily API returned HTTP ${response.status}`
    );
  }

  return data;
}


/* ============================================================
   RESULT DEDUPLICATION
   ============================================================ */

function deduplicateResults(
  results
) {
  const byDomain =
    new Map();

  for (const result of results) {
    if (
      !result ||
      !result.url
    ) {
      continue;
    }

    const url =
      normalizeUrl(
        result.url
      );

    const domain =
      getDomain(
        url
      );

    if (
      !url ||
      !domain
    ) {
      continue;
    }

    if (
      isExcludedDomain(domain)
    ) {
      continue;
    }

    const candidate = {
      ...result,
      url
    };

    const previous =
      byDomain.get(
        domain
      );

    if (!previous) {
      byDomain.set(
        domain,
        candidate
      );
      continue;
    }

    /*
     * Keep the result with stronger supplier evidence.
     */

    const previousScore =
      rawSearchQuality(
        previous
      );

    const currentScore =
      rawSearchQuality(
        candidate
      );

    if (
      currentScore >
      previousScore
    ) {
      byDomain.set(
        domain,
        candidate
      );
    }
  }

  return Array.from(
    byDomain.values()
  );
}


/* ============================================================
   NORMALIZE SUPPLIERS
   ============================================================ */

function normalizeSupplierResults(
  results,
  analysis
) {
  const candidates = [];

  for (const result of results) {
    if (
      !result ||
      !result.url
    ) {
      continue;
    }

    const domain =
      getDomain(
        result.url
      );

    if (
      !domain ||
      isExcludedDomain(domain)
    ) {
      continue;
    }

    if (
      isLowValuePage(
        result
      )
    ) {
      continue;
    }

    const score =
      calculateMatchScore(
        result,
        analysis
      );

    if (
      score <
      MIN_SUPPLIER_SCORE
    ) {
      continue;
    }

    const supplierType =
      detectSupplierType(
        result
      );

    /*
     * A result must contain actual company/manufacturing
     * evidence. Merely matching the product is not enough.
     */

    if (
      !hasRealSupplierEvidence(
        result
      )
    ) {
      continue;
    }

    candidates.push({
      result,
      domain,
      score,
      supplierType
    });
  }

  candidates.sort(
    (a, b) =>
      b.score -
      a.score
  );

  const selected =
    candidates.slice(
      0,
      MAX_SUPPLIERS_RETURNED
    );

  return selected.map(
    (candidate, index) =>
      buildSupplierRecord(
        candidate,
        analysis,
        index
      )
  );
}


/* ============================================================
   SUPPLIER RECORD
   ============================================================ */

function buildSupplierRecord(
  candidate,
  analysis,
  index
) {
  const result =
    candidate.result;

  const domain =
    candidate.domain;

  const contact =
    extractContactInfo(
      result
    );

  return {
    rank:
      index + 1,

    name:
      cleanSupplierName(
        result,
        domain
      ),

    location:
      inferLocation(
        result,
        analysis
      ),

    website:
      getWebsiteRoot(
        result.url
      ),

    sourceUrl:
      normalizeUrl(
        result.url
      ),

    domain,

    supplierType:
      candidate.supplierType,

    capability:
      buildCapability(
        result,
        analysis
      ),

    matchScore:
      candidate.score,

    source:
      "Public web search",

    verificationStatus:
      "Unverified — due diligence required",

    contactEmail:
      contact.email,

    contactPhone:
      contact.phone,

    evidence:
      buildEvidence(
        result,
        analysis
      )
  };
}


/* ============================================================
   LOW VALUE FILTER
   ============================================================ */

function isLowValuePage(
  result
) {
  const title =
    clean(
      result.title
    ).toLowerCase();

  const content =
    clean(
      result.content
    ).toLowerCase();

  const url =
    clean(
      result.url
    ).toLowerCase();

  const combined =
    `${title} ${content} ${url}`;

  for (
    const keyword of ARTICLE_KEYWORDS
  ) {
    if (
      combined.includes(
        keyword
      )
    ) {
      return true;
    }
  }

  for (
    const path of DIRECTORY_PATHS
  ) {
    if (
      url.includes(
        path
      )
    ) {
      return true;
    }
  }

  const domain =
    getDomain(
      url
    );

  if (
    isExcludedDomain(
      domain
    )
  ) {
    return true;
  }

  /*
   * Pages containing obvious list/article language
   * are not treated as supplier identity pages.
   */

  if (
    /\b(top|best|list|guide|review|directory|comparison)\b/i
      .test(title)
  ) {
    return true;
  }

  /*
   * Search-result pages and generic product pages
   * are weak supplier evidence.
   */

  if (
    /\/(search|results|tag|category)\b/i
      .test(url)
  ) {
    return true;
  }

  return false;
}


/* ============================================================
   EXCLUDED DOMAIN
   ============================================================ */

function isExcludedDomain(
  domain
) {
  const value =
    clean(domain)
      .toLowerCase();

  if (!value) {
    return true;
  }

  for (
    const excluded of EXCLUDED_DOMAINS
  ) {
    if (
      value === excluded ||
      value.endsWith(
        "." + excluded
      )
    ) {
      return true;
    }
  }

  for (
    const tld of EXCLUDED_TLDS
  ) {
    if (
      value.endsWith(tld)
    ) {
      return true;
    }
  }

  return false;
}


/* ============================================================
   REAL SUPPLIER EVIDENCE
   ============================================================ */

function hasRealSupplierEvidence(
  result
) {
  const title =
    clean(
      result.title
    );

  const content =
    clean(
      result.content
    );

  const url =
    clean(
      result.url
    );

  const text =
    `${title} ${content} ${url}`
      .toLowerCase();

  let strongSignals = 0;

  for (
    const signal of STRONG_MANUFACTURER_SIGNALS
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      strongSignals++;
    }
  }

  let commercialSignals = 0;

  for (
    const signal of COMMERCIAL_SIGNALS
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      commercialSignals++;
    }
  }

  let companySignals = 0;

  for (
    const signal of COMPANY_SIGNALS
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      companySignals++;
    }
  }

  /*
   * Strongest case:
   * manufacturer/factory + company evidence.
   */

  if (
    strongSignals >= 1 &&
    companySignals >= 1
  ) {
    return true;
  }

  /*
   * Manufacturer + commercial capability.
   */

  if (
    strongSignals >= 1 &&
    commercialSignals >= 1
  ) {
    return true;
  }

  /*
   * Multiple strong production signals.
   */

  if (
    strongSignals >= 2
  ) {
    return true;
  }

  return false;
}


/* ============================================================
   MATCH SCORE
   ============================================================ */

function calculateMatchScore(
  result,
  analysis
) {
  const title =
    clean(
      result.title
    );

  const content =
    clean(
      result.content
    );

  const url =
    clean(
      result.url
    );

  const text =
    `${title} ${content} ${url}`
      .toLowerCase();

  const product =
    clean(
      analysis.product
    ).toLowerCase();

  let score = 0;

  /*
   * Tavily relevance score.
   */

  const tavilyScore =
    Number(
      result.score || 0
    );

  if (
    Number.isFinite(
      tavilyScore
    )
  ) {
    score += Math.min(
      25,
      tavilyScore * 25
    );
  }

  /*
   * Exact product match.
   */

  if (
    product &&
    text.includes(
      product
    )
  ) {
    score += 25;
  }

  /*
   * Product word match.
   */

  const productWords =
    product
      .split(
        /[\s,\/\-]+/
      )
      .filter(
        word =>
          word.length >= 3
      );

  if (
    productWords.length
  ) {
    let matched = 0;

    for (
      const word of productWords
    ) {
      if (
        text.includes(
          word
        )
      ) {
        matched++;
      }
    }

    const ratio =
      matched /
      productWords.length;

    score +=
      Math.min(
        15,
        ratio * 15
      );
  }

  /*
   * Manufacturer evidence.
   */

  let manufacturerCount = 0;

  for (
    const signal of STRONG_MANUFACTURER_SIGNALS
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      manufacturerCount++;
    }
  }

  score +=
    Math.min(
      20,
      manufacturerCount * 5
    );

  /*
   * Commercial evidence.
   */

  let commercialCount = 0;

  for (
    const signal of COMMERCIAL_SIGNALS
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      commercialCount++;
    }
  }

  score +=
    Math.min(
      10,
      commercialCount * 2
    );

  /*
   * Company evidence.
   */

  let companyCount = 0;

  for (
    const signal of COMPANY_SIGNALS
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      companyCount++;
    }
  }

  score +=
    Math.min(
      10,
      companyCount * 2
    );

  /*
   * China preference.
   */

  const chinaSignals = [
    "china",
    "chinese",
    "guangdong",
    "guangzhou",
    "dongguan",
    "foshan",
    "shenzhen",
    "zhejiang",
    "wenzhou",
    "yiwu",
    "fujian",
    "quanzhou",
    "jinjiang",
    "putian",
    "jiangsu",
    "sichuan",
    "hebei"
  ];

  if (
    chinaSignals.some(
      signal =>
        text.includes(
          signal
        )
    )
  ) {
    score += 5;
  }

  /*
   * Penalties.
   */

  const penaltyTerms = [
    "directory",
    "marketplace",
    "top 10",
    "top 20",
    "top 50",
    "best suppliers",
    "best manufacturers",
    "review",
    "reviews",
    "blog",
    "article",
    "news",
    "list of suppliers"
  ];

  for (
    const term of penaltyTerms
  ) {
    if (
      text.includes(
        term
      )
    ) {
      score -= 20;
    }
  }

  /*
   * Domain quality.
   */

  const domain =
    getDomain(
      url
    );

  if (
    domain &&
    !isExcludedDomain(
      domain
    )
  ) {
    score += 3;
  }

  return Math.round(
    Math.max(
      0,
      Math.min(
        99,
        score
      )
    )
  );
}


/* ============================================================
   RAW SEARCH QUALITY
   ============================================================ */

function rawSearchQuality(
  result
) {
  const title =
    clean(
      result.title
    );

  const content =
    clean(
      result.content
    );

  const text =
    `${title} ${content}`
      .toLowerCase();

  let score = 0;

  for (
    const signal of STRONG_MANUFACTURER_SIGNALS
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      score += 5;
    }
  }

  for (
    const signal of COMMERCIAL_SIGNALS
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      score += 2;
    }
  }

  if (
    text.includes(
      "contact us"
    )
  ) {
    score += 3;
  }

  if (
    text.includes(
      "about us"
    )
  ) {
    score += 3;
  }

  if (
    text.includes(
      "our factory"
    )
  ) {
    score += 5;
  }

  const tavilyScore =
    Number(
      result.score || 0
    );

  if (
    Number.isFinite(
      tavilyScore
    )
  ) {
    score +=
      tavilyScore * 10;
  }

  return score;
}


/* ============================================================
   SUPPLIER TYPE
   ============================================================ */

function detectSupplierType(
  result
) {
  const text =
    (
      clean(result.title) +
      " " +
      clean(result.content)
    ).toLowerCase();

  if (
    text.includes(
      "manufacturer"
    ) ||
    text.includes(
      "manufacturing"
    ) ||
    text.includes(
      "factory"
    )
  ) {
    if (
      text.includes("oem") ||
      text.includes("odm")
    ) {
      return "Manufacturer / OEM / ODM";
    }

    return "Manufacturer / Factory";
  }

  if (
    text.includes("exporter")
  ) {
    return "Manufacturer / Exporter";
  }

  if (
    text.includes("oem") ||
    text.includes("odm")
  ) {
    return "OEM / ODM Manufacturer";
  }

  return "Potential Manufacturer";
}


/* ============================================================
   CAPABILITY
   ============================================================ */

function buildCapability(
  result,
  analysis
) {
  const product =
    clean(
      analysis.product
    ) ||
    "the requested product";

  const content =
    sanitizeWebText(
      result.content
    );

  const title =
    sanitizeWebText(
      result.title
    );

  const pieces = [];

  if (
    title
  ) {
    pieces.push(
      title
    );
  }

  if (
    content
  ) {
    pieces.push(
      content
    );
  }

  let evidence =
    pieces.join(
      " — "
    );

  evidence =
    truncateSentence(
      evidence,
      420
    );

  if (
    evidence
  ) {
    return (
      `Public-web evidence indicates potential manufacturing or supply capability related to ${product}. ` +
      evidence
    );
  }

  return (
    `Public-web result related to ${product}. ` +
    `Supplier manufacturing capability requires direct verification.`
  );
}


/* ============================================================
   EVIDENCE
   ============================================================ */

function buildEvidence(
  result,
  analysis
) {
  const title =
    sanitizeWebText(
      result.title
    );

  const content =
    sanitizeWebText(
      result.content
    );

  const product =
    clean(
      analysis.product
    );

  const combined =
    `${title} ${content}`;

  const relevant =
    extractRelevantEvidence(
      combined,
      product
    );

  return truncateSentence(
    relevant ||
    content ||
    title ||
    "Public-web result returned for supplier review.",
    520
  );
}


/* ============================================================
   RELEVANT EVIDENCE
   ============================================================ */

function extractRelevantEvidence(
  text,
  product
) {
  const cleaned =
    sanitizeWebText(
      text
    );

  if (
    !cleaned
  ) {
    return "";
  }

  const sentences =
    cleaned
      .split(
        /(?<=[.!?])\s+/
      )
      .map(clean)
      .filter(Boolean);

  if (
    !sentences.length
  ) {
    return cleaned;
  }

  const productWords =
    clean(product)
      .toLowerCase()
      .split(
        /[\s,\/\-]+/
      )
      .filter(
        word =>
          word.length >= 3
      );

  const ranked =
    sentences.map(
      sentence => {
        const lower =
          sentence.toLowerCase();

        let score = 0;

        for (
          const word of productWords
        ) {
          if (
            lower.includes(
              word
            )
          ) {
            score += 3;
          }
        }

        for (
          const signal of STRONG_MANUFACTURER_SIGNALS
        ) {
          if (
            lower.includes(
              signal
            )
          ) {
            score += 5;
          }
        }

        for (
          const signal of COMMERCIAL_SIGNALS
        ) {
          if (
            lower.includes(
              signal
            )
          ) {
            score += 2;
          }
        }

        return {
          sentence,
          score
        };
      }
    );

  ranked.sort(
    (a, b) =>
      b.score -
      a.score
  );

  return ranked
    .slice(
      0,
      3
    )
    .map(
      item =>
        item.sentence
    )
    .join(
      " "
    );
}


/* ============================================================
   SUPPLIER NAME
   ============================================================ */

function cleanSupplierName(
  result,
  domain
) {
  let title =
    clean(
      result.title
    );

  title =
    sanitizeWebText(
      title
    );

  /*
   * Remove common search-result suffixes.
   */

  title =
    title.replace(
      /\s*[|–—-]\s*(official website|official site|home|homepage)$/i,
      ""
    );

  /*
   * Article-style titles are not company names.
   */

  if (
    looksLikeArticleTitle(
      title
    )
  ) {
    title = "";
  }

  /*
   * If title is too long, it is likely a page title rather
   * than a clean company identity.
   */

  if (
    title.length > 120
  ) {
    title = "";
  }

  if (
    title
  ) {
    return title.slice(
      0,
      120
    );
  }

  return (
    companyNameFromDomain(
      domain
    ) ||
    "Potential manufacturer"
  );
}


/* ============================================================
   ARTICLE TITLE
   ============================================================ */

function looksLikeArticleTitle(
  title
) {
  const value =
    clean(title)
      .toLowerCase();

  if (!value) {
    return true;
  }

  return (
    /^(top|best|how|why|what|guide|list|review|directory|comparison)\b/i
      .test(value) ||
    value.includes(
      "suppliers in "
    ) ||
    value.includes(
      "manufacturers in "
    ) ||
    value.includes(
      "factories in "
    )
  );
}


/* ============================================================
   DOMAIN
   ============================================================ */

function getDomain(
  url
) {
  try {
    return new URL(
      url
    )
      .hostname
      .replace(
        /^www\./i,
        ""
      )
      .toLowerCase();
  } catch {
    return "";
  }
}


/* ============================================================
   COMPANY FROM DOMAIN
   ============================================================ */

function companyNameFromDomain(
  domain
) {
  const value =
    clean(domain);

  if (!value) {
    return "";
  }

  const parts =
    value.split(".");

  if (
    parts.length < 2
  ) {
    return value;
  }

  const name =
    parts[0]
      .replace(
        /[-_]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (!name) {
    return value;
  }

  return name
    .split(" ")
    .map(
      word =>
        word
          ? word.charAt(0).toUpperCase() +
            word.slice(1)
          : ""
    )
    .join(" ");
}


/* ============================================================
   WEBSITE ROOT
   ============================================================ */

function getWebsiteRoot(
  url
) {
  try {
    const parsed =
      new URL(url);

    return (
      parsed.protocol +
      "//" +
      parsed.hostname
    );
  } catch {
    return "";
  }
}


/* ============================================================
   URL NORMALIZATION
   ============================================================ */

function normalizeUrl(
  url
) {
  try {
    const parsed =
      new URL(url);

    parsed.hash = "";

    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "ref",
      "source"
    ];

    for (
      const parameter of trackingParams
    ) {
      parsed.searchParams.delete(
        parameter
      );
    }

    return parsed.toString();
  } catch {
    return "";
  }
}


/* ============================================================
   LOCATION
   ============================================================ */

function inferLocation(
  result,
  analysis
) {
  const text =
    (
      clean(result.title) +
      " " +
      clean(result.content) +
      " " +
      clean(result.url)
    ).toLowerCase();

  /*
   * More specific locations must come first.
   */

  const locations = [
    "Guangzhou, China",
    "Dongguan, China",
    "Foshan, China",
    "Shenzhen, China",
    "Wenzhou, China",
    "Yiwu, China",
    "Quanzhou, China",
    "Jinjiang, China",
    "Putian, China",

    "Guangdong, China",
    "Zhejiang, China",
    "Fujian, China",
    "Jiangsu, China",
    "Sichuan, China",
    "Hebei, China",

    "United States",
    "United Kingdom",
    "South Korea",
    "Saudi Arabia",

    "USA",
    "UK",

    "China",
    "India",
    "Vietnam",
    "Indonesia",
    "Thailand",
    "Bangladesh",
    "Pakistan",
    "Turkey",
    "Italy",
    "Spain",
    "Portugal",
    "Germany",
    "Mexico",
    "Brazil",
    "Japan",
    "Taiwan",
    "Cambodia",
    "Malaysia",
    "Poland",
    "Romania",
    "France"
  ];

  for (
    const location of locations
  ) {
    if (
      text.includes(
        location.toLowerCase()
      )
    ) {
      return location;
    }
  }

  return "Not determined";
}


/* ============================================================
   CONTACT
   ============================================================ */

function extractContactInfo(
  result
) {
  /*
   * Current Tavily request does not ask for raw_content.
   * We only use the returned public snippet.
   */

  const text =
    sanitizeWebText(
      result.content
    );

  const emailMatch =
    text.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );

  const phoneMatch =
    text.match(
      /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{1,4})?/
    );

  return {
    email:
      emailMatch
        ? emailMatch[0]
        : "",

    phone:
      phoneMatch
        ? clean(
            phoneMatch[0]
          )
        : ""
  };
}


/* ============================================================
   WEB TEXT SANITIZATION
   ============================================================ */

function sanitizeWebText(
  value
) {
  let text =
    clean(
      value
    );

  if (!text) {
    return "";
  }

  /*
   * Remove markdown images.
   */

  text =
    text.replace(
      /!\[[^\]]*\]\([^)]+\)/g,
      ""
    );

  /*
   * Convert markdown links to visible text.
   */

  text =
    text.replace(
      /\[([^\]]+)\]\([^)]+\)/g,
      "$1"
    );

  /*
   * Remove URLs.
   */

  text =
    text.replace(
      /https?:\/\/\S+/gi,
      ""
    );

  /*
   * Remove HTML tags.
   */

  text =
    text.replace(
      /<[^>]*>/g,
      " "
    );

  /*
   * Remove common navigation garbage.
   */

  text =
    text.replace(
      /\b(cookie policy|privacy policy|terms of use|subscribe now|sign up now)\b/gi,
      ""
    );

  /*
   * Remove repeated punctuation.
   */

  text =
    text.replace(
      /([|])\1+/g,
      "$1"
    );

  text =
    text.replace(
      /([.])\1{3,}/g,
      "..."
    );

  text =
    text.replace(
      /\s+/g,
      " "
    );

  return text.trim();
}


/* ============================================================
   TRUNCATION
   ============================================================ */

function truncateSentence(
  value,
  maxLength
) {
  const text =
    clean(value);

  if (
    text.length <=
    maxLength
  ) {
    return text;
  }

  const shortened =
    text.slice(
      0,
      maxLength
    );

  const lastSpace =
    shortened.lastIndexOf(
      " "
    );

  if (
    lastSpace > 120
  ) {
    return (
      shortened
        .slice(
          0,
          lastSpace
        )
        .trim() +
      "..."
    );
  }

  return (
    shortened.trim() +
    "..."
  );
}


/* ============================================================
   INPUT: PRODUCT
   ============================================================ */

function extractProduct(
  text
) {
  const value =
    clean(text);

  if (!value) {
    return "";
  }

  const lower =
    value.toLowerCase();

  const products = [
    {
      match:
        "premium full-grain leather shoe upper",
      value:
        "Premium full-grain leather shoe upper"
    },

    {
      match:
        "full-grain leather shoe upper",
      value:
        "Premium full-grain leather shoe upper"
    },

    {
      match:
        "full grain leather shoe upper",
      value:
        "Premium full-grain leather shoe upper"
    },

    {
      match:
        "leather shoe upper",
      value:
        "Leather shoe upper"
    },

    {
      match:
        "shoe upper leather",
      value:
        "Leather shoe upper"
    },

    {
      match:
        "upper leather",
      value:
        "Upper leather"
    },

    {
      match:
        "genuine leather",
      value:
        "Genuine leather"
    },

    {
      match:
        "cow leather",
      value:
        "Cow leather"
    },

    {
      match:
        "cowhide",
      value:
        "Cowhide"
    },

    {
      match:
        "microfiber leather",
      value:
        "Microfiber leather"
    },

    {
      match:
        "synthetic leather",
      value:
        "Synthetic leather"
    },

    {
      match:
        "pu leather",
      value:
        "PU leather"
    },

    {
      match:
        "rubber",
      value:
        "Rubber"
    },

    {
      match:
        "eva",
      value:
        "EVA"
    },

    {
      match:
        "tpr",
      value:
        "TPR"
    },

    {
      match:
        "textile",
      value:
        "Textile"
    },

    {
      match:
        "fabric",
      value:
        "Fabric"
    },

    {
      match:
        "sneaker",
      value:
        "Sneaker"
    },

    {
      match:
        "footwear",
      value:
        "Footwear"
    },

    {
      match:
        "shoe",
      value:
        "Shoe"
    }
  ];

  for (
    const item of products
  ) {
    if (
      lower.includes(
        item.match
      )
    ) {
      return item.value;
    }
  }

  return "";
}


/* ============================================================
   INPUT: QUANTITY
   ============================================================ */

function extractQuantity(
  text
) {
  const value =
    clean(text);

  const match =
    value.match(
      /(\d[\d,.\s]*)\s*(pairs?|pcs?|pieces?|kg|tons?|mt|sqm|sqft|square meters?|units?)/i
    );

  return match
    ? clean(match[0])
    : "";
}


/* ============================================================
   INPUT: PRICE
   ============================================================ */

function extractPrice(
  text
) {
  const value =
    clean(text);

  const match =
    value.match(
      /(?:usd|us\$|\$)\s*[\d,.]+(?:\s*(?:per|\/)\s*[a-zA-Z0-9 ]+)?/i
    );

  return match
    ? clean(match[0])
    : "";
}


/* ============================================================
   INPUT: DESTINATION
   ============================================================ */

function extractDestination(
  text
) {
  const value =
    clean(text);

  const lower =
    value.toLowerCase();

  const destinations = [
    "United States",
    "USA",
    "United Kingdom",
    "UK",
    "Canada",
    "Australia",
    "Germany",
    "France",
    "Italy",
    "Spain",
    "Japan",
    "South Korea",
    "Singapore",
    "India",
    "Vietnam",
    "Indonesia",
    "Thailand",
    "Turkey",
    "Mexico",
    "Brazil",
    "UAE",
    "Saudi Arabia"
  ];

  for (
    const destination of destinations
  ) {
    if (
      lower.includes(
        destination.toLowerCase()
      )
    ) {
      return destination;
    }
  }

  return "";
}


/* ============================================================
   UTILITIES
   ============================================================ */

function clean(
  value
) {
  if (
    value === null ||
    typeof value === "undefined"
  ) {
    return "";
  }

  return String(value)
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(
      0,
      5000
    );
}


function uniqueStrings(
  values
) {
  return Array.from(
    new Set(
      values
        .map(clean)
        .filter(Boolean)
    )
  );
}


async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}


function createRequestId() {
  const timestamp =
    Date.now()
      .toString(36)
      .toUpperCase();

  const random =
    Math.random()
      .toString(36)
      .substring(
        2,
        8
      )
      .toUpperCase();

  return (
    "CASEVO-" +
    timestamp +
    "-" +
    random
  );
}


function jsonResponse(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status,

      headers: {
        ...corsHeaders(),

        "Content-Type":
          "application/json; charset=UTF-8",

        "Cache-Control":
          "no-store"
      }
    }
  );
}


function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type, Accept"
  };
}
