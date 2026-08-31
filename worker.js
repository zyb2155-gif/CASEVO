/**
 * ============================================================
 * CASEVO AI — REAL SUPPLIER DISCOVERY WORKER
 * FINAL VERSION
 * ============================================================
 *
 * Cloudflare Worker
 *
 * Endpoints:
 *   GET  /api/health
 *   POST /api/sourcing
 *
 * Environment Secret:
 *   TAVILY_API_KEY
 *
 * Purpose:
 *   1. Receive sourcing requirements from CASEVO frontend
 *   2. Extract product / material / quantity / price / destination
 *   3. Search the public web through Tavily
 *   4. Remove directories / marketplaces / article pages
 *   5. Rank supplier candidates
 *   6. Return a stable API structure for the CASEVO frontend
 *
 * IMPORTANT:
 *   Supplier records are public-web discovery candidates.
 *   They are NOT automatically verified suppliers.
 * ============================================================
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ==========================================================
    // CORS
    // ==========================================================

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    // ==========================================================
    // HEALTH
    // ==========================================================

    if (
      (url.pathname === "/api/health" ||
        url.pathname === "/health") &&
      request.method === "GET"
    ) {
      return jsonResponse({
        ok: true,
        service: "CASEVO AI Sourcing",
        version: "4.0.0",
        engine: "CASEVO Real Supplier Discovery",
        searchProvider: "Tavily",
        tavilyConfigured: Boolean(env.TAVILY_API_KEY),
        timestamp: new Date().toISOString()
      });
    }

    // ==========================================================
    // SOURCING API
    // ==========================================================

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

    // ==========================================================
    // STATIC ASSETS
    // ==========================================================

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      "CASEVO Worker is running.",
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
          ...corsHeaders()
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

  // ------------------------------------------------------------
  // Read frontend fields
  // ------------------------------------------------------------

  const requirement = clean(body?.requirement);
  const productInput = clean(body?.product);
  const quantityInput = clean(body?.quantity);
  const targetPriceInput = clean(body?.targetPrice);
  const destinationInput = clean(body?.destination);

  // ------------------------------------------------------------
  // Requirement validation
  //
  // The requirement textarea is the primary field.
  // If the user filled product only, we still allow the request.
  // ------------------------------------------------------------

  if (!requirement && !productInput) {
    return jsonResponse(
      {
        ok: false,
        error: "Please enter a sourcing requirement."
      },
      400
    );
  }

  // ------------------------------------------------------------
  // Build complete text
  // ------------------------------------------------------------

  const combinedText = [
    requirement,
    productInput,
    quantityInput,
    targetPriceInput,
    destinationInput
  ]
    .filter(Boolean)
    .join(" ");

  // ------------------------------------------------------------
  // Normalize requirement
  // ------------------------------------------------------------

  const analysis = normalizeRequirement({
    requirement,
    productInput,
    quantityInput,
    targetPriceInput,
    destinationInput,
    combinedText
  });

  // ------------------------------------------------------------
  // Check Tavily
  // ------------------------------------------------------------

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

  // ------------------------------------------------------------
  // REAL WEB SEARCH
  // ------------------------------------------------------------

  try {
    const searchResult = await searchSuppliersWithTavily(
      analysis,
      env.TAVILY_API_KEY
    );

    const matches = normalizeSupplierResults(
      searchResult.results || [],
      analysis
    );

    const scoring = calculateRequirementScore(analysis);

    const requestId = createRequestId();

    return jsonResponse({
      ok: true,

      requestId,

      message:
        "CASEVO supplier discovery completed successfully.",

      service:
        "CASEVO AI Sourcing",

      version:
        "4.0.0",

      analysis: {
        product:
          analysis.product || "Sourcing requirement",

        quantity:
          analysis.quantity || null,

        targetPrice:
          analysis.targetPrice || null,

        destination:
          analysis.destination || null,

        material:
          analysis.material || null,

        thickness:
          analysis.thickness || null,

        color:
          analysis.color || null,

        industry:
          analysis.industry || "General sourcing",

        certifications:
          analysis.certifications || [],

        packaging:
          analysis.packaging || null,

        moq:
          analysis.moq || null,

        leadTime:
          analysis.leadTime || null,

        requirements:
          analysis.requirements || [],

        tags:
          analysis.tags || [],

        originalRequest:
          analysis.originalRequest || ""
      },

      // --------------------------------------------------------
      // Frontend-friendly scoring
      // --------------------------------------------------------

      score:
        scoring.score,

      clarity:
        scoring.clarity,

      specification:
        scoring.specification,

      commercial:
        scoring.commercial,

      readiness: {
        requirementClarity:
          scoring.clarity,

        specificationQuality:
          scoring.specification,

        commercialReadiness:
          scoring.commercial
      },

      // --------------------------------------------------------
      // Supplier results
      // --------------------------------------------------------

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
          "CASEVO identifies public-web supplier candidates. Supplier identity, manufacturing capability, certifications, MOQ, pricing and commercial contacts must be independently verified before placing an order.",

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
    console.error(
      "CASEVO supplier discovery error:",
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


/* ============================================================
   REQUIREMENT NORMALIZATION
   ============================================================ */

