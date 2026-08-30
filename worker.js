/* =========================================================
   CASEVO AI SOURCING WORKER
   Cloudflare Worker
   No OpenAI API key required.

   API:
   POST /api/sourcing
   GET  /api/health
   ========================================================= */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400"
};

// ---------------------------------------------------------
// Main Worker
// ---------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // -----------------------------------------------------
    // Health check
    // -----------------------------------------------------

    if (
      url.pathname === "/api/health" ||
      url.pathname === "/health"
    ) {
      return jsonResponse({
        ok: true,
        service: "CASEVO AI Sourcing",
        version: "MVP-2",
        ai_provider: "Built-in requirement parser",
        api_key_required: false,
        timestamp: new Date().toISOString()
      });
    }

    // -----------------------------------------------------
    // API
    // -----------------------------------------------------

    if (
      url.pathname === "/api/sourcing" &&
      request.method === "POST"
    ) {
      return handleSourcing(request);
    }

    // -----------------------------------------------------
    // Static website assets
    // -----------------------------------------------------

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      "CASEVO Worker is running.",
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          ...CORS_HEADERS
        }
      }
    );
  }
};

// =========================================================
// SOURCING HANDLER
// =========================================================

async function handleSourcing(request) {
  try {
    const body = await request.json();

    const requirement = cleanText(body.requirement);
    const productInput = cleanText(body.product);
    const quantityInput = cleanText(body.quantity);
    const targetPriceInput = cleanText(body.targetPrice);
    const destinationInput = cleanText(body.destination);

    if (!requirement && !productInput) {
      return jsonResponse(
        {
          ok: false,
          error: "Please provide a sourcing requirement."
        },
        400
      );
    }

    const combinedText = [
      requirement,
      productInput,
      quantityInput,
      targetPriceInput,
      destinationInput
    ]
      .filter(Boolean)
      .join(" ");

    const normalized = normalizeRequirement({
      requirement,
      productInput,
      quantityInput,
      targetPriceInput,
      destinationInput,
      combinedText
    });

    const scoring = calculateScore(normalized);

    const matches = buildSupplierProfiles(normalized);

    const brief = {
      product:
        normalized.product ||
        productInput ||
        "Sourcing requirement",

      quantity:
        normalized.quantity ||
        quantityInput ||
        null,

      targetPrice:
        normalized.targetPrice ||
        targetPriceInput ||
        null,

      destination:
        normalized.destination ||
        destinationInput ||
        null
    };

    return jsonResponse({
      ok: true,

      service: "CASEVO AI Sourcing",

      version: "MVP-2",

      ai: {
        provider: "CASEVO Built-in Sourcing Parser",
        api_key_required: false,
        mode: "rule-based intelligence"
      },

      brief,

      analysis: {
        normalized,
        scoring,
        matches
      },

      generated_at: new Date().toISOString()
    });

  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: "CASEVO sourcing analysis failed.",
        details:
          error?.message ||
          "Unknown error."
      },
      500
    );
  }
}

// =========================================================
// NORMALIZE REQUIREMENT
// =========================================================

function normalizeRequirement(data) {
  const text = data.combinedText || "";

  const lower = text.toLowerCase();

  const product =
    data.productInput ||
    detectProduct(text);

  const quantity =
    data.quantityInput ||
    detectQuantity(text);

  const targetPrice =
    data.targetPriceInput ||
    detectPrice(text);

  const destination =
    data.destinationInput ||
    detectDestination(text);

  const material = detectMaterial(text);

  const thickness = detectThickness(text);

  const color = detectColor(text);

  const industry = detectIndustry(text);

  const certifications = detectCertifications(text);

  const packaging = detectPackaging(text);

  const moq = detectMOQ(text);

  const leadTime = detectLeadTime(text);

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
      `Thickness / gauge: ${thickness}`
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
      `Destination market: ${destination}`
    );
  }

  if (certifications.length) {
    requirements.push(
      `Certification requirements: ${certifications.join(", ")}`
    );
  }

  if (packaging) {
    requirements.push(
      `Packaging: ${packaging}`
    );
  }

  if (moq) {
    requirements.push(
      `MOQ requirement: ${moq}`
    );
  }

  if (leadTime) {
    requirements.push(
      `Lead time: ${leadTime}`
    );
  }

  if (!requirements.length) {
    requirements.push(
      "A general sourcing requirement was provided and requires further specification."
    );
  }

  const tags = [];

  if (industry) tags.push(industry);
  if (material) tags.push(material);
  if (color) tags.push(color);
  if (thickness) tags.push(thickness);
  if (quantity) tags.push("Volume requirement");
  if (targetPrice) tags.push("Target pricing");
  if (destination) tags.push(destination);

  return {
    product: product || null,
    material: material || null,
    thickness: thickness || null,
    color: color || null,
    quantity: quantity || null,
    targetPrice: targetPrice || null,
    destination: destination || null,

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

    tags: unique(tags),

    originalRequest: data.requirement || ""
  };
}

