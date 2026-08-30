
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    // Health check
    if (url.pathname === "/api/health") {
      return jsonResponse({
        ok: true,
        service: "CASEVO AI Sourcing",
        version: "MVP-1",
      });
    }

    // AI Sourcing endpoint
    if (url.pathname === "/api/source" && request.method === "POST") {
      return handleSourcing(request, env);
    }

    return jsonResponse(
      {
        ok: false,
        error: "Not found",
      },
      404
    );
  },
};

async function handleSourcing(request, env) {
  try {
    if (!env.OPENAI_API_KEY) {
      return jsonResponse(
        {
          ok: false,
          error: "OPENAI_API_KEY is not configured.",
        },
        500
      );
    }

    const body = await request.json();

    const requestText =
      typeof body.request === "string"
        ? body.request.trim()
        : "";

    if (!requestText) {
      return jsonResponse(
        {
          ok: false,
          error: "Please provide a sourcing request.",
        },
        400
      );
    }

    const prompt = `
You are CASEVO AI, a professional China sourcing intelligence assistant.

Your job is to convert a buyer's natural-language sourcing request into a precise sourcing brief.

Focus on:
- footwear
- leather
- footwear materials
- components
- manufacturing
- China supplier sourcing

Do NOT invent suppliers.
Do NOT invent company names.
Do NOT invent contact information.
Do NOT claim that a supplier is verified.

Extract only information that is supported by the buyer's request.

If a field is unknown, return "Not specified".

Buyer request:

${requestText}
`;

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          store: false,
          input: prompt,

          text: {
            format: {
              type: "json_schema",
              name: "casevo_sourcing_brief",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  product: {
                    type: "string",
                  },
                  material: {
                    type: "string",
                  },
                  quantity: {
                    type: "string",
                  },
                  target_price: {
                    type: "string",
                  },
                  destination: {
                    type: "string",
                  },
                  color: {
                    type: "string",
                  },
                  thickness: {
                    type: "string",
                  },
                  requirements: {
                    type: "string",
                  },
                  summary: {
                    type: "string",
                  },
                },
                required: [
                  "product",
                  "material",
                  "quantity",
                  "target_price",
                  "destination",
                  "color",
                  "thickness",
                  "requirements",
                  "summary",
                ],
              },
            },
          },
        }),
      }
    );

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return jsonResponse(
        {
          ok: false,
          error: "OpenAI API request failed.",
          details: data?.error?.message || "Unknown OpenAI error.",
        },
        openaiResponse.status
      );
    }

    const outputText = data.output_text;

    if (!outputText) {
      return jsonResponse(
        {
          ok: false,
          error: "No structured output was returned by OpenAI.",
        },
        502
      );
    }

    let brief;

    try {
      brief = JSON.parse(outputText);
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error: "AI returned invalid JSON.",
        },
        502
      );
    }

    return jsonResponse({
      ok: true,
      service: "CASEVO AI Sourcing",
      version: "MVP-1",
      brief,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: "Server error.",
        details: error?.message || "Unknown error.",
      },
      500
    );
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}
