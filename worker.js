/*
 CASEVO v4.2.4.4 Requirement Bridge Restore

 Purpose:
 - Restore frontend -> Worker data bridge
 - Read sourcing form POST payload
 - Normalize sourcing brief
 - Prepare supplier discovery pipeline
*/

const CASEVO_VERSION = "v4.2.4.4";

function normalizeBrief(input = {}) {
  return {
    product:
      input.product ||
      input.material ||
      input.description ||
      "Sourcing requirement",
    quantity: input.quantity || "Not specified",
    destination: input.destination || "Not specified",
    targetPrice: input.targetPrice || "Not specified",
    specifications: input.specifications || []
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "POST") {
      let body = {};
      try {
        body = await request.json();
      } catch (e) {
        body = {};
      }

      const brief = normalizeBrief(body);

      return Response.json({
        ok: true,
        service: "CASEVO AI Sourcing",
        version: CASEVO_VERSION,
        brief,
        suppliers: [],
        nextStep: "Supplier Discovery pipeline ready"
      });
    }

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "CASEVO AI Sourcing",
        version: CASEVO_VERSION,
        apiKeyConfigured: !!env.TAVILY_API_KEY
      });
    }

    return Response.json({
      ok: true,
      version: CASEVO_VERSION
    });
  }
};
