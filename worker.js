/**
 * CASEVO AI SOURCING ENGINE
 * Cloudflare Worker
 * Version: 4.0.1
 *
 * GET  /api/health
 * POST /api/sourcing
 *
 * Required secret: TAVILY_API_KEY
 * Frontend compatibility:
 *   data.brief
 *   data.analysis.normalized
 *   data.analysis.scoring
 *   data.analysis.matches
 *   data.matches
 */

const VERSION = "4.0.1";
const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const RESULTS_PER_QUERY = 10;
const MAX_SUPPLIERS = 8;
const MAX_QUERY_LENGTH = 390;
const MAX_INPUT_LENGTH = 5000;
const MAX_CAPABILITY_LENGTH = 520;
const MAX_EVIDENCE_LENGTH = 900;
const SEARCH_TIMEOUT_MS = 15000;

const EXCLUDED_DOMAINS = [
  "facebook.com", "instagram.com", "linkedin.com", "youtube.com",
  "pinterest.com", "reddit.com", "tiktok.com", "twitter.com", "x.com",
  "amazon.com", "ebay.com", "alibaba.com", "aliexpress.com",
  "made-in-china.com", "globalsources.com", "indiamart.com", "tradeindia.com",
  "justdial.com", "yellowpages.com", "yelp.com", "thomasnet.com",
  "kompass.com", "europages.com", "wikipedia.org", "picclick.com",
  "quora.com", "medium.com", "substack.com", "wordpress.com",
  "blogspot.com", "craigslist.org"
];

const EXCLUDED_TLDS = [
  ".gov",
  ".edu"
];

const LOW_VALUE_TITLE_TERMS = [
  "top 5",
  "top 10",
  "top 20",
  "top 50",

  "best manufacturers",
  "best suppliers",
  "best factories",

  "top manufacturers",
  "top suppliers",
  "top factories",

  "list of manufacturers",
  "list of suppliers",

  "manufacturer list",
  "supplier list",

  "supplier directory",
  "manufacturer directory",

  "directory",
  "marketplace",

  "buyer's guide",
  "buyers guide",

  "ultimate guide",
  "quick guide",

  "how to",
  "what is",
  "why choose",

  "comparison",
  "review",
  "reviews",

  "market report",
  "industry report",

  "price list",
  "catalogue",
  "catalog"
];

const LOW_VALUE_PATHS = [
  "/blog/",
  "/blogs/",
  "/news/",
  "/article/",
  "/articles/",
  "/magazine/",
  "/journal/",
  "/category/",
  "/categories/",
  "/tag/",
  "/tags/",
  "/search/",
  "/results/",
  "/directory/",
  "/directories/",
  "/listing/",
  "/listings/",
  "/review/",
  "/reviews/"
];

const MANUFACTURER_SIGNALS = [
  "manufacturer",
  "manufacturing",
  "factory",
  "factories",
  "producer",

  "production facility",
  "manufacturing facility",
  "manufacturing plant",
  "production plant",
  "production line",

  "factory direct",
  "own factory",
  "our factory",
  "our manufacturing",
  "our production",
  "production capacity"
];

const COMMERCIAL_SIGNALS = [
  "oem",
  "odm",
  "private label",

  "custom manufacturing",
  "custom production",
  "custom made",
  "custom-made",

  "exporter",
  "export",
  "exporting",

  "wholesale",
  "b2b",
  "bulk",
  "moq"
];

const COMPANY_SIGNALS = [
  "about us",
  "company profile",
  "our company",
  "our products",
  "our factory",
  "our facility",
  "our production",
  "contact us",
  "get in touch",
  "established",
  "founded"
];

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
  "chengdu",
  "jiangsu",
  "sichuan",
  "hebei"
];

