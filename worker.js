/**
 * CASEVO AI SOURCING ENGINE
 * Final Worker — Real Supplier Discovery
 *
 * Endpoints:
 *   GET  /api/health
 *   POST /api/sourcing
 *
 * Required Cloudflare secret:
 *   TAVILY_API_KEY
 *
 * Existing frontend-compatible response fields are preserved:
 *   requestId, analysis, matches, meta
 */

const VERSION = "4.0.0";

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
  "/listings/",
  "/wiki/"
];

const LOW_VALUE_TITLE_PATTERNS = [
  /^top\s+\d+/i,
  /^best\s+/i,
  /^how\s+to\b/i,
  /^what\s+is\b/i,
  /^why\s+/i,
  /^guide\b/i,
  /^a\s+guide\b/i,
  /^list\s+of\b/i,
  /^review\b/i,
  /^reviews\b/i,
  /^directory\b/i,
  /^market report\b/i,
  /^industry report\b/i
];

const MANUFACTURER_SIGNALS = [
  "manufacturer",
  "manufacturing",
  "factory",
  "factory direct",
  "production facility",
  "manufacturing facility",
  "manufacturing plant",
  "production line",
  "producer",
  "factory outlet",
  "factory supplier"
];

const COMMERCIAL_SIGNALS = [
  "oem",
  "odm",
  "exporter",
  "export",
  "wholesale",
  "custom production",
  "private label",
  "b2b",
  "bulk order",
  "contract manufacturing"
];

const CONTACT_SIGNALS = [
  "contact us",
  "contact",
  "email",
  "phone",
  "address",
  "about us",
  "company",
  "our factory",
  "our production"
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
  "shandong",
  "qingdao",
  "xiamen"
];

const COUNTRY_PATTERNS = [
  ["Guangdong, China", ["guangdong"]],
  ["Guangzhou, China", ["guangzhou"]],
  ["Dongguan, China", ["dongguan"]],
  ["Foshan, China", ["foshan"]],
  ["Shenzhen, China", ["shenzhen"]],
  ["Zhejiang, China", ["zhejiang"]],
  ["Wenzhou, China", ["wenzhou"]],
  ["Yiwu, China", ["yiwu"]],
  ["Fujian, China", ["fujian"]],
  ["Quanzhou, China", ["quanzhou"]],
  ["Jinjiang, China", ["jinjiang"]],
  ["Putian, China", ["putian"]],
  ["Jiangsu, China", ["jiangsu"]],
  ["Shandong, China", ["shandong"]],
  ["China", ["china", "chinese"]],
  ["Vietnam", ["vietnam", "vietnamese"]],
  ["India", ["india", "indian"]],
  ["Indonesia", ["indonesia"]],
  ["Thailand", ["thailand"]],
  ["Bangladesh", ["bangladesh"]],
  ["Pakistan", ["pakistan"]],
  ["Turkey", ["turkey", "turkiye"]],
  ["Italy", ["italy", "italian"]],
  ["Spain", ["spain", "spanish"]],
  ["Portugal", ["portugal"]],
  ["Germany", ["germany", "german"]],
  [
    "United States",
    ["united states", "usa", "u.s.a.", "us-based"]
  ],
  ["Mexico", ["mexico", "mexican"]],
  ["Brazil", ["brazil", "brazilian"]],
  ["South Korea", ["south korea", "korea"]],
  ["Japan", ["japan", "japanese"]],
  ["Taiwan", ["taiwan"]],
  ["Cambodia", ["cambodia"]],
  ["Malaysia", ["malaysia"]],
  ["Poland", ["poland"]],
  ["Romania", ["romania"]],
  ["France", ["france", "french"]]
];

export default {
  async fetch(request, env) {
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
        api_key_configured: Boolean(env.TAVILY_API_KEY),
        timestamp: new Date().toISOString()
      });
    }

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

      return handleSourcingRequest(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      "CASEVO Worker is running.",
      {
        status: 200,
        headers: {
          "Content-Type":
            "text/plain; charset=UTF-8",
          ...corsHeaders()
        }
      }
    );
  }
};

