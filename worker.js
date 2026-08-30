/**
 * ============================================================
 * CASEVO AI SOURCING — REAL SUPPLIER DISCOVERY ENGINE
 * Version 2.1.0
 *
 * POST /api/sourcing
 * GET  /api/health
 *
 * Engine:
 * Tavily Web Search
 *
 * Purpose:
 * Discover real manufacturers, factories, OEM/ODM suppliers
 * and exporters from the public web.
 * ============================================================
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /*
     * ----------------------------------------------------------
     * CORS
     * ----------------------------------------------------------
     */

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    /*
     * ----------------------------------------------------------
     * HEALTH CHECK
     * ----------------------------------------------------------
     */

    if (
      url.pathname === "/api/health" &&
      request.method === "GET"
    ) {
      return jsonResponse({
        ok: true,
        service: "CASEVO AI Sourcing",
        version: "2.1.0",
        engine: "Tavily Real Supplier Discovery",
        timestamp: new Date().toISOString()
      });
    }

    /*
     * ----------------------------------------------------------
     * SOURCING API
     * ----------------------------------------------------------
     */

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

    /*
     * ----------------------------------------------------------
     * STATIC WEBSITE
     * ----------------------------------------------------------
     */

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


/**
 * ============================================================
 * SOURCING REQUEST
 * ============================================================
 */

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

  /*
   * ----------------------------------------------------------
   * Read user requirements
   * ----------------------------------------------------------
   */

  const requirement = clean(body.requirement);
  const product = clean(body.product);
  const quantity = clean(body.quantity);
  const targetPrice = clean(body.targetPrice);
  const destination = clean(body.destination);

  /*
   * ----------------------------------------------------------
   * Validation
   * ----------------------------------------------------------
   */

  if (!requirement) {
    return jsonResponse(
      {
        ok: false,
        error: "Please enter a sourcing requirement."
      },
      400
    );
  }

  /*
   * ----------------------------------------------------------
   * Build sourcing brief
   * ----------------------------------------------------------
   *
   * IMPORTANT:
   *
   * destination = buyer/import destination
   *
   * It is NOT automatically the supplier country.
   *
   * Example:
   *
   * Leather
   * 5,000 pairs
   * USA
   *
   * means:
   *
   * "Find suppliers capable of supplying this product
   * for delivery/export to USA."
   *
   * It does NOT mean:
   *
   * "Find suppliers located in USA."
   */

  const analysis = {
    product:
      product || extractProduct(requirement),

    quantity:
      quantity || extractQuantity(requirement),

    targetPrice:
      targetPrice || extractPrice(requirement),

    destination:
      destination || extractDestination(requirement),

    requirement
  };

  /*
   * ----------------------------------------------------------
   * Check API key
   * ----------------------------------------------------------
   */

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

  /*
   * ----------------------------------------------------------
   * REAL SUPPLIER DISCOVERY
   * ----------------------------------------------------------
   */

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
        "Real supplier discovery completed successfully.",

      analysis,

      matches,

      meta: {
        source:
          "CASEVO AI Sourcing Engine",

        engine:
          "Tavily Real Supplier Discovery",

        supplierData:
          "Public web search",

        verified:
          false,

        verificationNote:
          "CASEVO identifies public-web supplier candidates. Commercial verification and supplier due diligence are required before placing orders.",

        searchQueries:
          searchResult.searchQueries || [],

        resultsScanned:
          searchResult.results?.length || 0,

        suppliersReturned:
          matches.length,

        creditsUsed:
          searchResult.usage?.credits || null,

        timestamp:
          new Date().toISOString()
      }
    });

  } catch (error) {
    return jsonResponse(
      {
        ok: false,

        error:
          "Supplier web search failed.",

        details:
          error?.message ||
          "Unknown search error."
      },
      502
    );
  }
}


/**
 * ============================================================
 * TAVILY REAL SUPPLIER SEARCH
 * ============================================================
 *
 * We intentionally perform multiple focused searches.
 *
 * Search 1:
 * Product + manufacturer + factory
 *
 * Search 2:
 * Product + OEM/ODM + exporter
 *
 * Search 3:
 * Product + supplier + manufacturing
 *
 * The results are merged and deduplicated.
 *
 * The buyer destination is NOT inserted as a supplier
 * location.
 * ============================================================
 */