function normalizeRequirement(data) {
  const text =
    clean(data.combinedText || "");

  const product =
    data.productInput ||
    extractProduct(text);

  const quantity =
    data.quantityInput ||
    extractQuantity(text);

  const targetPrice =
    data.targetPriceInput ||
    extractPrice(text);

  const destination =
    data.destinationInput ||
    extractDestination(text);

  const material =
    detectMaterial(text);

  const thickness =
    detectThickness(text);

  const color =
    detectColor(text);

  const industry =
    detectIndustry(text);

  const certifications =
    detectCertifications(text);

  const packaging =
    detectPackaging(text);

  const moq =
    detectMOQ(text);

  const leadTime =
    detectLeadTime(text);

  const requirements = [];

  if (product) {
    requirements.push(
      `Product / material: ${product}`
    );
  }

  if (material) {
    requirements.push(
      `Material: ${material}`
    );
  }

  if (thickness) {
    requirements.push(
      `Thickness: ${thickness}`
    );
  }

  if (color) {
    requirements.push(
      `Color / finish: ${color}`
    );
  }

  if (quantity) {
    requirements.push(
      `Required quantity: ${quantity}`
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

  if (certifications.length) {
    requirements.push(
      `Certifications: ${certifications.join(", ")}`
    );
  }

  if (packaging) {
    requirements.push(
      `Packaging: ${packaging}`
    );
  }

  if (moq) {
    requirements.push(
      `MOQ: ${moq}`
    );
  }

  if (leadTime) {
    requirements.push(
      `Lead time: ${leadTime}`
    );
  }

  const tags = [];

  if (industry) {
    tags.push(industry);
  }

  if (material) {
    tags.push(material);
  }

  if (thickness) {
    tags.push(thickness);
  }

  if (color) {
    tags.push(color);
  }

  if (quantity) {
    tags.push("Volume requirement");
  }

  if (targetPrice) {
    tags.push("Target pricing");
  }

  if (destination) {
    tags.push(destination);
  }

  return {
    product:
      product || null,

    material:
      material || null,

    thickness:
      thickness || null,

    color:
      color || null,

    quantity:
      quantity || null,

    targetPrice:
      targetPrice || null,

    destination:
      destination || null,

    industry:
      industry || "General sourcing",

    certifications,

    packaging:
      packaging || null,

    moq:
      moq || null,

    leadTime:
      leadTime || null,

    requirements,

    tags:
      unique(tags),

    originalRequest:
      clean(data.requirement || "")
  };
}


/* ============================================================
   PRODUCT EXTRACTION
   ============================================================ */

function extractProduct(text) {
  const value = clean(text);

  if (!value) {
    return "";
  }

  const lower =
    value.toLowerCase();

  // ----------------------------------------------------------
  // Specific phrases FIRST.
  // This prevents "leather" from stealing the match.
  // ----------------------------------------------------------

  const specificPatterns = [
    [
      /premium\s+full[-\s]?grain\s+leather\s+shoe\s+upper/i,
      "Premium full-grain leather shoe upper"
    ],

    [
      /full[-\s]?grain\s+leather\s+shoe\s+upper/i,
      "Full-grain leather shoe upper"
    ],

    [
      /full[-\s]?grain\s+leather/i,
      "Full-grain leather"
    ],

    [
      /top[-\s]?grain\s+leather\s+shoe\s+upper/i,
      "Top-grain leather shoe upper"
    ],

    [
      /genuine\s+leather\s+shoe\s+upper/i,
      "Genuine leather shoe upper"
    ],

    [
      /leather\s+shoe\s+upper/i,
      "Leather shoe upper"
    ],

    [
      /shoe\s+upper\s+leather/i,
      "Shoe upper leather"
    ],

    [
      /microfiber\s+leather/i,
      "Microfiber leather"
    ],

    [
      /synthetic\s+leather/i,
      "Synthetic leather"
    ],

    [
      /pu\s+leather/i,
      "PU leather"
    ]
  ];

  for (const [pattern, result] of specificPatterns) {
    if (pattern.test(value)) {
      return result;
    }
  }

  // ----------------------------------------------------------
  // Chinese phrases
  // ----------------------------------------------------------

  if (
    lower.includes("鞋面革") ||
    lower.includes("真皮鞋面")
  ) {
    return "Leather shoe upper";
  }

  if (
    lower.includes("全粒面皮革") ||
    lower.includes("全粒面鞋面革")
  ) {
    return "Full-grain leather shoe upper";
  }

  if (lower.includes("鞋面")) {
    return "Shoe upper";
  }

  // ----------------------------------------------------------
  // General keywords
  // ----------------------------------------------------------

  const keywords = [
    ["cowhide", "Cowhide leather"],
    ["cow leather", "Cow leather"],
    ["sheepskin", "Sheepskin leather"],
    ["goatskin", "Goat leather"],
    ["calfskin", "Calfskin"],
    ["nubuck", "Nubuck"],
    ["suede", "Suede"],
    ["leather", "Leather"],
    ["sneaker", "Sneaker"],
    ["footwear", "Footwear"],
    ["shoe", "Footwear"],
    ["textile", "Textile / fabric"],
    ["fabric", "Textile / fabric"],
    ["rubber", "Rubber"],
    ["eva", "EVA material"],
    ["tpr", "TPR"],
    ["sole", "Footwear sole"]
  ];

  for (const [term, result] of keywords) {
    if (lower.includes(term)) {
      return result;
    }
  }

  return "";
}


/* ============================================================
   MATERIAL
   ============================================================ */

function detectMaterial(text) {
  const lower =
    clean(text).toLowerCase();

  const materials = [
    ["full-grain", "Full-grain leather"],
    ["full grain", "Full-grain leather"],
    ["top-grain", "Top-grain leather"],
    ["top grain", "Top-grain leather"],
    ["genuine leather", "Genuine leather"],
    ["split leather", "Split leather"],
    ["cowhide", "Cowhide leather"],
    ["cow leather", "Cow leather"],
    ["calfskin", "Calfskin"],
    ["sheepskin", "Sheepskin leather"],
    ["goatskin", "Goat leather"],
    ["synthetic leather", "Synthetic leather"],
    ["pu leather", "PU leather"],
    ["microfiber leather", "Microfiber leather"],
    ["microfibre leather", "Microfiber leather"],
    ["microfiber", "Microfiber"],
    ["suede", "Suede"],
    ["nubuck", "Nubuck"],
    ["鞋面革", "Upper leather"],
    ["全粒面", "Full-grain leather"]
  ];

  for (const [term, result] of materials) {
    if (lower.includes(term.toLowerCase())) {
      return result;
    }
  }

  return "";
}


/* ============================================================
   THICKNESS
   ============================================================ */

function detectThickness(text) {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*mm\b/i,
    /(\d+(?:\.\d+)?)\s*毫米/i,
    /thickness[：:\s]*(\d+(?:\.\d+)?)\s*mm/i,
    /厚度[：:\s]*(\d+(?:\.\d+)?)\s*mm/i
  ];

  for (const pattern of patterns) {
    const match =
      clean(text).match(pattern);

    if (match) {
      return `${match[1]} mm`;
    }
  }

  return "";
}


/* ============================================================
   COLOR
   ============================================================ */

function detectColor(text) {
  const lower =
    clean(text).toLowerCase();

  const colors = [
    ["dark brown", "Dark brown"],
    ["light brown", "Light brown"],
    ["black", "Black"],
    ["white", "White"],
    ["brown", "Brown"],
    ["tan", "Tan"],
    ["beige", "Beige"],
    ["navy", "Navy"],
    ["blue", "Blue"],
    ["red", "Red"],
    ["green", "Green"],
    ["grey", "Grey"],
    ["gray", "Grey"],
    ["cream", "Cream"],

    ["黑色", "Black"],
    ["白色", "White"],
    ["棕色", "Brown"],
    ["咖啡色", "Brown"],
    ["蓝色", "Blue"],
    ["红色", "Red"],
    ["绿色", "Green"],
    ["米色", "Beige"]
  ];

  for (const [term, result] of colors) {
    if (lower.includes(term.toLowerCase())) {
      return result;
    }
  }

  return "";
}


/* ============================================================
   QUANTITY
   ============================================================ */

function extractQuantity(text) {
  const value =
    clean(text);

  if (!value) {
    return "";
  }

  const patterns = [
    /([\d,]+(?:\.\d+)?)\s*(pairs?|pair)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(pcs?|pieces?)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(kg|kgs|kilograms?)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(tons?|tonnes?)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(mt|metric tons?)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(yards?|yd)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(meters?|metres?|m)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(sqft|sq\.?\s*ft|square feet)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(sqm|square meters?)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(units?)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(双)/i,
    /([\d,]+(?:\.\d+)?)\s*(件)/i,
    /数量[：:\s]*([\d,]+(?:\.\d+)?)/i
  ];

  for (const pattern of patterns) {
    const match =
      value.match(pattern);

    if (match) {
      return match[0].trim();
    }
  }

  return "";
}


/* ============================================================
   PRICE
   ============================================================ */

function extractPrice(text) {
  const value =
    clean(text);

  if (!value) {
    return "";
  }

  const patterns = [
    /(?:target price|target cost|price|budget|目标价|预算)[^\d$€£¥]*([$€£¥]?\s*[\d,.]+(?:\s*(?:\/|per)\s*[a-zA-Z0-9 ]+)?)/i,

    /([$€£¥]\s*[\d,.]+(?:\s*(?:\/|per)\s*[a-zA-Z0-9 ]+)?)/i,

    /(?:USD|US\$|usd)\s*[\d,.]+(?:\s*(?:\/|per)\s*[a-zA-Z0-9 ]+)?/i
  ];

  for (const pattern of patterns) {
    const match =
      value.match(pattern);

    if (match) {
      return match[0].trim();
    }
  }

  return "";
}


/* ============================================================
   DESTINATION
   ============================================================ */

function extractDestination(text) {
  const value =
    clean(text);

  if (!value) {
    return "";
  }

  const lower =
    value.toLowerCase();

  const destinations = [
    ["united states", "United States"],
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
    ["korea", "South Korea"],
    ["韩国", "South Korea"],

    ["uae", "United Arab Emirates"],
    ["united arab emirates", "United Arab Emirates"],

    ["saudi arabia", "Saudi Arabia"],
    ["saudi", "Saudi Arabia"],

    ["singapore", "Singapore"],
    ["新加坡", "Singapore"],

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

  for (const [term, result] of destinations) {
    if (lower.includes(term)) {
      return result;
    }
  }

  return "";
}


/* ============================================================
   INDUSTRY
   ============================================================ */

function detectIndustry(text) {
  const lower =
    clean(text).toLowerCase();

  if (
    lower.includes("leather") ||
    lower.includes("leathergoods") ||
    lower.includes("hide") ||
    lower.includes("革") ||
    lower.includes("皮")
  ) {
    return "Leather & Materials";
  }

  if (
    lower.includes("shoe") ||
    lower.includes("sneaker") ||
    lower.includes("footwear") ||
    lower.includes("鞋")
  ) {
    return "Footwear";
  }

  if (
    lower.includes("textile") ||
    lower.includes("fabric") ||
    lower.includes("面料") ||
    lower.includes("纺织")
  ) {
    return "Textiles";
  }

  if (
    lower.includes("rubber") ||
    lower.includes("eva") ||
    lower.includes("tpr") ||
    lower.includes("sole")
  ) {
    return "Footwear Components";
  }

  return "General sourcing";
}


/* ============================================================
   CERTIFICATIONS
   ============================================================ */

function detectCertifications(text) {
  const lower =
    clean(text).toLowerCase();

  const checks = [
    ["lwg", "LWG"],
    ["iso 9001", "ISO 9001"],
    ["iso9001", "ISO 9001"],
    ["iso 14001", "ISO 14001"],
    ["reach", "REACH"],
    ["rohs", "RoHS"],
    ["oeko-tex", "OEKO-TEX"],
    ["oeko tex", "OEKO-TEX"],
    ["gots", "GOTS"],
    ["grs", "GRS"],
    ["bci", "BCI"],
    ["sedex", "SEDEX"],
    ["amfori", "amfori BSCI"],
    ["bsci", "amfori BSCI"],
    ["sa8000", "SA8000"]
  ];

  const result = [];

  for (const [term, value] of checks) {
    if (lower.includes(term)) {
      result.push(value);
    }
  }

  return unique(result);
}


/* ============================================================
   PACKAGING
   ============================================================ */

function detectPackaging(text) {
  const lower =
    clean(text).toLowerCase();

  if (
    lower.includes("individual box") ||
    lower.includes("individual packaging") ||
    lower.includes("individual package")
  ) {
    return "Individual packaging";
  }

  if (
    lower.includes("carton") ||
    lower.includes("cartons")
  ) {
    return "Carton packaging";
  }

  if (
    lower.includes("custom packaging") ||
    lower.includes("custom box")
  ) {
    return "Custom packaging";
  }

  if (
    lower.includes("包装") ||
    lower.includes("独立包装")
  ) {
    return "Individual packaging";
  }

  return "";
}


/* ============================================================
   MOQ
   ============================================================ */

function detectMOQ(text) {
  const patterns = [
    /MOQ[：:\s]*([\d,]+)/i,
    /minimum order quantity[：:\s]*([\d,]+)/i,
    /最低起订量[：:\s]*([\d,]+)/i
  ];

  for (const pattern of patterns) {
    const match =
      clean(text).match(pattern);

    if (match) {
      return match[1];
    }
  }

  return "";
}


/* ============================================================
   LEAD TIME
   ============================================================ */

function detectLeadTime(text) {
  const patterns = [
    /(\d+)\s*(?:-|to)\s*(\d+)\s*weeks?\b/i,
    /(\d+)\s*weeks?\b/i,
    /(\d+)\s*(?:-|to)\s*(\d+)\s*days?\b/i,
    /(\d+)\s*days?\b/i,
    /交期[：:\s]*(\d+)\s*(?:天|周)/i
  ];

  for (const pattern of patterns) {
    const match =
      clean(text).match(pattern);

    if (match) {
      return match[0].trim();
    }
  }

  return "";
}


/* ============================================================
   REQUIREMENT SCORE
   ============================================================ */

function calculateRequirementScore(analysis) {
  let score = 20;

  let clarity = 20;
  let specification = 15;
  let commercial = 20;

  // Product
  if (analysis.product) {
    score += 15;
    clarity += 25;
  }

  // Material
  if (analysis.material) {
    score += 8;
    specification += 20;
  }

  // Thickness
  if (analysis.thickness) {
    score += 7;
    specification += 15;
  }

  // Color
  if (analysis.color) {
    score += 4;
    specification += 8;
  }

  // Quantity
  if (analysis.quantity) {
    score += 10;
    commercial += 20;
  }

  // Price
  if (analysis.targetPrice) {
    score += 8;
    commercial += 20;
  }

  // Destination
  if (analysis.destination) {
    score += 5;
    commercial += 10;
  }

  // Certifications
  if (
    Array.isArray(analysis.certifications) &&
    analysis.certifications.length
  ) {
    score += 4;
    specification += 7;
  }

  // MOQ
  if (analysis.moq) {
    score += 3;
    commercial += 5;
  }

  // Lead time
  if (analysis.leadTime) {
    score += 3;
    commercial += 5;
  }

  score =
    Math.min(100, score);

  clarity =
    Math.min(100, clarity);

  specification =
    Math.min(100, specification);

  commercial =
    Math.min(100, commercial);

  let note =
    "Basic sourcing requirement. Additional commercial or technical information is recommended.";

  if (score >= 85) {
    note =
      "Strong sourcing brief. The requirement contains substantial commercial and technical information for supplier screening.";
  } else if (score >= 70) {
    note =
      "Good sourcing brief. Adding missing specifications would improve supplier matching.";
  } else if (score >= 50) {
    note =
      "Basic sourcing brief. Additional commercial or technical information is recommended before supplier verification.";
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
   TAVILY SEARCH
   ============================================================ */

async function searchSuppliersWithTavily(
  analysis,
  apiKey
) {
  const product =
    analysis.product ||
    analysis.material ||
    analysis.originalRequest ||
    "supplier";

  const material =
    analysis.material || "";

  const destination =
    analysis.destination || "";

  const industry =
    analysis.industry || "";

  // ----------------------------------------------------------
  // IMPORTANT:
  // Search queries are deliberately supplier-oriented.
  // ----------------------------------------------------------

  const queries = [
    buildSupplierQuery(
      product,
      material,
      destination,
      industry
    ),

    buildManufacturerQuery(
      product,
      material,
      destination
    ),

    buildFactoryQuery(
      product,
      material,
      destination
    ),

    buildOEMQuery(
      product,
      material,
      destination
    )
  ];

  const responses =
    await Promise.all(
      queries.map(query =>
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

  return {
    results:
      allResults,

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

function buildSupplierQuery(
  product,
  material,
  destination,
  industry
) {
  return [
    `"${product}"`,
    material,
    industry,
    "supplier",
    "manufacturer",
    "factory",
    destination,
    "official website"
  ]
    .filter(Boolean)
    .join(" ");
}


function buildManufacturerQuery(
  product,
  material,
  destination
) {
  return [
    `"${product}"`,
    material,
    "manufacturer",
    "factory",
    "OEM",
    destination,
    "company",
    "official website"
  ]
    .filter(Boolean)
    .join(" ");
}


function buildFactoryQuery(
  product,
  material,
  destination
) {
  return [
    `"${product}"`,
    material,
    "factory",
    "manufacturing",
    "production",
    "supplier",
    destination,
    "company"
  ]
    .filter(Boolean)
    .join(" ");
}


function buildOEMQuery(
  product,
  material,
  destination
) {
  return [
    `"${product}"`,
    material,
    "OEM",
    "ODM",
    "manufacturer",
    "factory",
    "exporter",
    destination
  ]
    .filter(Boolean)
    .join(" ");
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
              "basic",

            max_results:
              10,

            include_answer:
              false,

            include_raw_content:
              true,

            include_images:
              false,

            exclude_domains: [
              // Social media
              "facebook.com",
              "instagram.com",
              "linkedin.com",
              "youtube.com",
              "pinterest.com",
              "reddit.com",
              "tiktok.com",

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

              // Reference / low value
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
      isLowValuePage(result)
    ) {
      continue;
    }

    const domain =
      getDomain(result.url);

    if (!domain) {
      continue;
    }

    const score =
      calculateMatchScore(
        result,
        analysis
      );

    // Only genuine supplier-like candidates.
    if (score < 40) {
      continue;
    }

    const supplierType =
      detectSupplierType(result);

    candidates.push({
      result,
      domain,
      score,
      supplierType
    });
  }

  // ----------------------------------------------------------
  // Sort
  // ----------------------------------------------------------

  candidates.sort(
    (a, b) =>
      b.score - a.score
  );

  // ----------------------------------------------------------
  // One result per domain.
  // ----------------------------------------------------------

  const uniqueCandidates = [];

  const seenDomains =
    new Set();

  for (const candidate of candidates) {
    if (
      seenDomains.has(
        candidate.domain
      )
    ) {
      continue;
    }

    seenDomains.add(
      candidate.domain
    );

    uniqueCandidates.push(
      candidate
    );

    if (
      uniqueCandidates.length >= 10
    ) {
      break;
    }
  }

  // ----------------------------------------------------------
  // Convert to frontend API format
  // ----------------------------------------------------------

  return uniqueCandidates.map(
    (candidate, index) => {
      const result =
        candidate.result;

      const domain =
        candidate.domain;

      const contact =
        extractContactInfo(result);

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
          normalizeUrl(
            result.url
          ),

        domain,

        supplierType:
          candidate.supplierType,

        matchScore:
          candidate.score,

        source:
          "Public web search",

        verificationStatus:
          "Unverified — due diligence required",

        contactEmail:
          contact.email || "",

        contactPhone:
          contact.phone || "",

        evidence:
          buildEvidence(
            result,
            analysis
          )
      };
    }
  );
}


/* ============================================================
   LOW-VALUE PAGE FILTER
   ============================================================ */

function isLowValuePage(result) {
  const title =
    clean(
      result.title || ""
    ).toLowerCase();

  const content =
    clean(
      result.content || ""
    ).toLowerCase();

  const rawContent =
    clean(
      result.raw_content || ""
    ).toLowerCase();

  const url =
    clean(
      result.url || ""
    ).toLowerCase();

  const combined =
    `${title} ${content} ${rawContent} ${url}`;

  // ----------------------------------------------------------
  // Article / directory / marketplace signals
  // ----------------------------------------------------------

  const badKeywords = [
    "top 10",
    "top 20",
    "top 50",
    "top 5",

    "best manufacturers",
    "best suppliers",
    "best factories",
    "best companies",

    "supplier directory",
    "manufacturer directory",
    "factory directory",
    "directory",

    "directories",
    "marketplace",
    "marketplaces",

    "listing",
    "listings",

    "quick guide",
    "ultimate guide",
    "buyer's guide",
    "buyers guide",

    "how to",
    "what is",
    "why you should",

    "review",
    "reviews",

    "comparison",
    "comparisons",

    "blog",
    "article",
    "news",
    "journal",
    "magazine",

    "market report",
    "industry report",

    "price list",
    "catalog",
    "catalogue"
  ];

  for (const keyword of badKeywords) {
    if (
      combined.includes(keyword)
    ) {
      return true;
    }
  }

  // ----------------------------------------------------------
  // Known directory domains
  // ----------------------------------------------------------

  const badDomains = [
    "justdial.com",
    "yellowpages.com",
    "yelp.com",
    "kompass.com",
    "europages.com",
    "thomasnet.com",
    "picclick.com",
    "wikipedia.org",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "reddit.com",
    "amazon.com",
    "ebay.com",
    "alibaba.com",
    "aliexpress.com",
    "made-in-china.com",
    "globalsources.com",
    "indiamart.com",
    "tradeindia.com"
  ];

  for (const domain of badDomains) {
    if (
      url.includes(domain)
    ) {
      return true;
    }
  }

  // ----------------------------------------------------------
  // Article paths
  // ----------------------------------------------------------

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
    "/wiki/"
  ];

  for (const pattern of badPathPatterns) {
    if (
      url.includes(pattern)
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
  const title =
    clean(
      result.title || ""
    );

  const content =
    clean(
      result.content || ""
    );

  const rawContent =
    clean(
      result.raw_content || ""
    );

  const url =
    clean(
      result.url || ""
    );

  const text =
    `${title} ${content} ${rawContent} ${url}`
      .toLowerCase();

  const product =
    clean(
      analysis.product || ""
    ).toLowerCase();

  const material =
    clean(
      analysis.material || ""
    ).toLowerCase();

  // ----------------------------------------------------------
  // Tavily relevance
  // ----------------------------------------------------------

  let score =
    Number(
      result.score || 0
    ) * 40;

  // ----------------------------------------------------------
  // Product exact match
  // ----------------------------------------------------------

  if (
    product &&
    text.includes(product)
  ) {
    score += 25;
  }

  // ----------------------------------------------------------
  // Product word matching
  // ----------------------------------------------------------

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

  for (const word of productWords) {
    if (
      text.includes(word)
    ) {
      matchedWords++;
    }
  }

  if (
    productWords.length
  ) {
    score += Math.min(
      15,
      (
        matchedWords /
        productWords.length
      ) * 15
    );
  }

  // ----------------------------------------------------------
  // Material
  // ----------------------------------------------------------

  if (
    material &&
    text.includes(material)
  ) {
    score += 10;
  }

  // ----------------------------------------------------------
  // Leather signals
  // ----------------------------------------------------------

  const leatherSignals = [
    "leather",
    "leathergoods",
    "hide",
    "cowhide",
    "full-grain",
    "full grain",
    "top-grain",
    "genuine leather",
    "shoe upper",
    "shoe uppers",
    "footwear upper",
    "鞋面",
    "皮革"
  ];

  for (const signal of leatherSignals) {
    if (
      text.includes(signal)
    ) {
      score += 3;
    }
  }

  // ----------------------------------------------------------
  // China signals
  // ----------------------------------------------------------

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

  let chinaFound = false;

  for (const signal of chinaSignals) {
    if (
      text.includes(signal)
    ) {
      chinaFound = true;
      break;
    }
  }

  if (chinaFound) {
    score += 8;
  }

  // ----------------------------------------------------------
  // Manufacturer signals
  // ----------------------------------------------------------

  const manufacturerSignals = [
    "manufacturer",
    "manufacturing",
    "factory",
    "factories",
    "production",
    "producer",
    "production facility",
    "manufacturing facility",
    "manufacturing plant",
    "production plant",
    "factory direct"
  ];

  let manufacturerFound = false;

  for (const signal of manufacturerSignals) {
    if (
      text.includes(signal)
    ) {
      manufacturerFound = true;
      break;
    }
  }

  if (manufacturerFound) {
    score += 12;
  }

  // ----------------------------------------------------------
  // OEM / ODM / export
  // ----------------------------------------------------------

  const commercialSignals = [
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

  for (const signal of commercialSignals) {
    if (
      text.includes(signal)
    ) {
      score += 4;
    }
  }

  // ----------------------------------------------------------
  // Company credibility signals
  // ----------------------------------------------------------

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
    "our products",
    "factory profile",
    "manufacturing capabilities"
  ];

  for (const signal of companySignals) {
    if (
      text.includes(signal)
    ) {
      score += 2;
    }
  }

  // ----------------------------------------------------------
  // Penalties
  // ----------------------------------------------------------

  const penalties = [
    "top 10",
    "top 20",
    "top 50",
    "best suppliers",
    "best manufacturers",
    "quick guide",
    "ultimate guide",
    "review",
    "directory",
    "marketplace",
    "listing",
    "blog",
    "news",
    "article",
    "comparison"
  ];

  for (const penalty of penalties) {
    if (
      text.includes(penalty)
    ) {
      score -= 20;
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

function detectSupplierType(result) {
  const text =
    (
      result.title || ""
    ) +
    " " +
    (
      result.content || ""
    ) +
    " " +
    (
      result.raw_content || ""
    ) +
    " " +
    (
      result.url || ""
    );

  const lower =
    text.toLowerCase();

  if (
    lower.includes("manufacturer") ||
    lower.includes("manufacturing") ||
    lower.includes("factory") ||
    lower.includes("production facility")
  ) {
    return "Manufacturer / Factory";
  }

  if (
    lower.includes("oem") ||
    lower.includes("odm")
  ) {
    return "OEM / ODM Manufacturer";
  }

  if (
    lower.includes("exporter")
  ) {
    return "Manufacturer / Exporter";
  }

  if (
    lower.includes("supplier")
  ) {
    return "Manufacturer / Supplier";
  }

  return "Potential Manufacturer";
}


/* ============================================================
   EVIDENCE
   ============================================================ */

function buildEvidence(
  result,
  analysis
) {
  const content =
    clean(
      result.raw_content ||
      result.content ||
      ""
    );

  const product =
    analysis.product ||
    "the requested product";

  if (!content) {
    return (
      `Public-web evidence indicates potential ` +
      `manufacturing or supply capability related to ` +
      `${product}. Supplier capability requires ` +
      `direct verification.`
    );
  }

  return (
    `Public-web evidence indicates potential ` +
    `manufacturing or supply capability related to ` +
    `${product}. ` +
    content.slice(0, 900)
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
      title || ""
    );

  // Remove common suffixes
  value =
    value
      .replace(
        /\s*[|–—-]\s*(official website|official site|home|homepage)$/i,
        ""
      )
      .trim();

  // ----------------------------------------------------------
  // Article-looking titles should NOT become supplier names.
  // ----------------------------------------------------------

  const articleTitle =
    /^(top|best|how|why|what|guide|list|review|directory|comparison)/i
      .test(value);

  if (
    articleTitle &&
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

  // ----------------------------------------------------------
  // Remove excessive whitespace
  // ----------------------------------------------------------

  value =
    value.replace(
      /\s+/g,
      " "
    );

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


/* ============================================================
   COMPANY NAME FROM DOMAIN
   ============================================================ */

function companyNameFromDomain(domain) {
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
  result,
  analysis
) {
  const text =
    (
      result.title || ""
    ) +
    " " +
    (
      result.content || ""
    ) +
    " " +
    (
      result.raw_content || ""
    ) +
    " " +
    (
      result.url || ""
    );

  const lower =
    text.toLowerCase();

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
    "France",
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
    "Romania"
  ];

  for (const location of locations) {
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


/* ============================================================
   CONTACT EXTRACTION
   ============================================================ */

function extractContactInfo(result) {
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
      /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]\d{3,4}/
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


/* ============================================================
   DOMAIN
   ============================================================ */

function getDomain(url) {
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


/* ============================================================
   WEBSITE ROOT
   ============================================================ */

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
    return "";
  }
}


/* ============================================================
   URL NORMALIZATION
   ============================================================ */

function normalizeUrl(url) {
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
   SAFE JSON
   ============================================================ */

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}


/* ============================================================
   CLEAN
   ============================================================ */

function clean(value) {
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


/* ============================================================
   UNIQUE
   ============================================================ */

function unique(array) {
  return Array.from(
    new Set(
      (array || [])
        .filter(Boolean)
    )
  );
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
          "no-store"
      }
    }
  );
}


/* ============================================================
   CORS HEADERS
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
