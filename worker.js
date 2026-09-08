/* CASEVO v4.2.4.7 Frontend Recovery + Supplier Discovery Restore */
const VERSION = "v4.2.4.7";
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function clean(value, fallback = "") { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
function safeUrl(value) {
  try {
    const url = new URL(clean(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch { return ""; }
}
function buildBrief(body) {
  return { product: clean(body.product, clean(body.description, "Sourcing requirement")), quantity: clean(body.quantity, "Not specified"), destination: clean(body.destination, "Not specified"), targetPrice: clean(body.targetPrice, "Not specified") };
}
function buildSearchQuery(body, brief) {
  const requirement = clean(body.description, brief.product);
  const details = [brief.quantity, brief.targetPrice, brief.destination].filter(value => value && value !== "Not specified").join(", ");
  return `${requirement}${details ? `, ${details}` : ""} manufacturer supplier factory OEM China`;
}
function normalizeSupplier(result, index) {
  const title = clean(result?.title, `Supplier candidate ${index + 1}`);
  const tavilyScore = Number(result?.score);
  return {
    name: title.split(/\s+[|–—-]\s+/)[0].trim(),
    country: /\b(vietnam|viet nam)\b/i.test(result?.content || "") ? "Vietnam" : /\bchina|chinese\b/i.test(result?.content || "") ? "China" : "Location not confirmed",
    type: "Supplier candidate",
    score: Number.isFinite(tavilyScore) ? Math.max(0, Math.min(100, Math.round(tavilyScore * 100))) : 70,
    summary: clean(result?.content, "Source found; capability evidence requires human review").slice(0, 420),
    evidence: clean(result?.content).slice(0, 700),
    sourceUrl: safeUrl(result?.url),
    verificationStatus: "Human verification required"
  };
}
async function searchSuppliers(env, query) {
  if (!env?.TAVILY_API_KEY) throw new Error("Tavily API key is not configured");
  const response = await fetch(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.TAVILY_API_KEY}` },
    body: JSON.stringify({ query, topic: "general", search_depth: "advanced", max_results: 8, include_answer: false, include_raw_content: false })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || `Tavily request failed (${response.status})`);
  return Array.isArray(data.results) ? data.results : [];
}
async function handleSourcing(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, version: VERSION, error: "Request body must be valid JSON" }, 400); }
  if (!body || typeof body !== "object" || (!clean(body.description) && !clean(body.product))) return json({ ok: false, version: VERSION, error: "A sourcing description or product is required" }, 400);
  const brief = buildBrief(body);
  try {
    const results = await searchSuppliers(env, buildSearchQuery(body, brief));
    return json({ ok: true, version: VERSION, brief, suppliers: results.map(normalizeSupplier).filter(supplier => supplier.sourceUrl) });
  } catch (error) {
    console.error("CASEVO Tavily search failed", error);
    return json({ ok: false, version: VERSION, brief, suppliers: [], error: error.message || "Supplier search failed" }, 502);
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") return json({ ok: true, service: "CASEVO AI Sourcing", version: VERSION, apiKeyConfigured: Boolean(env?.TAVILY_API_KEY) });
    if (url.pathname === "/api/sourcing" && request.method === "POST") return handleSourcing(request, env);
    if (url.pathname.startsWith("/api/")) return json({ ok: false, version: VERSION, error: "Not found" }, 404);
    return json({ ok: true, service: "CASEVO AI Sourcing", version: VERSION });
  }
};
