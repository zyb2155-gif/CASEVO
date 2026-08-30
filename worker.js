/**
 * ============================================================
 * CASEVO AI SOURCING — CLOUDFLARE WORKER
 * ============================================================
 *
 * Routes:
 *
 * POST /api/sourcing
 * GET  /api/health
 *
 * All other requests are served by Cloudflare Assets.
 * ============================================================
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /*
     * ----------------------------------------------------------
     * CORS / OPTIONS
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
     * HEALTH CHECK
     * ----------------------------------------------------------
     */

    if (
      url.pathname === "/api/health" &&
      request.method === "GET"
    ) {
      return jsonResponse({
        ok: true,
        service: "CASEVO AI Sourcing",
        version: "1.0.0",
        timestamp: new Date().toISOString()
      });
    }

    /*
     * ----------------------------------------------------------
     * SOURCING API
     * ----------------------------------------------------------
     */

    if (
      url.pathname === "/api/sourcing"
    ) {
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
     * ----------------------------------------------------------
     * STATIC WEBSITE
     * ----------------------------------------------------------
     *
     * IMPORTANT:
     *
     * API routes must be handled BEFORE ASSETS.
     *
     * Otherwise /api/sourcing may return 404 from Assets.
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


/**
 * ============================================================
 * SOURCING REQUEST HANDLER
 * ============================================================
 */

async function handleSourcingRequest(
  request,
  env
) {
  let body;

  try {
    body = await request.json();
  } catch (error) {
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
   * ----------------------------------------------------------
   * Normalize incoming values
   * ----------------------------------------------------------
   */

  const requirement =
    clean(body.requirement);

  const product =
    clean(body.product);

  const quantity =
    clean(body.quantity);

  const targetPrice =
    clean(body.targetPrice);

  const destination =
    clean(body.destination);

  /*
   * ----------------------------------------------------------
   * Validation
   * ----------------------------------------------------------
   */

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

  /*
   * ----------------------------------------------------------
   * Build structured sourcing brief
   * ----------------------------------------------------------
   */

  const analysis = {
    product:
      product || extractProduct(requirement),

    quantity:
      quantity || extractQuantity(requirement),

    targetPrice:
      targetPrice ||
      extractPrice(requirement),

    destination:
      destination ||
      extractDestination(requirement),

    requirement: requirement
  };

  /*
   * ----------------------------------------------------------
   * Supplier matching
   *
   * Current MVP:
   * Return structured demo matches.
   *
   * IMPORTANT:
   * These are clearly marked as demonstration
   * records and are NOT represented as verified
   * real suppliers.
   * ----------------------------------------------------------
   */

  const matches =
    buildDemoMatches(analysis);

  /*
   * ----------------------------------------------------------
   * Request ID
   * ----------------------------------------------------------
   */

  const requestId =
    createRequestId();

  /*
   * ----------------------------------------------------------
   * Final response
   * ----------------------------------------------------------
   */

  return jsonResponse({
    ok: true,

    requestId,

    message:
      "Sourcing requirement received successfully.",

    analysis,

    matches,

    meta: {
      source:
        "CASEVO AI Sourcing Engine",

      supplierData:
        "demo",

      verified:
        false,

      timestamp:
        new Date().toISOString()
    }
  });
}


/**
 * ============================================================
 * DEMO SUPPLIER MATCHES
 * ============================================================
 *
 * These are illustrative records for the MVP.
 * They are NOT real supplier claims.
 * ============================================================
 */

function buildDemoMatches(
  analysis
) {
  const product =
    analysis.product ||
    "specified material";

  return [
    {
      name:
        "CASEVO Demo Match A",

      location:
        "China",

      capability:
        "Manufacturing capability aligned with " +
        product,

      score:
        92,

      status:
        "Illustrative match — verification required"
    },

    {
      name:
        "CASEVO Demo Match B",

      location:
        "China",

      capability:
        "Material sourcing and production capability",

      score:
        86,

      status:
        "Illustrative match — verification required"
    },

    {
      name:
        "CASEVO Demo Match C",

      location:
        "China",

      capability:
        "OEM / manufacturing support",

      score:
        81,

      status:
        "Illustrative match — verification required"
    }
  ];
}


/**
 * ============================================================
 * TEXT HELPERS
 * ============================================================
 */

function clean(value) {
  if (
    value === null ||
    typeof value === "undefined"
  ) {
    return "";
  }

  return String(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}


/**
 * ============================================================
 * BASIC EXTRACTION
 * ============================================================
 */

function extractProduct(text) {
  const value = clean(text);

  if (!value) {
    return "";
  }

  const lower =
    value.toLowerCase();

  const productKeywords = [
    "leather",
    "cow leather",
    "upper leather",
    "shoe leather",
    "sneaker",
    "fabric",
    "textile",
    "rubber",
    "sole",
    "footwear",
    "material"
  ];

  for (
    const keyword of productKeywords
  ) {
    if (lower.includes(keyword)) {
      return keyword;
    }
  }

  return "";
}


function extractQuantity(text) {
  const value = clean(text);

  const match =
    value.match(
      /(\d[\d,.\s]*)\s*(pairs?|pcs?|pieces?|kg|tons?|mt|sqm|sqft|units?)/i
    );

  if (!match) {
    return "";
  }

  return match[0].trim();
}


function extractPrice(text) {
  const value = clean(text);

  const match =
    value.match(
      /(?:usd|us\$|\$)\s*[\d,.]+(?:\s*(?:per|\/)\s*[a-zA-Z0-9 ]+)?/i
    );

  if (!match) {
    return "";
  }

  return match[0].trim();
}


function extractDestination(text) {
  const value = clean(text);

  const destinations = [
    "USA",
    "United States",
    "UK",
    "United Kingdom",
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
    "Singapore"
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
      return destination;
    }
  }

  return "";
}


/**
 * ============================================================
 * REQUEST ID
 * ============================================================
 */

function createRequestId() {
  const timestamp =
    Date.now()
      .toString(36)
      .toUpperCase();

  const random =
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

  return (
    "CASEVO-" +
    timestamp +
    "-" +
    random
  );
}


/**
 * ============================================================
 * JSON RESPONSE
 * ============================================================
 */

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


/**
 * ============================================================
 * CORS
 * ============================================================
 */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type, Accept"
  };
}