// =========================================================
// PRODUCT DETECTION
// =========================================================

function detectProduct(text) {
  const lower = text.toLowerCase();

  const patterns = [
    {
      terms: [
        "cow leather",
        "cowhide",
        "cow hide",
        "牛皮",
        "牛皮革"
      ],
      value: "Cow leather"
    },

    {
      terms: [
        "sheepskin",
        "sheep leather",
        "羊皮",
        "羊皮革"
      ],
      value: "Sheepskin leather"
    },

    {
      terms: [
        "goat leather",
        "goatskin",
        "goat skin",
        "山羊皮"
      ],
      value: "Goat leather"
    },

    {
      terms: [
        "leather",
        "革",
        "皮革",
        "鞋面革",
        "upper leather"
      ],
      value: "Leather"
    },

    {
      terms: [
        "shoe upper",
        "shoe uppers",
        "鞋面"
      ],
      value: "Shoe upper"
    },

    {
      terms: [
        "sneaker",
        "sneakers",
        "运动鞋"
      ],
      value: "Sneaker"
    },

    {
      terms: [
        "football shoe",
        "soccer shoe",
        "足球鞋"
      ],
      value: "Football footwear"
    },

    {
      terms: [
        "textile",
        "fabric",
        "面料",
        "纺织"
      ],
      value: "Textile / fabric"
    },

    {
      terms: [
        "rubber",
        "橡胶"
      ],
      value: "Rubber"
    },

    {
      terms: [
        "eva",
        "EVA"
      ],
      value: "EVA material"
    },

    {
      terms: [
        "sole",
        "soles",
        "鞋底"
      ],
      value: "Footwear sole"
    },

    {
      terms: [
        "insole",
        "insoles",
        "鞋垫"
      ],
      value: "Insole"
    },

    {
      terms: [
        "shoe",
        "shoes",
        "footwear",
        "鞋",
        "鞋类"
      ],
      value: "Footwear"
    }
  ];

  for (const pattern of patterns) {
    for (const term of pattern.terms) {
      if (lower.includes(term.toLowerCase())) {
        return pattern.value;
      }
    }
  }

  return "";
}

// =========================================================
// MATERIAL DETECTION
// =========================================================

function detectMaterial(text) {
  const lower = text.toLowerCase();

  const materials = [
    ["full-grain", "Full-grain leather"],
    ["full grain", "Full-grain leather"],
    ["top-grain", "Top-grain leather"],
    ["top grain", "Top-grain leather"],
    ["split leather", "Split leather"],
    ["genuine leather", "Genuine leather"],
    ["synthetic leather", "Synthetic leather"],
    ["pu leather", "PU leather"],
    ["microfiber", "Microfiber"],
    ["microfibre", "Microfiber"],
    ["suede", "Suede"],
    ["nubuck", "Nubuck"],
    ["calfskin", "Calfskin"],
    ["牛皮", "Cow leather"],
    ["羊皮", "Sheepskin leather"],
    ["山羊皮", "Goat leather"],
    ["鞋面革", "Upper leather"]
  ];

  for (const [term, value] of materials) {
    if (lower.includes(term.toLowerCase())) {
      return value;
    }
  }

  return "";
}

// =========================================================
// THICKNESS
// =========================================================

function detectThickness(text) {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*mm\b/i,
    /(\d+(?:\.\d+)?)\s*毫米/,
    /厚度[：:\s]*(\d+(?:\.\d+)?)\s*mm/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return `${match[1]} mm`;
    }
  }

  return "";
}

// =========================================================
// COLOR
// =========================================================