async function searchSuppliersWithTavily(
  analysis,
  apiKey
) {
  const product =
    analysis.product ||
    analysis.requirement;

  const requirement =
    analysis.requirement ||
    product;

  /*
   * ----------------------------------------------------------
   * Build focused search queries
   * ----------------------------------------------------------
   */

  const queries = [
    buildManufacturerQuery(product, requirement),
    buildOEMQuery(product, requirement),
    buildExporterQuery(product, requirement)
  ];

  /*
   * ----------------------------------------------------------
   * Run searches in parallel
   * ----------------------------------------------------------
   */

  const responses =
    await Promise.all(
      queries.map(query =>
        tavilySearch(
          query,
          apiKey
        )
      )
    );

  /*
   * ----------------------------------------------------------
   * Merge results
   * ----------------------------------------------------------
   */

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
      if (!result || !result.url) {
        continue;
      }

      allResults.push({
        ...result,

        _searchQuery:
          queries[i]
      });
    }
  }

  /*
   * ----------------------------------------------------------
   * Remove duplicate URLs
   * ----------------------------------------------------------
   */

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


/**
 * ============================================================
 * SEARCH QUERY BUILDERS
 * ============================================================
 */

function buildManufacturerQuery(
  product,
  requirement
) {
  return [
    `"${product}"`,
    "manufacturer",
    "factory",
    "supplier",
    "production",
    "OEM",
    requirement
  ]
    .filter(Boolean)
    .join(" ");
}


function buildOEMQuery(
  product,
  requirement
) {
  return [
    `"${product}"`,
    "OEM",
    "ODM",
    "manufacturer",
    "factory",
    "custom production",
    requirement
  ]
    .filter(Boolean)
    .join(" ");
}


function buildExporterQuery(
  product,
  requirement
) {
  return [
    `"${product}"`,
    "manufacturer",
    "exporter",
    "factory",
    "wholesale",
    "B2B",
    requirement
  ]
    .filter(Boolean)
    .join(" ");
}


/**
 * ============================================================
 * SINGLE TAVILY SEARCH
 * ============================================================
 */