async function handleSourcingRequest(
  request,
  env
) {
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

  const requirement =
    clean(body?.requirement);

  const productInput =
    clean(body?.product);

  const quantityInput =
    clean(body?.quantity);

  const targetPriceInput =
    clean(body?.targetPrice);

  const destinationInput =
    clean(body?.destination);

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

  const analysis =
    buildAnalysis({
      requirement,
      productInput,
      quantityInput,
      targetPriceInput,
      destinationInput
    });

  const scoring =
    calculateReadiness(analysis);

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

      analysis: {
        ...analysis,
        scoring,
        matches
      },

      brief: {
        product:
          analysis.product ||
          "Sourcing requirement",

        quantity:
          analysis.quantity ||
          null,

        targetPrice:
          analysis.targetPrice ||
          null,

        destination:
          analysis.destination ||
          null
      },

      scoring,

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
          "CASEVO identifies public-web supplier candidates. Supplier identity, manufacturing capability, certifications, MOQ, pricing and commercial contacts must be independently verified before placing an order.",

        searchQueries:
          searchResult.searchQueries || [],

        resultsScanned:
          searchResult.results?.length || 0,

        candidatesQualified:
          searchResult.qualifiedCount ||
          matches.length,

        suppliersReturned:
          matches.length,

        creditsUsed:
          searchResult.usage?.credits ??
          null,

        timestamp:
          new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(
      "CASEVO sourcing error",
      error
    );

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

function buildAnalysis({
  requirement,
  productInput,
  quantityInput,
  targetPriceInput,
  destinationInput
}) {
  const product =
    productInput ||
    extractProduct(requirement);

  const quantity =
    quantityInput ||
    extractQuantity(requirement);

  const targetPrice =
    targetPriceInput ||
    extractPrice(requirement);

  const destination =
    destinationInput ||
    extractDestination(requirement);

  return {
    product,
    quantity,
    targetPrice,
    destination,
    requirement
  };
}

async function searchSuppliersWithTavily(
  analysis,
  apiKey
) {
  const product =
    analysis.product ||
    analysis.requirement;

  const destination =
    analysis.destination || "";

  const queries = [
    [
      `"${product}"`,
      "manufacturer",
      "factory",
      "supplier",
      "official website",
      "China"
    ]
      .filter(Boolean)
      .join(" "),

    [
      `"${product}"`,
      "China",
      "factory",
      "OEM",
      "ODM",
      "manufacturer"
    ]
      .filter(Boolean)
      .join(" "),

    [
      `"${product}"`,
      "China",
      "production",
      "exporter",
      "B2B",
      "factory"
    ]
      .filter(Boolean)
      .join(" "),

    [
      product,
      "China",
      "shoe upper",
      "leather",
      "manufacturer",
      destination
    ]
      .filter(Boolean)
      .join(" ")
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

  let credits = 0;

  for (
    let i = 0;
    i < responses.length;
    i++
  ) {
    const data =
      responses[i];

    credits += Number(
      data?.usage?.credits || 0
    );

    const results =
      Array.isArray(data?.results)
        ? data.results
        : [];

    for (const result of results) {
      if (!result?.url) continue;

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

    qualifiedCount:
      deduplicated.length,

    usage: {
      credits
    }
  };
}

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
            "advanced",

          max_results:
            8,

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
        result?.url
      );

    const domain =
      getDomain(
        result?.url
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

function normalizeSupplierResults(
  results,
  analysis
) {
  const candidates = [];

  for (const result of results) {
    if (!result?.url) continue;

    if (
      isLowValuePage(
        result
      )
    ) {
      continue;
    }

    const domain =
      getDomain(
        result.url
      );

    if (!domain) continue;

    if (
      isExcludedDomain(
        domain
      )
    ) {
      continue;
    }

    const scoreInfo =
      calculateMatchScore(
        result,
        analysis
      );

    if (
      !scoreInfo.isQualified
    ) {
      continue;
    }

    candidates.push({
      result,

      domain,

      score:
        scoreInfo.score,

      supplierType:
        detectSupplierType(
          result
        ),

      evidenceLevel:
        scoreInfo.evidenceLevel
    });
  }

  candidates.sort(
    (a, b) => {
      if (
        b.score !==
        a.score
      ) {
        return (
          b.score -
          a.score
        );
      }

      return (
        evidenceRank(
          b.evidenceLevel
        ) -
        evidenceRank(
          a.evidenceLevel
        )
      );
    }
  );

  const selected =
    candidates.slice(
      0,
      8
    );

  return selected.map(
    (candidate, index) => {
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
            result.title,
            candidate.domain,
            result.content ||
              result.raw_content
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
          clean(
            result.content ||
              result.raw_content ||
              ""
          ).slice(
            0,
            1000
          )
      };
    }
  );
}

function isLowValuePage(
  result
) {
  const title =
    clean(
      result?.title
    ).toLowerCase();

  const url =
    clean(
      result?.url
    ).toLowerCase();

  const content =
    clean(
      result?.content ||
        result?.raw_content
    ).toLowerCase();

  if (!url) {
    return true;
  }

  let parsed;

  try {
    parsed =
      new URL(url);
  } catch {
    return true;
  }

  const path =
    parsed.pathname.toLowerCase();

  for (
    const badPath
    of LOW_VALUE_PATHS
  ) {
    if (
      path.includes(
        badPath
      )
    ) {
      return true;
    }
  }

  for (
    const pattern
    of LOW_VALUE_TITLE_PATTERNS
  ) {
    if (
      pattern.test(title)
    ) {
      return true;
    }
  }

  const badTitlePhrases = [
    "supplier directory",
    "manufacturer directory",
    "directory of",
    "top manufacturers",
    "best suppliers",
    "best manufacturers",
    "ultimate guide",
    "buyer guide",
    "buyer's guide",
    "marketplace",
    "industry report",
    "market report"
  ];

  if (
    badTitlePhrases.some(
      phrase =>
        title.includes(
          phrase
        )
    )
  ) {
    return true;
  }

  const genericContentSignals = [
    "sign up for our newsletter",
    "subscribe to our newsletter",
    "related articles",
    "latest articles",
    "read more articles"
  ];

  const genericCount =
    genericContentSignals.filter(
      phrase =>
        content.includes(
          phrase
        )
    ).length;

  if (
    genericCount >= 2 &&
    !hasStrongSupplierSignal(
      result
    )
  ) {
    return true;
  }

  return false;
}

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
        result?.raw_content
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
      analysis.product
    ).toLowerCase();

  const requirement =
    clean(
      analysis.requirement
    ).toLowerCase();

  let score = 0;

  let productHits = 0;

  let supplierHits = 0;

  let chinaHit = false;

  let commercialHits = 0;

  score += clamp(
    Number(
      result?.score || 0
    ) * 32,
    0,
    32
  );

  const productTerms =
    buildProductTerms(
      product,
      requirement
    );

  for (
    const term
    of productTerms
  ) {
    if (
      text.includes(term)
    ) {
      productHits++;
    }
  }

  if (
    productHits >= 1
  ) {
    score += 18;
  }

  if (
    productHits >= 2
  ) {
    score += 8;
  }

  if (
    productHits >= 3
  ) {
    score += 6;
  }

  for (
    const signal
    of MANUFACTURER_SIGNALS
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      supplierHits++;
    }
  }

  if (
    supplierHits >= 1
  ) {
    score += 14;
  }

  if (
    supplierHits >= 2
  ) {
    score += 8;
  }

  for (
    const signal
    of COMMERCIAL_SIGNALS
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      commercialHits++;
    }
  }

  score += Math.min(
    10,
    commercialHits * 2
  );

  for (
    const signal
    of CHINA_SIGNALS
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      chinaHit = true;
      break;
    }
  }

  if (chinaHit) {
    score += 7;
  }

  let contactHits = 0;

  for (
    const signal
    of CONTACT_SIGNALS
  ) {
    if (
      text.includes(
        signal
      )
    ) {
      contactHits++;
    }
  }

  score += Math.min(
    5,
    contactHits
  );

  const syntheticSignals = [
    "microfiber leather",
    "synthetic leather",
    "pu leather",
    "pvc leather",
    "vegan leather",
    "faux leather",
    "artificial leather",
    "polyurethane leather"
  ];

  const genuineRequest =
    /full[- ]grain|genuine leather|cowhide|cow leather|top grain|natural leather/
      .test(
        product +
        " " +
        requirement
      );

  const syntheticHits =
    syntheticSignals.filter(
      signal =>
        text.includes(
          signal
        )
    ).length;

  if (
    genuineRequest &&
    syntheticHits > 0
  ) {
    score -= Math.min(
      28,
      syntheticHits * 14
    );
  }

  const articleSignals = [
    "top 10",
    "top 20",
    "best suppliers",
    "best manufacturers",
    "ultimate guide",
    "buyer guide",
    "directory",
    "marketplace",
    "review"
  ];

  for (
    const signal
    of articleSignals
  ) {
    if (
      title
        .toLowerCase()
        .includes(signal)
    ) {
      score -= 22;
    }
  }

  const homepage =
    isLikelyHomepage(
      url
    );

  if (homepage) {
    score += 4;
  }

  const isQualified =
    productHits >= 1 &&
    supplierHits >= 1 &&
    score >= 42 &&
    !(
      genuineRequest &&
      syntheticHits >= 2 &&
      supplierHits < 3
    );

  const evidenceLevel =
    supplierHits >= 2 &&
    productHits >= 2
      ? "strong"
      : supplierHits >= 1 &&
          productHits >= 1
        ? "moderate"
        : "weak";

  return {
    score: Math.round(
      clamp(
        score,
        0,
        99
      )
    ),

    isQualified,

    evidenceLevel
  };
}

