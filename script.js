const VERSION = "4.0.0-clean";

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
  "picclick.com",
  "redemocoronga.org.br"
];

const LOW_VALUE_TERMS = [
  "top 10",
  "top 20",
  "top 50",
  "top 5",

  "best suppliers",
  "best manufacturers",
  "best factories",

  "supplier directory",
  "directory",
  "directories",
  "marketplace",

  "list of suppliers",
  "list of manufacturers",

  "buyers guide",
  "buyer's guide",
  "quick guide",
  "ultimate guide",

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

const MANUFACTURER_SIGNALS = [
  "manufacturer",
  "manufacturing",
  "factory",
  "production facility",
  "manufacturing facility",
  "manufacturing plant",
  "producer",
  "workshop"
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
  "contract manufacturing"
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
  "our products"
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
  "hebei"
];

const LOCATION_RULES = [
  ["Guangzhou, China", ["guangzhou"]],
  ["Dongguan, China", ["dongguan"]],
  ["Foshan, China", ["foshan"]],
  ["Shenzhen, China", ["shenzhen"]],
  ["Quanzhou, China", ["quanzhou"]],
  ["Jinjiang, China", ["jinjiang"]],
  ["Wenzhou, China", ["wenzhou"]],
  ["Putian, China", ["putian"]],
  ["Guangdong, China", ["guangdong"]],
  ["Zhejiang, China", ["zhejiang"]],
  ["Fujian, China", ["fujian"]],
  ["Jiangsu, China", ["jiangsu"]],
  ["Sichuan, China", ["sichuan"]],
  ["Hebei, China", ["hebei"]],
  ["China", ["china"]],

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

  [
    "United States",
    ["united states", "usa", "u.s.a."]
  ],

  ["Mexico", ["mexico"]],
  ["Brazil", ["brazil"]],
  ["South Korea", ["south korea"]],
  ["Japan", ["japan"]],
  ["Taiwan", ["taiwan"]],
  ["Cambodia", ["cambodia"]],
  ["Malaysia", ["malaysia"]],
  ["Poland", ["poland"]],
  ["Romania", ["romania"]],
  ["France", ["france"]]
];


/* =========================================================
   MAIN WORKER
   ========================================================= */

export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    /*
     * CORS
     */
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    /*
     * HEALTH
     */
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

    /*
     * SOURCING API
     */
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

    /*
     * STATIC WEBSITE
     */
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


  /*
   * Accept both current and older field names.
   */

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


  /*
   * Validation
   */

  if (
    !requirement &&
    !productInput
  ) {

    return jsonResponse(
      {
        ok: false,
        error:
          "Please enter a sourcing requirement."
      },
      400
    );

  }


  /*
   * Combined requirement
   */

  const combined = [
    requirement,
    productInput,
    quantityInput,
    targetPriceInput,
    destinationInput
  ]
    .filter(Boolean)
    .join(" ");


  /*
   * Normalize requirement
   */

  const normalized =
    normalizeRequirement({
      requirement,
      productInput,
      quantityInput,
      targetPriceInput,
      destinationInput,
      combined
    });


  /*
   * Tavily API
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


  try {

    /*
     * Real public-web search
     */

    const search =
      await searchSuppliersWithTavily(
        normalized,
        env.TAVILY_API_KEY
      );


    /*
     * Clean supplier results
     */

    const matches =
      normalizeSupplierResults(
        search.results || [],
        normalized
      );


    /*
     * Readiness
     */

    const scoring =
      calculateReadiness(
        normalized
      );


    /*
     * Brief
     */

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


    /*
     * IMPORTANT:
     *
     * script.js expects:
     *
     * data.analysis.normalized
     * data.analysis.scoring
     * data.analysis.matches
     *
     * Keep these fields.
     */

    return jsonResponse({

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

      /*
       * Backward compatibility
       */

      matches,

      /*
       * Metadata
       */

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
          "CASEVO identifies public-web supplier candidates. Company identity, manufacturing capability, certifications, MOQ, export experience and current contacts require independent verification before placing an order.",

        searchQueries:
          search.searchQueries || [],

        resultsScanned:
          search.resultsScanned || 0,

        suppliersReturned:
          matches.length,

        creditsUsed:
          search.usage?.credits ??
          null,

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


/* =========================================================
   TAVILY SEARCH
   ========================================================= */

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

  const destination =
    analysis.destination ||
    "";


  const queries = [

    buildQuery(
      product,
      requirement,
      destination,
      "China manufacturer factory supplier official website"
    ),

    buildQuery(
      product,
      requirement,
      destination,
      "China footwear factory OEM ODM manufacturer supplier"
    ),

    buildQuery(
      product,
      requirement,
      destination,
      "China leather shoe upper manufacturer factory exporter"
    ),

    buildQuery(
      product,
      requirement,
      destination,
      "China footwear manufacturer production facility export"
    )

  ];


  /*
   * IMPORTANT:
   *
   * Promise.allSettled prevents one failed search
   * from destroying the complete sourcing request.
   */

  const settled =
    await Promise.allSettled(
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

  let successfulQueries = 0;


  settled.forEach(
    (
      item,
      index
    ) => {

      if (
        item.status !==
        "fulfilled"
      ) {
        return;
      }


      successfulQueries++;


      credits +=
        Number(
          item.value?.usage?.credits ||
          0
        );


      const results =
        Array.isArray(
          item.value?.results
        )
          ? item.value.results
          : [];


      results.forEach(
        result => {

          if (
            result?.url
          ) {

            allResults.push({

              ...result,

              _searchQuery:
                queries[index]

            });

          }

        }
      );

    }
  );


  if (
    !successfulQueries &&
    settled.length
  ) {

    const firstError =
      settled.find(
        item =>
          item.status ===
          "rejected"
      )?.reason;


    throw new Error(
      firstError?.message ||
      "Tavily search failed."
    );

  }


  /*
   * Critical cleaning layer.
   */

  const cleaned =
    deduplicateAndFilterRawResults(
      allResults
    );


  return {

    results:
      cleaned,

    resultsScanned:
      allResults.length,

    searchQueries:
      queries,

    usage: {
      credits
    }

  };

}


/* =========================================================
   QUERY BUILDER
   ========================================================= */

function buildQuery(
  product,
  requirement,
  destination,
  intent
) {

  return [

    `"${clean(product).slice(0, 160)}"`,

    intent,

    destination,

    clean(requirement).slice(
      0,
      220
    )

  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 700);

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
                .slice(0, 700),

            topic:
              "general",

            search_depth:
              "basic",

            max_results:
              10,

            include_answer:
              false,

            /*
             * DO NOT request raw page source.
             *
             * This is one of the major protections
             * against HTML / image / page-source pollution.
             */

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
   RAW RESULT CLEANING
   ========================================================= */

function deduplicateAndFilterRawResults(
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
        result?.url
      );

    const domain =
      getDomain(
        url
      );


    /*
     * Invalid result
     */

    if (
      !url ||
      !domain
    ) {
      continue;
    }


    /*
     * Block known bad domains
     */

    if (
      isExcludedDomain(
        domain
      )
    ) {
      continue;
    }


    /*
     * Block article / directory / marketplace pages
     */

    if (
      isLowValuePage(
        result
      )
    ) {
      continue;
    }


    /*
     * Only one result per domain.
     *
     * Prevents the same company appearing
     * several times from different pages.
     */

    if (
      seenUrls.has(url) ||
      seenDomains.has(domain)
    ) {
      continue;
    }


    /*
     * Clean title
     */

    const title =
      cleanSupplierName(
        result?.title,
        domain
      );


    /*
     * Clean evidence
     */

    const evidence =
      cleanEvidence(
        result?.content ||
        ""
      );


    /*
     * Do not render garbage records.
     */

    if (
      !title ||
      !evidence
    ) {
      continue;
    }


    if (
      looksLikeGarbage(
        title
      ) ||
      looksLikeGarbage(
        evidence
      )
    ) {
      continue;
    }


    seenUrls.add(url);

    seenDomains.add(domain);


    output.push({

      ...result,

      url,

      _cleanTitle:
        title,

      _cleanEvidence:
        evidence

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

      .map(
        result => ({

          result,

          domain:
            getDomain(
              result.url
            ),

          score:
            calculateMatchScore(
              result,
              analysis
            )

        })
      )

      .filter(
        item =>
          item.domain &&
          item.score >= 45
      )

      .sort(
        (a, b) =>
          b.score -
          a.score
      )

      /*
       * Maximum 8 clean supplier cards.
       */

      .slice(
        0,
        8
      );


  return candidates.map(
    (
      candidate,
      index
    ) => {

      const result =
        candidate.result;

      const domain =
        candidate.domain;


      const evidence =
        result._cleanEvidence ||
        cleanEvidence(
          result.content ||
          ""
        );


      const type =
        detectSupplierType(
          result
        );


      const contact =
        extractContactInfo(
          result
        );


      return {

        rank:
          index + 1,


        name:
          result._cleanTitle ||
          cleanSupplierName(
            result.title,
            domain
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
          type,


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


        /*
         * FINAL CLEAN EVIDENCE
         *
         * Maximum 700 chars.
         */

        evidence,


        note:
          `Public-web evidence suggests potential ${type.toLowerCase()} capability. Independent verification is required.`

      };

    }
  );

}


/* =========================================================
   LOW VALUE PAGE FILTER
   ========================================================= */

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


  const combined =
    `${title} ${content} ${url}`;


  if (
    isExcludedDomain(
      getDomain(url)
    )
  ) {
    return true;
  }


  if (
    LOW_VALUE_PATHS.some(
      path =>
        url.includes(path)
    )
  ) {
    return true;
  }


  if (
    LOW_VALUE_TERMS.some(
      term =>
        combined.includes(term)
    )
  ) {
    return true;
  }


  if (
    /\b(listicle|shopping results|classifieds|auction|marketplace)\b/i
      .test(combined)
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
      analysis.product
    ).toLowerCase();


  const tokens =
    tokenizeProduct(
      product
    );


  /*
   * Tavily relevance
   */

  let score =
    Number(
      result?.score ||
      0
    ) * 45;


  /*
   * Exact product
   */

  if (
    product &&
    text.includes(product)
  ) {

    score += 25;

  }


  /*
   * Product token match
   */

  const hits =
    tokens.filter(
      token =>
        text.includes(token)
    ).length;


  if (
    tokens.length
  ) {

    score +=
      Math.min(
        18,
        (
          hits /
          tokens.length
        ) * 18
      );

  }


  /*
   * Manufacturer
   */

  if (
    MANUFACTURER_SIGNALS.some(
      signal =>
        text.includes(signal)
    )
  ) {

    score += 14;

  }


  /*
   * Commercial
   */

  if (
    COMMERCIAL_SIGNALS.some(
      signal =>
        text.includes(signal)
    )
  ) {

    score += 8;

  }


  /*
   * Company credibility
   */

  if (
    COMPANY_SIGNALS.some(
      signal =>
        text.includes(signal)
    )
  ) {

    score += 6;

  }


  /*
   * China relevance
   */

  if (
    CHINA_SIGNALS.some(
      signal =>
        text.includes(signal)
    )
  ) {

    score += 5;

  }


  /*
   * Supplier words in title
   */

  if (
    /supplier|manufacturer|factory|oem|odm/i
      .test(title)
  ) {

    score += 8;

  }


  /*
   * Article penalty
   */

  if (
    LOW_VALUE_TERMS.some(
      term =>
        text.includes(term)
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
   SOURCING READINESS
   ========================================================= */

function calculateReadiness(
  analysis
) {

  const requirement =
    clean(
      analysis.requirement
    );


  const hasRequirement =
    Boolean(
      requirement
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


  let clarity = 20;

  let specification = 15;

  let commercial = 20;


  if (
    requirement.length >= 20
  ) {

    clarity += 20;

  }


  if (
    hasProduct
  ) {

    clarity += 15;

    specification += 10;

  }


  if (
    /\b\d+(?:\.\d+)?\s*mm\b/i.test(
      requirement
    ) ||
    /thickness/i.test(
      requirement
    )
  ) {

    specification += 20;

  }


  if (
    /full[- ]?grain|grain|genuine leather|leather/i
      .test(requirement)
  ) {

    specification += 10;

  }


  if (
    /black|brown|white|red|blue|color|colour/i
      .test(requirement)
  ) {

    specification += 5;

  }


  if (
    hasQuantity
  ) {

    commercial += 20;

  }


  if (
    hasPrice
  ) {

    commercial += 20;

  }


  if (
    hasDestination
  ) {

    commercial += 15;

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


  return {

    score:
      Math.round(
        (
          clarity +
          specification +
          commercial
        ) / 3
      ),

    clarity,

    specification,

    commercial,

    note:
      "Readiness reflects the completeness of the sourcing requirement, not supplier verification."

  };

}


/* =========================================================
   REQUIREMENT NORMALIZATION
   ========================================================= */

function normalizeRequirement({
  requirement,
  productInput,
  quantityInput,
  targetPriceInput,
  destinationInput,
  combined
}) {

  return {

    requirement:
      clean(
        requirement ||
        combined
      ),

    product:
      clean(
        productInput ||
        extractProduct(
          combined
        )
      ),

    quantity:
      clean(
        quantityInput ||
        extractQuantity(
          combined
        )
      ),

    targetPrice:
      clean(
        targetPriceInput ||
        extractPrice(
          combined
        )
      ),

    destination:
      clean(
        destinationInput ||
        extractDestination(
          combined
        )
      )

  };

}


/* =========================================================
   SUPPLIER TYPE
   ========================================================= */

function detectSupplierType(
  result
) {

  const text =
    `${clean(result?.title)} ${clean(result?.content)} ${clean(result?.url)}`
      .toLowerCase();


  if (
    /manufacturer|manufacturing|factory|production facility|production plant/
      .test(text)
  ) {

    return "Manufacturer / Factory";

  }


  if (
    /oem|odm/
      .test(text)
  ) {

    return "OEM / ODM Manufacturer";

  }


  if (
    /exporter/
      .test(text)
  ) {

    return "Manufacturer / Exporter";

  }


  if (
    /supplier/
      .test(text)
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

  const text =
    `${clean(result?.title)} ${clean(result?.content)}`
      .toLowerCase();


  const product =
    analysis.product ||
    "the requested product";


  const signals = [];


  if (
    /manufacturer|manufacturing|factory|production facility/
      .test(text)
  ) {

    signals.push(
      "manufacturing/factory capability"
    );

  }


  if (
    /oem|odm/
      .test(text)
  ) {

    signals.push(
      "OEM/ODM production"
    );

  }


  if (
    /export|exporter|international/
      .test(text)
  ) {

    signals.push(
      "export capability"
    );

  }


  if (
    /custom|private label/
      .test(text)
  ) {

    signals.push(
      "custom/private-label production"
    );

  }


  if (
    /leather/.test(text) &&
    /shoe|footwear|upper/.test(text)
  ) {

    signals.push(
      "leather footwear-related production"
    );

  }


  if (
    signals.length
  ) {

    return (
      `Public-web evidence indicates potential ` +
      `${signals.slice(0, 3).join(", ")} ` +
      `related to ${product}.`
    );

  }


  return (
    `Public-web evidence indicates a potential ` +
    `supplier relationship related to ${product}.`
  );

}


/* =========================================================
   SUPPLIER NAME CLEANING
   ========================================================= */

function cleanSupplierName(
  title,
  domain
) {

  let value =
    clean(
      title
    );


  value =
    value

      .replace(
        /\s*[|–—-]\s*(official website|official site|home|homepage)$/i,
        ""
      )

      .replace(
        /\s*[-|–—]\s*(China|USA|United States)$/i,
        ""
      )

      .trim();


  /*
   * Article-like title
   */

  if (
    /^(top|best|how|why|what|guide|list|review|directory|supplier directory)/i
      .test(value)
  ) {

    value = "";

  }


  /*
   * Garbage title
   */

  if (
    !value ||
    looksLikeGarbage(value)
  ) {

    value =
      companyNameFromDomain(
        domain
      );

  }


  return clean(
    value
  ).slice(
    0,
    140
  );

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


  const first =
    domain
      .replace(
        /^www\./i,
        ""
      )
      .split(".")[0];


  return first

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

}


/* =========================================================
   EVIDENCE CLEANING
   ========================================================= */

function cleanEvidence(
  value
) {

  let text =
    String(
      value ||
      ""
    );


  /*
   * Remove scripts
   */

  text =
    text.replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    );


  /*
   * Remove styles
   */

  text =
    text.replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    );


  /*
   * Remove HTML tags
   */

  text =
    text.replace(
      /<[^>]+>/g,
      " "
    );


  /*
   * Remove markdown images
   */

  text =
    text.replace(
      /!\[[^\]]*\]\([^)]*\)/g,
      " "
    );


  /*
   * Remove URLs
   */

  text =
    text.replace(
      /\bhttps?:\/\/\S+/gi,
      " "
    );


  text =
    text.replace(
      /\bwww\.\S+/gi,
      " "
    );


  /*
   * Remove image filenames
   */

  text =
    text.replace(
      /(?:^|\s)[\w./-]+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?\S*)?/gi,
      " "
    );


  /*
   * Remove HTML attributes / source fragments
   */

  text =
    text.replace(
      /\b(?:src|href|alt|class|style|onclick|data-[\w-]+)\s*=\s*[^\s]+/gi,
      " "
    );


  /*
   * Remove common website navigation
   */

  text =
    text.replace(
      /\b(?:skip to content|cookie policy|privacy policy|terms of service|menu|home|search|login|sign in|register)\b/gi,
      " "
    );


  /*
   * Remove repeated characters.
   *
   * This directly blocks:
   *
   * AAAAAAAAAAAAAAAAAAAAA
   */

  text =
    text.replace(
      /(.)\1{7,}/g,
      " "
    );


  /*
   * Remove repeated alphabetic tokens.
   */

  text =
    text.replace(
      /\b([A-Za-z])\1{5,}\b/g,
      " "
    );


  /*
   * Normalize whitespace
   */

  text =
    text
      .replace(
        /[^\S\r\n]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  /*
   * Reject obviously broken content.
   */

  if (
    looksLikeGarbage(text)
  ) {

    return "";

  }


  /*
   * Prefer meaningful supplier sentences.
   */

  const sentences =
    text

      .split(
        /(?<=[.!?])\s+/
      )

      .map(
        sentence =>
          sentence.trim()
      )

      .filter(Boolean);


  const useful =
    sentences.filter(
      sentence =>

        /manufacturer|factory|supplier|production|oem|odm|footwear|shoe|leather|upper|export|custom|capacity|material|product/i
          .test(sentence)

        &&

        !/https?:|www\.|\.jpg|\.png|\.svg|AAAAAA|javascript|stylesheet/i
          .test(sentence)
    );


  const chosen =
    (
      useful.length
        ? useful
        : sentences
    )
      .slice(
        0,
        5
      )
      .join(" ");


  /*
   * HARD LIMIT.
   */

  return chosen
    .slice(
      0,
      700
    )
    .trim();

}


/* =========================================================
   GARBAGE DETECTION
   ========================================================= */

function looksLikeGarbage(
  text
) {

  const value =
    clean(text);


  if (!value) {
    return true;
  }


  /*
   * Repeated characters
   */

  if (
    /(.)\1{7,}/
      .test(value)
  ) {

    return true;

  }


  /*
   * Repeated single-letter words
   */

  if (
    /\b[A-Za-z]\1{5,}\b/
      .test(value)
  ) {

    return true;

  }


  /*
   * Multiple URLs
   */

  if (
    (
      value.match(
        /https?:\/\//gi
      ) || []
    ).length >= 2
  ) {

    return true;

  }


  /*
   * Multiple image references
   */

  if (
    (
      value.match(
        /(?:jpg|jpeg|png|gif|webp|svg)/gi
      ) || []
    ).length >= 3
  ) {

    return true;

  }


  /*
   * Obvious source-code fragments
   */

  if (
    /[{}<>]{6,}/
      .test(value)
  ) {

    return true;

  }


  /*
   * Extremely low letter density.
   */

  const letters =
    (
      value.match(
        /[A-Za-z]/g
      ) || []
    ).length;


  if (
    value.length > 120 &&
    letters / value.length < 0.35
  ) {

    return true;

  }


  return false;

}


/* =========================================================
   PRODUCT TOKENS
   ========================================================= */

function tokenizeProduct(
  product
) {

  const stop =
    new Set([
      "the",
      "and",
      "for",
      "with",
      "from",
      "this",
      "that",
      "upper",
      "material"
    ]);


  return [
    ...new Set(

      product

        .split(
          /[\s,\/\-]+/
        )

        .filter(
          word =>
            word.length >= 3 &&
            !stop.has(word)
        )

    )
  ]
    .slice(
      0,
      12
    );

}


/* =========================================================
   LOCATION
   ========================================================= */

function inferLocation(
  result
) {

  const text =
    `${clean(result?.title)} ${clean(result?.content)} ${clean(result?.url)}`
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


/* =========================================================
   CONTACT EXTRACTION
   ========================================================= */

function extractContactInfo(
  result
) {

  const text =
    clean(
      `${result?.content || ""} ${result?.raw_content || ""}`
    );


  const email =
    text.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    )?.[0] ||
    "";


  const phone =
    text.match(
      /(?:\+?\d[\d\s().-]{7,}\d)/
    )?.[0] ||
    "";


  return {

    email,

    phone

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
    ).toLowerCase();


  const keywords = [

    "premium full-grain leather shoe upper",

    "full-grain leather shoe upper",

    "leather shoe upper",

    "shoe upper leather",

    "upper leather",

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


  return (
    keywords.find(
      keyword =>
        value.includes(
          keyword
        )
    ) ||
    ""
  );

}


/* =========================================================
   QUANTITY EXTRACTION
   ========================================================= */

function extractQuantity(
  text
) {

  const match =
    clean(text).match(
      /(\d[\d,.\s]*)\s*(pairs?|pcs?|pieces?|kg|tons?|mt|sqm|sqft|square meters?|units?)/i
    );


  return match
    ? match[0].trim()
    : "";

}


/* =========================================================
   PRICE EXTRACTION
   ========================================================= */

function extractPrice(
  text
) {

  const match =
    clean(text).match(
      /(?:usd|us\$|\$)\s*[\d,.]+(?:\s*(?:per|\/)\s*[a-zA-Z0-9 ]+)?/i
    );


  return match
    ? match[0].trim()
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
    ).toLowerCase();


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


  return (
    destinations.find(
      destination =>
        value.includes(
          destination.toLowerCase()
        )
    ) ||
    ""
  );

}


/* =========================================================
   DOMAIN
   ========================================================= */

function isExcludedDomain(
  domain
) {

  if (!domain) {
    return false;
  }


  return EXCLUDED_DOMAINS.some(
    bad =>
      domain === bad ||
      domain.endsWith(
        `.${bad}`
      )
  );

}


/* =========================================================
   GET DOMAIN
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

    const u =
      new URL(
        url
      );


    return (
      `${u.protocol}//${u.hostname}`
    );

  } catch {

    return "";

  }

}


/* =========================================================
   URL NORMALIZATION
   ========================================================= */

function normalizeUrl(
  url
) {

  try {

    const u =
      new URL(
        url
      );


    u.hash = "";


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
        u.searchParams.delete(
          parameter
        )
    );


    return u.toString();

  } catch {

    return "";

  }

}


/* =========================================================
   CLEAN
   ========================================================= */

function clean(
  value
) {

  if (
    value === null ||
    value === undefined
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

  return (

    `CASEVO-${

      Date.now()
        .toString(36)
        .toUpperCase()

    }-${

      Math.random()
        .toString(36)
        .slice(
          2,
          8
        )
        .toUpperCase()

    }`

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
