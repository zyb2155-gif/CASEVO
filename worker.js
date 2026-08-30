const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Health check
    if (url.pathname === "/api/health") {
      return jsonResponse({
        ok: true,
        service: "CASEVO AI Sourcing",
        version: "MVP-2",
        ai_provider: "Local Sourcing Engine",
        openai_required: false,
      });
    }

    // AI Sourcing endpoint
    if (url.pathname === "/api/source" && request.method === "POST") {
      return handleSourcing(request);
    }

    // Demo supplier endpoint
    if (url.pathname === "/api/suppliers" && request.method === "GET") {
      return jsonResponse({
        ok: true,
        suppliers: getDemoSuppliers(),
      });
    }

    // Let Cloudflare Assets serve the website
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return jsonResponse(
      {
        ok: false,
        error: "Asset service is not configured.",
      },
      500
    );
  },
};

/**
 * CASEVO Sourcing MVP
 *
 * This version does NOT require an OpenAI API key.
 * It converts a buyer's natural-language sourcing request
 * into a structured sourcing brief and supplier-match result.
 */
async function handleSourcing(request) {
  try {
    const body = await request.json();

    const rawRequest =
      body.request ||
      body.query ||
      body.prompt ||
      body.description ||
      "";

    if (!rawRequest || typeof rawRequest !== "string") {
      return jsonResponse(
        {
          ok: false,
          error: "Please provide a sourcing request.",
        },
        400
      );
    }

    if (rawRequest.length > 5000) {
      return jsonResponse(
        {
          ok: false,
          error: "Sourcing request is too long. Maximum 5000 characters.",
        },
        400
      );
    }

    const brief = parseSourcingRequest(rawRequest);

    const suppliers = matchSuppliers(brief);

    const score = calculateCasevoScore(brief);

    return jsonResponse({
      ok: true,
      service: "CASEVO AI Sourcing",
      version: "MVP-2",

      input: rawRequest,

      sourcing_brief: brief,

      casevo_score: score,

      supplier_match: suppliers,

      verification: {
        status: "Human Review Required",
        note:
          "Supplier information should be independently verified before commercial engagement.",
      },

      next_steps: [
        "Review supplier shortlist",
        "Confirm technical specifications",
        "Request samples",
        "Verify factory capability and certifications",
        "Request commercial quotation",
      ],
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid request.",
        details: error?.message || "Unknown error.",
      },
      400
    );
  }
}

/**
 * Parse a natural-language sourcing request.
 */
function parseSourcingRequest(text) {
  const lower = text.toLowerCase();

  const product = detectProduct(text);
  const material = detectMaterial(text);
  const color = detectColor(text);
  const quantity = detectQuantity(text);
  const thickness = detectThickness(text);

  const market = detectMarket(text);

  const keywords = extractKeywords(text);

  return {
    product,
    material,
    color,
    thickness,
    quantity,
    target_market: market,
    keywords,
    original_request: text,
  };
}

/**
 * Product detection
 */
function detectProduct(text) {
  const lower = text.toLowerCase();

  const products = [
    ["sneaker", "Sneakers"],
    ["sneakers", "Sneakers"],
    ["shoe", "Footwear"],
    ["shoes", "Footwear"],
    ["boot", "Boots"],
    ["boots", "Boots"],
    ["sandals", "Sandals"],
    ["sandal", "Sandals"],
    ["loafer", "Loafers"],
    ["loafers", "Loafers"],
    ["upper", "Footwear Upper"],
    ["leather upper", "Leather Footwear Upper"],
    ["handbag", "Handbags"],
    ["bag", "Bags"],
    ["wallet", "Wallets"],
    ["belt", "Belts"],
    ["leather", "Leather Material"],
  ];

  for (const [keyword, value] of products) {
    if (lower.includes(keyword)) {
      return value;
    }
  }

  return "Footwear / Material";
}

/**
 * Material detection
 */
function detectMaterial(text) {
  const lower = text.toLowerCase();

  const materials = [
    ["full-grain leather", "Full-Grain Leather"],
    ["full grain leather", "Full-Grain Leather"],
    ["top-grain leather", "Top-Grain Leather"],
    ["top grain leather", "Top-Grain Leather"],
    ["genuine leather", "Genuine Leather"],
    ["cow leather", "Cow Leather"],
    ["cowhide", "Cowhide Leather"],
    ["calf leather", "Calf Leather"],
    ["sheepskin", "Sheepskin Leather"],
    ["sheep leather", "Sheepskin Leather"],
    ["goat leather", "Goat Leather"],
    ["suede", "Suede"],
    ["nubuck", "Nubuck"],
    ["microfiber", "Microfiber"],
    ["synthetic leather", "Synthetic Leather"],
    ["pu leather", "PU Leather"],
    ["pu", "PU"],
    ["mesh", "Mesh"],
    ["canvas", "Canvas"],
    ["leather", "Leather"],
  ];

  for (const [keyword, value] of materials) {
    if (lower.includes(keyword)) {
      return value;
    }
  }

  return "Not specified";
}

/**
 * Color detection
 */
