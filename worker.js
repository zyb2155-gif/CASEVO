/**
 * CASEVO AI SOURCING ENGINE
 * Cloudflare Worker
 *
 * Version: 4.0.0
 *
 * Endpoints:
 *   POST /api/sourcing
 *   GET  /api/health
 *
 * Required secret:
 *   TAVILY_API_KEY
 *
 * Frontend-compatible response:
 *   data.brief
 *   data.analysis.normalized
 *   data.analysis.scoring
 *   data.analysis.matches
 *
 * Also returns top-level `matches`
 * for backward compatibility.
 */

const VERSION = "4.0.0";

/* =========================================================
   CONFIGURATION
   ========================================================= */

const EXCLUDED_DOMAINS = [
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

  "wikipedia.org",
  "picclick.com"
];

const LOW_VALUE_TERMS = [
  "top 10",
  "top 20",
  "top 50",
  "top 5",

  "best manufacturers",
  "best suppliers",
  "best factories",

  "supplier directory",
  "supplier directories",
  "directory",
  "directories",

  "marketplace",

  "list of suppliers",
  "list of manufacturers",

  "buyer's guide",
  "buyers guide",

  "quick guide",
  "ultimate guide",

  "how to",
  "what is",
  "comparison",

  "review",
  "reviews",

  "blog",
  "article",
  "news",
  "journal",
  "magazine",

  "market report",
  "industry report",

  "price list",
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
  "/tag/",
  "/search/",
  "/directory/",
  "/directories/",
  "/listing/",
  "/listings/"
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
  "jiangsu",
  "sichuan",
  "hebei",
  "shoes",
  "footwear"
];

const MANUFACTURER_SIGNALS = [
  "manufacturer",
  "manufacturing",
  "factory",
  "production",
  "producer",
  "production facility",
  "manufacturing facility",
  "manufacturing plant",
  "factory direct",
  "factory outlet"
];

const COMMERCIAL_SIGNALS = [
  "oem",
  "odm",
  "exporter",
  "export",
  "wholesale",
  "custom",
  "b2b",
  "private label",
  "bulk",
  "moq"
];

const COMPANY_SIGNALS = [
  "contact us",
  "contact",
  "email",
  "phone",
  "address",
  "company",
  "about us",
  "our factory",
  "our production",
  "our products",
  "capabilities",
  "factory"
];


/* =========================================================
   MAIN WORKER
   ========================================================= */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* -------------------------------------------------------
       CORS
       ------------------------------------------------------- */

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    /* -------------------------------------------------------
       HEALTH
       ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       SOURCING API
       ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       STATIC WEBSITE
       ------------------------------------------------------- */

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      "CASEVO Worker is running.",
      {
        status: 200,
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

  /* -------------------------------------------------------
     Parse JSON
     ------------------------------------------------------- */

  try {
    body = await request.json();
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

  /* -------------------------------------------------------
     Read fields
     ------------------------------------------------------- */

  const requirement = clean(
    body?.requirement ??
    body?.requirements ??
    body?.brief
  );

  const productInput = clean(
    body?.product ??
    body?.product_material ??
    body?.productMaterial
  );

  const quantityInput = clean(
    body?.quantity
  );

  const targetPriceInput = clean(
    body?.targetPrice ??
    body?.target_price ??
    body?.price
  );

  const destinationInput = clean(
    body?.destination
  );

  /* -------------------------------------------------------
     Validation
     ------------------------------------------------------- */

  if (!requirement && !productInput) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Please enter a sourcing requirement."
      },
      400
    );
  }

  /* -------------------------------------------------------
     Combined input
     ------------------------------------------------------- */

  const combined = [
    requirement,
    productInput,
    quantityInput,
    targetPriceInput,
    destinationInput
  ]
    .filter(Boolean)
    .join(" ");

  /* -------------------------------------------------------
     Normalize requirement
     ------------------------------------------------------- */

  const normalized = normalizeRequirement({
    requirement,
    productInput,
    quantityInput,
    targetPriceInput,
    destinationInput,
    combined
  });

  /* -------------------------------------------------------
     Tavily API key
     ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     REAL WEB SEARCH
     ------------------------------------------------------- */

  try {
    const search =
      await searchSuppliersWithTavily(
        normalized,
        env.TAVILY_API_KEY
      );

    /* -----------------------------------------------------
       Normalize supplier results
       ----------------------------------------------------- */

    const matches =
      normalizeSupplierResults(
        search.results || [],
        normalized
      );

    /* -----------------------------------------------------
       Readiness scoring
       ----------------------------------------------------- */

    const scoring =
      calculateReadiness(
        normalized
      );

    /* -----------------------------------------------------
       Brief
       ----------------------------------------------------- */

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

    /* =====================================================
       FRONTEND RESPONSE STRUCTURE
       =====================================================

       Current CASEVO script.js expects:

       data.analysis.normalized
       data.analysis.scoring
       data.analysis.matches

       These MUST remain nested here.
       ===================================================== */

    const response = {
      ok: true,

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

      /* ---------------------------------------------------
         Backward compatibility
         --------------------------------------------------- */

      matches,

      /* ---------------------------------------------------
         Metadata
         --------------------------------------------------- */

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

        suppliersReturned:
          matches.length,

        creditsUsed:
          search.creditsUsed,

        timestamp:
          new Date().toISOString()
      }
    };

    return jsonResponse(
      response
    );
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