function detectColor(text) {
  const lower = text.toLowerCase();

  const colors = [
    ["black", "Black"],
    ["white", "White"],
    ["brown", "Brown"],
    ["dark brown", "Dark brown"],
    ["tan", "Tan"],
    ["beige", "Beige"],
    ["navy", "Navy"],
    ["blue", "Blue"],
    ["red", "Red"],
    ["green", "Green"],
    ["grey", "Grey"],
    ["gray", "Grey"],
    ["cream", "Cream"],
    ["black", "Black"],
    ["黑色", "Black"],
    ["白色", "White"],
    ["棕色", "Brown"],
    ["咖啡色", "Brown"],
    ["蓝色", "Blue"],
    ["红色", "Red"],
    ["绿色", "Green"]
  ];

  for (const [term, value] of colors) {
    if (lower.includes(term.toLowerCase())) {
      return value;
    }
  }

  return "";
}

// =========================================================
// QUANTITY
// =========================================================

function detectQuantity(text) {
  const patterns = [
    /([\d,]+(?:\.\d+)?)\s*(pairs?|pair)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(pcs?|pieces?)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(kg|kgs|kilograms?)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(tons?|tonnes?)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(yards?|yd)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(meters?|metres?|m)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(sqft|sq\.?\s*ft|square feet)\b/i,
    /([\d,]+(?:\.\d+)?)\s*(平方英尺)/i,
    /([\d,]+(?:\.\d+)?)\s*(双)/i,
    /([\d,]+(?:\.\d+)?)\s*(件)/i,
    /数量[：:\s]*([\d,]+(?:\.\d+)?)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return match[0].trim();
    }
  }

  return "";
}

// =========================================================
// PRICE
// =========================================================

function detectPrice(text) {
  const patterns = [
    /(?:target price|price|预算|目标价)[^\d$€£¥]*([$€£¥]?\s?[\d,.]+(?:\s*\/\s*[a-zA-Z]+)?)/i,

    /([$€£¥]\s?[\d,.]+(?:\s*\/\s*[a-zA-Z]+)?)/i,

    /(?:USD|usd)\s*([\d,.]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return match[1]
        ? match[0].trim()
        : match[0].trim();
    }
  }

  return "";
}

// =========================================================
// DESTINATION
// =========================================================

function detectDestination(text) {
  const lower = text.toLowerCase();

  const destinations = [
    ["usa", "USA"],
    ["u.s.a", "USA"],
    ["united states", "USA"],
    ["america", "USA"],
    ["美国", "USA"],

    ["uk", "United Kingdom"],
    ["united kingdom", "United Kingdom"],
    ["英国", "United Kingdom"],

    ["germany", "Germany"],
    ["德国", "Germany"],

    ["france", "France"],
    ["法国", "France"],

    ["italy", "Italy"],
    ["意大利", "Italy"],

    ["spain", "Spain"],
    ["西班牙", "Spain"],

    ["canada", "Canada"],
    ["加拿大", "Canada"],

    ["australia", "Australia"],
    ["澳大利亚", "Australia"],

    ["japan", "Japan"],
    ["日本", "Japan"],

    ["korea", "South Korea"],
    ["韩国", "South Korea"]
  ];

  for (const [term, value] of destinations) {
    if (lower.includes(term)) {
      return value;
    }
  }

  return "";
}

// =========================================================
// INDUSTRY
// =========================================================

function detectIndustry(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes("leather") ||
    lower.includes("leathergoods") ||
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
    lower.includes("面料")
  ) {
    return "Textiles";
  }

  if (
    lower.includes("rubber") ||
    lower.includes("eva") ||
    lower.includes("sole")
  ) {
    return "Footwear Components";
  }

  return "General sourcing";
}

// =========================================================
// CERTIFICATIONS
// =========================================================

