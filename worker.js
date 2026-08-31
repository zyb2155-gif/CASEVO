/**
 * CASEVO AI SOURCING ENGINE
 * Version 4.1.1 — Company Identity Lock
 *
 * GET  /api/health
 * POST /api/sourcing
 * POST /api/verify-supplier
 *
 * Required secret: TAVILY_API_KEY
 */

const VERSION = "4.1.1";
const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const SEARCH_TIMEOUT_MS = 15000;
const RESULTS_PER_QUERY = 10;
const MAX_SEARCH_QUERIES = 4;
const MAX_SUPPLIERS = 6;
const MAX_INPUT_LENGTH = 5000;
const MAX_QUERY_LENGTH = 390;
const MAX_CAPABILITY_LENGTH = 440;
const MAX_EVIDENCE_LENGTH = 700;
const UNKNOWN_COMPANY = "Company identity not confirmed";

const EXCLUDED_DOMAINS = [
  "facebook.com", "instagram.com", "linkedin.com", "youtube.com", "pinterest.com",
  "reddit.com", "tiktok.com", "twitter.com", "x.com", "amazon.com", "ebay.com",
  "alibaba.com", "aliexpress.com", "made-in-china.com", "globalsources.com",
  "indiamart.com", "tradeindia.com", "justdial.com", "yellowpages.com", "yelp.com",
  "thomasnet.com", "kompass.com", "europages.com", "wikipedia.org", "picclick.com",
  "quora.com", "medium.com", "substack.com", "wordpress.com", "blogspot.com", "craigslist.org"
];

const EXCLUDED_TLDS = [".gov", ".edu"];

const LOW_VALUE_TITLE_TERMS = [
  "top 5", "top 10", "top 20", "top 50", "best manufacturers", "best suppliers",
  "best factories", "top manufacturers", "top suppliers", "top factories",
  "list of manufacturers", "list of suppliers", "manufacturer list", "supplier list",
  "supplier directory", "manufacturer directory", "directory", "marketplace",
  "buyer's guide", "buyers guide", "ultimate guide", "quick guide", "how to",
  "what is", "why choose", "what's the difference", "what is the difference",
  "difference between", "comparison", "review", "reviews", "market report",
  "industry report", "price list", "catalog", "catalogue", "laser engraving on leather",
  "laser engraving leather", "premium leather shoes", "complete guide"
];

const LOW_VALUE_PATHS = [
  "/blog/", "/blogs/", "/news/", "/article/", "/articles/", "/magazine/", "/journal/",
  "/category/", "/categories/", "/tag/", "/tags/", "/search/", "/results/", "/directory/",
  "/directories/", "/listing/", "/listings/", "/review/", "/reviews/"
];

const MANUFACTURER_SIGNALS = [
  "manufacturer", "manufacturing", "factory", "factories", "producer", "production facility",
  "manufacturing facility", "manufacturing plant", "production plant", "production line",
  "factory direct", "own factory", "our factory", "our manufacturing", "our production",
  "production capacity"
];

const COMMERCIAL_SIGNALS = [
  "oem", "odm", "private label", "custom manufacturing", "custom production", "custom made",
  "custom-made", "exporter", "export", "exporting", "wholesale", "b2b", "bulk", "moq"
];

const COMPANY_SIGNALS = [
  "about us", "company profile", "our company", "our products", "our factory", "our facility",
  "our production", "contact us", "get in touch", "established", "founded", "company address",
  "registered office"
];

const CHINA_SIGNALS = [
  "china", "chinese", "guangdong", "guangzhou", "dongguan", "foshan", "shenzhen", "zhejiang",
  "wenzhou", "yiwu", "fujian", "quanzhou", "jinjiang", "putian", "chengdu", "jiangsu",
  "sichuan", "hebei"
];

const COMPANY_SUFFIX_RE = /\b(?:co\.?\s*,?\s*ltd\.?|company\s+limited|ltd\.?|limited|inc\.?|corporation|corp\.?|llc)\b/i;

/* v4.1.1: strong rejection signals for non-company labels. */
const NON_IDENTITY_RE = /\b(?:contact\s*us|about\s*us|our\s+(?:factory|process|products?|capabilities|services?)|request\s+(?:a\s+)?(?:factory\s+)?quote|start\s+your|thanks?|learn\s+more|read\s+more|get\s+in\s+touch|privacy\s+policy|terms\s+of\s+use)\b/i;
const DESCRIPTOR_RE = /\b(?:private\s+label|custom|premium|reliable|formal|casual|men'?s|women'?s|leather|shoe|shoes|footwear|goods?)\b/i;
const ROLE_END_RE = /\b(?:manufacturers?|suppliers?|factories|factory|exporters?|wholesalers?)\b\s*$/i;