function buildProductTerms(
  product,
  requirement
) {
  const source =
    `${product} ${requirement}`
      .toLowerCase();

  const terms =
    new Set();

  const phraseTerms = [
    "full-grain leather",
    "full grain leather",
    "genuine leather",
    "cow leather",
    "cowhide leather",
    "shoe upper",
    "leather upper",
    "shoe uppers",
    "upper leather",
    "footwear leather",
    "top grain leather",
    "natural leather",
    "leather",
    "footwear",
    "sneaker",
    "shoe"
  ];

  for (
    const term
    of phraseTerms
  ) {
    if (
      source.includes(term)
    ) {
      terms.add(term);
    }
  }

  const words =
    source
      .split(
        /[^a-z0-9]+/i
      )
      .filter(
        word =>
          word.length >= 4
      );

  for (
    const word
    of words
  ) {
    if (
      [
        "premium",
        "shipping",
        "pairs",
        "black",
        "united",
        "states"
      ].includes(word)
    ) {
      continue;
    }

    terms.add(word);
  }

  return Array.from(
    terms
  ).slice(
    0,
    24
  );
}

function hasStrongSupplierSignal(
  result
) {
  const text =
    `${clean(result?.title)} ${clean(
      result?.content ||
        result?.raw_content
    )}`.toLowerCase();

  return MANUFACTURER_SIGNALS.some(
    signal =>
      text.includes(
        signal
      )
  );
}