/* =========================================================
   REQUIREMENT NORMALIZATION
   ========================================================= */

function normalizeRequirement(input) {
  const requirement = clean(
    input.requirement
  );

  const combined = clean(
    input.combined
  );

  let product = clean(
    input.productInput
  );

  if (!product) {
    product =
      extractProduct(
        combined
      );
  }

  let quantity = clean(
    input.quantityInput
  );

  if (!quantity) {
    quantity =
      extractQuantity(
        combined
      );
  }

  let targetPrice = clean(
    input.targetPriceInput
  );

  if (!targetPrice) {
    targetPrice =
      extractPrice(
        combined
      );
  }

  let destination = clean(
    input.destinationInput
  );

  if (!destination) {
    destination =
      extractDestination(
        combined
      );
  }

  /* -------------------------------------------------------
     Structured requirements
     ------------------------------------------------------- */

  const requirements = [];

  const lower =
    combined.toLowerCase();

  if (product) {
    requirements.push(
      `Product / material: ${product}`
    );
  }

  if (quantity) {
    requirements.push(
      `Quantity: ${quantity}`
    );
  }

  if (targetPrice) {
    requirements.push(
      `Target price: ${targetPrice}`
    );
  }

  if (destination) {
    requirements.push(
      `Destination: ${destination}`
    );
  }

  /* -------------------------------------------------------
     Thickness
     ------------------------------------------------------- */

  const thickness =
    combined.match(
      /\b\d+(?:\.\d+)?\s*(?:mm|cm|inch|inches)\b/i
    );

  if (thickness) {
    requirements.push(
      `Thickness: ${thickness[0]}`
    );
  }

  /* -------------------------------------------------------
     Color
     ------------------------------------------------------- */

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
        lower.includes(color)
    );

  if (foundColors.length) {
    requirements.push(
      `Color: ${foundColors.join(", ")}`
    );
  }

  /* -------------------------------------------------------
     Leather grade
     ------------------------------------------------------- */

  if (
    /full[\s-]?grain/i.test(
      combined
    )
  ) {
    requirements.push(
      "Leather grade: full-grain"
    );
  } else if (
    /top[\s-]?grain/i.test(
      combined
    )
  ) {
    requirements.push(
      "Leather grade: top-grain"
    );
  } else if (
    /genuine leather/i.test(
      combined
    )
  ) {
    requirements.push(
      "Material type: genuine leather"
    );
  }

  /* -------------------------------------------------------
     Application
     ------------------------------------------------------- */

  const useCase = [];

  if (
    /shoe|sneaker|footwear/i.test(
      combined
    )
  ) {
    useCase.push(
      "footwear"
    );
  }

  if (
    /upper/i.test(
      combined
    )
  ) {
    useCase.push(
      "shoe upper"
    );
  }

  if (useCase.length) {
    requirements.push(
      `Application: ${useCase.join(", ")}`
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

  /* -------------------------------------------------------
     Tags
     ------------------------------------------------------- */

  const tags =
    unique([
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

      /full[\s-]?grain/i.test(
        combined
      ) &&
        "full-grain",

      /shoe|sneaker|footwear/i.test(
        combined
      ) &&
        "footwear",

      /upper/i.test(
        combined
      ) &&
        "shoe upper"
    ].filter(Boolean));

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

  /* -------------------------------------------------------
     Multiple sourcing queries
     ------------------------------------------------------- */

  const queries =
    unique([
      `"${product}" China manufacturer factory OEM supplier official website`,

      `"${product}" China factory production manufacturer exporter OEM`,

      `"${product}" China manufacturer footwear supplier factory ${
        destination || "export"
      }`
    ]);

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

  responses.forEach(
    (
      data,
      index
    ) => {
      const results =
        Array.isArray(
          data?.results
        )
          ? data.results
          : [];

      results.forEach(
        result => {
          if (!result?.url) {
            return;
          }

          allResults.push({
            ...result,

            _searchQuery:
              queries[index]
          });
        }
      );
    }
  );

  const deduplicated =
    deduplicateResults(
      allResults
    );

  return {
    results:
      deduplicated,

    searchQueries:
      queries,

    resultsScanned:
      allResults.length,

    creditsUsed:
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


/* =========================================================
   TAVILY API CALL
   ========================================================= */

async function tavilySearch(
  query,
  apiKey
) {
  const response =
    await fetch(
      "https://api.tavily.com/search",
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
            query:
              clean(query)
                .slice(
                  0,
                  390
                ),

            topic:
              "general",

            search_depth:
              "basic",

            max_results:
              10,

            include_answer:
              false,

            include_raw_content:
              true,

            include_images:
              false,

            exclude_domains:
              EXCLUDED_DOMAINS
          })
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
}


/* =========================================================
   RESULT DEDUPLICATION
   ========================================================= */

function deduplicateResults(
  results
) {
  const seenUrls =
    new Set();

  const seenDomains =
    new Set();

  const output = [];

  for (
    const result of results
  ) {
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

    seenUrls.add(
      url
    );

    seenDomains.add(
      domain
    );

    output.push({
      ...result,
      url
    });
  }

  return output;
}


/* =========================================================
   SUPPLIER NORMALIZATION
   ========================================================= */

function normalizeSupplierResults(
  results,
  analysis
) {
  const candidates =
    results
      .filter(
        result =>
          result?.url
      )
      .filter(
        result =>
          !isLowValuePage(
            result
          )
      )
      .map(
        result => ({
          result,

          domain:
            getDomain(
              result.url
            ),

          supplierType:
            detectSupplierType(
              result
            ),

          score:
            calculateMatchScore(
              result,
              analysis
            )
        })
      )
      .filter(
        candidate =>
          candidate.domain
      )
      .sort(
        (
          a,
          b
        ) =>
          b.score -
          a.score
      );

  /* -------------------------------------------------------
     Prefer strong matches.
     If the search is weak, return the best candidates
     rather than pretending the search found nothing.
     ------------------------------------------------------- */

  const strong =
    candidates.filter(
      candidate =>
        candidate.score >= 48
    );

  const selected =
    (
      strong.length
        ? strong
        : candidates
    )
      .slice(
        0,
        8
      );

  return selected.map(
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

      const location =
        inferLocation(
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

        location,

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
            result.raw_content ||
            result.content ||
            ""
          ).slice(
            0,
            1200
          ),

        note:
          `Public-web evidence suggests potential ${candidate.supplierType.toLowerCase()} capability. ` +
          `Supplier identity and commercial capability require independent verification.`
      };
    }
  );
}