function detectColor(text) {
  const lower = text.toLowerCase();

  const colors = [
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
    ["natural", "Natural"],
  ];

  for (const [keyword, value] of colors) {
    if (lower.includes(keyword)) {
      return value;
    }
  }

  return "Not specified";
}

/**
 * Thickness detection
 */
function detectThickness(text) {
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(mm|millimeter|millimeters)/i
  );

  if (!match) {
    return "Not specified";
  }

  return `${match[1]} mm`;
}

/**
 * Quantity detection
 */
function detectQuantity(text) {
  const patterns = [
    /([\d,]+)\s*(?:pairs?|pair)/i,
    /([\d,]+)\s*(?:pcs?|pieces?)/i,
    /([\d,]+)\s*(?:units?)/i,
    /([\d,]+)\s*(?:sets?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return Number(match[1].replace(/,/g, ""));
    }
  }

  return null;
}

/**
 * Market detection
 */
function detectMarket(text) {
  const lower = text.toLowerCase();

  if (lower.includes("usa") || lower.includes("us market")) {
    return "United States";
  }

  if (
    lower.includes("uk") ||
    lower.includes("united kingdom") ||
    lower.includes("britain")
  ) {
    return "United Kingdom";
  }

  if (
    lower.includes("europe") ||
    lower.includes("eu market") ||
    lower.includes("european market")
  ) {
    return "European Union";
  }

  if (
    lower.includes("australia") ||
    lower.includes("australian market")
  ) {
    return "Australia";
  }

  if (
    lower.includes("canada") ||
    lower.includes("canadian market")
  ) {
    return "Canada";
  }

  return "Not specified";
}

/**
 * Extract useful sourcing keywords.
 */
function extractKeywords(text) {
  const lower = text.toLowerCase();

  const dictionary = [
    "premium",
    "full-grain",
    "top-grain",
    "water-resistant",
    "waterproof",
    "chrome-free",
    "vegetable-tanned",
    "vegetable tanned",
    "soft",
    "durable",
    "breathable",
    "custom",
    "private label",
    "oem",
    "odm",
    "factory",
    "manufacturer",
    "direct supplier",
  ];

  return dictionary.filter((keyword) =>
    lower.includes(keyword.toLowerCase())
  );
}

/**
 * Match against CASEVO's initial supplier intelligence dataset.
 *
 * These are demonstration records for the MVP.
 * They are NOT presented as independently verified suppliers.
 */
function matchSuppliers(brief) {
  const suppliers = getDemoSuppliers();

  const scored = suppliers.map((supplier) => {
    let score = 50;

    const material = String(brief.material).toLowerCase();
    const product = String(brief.product).toLowerCase();

    if (
      material !== "not specified" &&
      supplier.materials.some((item) =>
        material.includes(item.toLowerCase())
      )
    ) {
      score += 20;
    }

    if (
      product.includes("footwear") &&
      supplier.categories.includes("Footwear")
    ) {
      score += 15;
    }

    if (
      brief.quantity &&
      brief.quantity >= supplier.min_order
    ) {
      score += 5;
    }

    score = Math.min(score, 98);

    return {
      ...supplier,
      match_score: score,
    };
  });

  return scored
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 5);
}

/**
 * Initial CASEVO supplier dataset.
 */
function getDemoSuppliers() {
  return [
    {
      name: "CASEVO Demo Supplier A",
      location: "Guangdong, China",
      categories: ["Footwear", "Leather"],
      materials: ["Full-Grain Leather", "Leather"],
      min_order: 1000,
      verification: "Demo / Pending Verification",
    },
    {
      name: "CASEVO Demo Supplier B",
      location: "Fujian, China",
      categories: ["Footwear", "Materials"],
      materials: ["Leather", "Microfiber"],
      min_order: 2000,
      verification: "Demo / Pending Verification",
    },
    {
      name: "CASEVO Demo Supplier C",
      location: "Zhejiang, China",
      categories: ["Leather", "Materials"],
      materials: ["Full-Grain Leather", "Top-Grain Leather"],
      min_order: 500,
      verification: "Demo / Pending Verification",
    },
    {
      name: "CASEVO Demo Supplier D",
      location: "Jiangsu, China",
      categories: ["Footwear", "Materials"],
      materials: ["Leather", "Suede", "Nubuck"],
      min_order: 1000,
      verification: "Demo / Pending Verification",
    },
    {
      name: "CASEVO Demo Supplier E",
      location: "Hunan, China",
      categories: ["Footwear", "Leather"],
      materials: ["Leather", "PU", "Microfiber"],
      min_order: 3000,
      verification: "Demo / Pending Verification",
    },
  ];
}

/**
 * CASEVO scoring model.
 */
function calculateCasevoScore(brief) {
  let score = 70;

  if (brief.product !== "Footwear / Material") {
    score += 5;
  }

  if (brief.material !== "Not specified") {
    score += 7;
  }

  if (brief.color !== "Not specified") {
    score += 3;
  }

  if (brief.thickness !== "Not specified") {
    score += 5;
  }

  if (brief.quantity) {
    score += 5;
  }

  if (brief.target_market !== "Not specified") {
    score += 5;
  }

  return Math.min(score, 100);
}

/**
 * JSON response helper
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}
