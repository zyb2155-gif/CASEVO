/**
 * ============================================================
 * CASEVO AI SOURCING ENGINE
 * FINAL WORKER
 * ============================================================
 *
 * Endpoints
 * ----------
 * GET  /api/health
 * POST /api/sourcing
 *
 * Environment secret
 * ------------------
 * TAVILY_API_KEY
 *
 * Frontend contract
 * -----------------
 * The frontend sends:
 *
 * {
 *   requirement,
 *   product,
 *   quantity,
 *   targetPrice,
 *   destination
 * }
 *
 * The worker returns:
 *
 * {
 *   ok,
 *   requestId,
 *   message,
 *   analysis,
 *   score,
 *   clarity,
 *   specification,
 *   commercial,
 *   matches,
 *   meta
 * }
 *
 * IMPORTANT
 * ---------
 * This worker never invents supplier identity,
 * contact information, certifications, factory
 * capacity, or verification status.
 * ============================================================
 */

const CASEVO_VERSION = "4.0.0";
const MAX_SUPPLIERS = 8;
const MAX_TAVILY_RESULTS_PER_QUERY = 8;

/* ============================================================
   ENTRY
   ============================================================ */

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
     * HEALTH
     * ----------------------------------------------------------
     */

    if (
      url.pathname === "/api/health" &&
      request.method === "GET"
    ) {
      return jsonResponse({
        ok: true,
        service: "CASEVO AI Sourcing",
        version: CASEVO_VERSION,
        engine: "CASEVO Real Supplier Discovery",
        searchProvider: "Tavily",
        timestamp: new Date().toISOString()
      });
    }

    /*
     * ----------------------------------------------------------
     * SOURCING
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
     * STATIC ASSETS
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

  /*
   * ----------------------------------------------------------
   * INPUTS
   * ----------------------------------------------------------
   */

  const requirement = clean(
    body?.requirement
  );

  const suppliedProduct = clean(
    body?.product
  );

  const suppliedQuantity = clean(
    body?.quantity
  );

  const suppliedTargetPrice = clean(
    body?.targetPrice
  );

  const suppliedDestination = clean(
    body?.destination
  );

  /*
   * ----------------------------------------------------------
   * REQUIREMENT VALIDATION
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
   * NORMALIZE REQUIREMENT
   *
   * Important:
   * The textarea is the primary source of truth.
   * Empty individual fields are supplemented from the
   * requirement instead of causing "Not specified".
   * ----------------------------------------------------------
   */

  const analysis = buildAnalysis({
    requirement,
    product: suppliedProduct,
    quantity: suppliedQuantity,
    targetPrice: suppliedTargetPrice,
    destination: suppliedDestination
  });

  /*
   * ----------------------------------------------------------
   * TAVILY KEY
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
   * SEARCH
   * ----------------------------------------------------------
   */

  try {
    const searchResult =
      await searchSuppliersWithTavily(
        analysis,
        env.TAVILY_API_KEY
      );

    /*
     * --------------------------------------------------------
     * NORMALIZE REAL WEB RESULTS
     * --------------------------------------------------------
     */

    const matches =
      normalizeSupplierResults(
        searchResult.results || [],
        analysis
      );

    /*
     * --------------------------------------------------------
     * READINESS
     * --------------------------------------------------------
     */

    const readiness =
      calculateReadiness(analysis);

    /*
     * --------------------------------------------------------
     * CASEVO SCORE
     *
     * Score is a sourcing-readiness / discovery score.
     * It is NOT a guarantee of supplier quality.
     * --------------------------------------------------------
     */

    const score =
      calculateCasevoScore(
        analysis,
        matches,
        readiness
      );

    const requestId =
      createRequestId();

    /*
     * --------------------------------------------------------
     * RESPONSE
     * --------------------------------------------------------
     */

    return jsonResponse({
      ok: true,

      requestId,

      message:
        "CASEVO supplier discovery completed successfully.",

      analysis,

      /*
       * Frontend-friendly top-level fields.
       */
      product:
        analysis.product,

      quantity:
        analysis.quantity,

      targetPrice:
        analysis.targetPrice,

      destination:
        analysis.destination,

      score,

      clarity:
        readiness.clarity,

      specification:
        readiness.specification,

      commercial:
        readiness.commercial,

      matches,

      meta: {
        source:
          "CASEVO AI Sourcing Engine",

        engine:
          "CASEVO Real Supplier Discovery",

        supplierData:
          "Public web search",

        searchProvider:
          "Tavily",

        verified:
          false,

        verificationNote:
          "CASEVO identifies public-web supplier candidates only. Supplier identity, manufacturing capability, certifications, MOQ, production capacity, pricing and commercial contacts must be independently verified before placing an order.",

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
        error:
          "Supplier web search failed.",

        details:
          error?.message ||
          "Unknown search error.",

        requestId:
          createRequestId()
      },
      502
    );
  }
}


