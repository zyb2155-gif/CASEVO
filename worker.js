/**
 * ============================================================
 * CASEVO AI SOURCING — REAL SUPPLIER SEARCH ENGINE
 * ============================================================
 *
 * Routes:
 *
 * POST /api/sourcing
 * GET  /api/health
 *
 * Uses Tavily Search API to find real supplier/company
 * information from the public web.
 * ============================================================
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /*
     * ----------------------------------------------------------
     * CORS
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
        version: "2.0.0",
        engine: "Tavily Web Search",
        timestamp: new Date().toISOString()
      });
    }

    /*
     * ----------------------------------------------------------
     * SOURCING API
     * ----------------------------------------------------------
     */

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

    /*
     * ----------------------------------------------------------
     * STATIC WEBSITE
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
 * SOURCING REQUEST
 * ============================================================
 */

async function handleSourcingRequest(request, env) {
  let body;

  try {
    body = await request.json();
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid JSON request body."
      },
      400
    );
  }

  /*
   * ----------------------------------------------------------
   * Read user requirements
   * ----------------------------------------------------------
   */

  const requirement = clean(body.requirement);

  const product = clean(body.product);

  const quantity = clean(body.quantity);

  const targetPrice = clean(body.targetPrice);

  const destination = clean(body.destination);

  /*
   * ----------------------------------------------------------
   * Validation
   * ----------------------------------------------------------
   */

  if (!requirement) {
    return jsonResponse(
      {
        ok: false,
        error: "Please enter a sourcing requirement."
      },
      400
    );
  }

  /*
   * ----------------------------------------------------------
   * Build sourcing brief
   * ----------------------------------------------------------
   */

  const analysis = {
    product:
      product || extractProduct(requirement),

    quantity:
      quantity || extractQuantity(requirement),

    targetPrice:
      targetPrice || extractPrice(requirement),

    destination:
      destination || extractDestination(requirement),

    requirement
  };

  /*
   * ----------------------------------------------------------
   * Check Tavily API key
   * ----------------------------------------------------------
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

  /*
   * ----------------------------------------------------------
   * REAL WEB SEARCH
   * ----------------------------------------------------------
   */

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
        "Real supplier search completed successfully.",

      analysis,

      matches,

      meta: {
        source:
          "CASEVO AI Sourcing Engine",

        supplierData:
          "Tavily public web search",

        verified:
          false,

        verificationNote:
          "Search results are public-web matches and must be independently verified before commercial use.",

        searchQuery:
          searchResult.query || "",

        tavilyRequestId:
          searchResult.request_id || null,

        creditsUsed:
          searchResult.usage?.credits || null,

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


/**
 * ============================================================
 * TAVILY SEARCH
 * ============================================================
 */

async function searchSuppliersWithTavily(
  analysis,
  apiKey
) {
  const product =
    analysis.product ||
    analysis.requirement;

  const destination =
    analysis.destination ||
    "";

  /*
   * Build a sourcing-oriented query.
   *
   * Example:
   *
   * leather shoe upper supplier manufacturer China
   * genuine leather footwear factory exporter USA
   */

  const queryParts = [
    product,
    "supplier manufacturer factory",
    destination,
    "exporter"
  ];

  const query =
    queryParts
      .filter(Boolean)
      .join(" ");

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
            "basic",

          max_results:
            10,

          include_answer:
            true,

          include_raw_content:
            false,

          include_images:
            false
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


/**
 * ============================================================
 * NORMALIZE REAL SEARCH RESULTS
 * ============================================================
 */

function normalizeSupplierResults(
  results,
  analysis
) {
  return results
    .filter(result => result && result.url)

    .slice(0, 10)

    .map((result, index) => {
      const domain =
        getDomain(result.url);

      const name =
        cleanSupplierName(
          result.title,
          domain
        );

      const score =
        calculateMatchScore(
          result,
          analysis,
          index
        );

      return {
        rank:
          index + 1,

        name,

        location:
          inferLocation(
            result,
            analysis
          ),

        website:
          result.url,

        domain,

        capability:
          buildCapability(
            result,
            analysis
          ),

        matchScore:
          score,

        source:
          "Public web search",

        verificationStatus:
          "Unverified — due diligence required",

        evidence:
          clean(
            result.content ||
            ""
          ).slice(0, 700)
      };
    });
}


/**
 * ============================================================
 * MATCH SCORING
 * ============================================================
 */

function calculateMatchScore(
  result,
  analysis,
  index
) {
  const text =
    (
      (result.title || "") +
      " " +
      (result.content || "") +
      " " +
      (result.url || "")
    ).toLowerCase();

  const product =
    (
      analysis.product ||
      ""
    ).toLowerCase();

  let score =
    Number(result.score || 0) * 70;

  /*
   * Product relevance
   */

  if (
    product &&
    text.includes(product)
  ) {
    score += 15;
  }

  /*
   * Supplier/manufacturer signals
   */

  const supplierKeywords = [
    "manufacturer",
    "factory",
    "supplier",
    "producer",
    "exporter",
    "oem",
    "odm"
  ];

  for (
    const keyword of supplierKeywords
  ) {
    if (text.includes(keyword)) {
      score += 2;
    }
  }

  /*
   * Country / destination signal
   */

  if (
    analysis.destination &&
    text.includes(
      analysis.destination.toLowerCase()
    )
  ) {
    score += 5;
  }

  /*
   * Keep score in 0–99 range.
   */

  score =
    Math.round(
      Math.max(
        0,
        Math.min(
          99,
          score
        )
      )
    );

  /*
   * Slight ranking adjustment.
   */

  if (index === 0) {
    score =
      Math.min(
        99,
        score + 2
      );
  }

  return score;
}


/**
 * ============================================================
 * CAPABILITY SUMMARY
 * ============================================================
 */

function buildCapability(
  result,
  analysis
) {
  const content =
    clean(
      result.content ||
      ""
    );

  const product =
    analysis.product ||
    "the requested product";

  if (content) {
    return (
      `Potential supplier for ${product}. ` +
      content.slice(0, 350)
    );
  }

  return (
    `Potential supplier/manufacturer related to ${product}.`
  );
}


/**
 * ============================================================
 * SUPPLIER NAME
 * ============================================================
 */

function cleanSupplierName(
  title,
  domain
) {
  let value =
    clean(
      title ||
      ""
    );

  if (!value) {
    return domain || "Unknown supplier";
  }

  /*
   * Remove common page-title suffixes.
   */

  value =
    value
      .replace(
        /\s*[|\-–—]\s*(official website|home|homepage).*$/i,
        ""
      )
      .trim();

  return value.slice(0, 180);
}


/**
 * ============================================================
 * DOMAIN
 * ============================================================
 */

function getDomain(url) {
  try {
    return new URL(url).hostname
      .replace(/^www\./i, "");
  } catch {
    return "";
  }
}


/**
 * ============================================================
 * LOCATION INFERENCE
 * ============================================================
 */

function inferLocation(
  result,
  analysis
) {
  const text =
    (
      (result.title || "") +
      " " +
      (result.content || "") +
      " " +
      (result.url || "")
    ).toLowerCase();

  const countries = [
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
    "United States",
    "USA",
    "Mexico",
    "Brazil",
    "South Korea",
    "Japan"
  ];

  for (
    const country of countries
  ) {
    if (
      text.includes(
        country.toLowerCase()
      )
    ) {
      return country;
    }
  }

  return (
    analysis.destination ||
    "Not determined"
  );
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
  const value =
    clean(text);

  if (!value) {
    return "";
  }

  const lower =
    value.toLowerCase();

  const productKeywords = [
    "cow leather",
    "upper leather",
    "shoe leather",
    "genuine leather",
    "leather",
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
    if (
      lower.includes(keyword)
    ) {
      return keyword;
    }
  }

  return "";
}


function extractQuantity(text) {
  const value =
    clean(text);

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
  const value =
    clean(text);

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
  const value =
    clean(text);

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
      return destination;
    }
  }

  return "";
}


/**
 * ============================================================
 * SAFE JSON
 * ============================================================
 */

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
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
    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type, Accept"
  };
}
