/**
 * CASEVO AI SOURCING ENGINE
 * Version 3.0
 *
 * Purpose:
 * - Discover real manufacturers and factories
 * - Prioritize China sourcing
 * - Filter out directories, marketplaces and low-value pages
 * - Score supplier relevance
 * - Preserve the existing CASEVO frontend API
 *
 * Endpoints:
 * POST /api/sourcing
 * GET  /api/health
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ---------------------------------------------------------
    // CORS
    // ---------------------------------------------------------

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    // ---------------------------------------------------------
    // HEALTH CHECK
    // ---------------------------------------------------------

    if (
      url.pathname === "/api/health" &&
      request.method === "GET"
    ) {
      return jsonResponse({
        ok: true,
        service: "CASEVO AI Sourcing",
        version: "3.0.0",
        engine: "CASEVO Real Supplier Discovery",
        searchProvider: "Tavily",
        timestamp: new Date().toISOString()
      });
    }

    // ---------------------------------------------------------
    // SOURCING API
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // STATIC WEBSITE
    // ---------------------------------------------------------

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


// =============================================================
// SOURCING REQUEST
// =============================================================

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
  const product = clean(body?.product);
  const quantity = clean(body?.quantity);
  const targetPrice = clean(body?.targetPrice);
  const destination = clean(body?.destination);

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
    product:
      product ||
      extractProduct(requirement),

    quantity:
      quantity ||
      extractQuantity(requirement),

    targetPrice:
      targetPrice ||
      extractPrice(requirement),

    destination:
      destination ||
      extractDestination(requirement),

    requirement
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

        verified: false,

        verificationNote:
          "CASEVO identifies public-web supplier candidates. Commercial verification, factory validation and supplier due diligence are required before placing orders.",

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


// =============================================================
// SEARCH ENGINE
// =============================================================

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

  const queries = [
    buildChinaManufacturerQuery(
      product,
      requirement
    ),

    buildChinaFactoryQuery(
      product,
      requirement
    ),

    buildChinaOEMQuery(
      product,
      requirement
    ),

    buildExportManufacturerQuery(
      product,
      requirement
    )
  ];

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
              item?.usage?.credits ||
              0
            ),
          0
        )
    }
  };
}


// =============================================================
// QUERY BUILDERS
// =============================================================

function buildChinaManufacturerQuery(
  product,
  requirement
) {
  return [
    `"${product}"`,
    "China",
    "manufacturer",
    "factory",
    "production",
    "supplier",
    "official website",
    requirement
  ]
    .filter(Boolean)
    .join(" ");
}


function buildChinaFactoryQuery(
  product,
  requirement
) {
  return [
    `"${product}"`,
    "China factory",
    "manufacturer",
    "production facility",
    "factory",
    "OEM",
    "supplier",
    requirement
  ]
    .filter(Boolean)
    .join(" ");
}


function buildChinaOEMQuery(
  product,
  requirement
) {
  return [
    `"${product}"`,
    "China",
    "OEM",
    "ODM",
    "manufacturer",
    "factory",
    "custom production",
    "export",
    requirement
  ]
    .filter(Boolean)
    .join(" ");
}


function buildExportManufacturerQuery(
  product,
  requirement
) {
  return [
    `"${product}"`,
    "China",
    "manufacturer",
    "exporter",
    "factory",
    "B2B",
    "international",
    "production",
    requirement
  ]
    .filter(Boolean)
    .join(" ");
}


// =============================================================
// TAVILY
// =============================================================

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

        body:
          JSON.stringify({
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

              "justdial.com",
              "yellowpages.com",
              "yelp.com",

              "thomasnet.com",
              "kompass.com",
              "europages.com",

              "wikipedia.org"
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


// =============================================================
// RESULT DEDUPLICATION
// =============================================================

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

    if (
      !url ||
      !domain
    ) {
      continue;
    }

    if (
      seenUrls.has(url)
    ) {
      continue;
    }

    if (
      seenDomains.has(domain)
    ) {
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


// =============================================================
// NORMALIZE SUPPLIER RESULTS
// =============================================================

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

      .filter(
        candidate =>
          candidate.score >= 35
      )

      .sort(
        (a, b) =>
          b.score -
          a.score
      )

      .slice(
        0,
        10
      );

  return candidates.map(
    (candidate, index) => {
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

        contactEmail:
          contact.email,

        contactPhone:
          contact.phone,

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


// =============================================================
// LOW VALUE / DIRECTORY FILTER
// =============================================================

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

  const badKeywords = [
    "top 10",
    "top 20",
    "top 50",
    "top 5",

    "best manufacturers",
    "best suppliers",
    "best factories",

    "quick guide",
    "ultimate guide",
    "buyers guide",
    "buyer's guide",

    "list of",
    "directory",
    "directories",

    "marketplace",
    "supplier directory",

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
    "industry report",

    "price list",
    "catalog"
  ];

  for (
    const keyword of badKeywords
  ) {
    if (
      combined.includes(
        keyword
      )
    ) {
      return true;
    }
  }

  const badDomains = [
    "justdial.com",
    "yellowpages.com",
    "yelp.com",
    "kompass.com",
    "europages.com",
    "thomasnet.com"
  ];

  for (
    const domain of badDomains
  ) {
    if (
      url.includes(domain)
    ) {
      return true;
    }
  }

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
    "/directory/",
    "/directories/",
    "/listing/",
    "/listings/"
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


// =============================================================
// MATCH SCORE
// =============================================================

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

  let score =
    Number(
      result.score ||
      0
    ) * 55;


  // ---------------------------------------------------------
  // Product relevance
  // ---------------------------------------------------------

  if (
    product &&
    text.includes(product)
  ) {
    score += 22;
  }

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
    score += Math.min(
      15,
      (
        matchedProductWords /
        productWords.length
      ) * 15
    );
  }


  // ---------------------------------------------------------
  // China relevance
  // ---------------------------------------------------------

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

  for (
    const keyword of chinaSignals
  ) {
    if (
      text.includes(keyword)
    ) {
      score += 5;
    }
  }


  // ---------------------------------------------------------
  // Manufacturer signals
  // ---------------------------------------------------------

  const strongSignals = [
    "manufacturer",
    "manufacturing",
    "factory",
    "production",
    "producer",
    "production facility",
    "manufacturing facility",
    "manufacturing plant"
  ];

  for (
    const keyword of strongSignals
  ) {
    if (
      text.includes(keyword)
    ) {
      score += 6;
    }
  }


  // ---------------------------------------------------------
  // Commercial signals
  // ---------------------------------------------------------

  const commercialSignals = [
    "oem",
    "odm",
    "exporter",
    "export",
    "wholesale",
    "custom",
    "b2b",
    "private label"
  ];

  for (
    const keyword of commercialSignals
  ) {
    if (
      text.includes(keyword)
    ) {
      score += 4;
    }
  }


  // ---------------------------------------------------------
  // Factory signals
  // ---------------------------------------------------------

  const factorySignals = [
    "production line",
    "production facility",
    "manufacturing facility",
    "manufacturing plant",
    "factory",
    "workshop",
    "plant",
    "facility"
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


  // ---------------------------------------------------------
  // Company credibility signals
  // ---------------------------------------------------------

  const companySignals = [
    "contact us",
    "contact",
    "email",
    "phone",
    "address",
    "company",
    "about us",
    "our factory",
    "our production",
    "our products"
  ];

  for (
    const keyword of companySignals
  ) {
    if (
      text.includes(keyword)
    ) {
      score += 2;
    }
  }


  // ---------------------------------------------------------
  // Penalties
  // ---------------------------------------------------------

  const penalties = [
    "top 10",
    "top 20",
    "top 50",

    "quick guide",
    "best suppliers",
    "best manufacturers",

    "review",
    "directory",
    "directories",

    "marketplace",
    "listing",

    "blog",
    "news"
  ];

  for (
    const keyword of penalties
  ) {
    if (
      text.includes(keyword)
    ) {
      score -= 15;
    }
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


// =============================================================
// SUPPLIER TYPE
// =============================================================

function detectSupplierType(
  result
) {
  const text =
    (
      result.title ||
      ""
    ) +
    " " +
    (
      result.content ||
      ""
    ) +
    " " +
    (
      result.url ||
      ""
    );

  const lower =
    text.toLowerCase();

  if (
    lower.includes(
      "manufacturer"
    ) ||
    lower.includes(
      "manufacturing"
    ) ||
    lower.includes(
      "factory"
    )
  ) {
    return "Manufacturer / Factory";
  }

  if (
    lower.includes(
      "oem"
    ) ||
    lower.includes(
      "odm"
    )
  ) {
    return "OEM / ODM Manufacturer";
  }

  if (
    lower.includes(
      "exporter"
    )
  ) {
    return "Manufacturer / Exporter";
  }

  if (
    lower.includes(
      "supplier"
    )
  ) {
    return "Manufacturer / Supplier";
  }

  return "Potential Manufacturer";
}


// =============================================================
// CAPABILITY
// =============================================================

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

  if (
    content
  ) {
    return (
      `Public-web evidence indicates potential manufacturing or supply capability related to ${product}. ` +
      content.slice(
        0,
        500
      )
    );
  }

  return (
    `Public-web result related to ${product}. ` +
    `Supplier manufacturing capability requires direct verification.`
  );
}


// =============================================================
// SUPPLIER NAME
// =============================================================

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

  value =
    value
      .replace(
        /\s*[|–—-]\s*(official website|official site|home|homepage)$/i,
        ""
      )
      .trim();

  const titleLooksLikeArticle =
    /^(top|best|how|why|what|guide|list|review|directory)/i
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
    "Potential manufacturer"
  ).slice(
    0,
    180
  );
}


// =============================================================
// DOMAIN
// =============================================================

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

  return name.replace(
    /\b\w/g,
    letter =>
      letter.toUpperCase()
  );
}


function getDomain(url) {
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


function getWebsiteRoot(url) {
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


// =============================================================
// URL NORMALIZATION
// =============================================================

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


// =============================================================
// LOCATION
// =============================================================

function inferLocation(
  result,
  analysis
) {
  const text =
    (
      result.title ||
      ""
    ) +
    " " +
    (
      result.content ||
      ""
    ) +
    " " +
    (
      result.url ||
      ""
    );

  const lower =
    text.toLowerCase();

  const locations = [
    "Guangdong, China",
    "Guangzhou, China",
    "Dongguan, China",
    "Foshan, China",
    "Shenzhen, China",
    "Zhejiang, China",
    "Wenzhou, China",
    "Yiwu, China",
    "Fujian, China",
    "Quanzhou, China",
    "Jinjiang, China",
    "Putian, China",
    "Jiangsu, China",
    "Sichuan, China",
    "Hebei, China",
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
    const location of locations
  ) {
    if (
      lower.includes(
        location.toLowerCase()
      )
    ) {
      return location;
    }
  }

  return "Not determined";
}


// =============================================================
// CONTACT EXTRACTION
// =============================================================

function extractContactInfo(
  result
) {
  const text =
    clean(
      (
        result.content ||
        ""
      ) +
      " " +
      (
        result.raw_content ||
        ""
      )
    );

  const emailMatch =
    text.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );

  const phoneMatch =
    text.match(
      /(?:\+?\d[\d\s().-]{7,}\d)/
    );

  return {
    email:
      emailMatch
        ? emailMatch[0]
        : "",

    phone:
      phoneMatch
        ? phoneMatch[0]
        : ""
  };
}


// =============================================================
// INPUT EXTRACTION
// =============================================================

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
    "full-grain leather",
    "full grain leather",
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
      lower.includes(
        keyword
      )
    ) {
      return keyword;
    }
  }

  return "";
}


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


// =============================================================
// UTILITIES
// =============================================================

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