async function tavilySearch(
  query,
  apiKey
) {
  const response =
    await fetch(
      "https://api.tavily.com/search",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          query,

          topic:
            "general",

          search_depth:
            "basic",

          max_results:
            10,

          include_answer:
            false,

          include_raw_content:
            false,

          include_images:
            false,

          exclude_domains: [
            "facebook.com",
            "instagram.com",
            "linkedin.com",
            "youtube.com",
            "pinterest.com",
            "reddit.com",
            "amazon.com",
            "ebay.com",
            "alibaba.com",
            "aliexpress.com",
            "made-in-china.com",
            "globalsources.com",
            "indiamart.com",
            "tradeindia.com",
            "yellowpages.com",
            "yelp.com"
          ]
        })
      }
    );

  const data =
    await safeJson(response);

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.error ||
      `Tavily API returned HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}


/**
 * ============================================================
 * DEDUPLICATION
 * ============================================================
 */

function deduplicateResults(
  results
) {
  const seenUrls =
    new Set();

  const seenDomains =
    new Set();

  const output = [];

  for (const result of results) {
    const url =
      normalizeUrl(
        result.url
      );

    const domain =
      getDomain(
        result.url
      );

    if (!url || !domain) {
      continue;
    }

    /*
     * Exact URL duplicate
     */

    if (seenUrls.has(url)) {
      continue;
    }

    /*
     * Same domain appearing repeatedly.
     *
     * We keep the first strong result from each domain.
     */

    if (seenDomains.has(domain)) {
      continue;
    }

    seenUrls.add(url);
    seenDomains.add(domain);

    output.push({
      ...result,
      url
    });
  }

  return output;
}


/**
 * ============================================================
 * NORMALIZE SUPPLIER RESULTS
 * ============================================================
 */

function normalizeSupplierResults(
  results,
  analysis
) {
  const candidates =
    results
      .filter(
        result =>
          result &&
          result.url
      )

      /*
       * Remove obvious non-supplier pages.
       */

      .filter(
        result =>
          !isLowValuePage(
            result
          )
      )

      .map(
        result => {
          const domain =
            getDomain(
              result.url
            );

          const score =
            calculateMatchScore(
              result,
              analysis
            );

          const supplierType =
            detectSupplierType(
              result
            );

          return {
            result,
            domain,
            score,
            supplierType
          };
        }
      )

      /*
       * Highest-quality suppliers first.
       */

      .sort(
        (a, b) =>
          b.score -
          a.score
      )

      /*
       * Return top 10.
       */

      .slice(0, 10);

  return candidates.map(
    (candidate, index) => {
      const result =
        candidate.result;

      const domain =
        candidate.domain;

      return {
        rank:
          index + 1,

        name:
          cleanSupplierName(
            result.title,
            domain,
            result.content
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
          result.url,

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

        evidence:
          clean(
            result.content ||
            ""
          ).slice(
            0,
            900
          )
      };
    }
  );
}


/**
 * ============================================================
 * LOW-VALUE PAGE FILTER
 * ============================================================
 *
 * These pages are often SEO content rather than actual
 * supplier/company websites.
 * ============================================================
 */

function isLowValuePage(
  result
) {
  const title =
    clean(
      result.title ||
      ""
    ).toLowerCase();

  const content =
    clean(
      result.content ||
      ""
    ).toLowerCase();

  const url =
    clean(
      result.url ||
      ""
    ).toLowerCase();

  const combined =
    `${title} ${content} ${url}`;

  /*
   * Obvious content/SEO page signals.
   */

  const badKeywords = [
    "top 10",
    "top 5",
    "best manufacturers",
    "best suppliers",
    "quick guide",
    "ultimate guide",
    "buyers guide",
    "buyer's guide",
    "list of",
    "directory",
    "blog",
    "article",
    "news",
    "journal",
    "magazine",
    "review",
    "reviews",
    "comparison",
    "how to",
    "what is",
    "market report",
    "industry report"
  ];

  for (
    const keyword of badKeywords
  ) {
    if (
      combined.includes(keyword)
    ) {
      return true;
    }
  }

  /*
   * URL path signals.
   */

  const badPathPatterns = [
    "/blog/",
    "/blogs/",
    "/news/",
    "/article/",
    "/articles/",
    "/magazine/",
    "/journal/",
    "/category/",
    "/tag/",
    "/search/",
    "/directory/"
  ];

  for (
    const pattern of badPathPatterns
  ) {
    if (
      url.includes(pattern)
    ) {
      return true;
    }
  }

  return false;
}


/**
 * ============================================================
 * MATCH SCORING
 * ============================================================
 *
 * Score = 0–99
 *
 * Strong signals:
 *
 * + manufacturer
 * + factory
 * + OEM / ODM
 * + exporter
 * + production
 * + product relevance
 * + company domain
 *
 * Negative signals:
 *
 * - article
 * - directory
 * - review
 * - generic content
 * ============================================================
 */

function calculateMatchScore(
  result,
  analysis
) {
  const title =
    clean(
      result.title ||
      ""
    );

  const content =
    clean(
      result.content ||
      ""
    );

  const url =
    clean(
      result.url ||
      ""
    );

  const text =
    (
      title +
      " " +
      content +
      " " +
      url
    ).toLowerCase();

  const product =
    clean(
      analysis.product ||
      ""
    ).toLowerCase();

  /*
   * Tavily relevance score.
   */

  let score =
    Number(
      result.score || 0
    ) * 55;

  /*
   * Product relevance.
   */

  if (
    product &&
    text.includes(product)
  ) {
    score += 18;
  }

  /*
   * Break product into useful terms.
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

  let matchedProductWords =
    0;

  for (
    const word of productWords
  ) {
    if (
      text.includes(word)
    ) {
      matchedProductWords++;
    }
  }

  if (
    productWords.length > 0
  ) {
    score +=
      Math.min(
        12,
        (
          matchedProductWords /
          productWords.length
        ) * 12
      );
  }

  /*
   * Strong supplier signals.
   */

  const strongSignals = [
    "manufacturer",
    "manufacturing",
    "factory",
    "production",
    "producer"
  ];

  for (
    const keyword of strongSignals
  ) {
    if (
      text.includes(keyword)
    ) {
      score += 5;
    }
  }

  /*
   * Commercial capability signals.
   */

  const commercialSignals = [
    "oem",
    "odm",
    "exporter",
    "wholesale",
    "custom",
    "b2b"
  ];

  for (
    const keyword of commercialSignals
  ) {
    if (
      text.includes(keyword)
    ) {
      score += 3;
    }
  }

  /*
   * Factory-related signals.
   */

  const factorySignals = [
    "factory",
    "production line",
    "production facility",
    "manufacturing facility",
    "manufacturing plant",
    "workshop"
  ];

  for (
    const keyword of factorySignals
  ) {
    if (
      text.includes(keyword)
    ) {
      score += 4;
    }
  }

  /*
   * Company/contact signals.
   */

  const companySignals = [
    "contact us",
    "contact",
    "email",
    "phone",
    "address",
    "company",
    "about us"
  ];

  for (
    const keyword of companySignals
  ) {
    if (
      text.includes(keyword)
    ) {
      score += 1.5;
    }
  }

  /*
   * Penalize obvious content pages.
   */

  const penalties = [
    "top 10",
    "top 5",
    "quick guide",
    "best suppliers",
    "best manufacturers",
    "review",
    "directory",
    "blog",
    "news"
  ];

  for (
    const keyword of penalties
  ) {
    if (
      text.includes(keyword)
    ) {
      score -= 12;
    }
  }

  /*
   * Cap score.
   */

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


/**
 * ============================================================
 * SUPPLIER TYPE
 * ============================================================
 */

function detectSupplierType(
  result
) {
  const text =
    (
      (result.title || "") +
      " " +
      (result.content || "") +
      " " +
      (result.url || "")
    ).toLowerCase();

  if (
    text.includes("manufacturer") ||
    text.includes("manufacturing") ||
    text.includes("factory")
  ) {
    return "Manufacturer / Factory";
  }

  if (
    text.includes("oem") ||
    text.includes("odm")
  ) {
    return "OEM / ODM Supplier";
  }

  if (
    text.includes("exporter")
  ) {
    return "Manufacturer / Exporter";
  }

  if (
    text.includes("supplier")
  ) {
    return "Supplier";
  }

  return "Potential Supplier";
}


/**
 * ============================================================
 * CAPABILITY SUMMARY
 * ============================================================
 */

function buildCapability(
  result,
  analysis
) {
  const content =
    clean(
      result.content ||
      ""
    );

  const product =
    analysis.product ||
    "the requested product";

  /*
   * Use the real search evidence.
   *
   * Do not invent manufacturing capabilities.
   */

  if (content) {
    return (
      `Public-web evidence indicates potential capability related to ${product}. ` +
      content.slice(
        0,
        500
      )
    );
  }

  return (
    `Public-web result related to ${product}. `
    +
    `Supplier capability requires direct verification.`
  );
}


/**
 * ============================================================
 * SUPPLIER NAME
 * ============================================================
 */

function cleanSupplierName(
  title,
  domain,
  content
) {
  let value =
    clean(
      title ||
      ""
    );

  /*
   * Remove common title suffixes.
   */

  value =
    value
      .replace(
        /\s*[|–—]\s*(official website|official site|home|homepage)$/i,
        ""
      )
      .replace(
        /\s*-\s*official website.*$/i,
        ""
      )
      .trim();

  /*
   * If title looks like an article/listicle,
   * use domain instead of pretending the article title
   * is a company name.
   */

  const titleLooksLikeArticle =
    /^(top|best|how|why|what|guide|list|review)/i
      .test(value);

  if (
    titleLooksLikeArticle &&
    domain
  ) {
    return companyNameFromDomain(
      domain
    );
  }

  if (
    !value &&
    domain
  ) {
    return companyNameFromDomain(
      domain
    );
  }

  return (
    value ||
    companyNameFromDomain(
      domain
    ) ||
    "Potential supplier"
  ).slice(
    0,
    180
  );
}


/**
 * ============================================================
 * COMPANY NAME FROM DOMAIN
 * ============================================================
 */

function companyNameFromDomain(
  domain
) {
  if (!domain) {
    return "";
  }

  const parts =
    domain
      .replace(
        /^www\./i,
        ""
      )
      .split(".");

  if (
    parts.length < 2
  ) {
    return domain;
  }

  const name =
    parts[0]
      .replace(
        /[-_]+/g,
        " "
      )
      .trim();

  if (!name) {
    return domain;
  }

  return name
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase()
    );
}


/**
 * ============================================================
 * DOMAIN
 * ============================================================
 */

function getDomain(
  url
) {
  try {
    return new URL(url)
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


/**
 * ============================================================
 * WEBSITE ROOT
 * ============================================================
 */

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
    return url || "";
  }
}


/**
 * ============================================================
 * URL NORMALIZATION
 * ============================================================
 */

function normalizeUrl(
  url
) {
  try {
    const parsed =
      new URL(url);

    parsed.hash = "";

    /*
     * Remove common tracking parameters.
     */

    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid"
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


/**
 * ============================================================
 * LOCATION INFERENCE
 * ============================================================
 */

function inferLocation(
  result,
  analysis
) {
  const text =
    (
      (result.title || "") +
      " " +
      (result.content || "") +
      " " +
      (result.url || "")
    ).toLowerCase();

  const countries = [
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
    "United States",
    "USA",
    ,
    "Mexico",
    "Brazil",
    "South Korea",
    "Japan",
    "Taiwan",
    "Cambodia",
    "Malaysia",
    "Poland",
    "Romania",
    "France"
  ];

  for (
    const country of countries
  ) {
    if (
      text.includes(
        country.toLowerCase()
      )
    ) {
      return country;
    }
  }

  return "Not determined";
}


/**
 * ============================================================
 * TEXT HELPERS
 * ============================================================
 */

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


/**
 * ============================================================
 * PRODUCT EXTRACTION
 * ============================================================
 */

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

  const productKeywords = [
    "leather shoe upper",
    "shoe upper leather",
    "cow leather",
    "upper leather",
    "shoe leather",
    "genuine leather",
    "synthetic leather",
    "pu leather",
    "microfiber leather",
    "leather",
    "sneaker",
    "footwear",
    "shoe",
    "fabric",
    "textile",
    "rubber",
    "sole",
    "eva",
    "tpr",
    "material"
  ];

  for (
    const keyword of productKeywords
  ) {
    if (
      lower.includes(keyword)
    ) {
      return keyword;
    }
  }

  return "";
}


/**
 * ============================================================
 * QUANTITY EXTRACTION
 * ============================================================
 */

function extractQuantity(
  text
) {
  const value =
    clean(text);

  const match =
    value.match(
      /(\d[\d,.\s]*)\s*(pairs?|pcs?|pieces?|kg|tons?|mt|sqm|sqft|square meters?|units?)/i
    );

  if (!match) {
    return "";
  }

  return match[0].trim();
}


/**
 * ============================================================
 * PRICE EXTRACTION
 * ============================================================
 */

function extractPrice(
  text
) {
  const value =
    clean(text);

  const match =
    value.match(
      /(?:usd|us\$|\$)\s*[\d,.]+(?:\s*(?:per|\/)\s*[a-zA-Z0-9 ]+)?/i
    );

  if (!match) {
    return "";
  }

  return match[0].trim();
}


/**
 * ============================================================
 * DESTINATION EXTRACTION
 * ============================================================
 */

function extractDestination(
  text
) {
  const value =
    clean(text);

  const destinations = [
    "USA",
    "United States",
    "UK",
    "United Kingdom",
    "Canada",
    "Australia",
    "Germany",
    "France",
    "Italy",
    "Spain",
    "Japan",
    "South Korea",
    "UAE",
    "Saudi Arabia",
    "India",
    "Singapore",
    "Vietnam",
    "Indonesia",
    "Thailand",
    "Turkey",
    "Mexico",
    "Brazil"
  ];

  const lower =
    value.toLowerCase();

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


/**
 * ============================================================
 * SAFE JSON
 * ============================================================
 */

async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}


/**
 * ============================================================
 * REQUEST ID
 * ============================================================
 */

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


/**
 * ============================================================
 * JSON RESPONSE
 * ============================================================
 */

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


/**
 * ============================================================
 * CORS
 * ============================================================
 */

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
