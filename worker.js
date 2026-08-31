/**
 * CASEVO AI SOURCING ENGINE
 * Strict Real Company Filter
 * Version: 4.0.3
 *
 * GET  /api/health
 * POST /api/sourcing
 *
 * Required secret: TAVILY_API_KEY
 *
 * Frontend compatibility:
 *   data.brief
 *   data.analysis.normalized
 *   data.analysis.scoring
 *   data.analysis.matches
 *   data.matches
 */

const VERSION = "4.0.3";

const TAVILY_ENDPOINT =
  "https://api.tavily.com/search";

const SEARCH_TIMEOUT_MS = 15000;

const RESULTS_PER_QUERY = 10;
const MAX_SEARCH_QUERIES = 4;
const MAX_SUPPLIERS = 6;

const MAX_INPUT_LENGTH = 5000;
const MAX_QUERY_LENGTH = 390;
const MAX_CAPABILITY_LENGTH = 440;
const MAX_EVIDENCE_LENGTH = 700;


/* ============================================================
   EXCLUDED SOURCES
   ============================================================ */

const EXCLUDED_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "pinterest.com",
  "reddit.com",
  "tiktok.com",
  "twitter.com",
  "x.com",

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

  "wikipedia.org",
  "picclick.com",
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
   LOW-VALUE CONTENT
   ============================================================ */

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

  "what's the difference",
  "what is the difference",
  "difference between",

  "comparison",
  "review",
  "reviews",

  "market report",
  "industry report",

  "price list",
  "catalog",
  "catalogue",

  "laser engraving on leather",
  "laser engraving leather",

  "premium leather shoes",

  "complete guide"
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


/* ============================================================
   SUPPLIER SIGNALS
   ============================================================ */

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
  "founded",

  "company address",
  "registered office"
];

const COMPANY_SUFFIX_RE =
  /\b(?:co\.?\s*,?\s*ltd\.?|company\s+limited|ltd\.?|limited|inc\.?|corporation|corp\.?|llc)\b/i;

const GENERIC_TITLE_TERMS = [
  "shoe manufacturer",
  "shoes manufacturer",
  "footwear manufacturer",

  "leather shoe manufacturer",
  "leather shoes manufacturer",

  "custom shoes manufacturer",
  "custom footwear manufacturer",

  "shoe supplier",
  "shoes supplier",
  "leather supplier",

  "shoe factory",
  "shoes factory",
  "leather factory",

  "oem shoe manufacturer",
  "odm shoe manufacturer",

  "private label manufacturer",

  "premium leather shoes",

  "custom business casual shoes manufacturer",

  "reliable leather shoes manufacturer"
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


/* ============================================================
   CERTIFICATIONS
   ============================================================ */

const CERTIFICATION_RULES = [
  ["ISO 9001", /\biso\s*9001\b/i],
  ["ISO 14001", /\biso\s*14001\b/i],
  ["BSCI", /\bbsci\b/i],
  ["SEDEX", /\bsedex\b/i],
  ["SMETA", /\bsmeta\b/i],
  ["LWG", /\blwg\b/i],
  ["REACH", /\breach\b/i],
  ["RoHS", /\brohs\b/i],
  ["OEKO-TEX", /\boeko[\s-]?tex\b/i],
  ["GRS", /\bgrs\b/i],
  ["GOTS", /\bgots\b/i],
  ["FSC", /\bfsc\b/i],
  ["WRAP", /\bwrap\b/i]
];


/* ============================================================
   PRODUCT TERMS
   ============================================================ */

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

  ["rubber", "Rubber"],
  ["eva", "EVA"],
  ["tpr", "TPR"],
  ["textile", "Textile"],
  ["fabric", "Fabric"],
  ["sneaker", "Sneaker"],
  ["footwear", "Footwear"],
  ["shoe", "Shoe"],

  ["鞋面革", "Upper leather"],
  ["皮革", "Leather"],
  ["鞋面", "Shoe upper"],
  ["鞋", "Footwear"]
];