const GENERIC_TITLE_TERMS = [
  "shoe manufacturer", "shoes manufacturer", "footwear manufacturer", "leather shoe manufacturer",
  "leather shoes manufacturer", "custom shoes manufacturer", "custom footwear manufacturer",
  "shoe supplier", "shoes supplier", "leather supplier", "shoe factory", "shoes factory",
  "leather factory", "oem shoe manufacturer", "odm shoe manufacturer", "private label manufacturer",
  "premium leather shoes", "custom business casual shoes manufacturer", "reliable leather shoes manufacturer"
];

const CERTIFICATION_RULES = [
  ["ISO 9001", /\biso\s*9001\b/i], ["ISO 14001", /\biso\s*14001\b/i], ["BSCI", /\bbsci\b/i],
  ["SEDEX", /\bsedex\b/i], ["SMETA", /\bsmeta\b/i], ["LWG", /\blwg\b/i], ["REACH", /\breach\b/i],
  ["RoHS", /\brohs\b/i], ["OEKO-TEX", /\boeko[\s-]?tex\b/i], ["GRS", /\bgrs\b/i],
  ["GOTS", /\bgots\b/i], ["FSC", /\bfsc\b/i], ["WRAP", /\bwrap\b/i]
];

const PRODUCT_TERMS = [
  ["premium full-grain leather shoe upper", "Premium full-grain leather shoe upper"],
  ["full-grain leather shoe upper", "Full-grain leather shoe upper"],
  ["full grain leather shoe upper", "Full-grain leather shoe upper"],
  ["leather shoe upper", "Leather shoe upper"], ["shoe upper leather", "Leather shoe upper"],
  ["upper leather", "Upper leather"], ["genuine leather", "Genuine leather"],
  ["cow leather", "Cow leather"], ["cowhide", "Cowhide leather"],
  ["microfiber leather", "Microfiber leather"], ["synthetic leather", "Synthetic leather"],
  ["pu leather", "PU leather"], ["rubber", "Rubber"], ["eva", "EVA"], ["tpr", "TPR"],
  ["textile", "Textile"], ["fabric", "Fabric"], ["sneaker", "Sneaker"],
  ["footwear", "Footwear"], ["shoe", "Shoe"], ["鞋面革", "Upper leather"], ["皮革", "Leather"],
  ["鞋面", "Shoe upper"], ["鞋", "Footwear"]
];

const DESTINATION_RULES = [
  ["united states", "United States"], ["u.s.a.", "United States"], ["u.s.a", "United States"],
  ["usa", "United States"], ["america", "United States"], ["美国", "United States"],
  ["united kingdom", "United Kingdom"], ["uk", "United Kingdom"], ["英国", "United Kingdom"],
  ["canada", "Canada"], ["加拿大", "Canada"], ["australia", "Australia"], ["澳大利亚", "Australia"],
  ["germany", "Germany"], ["德国", "Germany"], ["france", "France"], ["法国", "France"],
  ["italy", "Italy"], ["意大利", "Italy"], ["spain", "Spain"], ["西班牙", "Spain"],
  ["japan", "Japan"], ["日本", "Japan"], ["south korea", "South Korea"], ["韩国", "South Korea"],
  ["singapore", "Singapore"], ["新加坡", "Singapore"], ["india", "India"], ["印度", "India"],
  ["vietnam", "Vietnam"], ["越南", "Vietnam"], ["indonesia", "Indonesia"], ["印度尼西亚", "Indonesia"],
  ["thailand", "Thailand"], ["泰国", "Thailand"], ["turkey", "Turkey"], ["土耳其", "Turkey"],
  ["mexico", "Mexico"], ["墨西哥", "Mexico"], ["brazil", "Brazil"], ["巴西", "Brazil"]
];

const LOCATION_RULES = [
  ["Guangzhou, China", ["guangzhou"]], ["Dongguan, China", ["dongguan"]],
  ["Foshan, China", ["foshan"]], ["Shenzhen, China", ["shenzhen"]],
  ["Quanzhou, China", ["quanzhou"]], ["Jinjiang, China", ["jinjiang"]],
  ["Wenzhou, China", ["wenzhou"]], ["Putian, China", ["putian"]],
  ["Chengdu, China", ["chengdu"]], ["Yiwu, China", ["yiwu"]],
  ["Guangdong, China", ["guangdong"]], ["Zhejiang, China", ["zhejiang"]],
  ["Fujian, China", ["fujian"]], ["Jiangsu, China", ["jiangsu"]],
  ["Sichuan, China", ["sichuan"]], ["Hebei, China", ["hebei"]],
  ["China", ["china", "chinese"]], ["India", ["india"]], ["Vietnam", ["vietnam"]],
  ["Indonesia", ["indonesia"]], ["Thailand", ["thailand"]], ["Bangladesh", ["bangladesh"]],
  ["Pakistan", ["pakistan"]], ["Turkey", ["turkey"]], ["Italy", ["italy"]],
  ["Spain", ["spain"]], ["Portugal", ["portugal"]], ["Germany", ["germany"]],
  ["France", ["france"]], ["Japan", ["japan"]], ["South Korea", ["south korea", "korea"]],
  ["Mexico", ["mexico"]], ["Brazil", ["brazil"]]
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return jsonResponse({
        ok: true,
        service: "CASEVO AI Sourcing",
        version: VERSION,
        engine: "CASEVO Real Supplier Discovery + Human Verification + Company Identity Lock",
        searchProvider: "Tavily",
        apiKeyConfigured: Boolean(env.TAVILY_API_KEY),
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/sourcing") {
      if (request.method !== "POST") {
        return jsonResponse({ ok: false, error: "Method not allowed. Use POST /api/sourcing." }, 405);
      }
      return handleSourcingRequest(request, env);
    }

    if (url.pathname === "/api/verify-supplier") {
      if (request.method !== "POST") {
        return jsonResponse({ ok: false, error: "Method not allowed. Use POST /api/verify-supplier." }, 405);
      }
      return handleSupplierVerification(request, env);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);

    return new Response("CASEVO Worker is running.", {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "text/plain; charset=utf-8" }
    });
  }
};

