/**
 * ============================================================
 * CASEVO AI SOURCING — CLEAN WORKER
 * ============================================================
 *
 * Cloudflare Worker
 *
 * GET  /api/health
 * POST /api/sourcing
 *
 * Environment:
 *   TAVILY_API_KEY
 *
 * Design goals:
 *   1. Real public-web discovery only.
 *   2. Never invent supplier identities.
 *   3. Prefer official company / factory websites.
 *   4. Reject obvious directories, marketplaces and articles.
 *   5. Keep returned evidence short and frontend-safe.
 *   6. Remain compatible with CASEVO script.js.
 * ============================================================
 */

const VERSION = "5.1.0";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

const MAX_SEARCH_RESULTS_PER_QUERY = 8;
const MAX_SUPPLIERS_RETURNED = 8;

const MAX_TEXT = 5000;
const MAX_EVIDENCE = 420;

const TAVILY_TIMEOUT_MS = 15000;


/* ============================================================
   EXCLUDED DOMAINS
   ============================================================ */

const EXCLUDED_DOMAINS = [

  // Social
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "pinterest.com",
  "reddit.com",
  "tiktok.com",
  "twitter.com",
  "x.com",

  // Marketplaces
  "amazon.com",
  "ebay.com",
  "alibaba.com",
  "aliexpress.com",
  "made-in-china.com",
  "globalsources.com",
  "indiamart.com",
  "tradeindia.com",

  // Directories
  "justdial.com",
  "yellowpages.com",
  "yelp.com",
  "thomasnet.com",
  "kompass.com",
  "europages.com",

  // General content
  "wikipedia.org",
  "quora.com",
  "medium.com",
  "substack.com",
  "wordpress.com",
  "blogspot.com",
  "craigslist.org"

];


const EXCLUDED_TLDS = [
  ".gov",
  ".edu"
];


/* ============================================================
   LOW VALUE ARTICLE TERMS
   ============================================================ */