const PRODUCT_TERMS = [
  [
    "premium full-grain leather shoe upper",
    "Premium full-grain leather shoe upper"
  ],

  [
    "full-grain leather shoe upper",
    "Full-grain leather shoe upper"
  ],

  [
    "full grain leather shoe upper",
    "Full-grain leather shoe upper"
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
    "Cowhide leather"
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

const LOCATION_RULES = [
  [
    "Guangzhou, China",
    ["guangzhou"]
  ],

  [
    "Dongguan, China",
    ["dongguan"]
  ],

  [
    "Foshan, China",
    ["foshan"]
  ],

  [
    "Shenzhen, China",
    ["shenzhen"]
  ],

  [
    "Quanzhou, China",
    ["quanzhou"]
  ],

  [
    "Jinjiang, China",
    ["jinjiang"]
  ],

  [
    "Wenzhou, China",
    ["wenzhou"]
  ],

  [
    "Putian, China",
    ["putian"]
  ],

  [
    "Chengdu, China",
    ["chengdu"]
  ],

  [
    "Yiwu, China",
    ["yiwu"]
  ],

  [
    "Guangdong, China",
    ["guangdong"]
  ],

  [
    "Zhejiang, China",
    ["zhejiang"]
  ],

  [
    "Fujian, China",
    ["fujian"]
  ],

  [
    "Jiangsu, China",
    ["jiangsu"]
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
    ["india"]
  ],

  [
    "Vietnam",
    ["vietnam"]
  ],

  [
    "Indonesia",
    ["indonesia"]
  ],

  [
    "Thailand",
    ["thailand"]
  ],

  [
    "Bangladesh",
    ["bangladesh"]
  ],

  [
    "Pakistan",
    ["pakistan"]
  ],

  [
    "Turkey",
    ["turkey"]
  ],

  [
    "Italy",
    ["italy"]
  ],

  [
    "Spain",
    ["spain"]
  ],

  [
    "Portugal",
    ["portugal"]
  ],

  [
    "Germany",
    ["germany"]
  ],

  [
    "France",
    ["france"]
  ],

  [
    "Japan",
    ["japan"]
  ],

  [
    "South Korea",
    [
      "south korea",
      "korea"
    ]
  ],

  [
    "United States",
    [
      "united states",
      "u.s.a.",
      "usa"
    ]
  ],

  [
    "Mexico",
    ["mexico"]
  ],

  [
    "Brazil",
    ["brazil"]
  ]
];

const DESTINATION_RULES = [
  [
    "united states",
    "United States"
  ],

  [
    "u.s.a.",
    "United States"
  ],

  [
    "u.s.a",
    "United States"
  ],

  [
    "usa",
    "United States"
  ],

  [
    "america",
    "United States"
  ],

  [
    "美国",
    "United States"
  ],

  [
    "united kingdom",
    "United Kingdom"
  ],

  [
    "uk",
    "United Kingdom"
  ],

  [
    "英国",
    "United Kingdom"
  ],

  [
    "canada",
    "Canada"
  ],

  [
    "加拿大",
    "Canada"
  ],

  [
    "australia",
    "Australia"
  ],

  [
    "澳大利亚",
    "Australia"
  ],

  [
    "germany",
    "Germany"
  ],

  [
    "德国",
    "Germany"
  ],

  [
    "france",
    "France"
  ],

  [
    "法国",
    "France"
  ],

  [
    "italy",
    "Italy"
  ],

  [
    "意大利",
    "Italy"
  ],

  [
    "spain",
    "Spain"
  ],

  [
    "西班牙",
    "Spain"
  ],

  [
    "japan",
    "Japan"
  ],

  [
    "日本",
    "Japan"
  ],

  [
    "south korea",
    "South Korea"
  ],

  [
    "韩国",
    "South Korea"
  ],

  [
    "singapore",
    "Singapore"
  ],

  [
    "新加坡",
    "Singapore"
  ],

  [
    "india",
    "India"
  ],

  [
    "印度",
    "India"
  ],

  [
    "vietnam",
    "Vietnam"
  ],

  [
    "越南",
    "Vietnam"
  ],

  [
    "indonesia",
    "Indonesia"
  ],

  [
    "印度尼西亚",
    "Indonesia"
  ],

  [
    "thailand",
    "Thailand"
  ],

  [
    "泰国",
    "Thailand"
  ],

  [
    "turkey",
    "Turkey"
  ],

  [
    "土耳其",
    "Turkey"
  ],

  [
    "mexico",
    "Mexico"
  ],

  [
    "墨西哥",
    "Mexico"
  ],

  [
    "brazil",
    "Brazil"
  ],

  [
    "巴西",
    "Brazil"
  ]
];


/* =========================================================
   WORKER ENTRY
   ========================================================= */

export default {
  async fetch(
    request,
    env
  ) {
    const url =
      new URL(
        request.url
      );


    /* -------------------------------------------------------
       CORS
       ------------------------------------------------------- */

    if (
      request.method ===
      "OPTIONS"
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


    /* -------------------------------------------------------
       HEALTH
       ------------------------------------------------------- */

    if (
      url.pathname ===
        "/api/health" &&
      request.method ===
        "GET"
    ) {
      return jsonResponse({
        ok:
          true,

        service:
          "CASEVO AI Sourcing",

        version:
          VERSION,

        engine:
          "CASEVO Real Supplier Discovery",

        searchProvider:
          "Tavily",

        apiKeyConfigured:
          Boolean(
            env.TAVILY_API_KEY
          ),

        timestamp:
          new Date()
            .toISOString()
      });
    }


    /* -------------------------------------------------------
       SOURCING API
       ------------------------------------------------------- */

    if (
      url.pathname ===
      "/api/sourcing"
    ) {
      if (
        request.method !==
        "POST"
      ) {
        return jsonResponse(
          {
            ok:
              false,

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


    /* -------------------------------------------------------
       STATIC ASSETS
       ------------------------------------------------------- */

    if (
      env.ASSETS
    ) {
      return env.ASSETS.fetch(
        request
      );
    }


    return new Response(
      "CASEVO Worker is running.",
      {
        status:
          200,

        headers: {
          ...corsHeaders(),

          "Content-Type":
            "text/plain; charset=utf-8"
        }
      }
    );
  }
};


/* =========================================================
   SOURCING REQUEST
   ========================================================= */

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
        ok:
          false,

        error:
          "Invalid JSON request body."
      },
      400
    );
  }


  const requirement =
    clean(
      body?.requirement ??
      body?.requirements ??
      body?.brief
    );


  const productInput =
    clean(
      body?.product ??
      body?.product_material ??
      body?.productMaterial
    );


  const quantityInput =
    clean(
      body?.quantity
    );


  const targetPriceInput =
    clean(
      body?.targetPrice ??
      body?.target_price ??
      body?.price
    );


  const destinationInput =
    clean(
      body?.destination
    );


  if (
    !requirement &&
    !productInput
  ) {
    return jsonResponse(
      {
        ok:
          false,

        error:
          "Please enter a sourcing requirement."
      },
      400
    );
  }


  const combined =
    clean(
      [
        requirement,
        productInput,
        quantityInput,
        targetPriceInput,
        destinationInput
      ]
        .filter(
          Boolean
        )
        .join(
          " "
        )
    );


  const normalized =
    normalizeRequirement({
      requirement,
      productInput,
      quantityInput,
      targetPriceInput,
      destinationInput,
      combined
    });


  const scoring =
    calculateReadiness(
      normalized
    );


  if (
    !env.TAVILY_API_KEY
  ) {
    return jsonResponse(
      {
        ok:
          false,

        error:
          "TAVILY_API_KEY is not configured in Cloudflare Worker secrets."
      },
      500
    );
  }


  try {
    const search =
      await searchSuppliersWithTavily(
        normalized,
        env.TAVILY_API_KEY
      );


    const matches =
      normalizeSupplierResults(
        search.results,
        normalized
      );


    const brief = {
      product:
        normalized.product ||
        "Sourcing requirement",

      quantity:
        normalized.quantity ||
        null,

      targetPrice:
        normalized.targetPrice ||
        null,

      destination:
        normalized.destination ||
        null,

      requirement:
        normalized.requirement ||
        combined
    };


    return jsonResponse({
      ok:
        true,

      requestId:
        createRequestId(),

      message:
        "CASEVO supplier discovery completed successfully.",

      brief,

      analysis: {
        normalized,
        scoring,
        matches
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
          "Public-web candidates are not verified suppliers. Company identity, manufacturing capability, certifications, MOQ, production capacity and commercial contacts must be independently verified before placing an order.",

        searchQueries:
          search.searchQueries,

        resultsScanned:
          search.resultsScanned,

        domainsScanned:
          search.results.length,

        suppliersReturned:
          matches.length,

        creditsUsed:
          search.creditsUsed,

        timestamp:
          new Date()
            .toISOString()
      }
    });

  } catch (
    error
  ) {
    console.error(
      "CASEVO sourcing error:",
      error
    );


    return jsonResponse(
      {
        ok:
          false,

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


/* =========================================================
   REQUIREMENT NORMALIZATION
   ========================================================= */

function normalizeRequirement(
  input
) {
  const requirement =
    clean(
      input.requirement
    );


  const combined =
    clean(
      input.combined
    );


  const product =
    clean(
      input.productInput
    ) ||
    extractProduct(
      combined
    );


  const quantity =
    clean(
      input.quantityInput
    ) ||
    extractQuantity(
      combined
    );


  const targetPrice =
    clean(
      input.targetPriceInput
    ) ||
    extractPrice(
      combined
    );


  const destination =
    clean(
      input.destinationInput
    ) ||
    extractDestination(
      combined
    );


  const requirements = [];

  const lower =
    combined
      .toLowerCase();


  if (
    product
  ) {
    requirements.push(
      `Product / material: ${product}`
    );
  }


  if (
    quantity
  ) {
    requirements.push(
      `Quantity: ${quantity}`
    );
  }


  if (
    targetPrice
  ) {
    requirements.push(
      `Target price: ${targetPrice}`
    );
  }


  if (
    destination
  ) {
    requirements.push(
      `Destination: ${destination}`
    );
  }


  const thickness =
    combined.match(
      /\b\d+(?:\.\d+)?\s*(?:mm|cm|inch|inches)\b/i
    );


  if (
    thickness
  ) {
    requirements.push(
      `Thickness: ${clean(
        thickness[0]
      )}`
    );
  }


  const colors = [
    "black",
    "white",
    "brown",
    "red",
    "blue",
    "green",
    "navy",
    "tan",
    "beige",
    "grey",
    "gray",
    "burgundy"
  ];


  const foundColors =
    colors.filter(
      (
        color
      ) =>
        lower.includes(
          color
        )
    );


  if (
    foundColors.length
  ) {
    requirements.push(
      `Color: ${foundColors.join(
        ", "
      )}`
    );
  }


  if (
    /full[\s-]?grain/i
      .test(
        combined
      )
  ) {
    requirements.push(
      "Leather grade: full-grain"
    );

  } else if (
    /top[\s-]?grain/i
      .test(
        combined
      )
  ) {
    requirements.push(
      "Leather grade: top-grain"
    );

  } else if (
    /genuine leather/i
      .test(
        combined
      )
  ) {
    requirements.push(
      "Material type: genuine leather"
    );
  }


  const useCase = [];


  if (
    /shoe|sneaker|footwear/i
      .test(
        combined
      )
  ) {
    useCase.push(
      "footwear"
    );
  }


  if (
    /upper/i
      .test(
        combined
      )
  ) {
    useCase.push(
      "shoe upper"
    );
  }


  if (
    useCase.length
  ) {
    requirements.push(
      `Application: ${unique(
        useCase
      ).join(
        ", "
      )}`
    );
  }


  if (
    !requirements.length &&
    requirement
  ) {
    requirements.push(
      requirement
    );
  }


  const tags =
    unique(
      [
        product &&
          "product specified",

        quantity &&
          "quantity specified",

        targetPrice &&
          "target price specified",

        destination &&
          "destination specified",

        thickness &&
          "thickness specified",

        /full[\s-]?grain/i
          .test(
            combined
          ) &&
          "full-grain",

        /shoe|sneaker|footwear/i
          .test(
            combined
          ) &&
          "footwear",

        /upper/i
          .test(
            combined
          ) &&
          "shoe upper"
      ]
        .filter(
          Boolean
        )
    );


  return {
    requirement,
    product,
    quantity,
    targetPrice,
    destination,
    requirements,
    tags
  };
}


/* =========================================================
   TAVILY SEARCH
   ========================================================= */

async function searchSuppliersWithTavily(
  analysis,
  apiKey
) {
  const product =
    analysis.product ||
    analysis.requirement ||
    "supplier";


  const destination =
    analysis.destination ||
    "";


  const queries =
    buildSearchQueries(
      product,
      destination
    );


  const responses =
    await Promise.allSettled(
      queries.map(
        (
          query
        ) =>
          tavilySearch(
            query,
            apiKey
          )
      )
    );


  const successful =
    responses.filter(
      (
        item
      ) =>
        item.status ===
        "fulfilled"
    );


  if (
    !successful.length
  ) {
    const failure =
      responses.find(
        (
          item
        ) =>
          item.status ===
          "rejected"
      );


    throw new Error(
      failure?.reason?.message ||
      "All supplier search queries failed."
    );
  }


  const allResults = [];


  successful.forEach(
    (
      item
    ) => {
      const response =
        item.value;


      const results =
        Array.isArray(
          response.results
        )
          ? response.results
          : [];


      results.forEach(
        (
          result
        ) => {
          if (
            !result?.url
          ) {
            return;
          }


          allResults.push({
            ...result,

            _searchQuery:
              response._query
          });
        }
      );
    }
  );


  return {
    results:
      deduplicateResults(
        allResults
      ),

    searchQueries:
      queries,

    resultsScanned:
      allResults.length,

    creditsUsed:
      successful.reduce(
        (
          sum,
          item
        ) =>
          sum +
          Number(
            item.value?.usage?.credits ||
            0
          ),
        0
      )
  };
}


/* =========================================================
   SEARCH QUERIES
   ========================================================= */

function buildSearchQueries(
  product,
  destination
) {
  const p =
    clean(
      product
    )
      .slice(
        0,
        180
      );


  const destinationHint =
    destination
      ? ` export ${destination}`
      : " export";


  return unique([
    `"${p}" manufacturer factory official website`,

    `"${p}" OEM ODM manufacturer factory`,

    `"${p}" manufacturer exporter${destinationHint}`,

    `"${p}" factory company contact`
  ])
    .map(
      (
        query
      ) =>
        query.slice(
          0,
          MAX_QUERY_LENGTH
        )
    );
}


/* =========================================================
   TAVILY REQUEST
   ========================================================= */

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
      SEARCH_TIMEOUT_MS
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

            Authorization:
              `Bearer ${apiKey}`
          },

          body:
            JSON.stringify({
              query:
                clean(
                  query
                )
                  .slice(
                    0,
                    MAX_QUERY_LENGTH
                  ),

              topic:
                "general",

              search_depth:
                "basic",

              max_results:
                RESULTS_PER_QUERY,

              include_answer:
                false,

              include_raw_content:
                true,

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


    if (
      !response.ok
    ) {
      throw new Error(
        data?.detail ||
        data?.error ||
        `Tavily API returned HTTP ${response.status}`
      );
    }


    return {
      ...data,

      _query:
        query
    };

  } catch (
    error
  ) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "Supplier search timed out."
      );
    }


    throw error;

  } finally {
    clearTimeout(
      timeout
    );
  }
}


/* =========================================================
   DEDUPLICATION
   ========================================================= */

function deduplicateResults(
  results
) {
  const byDomain =
    new Map();


  for (
    const result
    of results
  ) {
    const url =
      normalizeUrl(
        result?.url
      );


    const domain =
      getDomain(
        url
      );


    if (
      !url ||
      !domain ||
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


    if (
      !previous ||
      rawSearchQuality(
        candidate
      ) >
      rawSearchQuality(
        previous
      )
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


/* =========================================================
   NORMALIZE SUPPLIERS
   ========================================================= */

function normalizeSupplierResults(
  results,
  analysis
) {
  const candidates = [];


  for (
    const result
    of Array.isArray(
      results
    )
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


    if (
      !url ||
      !domain ||
      isExcludedDomain(
        domain
      ) ||
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
      score < 42
    ) {
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
      MAX_SUPPLIERS
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


/* =========================================================
   SUPPLIER RECORD
   ========================================================= */

function buildSupplierRecord(
  candidate,
  analysis,
  index
) {
  const result =
    candidate.result;


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
        candidate.domain
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
      normalizeUrl(
        result.url
      ),

    domain:
      candidate.domain,

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
      ),

    note:
      "Public-web evidence suggests potential supplier relevance. Supplier identity, manufacturing capability and commercial details require independent verification."
  };
}


/* =========================================================
   LOW VALUE FILTER
   ========================================================= */

function isLowValuePage(
  result
) {
  const title =
    clean(
      result?.title
    )
      .toLowerCase();


  const url =
    clean(
      result?.url
    )
      .toLowerCase();


  const domain =
    getDomain(
      result?.url
    );


  if (
    !domain ||
    isExcludedDomain(
      domain
    )
  ) {
    return true;
  }


  const titleUrl =
    `${title} ${url}`;


  if (
    LOW_VALUE_TITLE_TERMS.some(
      (
        term
      ) =>
        titleUrl.includes(
          term
        )
    )
  ) {
    return true;
  }


  if (
    LOW_VALUE_PATHS.some(
      (
        path
      ) =>
        url.includes(
          path
        )
    )
  ) {
    return true;
  }


  return /^(top|best|how|why|what|guide|list|review|directory|comparison)\b/i
    .test(
      title
    );
}


/* =========================================================
   MATCH SCORE
   ========================================================= */

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
      result?.content ||
      result?.raw_content ||
      ""
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
    )
      .toLowerCase();


  const tokens =
    tokenizeProduct(
      product
    );


  let score =
    Number(
      result?.score ||
      0
    ) * 42;


  if (
    product &&
    text.includes(
      product
    )
  ) {
    score += 24;
  }


  if (
    tokens.length
  ) {
    const hits =
      tokens.filter(
        (
          token
        ) =>
          text.includes(
            token
          )
      )
        .length;


    score += Math.min(
      18,

      (
        hits /
        tokens.length
      ) * 18
    );
  }


  score +=
    Math.min(
      18,

      countSignals(
        text,
        MANUFACTURER_SIGNALS
      ) * 4
    );


  score +=
    Math.min(
      10,

      countSignals(
        text,
        COMMERCIAL_SIGNALS
      ) * 2
    );


  score +=
    Math.min(
      8,

      countSignals(
        text,
        COMPANY_SIGNALS
      ) * 2
    );


  if (
    /manufacturer|factory|oem|odm|supplier/i
      .test(
        title
      )
  ) {
    score += 7;
  }


  if (
    CHINA_SIGNALS.some(
      (
        signal
      ) =>
        text.includes(
          signal
        )
    )
  ) {
    score += 4;
  }


  if (
    extractEmail(
      content
    )
  ) {
    score += 2;
  }


  if (
    extractPhone(
      content
    )
  ) {
    score += 1;
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


/* =========================================================
   RAW SEARCH QUALITY
   ========================================================= */

function rawSearchQuality(
  result
) {
  const text =
    `${clean(
      result?.title
    )} ${clean(
      result?.content ||
      result?.raw_content
    )}`
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
    Number(
      result?.score ||
      0
    ) * 10;


  if (
    looksLikeArticleTitle(
      result?.title
    )
  ) {
    score -= 20;
  }


  return score;
}


/* =========================================================
   READINESS SCORE
   ========================================================= */

function calculateReadiness(
  analysis
) {
  const hasRequirement =
    Boolean(
      analysis.requirement
    );


  const hasProduct =
    Boolean(
      analysis.product
    );


  const hasQuantity =
    Boolean(
      analysis.quantity
    );


  const hasPrice =
    Boolean(
      analysis.targetPrice
    );


  const hasDestination =
    Boolean(
      analysis.destination
    );


  const hasSpecs =
    analysis.requirements
      .length >= 3;


  const clarity =
    hasRequirement
      ? 100
      : 0;


  const specification =
    Math.round(
      (
        Number(
          hasProduct
        ) +

        Number(
          hasQuantity
        ) +

        Number(
          hasDestination
        ) +

        Number(
          hasSpecs
        )
      ) /
      4 *
      100
    );


  const commercial =
    Math.round(
      (
        Number(
          hasQuantity
        ) +

        Number(
          hasPrice
        ) +

        Number(
          hasDestination
        )
      ) /
      3 *
      100
    );


  const score =
    Math.round(
      clarity *
      0.35 +

      specification *
      0.40 +

      commercial *
      0.25
    );


  return {
    score,

    clarity:
      `${clarity}%`,

    specification:
      `${specification}%`,

    commercial:
      `${commercial}%`,

    note:
      "Readiness reflects the completeness of the sourcing requirement, not supplier verification."
  };
}


/* =========================================================
   SUPPLIER TYPE
   ========================================================= */

function detectSupplierType(
  result
) {
  const text =
    `${clean(
      result?.title
    )} ${clean(
      result?.content ||
      result?.raw_content
    )}`
      .toLowerCase();


  const manufacturer =
    /manufacturer|manufacturing|factory|production facility/
      .test(
        text
      );


  const oem =
    /\boem\b|\bodm\b/
      .test(
        text
      );


  const exporter =
    /exporter|export|exporting/
      .test(
        text
      );


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


  if (
    exporter
  ) {
    return "Manufacturer / Exporter";
  }


  return "Potential Manufacturer";
}


/* =========================================================
   SUPPLIER NAME
   ========================================================= */

function cleanSupplierName(
  result,
  domain
) {
  const title =
    sanitizeWebText(
      result?.title
    );


  const content =
    sanitizeWebText(
      result?.content ||
      result?.raw_content ||
      ""
    );


  const candidates = [
    extractCompanyNameFromTitle(
      title
    ),

    extractCompanyNameFromContent(
      content
    ),

    companyNameFromDomain(
      domain
    )
  ]
    .map(
      cleanCompanyCandidate
    )
    .filter(
      Boolean
    );


  return (
    candidates[0] ||
    "Potential manufacturer"
  );
}


/* =========================================================
   COMPANY NAME FROM TITLE
   ========================================================= */

function extractCompanyNameFromTitle(
  title
) {
  const value =
    clean(
      title
    );


  if (
    !value ||
    looksLikeArticleTitle(
      value
    ) ||
    /^(about|welcome to|home|homepage)\b/i
      .test(
        value
      )
  ) {
    return "";
  }


  const pieces =
    value
      .split(
        /\s+[|–—]\s+|\s+-\s+/
      )
      .map(
        clean
      )
      .filter(
        Boolean
      );


  const companyPiece =
    pieces.find(
      looksLikeCompanyName
    );


  if (
    companyPiece
  ) {
    return companyPiece;
  }


  return looksLikeCompanyName(
    value
  )
    ? value
    : "";
}


/* =========================================================
   COMPANY NAME FROM CONTENT
   ========================================================= */

function extractCompanyNameFromContent(
  content
) {
  const text =
    clean(
      content
    );


  if (
    !text
  ) {
    return "";
  }


  const legalPatterns = [
    /\b([A-Z][A-Za-z0-9&'.,()\- ]{2,80}\b(?:Co\.?\s*,?\s*Ltd\.?|Company\s+Limited|Ltd\.?|Limited|Inc\.?|Corporation|Corp\.?|LLC))\b/,

    /\b([A-Z][A-Za-z0-9&'.,()\- ]{2,80}\b(?:Shoes|Footwear|Leather)\s+(?:Co\.?\s*,?\s*Ltd\.?|Company\s+Limited|Ltd\.?|Limited))\b/i
  ];


  for (
    const pattern
    of legalPatterns
  ) {
    const match =
      text.match(
        pattern
      );


    if (
      match?.[1]
    ) {
      return match[1];
    }
  }


  const introPatterns = [
    /(?:welcome to|about us at|about)\s+([A-Z][A-Za-z0-9&'.,()\- ]{3,80})/i,

    /([A-Z][A-Za-z0-9&'.,()\- ]{3,80})\s+(?:is|are)\s+(?:a|an|one of)\s+(?:professional\s+)?(?:shoe|footwear|leather)?\s*(?:manufacturer|factory|supplier)/i
  ];


  for (
    const pattern
    of introPatterns
  ) {
    const match =
      text.match(
        pattern
      );


    if (
      match?.[1]
    ) {
      return match[1];
    }
  }


  return "";
}


/* =========================================================
   COMPANY NAME VALIDATION
   ========================================================= */

function looksLikeCompanyName(
  value
) {
  const text =
    clean(
      value
    );


  const lower =
    text
      .toLowerCase();


  if (
    !text ||
    text.length < 3 ||
    text.length > 100 ||
    looksLikeArticleTitle(
      text
    )
  ) {
    return false;
  }


  if (
    /\b(oem shoe manufacturer|shoe manufacturer in china|shoe factory in china|custom shoes manufacturer|custom footwear manufacturer|trusted factory|leather supplier in china|leather manufacturer in china)\b/i
      .test(
        lower
      )
  ) {
    return false;
  }


  return true;
}


/* =========================================================
   CLEAN COMPANY NAME
   ========================================================= */

function cleanCompanyCandidate(
  value
) {
  let text =
    sanitizeWebText(
      value
    );


  if (
    !text
  ) {
    return "";
  }


  text =
    text
      .replace(
        /\s*[|–—-]\s*(official website|official site|home|homepage)$/i,
        ""
      )

      .replace(
        /^\s*(manufacturer|factory|supplier)\s*[|:–—-]\s*/i,
        ""
      )

      .replace(
        /\s+/g,
        " "
      )

      .trim();


  return looksLikeCompanyName(
    text
  )
    ? text.slice(
        0,
        100
      )
    : "";
}


/* =========================================================
   ARTICLE TITLE DETECTION
   ========================================================= */

function looksLikeArticleTitle(
  title
) {
  const value =
    clean(
      title
    )
      .toLowerCase();


  if (
    !value
  ) {
    return true;
  }


  return (
    /^(top|best|how|why|what|guide|list|review|directory|comparison)\b/i
      .test(
        value
      )

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


/* =========================================================
   COMPANY NAME FROM DOMAIN
   ========================================================= */

function companyNameFromDomain(
  domain
) {
  const value =
    clean(
      domain
    )
      .replace(
        /^www\./i,
        ""
      )
      .toLowerCase();


  if (
    !value
  ) {
    return "";
  }


  const first =
    value.split(
      "."
    )[0];


  if (
    !first
  ) {
    return "";
  }


  const generic = [
    "shoe",
    "shoes",
    "footwear",
    "leather",
    "factory",
    "manufacturer",
    "supplier",
    "china"
  ];


  if (
    generic.includes(
      first
    )
  ) {
    return "";
  }


  return first
    .replace(
      /[-_]+/g,
      " "
    )
    .replace(
      /\b\w/g,
      (
        c
      ) =>
        c.toUpperCase()
    )
    .trim();
}


/* =========================================================
   CAPABILITY
   ========================================================= */

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
    extractRelevantEvidence(
      `${result?.title || ""}. ${result?.content || ""} ${result?.raw_content || ""}`,
      product
    );


  if (
    !evidence
  ) {
    return (
      `Public-web evidence indicates potential manufacturing or supply relevance to ${product}. ` +
      `Independent verification is required.`
    );
  }


  return truncate(
    `Public-web evidence indicates potential manufacturing or supply capability related to ${product}. ${evidence}`,
    MAX_CAPABILITY_LENGTH
  );
}


/* =========================================================
   EVIDENCE
   ========================================================= */

function buildEvidence(
  result,
  analysis
) {
  const evidence =
    extractRelevantEvidence(
      `${result?.title || ""}. ${result?.content || ""} ${result?.raw_content || ""}`,
      clean(
        analysis?.product
      )
    );


  return truncate(
    evidence ||
    "Public-web supplier evidence returned for review.",
    MAX_EVIDENCE_LENGTH
  );
}


/* =========================================================
   RELEVANT EVIDENCE
   ========================================================= */

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
    splitSentences(
      cleaned
    )
      .filter(
        (
          sentence
        ) =>
          sentence.length >= 20
      );


  const productWords =
    tokenizeProduct(
      product
    )
      .slice(
        0,
        10
      );


  const ranked =
    sentences.map(
      (
        sentence,
        index
      ) => {
        const lower =
          sentence
            .toLowerCase();


        let score = 0;


        for (
          const word
          of productWords
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
          score += 1;
        }


        return {
          sentence,
          score,
          index
        };
      }
    );


  ranked.sort(
    (
      a,
      b
    ) =>
      b.score -
      a.score ||
      a.index -
      b.index
  );


  return unique(
    ranked
      .filter(
        (
          item
        ) =>
          item.score > 0
      )
      .slice(
        0,
        4
      )
      .map(
        (
          item
        ) =>
          item.sentence
      )
  )
    .join(
      " "
    );
}


/* =========================================================
   WEB TEXT SANITIZATION
   ========================================================= */

function sanitizeWebText(
  value
) {
  return String(
    value ||
    ""
  )
    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      " "
    )

    .replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      " "
    )

    .replace(
      /!\[[^\]]*\]\([^)]+\)/g,
      " "
    )

    .replace(
      /\[([^\]]+)\]\([^)]+\)/g,
      "$1"
    )

    .replace(
      /https?:\/\/[^\s<>"']+/gi,
      " "
    )

    .replace(
      /www\.[^\s<>"']+/gi,
      " "
    )

    .replace(
      /<[^>]*>/g,
      " "
    )

    .replace(
      /&(?:amp|nbsp|quot|lt|gt|#39);/gi,
      " "
    )

    .replace(
      /(?:%[0-9A-Fa-f]{2}){8,}/g,
      " "
    )

    .replace(
      /[A-Za-z0-9+/]{120,}={0,2}/g,
      " "
    )

    .replace(
      /(.)\1{12,}/g,
      "$1$1$1"
    )

    .replace(
      /\b(cookie policy|privacy policy|terms of use|subscribe now|sign up now)\b/gi,
      " "
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim()

    .slice(
      0,
      MAX_INPUT_LENGTH
    );
}


/* =========================================================
   SENTENCE SPLITTER
   ========================================================= */

function splitSentences(
  text
) {
  return clean(
    text
  )
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


/* =========================================================
   CONTACT EXTRACTION
   ========================================================= */

function extractContactInfo(
  result
) {
  const text =
    sanitizeWebText(
      `${result?.content || ""} ${result?.raw_content || ""}`
    );


  return {
    email:
      extractEmail(
        text
      ),

    phone:
      extractPhone(
        text
      )
  };
}


/* =========================================================
   EMAIL
   ========================================================= */

function extractEmail(
  text
) {
  const matches =
    String(
      text ||
      ""
    )
      .match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
      );


  if (
    !matches?.length
  ) {
    return "";
  }


  const cleaned =
    unique(
      matches
        .map(
          (
            email
          ) =>
            clean(
              email
            )
              .toLowerCase()
        )
        .filter(
          (
            email
          ) =>
            !/example\.com$|domain\.com$|email\.com$/
              .test(
                email
              )
        )
    );


  return (
    cleaned[0] ||
    ""
  );
}


/* =========================================================
   PHONE
   ========================================================= */

function extractPhone(
  text
) {
  const matches =
    String(
      text ||
      ""
    )
      .match(
        /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{1,4})?/g
      );


  if (
    !matches?.length
  ) {
    return "";
  }


  for (
    const match
    of matches
  ) {
    const value =
      clean(
        match
      );


    const digits =
      value.replace(
        /\D/g,
        ""
      );


    if (
      digits.length >= 8 &&
      digits.length <= 16
    ) {
      return value.slice(
        0,
        32
      );
    }
  }


  return "";
}


/* =========================================================
   LOCATION
   ========================================================= */

function inferLocation(
  result
) {
  const text =
    `${clean(
      result?.title
    )} ${clean(
      result?.content ||
      result?.raw_content
    )} ${clean(
      result?.url
    )}`
      .toLowerCase();


  for (
    const [
      label,
      signals
    ]
    of LOCATION_RULES
  ) {
    if (
      signals.some(
        (
          signal
        ) =>
          text.includes(
            signal
          )
      )
    ) {
      return label;
    }
  }


  return "Not determined";
}


/* =========================================================
   PRODUCT EXTRACTION
   ========================================================= */

function extractProduct(
  text
) {
  const value =
    clean(
      text
    )
      .toLowerCase();


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


/* =========================================================
   QUANTITY EXTRACTION
   ========================================================= */

function extractQuantity(
  text
) {
  const match =
    clean(
      text
    )
      .match(
        /(\d[\d,.\s]*)\s*(pairs?|pcs?|pieces?|kg|kgs|kilograms?|tons?|tonnes?|mt|sqm|sqft|square meters?|units?)/i
      );


  return match
    ? clean(
        match[0]
      )
    : "";
}


/* =========================================================
   PRICE EXTRACTION
   ========================================================= */

function extractPrice(
  text
) {
  const match =
    clean(
      text
    )
      .match(
        /(?:usd|us\$|\$)\s*[\d,.]+(?:\s*(?:per|\/)\s*[a-zA-Z0-9 ]+)?/i
      );


  return match
    ? clean(
        match[0]
      )
    : "";
}


/* =========================================================
   DESTINATION EXTRACTION
   ========================================================= */

function extractDestination(
  text
) {
  const value =
    clean(
      text
    )
      .toLowerCase();


  for (
    const [
      term,
      destination
    ]
    of DESTINATION_RULES
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


/* =========================================================
   URL NORMALIZATION
   ========================================================= */

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


    if (
      parsed.protocol !==
        "http:" &&
      parsed.protocol !==
        "https:"
    ) {
      return "";
    }


    parsed.hash = "";


    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "msclkid"
    ]
      .forEach(
        (
          key
        ) =>
          parsed.searchParams
            .delete(
              key
            )
      );


    return parsed.toString();

  } catch {
    return "";
  }
}


/* =========================================================
   DOMAIN
   ========================================================= */

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


/* =========================================================
   WEBSITE ROOT
   ========================================================= */

function getWebsiteRoot(
  url
) {
  try {
    const parsed =
      new URL(
        url
      );


    return (
      `${parsed.protocol}//${parsed.hostname}`
    );

  } catch {
    return "";
  }
}


/* =========================================================
   EXCLUDED DOMAIN CHECK
   ========================================================= */

function isExcludedDomain(
  domain
) {
  const value =
    clean(
      domain
    )
      .toLowerCase();


  if (
    !value
  ) {
    return true;
  }


  if (
    EXCLUDED_DOMAINS.some(
      (
        excluded
      ) =>
        value ===
          excluded ||

        value.endsWith(
          `.${excluded}`
        )
    )
  ) {
    return true;
  }


  return EXCLUDED_TLDS.some(
    (
      tld
    ) =>
      value.endsWith(
        tld
      )
  );
}


/* =========================================================
   PRODUCT TOKENIZATION
   ========================================================= */

function tokenizeProduct(
  product
) {
  return unique(
    clean(
      product
    )
      .toLowerCase()

      .split(
        /[\s,./()_-]+/
      )

      .filter(
        (
          word
        ) =>
          word.length >=
            3 &&

          ![
            "the",
            "for",
            "and",
            "with",
            "premium"
          ]
            .includes(
              word
            )
      )
  );
}


/* =========================================================
   SIGNAL COUNTER
   ========================================================= */

function countSignals(
  text,
  signals
) {
  let count = 0;


  for (
    const signal
    of signals
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


/* =========================================================
   UNIQUE
   ========================================================= */

function unique(
  values
) {
  return [
    ...new Set(
      (
        values ||
        []
      )
        .filter(
          Boolean
        )
    )
  ];
}


/* =========================================================
   CLEAN
   ========================================================= */

function clean(
  value
) {
  if (
    value === null ||
    typeof value ===
      "undefined"
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
      MAX_INPUT_LENGTH
    );
}


/* =========================================================
   TRUNCATE
   ========================================================= */

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


  return (
    lastSpace >
    Math.floor(
      maxLength *
      0.6
    )
  )
    ? `${shortened
        .slice(
          0,
          lastSpace
        )
        .trim()}...`

    : `${shortened
        .trim()}...`;
}


/* =========================================================
   SAFE JSON
   ========================================================= */

async function safeJson(
  response
) {
  try {
    return await response.json();

  } catch {
    return {};
  }
}


/* =========================================================
   REQUEST ID
   ========================================================= */

function createRequestId() {
  const timestamp =
    Date.now()
      .toString(
        36
      )
      .toUpperCase();


  const random =
    Math.random()
      .toString(
        36
      )
      .slice(
        2,
        8
      )
      .toUpperCase();


  return (
    `CASEVO-${timestamp}-${random}`
  );
}


/* =========================================================
   CORS
   ========================================================= */

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


/* =========================================================
   JSON RESPONSE
   ========================================================= */

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