/* ============================================================
   DESTINATIONS
   ============================================================ */

const DESTINATION_RULES = [
  ["united states", "United States"],
  ["u.s.a.", "United States"],
  ["u.s.a", "United States"],
  ["usa", "United States"],
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
   LOCATIONS
   ============================================================ */

const LOCATION_RULES = [
  ["Guangzhou, China", ["guangzhou"]],
  ["Dongguan, China", ["dongguan"]],
  ["Foshan, China", ["foshan"]],
  ["Shenzhen, China", ["shenzhen"]],
  ["Quanzhou, China", ["quanzhou"]],
  ["Jinjiang, China", ["jinjiang"]],
  ["Wenzhou, China", ["wenzhou"]],
  ["Putian, China", ["putian"]],
  ["Chengdu, China", ["chengdu"]],
  ["Yiwu, China", ["yiwu"]],

  ["Guangdong, China", ["guangdong"]],
  ["Zhejiang, China", ["zhejiang"]],
  ["Fujian, China", ["fujian"]],
  ["Jiangsu, China", ["jiangsu"]],
  ["Sichuan, China", ["sichuan"]],
  ["Hebei, China", ["hebei"]],

  ["China", ["china", "chinese"]],
  ["India", ["india"]],
  ["Vietnam", ["vietnam"]],
  ["Indonesia", ["indonesia"]],
  ["Thailand", ["thailand"]],
  ["Bangladesh", ["bangladesh"]],
  ["Pakistan", ["pakistan"]],
  ["Turkey", ["turkey"]],
  ["Italy", ["italy"]],
  ["Spain", ["spain"]],
  ["Portugal", ["portugal"]],
  ["Germany", ["germany"]],
  ["France", ["france"]],
  ["Japan", ["japan"]],
  ["South Korea", ["south korea", "korea"]],
  ["Mexico", ["mexico"]],
  ["Brazil", ["brazil"]]
];


/* ============================================================
   WORKER ENTRY
   ============================================================ */

export default {

  async fetch(
    request,
    env
  ) {

    const url =
      new URL(
        request.url
      );


    if (
      request.method ===
      "OPTIONS"
    ) {

      return new Response(
        null,
        {
          status:
            204,

          headers:
            corsHeaders()
        }
      );
    }


    /* --------------------------------------------------------
       HEALTH
       -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       SOURCING
       -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       STATIC WEBSITE
       -------------------------------------------------------- */

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
        .filter(Boolean)
        .join(" ")
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

        strictCompanyFilter:
          true,

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


/* ============================================================
   REQUIREMENT NORMALIZATION
   ============================================================ */

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
      color =>
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


  const applications = [];


  if (
    /shoe|sneaker|footwear/i
      .test(
        combined
      )
  ) {

    applications.push(
      "footwear"
    );
  }


  if (
    /upper/i
      .test(
        combined
      )
  ) {

    applications.push(
      "shoe upper"
    );
  }


  if (
    applications.length
  ) {

    requirements.push(
      `Application: ${unique(
        applications
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


/* ============================================================
   SEARCH
   ============================================================ */

async function searchSuppliersWithTavily(
  analysis,
  apiKey
) {

  const product =
    analysis.product ||
    analysis.requirement ||
    "supplier";


  const queries =
    buildSearchQueries(
      product,
      analysis.destination
    );


  const responses =
    await Promise.allSettled(

      queries.map(
        query =>
          tavilySearch(
            query,
            apiKey
          )
      )

    );


  const successes =
    responses.filter(
      item =>
        item.status ===
        "fulfilled"
    );


  if (
    !successes.length
  ) {

    const firstFailure =
      responses.find(
        item =>
          item.status ===
          "rejected"
      );


    throw new Error(
      firstFailure?.reason?.message ||
      "All supplier searches failed."
    );
  }


  const allResults = [];


  for (
    const item
    of successes
  ) {

    const data =
      item.value;


    const results =
      Array.isArray(
        data?.results
      )
        ? data.results
        : [];


    for (
      const result
      of results
    ) {

      if (
        result?.url
      ) {

        allResults.push({
          ...result,

          _searchQuery:
            data._query
        });
      }
    }
  }


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
      successes.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.value?.usage?.credits ||
            0
          ),
        0
      )
  };
}


/* ============================================================
   SEARCH QUERIES
   ============================================================ */

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


  const destinationPart =
    destination

      ? ` export "${destination}"`

      : " exporter";


  return unique([
    `"${p}" manufacturer factory company official website`,

    `"${p}" OEM ODM manufacturer company factory`,

    `"${p}" manufacturer private label${destinationPart}`,

    `"${p}" factory company contact about us`
  ])
    .slice(
      0,
      MAX_SEARCH_QUERIES
    )
    .map(
      query =>
        query.slice(
          0,
          MAX_QUERY_LENGTH
        )
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


/* ============================================================
   DOMAIN DEDUPLICATION
   ============================================================ */

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


/* ============================================================
   SUPPLIER NORMALIZATION
   ============================================================ */

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


    /*
     * STRICT COMPANY GATE
     */

    const gate =
      evaluateRealCompanyGate(
        result,
        domain
      );


    if (
      !gate.pass
    ) {

      continue;
    }


    /*
     * STRICT COMPANY NAME
     */

    const companyName =
      extractTrustedCompanyName(
        result,
        domain,
        gate
      );


    if (
      !companyName
    ) {

      continue;
    }


    /*
     * MATCH SCORE
     */

    const matchScore =
      calculateMatchScore(
        result,
        analysis
      );


    if (
      matchScore < 45
    ) {

      continue;
    }


    const verification =
      calculateVerification(
        result,
        gate
      );


    candidates.push({
      result,
      domain,
      companyName,
      matchScore,
      verification,

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
    ) => {

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
        b.verification.score -
        a.verification.score
      );
    }
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


/* ============================================================
   REAL COMPANY GATE
   ============================================================ */

function evaluateRealCompanyGate(
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


  const text =
    `${title} ${content}`
      .toLowerCase();


  const legalName =
    extractLegalCompanyName(
      content
    ) ||
    extractLegalCompanyName(
      title
    );


  const titleCompany =
    extractCompanyNameFromTitle(
      title
    );


  const contentCompany =
    extractCompanyNameFromContent(
      content
    );


  const brandDomain =
    companyNameFromDomain(
      domain
    );


  const identitySignal =
    Boolean(
      legalName ||
      titleCompany ||
      contentCompany ||
      brandDomain
    );


  const manufacturingSignal =
    countSignals(
      text,
      MANUFACTURER_SIGNALS
    ) >= 1;


  const companyPageSignal =
    countSignals(
      text,
      COMPANY_SIGNALS
    ) >= 1;


  const commercialSignal =
    countSignals(
      text,
      COMMERCIAL_SIGNALS
    ) >= 1;


  const independentDomain =
    Boolean(
      domain
    ) &&
    !isExcludedDomain(
      domain
    );


  const evidenceCount =
    [
      identitySignal,
      manufacturingSignal,
      companyPageSignal,
      commercialSignal,
      independentDomain
    ]
      .filter(
        Boolean
      )
      .length;


  const strongIdentity =
    Boolean(
      legalName ||
      titleCompany ||
      contentCompany
    );


  /*
   * STRICT RULE:
   *
   * Must be:
   * - independent domain
   * - manufacturing evidence
   * - at least 3 real-company signals
   * - real identity OR brand-domain + company page
   */

  const pass =
    independentDomain &&
    manufacturingSignal &&
    evidenceCount >= 3 &&
    (
      strongIdentity ||
      (
        brandDomain &&
        companyPageSignal
      )
    );


  return {
    pass,
    evidenceCount,

    legalName,
    titleCompany,
    contentCompany,
    brandDomain,

    manufacturingSignal,
    companyPageSignal,
    commercialSignal,
    independentDomain
  };
}


/* ============================================================
   TRUSTED COMPANY NAME
   ============================================================ */

function extractTrustedCompanyName(
  result,
  domain,
  gate
) {

  const candidates = [
    gate?.legalName,
    gate?.contentCompany,
    gate?.titleCompany,
    gate?.brandDomain,

    extractCompanyNameFromContent(
      result?.content ||
      result?.raw_content ||
      ""
    ),

    extractCompanyNameFromTitle(
      result?.title ||
      ""
    ),

    companyNameFromDomain(
      domain
    )
  ];


  for (
    const candidate
    of candidates
  ) {

    const cleaned =
      cleanCompanyCandidate(
        candidate
      );


    if (
      cleaned &&
      !isGenericCompanyTitle(
        cleaned
      )
    ) {

      return cleaned;
    }
  }


  return "";
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


  const contact =
    extractContactInfo(
      result
    );


  return {

    rank:
      index + 1,

    name:
      candidate.companyName,

    companyName:
      candidate.companyName,

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
      candidate.matchScore,

    verificationScore:
      candidate.verification.score,

    verificationStatus:
      candidate.verification.status,

    verificationSignals:
      candidate.verification.signals,

    certifications:
      extractCertifications(
        result
      ),

    moq:
      extractMOQ(
        result
      ),

    contactEmail:
      contact.email,

    contactPhone:
      contact.phone,

    evidence:
      buildEvidence(
        result,
        analysis
      ),

    source:
      "Public web search",

    note:
      "Strict company-filter candidate. Company identity, capability, certifications, MOQ and commercial terms still require independent verification."
  };
}


/* ============================================================
   VERIFICATION
   ============================================================ */

function calculateVerification(
  result,
  gate
) {

  const content =
    sanitizeWebText(
      result?.content ||
      result?.raw_content ||
      ""
    );


  let score = 0;

  const signals = [];


  if (
    gate?.legalName
  ) {

    score += 25;

    signals.push(
      "Legal company-name signal"
    );

  } else if (
    gate?.titleCompany ||
    gate?.contentCompany
  ) {

    score += 18;

    signals.push(
      "Company identity signal"
    );

  } else if (
    gate?.brandDomain
  ) {

    score += 10;

    signals.push(
      "Brand-domain signal"
    );
  }


  if (
    gate?.manufacturingSignal
  ) {

    score += 22;

    signals.push(
      "Manufacturing capability signal"
    );
  }


  if (
    gate?.companyPageSignal
  ) {

    score += 12;

    signals.push(
      "Company-page signal"
    );
  }


  if (
    gate?.commercialSignal
  ) {

    score += 10;

    signals.push(
      "Commercial capability signal"
    );
  }


  if (
    extractEmail(
      content
    )
  ) {

    score += 10;

    signals.push(
      "Email found"
    );
  }


  if (
    extractPhone(
      content
    )
  ) {

    score += 6;

    signals.push(
      "Phone found"
    );
  }


  if (
    inferLocation(
      result
    ) !==
    "Not determined"
  ) {

    score += 5;

    signals.push(
      "Location signal"
    );
  }


  if (
    extractCertifications(
      result
    ).length
  ) {

    score += 10;

    signals.push(
      "Certification signal"
    );
  }


  score =
    Math.min(
      100,
      score
    );


  let status =
    "Unverified — due diligence required";


  if (
    score >= 75
  ) {

    status =
      "Strong public-web identity signals — verification required";

  } else if (
    score >= 55
  ) {

    status =
      "Moderate public-web identity signals — verification required";
  }


  return {
    score,

    status,

    signals:
      unique(
        signals
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
      term =>
        titleUrl.includes(
          term
        )
    )
  ) {

    return true;
  }


  if (
    LOW_VALUE_PATHS.some(
      path =>
        url.includes(
          path
        )
    )
  ) {

    return true;
  }


  if (
    /^(top|best|how|why|what|guide|list|review|directory|comparison)\b/i
      .test(
        title
      )
  ) {

    return true;
  }


  if (
    /\b(guide|difference|ideas|tips|trends|explained|everything you need to know)\b/i
      .test(
        title
      )
  ) {

    return true;
  }


  if (
    isGenericCompanyTitle(
      title
    ) &&
    !COMPANY_SUFFIX_RE.test(
      title
    )
  ) {

    return true;
  }


  return false;
}


/* ============================================================
   GENERIC TITLE FILTER
   ============================================================ */

function isGenericCompanyTitle(
  value
) {

  const lower =
    clean(
      value
    )
      .toLowerCase();


  if (
    !lower
  ) {

    return true;
  }


  return GENERIC_TITLE_TERMS.some(
    term =>
      lower === term ||
      lower.startsWith(
        `${term} |`
      ) ||
      lower.startsWith(
        `${term} -`
      )
  );
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
    ) * 38;


  if (
    product &&
    text.includes(
      product
    )
  ) {

    score += 25;
  }


  if (
    tokens.length
  ) {

    const hits =
      tokens.filter(
        token =>
          text.includes(
            token
          )
      )
        .length;


    score += Math.min(
      20,

      (
        hits /
        tokens.length
      ) * 20
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
    COMPANY_SUFFIX_RE.test(
      title
    ) ||
    COMPANY_SUFFIX_RE.test(
      content
    )
  ) {

    score += 5;
  }


  if (
    /manufacturer|factory|oem|odm/i
      .test(
        title
      )
  ) {

    score += 4;
  }


  if (
    CHINA_SIGNALS.some(
      signal =>
        text.includes(
          signal
        )
    )
  ) {

    score += 3;
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


  const text =
    `${title} ${content}`
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
    COMPANY_SUFFIX_RE.test(
      text
    )
  ) {

    score += 12;
  }


  if (
    looksLikeArticleTitle(
      title
    ) ||
    isGenericCompanyTitle(
      title
    )
  ) {

    score -= 25;
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


  const privateLabel =
    /private label/
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
    oem &&
    privateLabel
  ) {

    return (
      "Manufacturer / OEM / ODM / Private Label"
    );
  }


  if (
    manufacturer &&
    oem
  ) {

    return (
      "Manufacturer / OEM / ODM"
    );
  }


  if (
    manufacturer &&
    exporter
  ) {

    return (
      "Manufacturer / Exporter"
    );
  }


  if (
    manufacturer
  ) {

    return (
      "Manufacturer / Factory"
    );
  }


  if (
    oem
  ) {

    return (
      "OEM / ODM Manufacturer"
    );
  }


  return (
    "Potential Manufacturer"
  );
}


/* ============================================================
   LEGAL COMPANY NAME
   ============================================================ */

function extractLegalCompanyName(
  value
) {

  const text =
    sanitizeWebText(
      value
    );


  if (
    !text
  ) {

    return "";
  }


  const patterns = [

    /\b([A-Z][A-Za-z0-9&'.,()\- ]{2,90}\b(?:Co\.?\s*,?\s*Ltd\.?|Company\s+Limited|Ltd\.?|Limited|Inc\.?|Corporation|Corp\.?|LLC))\b/,

    /\b([A-Z][A-Za-z0-9&'.,()\- ]{2,90}\b(?:Shoes|Footwear|Leather)\s+(?:Co\.?\s*,?\s*Ltd\.?|Company\s+Limited|Ltd\.?|Limited))\b/i

  ];


  for (
    const pattern
    of patterns
  ) {

    const match =
      text.match(
        pattern
      );


    if (
      match?.[1]
    ) {

      return clean(
        match[1]
      );
    }
  }


  return "";
}


/* ============================================================
   COMPANY NAME FROM TITLE
   ============================================================ */

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
    isGenericCompanyTitle(
      value
    )
  ) {

    return "";
  }


  const legal =
    extractLegalCompanyName(
      value
    );


  if (
    legal
  ) {

    return legal;
  }


  const parts =
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


  for (
    const part
    of parts
  ) {

    if (
      looksLikeCompanyName(
        part
      ) &&
      !isGenericCompanyTitle(
        part
      )
    ) {

      return part;
    }
  }


  return (
    looksLikeCompanyName(
      value
    ) &&
    !isGenericCompanyTitle(
      value
    )
  )
    ? value
    : "";
}


/* ============================================================
   COMPANY NAME FROM CONTENT
   ============================================================ */

function extractCompanyNameFromContent(
  content
) {

  const text =
    sanitizeWebText(
      content
    );


  if (
    !text
  ) {

    return "";
  }


  const legal =
    extractLegalCompanyName(
      text
    );


  if (
    legal
  ) {

    return legal;
  }


  const patterns = [

    /(?:welcome to|about us at|about)\s+([A-Z][A-Za-z0-9&'.,()\- ]{3,80})/i,

    /([A-Z][A-Za-z0-9&'.,()\- ]{3,80})\s+(?:is|are)\s+(?:a|an|one of)\s+(?:professional\s+)?(?:shoe|footwear|leather)?\s*(?:manufacturer|factory|supplier)/i,

    /(?:company name|manufacturer)\s*[:\-]\s*([A-Z][A-Za-z0-9&'.,()\- ]{3,80})/i

  ];


  for (
    const pattern
    of patterns
  ) {

    const match =
      text.match(
        pattern
      );


    if (
      match?.[1]
    ) {

      const candidate =
        cleanCompanyCandidate(
          match[1]
        );


      if (
        candidate &&
        !isGenericCompanyTitle(
          candidate
        )
      ) {

        return candidate;
      }
    }
  }


  return "";
}


/* ============================================================
   COMPANY NAME VALIDATION
   ============================================================ */

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
    GENERIC_TITLE_TERMS.some(
      term =>
        lower === term
    )
  ) {

    return false;
  }


  if (
    /\b(guide|difference|ideas|tips|trends|explained)\b/i
      .test(
        text
      )
  ) {

    return false;
  }


  return true;
}


/* ============================================================
   COMPANY NAME CLEANUP
   ============================================================ */

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


  if (
    !looksLikeCompanyName(
      text
    ) ||
    isGenericCompanyTitle(
      text
    )
  ) {

    return "";
  }


  return text.slice(
    0,
    100
  );
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

    ||

    /\b(guide|difference|ideas|tips|trends|explained|everything you need to know)\b/i
      .test(
        value
      )
  );
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
    !first ||
    first.length < 3
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
    "china",
    "customshoes",
    "shoefactory",
    "shoemanufacturer"
  ];


  if (
    generic.includes(
      first
    )
  ) {

    return "";
  }


  const alpha =
    first.replace(
      /[^a-z0-9-]/g,
      ""
    );


  if (
    !alpha ||
    /^\d+$/.test(
      alpha
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
      char =>
        char.toUpperCase()
    )

    .trim();
}


/* ============================================================
   CERTIFICATIONS
   ============================================================ */

function extractCertifications(
  result
) {

  const text =
    `${result?.title || ""} ${result?.content || ""} ${result?.raw_content || ""}`;


  const found = [];


  for (
    const [
      label,
      pattern
    ]
    of CERTIFICATION_RULES
  ) {

    if (
      pattern.test(
        text
      )
    ) {

      found.push(
        label
      );
    }
  }


  return unique(
    found
  );
}


/* ============================================================
   MOQ
   ============================================================ */

function extractMOQ(
  result
) {

  const text =
    sanitizeWebText(
      `${result?.content || ""} ${result?.raw_content || ""}`
    );


  const patterns = [

    /\bmoq\s*[:\-]?\s*(\d[\d,.\s]*\s*(?:pairs?|pcs?|pieces?|units?|sets?|kg|meters?|yards?))/i,

    /\bminimum\s+order(?:\s+quantity)?\s*[:\-]?\s*(\d[\d,.\s]*\s*(?:pairs?|pcs?|pieces?|units?|sets?|kg|meters?|yards?))/i,

    /\bminimum\s+order\s+of\s+(\d[\d,.\s]*\s*(?:pairs?|pcs?|pieces?|units?|sets?|kg|meters?|yards?))/i

  ];


  for (
    const pattern
    of patterns
  ) {

    const match =
      text.match(
        pattern
      );


    if (
      match?.[1]
    ) {

      return clean(
        match[1]
      );
    }
  }


  return "";
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
    extractRelevantEvidence(

      `${result?.title || ""}. ${result?.content || ""} ${result?.raw_content || ""}`,

      product

    );


  if (
    !evidence
  ) {

    return (
      `Public-web evidence indicates potential manufacturing relevance to ${product}. Independent verification is required.`
    );
  }


  return truncate(

    `Public-web evidence indicates potential manufacturing capability related to ${product}. ${evidence}`,

    MAX_CAPABILITY_LENGTH

  );
}


/* ============================================================
   EVIDENCE
   ============================================================ */

function buildEvidence(
  result,
  analysis
) {

  const evidence =
    extractRelevantEvidence(

      `${result?.title || ""}. ${result?.content || ""} ${result?.raw_content || ""}`,

      analysis?.product

    );


  return truncate(

    evidence ||
    "Public-web supplier evidence returned for review.",

    MAX_EVIDENCE_LENGTH

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
    splitSentences(
      cleaned
    )
      .filter(
        sentence =>
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
          COMPANY_SUFFIX_RE.test(
            sentence
          )
        ) {

          score += 4;
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
        item =>
          item.score > 0
      )

      .slice(
        0,
        4
      )

      .map(
        item =>
          item.sentence
      )

  )
    .join(
      " "
    );
}


/* ============================================================
   CONTACT INFO
   ============================================================ */

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


/* ============================================================
   EMAIL
   ============================================================ */

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
          email =>
            clean(
              email
            )
              .toLowerCase()
        )

        .filter(
          email =>
            !/example\.com$|domain\.com$|email\.com$|wixpress\.com$/
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


/* ============================================================
   PHONE
   ============================================================ */

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


/* ============================================================
   LOCATION
   ============================================================ */

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
        signal =>
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


/* ============================================================
   READINESS
   ============================================================ */

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
      clarity * 0.35 +
      specification * 0.40 +
      commercial * 0.25
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


/* ============================================================
   PRODUCT
   ============================================================ */

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


/* ============================================================
   QUANTITY
   ============================================================ */

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


/* ============================================================
   PRICE
   ============================================================ */

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


/* ============================================================
   DESTINATION
   ============================================================ */

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


/* ============================================================
   WEB TEXT SANITIZATION
   ============================================================ */

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


/* ============================================================
   SENTENCES
   ============================================================ */

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


/* ============================================================
   URL
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


    if (
      parsed.protocol !==
        "http:" &&
      parsed.protocol !==
        "https:"
    ) {

      return "";
    }


    parsed.hash =
      "";


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
        key =>
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
      `${parsed.protocol}//${parsed.hostname}`
    );

  } catch {

    return "";
  }
}


/* ============================================================
   DOMAIN FILTER
   ============================================================ */

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
      excluded =>
        value === excluded ||
        value.endsWith(
          `.${excluded}`
        )
    )
  ) {

    return true;
  }


  return EXCLUDED_TLDS.some(
    tld =>
      value.endsWith(
        tld
      )
  );
}


/* ============================================================
   PRODUCT TOKENIZATION
   ============================================================ */

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
        word =>
          word.length >= 3 &&
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


/* ============================================================
   SIGNAL COUNTER
   ============================================================ */

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


/* ============================================================
   UNIQUE
   ============================================================ */

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


/* ============================================================
   CLEAN
   ============================================================ */

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
      maxLength *
      0.6
    )
  ) {

    return (
      `${shortened
        .slice(
          0,
          lastSpace
        )
        .trim()}...`
    );
  }


  return (
    `${shortened.trim()}...`
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