/* ============================================================
   BUILD ANALYSIS
   ============================================================ */

function buildAnalysis(input) {
  const requirement =
    clean(input.requirement);

  let product =
    clean(input.product);

  let quantity =
    clean(input.quantity);

  let targetPrice =
    clean(input.targetPrice);

  let destination =
    clean(input.destination);

  /*
   * Extract missing information from the full requirement.
   */

  if (!product) {
    product =
      extractProduct(requirement);
  }

  if (!quantity) {
    quantity =
      extractQuantity(requirement);
  }

  if (!targetPrice) {
    targetPrice =
      extractPrice(requirement);
  }

  if (!destination) {
    destination =
      extractDestination(requirement);
  }

  return {
    product:
      product || "Sourcing Requirement",

    quantity:
      quantity || "Not specified",

    targetPrice:
      targetPrice || "Not specified",

    destination:
      destination || "Not specified",

    requirement
  };
}


/* ============================================================
   TAVILY SEARCH
   ============================================================ */

async function searchSuppliersWithTavily(
  analysis,
  apiKey
) {
  const queries =
    buildSearchQueries(
      analysis
    );

  /*
   * Search in parallel, but keep queries controlled.
   */

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
    const response =
      responses[i];

    const results =
      Array.isArray(
        response?.results
      )
        ? response.results
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

  /*
   * Deduplicate by domain first.
   *
   * This prevents ten pages from the same website
   * appearing as ten different suppliers.
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
          (sum, response) =>
            sum +
            Number(
              response?.usage?.credits || 0
            ),
          0
        )
    }
  };
}


/* ============================================================
   SEARCH QUERY BUILDERS
   ============================================================ */

function buildSearchQueries(
  analysis
) {
  const product =
    analysis.product !== "Sourcing Requirement"
      ? analysis.product
      : analysis.requirement;

  const destination =
    analysis.destination &&
    analysis.destination !== "Not specified"
      ? analysis.destination
      : "";

  const queries = [];

  /*
   * Query 1:
   * Exact product + China manufacturer.
   */

  queries.push(
    [
      `"${product}"`,
      "China",
      "manufacturer",
      "factory",
      "supplier",
      "official website"
    ]
      .filter(Boolean)
      .join(" ")
  );

  /*
   * Query 2:
   * Product + Chinese production capability.
   */

  queries.push(
    [
      `"${product}"`,
      "China",
      "factory",
      "OEM",
      "production",
      "manufacturer"
    ]
      .filter(Boolean)
      .join(" ")
  );

  /*
   * Query 3:
   * Product-specific B2B manufacturing search.
   */

  queries.push(
    [
      `"${product}"`,
      "China",
      "OEM",
      "ODM",
      "manufacturer",
      "exporter"
    ]
      .filter(Boolean)
      .join(" ")
  );

  /*
   * Query 4:
   * Destination-aware search.
   */

  if (destination) {
    queries.push(
      [
        `"${product}"`,
        "China",
        "manufacturer",
        "export",
        destination
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  return queries;
}


/* ============================================================
   TAVILY API
   ============================================================ */

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
              "advanced",

            max_results:
              MAX_TAVILY_RESULTS_PER_QUERY,

            include_answer:
              false,

            include_raw_content:
              true,

            include_images:
              false,

            /*
             * Do not return obvious marketplaces,
             * social pages or directories.
             */
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
    await safeJson(
      response
    );

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.error ||
      `Tavily API returned HTTP ${response.status}`;

    throw new Error(
      message
    );
  }

  return data;
}


/* ============================================================
   DEDUPLICATION
   ============================================================ */

function deduplicateResults(
  results
) {
  const seenDomains =
    new Set();

  const seenUrls =
    new Set();

  const output = [];

  for (const result of results) {
    const normalizedUrl =
      normalizeUrl(
        result.url
      );

    const domain =
      getDomain(
        result.url
      );

    if (
      !normalizedUrl ||
      !domain
    ) {
      continue;
    }

    if (
      seenUrls.has(
        normalizedUrl
      )
    ) {
      continue;
    }

    /*
     * One supplier = one domain.
     */

    if (
      seenDomains.has(
        domain
      )
    ) {
      continue;
    }

    seenUrls.add(
      normalizedUrl
    );

    seenDomains.add(
      domain
    );

    output.push({
      ...result,

      url:
        normalizedUrl
    });
  }

  return output;
}


/* ============================================================
   NORMALIZE SUPPLIER RESULTS
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

    if (
      isLowValuePage(
        result
      )
    ) {
      continue;
    }

    if (
      isBadSupplierDomain(
        result.url
      )
    ) {
      continue;
    }

    /*
     * Strong supplier test.
     *
     * We do not want random pages that merely contain
     * the word "leather".
     */

    if (
      !hasSupplierSignals(
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

    /*
     * Reject weak results.
     */

    if (
      score < 42
    ) {
      continue;
    }

    const domain =
      getDomain(
        result.url
      );

    const supplierType =
      detectSupplierType(
        result
      );

    candidates.push({
      result,
      domain,
      supplierType,
      score
    });
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score
  );

  return candidates
    .slice(
      0,
      MAX_SUPPLIERS
    )
    .map(
      (
        candidate,
        index
      ) => {
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
              result
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
            buildEvidence(
              result
            )
        };
      }
    );
}


/* ============================================================
   SUPPLIER SIGNAL TEST
   ============================================================ */

function hasSupplierSignals(
  result
) {
  const text =
    getResultText(
      result
    ).toLowerCase();

  const strongSignals = [
    "manufacturer",
    "manufacturing",
    "factory",
    "production",
    "producer",
    "oem",
    "odm",
    "production facility",
    "manufacturing facility",
    "manufacturing plant",
    "our factory",
    "our production",
    "factory direct",
    "exporter",
    "supplier"
  ];

  let count = 0;

  for (
    const signal of strongSignals
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      count++;
    }
  }

  return count >= 2;
}