function detectCertifications(text) {
  const lower = text.toLowerCase();

  const checks = [
    ["lwg", "LWG"],
    ["iso 9001", "ISO 9001"],
    ["iso9001", "ISO 9001"],
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

// =========================================================
// PACKAGING
// =========================================================

function detectPackaging(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes("individual box") ||
    lower.includes("individual packaging")
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

// =========================================================
// MOQ
// =========================================================

function detectMOQ(text) {
  const patterns = [
    /MOQ[：:\s]*([\d,]+)/i,
    /minimum order quantity[：:\s]*([\d,]+)/i,
    /最低起订量[：:\s]*([\d,]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return match[1];
    }
  }

  return "";
}

// =========================================================
// LEAD TIME
// =========================================================

function detectLeadTime(text) {
  const patterns = [
    /(\d+)\s*(?:-|to)?\s*(\d+)?\s*weeks?\b/i,
    /(\d+)\s*(?:-|to)?\s*(\d+)?\s*days?\b/i,
    /交期[：:\s]*(\d+)\s*(?:天|周)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return match[0].trim();
    }
  }

  return "";
}

// =========================================================
// SCORING
// =========================================================

function calculateScore(normalized) {
  let score = 35;

  let clarity = 35;
  let specification = 25;
  let commercial = 25;

  if (normalized.product) {
    score += 8;
    clarity += 10;
  }

  if (normalized.material) {
    score += 7;
    specification += 15;
  }

  if (normalized.thickness) {
    score += 5;
    specification += 10;
  }

  if (normalized.color) {
    score += 3;
    specification += 5;
  }

  if (normalized.quantity) {
    score += 8;
    commercial += 15;
  }

  if (normalized.targetPrice) {
    score += 8;
    commercial += 20;
  }

  if (normalized.destination) {
    score += 5;
    commercial += 10;
  }

  if (normalized.certifications.length) {
    score += 4;
    specification += 5;
  }

  if (normalized.moq) {
    score += 3;
    commercial += 5;
  }

  if (normalized.leadTime) {
    score += 3;
    commercial += 5;
  }

  score = Math.min(100, score);

  clarity = Math.min(100, clarity);
  specification = Math.min(100, specification);
  commercial = Math.min(100, commercial);

  let note =
    "Requirement is partially structured and ready for further supplier verification.";

  if (score >= 85) {
    note =
      "Strong sourcing brief. The requirement contains enough commercial and technical information for supplier screening.";
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

// =========================================================
// SUPPLIER PROFILE MATCHING
// IMPORTANT:
// These are capability profiles, not invented supplier identities.
// =========================================================

function buildSupplierProfiles(normalized) {
  const profiles = [];

  const industry = normalized.industry || "";

  if (
    industry === "Leather & Materials" ||
    normalized.material?.toLowerCase().includes("leather")
  ) {
    profiles.push({
      name: "China Leather Supplier Profile",
      location: "China",
      matchScore: calculateProfileScore(normalized, [
        "material",
        "thickness",
        "color",
        "quantity",
        "certifications"
      ]),
      note:
        "Capability profile for leather/material suppliers. Verified supplier identity must be connected before commercial contact details are shown."
    });
  }

  if (
    industry === "Footwear" ||
    normalized.product?.toLowerCase().includes("shoe") ||
    normalized.product?.toLowerCase().includes("footwear")
  ) {
    profiles.push({
      name: "China Footwear Manufacturing Profile",
      location: "China",
      matchScore: calculateProfileScore(normalized, [
        "product",
        "quantity",
        "destination",
        "targetPrice"
      ]),
      note:
        "Capability profile for footwear manufacturers. Supplier identity and contact details require verification."
    });
  }

  if (
    industry === "Footwear Components" ||
    normalized.product?.toLowerCase().includes("sole")
  ) {
    profiles.push({
      name: "China Footwear Components Profile",
      location: "China",
      matchScore: calculateProfileScore(normalized, [
        "product",
        "material",
        "quantity"
      ]),
      note:
        "Capability profile for footwear component suppliers. No supplier identity is fabricated."
    });
  }

  if (
    industry === "Textiles"
  ) {
    profiles.push({
      name: "China Textile Supplier Profile",
      location: "China",
      matchScore: calculateProfileScore(normalized, [
        "material",
        "quantity",
        "destination"
      ]),
      note:
        "Capability profile for textile manufacturers. Verified supplier data is required for direct sourcing."
    });
  }

  return profiles
    .sort(
      (a, b) =>
        Number(b.matchScore) -
        Number(a.matchScore)
    )
    .slice(0, 5);
}

function calculateProfileScore(normalized, fields) {
  let total = 60;

  for (const field of fields) {
    if (normalized[field]) {
      total += 8;
    }
  }

  if (
    normalized.certifications &&
    normalized.certifications.length
  ) {
    total += 5;
  }

  return Math.min(98, total);
}

// =========================================================
// CLEAN TEXT
// =========================================================

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

// =========================================================
// UNIQUE
// =========================================================

function unique(array) {
  return Array.from(
    new Set(
      array.filter(Boolean)
    )
  );
}

// =========================================================
// JSON RESPONSE
// =========================================================

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        ...CORS_HEADERS
      }
    }
  );
}