function detectSupplierType(
  result
) {
  const text =
    `${clean(result?.title)} ${clean(
      result?.content ||
        result?.raw_content
    )} ${clean(result?.url)}`
      .toLowerCase();

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
    text.includes("oem") ||
    text.includes("odm")
  ) {
    return "OEM / ODM Manufacturer";
  }

  if (
    text.includes(
      "exporter"
    ) ||
    text.includes(
      "export"
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

function buildCapability(
  result,
  analysis
) {
  const content =
    clean(
      result?.content ||
        result?.raw_content
    );

  const product =
    analysis.product ||
    "the requested product";

  if (!content) {
    return (
      `Public-web evidence indicates potential manufacturing or supply capability related to ${product}. ` +
      `Direct supplier verification is required.`
    );
  }

  return (
    `Public-web evidence indicates potential manufacturing or supply capability related to ${product}. ` +
    content.slice(
      0,
      650
    )
  );
}

function cleanSupplierName(
  title,
  domain,
  content
) {
  let value =
    clean(title);

  value =
    value
      .replace(
        /\s*[|–—-]\s*(official website|official site|home|homepage)$/i,
        ""
      )
      .replace(
        /\s*[|–—-]\s*$/g,
        ""
      )
      .trim();

  const lower =
    value.toLowerCase();

  const generic =
    !value ||
    LOW_VALUE_TITLE_PATTERNS.some(
      pattern =>
        pattern.test(
          value
        )
    ) ||
    lower.includes(
      "supplier directory"
    ) ||
    lower.includes(
      "manufacturer directory"
    ) ||
    lower.includes(
      "guide to"
    ) ||
    lower.includes(
      "explained:"
    ) ||
    lower.includes(
      "how to"
    ) ||
    lower.includes(
      "what is"
    );

  if (
    generic &&
    domain
  ) {
    return companyNameFromDomain(
      domain
    );
  }

  const archiveSignals = [
    "archives",
    "category",
    "collection",
    "products",
    "product page",
    "catalog"
  ];

  if (
    archiveSignals.some(
      signal =>
        lower.includes(
          signal
        )
    ) &&
    domain
  ) {
    const domainName =
      companyNameFromDomain(
        domain
      );

    if (domainName) {
      return domainName;
    }
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
      .replace(
        /\b\w/g,
        letter =>
          letter.toUpperCase()
      )
      .trim();

  return (
    name ||
    domain
  );
}

function inferLocation(
  result,
  analysis
) {
  const text =
    `${clean(result?.title)} ${clean(
      result?.content ||
        result?.raw_content
    )} ${clean(result?.url)}`
      .toLowerCase();

  for (
    const [
      label,
      patterns
    ] of COUNTRY_PATTERNS
  ) {
    if (
      patterns.some(
        pattern =>
          text.includes(
            pattern
          )
      )
    ) {
      return label;
    }
  }

  return "Not determined";
}

function extractContactInfo(
  result
) {
  const text =
    clean(
      `${result?.content || ""} ${
        result?.raw_content || ""
      }`
    );

  const emailMatch =
    text.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );

  const phoneMatches =
    text.match(
      /(?:\+?\d[\d\s().-]{7,}\d)/g
    ) || [];

  const phone =
    phoneMatches
      .map(
        value =>
          clean(value)
      )
      .find(
        value => {
          const digits =
            digitsOnly(
              value
            ).length;

          return (
            digits >= 9 &&
            digits <= 16
          );
        }
      ) || "";

  return {
    email:
      emailMatch
        ? emailMatch[0]
        : "",

    phone
  };
}

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

  const preferredPhrases = [
    "full-grain leather shoe upper",
    "full grain leather shoe upper",
    "genuine leather shoe upper",
    "leather shoe upper",
    "shoe upper leather",
    "leather upper",
    "upper leather",
    "full-grain leather",
    "full grain leather",
    "genuine leather",
    "microfiber leather",
    "synthetic leather",
    "pu leather",
    "shoe upper",
    "footwear"
  ];

  for (
    const phrase
    of preferredPhrases
  ) {
    if (
      lower.includes(
        phrase
      )
    ) {
      return phrase;
    }
  }

  const match =
    value.match(
      /(?:for|sourcing|need|buy|purchase)\s+(.{3,120}?)(?:,|\.|\s+\d[\d,]*\s*(?:pairs|pcs|pieces|kg|tons?|mt|sqm|sqft)|\s+shipping\b|$)/i
    );

  if (
    match?.[1]
  ) {
    return clean(
      match[1]
    );
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

  return match
    ? clean(match[0])
    : "";
}

function extractPrice(
  text
) {
  const value =
    clean(text);

  const match =
    value.match(
      /(?:usd|us\$|\$|€|eur|£|gbp)\s*[\d,.]+(?:\s*(?:per|\/)\s*[a-zA-Z0-9 ]+)?/i
    );

  return match
    ? clean(match[0])
    : "";
}

function extractDestination(
  text
) {
  const value =
    clean(text)
      .toLowerCase();

  const destinations = [
    [
      "United States",
      [
        "united states",
        "usa",
        "u.s.a.",
        "us"
      ]
    ],

    [
      "United Kingdom",
      [
        "united kingdom",
        "uk",
        "u.k."
      ]
    ],

    [
      "Canada",
      ["canada"]
    ],

    [
      "Australia",
      ["australia"]
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
      "Italy",
      ["italy"]
    ],

    [
      "Spain",
      ["spain"]
    ],

    [
      "Japan",
      ["japan"]
    ],

    [
      "South Korea",
      ["south korea"]
    ],

    [
      "UAE",
      [
        "uae",
        "united arab emirates"
      ]
    ],

    [
      "Saudi Arabia",
      ["saudi arabia"]
    ],

    [
      "Singapore",
      ["singapore"]
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
      "Turkey",
      [
        "turkey",
        "turkiye"
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
      patterns
    ] of destinations
  ) {
    if (
      patterns.some(
        pattern =>
          value.includes(
            pattern
          )
      )
    ) {
      return label;
    }
  }

  return "";
}

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

  let clarity = 25;

  let specification = 20;

  let commercial = 15;

  if (
    requirement.length >= 30
  ) {
    clarity += 25;
  } else if (
    requirement.length >= 15
  ) {
    clarity += 15;
  }

  if (product) {
    clarity += 20;
  }

  if (quantity) {
    clarity += 15;
  }

  if (destination) {
    clarity += 15;
  }

  if (
    /leather|material|fabric|rubber|shoe|footwear|upper|sole/i.test(
      product
    )
  ) {
    specification += 20;
  }

  if (
    /\d+(?:\.\d+)?\s*(?:mm|cm|gsm|oz)/i.test(
      requirement
    )
  ) {
    specification += 20;
  }

  if (
    /black|white|brown|red|blue|custom color|pantone|ral/i.test(
      requirement
    )
  ) {
    specification += 15;
  }

  if (
    /full[- ]grain|top grain|genuine|cowhide|cow leather|nubuck|suede/i.test(
      requirement
    )
  ) {
    specification += 15;
  }

  if (targetPrice) {
    specification += 10;
  }

  if (quantity) {
    commercial += 25;
  }

  if (targetPrice) {
    commercial += 30;
  }

  if (destination) {
    commercial += 20;
  }

  if (
    /oem|odm|private label|bulk|wholesale|export/i.test(
      requirement
    )
  ) {
    commercial += 10;
  }

  clarity =
    Math.round(
      clamp(
        clarity,
        0,
        100
      )
    );

  specification =
    Math.round(
      clamp(
        specification,
        0,
        100
      )
    );

  commercial =
    Math.round(
      clamp(
        commercial,
        0,
        100
      )
    );

  const score =
    Math.round(
      clarity * 0.35 +
      specification * 0.35 +
      commercial * 0.30
    );

  return {
    score,
    clarity,
    specification,
    commercial,

    note:
      "Readiness reflects the completeness of the sourcing requirement, not supplier verification."
  };
}

function isLikelyHomepage(
  url
) {
  try {
    const parsed =
      new URL(url);

    return (
      parsed.pathname === "/" ||
      parsed.pathname === ""
    );
  } catch {
    return false;
  }
}

function evidenceRank(
  level
) {
  if (
    level === "strong"
  ) {
    return 3;
  }

  if (
    level === "moderate"
  ) {
    return 2;
  }

  return 1;
}

function isExcludedDomain(
  domain
) {
  const lower =
    clean(domain)
      .toLowerCase();

  return EXCLUDED_DOMAINS.some(
    excluded =>
      lower === excluded ||
      lower.endsWith(
        `.${excluded}`
      )
  );
}

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

function getWebsiteRoot(
  url
) {
  try {
    const parsed =
      new URL(url);

    return (
      `${parsed.protocol}//${parsed.hostname}`
    );
  } catch {
    return url || "";
  }
}

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
      const parameter
      of trackingParams
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

  return String(value)
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(
      0,
      8000
    );
}

function digitsOnly(
  value
) {
  return clean(
    value
  ).replace(
    /\D/g,
    ""
  );
}

function clamp(
  value,
  min,
  max
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return min;
  }

  return Math.max(
    min,
    Math.min(
      max,
      number
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
      .slice(
        2,
        8
      )
      .toUpperCase();

  return (
    `CASEVO-${timestamp}-${random}`
  );
}

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