const ARTICLE_TERMS = [

  "top 5",
  "top 10",
  "top 20",
  "top 50",

  "best suppliers",
  "best manufacturers",
  "best factories",

  "top suppliers",
  "top manufacturers",
  "top factories",

  "list of suppliers",
  "list of manufacturers",
  "supplier list",
  "manufacturer list",
  "factory list",

  "directory",
  "directories",
  "marketplace",

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


/* ============================================================
   LOW VALUE URL PATHS
   ============================================================ */

const DIRECTORY_PATHS = [

  "/directory",
  "/directories",

  "/listing",
  "/listings",

  "/category",
  "/categories",

  "/tag",
  "/tags",

  "/blog",
  "/blogs",

  "/news",

  "/article",
  "/articles",

  "/magazine",
  "/journal",

  "/search",
  "/results",

  "/reviews",
  "/review"

];


/* ============================================================
   MANUFACTURER SIGNALS
   ============================================================ */

const MANUFACTURER_SIGNALS = [

  "manufacturer",
  "manufacturing",
  "factory",
  "factories",

  "production facility",
  "manufacturing facility",

  "manufacturing plant",
  "production plant",

  "production line",

  "own factory",
  "our factory",

  "our manufacturing",
  "our production",

  "production capacity",

  "factory direct",

  "production facility"

];


/* ============================================================
   COMMERCIAL SIGNALS
   ============================================================ */

const COMMERCIAL_SIGNALS = [

  "oem",
  "odm",
  "private label",

  "custom manufacturing",
  "custom production",

  "export",
  "exporter",
  "exporting",

  "wholesale",
  "b2b",

  "custom made",
  "custom-made"

];


/* ============================================================
   COMPANY SIGNALS
   ============================================================ */

const COMPANY_SIGNALS = [

  "about us",
  "about our company",

  "company profile",
  "our company",

  "our products",
  "our factory",
  "our facility",
  "our production",

  "contact us",
  "contact",

  "get in touch",

  "established",

  "founded"

];


/* ============================================================
   CHINA SIGNALS
   ============================================================ */

const CHINA_SIGNALS = [

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


/* ============================================================
   PRODUCT DETECTION
   ============================================================ */

const PRODUCT_TERMS = [

  [
    "premium full-grain leather shoe upper",
    "Premium full-grain leather shoe upper"
  ],

  [
    "full-grain leather shoe upper",
    "Premium full-grain leather shoe upper"
  ],

  [
    "full grain leather shoe upper",
    "Premium full-grain leather shoe upper"
  ],

  [
    "leather shoe upper",
    "Leather shoe upper"
  ],

  [
    "shoe upper leather",
    "Leather shoe upper"
  ],

  [
    "upper leather",
    "Upper leather"
  ],

  [
    "genuine leather",
    "Genuine leather"
  ],

  [
    "cow leather",
    "Cow leather"
  ],

  [
    "cowhide",
    "Cowhide"
  ],

  [
    "microfiber leather",
    "Microfiber leather"
  ],

  [
    "synthetic leather",
    "Synthetic leather"
  ],

  [
    "pu leather",
    "PU leather"
  ],

  [
    "rubber",
    "Rubber"
  ],

  [
    "eva",
    "EVA"
  ],

  [
    "tpr",
    "TPR"
  ],

  [
    "textile",
    "Textile"
  ],

  [
    "fabric",
    "Fabric"
  ],

  [
    "sneaker",
    "Sneaker"
  ],

  [
    "footwear",
    "Footwear"
  ],

  [
    "shoe",
    "Shoe"
  ],

  [
    "鞋面革",
    "Upper leather"
  ],

  [
    "皮革",
    "Leather"
  ],

  [
    "鞋面",
    "Shoe upper"
  ],

  [
    "鞋",
    "Footwear"
  ]

];


/* ============================================================
   DESTINATION DETECTION
   ============================================================ */

const DESTINATIONS = [

  ["united states", "United States"],
  ["usa", "United States"],
  ["u.s.a", "United States"],
  ["america", "United States"],
  ["美国", "United States"],

  ["united kingdom", "United Kingdom"],
  ["uk", "United Kingdom"],
  ["英国", "United Kingdom"],

  ["canada", "Canada"],
  ["加拿大", "Canada"],

  ["australia", "Australia"],
  ["澳大利亚", "Australia"],

  ["germany", "Germany"],
  ["德国", "Germany"],

  ["france", "France"],
  ["法国", "France"],

  ["italy", "Italy"],
  ["意大利", "Italy"],

  ["spain", "Spain"],
  ["西班牙", "Spain"],

  ["japan", "Japan"],
  ["日本", "Japan"],

  ["south korea", "South Korea"],
  ["korea", "South Korea"],
  ["韩国", "South Korea"],

  ["singapore", "Singapore"],
  ["新加坡", "Singapore"],

  ["india", "India"],
  ["印度", "India"],

  ["vietnam", "Vietnam"],
  ["越南", "Vietnam"],

  ["indonesia", "Indonesia"],
  ["印度尼西亚", "Indonesia"],

  ["thailand", "Thailand"],
  ["泰国", "Thailand"],

  ["turkey", "Turkey"],
  ["土耳其", "Turkey"],

  ["mexico", "Mexico"],
  ["墨西哥", "Mexico"],

  ["brazil", "Brazil"],
  ["巴西", "Brazil"]

];


/* ============================================================
   LOCATION DATABASE
   ============================================================ */

const LOCATIONS = [

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


/* ============================================================
   WORKER ENTRY
   ============================================================ */

export default {

  async fetch(request, env) {

    const url = new URL(request.url);


    /* --------------------------------------------------------
       CORS PREFLIGHT
       -------------------------------------------------------- */

    if (request.method === "OPTIONS") {

      return new Response(
        null,
        {
          status: 204,
          headers: corsHeaders()
        }
      );

    }


    /* --------------------------------------------------------
       HEALTH
       -------------------------------------------------------- */

    if (
      url.pathname === "/api/health" &&
      request.method === "GET"
    ) {

      return jsonResponse({

        ok: true,

        service:
          "CASEVO AI Sourcing",

        version:
          VERSION,

        engine:
          "CASEVO Real Supplier Discovery",

        searchProvider:
          "Tavily",

        timestamp:
          new Date().toISOString()

      });

    }


    /* --------------------------------------------------------
       SOURCING API
       -------------------------------------------------------- */

    if (url.pathname === "/api/sourcing") {

      if (request.method !== "POST") {

        return jsonResponse(
          {
            ok: false,
            error:
              "Method not allowed. Use POST /api/sourcing."
          },
          405
        );

      }

      return handleSourcingRequest(
        request,
        env
      );

    }


    /* --------------------------------------------------------
       STATIC ASSETS
       -------------------------------------------------------- */

    if (env.ASSETS) {

      return env.ASSETS.fetch(
        request
      );

    }


    return new Response(
      "CASEVO Worker is running.",
      {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type":
            "text/plain; charset=UTF-8"
        }
      }
    );

  }

};


/* ============================================================
   SOURCING REQUEST
   ============================================================ */

async function handleSourcingRequest(
  request,
  env
) {

  let body;


  try {

    body =
      await request.json();

  } catch {

    return jsonResponse(
      {
        ok: false,
        error:
          "Invalid JSON request body."
      },
      400
    );

  }


  const requirement =
    clean(
      body?.requirement
    );


  const inputProduct =
    clean(
      body?.product
    );


  const inputQuantity =
    clean(
      body?.quantity
    );


  const inputTargetPrice =
    clean(
      body?.targetPrice
    );


  const inputDestination =
    clean(
      body?.destination
    );


  if (!requirement) {

    return jsonResponse(
      {
        ok: false,
        error:
          "Please enter a sourcing requirement."
      },
      400
    );

  }


  /* ----------------------------------------------------------
     STRUCTURE REQUEST
     ---------------------------------------------------------- */

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


  /* ----------------------------------------------------------
     TAVILY KEY
     ---------------------------------------------------------- */

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


  /* ----------------------------------------------------------
     SEARCH
     ---------------------------------------------------------- */

  try {

    const searchResult =
      await searchSuppliersWithTavily(
        analysis,
        env.TAVILY_API_KEY
      );


    const matches =
      normalizeSupplierResults(
        searchResult.results,
        analysis
      );


    const scoring =
      calculateReadiness(
        analysis
      );


    return jsonResponse({

      ok: true,

      requestId:
        createRequestId(),

      message:
        "CASEVO supplier discovery completed successfully.",

      analysis: {

        ...analysis,

        scoring

      },

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
          "Public-web candidates are not verified suppliers. Supplier identity, manufacturing capability, certifications, MOQ and commercial terms require independent verification.",

        searchQueries:
          searchResult.searchQueries,

        resultsScanned:
          searchResult.results.length,

        suppliersReturned:
          matches.length,

        creditsUsed:
          searchResult.credits,

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
          clean(
            error?.message ||
            "Unknown search error."
          )

      },
      502
    );

  }

}


/* ============================================================
   TAVILY SEARCH ENGINE
   ============================================================ */

async function searchSuppliersWithTavily(
  analysis,
  apiKey
) {

  const product =
    clean(
      analysis?.product
    ) ||
    clean(
      analysis?.requirement
    ) ||
    "supplier";


  const requirement =
    clean(
      analysis?.requirement
    );


  const destination =
    clean(
      analysis?.destination
    );


  const queries =
    buildSearchQueries(
      product,
      requirement,
      destination
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

    const results =
      Array.isArray(
        responses[i]?.results
      )
        ? responses[i].results
        : [];


    for (
      const result of results
    ) {

      if (!result?.url) {
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

    credits:
      responses.reduce(
        (
          sum,
          item
        ) =>
          sum +
          Number(
            item?.usage?.credits ||
            0
          ),
        0
      )

  };

}


/* ============================================================
   SEARCH QUERY BUILDER
   ============================================================ */

function buildSearchQueries(
  product,
  requirement,
  destination
) {

  const p =
    clean(product) ||
    "supplier";


  const r =
    clean(requirement)
      .slice(
        0,
        180
      );


  const d =
    clean(destination);


  const destinationPart =
    d
      ? `"${d}"`
      : "";


  /*
   * IMPORTANT:
   *
   * Do not force China when the buyer did not
   * specify China.
   *
   * If destination is USA, it is still reasonable
   * to discover overseas suppliers that export there.
   */

  const queries = [

    `"${p}" manufacturer factory official website ${destinationPart}`,

    `"${p}" OEM ODM manufacturer factory ${destinationPart}`,

    `"${p}" manufacturer production facility exporter ${destinationPart}`,

    `"${p}" factory supplier company contact ${destinationPart}`

  ];


  /*
   * If China is explicitly mentioned, add
   * China-focused queries.
   */

  if (
    /china|chinese|中国/i.test(
      `${requirement} ${destination}`
    )
  ) {

    queries.push(
      `"${p}" China manufacturer factory official website`,
      `"${p}" China OEM ODM manufacturer exporter`
    );

  }


  return uniqueStrings(
    queries
  ).slice(
    0,
    6
  );

}


/* ============================================================
   TAVILY REQUEST
   ============================================================ */

async function tavilySearch(
  query,
  apiKey
) {

  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      TAVILY_TIMEOUT_MS
    );


  try {

    const response =
      await fetch(
        TAVILY_ENDPOINT,
        {

          method:
            "POST",

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

            }),

          signal:
            controller.signal

        }
      );


    const data =
      await safeJson(
        response
      );


    if (!response.ok) {

      throw new Error(

        data?.detail ||

        data?.error ||

        `Tavily API returned HTTP ${response.status}`

      );

    }


    return data;

  } finally {

    clearTimeout(
      timeout
    );

  }

}


/* ============================================================
   DEDUPLICATE RESULTS
   ============================================================ */

function deduplicateResults(
  results
) {

  const byDomain =
    new Map();


  for (
    const result of results
  ) {

    const url =
      normalizeUrl(
        result?.url
      );


    const domain =
      getDomain(
        url
      );


    if (!url || !domain) {
      continue;
    }


    if (
      isExcludedDomain(
        domain
      )
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


    if (
      rawSearchQuality(candidate) >
      rawSearchQuality(previous)
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
   NORMALIZE SUPPLIER RESULTS
   ============================================================ */

function normalizeSupplierResults(
  results,
  analysis
) {

  const candidates = [];


  for (
    const result of
      Array.isArray(results)
        ? results
        : []
  ) {

    const url =
      normalizeUrl(
        result?.url
      );


    const domain =
      getDomain(
        url
      );


    if (!url || !domain) {
      continue;
    }


    if (
      isExcludedDomain(
        domain
      )
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


    /*
     * This is deliberately less aggressive
     * than the previous version.
     *
     * A real manufacturer may have a homepage
     * or product page that does not contain
     * "contact us" in the Tavily snippet.
     */

    if (
      !hasRealSupplierEvidence(
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


    if (score < 42) {
      continue;
    }


    candidates.push({

      result,

      domain,

      score,

      supplierType:
        detectSupplierType(
          result
        )

    });

  }


  candidates.sort(
    (
      a,
      b
    ) =>
      b.score -
      a.score
  );


  return candidates

    .slice(
      0,
      MAX_SUPPLIERS_RETURNED
    )

    .map(
      (
        candidate,
        index
      ) =>
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
      extractEmail(
        `${result?.content || ""} ${result?.raw_content || ""}`
      ),

    contactPhone:
      extractPhone(
        `${result?.content || ""} ${result?.raw_content || ""}`
      ),

    evidence:
      buildEvidence(
        result,
        analysis
      )

  };

}


/* ============================================================
   LOW VALUE PAGE FILTER
   ============================================================ */

function isLowValuePage(
  result
) {

  const title =
    clean(
      result?.title
    ).toLowerCase();


  const content =
    clean(
      result?.content
    ).toLowerCase();


  const url =
    clean(
      result?.url
    ).toLowerCase();


  const titleUrl =
    `${title} ${url}`;


  /*
   * Reject obvious article/listing pages
   * based primarily on title and URL.
   */

  for (
    const term of ARTICLE_TERMS
  ) {

    if (
      titleUrl.includes(
        term
      )
    ) {

      return true;

    }

  }


  /*
   * Reject obvious directory paths.
   */

  for (
    const path of DIRECTORY_PATHS
  ) {

    if (
      hasPath(
        url,
        path
      )
    ) {

      return true;

    }

  }


  /*
   * Generic article-style titles.
   */

  if (
    /^(top|best|how|why|what|guide|list|review|directory|comparison)\b/i
      .test(title)
  ) {

    return true;

  }


  /*
   * Obvious listing pages.
   */

  const listingSignals = [

    "10 suppliers",
    "20 suppliers",
    "50 suppliers",

    "10 manufacturers",
    "20 manufacturers",
    "50 manufacturers",

    "list of suppliers",
    "list of manufacturers",

    "directory of suppliers",
    "directory of manufacturers"

  ];


  if (
    listingSignals.some(
      signal =>
        content.includes(
          signal
        )
    )
  ) {

    return true;

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
      result?.title
    );


  const content =
    clean(
      result?.content
    );


  const url =
    clean(
      result?.url
    );


  const text =
    `${title} ${content} ${url}`
      .toLowerCase();


  const manufacturerCount =
    countSignals(
      text,
      MANUFACTURER_SIGNALS
    );


  const commercialCount =
    countSignals(
      text,
      COMMERCIAL_SIGNALS
    );


  const companyCount =
    countSignals(
      text,
      COMPANY_SIGNALS
    );


  const productCount =
    countProductSignals(
      text
    );


  /*
   * Strongest signal:
   * manufacturer + product
   */

  if (
    manufacturerCount >= 1 &&
    productCount >= 1
  ) {

    return true;

  }


  /*
   * Manufacturer + commercial capability.
   */

  if (
    manufacturerCount >= 1 &&
    commercialCount >= 1
  ) {

    return true;

  }


  /*
   * Company + commercial + product.
   */

  if (
    companyCount >= 1 &&
    commercialCount >= 1 &&
    productCount >= 1
  ) {

    return true;

  }


  /*
   * Multiple manufacturing signals.
   */

  if (
    manufacturerCount >= 2
  ) {

    return true;

  }


  /*
   * Some official company pages have weak
   * wording in search snippets.
   *
   * Allow a reasonable fallback when the
   * title/domain/content strongly indicate
   * a product company.
   */

  if (
    productCount >= 1 &&
    companyCount >= 1
  ) {

    return true;

  }


  return false;

}


/* ============================================================
   PRODUCT SIGNAL COUNTER
   ============================================================ */

function countProductSignals(
  text
) {

  const value =
    clean(
      text
    ).toLowerCase();


  let count = 0;


  for (
    const [
      term
    ]
    of PRODUCT_TERMS
  ) {

    if (
      value.includes(
        term.toLowerCase()
      )
    ) {

      count++;

    }

  }


  return count;

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
      result?.title
    );


  const content =
    clean(
      result?.content
    );


  const url =
    clean(
      result?.url
    );


  const text =
    `${title} ${content} ${url}`
      .toLowerCase();


  const product =
    clean(
      analysis?.product
    ).toLowerCase();


  let score = 0;


  /*
   * Tavily relevance.
   */

  const tavilyScore =
    Number(
      result?.score ||
      0
    );


  if (
    Number.isFinite(
      tavilyScore
    )
  ) {

    score += Math.min(
      24,
      tavilyScore * 24
    );

  }


  /*
   * Exact product phrase.
   */

  if (
    product &&
    text.includes(
      product
    )
  ) {

    score += 26;

  }


  /*
   * Product words.
   */

  const productWords =
    product

      .split(
        /[\s,\/\-]+/
      )

      .filter(
        word =>
          word.length >= 3
      )

      .slice(
        0,
        10
      );


  if (
    productWords.length
  ) {

    const matched =
      productWords.filter(
        word =>
          text.includes(
            word
          )
      ).length;


    score += Math.min(
      18,
      (
        matched /
        productWords.length
      ) *
      18
    );

  }


  /*
   * Manufacturing evidence.
   */

  score += Math.min(
    18,
    countSignals(
      text,
      MANUFACTURER_SIGNALS
    ) * 4
  );


  /*
   * Commercial capability.
   */

  score += Math.min(
    10,
    countSignals(
      text,
      COMMERCIAL_SIGNALS
    ) * 2
  );


  /*
   * Company evidence.
   */

  score += Math.min(
    8,
    countSignals(
      text,
      COMPANY_SIGNALS
    ) * 2
  );


  /*
   * China signal.
   *
   * This is a preference, not a hard requirement.
   */

  if (
    CHINA_SIGNALS.some(
      signal =>
        text.includes(
          signal
        )
    )
  ) {

    score += 5;

  }


  /*
   * Destination signal.
   */

  const destination =
    clean(
      analysis?.destination
    ).toLowerCase();


  if (
    destination &&
    text.includes(
      destination
    )
  ) {

    score += 4;

  }


  /*
   * Email / phone evidence.
   */

  if (
    extractEmail(
      content
    )
  ) {

    score += 3;

  }


  if (
    extractPhone(
      content
    )
  ) {

    score += 2;

  }


  /*
   * Penalties.
   */

  const penalties = [

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
    const penalty of penalties
  ) {

    if (
      text.includes(
        penalty
      )
    ) {

      score -= 8;

    }

  }


  return Math.max(
    0,
    Math.min(
      99,
      Math.round(
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

  const text =
    `${clean(result?.title)} ${clean(result?.content)}`
      .toLowerCase();


  let score = 0;


  score +=
    countSignals(
      text,
      MANUFACTURER_SIGNALS
    ) * 5;


  score +=
    countSignals(
      text,
      COMMERCIAL_SIGNALS
    ) * 3;


  score +=
    countSignals(
      text,
      COMPANY_SIGNALS
    ) * 2;


  score +=
    countProductSignals(
      text
    ) * 3;


  const tavilyScore =
    Number(
      result?.score ||
      0
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
    `${clean(result?.title)} ${clean(result?.content)}`
      .toLowerCase();


  const manufacturer =
    /manufacturer|manufacturing|factory|factories|production facility/
      .test(text);


  const oem =
    /\boem\b|\bodm\b/
      .test(text);


  const exporter =
    /exporter|export|exporting/
      .test(text);


  if (
    manufacturer &&
    oem
  ) {

    return "Manufacturer / OEM / ODM";

  }


  if (
    manufacturer &&
    exporter
  ) {

    return "Manufacturer / Exporter";

  }


  if (
    manufacturer
  ) {

    return "Manufacturer / Factory";

  }


  if (
    oem
  ) {

    return "OEM / ODM Manufacturer";

  }


  return "Potential Manufacturer";

}


/* ============================================================
   SUPPLIER NAME
   ============================================================ */

function cleanSupplierName(
  result,
  domain
) {

  let title =
    sanitizeWebText(
      result?.title
    );


  title =
    title

      .replace(
        /\s*[|–—-]\s*(official website|official site|home|homepage)$/i,
        ""
      )

      .replace(
        /\s*[|–—-]\s*(manufacturer|factory|supplier)$/i,
        ""
      )

      .replace(
        /\s*[|–—-]\s*(china|usa|india|vietnam)$/i,
        ""
      )

      .trim();


  if (
    looksLikeArticleTitle(
      title
    )
  ) {

    title = "";

  }


  if (
    title.length > 100
  ) {

    title = "";

  }


  if (
    !title ||
    looksGenericSupplierTitle(
      title
    )
  ) {

    return (
      companyNameFromDomain(
        domain
      ) ||
      "Potential manufacturer"
    );

  }


  return title;

}


/* ============================================================
   ARTICLE TITLE DETECTION
   ============================================================ */

function looksLikeArticleTitle(
  title
) {

  const value =
    clean(
      title
    ).toLowerCase();


  if (!value) {
    return true;
  }


  return (

    /^(top|best|how|why|what|guide|list|review|directory|comparison)\b/i
      .test(value)

    ||

    value.includes(
      "suppliers in "
    )

    ||

    value.includes(
      "manufacturers in "
    )

    ||

    value.includes(
      "factories in "
    )

  );

}


/* ============================================================
   GENERIC SUPPLIER TITLE
   ============================================================ */

function looksGenericSupplierTitle(
  title
) {

  const value =
    clean(
      title
    ).toLowerCase();


  const genericTerms = [

    "oem shoe manufacturer",

    "shoe manufacturer in china",

    "shoe factory in china",

    "leather manufacturer in china",

    "leather supplier in china",

    "trusted factory",

    "custom shoes manufacturer",

    "custom footwear manufacturer",

    "shoe manufacturers",

    "leather manufacturers",

    "footwear manufacturers"

  ];


  return genericTerms.some(
    term =>
      value.includes(
        term
      )
  );

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
      analysis?.product
    ) ||
    "the requested product";


  const evidence =
    buildEvidence(
      result,
      analysis
    );


  return truncate(

    `Public-web evidence indicates potential manufacturing or supply capability related to ${product}. ${evidence}`,

    MAX_EVIDENCE

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
      result?.title
    );


  const content =
    sanitizeWebText(
      result?.content
    );


  const combined =
    `${title}. ${content}`;


  const relevant =
    extractRelevantEvidence(
      combined,
      analysis?.product
    );


  return truncate(

    relevant ||

    "Public-web supplier evidence returned for review.",

    MAX_EVIDENCE

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


  if (!cleaned) {
    return "";
  }


  const sentences =
    splitSentences(
      cleaned
    );


  const productWords =
    clean(
      product
    )

      .toLowerCase()

      .split(
        /[\s,\/\-]+/
      )

      .filter(
        word =>
          word.length >= 3
      )

      .slice(
        0,
        10
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


        score +=
          countSignals(
            lower,
            MANUFACTURER_SIGNALS
          ) * 5;


        score +=
          countSignals(
            lower,
            COMMERCIAL_SIGNALS
          ) * 2;


        score +=
          countSignals(
            lower,
            COMPANY_SIGNALS
          );


        if (
          extractEmail(
            sentence
          )
        ) {

          score += 2;

        }


        return {

          sentence,

          score

        };

      }
    );


  ranked.sort(
    (
      a,
      b
    ) =>
      b.score -
      a.score
  );


  return ranked

    .filter(
      item =>
        item.score > 0
    )

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
   * Markdown images.
   */

  text =
    text.replace(
      /!\[[^\]]*\]\([^)]+\)/g,
      " "
    );


  /*
   * Markdown links.
   */

  text =
    text.replace(
      /\[([^\]]+)\]\([^)]+\)/g,
      "$1"
    );


  /*
   * HTTP / HTTPS URLs.
   */

  text =
    text.replace(
      /https?:\/\/[^\s<>"']+/gi,
      " "
    );


  /*
   * WWW URLs.
   */

  text =
    text.replace(
      /www\.[^\s<>"']+/gi,
      " "
    );


  /*
   * HTML tags.
   */

  text =
    text.replace(
      /<[^>]*>/g,
      " "
    );


  /*
   * HTML entities.
   */

  text =
    text.replace(
      /&(?:amp|nbsp|quot|lt|gt);/gi,
      " "
    );


  /*
   * Navigation garbage.
   */

  text =
    text.replace(
      /\b(cookie policy|privacy policy|terms of use|subscribe now|sign up now)\b/gi,
      " "
    );


  /*
   * Base64-like garbage.
   */

  text =
    text.replace(
      /[A-Za-z0-9+/]{120,}={0,2}/g,
      " "
    );


  /*
   * Percent-encoded garbage.
   */

  text =
    text.replace(
      /(?:%[0-9A-Fa-f]{2}){8,}/g,
      " "
    );


  /*
   * Domain garbage chains.
   */

  text =
    text.replace(
      /\b(?:[A-Za-z0-9_-]{20,}\.){2,}[A-Za-z0-9_-]{2,}\b/g,
      " "
    );


  /*
   * Repeated separators.
   */

  text =
    text.replace(
      /([|])\1+/g,
      "$1"
    );


  /*
   * Excessive punctuation.
   */

  text =
    text.replace(
      /([.])\1{3,}/g,
      "..."
    );


  /*
   * Normalize whitespace.
   */

  text =
    text.replace(
      /\s+/g,
      " "
    );


  text =
    text.trim();


  return truncate(
    text,
    MAX_EVIDENCE
  );

}


/* ============================================================
   SENTENCE SPLITTER
   ============================================================ */

function splitSentences(
  text
) {

  return text

    .split(
      /(?<=[.!?。！？])\s+/
    )

    .map(
      clean
    )

    .filter(
      Boolean
    );

}


/* ============================================================
   EMAIL
   ============================================================ */

function extractEmail(
  text
) {

  const match =
    clean(
      text
    ).match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );


  return match
    ? match[0]
    : "";

}


/* ============================================================
   PHONE
   ============================================================ */

function extractPhone(
  text
) {

  const match =
    clean(
      text
    ).match(

      /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{1,4})?/

    );


  if (!match) {
    return "";
  }


  const value =
    clean(
      match[0]
    );


  if (
    value.replace(
      /\D/g,
      ""
    ).length < 7
  ) {

    return "";

  }


  return value.slice(
    0,
    30
  );

}


/* ============================================================
   LOCATION
   ============================================================ */

function inferLocation(
  result,
  analysis
) {

  const text =
    `${clean(result?.title)} ${clean(result?.content)} ${clean(result?.url)}`
      .toLowerCase();


  for (
    const location of LOCATIONS
  ) {

    if (
      text.includes(
        location.toLowerCase()
      )
    ) {

      return location;

    }

  }


  /*
   * If no supplier location can be detected,
   * use the requested destination only as context.
   *
   * It is NOT presented as supplier location
   * when the actual location is unknown.
   */

  return "Not determined";

}


/* ============================================================
   READINESS SCORE
   ============================================================ */

function calculateReadiness(
  analysis
) {

  let clarity = 20;
  let specification = 15;
  let commercial = 20;


  const requirement =
    clean(
      analysis?.requirement
    );


  if (
    requirement.length >= 40
  ) {

    clarity += 25;

  }


  if (
    analysis?.product
  ) {

    clarity += 20;
    specification += 10;

  }


  if (
    analysis?.quantity
  ) {

    commercial += 20;

  }


  if (
    analysis?.targetPrice
  ) {

    commercial += 20;

  }


  if (
    analysis?.destination
  ) {

    commercial += 15;

  }


  if (
    /\d+(?:\.\d+)?\s*mm\b/i.test(
      requirement
    )
  ) {

    specification += 20;

  }


  if (
    /full[- ]?grain|top[- ]?grain|genuine leather|leather/i.test(
      requirement
    )
  ) {

    specification += 10;

  }


  if (
    /black|brown|white|red|blue|green|navy|beige|color|colour/i.test(
      requirement
    )
  ) {

    specification += 5;

  }


  if (
    /lwg|iso\s*9001|reach|rohs|oeko[- ]?tex|gots|grs|bsci|sedex/i.test(
      requirement
    )
  ) {

    specification += 5;

  }


  clarity =
    Math.min(
      100,
      clarity
    );


  specification =
    Math.min(
      100,
      specification
    );


  commercial =
    Math.min(
      100,
      commercial
    );


  const score =
    Math.round(

      (
        clarity +
        specification +
        commercial
      ) / 3

    );


  let note =
    "Basic sourcing brief. Additional commercial or technical information is recommended before supplier verification.";


  if (score >= 85) {

    note =
      "Strong sourcing brief. The requirement contains enough information for supplier screening.";

  } else if (score >= 70) {

    note =
      "Good sourcing brief. Adding missing specifications would improve supplier matching.";

  }


  return {

    score,

    clarity,

    specification,

    commercial,

    note

  };

}


/* ============================================================
   PRODUCT EXTRACTION
   ============================================================ */

function extractProduct(
  text
) {

  const value =
    clean(
      text
    ).toLowerCase();


  for (
    const [
      term,
      product
    ]
    of PRODUCT_TERMS
  ) {

    if (
      value.includes(
        term.toLowerCase()
      )
    ) {

      return product;

    }

  }


  return "";

}


/* ============================================================
   QUANTITY EXTRACTION
   ============================================================ */

function extractQuantity(
  text
) {

  const match =
    clean(
      text
    ).match(

      /(\d[\d,.\s]*)\s*(pairs?|pcs?|pieces?|kg|kgs|kilograms?|tons?|tonnes?|mt|sqm|sqft|square meters?|units?)/i

    );


  return match
    ? clean(
        match[0]
      )
    : "";

}


/* ============================================================
   PRICE EXTRACTION
   ============================================================ */

function extractPrice(
  text
) {

  const match =
    clean(
      text
    ).match(

      /(?:usd|us\$|\$)\s*[\d,.]+(?:\s*(?:per|\/)\s*[a-zA-Z0-9 ]+)?/i

    );


  return match
    ? clean(
        match[0]
      )
    : "";

}


/* ============================================================
   DESTINATION EXTRACTION
   ============================================================ */

function extractDestination(
  text
) {

  const value =
    clean(
      text
    ).toLowerCase();


  for (
    const [
      term,
      destination
    ]
    of DESTINATIONS
  ) {

    if (
      value.includes(
        term
      )
    ) {

      return destination;

    }

  }


  return "";

}


/* ============================================================
   URL NORMALIZATION
   ============================================================ */

function normalizeUrl(
  value
) {

  try {

    const parsed =
      new URL(
        clean(
          value
        )
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

      "ref",
      "source"

    ];


    for (
      const key of trackingParams
    ) {

      parsed.searchParams.delete(
        key
      );

    }


    return parsed.toString();

  } catch {

    return "";

  }

}


/* ============================================================
   WEBSITE ROOT
   ============================================================ */

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

    return "";

  }

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
   COMPANY NAME FROM DOMAIN
   ============================================================ */

function companyNameFromDomain(
  domain
) {

  const value =
    clean(
      domain
    );


  if (!value) {
    return "";
  }


  const parts =
    value.split(
      "."
    );


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
    return "";
  }


  return name

    .split(
      " "
    )

    .map(
      word =>
        word
          ? word.charAt(0).toUpperCase() +
            word.slice(1)
          : ""
    )

    .join(
      " "
    );

}


/* ============================================================
   URL PATH CHECK
   ============================================================ */

function hasPath(
  url,
  path
) {

  const normalized =
    clean(
      url
    )
      .replace(
        /\/+$/,
        ""
      )
      .toLowerCase();


  const target =
    path
      .toLowerCase();


  return (
    normalized.includes(
      target
    )
  );

}


/* ============================================================
   EXCLUDED DOMAIN CHECK
   ============================================================ */

function isExcludedDomain(
  domain
) {

  const value =
    clean(
      domain
    ).toLowerCase();


  if (!value) {
    return true;
  }


  if (
    EXCLUDED_DOMAINS.some(
      excluded =>
        value === excluded ||
        value.endsWith(
          "." +
          excluded
        )
    )
  ) {

    return true;

  }


  if (
    EXCLUDED_TLDS.some(
      tld =>
        value.endsWith(
          tld
        )
    )
  ) {

    return true;

  }


  return false;

}


/* ============================================================
   SIGNAL COUNTER
   ============================================================ */

function countSignals(
  text,
  signals
) {

  let count = 0;


  for (
    const signal of signals
  ) {

    if (
      text.includes(
        signal
      )
    ) {

      count++;

    }

  }


  return count;

}


/* ============================================================
   UNIQUE STRINGS
   ============================================================ */

function uniqueStrings(
  values
) {

  return Array.from(

    new Set(

      values

        .map(
          clean
        )

        .filter(
          Boolean
        )

    )

  );

}


/* ============================================================
   CLEAN
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


  return String(
    value
  )

    .replace(
      /\s+/g,
      " "
    )

    .trim()

    .slice(
      0,
      MAX_TEXT
    );

}


/* ============================================================
   TRUNCATE
   ============================================================ */

function truncate(
  value,
  maxLength
) {

  const text =
    clean(
      value
    );


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
    lastSpace >
    Math.floor(
      maxLength * 0.55
    )
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
      .slice(
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
   CORS
   ============================================================ */

function corsHeaders() {

  return {

    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type, Accept",

    "Access-Control-Max-Age":
      "86400"

  };

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
          "no-store"

      }

    }

  );

}