/* ============================================================
   LOW VALUE PAGE FILTER
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

  const badKeywords = [
    "top 10",
    "top 20",
    "top 50",
    "top 5",

    "best manufacturers",
    "best suppliers",
    "best factories",

    "list of manufacturers",
    "list of suppliers",
    "supplier directory",
    "manufacturer directory",

    "directory",
    "directories",

    "marketplace",
    "marketplaces",

    "buyers guide",
    "buyer's guide",
    "ultimate guide",
    "quick guide",

    "review",
    "reviews",

    "comparison",

    "what is",
    "how to",

    "market report",
    "industry report",

    "price list",
    "catalog",
    "catalogue",

    "blog",
    "news",
    "article",
    "articles",
    "journal",
    "magazine"
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
    "/listings/",
    "/reviews/"
  ];

  for (
    const pattern of badPathPatterns
  ) {
    if (
      url.includes(
        pattern
      )
    ) {
      return true;
    }
  }

  return false;
}


/* ============================================================
   BAD DOMAIN FILTER
   ============================================================ */

function isBadSupplierDomain(
  url
) {
  const domain =
    getDomain(
      url
    );

  if (!domain) {
    return true;
  }

  const badDomains = [
    "picclick.com",
    "justdial.com",
    "yellowpages.com",
    "yelp.com",
    "kompass.com",
    "europages.com",
    "thomasnet.com",

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

    "wikipedia.org"
  ];

  for (
    const bad of badDomains
  ) {
    if (
      domain === bad ||
      domain.endsWith(
        "." + bad
      )
    ) {
      return true;
    }
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
  const text =
    getResultText(
      result
    ).toLowerCase();

  const product =
    clean(
      analysis.product
    ).toLowerCase();

  /*
   * Tavily relevance.
   */

  let score =
    Number(
      result.score || 0
    ) * 35;

  /*
   * Product relevance.
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

  let matchedWords = 0;

  for (
    const word of productWords
  ) {
    if (
      text.includes(
        word
      )
    ) {
      matchedWords++;
    }
  }

  if (
    productWords.length
  ) {
    score +=
      (
        matchedWords /
        productWords.length
      ) * 25;
  }

  /*
   * Full-grain / genuine leather signals.
   */

  const materialSignals = [
    "full grain",
    "full-grain",
    "genuine leather",
    "top grain",
    "cow leather",
    "cowhide",
    "leather upper",
    "shoe upper",
    "footwear leather"
  ];

  for (
    const signal of materialSignals
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      score += 5;
    }
  }

  /*
   * Manufacturer signals.
   */

  const manufacturerSignals = [
    "manufacturer",
    "manufacturing",
    "factory",
    "production",
    "producer",
    "production facility",
    "manufacturing facility"
  ];

  for (
    const signal of manufacturerSignals
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      score += 4;
    }
  }

  /*
   * Commercial capability.
   */

  const commercialSignals = [
    "oem",
    "odm",
    "export",
    "exporter",
    "wholesale",
    "custom",
    "private label",
    "b2b"
  ];

  for (
    const signal of commercialSignals
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      score += 3;
    }
  }

  /*
   * China signals.
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
    "fujian",
    "quanzhou",
    "jinjiang",
    "putian",
    "jiangsu",
    "sichuan",
    "hebei"
  ];

  for (
    const signal of chinaSignals
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      score += 4;
      break;
    }
  }

  /*
   * Contact/company credibility signals.
   */

  const credibilitySignals = [
    "contact us",
    "contact",
    "email",
    "phone",
    "address",
    "about us",
    "our factory",
    "our production"
  ];

  for (
    const signal of credibilitySignals
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      score += 2;
    }
  }

  /*
   * Penalize weak contexts.
   */

  const penalties = [
    "directory",
    "marketplace",
    "listing",
    "review",
    "reviews",
    "blog",
    "news",
    "article",
    "top 10",
    "top 20",
    "best supplier",
    "best manufacturer"
  ];

  for (
    const penalty of penalties
  ) {
    if (
      text.includes(
        penalty
      )
    ) {
      score -= 12;
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


/* ============================================================
   SUPPLIER TYPE
   ============================================================ */

function detectSupplierType(
  result
) {
  const text =
    getResultText(
      result
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
    return "Manufacturer / Factory";
  }

  if (
    text.includes(
      "oem"
    ) ||
    text.includes(
      "odm"
    )
  ) {
    return "OEM / ODM Manufacturer";
  }

  if (
    text.includes(
      "exporter"
    )
  ) {
    return "Manufacturer / Exporter";
  }

  if (
    text.includes(
      "supplier"
    )
  ) {
    return "Manufacturer / Supplier";
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
  const content =
    clean(
      result.content ||
      result.raw_content ||
      ""
    );

  const product =
    analysis.product ||
    "the requested product";

  if (!content) {
    return (
      `Public-web evidence indicates potential capability related to ${product}. ` +
      `Manufacturing capability requires direct verification.`
    );
  }

  return (
    `Public-web evidence indicates potential manufacturing or supply capability related to ${product}. ` +
    clean(
      content
    ).slice(
      0,
      650
    )
  );
}


/* ============================================================
   EVIDENCE
   ============================================================ */

function buildEvidence(
  result
) {
  const content =
    clean(
      result.raw_content ||
      result.content ||
      ""
    );

  return content
    .slice(
      0,
      900
    );
}


/* ============================================================
   SUPPLIER NAME
   ============================================================ */

function cleanSupplierName(
  title,
  domain,
  content
) {
  let value =
    clean(
      title
    );

  /*
   * Remove common page suffixes.
   */

  value =
    value.replace(
      /\s*[|–—-]\s*(official website|official site|home|homepage)$/i,
      ""
    )
    .trim();

  /*
   * Detect obvious article titles.
   */

  const articleTitle =
    /^(top|best|how|why|what|guide|list|review|directory|comparison)/i
      .test(
        value
      );

  if (
    articleTitle &&
    domain
  ) {
    return companyNameFromDomain(
      domain
    );
  }

  /*
   * Some Tavily titles are extremely long.
   */

  if (
    value.length > 180
  ) {
    value =
      value.slice(
        0,
        180
      );
  }

  /*
   * If title is missing, use domain.
   */

  if (
    !value &&
    domain
  ) {
    return companyNameFromDomain(
      domain
    );
  }

  /*
   * Do not use generic article-like titles.
   */

  if (
    isGenericSupplierTitle(
      value
    ) &&
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
  );
}


function isGenericSupplierTitle(
  value
) {
  const lower =
    clean(
      value
    ).toLowerCase();

  const generic = [
    "supplier",
    "manufacturer",
    "factory",
    "home",
    "homepage",
    "official website",
    "official site"
  ];

  return generic.includes(
    lower
  );
}


/* ============================================================
   COMPANY NAME FROM DOMAIN
   ============================================================ */

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


/* ============================================================
   LOCATION
   ============================================================ */

function inferLocation(
  result
) {
  const text =
    getResultText(
      result
    ).toLowerCase();

  const locations = [
    [
      "Guangdong, China",
      [
        "guangdong"
      ]
    ],
    [
      "Guangzhou, China",
      [
        "guangzhou"
      ]
    ],
    [
      "Dongguan, China",
      [
        "dongguan"
      ]
    ],
    [
      "Foshan, China",
      [
        "foshan"
      ]
    ],
    [
      "Shenzhen, China",
      [
        "shenzhen"
      ]
    ],
    [
      "Zhejiang, China",
      [
        "zhejiang"
      ]
    ],
    [
      "Wenzhou, China",
      [
        "wenzhou"
      ]
    ],
    [
      "Fujian, China",
      [
        "fujian"
      ]
    ],
    [
      "Quanzhou, China",
      [
        "quanzhou"
      ]
    ],
    [
      "Jinjiang, China",
      [
        "jinjiang"
      ]
    ],
    [
      "Putian, China",
      [
        "putian"
      ]
    ],
    [
      "Jiangsu, China",
      [
        "jiangsu"
      ]
    ],
    [
      "China",
      [
        "china",
        "chinese"
      ]
    ],
    [
      "India",
      [
        "india",
        "indian"
      ]
    ],
    [
      "Vietnam",
      [
        "vietnam",
        "vietnamese"
      ]
    ],
    [
      "Indonesia",
      [
        "indonesia"
      ]
    ],
    [
      "Thailand",
      [
        "thailand"
      ]
    ],
    [
      "Bangladesh",
      [
        "bangladesh"
      ]
    ],
    [
      "Pakistan",
      [
        "pakistan"
      ]
    ],
    [
      "Turkey",
      [
        "turkey",
        "turkish"
      ]
    ],
    [
      "Italy",
      [
        "italy",
        "italian"
      ]
    ],
    [
      "Spain",
      [
        "spain",
        "spanish"
      ]
    ],
    [
      "Portugal",
      [
        "portugal",
        "portuguese"
      ]
    ],
    [
      "United States",
      [
        "united states",
        "usa",
        "u.s.a."
      ]
    ],
    [
      "Mexico",
      [
        "mexico",
        "mexican"
      ]
    ],
    [
      "Brazil",
      [
        "brazil",
        "brazilian"
      ]
    ]
  ];

  for (
    const item of locations
  ) {
    const label =
      item[0];

    const signals =
      item[1];

    for (
      const signal of signals
    ) {
      if (
        text.includes(
          signal
        )
      ) {
        return label;
      }
    }
  }

  return "Not determined";
}


/* ============================================================
   CONTACT EXTRACTION
   ============================================================ */

function extractContactInfo(
  result
) {
  const text =
    clean(
      (
        result.raw_content ||
        ""
      ) +
      " " +
      (
        result.content ||
        ""
      )
    );

  /*
   * Email
   */

  const emailMatch =
    text.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );

  /*
   * Phone
   *
   * Conservative pattern.
   */

  const phoneMatches =
    text.match(
      /(?:\+?\d[\d\s().-]{7,}\d)/g
    ) || [];

  let phone =
    "";

  if (
    phoneMatches.length
  ) {
    phone =
      phoneMatches[0]
        .replace(
          /\s+/g,
          " "
        )
        .trim();
  }

  return {
    email:
      emailMatch
        ? emailMatch[0]
        : "",

    phone
  };
}


/* ============================================================
   INPUT EXTRACTION
   ============================================================ */

function extractProduct(
  text
) {
  const value =
    clean(
      text
    );

  if (!value) {
    return "";
  }

  const lower =
    value.toLowerCase();

  /*
   * More specific terms first.
   */

  const productPatterns = [
    "premium full-grain leather shoe upper",
    "full-grain leather shoe upper",
    "full grain leather shoe upper",
    "full-grain leather",
    "full grain leather",
    "genuine leather shoe upper",
    "leather shoe upper",
    "shoe upper leather",
    "leather upper",
    "upper leather",
    "cowhide leather",
    "cow leather",
    "genuine leather",
    "microfiber leather",
    "synthetic leather",
    "pu leather",
    "shoe leather",
    "footwear leather",
    "leather",
    "shoe upper",
    "sneaker",
    "footwear",
    "shoe",
    "rubber",
    "sole",
    "eva",
    "tpr",
    "fabric",
    "textile",
    "material"
  ];

  for (
    const pattern of productPatterns
  ) {
    if (
      lower.includes(
        pattern
      )
    ) {
      /*
       * Return the actual phrase from the requirement
       * where possible.
       */

      const index =
        lower.indexOf(
          pattern
        );

      if (
        index >= 0
      ) {
        return value
          .slice(
            index,
            index +
              pattern.length
          )
          .trim();
      }

      return pattern;
    }
  }

  /*
   * Fallback:
   * Try to remove obvious commercial wording.
   */

  const cleaned =
    value
      .replace(
        /\b\d+(?:\.\d+)?\s*mm\b/gi,
        ""
      )
      .replace(
        /\b\d[\d,]*\s*(pairs?|pcs?|pieces?|kg|tons?|mt|units?)\b/gi,
        ""
      )
      .replace(
        /\bshipping to\b.*$/i,
        ""
      )
      .trim();

  return (
    cleaned ||
    ""
  ).slice(
    0,
    180
  );
}


function extractQuantity(
  text
) {
  const value =
    clean(
      text
    );

  if (!value) {
    return "";
  }

  const patterns = [
    /(\d[\d,.\s]*)\s*(pairs?)/i,
    /(\d[\d,.\s]*)\s*(pcs?|pieces?)/i,
    /(\d[\d,.\s]*)\s*(kg)/i,
    /(\d[\d,.\s]*)\s*(tons?)/i,
    /(\d[\d,.\s]*)\s*(mt)/i,
    /(\d[\d,.\s]*)\s*(sqm|sqft)/i,
    /(\d[\d,.\s]*)\s*(units?)/i
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      value.match(
        pattern
      );

    if (
      match
    ) {
      return match[0]
        .replace(
          /\s+/g,
          " "
        )
        .trim();
    }
  }

  return "";
}


function extractPrice(
  text
) {
  const value =
    clean(
      text
    );

  if (!value) {
    return "";
  }

  const patterns = [
    /(?:usd|us\$|\$)\s*[\d,.]+(?:\s*(?:per|\/)\s*[a-zA-Z0-9 ]+)?/i,
    /[\d,.]+\s*(?:usd|us\$)/i
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      value.match(
        pattern
      );

    if (
      match
    ) {
      return match[0]
        .replace(
          /\s+/g,
          " "
        )
        .trim();
    }
  }

  return "";
}


function extractDestination(
  text
) {
  const value =
    clean(
      text
    );

  if (!value) {
    return "";
  }

  const destinations = [
    "United States",
    "USA",
    "U.S.A.",
    "US",
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
      if (
        destination === "USA" ||
        destination === "US" ||
        destination === "U.S.A."
      ) {
        return "United States";
      }

      return destination;
    }
  }

  return "";
}


/* ============================================================
   CASEVO READINESS
   ============================================================ */

function calculateReadiness(
  analysis
) {
  const requirement =
    clean(
      analysis.requirement
    );

  const product =
    clean(
      analysis.product
    );

  const quantity =
    clean(
      analysis.quantity
    );

  const targetPrice =
    clean(
      analysis.targetPrice
    );

  const destination =
    clean(
      analysis.destination
    );

  /*
   * Requirement clarity
   */

  let clarity =
    30;

  if (
    requirement.length >= 40
  ) {
    clarity += 20;
  }

  if (
    requirement.length >= 100
  ) {
    clarity += 20;
  }

  if (
    product &&
    product !== "Sourcing Requirement"
  ) {
    clarity += 10;
  }

  if (
    quantity &&
    quantity !== "Not specified"
  ) {
    clarity += 10;
  }

  if (
    destination &&
    destination !== "Not specified"
  ) {
    clarity += 10;
  }

  clarity =
    clamp(
      clarity,
      0,
      100
    );

  /*
   * Specification quality
   */

  let specification =
    20;

  const requirementLower =
    requirement.toLowerCase();

  const specificationSignals = [
    "mm",
    "thickness",
    "color",
    "black",
    "brown",
    "white",
    "grain",
    "full-grain",
    "full grain",
    "finish",
    "texture",
    "material",
    "grade",
    "quality",
    "specification",
    "gsm",
    "width",
    "size"
  ];

  let specSignalsFound =
    0;

  for (
    const signal of specificationSignals
  ) {
    if (
      requirementLower.includes(
        signal
      )
    ) {
      specSignalsFound++;
    }
  }

  specification +=
    Math.min(
      50,
      specSignalsFound * 8
    );

  if (
    product &&
    product !== "Sourcing Requirement"
  ) {
    specification += 10;
  }

  specification =
    clamp(
      specification,
      0,
      100
    );

  /*
   * Commercial readiness
   */

  let commercial =
    20;

  if (
    quantity &&
    quantity !== "Not specified"
  ) {
    commercial += 30;
  }

  if (
    targetPrice &&
    targetPrice !== "Not specified"
  ) {
    commercial += 25;
  }

  if (
    destination &&
    destination !== "Not specified"
  ) {
    commercial += 25;
  }

  commercial =
    clamp(
      commercial,
      0,
      100
    );

  return {
    clarity,
    specification,
    commercial
  };
}


/* ============================================================
   CASEVO SCORE
   ============================================================ */

function calculateCasevoScore(
  analysis,
  matches,
  readiness
) {
  let score =
    (
      readiness.clarity * 0.30
    ) +
    (
      readiness.specification * 0.30
    ) +
    (
      readiness.commercial * 0.20
    );

  /*
   * Supplier discovery contribution.
   */

  if (
    matches.length >= 1
  ) {
    score += 5;
  }

  if (
    matches.length >= 2
  ) {
    score += 5;
  }

  if (
    matches.length >= 4
  ) {
    score += 5;
  }

  /*
   * Strongest supplier relevance.
   */

  if (
    matches.length
  ) {
    const topScore =
      Number(
        matches[0].matchScore || 0
      );

    score +=
      Math.min(
        10,
        topScore / 10
      );
  }

  return clamp(
    Math.round(
      score
    ),
    0,
    100
  );
}


/* ============================================================
   TEXT HELPERS
   ============================================================ */

function getResultText(
  result
) {
  return clean(
    [
      result?.title || "",
      result?.content || "",
      result?.raw_content || "",
      result?.url || ""
    ].join(" ")
  );
}


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


function clamp(
  value,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(
      max,
      Number(value) || 0
    )
  );
}


/* ============================================================
   URL HELPERS
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


function getWebsiteRoot(
  url
) {
  try {
    const parsed =
      new URL(
        url
      );

    return (
      parsed.protocol +
      "//" +
      parsed.hostname
    );
  } catch {
    return (
      url ||
      ""
    );
  }
}


function normalizeUrl(
  url
) {
  try {
    const parsed =
      new URL(
        url
      );

    parsed.hash =
      "";

    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "_ga",
      "_gl"
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
   SAFE JSON
   ============================================================ */

async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}


/* ============================================================
   REQUEST ID
   ============================================================ */

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


/* ============================================================
   JSON RESPONSE
   ============================================================ */

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
          "no-store, no-cache, must-revalidate"
      }
    }
  );
}


/* ============================================================
   CORS
   ============================================================ */

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