/* =========================================================
   LOW VALUE FILTER
   ========================================================= */

function isLowValuePage(
  result
) {
  const title =
    clean(
      result.title
    ).toLowerCase();

  const content =
    clean(
      result.content ||
      result.raw_content ||
      ""
    ).toLowerCase();

  const url =
    clean(
      result.url
    ).toLowerCase();

  const combined =
    `${title} ${content} ${url}`;

  if (
    EXCLUDED_DOMAINS.some(
      domain =>
        url.includes(
          domain
        )
    )
  ) {
    return true;
  }

  if (
    LOW_VALUE_TERMS.some(
      term =>
        combined.includes(
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

  return false;
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
      result.title
    );

  const content =
    clean(
      result.content ||
      result.raw_content ||
      ""
    );

  const url =
    clean(
      result.url
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
      analysis.product
    ).toLowerCase();

  const productTokens =
    tokenizeProduct(
      product
    );

  let score =
    Number(
      result.score ||
      0
    ) * 45;

  /* -------------------------------------------------------
     Exact product match
     ------------------------------------------------------- */

  if (
    product &&
    text.includes(
      product
    )
  ) {
    score += 25;
  }

  /* -------------------------------------------------------
     Product token matching
     ------------------------------------------------------- */

  let tokenHits =
    0;

  for (
    const token of productTokens
  ) {
    if (
      text.includes(
        token
      )
    ) {
      tokenHits++;
    }
  }

  if (
    productTokens.length
  ) {
    score += Math.min(
      18,
      (
        tokenHits /
        productTokens.length
      ) * 18
    );
  }

  /* -------------------------------------------------------
     Manufacturer signals
     ------------------------------------------------------- */

  if (
    MANUFACTURER_SIGNALS.some(
      signal =>
        text.includes(
          signal
        )
    )
  ) {
    score += 14;
  }

  /* -------------------------------------------------------
     Commercial signals
     ------------------------------------------------------- */

  if (
    COMMERCIAL_SIGNALS.some(
      signal =>
        text.includes(
          signal
        )
    )
  ) {
    score += 8;
  }

  /* -------------------------------------------------------
     Company credibility
     ------------------------------------------------------- */

  if (
    COMPANY_SIGNALS.some(
      signal =>
        text.includes(
          signal
        )
    )
  ) {
    score += 6;
  }

  /* -------------------------------------------------------
     China relevance
     ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     Supplier title
     ------------------------------------------------------- */

  if (
    /supplier|manufacturer|factory|oem|odm/i.test(
      title
    )
  ) {
    score += 8;
  }

  /* -------------------------------------------------------
     Article/list penalty
     ------------------------------------------------------- */

  if (
    LOW_VALUE_TERMS.some(
      term =>
        text.includes(
          term
        )
    )
  ) {
    score -= 35;
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
    analysis.requirements.length >= 3;

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
      ) / 4 * 100
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
      ) / 3 * 100
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


/* =========================================================
   SUPPLIER TYPE
   ========================================================= */

function detectSupplierType(
  result
) {
  const text = (
    clean(
      result.title
    ) +

    " " +

    clean(
      result.content ||
      result.raw_content
    ) +

    " " +

    clean(
      result.url
    )
  ).toLowerCase();

  if (
    /manufacturer|manufacturing|factory/.test(
      text
    )
  ) {
    return "Manufacturer / Factory";
  }

  if (
    /oem|odm/.test(
      text
    )
  ) {
    return "OEM / ODM Manufacturer";
  }

  if (
    /exporter|export/.test(
      text
    )
  ) {
    return "Manufacturer / Exporter";
  }

  if (
    /supplier/.test(
      text
    )
  ) {
    return "Manufacturer / Supplier";
  }

  return "Potential Manufacturer";
}


/* =========================================================
   CAPABILITY
   ========================================================= */

function buildCapability(
  result,
  analysis
) {
  const evidence =
    clean(
      result.raw_content ||
      result.content ||
      ""
    );

  const product =
    analysis.product ||
    "the requested product";

  if (!evidence) {
    return (
      `Public-web result related to ${product}. ` +
      `Direct supplier verification is required.`
    );
  }

  return (
    `Public-web evidence indicates potential manufacturing or supply capability related to ${product}. ` +
    evidence.slice(
      0,
      650
    )
  );
}


/* =========================================================
   SUPPLIER NAME
   ========================================================= */

function cleanSupplierName(
  title,
  domain,
  content
) {
  let value =
    clean(
      title
    )
      .replace(
        /\s*[|–—-]\s*(official website|official site|home|homepage)$/i,
        ""
      )
      .trim();

  const articleLike =
    /^(top|best|how|why|what|guide|list|review|directory|supplier directory)/i
      .test(
        value
      );

  if (
    !value ||
    articleLike
  ) {
    const fromContent =
      extractCompanyNameFromContent(
        content
      );

    if (
      fromContent
    ) {
      value =
        fromContent;
    }
  }

  if (!value) {
    value =
      companyNameFromDomain(
        domain
      );
  }

  return (
    value ||
    "Potential manufacturer"
  ).slice(
    0,
    180
  );
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

  const patterns = [
    /(?:welcome to|about us at|about)\s+([A-Z][A-Za-z0-9&.,' -]{3,80})/i,

    /([A-Z][A-Za-z0-9&.,' -]{3,80})\s+(?:is a|are a)\s+(?:manufacturer|factory|supplier)/i
  ];

  for (
    const pattern of patterns
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


/* =========================================================
   COMPANY NAME FROM DOMAIN
   ========================================================= */

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

  if (!parts.length) {
    return "";
  }

  return parts[0]
    .replace(
      /[-_]+/g,
      " "
    )
    .trim()
    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase()
    );
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
      parsed.protocol +
      "//" +
      parsed.hostname
    );
  } catch {
    return clean(
      url
    );
  }
}


/* =========================================================
   URL NORMALIZATION
   ========================================================= */

function normalizeUrl(
  url
) {
  try {
    const parsed =
      new URL(
        url
      );

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

    trackingParams.forEach(
      parameter =>
        parsed.searchParams.delete(
          parameter
        )
    );

    return parsed.toString();
  } catch {
    return "";
  }
}


/* =========================================================
   LOCATION
   ========================================================= */

function inferLocation(
  result
) {
  const text = (
    clean(
      result.title
    ) +

    " " +

    clean(
      result.content ||
      result.raw_content
    ) +

    " " +

    clean(
      result.url
    )
  ).toLowerCase();

  const locations = [
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
      ["china"]
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
      "United States",
      [
        "united states",
        "usa",
        "u.s.a."
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

  for (
    const [
      label,
      signals
    ] of locations
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


/* =========================================================
   CONTACT EXTRACTION
   ========================================================= */

function extractContactInfo(
  result
) {
  const text =
    clean(
      `${result.content || ""} ${result.raw_content || ""}`
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


/* =========================================================
   PRODUCT EXTRACTION
   ========================================================= */

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

  const patterns = [
    /((?:premium\s+)?full[\s-]?grain\s+leather\s+shoe\s+upper)/i,

    /((?:full[\s-]?grain\s+)?leather\s+shoe\s+upper)/i,

    /((?:genuine\s+)?leather\s+shoe\s+upper)/i,

    /((?:microfiber|synthetic|pu)\s+leather\s+(?:shoe\s+)?upper)/i,

    /((?:shoe|sneaker|footwear)\s+(?:upper|leather))/i
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      value.match(
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

  const keywords = [
    "microfiber leather",
    "synthetic leather",
    "pu leather",

    "full-grain leather",
    "full grain leather",

    "genuine leather",

    "leather shoe upper",
    "shoe upper",
    "upper leather",

    "footwear",
    "sneaker",
    "leather"
  ];

  const lower =
    value.toLowerCase();

  for (
    const keyword of keywords
  ) {
    const index =
      lower.indexOf(
        keyword
      );

    if (index >= 0) {
      const start =
        Math.max(
          0,
          index - 30
        );

      const end =
        Math.min(
          value.length,
          index +
          keyword.length +
          35
        );

      const fragment =
        value
          .slice(
            start,
            end
          )
          .replace(
            /^[,.;:()\s-]+/,
            ""
          )
          .replace(
            /[,.;:()\s-]+$/,
            ""
          );

      return clean(
        fragment
      );
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
  const value =
    clean(
      text
    );

  const match =
    value.match(
      /(\d[\d,.\s]*)\s*(pairs?|pcs?|pieces?|kg|tons?|mt|sqm|sqft|square meters?|units?)/i
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
  const value =
    clean(
      text
    );

  const match =
    value.match(
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
    );

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

    "UAE",
    "Saudi Arabia",

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
      return (
        destination === "USA"
          ? "United States"
          : destination
      );
    }
  }

  return "";
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
        word =>
          word.length >= 3 &&
          ![
            "the",
            "for",
            "and",
            "with"
          ].includes(
            word
          )
      )
  );
}


/* =========================================================
   UNIQUE
   ========================================================= */

function unique(
  values
) {
  return [
    ...new Set(
      values.filter(
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
      5000
    );
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
      "Content-Type, Accept"
  };
}