async function handleSourcingRequest(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ ok: false, error: "Invalid JSON request body." }, 400); }

  const requirement = clean(body?.requirement ?? body?.requirements ?? body?.brief);
  const productInput = clean(body?.product ?? body?.product_material ?? body?.productMaterial);
  const quantityInput = clean(body?.quantity);
  const targetPriceInput = clean(body?.targetPrice ?? body?.target_price ?? body?.price);
  const destinationInput = clean(body?.destination);

  if (!requirement && !productInput) {
    return jsonResponse({ ok: false, error: "Please enter a sourcing requirement." }, 400);
  }

  const combined = clean([requirement, productInput, quantityInput, targetPriceInput, destinationInput].filter(Boolean).join(" "));
  const normalized = normalizeRequirement({ requirement, productInput, quantityInput, targetPriceInput, destinationInput, combined });
  const scoring = calculateReadiness(normalized);

  if (!env.TAVILY_API_KEY) {
    return jsonResponse({ ok: false, error: "TAVILY_API_KEY is not configured in Cloudflare Worker secrets." }, 500);
  }

  try {
    const search = await searchSuppliersWithTavily(normalized, env.TAVILY_API_KEY);
    const matches = normalizeSupplierResults(search.results, normalized);
    const brief = {
      product: normalized.product || "Sourcing requirement",
      quantity: normalized.quantity || null,
      targetPrice: normalized.targetPrice || null,
      destination: normalized.destination || null,
      requirement: normalized.requirement || combined
    };

    return jsonResponse({
      ok: true,
      requestId: createRequestId(),
      message: "CASEVO supplier discovery completed successfully.",
      brief,
      analysis: { normalized, scoring, matches },
      matches,
      meta: {
        source: "CASEVO AI Sourcing Engine",
        engine: "CASEVO Real Supplier Discovery",
        supplierData: "Public web search",
        verified: false,
        verificationNote: "Public-web candidates are not verified suppliers. Company identity, manufacturing capability, certifications, MOQ, production capacity and commercial contacts must be independently verified before placing an order.",
        searchQueries: search.searchQueries,
        resultsScanned: search.resultsScanned,
        domainsScanned: search.results.length,
        suppliersReturned: matches.length,
        creditsUsed: search.creditsUsed,
        strictCompanyFilter: true,
        companyIdentityLock: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("CASEVO sourcing error:", error);
    return jsonResponse({ ok: false, error: "Supplier web search failed.", details: clean(error?.message || "Unknown search error.") }, 502);
  }
}

async function handleSupplierVerification(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ ok: false, error: "Invalid JSON request body." }, 400); }

  if (!env.TAVILY_API_KEY) {
    return jsonResponse({ ok: false, error: "TAVILY_API_KEY is not configured in Cloudflare Worker secrets." }, 500);
  }

  const supplier = body?.supplier || {};
  const suppliedName = clean(supplier.name ?? supplier.companyName ?? body?.name);
  const name = suppliedName === UNKNOWN_COMPANY ? "" : cleanCompanyCandidate(suppliedName);
  const website = normalizeUrl(supplier.website ?? body?.website);
  const sourceUrl = normalizeUrl(supplier.sourceUrl ?? body?.sourceUrl);
  const domain = clean(supplier.domain) || getDomain(website || sourceUrl);
  const product = clean(body?.product ?? body?.requirement ?? body?.brief ?? "");

  if (!name && !domain && !website) {
    return jsonResponse({ ok: false, error: "A supplier name or website is required for verification." }, 400);
  }

  try {
    const queries = buildVerificationQueries({ name, domain, product });
    const responses = await Promise.allSettled(
      queries.map(query => tavilySearch(query, env.TAVILY_API_KEY))
    );

    const successful = responses.filter(item => item.status === "fulfilled");

    if (!successful.length) {
      const failure = responses.find(item => item.status === "rejected");
      throw new Error(
        failure?.reason?.message ||
        "Supplier verification searches failed."
      );
    }
