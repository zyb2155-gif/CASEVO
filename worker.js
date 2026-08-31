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
    const rawResults = successful.flatMap(item =>
      (item.value?.results || []).map(result => ({
        ...result,
        _query: item.value._query
      }))
    );

    const results = deduplicateVerificationResults(rawResults);
    const evidence = buildVerificationEvidence(results, {
      name,
      domain,
      website,
      product
    });

    return jsonResponse({
      ok: true,
      requestId: createRequestId(),
      message: "CASEVO supplier verification research completed.",

      supplier: {
        name: evidence.companyName,
        companyName: evidence.companyName,
        companyIdentityConfirmed:
          evidence.companyName !== UNKNOWN_COMPANY,

        website:
          website ||
          (domain ? `https://${domain}` : ""),

        domain:
          domain ||
          evidence.domain ||
          "",

        location: evidence.location,
        contactEmail: evidence.email,
        contactPhone: evidence.phone,
        supplierType: evidence.supplierType,
        certifications: evidence.certifications,
        moq: evidence.moq,
        exportCapability: evidence.exportCapability,
        manufacturingCapability:
          evidence.manufacturingCapability,
        oemOdm: evidence.oemOdm
      },

      verification: {
        score: evidence.score,
        status: evidence.status,

        companyIdentity:
          evidence.companyIdentity,

        companyName:
          evidence.companyName,

        officialWebsite:
          evidence.officialWebsite,

        manufacturingCapability:
          evidence.manufacturingCapability,

        oemOdm:
          evidence.oemOdm,

        moq:
          evidence.moq ||
          "Not confirmed",

        certifications:
          evidence.certifications.length
            ? evidence.certifications
            : ["Not confirmed"],

        exportCapability:
          evidence.exportCapability,

        contact:
          evidence.email || evidence.phone
            ? "Public contact evidence found"
            : "Not confirmed",

        location:
          evidence.location,

        signals:
          evidence.signals,

        summary:
          evidence.summary
      },

      evidence:
        evidence.items,

      meta: {
        source:
          "CASEVO Human Verification Engine",

        publicWebOnly:
          true,

        verified:
          false,

        companyIdentityLock:
          true,

        disclaimer:
          "This is public-web verification research, not final commercial or legal verification. Company identity, bank details, certifications, production capability, samples, MOQ and commercial terms should be independently confirmed before placing an order.",

        searchQueries:
          queries,

        resultsScanned:
          results.length,

        timestamp:
          new Date().toISOString()
      }
    });

  } catch (error) {

    console.error(
      "CASEVO verification error:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Supplier verification research failed.",
        details:
          clean(
            error?.message ||
            "Unknown verification error."
          )
      },
      502
    );
  }
}


/* =========================================================
   SUPPLIER VERIFICATION SEARCH
   ========================================================= */

function buildVerificationQueries({
  name,
  domain,
  product
}) {

  const identity =
    clean(
      name ||
      domain ||
      "supplier"
    ).slice(0, 160);

  const productText =
    clean(product).slice(0, 120);

  const domainHint =
    domain
      ? ` site:${domain}`
      : "";

  return unique([
    `"${identity}" official company about factory contact${domainHint}`,

    `"${identity}" manufacturer OEM ODM factory certification MOQ${domainHint}`,

    `"${identity}" export contact email phone address${domainHint}`,

    productText
      ? `"${identity}" "${productText}" manufacturer factory${domainHint}`
      : ""
  ])
    .filter(Boolean)
    .slice(0, 4)
    .map(query =>
      query.slice(
        0,
        MAX_QUERY_LENGTH
      )
    );
}


function deduplicateVerificationResults(results) {

  const seen =
    new Set();

  const output =
    [];

  for (const result of results) {

    const url =
      normalizeUrl(
        result?.url
      );

    if (
      !url ||
      seen.has(url)
    ) {
      continue;
    }

    const domain =
      getDomain(url);

    if (
      !domain ||
      isExcludedDomain(domain)
    ) {
      continue;
    }

    seen.add(url);

    output.push({
      ...result,
      url
    });
  }

  return output.slice(
    0,
    20
  );
}


/* =========================================================
   HUMAN VERIFICATION EVIDENCE ENGINE
   ========================================================= */

function buildVerificationEvidence(
  results,
  target
) {

  const targetDomain =
    clean(
      target.domain ||
      getDomain(
        target.website
      )
    );

  const targetName =
    clean(
      target.name
    ).toLowerCase();


  const related =
    results.filter(result => {

      const domain =
        getDomain(
          result.url
        );

      const text =
        `${clean(result.title)} ${clean(
          result.content ||
          result.raw_content ||
          ""
        )}`.toLowerCase();

      return (
        (
          targetDomain &&
          domain === targetDomain
        ) ||
        (
          targetName &&
          text.includes(
            targetName
          )
        )
      );
    });


  const pool =
    related.length
      ? related
      : results;


  const combined =
    sanitizeWebText(
      pool
        .map(result =>
          `${result.title || ""}. ${result.content || ""} ${result.raw_content || ""}`
        )
        .join(" ")
    );


  const lower =
    combined.toLowerCase();


  /* -------------------------------------------------------
     v4.1.1 COMPANY IDENTITY LOCK
     ------------------------------------------------------- */

  const legalName =
    extractLegalCompanyName(
      combined
    );

  const contentName =
    extractCompanyNameFromContent(
      combined
    );

  const domainBrand =
    companyNameFromDomain(
      targetDomain
    );

  const targetCandidate =
    cleanCompanyCandidate(
      target.name
    );


  const companyName =
    firstConfirmedCompanyName(
      [
        legalName,
        contentName,
        targetCandidate,
        domainBrand
      ],
      {
        content:
          combined,
        domain:
          targetDomain
      }
    );


  const location =
    inferLocation({
      title:
        companyName,
      content:
        combined,
      url:
        target.website ||
        pool[0]?.url ||
        ""
    });


  const certifications =
    extractCertifications({
      title:
        companyName,
      content:
        combined,
      raw_content:
        ""
    });


  const moq =
    extractMOQ({
      content:
        combined,
      raw_content:
        ""
    });


  const email =
    extractEmail(
      combined
    );


  const phone =
    extractPhone(
      combined
    );


  const manufacturingCount =
    countSignals(
      lower,
      MANUFACTURER_SIGNALS
    );


  const companyCount =
    countSignals(
      lower,
      COMPANY_SIGNALS
    );


  const oemOdmFound =
    /\boem\b|\bodm\b|private label/i.test(
      combined
    );


  const exportFound =
    /exporter|exporting|export market|overseas market|international market/i.test(
      combined
    );


  const domainMatchCount =
    targetDomain
      ? pool.filter(
          result =>
            getDomain(
              result.url
            ) === targetDomain
        ).length
      : 0;


  const independentPages =
    new Set(
      pool
        .map(result =>
          getDomain(
            result.url
          )
        )
        .filter(Boolean)
    ).size;


  /* -------------------------------------------------------
     VERIFICATION SCORE
     ------------------------------------------------------- */

  let score = 0;

  const signals = [];


  if (
    companyName !==
    UNKNOWN_COMPANY
  ) {

    score +=
      legalName
        ? 18
        : 12;

    signals.push(
      legalName
        ? "Legal company-name signal"
        : "Company identity signal"
    );
  }


  if (
    targetDomain &&
    domainMatchCount >= 1
  ) {

    score += 15;

    signals.push(
      "Official-domain evidence"
    );
  }


  if (
    manufacturingCount >= 1
  ) {

    score += 20;

    signals.push(
      "Manufacturing evidence"
    );
  }


  if (
    oemOdmFound
  ) {

    score += 10;

    signals.push(
      "OEM / ODM evidence"
    );
  }


  if (
    exportFound
  ) {

    score += 8;

    signals.push(
      "Export capability evidence"
    );
  }


  if (
    certifications.length
  ) {

    score += 10;

    signals.push(
      "Certification evidence"
    );
  }


  if (
    moq
  ) {

    score += 5;

    signals.push(
      "MOQ evidence"
    );
  }


  if (
    email
  ) {

    score += 5;

    signals.push(
      "Email evidence"
    );
  }


  if (
    phone
  ) {

    score += 4;

    signals.push(
      "Phone evidence"
    );
  }


  if (
    location !==
    "Not determined"
  ) {

    score += 3;

    signals.push(
      "Location evidence"
    );
  }


  if (
    companyCount >= 1
  ) {
    score += 2;
  }


  if (
    independentPages >= 2
  ) {

    score += 5;

    signals.push(
      "Multiple public-web sources"
    );
  }


  score =
    Math.min(
      100,
      score
    );


  /* -------------------------------------------------------
     STATUS
     ------------------------------------------------------- */

  let status =
    "Insufficient public-web evidence — manual review required";


  if (
    score >= 80
  ) {

    status =
      "Strong public-web signals — final commercial verification required";

  } else if (
    score >= 60
  ) {

    status =
      "Moderate public-web signals — further verification required";
  }


  /* -------------------------------------------------------
     IDENTITY / WEBSITE CONFIDENCE
     ------------------------------------------------------- */

  const companyIdentity =
    companyName !==
    UNKNOWN_COMPANY
      ? (
          legalName
            ? "Strong evidence"
            : "Partial evidence"
        )
      : "Not confirmed";


  const officialWebsite =
    targetDomain &&
    domainMatchCount >= 1
      ? "Public-web evidence found"
      : target.website
        ? "Provided website — not independently confirmed"
        : "Not confirmed";


  const manufacturingCapability =
    manufacturingCount >= 2
      ? "Strong evidence"
      : manufacturingCount === 1
        ? "Evidence found"
        : "Not confirmed";


  const oemOdm =
    oemOdmFound
      ? "Evidence found"
      : "Not confirmed";


  const exportCapability =
    exportFound
      ? "Evidence found"
      : "Not confirmed";


  const supplierType =
    detectSupplierType({
      title:
        companyName,
      content:
        combined
    });


  /* -------------------------------------------------------
     PUBLIC-WEB EVIDENCE ITEMS
     ------------------------------------------------------- */

  const items =
    pool
      .slice(0, 8)
      .map(item => ({
        title:
          truncate(
            sanitizeWebText(
              item.title
            ),
            140
          ),

        url:
          normalizeUrl(
            item.url
          ),

        domain:
          getDomain(
            item.url
          ),

        evidence:
          truncate(
            extractRelevantEvidence(
              `${item.title || ""}. ${item.content || ""} ${item.raw_content || ""}`,
              target.product ||
              companyName
            ),
            320
          )
      }));


  const summaryParts = [

    companyIdentity !==
    "Not confirmed"
      ? `Company identity signal found: ${companyName}.`
      : "Company identity could not be confirmed from the retrieved public-web evidence.",

    manufacturingCapability !==
    "Not confirmed"
      ? "Manufacturing capability evidence was found."
      : "Manufacturing capability was not confirmed.",

    oemOdmFound
      ? "OEM/ODM capability is referenced publicly."
      : "OEM/ODM capability was not confirmed.",

    certifications.length
      ? `Public references mention ${certifications.join(", ")}.`
      : "No certification was confirmed from the retrieved evidence."
  ];


  return {
    score,
    status,
    signals:
      unique(signals),

    companyName,
    domain:
      targetDomain,

    location,
    email,
    phone,
    certifications,
    moq,

    companyIdentity,
    officialWebsite,
    manufacturingCapability,
    oemOdm,
    exportCapability,
    supplierType,

    summary:
      summaryParts.join(" "),

    items
  };
}


/* =========================================================
   SUPPLIER DISCOVERY
   ========================================================= */

async function searchSuppliersWithTavily(
  analysis,
  apiKey
) {

  const product =
    analysis.product ||
    analysis.requirement ||
    "supplier";


  const queries =
    buildSearchQueries(
      product,
      analysis.destination
    );


  const responses =
    await Promise.allSettled(
      queries.map(query =>
        tavilySearch(
          query,
          apiKey
        )
      )
    );


  const successes =
    responses.filter(
      item =>
        item.status ===
        "fulfilled"
    );


  if (
    !successes.length
  ) {

    const firstFailure =
      responses.find(
        item =>
          item.status ===
          "rejected"
      );

    throw new Error(
      firstFailure?.reason?.message ||
      "All supplier searches failed."
    );
  }


  const allResults = [];


  for (
    const item of successes
  ) {

    const data =
      item.value;

    const results =
      Array.isArray(
        data?.results
      )
        ? data.results
        : [];


    for (
      const result of results
    ) {

      if (
        result?.url
      ) {

        allResults.push({
          ...result,
          _searchQuery:
            data._query
        });
      }
    }
  }


  return {
    results:
      deduplicateResults(
        allResults
      ),

    searchQueries:
      queries,

    resultsScanned:
      allResults.length,

    creditsUsed:
      successes.reduce(
        (total, item) =>
          total +
          Number(
            item.value?.usage?.credits ||
            0
          ),
        0
      )
  };
}


function buildSearchQueries(
  product,
  destination
) {

  const p =
    clean(product)
      .slice(
        0,
        180
      );


  const destinationPart =
    destination
      ? ` export "${destination}"`
      : " exporter";


  return unique([
    `"${p}" manufacturer factory company official website`,

    `"${p}" OEM ODM manufacturer company factory`,

    `"${p}" manufacturer private label${destinationPart}`,

    `"${p}" factory company contact about us`
  ])
    .slice(
      0,
      MAX_SEARCH_QUERIES
    )
    .map(query =>
      query.slice(
        0,
        MAX_QUERY_LENGTH
      )
    );
}


/* =========================================================
   TAVILY SEARCH
   ========================================================= */

async function tavilySearch(
  query,
  apiKey
) {

  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      SEARCH_TIMEOUT_MS
    );


  try {

    const response =
      await fetch(
        TAVILY_ENDPOINT,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${apiKey}`
          },

          body:
            JSON.stringify({
              query:
                clean(query)
                  .slice(
                    0,
                    MAX_QUERY_LENGTH
                  ),

              topic:
                "general",

              search_depth:
                "basic",

              max_results:
                RESULTS_PER_QUERY,

              include_answer:
                false,

              include_raw_content:
                true,

              include_images:
                false,

              exclude_domains:
                EXCLUDED_DOMAINS
            }),

          signal:
            controller.signal
        }
      );


    const data =
      await safeJson(
        response
      );


    if (
      !response.ok
    ) {

      throw new Error(
        data?.detail ||
        data?.error ||
        `Tavily API returned HTTP ${response.status}`
      );
    }


    return {
      ...data,
      _query:
        query
    };


  } catch (
    error
  ) {

    if (
      error?.name ===
      "AbortError"
    ) {

      throw new Error(
        "Supplier search timed out."
      );
    }

    throw error;

  } finally {

    clearTimeout(
      timeout
    );
  }
}


/* =========================================================
   DOMAIN DEDUPLICATION
   ========================================================= */

function deduplicateResults(
  results
) {

  const byDomain =
    new Map();


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


    if (
      !url ||
      !domain ||
      isExcludedDomain(
        domain
      )
    ) {
      continue;
    }


    const candidate = {
      ...result,
      url
    };


    const previous =
      byDomain.get(
        domain
      );


    if (
      !previous ||
      rawSearchQuality(
        candidate
      ) >
      rawSearchQuality(
        previous
      )
    ) {

      byDomain.set(
        domain,
        candidate
      );
    }
  }


  return Array.from(
    byDomain.values()
  );
}


function normalizeSupplierResults(
  results,
  analysis
) {

  const candidates = [];
    for (const result of results) {

    const evaluated =
      evaluateSupplierCandidate(
        result,
        analysis
      );

    if (
      !evaluated.accepted
    ) {
      continue;
    }

    candidates.push(
      evaluated.supplier
    );
  }


  candidates.sort(
    (a, b) =>
      b.matchScore -
      a.matchScore
  );


  return candidates.slice(
    0,
    MAX_SUPPLIERS
  );
}


/* =========================================================
   STRICT SUPPLIER CANDIDATE FILTER
   ========================================================= */

function evaluateSupplierCandidate(
  result,
  analysis
) {

  const title =
    clean(
      result?.title
    );


  const content =
    sanitizeWebText(
      result?.content ||
      result?.raw_content ||
      ""
    );


  const url =
    normalizeUrl(
      result?.url
    );


  const domain =
    getDomain(
      url
    );


  if (
    !url ||
    !domain
  ) {

    return {
      accepted:
        false,
      reason:
        "Missing URL or domain"
    };
  }


  if (
    isExcludedDomain(
      domain
    )
  ) {

    return {
      accepted:
        false,
      reason:
        "Excluded domain"
    };
  }


  if (
    isLowValuePath(
      url
    )
  ) {

    return {
      accepted:
        false,
      reason:
        "Low-value content path"
    };
  }


  const combined =
    `${title}. ${content}`;


  const lower =
    combined.toLowerCase();


  if (
    isLowValueTitle(
      title
    )
  ) {

    return {
      accepted:
        false,
      reason:
        "Low-value title"
    };
  }


  const manufacturingCount =
    countSignals(
      lower,
      MANUFACTURER_SIGNALS
    );


  const commercialCount =
    countSignals(
      lower,
      COMMERCIAL_SIGNALS
    );


  const companyCount =
    countSignals(
      lower,
      COMPANY_SIGNALS
    );


  const chinaCount =
    countSignals(
      lower,
      CHINA_SIGNALS
    );


  const productRelevance =
    calculateProductRelevance(
      combined,
      analysis.product ||
      analysis.requirement
    );


  const identity =
    resolveCompanyIdentity(
      {
        title,
        content,
        url
      },
      domain
    );


  /*
   * Strict company gate:
   * Candidate must look like an actual manufacturing business.
   * Identity itself may remain unconfirmed; the domain is still useful
   * as a candidate website and verification target.
   */

  if (
    manufacturingCount < 1
  ) {

    return {
      accepted:
        false,
      reason:
        "No manufacturing signal"
    };
  }


  if (
    productRelevance < 1
  ) {

    return {
      accepted:
        false,
      reason:
        "Insufficient product relevance"
    };
  }


  if (
    companyCount < 1 &&
    commercialCount < 1 &&
    identity.confidence < 2
  ) {

    return {
      accepted:
        false,
      reason:
        "Insufficient company evidence"
    };
  }


  const evidenceCategoryCount =
    [
      manufacturingCount > 0,
      commercialCount > 0,
      companyCount > 0,
      productRelevance > 0,
      chinaCount > 0,
      identity.confidence >= 2
    ].filter(Boolean).length;


  if (
    evidenceCategoryCount < 3
  ) {

    return {
      accepted:
        false,
      reason:
        "Insufficient evidence categories"
    };
  }


  const location =
    inferLocation({
      title,
      content,
      url
    });


  const certifications =
    extractCertifications({
      title,
      content,
      raw_content:
        result?.raw_content ||
        ""
    });


  const moq =
    extractMOQ({
      content,
      raw_content:
        result?.raw_content ||
        ""
    });


  const contactEmail =
    extractEmail(
      `${content} ${result?.raw_content || ""}`
    );


  const contactPhone =
    extractPhone(
      `${content} ${result?.raw_content || ""}`
    );


  const supplierType =
    detectSupplierType({
      title,
      content
    });


  const evidence =
    extractRelevantEvidence(
      combined,
      analysis.product ||
      analysis.requirement
    );


  const matchScore =
    calculateSupplierMatchScore({
      manufacturingCount,
      commercialCount,
      companyCount,
      chinaCount,
      productRelevance,
      identityConfidence:
        identity.confidence,
      certifications,
      moq,
      location,
      destination:
        analysis.destination
    });


  const strengths = [];


  if (
    manufacturingCount >= 2
  ) {

    strengths.push(
      "Strong manufacturing signals"
    );

  } else {

    strengths.push(
      "Manufacturing signal found"
    );
  }


  if (
    commercialCount >= 2
  ) {

    strengths.push(
      "OEM / ODM / commercial capability signals"
    );
  }


  if (
    identity.confidence >= 3
  ) {

    strengths.push(
      "Strong company identity signal"
    );

  } else if (
    identity.confidence >= 2
  ) {

    strengths.push(
      "Company identity signal found"
    );

  } else {

    strengths.push(
      "Company identity requires verification"
    );
  }


  if (
    certifications.length
  ) {

    strengths.push(
      `Certification references: ${certifications.join(", ")}`
    );
  }


  if (
    chinaCount > 0
  ) {

    strengths.push(
      "China manufacturing/location signal"
    );
  }


  return {
    accepted:
      true,

    supplier: {
      name:
        identity.name,

      companyName:
        identity.name,

      companyIdentity:
        identity.status,

      identitySource:
        identity.source,

      identityConfidence:
        identity.confidence,

      website:
        `https://${domain}`,

      sourceUrl:
        url,

      domain,

      title:
        truncate(
          title,
          160
        ),

      location,

      supplierType,

      certifications,

      moq,

      contactEmail,

      contactPhone,

      matchScore,

      score:
        matchScore,

      evidence:
        truncate(
          evidence,
          MAX_EVIDENCE_LENGTH
        ),

      strengths:
        unique(
          strengths
        ).slice(
          0,
          5
        ),

      source:
        "Public web",

      verified:
        false,

      verificationStatus:
        "Requires verification"
    }
  };
}


/* =========================================================
   v4.1.1 — COMPANY IDENTITY LOCK
   ========================================================= */

/*
 * Identity priority:
 *
 * 1. Legal company name
 * 2. Explicit company-name phrase
 * 3. Strong brand/domain match
 * 4. Company identity not confirmed
 *
 * Page titles, CTAs, category labels and generic manufacturer
 * descriptions are NEVER accepted simply because they are titles.
 */

function resolveCompanyIdentity(
  result,
  domain
) {

  const title =
    sanitizeWebText(
      result?.title
    );


  const content =
    sanitizeWebText(
      result?.content
    );


  const combined =
    `${title}. ${content}`;


  const legal =
    extractLegalCompanyName(
      combined
    );


  if (
    legal &&
    !isBadCompanyNameCandidate(
      legal
    )
  ) {

    return {
      name:
        legal,
      source:
        "legal_name",
      confidence:
        4,
      status:
        "Confirmed public-web identity signal"
    };
  }


  const explicit =
    extractCompanyNameFromContent(
      combined
    );


  if (
    explicit &&
    !isBadCompanyNameCandidate(
      explicit
    )
  ) {

    return {
      name:
        explicit,
      source:
        "explicit_company_phrase",
      confidence:
        3,
      status:
        "Confirmed public-web identity signal"
    };
  }


  const brand =
    companyNameFromDomain(
      domain
    );


  if (
    brand &&
    domainBrandAppearsInText(
      domain,
      combined
    ) &&
    !isBadCompanyNameCandidate(
      brand
    )
  ) {

    return {
      name:
        brand,
      source:
        "domain_brand",
      confidence:
        2,
      status:
        "Partial identity evidence"
    };
  }


  return {
    name:
      UNKNOWN_COMPANY,
    source:
      "unconfirmed",
    confidence:
      0,
    status:
      "Not confirmed"
  };
}


function firstConfirmedCompanyName(
  candidates,
  context = {}
) {

  for (
    const rawCandidate of candidates
  ) {

    const candidate =
      cleanCompanyCandidate(
        rawCandidate
      );


    if (
      !candidate ||
      isBadCompanyNameCandidate(
        candidate
      )
    ) {
      continue;
    }


    /*
     * Legal-suffix names are strongest.
     */

    if (
      COMPANY_SUFFIX_RE.test(
        candidate
      )
    ) {

      return candidate;
    }


    /*
     * Non-legal names require evidence that the name appears
     * naturally in the retrieved company text.
     */

    if (
      companyCandidateAppearsInText(
        candidate,
        context.content
      )
    ) {

      return candidate;
    }


    /*
     * Domain-derived brand names require explicit domain/text match.
     */

    if (
      context.domain &&
      normalizeBrandToken(
        candidate
      ) ===
      normalizeBrandToken(
        companyNameFromDomain(
          context.domain
        )
      ) &&
      domainBrandAppearsInText(
        context.domain,
        context.content
      )
    ) {

      return candidate;
    }
  }


  return UNKNOWN_COMPANY;
}


/* =========================================================
   LEGAL COMPANY NAME EXTRACTION
   ========================================================= */

function extractLegalCompanyName(
  text
) {

  const value =
    sanitizeWebText(
      text
    );


  if (
    !value
  ) {
    return "";
  }


  /*
   * Limit the legal-name capture to a relatively short,
   * company-like phrase immediately before the legal suffix.
   *
   * This prevents:
   * "contact us to start your Leather Shoes business. Thanks ABC Co., Ltd."
   * from swallowing the preceding marketing sentence.
   */

  const patterns = [

    /\b([A-Z][A-Za-z0-9&'’.\-]*(?:\s+[A-Z][A-Za-z0-9&'’.\-]*){0,6}\s+(?:Co\.?\s*,?\s*Ltd\.?|Company\s+Limited|Limited|Ltd\.?|Inc\.?|Corporation|Corp\.?|LLC))\b/g,

    /\b([A-Z][A-Za-z0-9&'’.\-]*(?:\s+[A-Za-z0-9&'’.\-]+){0,5}\s+(?:Co\.?\s*,?\s*Ltd\.?|Company\s+Limited|Limited|Ltd\.?|Inc\.?|Corporation|Corp\.?|LLC))\b/g
  ];


  const candidates =
    [];


  for (
    const pattern of patterns
  ) {

    let match;


    while (
      (
        match =
          pattern.exec(
            value
          )
      ) !== null
    ) {

      const candidate =
        cleanCompanyCandidate(
          match[1]
        );


      if (
        candidate &&
        !isBadCompanyNameCandidate(
          candidate
        )
      ) {

        candidates.push(
          candidate
        );
      }


      if (
        candidates.length >= 12
      ) {
        break;
      }
    }
  }


  if (
    !candidates.length
  ) {
    return "";
  }


  /*
   * Prefer compact legal names.
   */

  candidates.sort(
    (a, b) => {

      const aw =
        a.split(/\s+/).length;

      const bw =
        b.split(/\s+/).length;


      if (
        aw !== bw
      ) {
        return aw - bw;
      }


      return a.length - b.length;
    }
  );


  return candidates[0];
}


/* =========================================================
   EXPLICIT COMPANY PHRASE EXTRACTION
   ========================================================= */

function extractCompanyNameFromContent(
  text
) {

  const value =
    sanitizeWebText(
      text
    );


  if (
    !value
  ) {
    return "";
  }


  const patterns = [

    /(?:company\s+name|manufacturer|manufactured\s+by|supplier)\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9&'’.\-\s]{1,75})/i,

    /\b([A-Z][A-Za-z0-9&'’.\-]*(?:\s+[A-Z][A-Za-z0-9&'’.\-]*){0,5})\s+is\s+(?:a|an)\s+(?:professional\s+|leading\s+|specialized\s+|specialist\s+|experienced\s+)?(?:manufacturer|factory|producer|supplier)\b/i,

    /\b([A-Z][A-Za-z0-9&'’.\-]*(?:\s+[A-Z][A-Za-z0-9&'’.\-]*){0,5})\s+(?:specializes|specialises)\s+in\b/i
  ];


  for (
    const pattern of patterns
  ) {

    const match =
      value.match(
        pattern
      );


    if (
      !match?.[1]
    ) {
      continue;
    }


    let candidate =
      cleanCompanyCandidate(
        match[1]
      );


    /*
     * A colon-based field may continue into unrelated text.
     * Cut at common field separators and sentence boundaries.
     */

    candidate =
      candidate
        .split(
          /\s{2,}|[|;；]/
        )[0]
        .trim();


    if (
      candidate &&
      !isBadCompanyNameCandidate(
        candidate
      )
    ) {

      return candidate;
    }
  }


  return "";
}


/* =========================================================
   COMPANY NAME CANDIDATE CLEANING
   ========================================================= */

function cleanCompanyCandidate(
  value
) {

  let name =
    sanitizeWebText(
      value
    );


  if (
    !name
  ) {
    return "";
  }


  name =
    name
      .replace(
        /^[\s|:：,\-–—]+/,
        ""
      )
      .replace(
        /[\s|:：,\-–—]+$/,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  /*
   * Remove common site-title suffixes.
   */

  name =
    name
      .replace(
        /\s+[|–—-]\s+(?:official\s+site|official\s+website|home|homepage|manufacturer|supplier|factory).*$/i,
        ""
      )
      .trim();


  return truncate(
    name,
    100
  );
}


/* =========================================================
   BAD COMPANY NAME DETECTOR
   ========================================================= */

function isBadCompanyNameCandidate(
  value
) {

  const name =
    clean(
      value
    );


  if (
    !name
  ) {
    return true;
  }


  const lower =
    name.toLowerCase();


  const normalized =
    lower
      .replace(
        /[^a-z0-9]+/g,
        ""
      );


  if (
    name.length < 2 ||
    name.length > 100
  ) {
    return true;
  }


  /*
   * Navigation / CTA / page labels.
   */

  const exactBlocked =
    new Set([
      "contact",
      "contact us",
      "uscontact",
      "about",
      "about us",
      "home",
      "homepage",
      "products",
      "product",
      "services",
      "service",
      "our factory",
      "our products",
      "our services",
      "request a quote",
      "get a quote",
      "get quote",
      "get in touch",
      "learn more",
      "read more",
      "thank you",
      "thanks",
      "supplier",
      "manufacturer",
      "factory",
      "company",
      "shoe manufacturer",
      "shoes manufacturer",
      "footwear manufacturer",
      "leather shoes manufacturer",
      "private label manufacturer",
      "private label shoes manufacturer",
      "private label manufacturers shoes leather goods",
      "custom mens formal leather shoes manufacturer"
    ]);


  if (
    exactBlocked.has(
      lower
    ) ||
    exactBlocked.has(
      normalized
    )
  ) {
    return true;
  }


  if (
    NON_IDENTITY_RE.test(
      name
    )
  ) {
    return true;
  }


  /*
   * Sentence-like candidates are page copy, not company identities.
   */

  if (
    /[!?]/.test(
      name
    )
  ) {
    return true;
  }


  if (
    /\b(?:we|our|your|you|start|request|choose|discover|explore|shop|buy|contact|thanks?|today|now)\b/i.test(
      name
    ) &&
    !COMPANY_SUFFIX_RE.test(
      name
    )
  ) {
    return true;
  }


  if (
    /^(?:our|contact|custom|private|premium|reliable|best|top|professional|leading)\b/i.test(
      name
    ) &&
    !COMPANY_SUFFIX_RE.test(
      name
    )
  ) {
    return true;
  }


  /*
   * Generic category/manufacturer phrases cannot become identity.
   */

  if (
    GENERIC_TITLE_TERMS.some(
      term =>
        lower === term ||
        lower.startsWith(
          `${term} `
        )
    ) &&
    !COMPANY_SUFFIX_RE.test(
      name
    )
  ) {
    return true;
  }


  const descriptorMatches =
    (
      lower.match(
        /\b(?:private|label|custom|premium|reliable|formal|casual|men'?s|women'?s|leather|shoe|shoes|footwear|goods?|manufacturer|supplier|factory|exporter|wholesale)\b/g
      ) ||
      []
    ).length;


  const words =
    name
      .split(/\s+/)
      .filter(Boolean);


  if (
    descriptorMatches >= 3 &&
    descriptorMatches >=
      Math.ceil(
        words.length * 0.6
      ) &&
    !COMPANY_SUFFIX_RE.test(
      name
    )
  ) {
    return true;
  }


  if (
    ROLE_END_RE.test(
      name
    ) &&
    DESCRIPTOR_RE.test(
      name
    ) &&
    !COMPANY_SUFFIX_RE.test(
      name
    )
  ) {
    return true;
  }


  /*
   * Long prose-like strings without a legal suffix are rejected.
   */

  if (
    words.length > 7 &&
    !COMPANY_SUFFIX_RE.test(
      name
    )
  ) {
    return true;
  }


  /*
   * Require at least one alphabetic character.
   */

  if (
    !/[a-z]/i.test(
      name
    )
  ) {
    return true;
  }


  return false;
}


/* =========================================================
   DOMAIN BRAND FALLBACK
   ========================================================= */

function companyNameFromDomain(
  domain
) {

  const cleanDomain =
    clean(
      domain
    )
      .toLowerCase()
      .replace(
        /^www\./,
        ""
      );


  if (
    !cleanDomain
  ) {
    return "";
  }


  const label =
    cleanDomain
      .split(".")[0]
      .replace(
        /[^a-z0-9-]/g,
        ""
      );


  if (
    !label ||
    label.length < 4 ||
    label.length > 35
  ) {
    return "";
  }


  const generic =
    new Set([
      "shoe",
      "shoes",
      "footwear",
      "leather",
      "factory",
      "manufacturer",
      "manufacturing",
      "supplier",
      "suppliers",
      "wholesale",
      "wholesaler",
      "export",
      "exporter",
      "company",
      "contact",
      "about",
      "products",
      "product",
      "services",
      "service",
      "official",
      "website",
      "shop",
      "store",
      "china",
      "global",
      "international",
      "private",
      "label",
      "custom"
    ]);


  const tokens =
    label
      .split("-")
      .filter(Boolean);


  if (
    !tokens.length
  ) {
    return "";
  }


  if (
    tokens.every(
      token =>
        generic.has(
          token
        )
    )
  ) {
    return "";
  }


  if (
    generic.has(
      label
    )
  ) {
    return "";
  }


  const brand =
    tokens
      .map(
        token =>
          token.charAt(0).toUpperCase() +
          token.slice(1)
      )
      .join(" ");


  if (
    isBadCompanyNameCandidate(
      brand
    )
  ) {
    return "";
  }


  return brand;
}


function domainBrandAppearsInText(
  domain,
  text
) {

  const brand =
    companyNameFromDomain(
      domain
    );


  if (
    !brand
  ) {
    return false;
  }


  const brandToken =
    normalizeBrandToken(
      brand
    );


  if (
    brandToken.length < 4
  ) {
    return false;
  }


  const textToken =
    normalizeBrandToken(
      text
    );


  return textToken.includes(
    brandToken
  );
}


function companyCandidateAppearsInText(
  candidate,
  text
) {

  const nameToken =
    normalizeBrandToken(
      candidate
    );


  const textToken =
    normalizeBrandToken(
      text
    );


  if (
    !nameToken ||
    nameToken.length < 4
  ) {
    return false;
  }


  return textToken.includes(
    nameToken
  );
}


function normalizeBrandToken(
  value
) {

  return clean(
    value
  )
    .toLowerCase()
    .replace(
      /\b(?:co|ltd|limited|company|inc|corporation|corp|llc)\b/g,
      ""
    )
    .replace(
      /[^a-z0-9]/g,
      ""
    );
}


/* =========================================================
   SUPPLIER MATCH SCORE
   ========================================================= */

function calculateSupplierMatchScore({
  manufacturingCount,
  commercialCount,
  companyCount,
  chinaCount,
  productRelevance,
  identityConfidence,
  certifications,
  moq,
  location
}) {

  let score =
    35;


  score +=
    Math.min(
      20,
      manufacturingCount * 7
    );


  score +=
    Math.min(
      12,
      commercialCount * 4
    );


  score +=
    Math.min(
      8,
      companyCount * 3
    );


  score +=
    Math.min(
      10,
      productRelevance * 3
    );


  score +=
    Math.min(
      8,
      identityConfidence * 2
    );


  if (
    chinaCount > 0
  ) {
    score += 3;
  }


  if (
    certifications?.length
  ) {
    score += 2;
  }


  if (
    moq
  ) {
    score += 1;
  }


  if (
    location &&
    location !==
    "Not determined"
  ) {
    score += 1;
  }


  return Math.min(
    98,
    Math.max(
      45,
      Math.round(
        score
      )
    )
  );
}


/* =========================================================
   RAW SEARCH QUALITY
   ========================================================= */

function rawSearchQuality(
  result
) {

  const title =
    clean(
      result?.title
    );


  const content =
    sanitizeWebText(
      result?.content ||
      result?.raw_content ||
      ""
    );


  const combined =
    `${title} ${content}`
      .toLowerCase();


  let score =
    Number(
      result?.score ||
      0
    ) * 10;


  score +=
    countSignals(
      combined,
      MANUFACTURER_SIGNALS
    ) * 4;


  score +=
    countSignals(
      combined,
      COMPANY_SIGNALS
    ) * 2;


  score +=
    countSignals(
      combined,
      COMMERCIAL_SIGNALS
    ) * 2;


  if (
    isLowValueTitle(
      title
    )
  ) {
    score -= 12;
  }


  if (
    isLowValuePath(
      result?.url
    )
  ) {
    score -= 12;
  }


  return score;
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

  const text =
    clean(
      combined ||
      requirement ||
      productInput
    );


  const lower =
    text.toLowerCase();


  const product =
    productInput ||
    detectProduct(
      text
    );


  const quantity =
    quantityInput ||
    detectQuantity(
      text
    );


  const targetPrice =
    targetPriceInput ||
    detectTargetPrice(
      text
    );


  const destination =
    destinationInput ||
    detectDestination(
      text
    );


  const thickness =
    detectThickness(
      text
    );


  const color =
    detectColor(
      text
    );


  const leatherGrade =
    detectLeatherGrade(
      text
    );


  const application =
    detectApplication(
      text
    );


  return {
    requirement:
      requirement ||
      text,

    product:
      product ||
      "Sourcing requirement",

    quantity:
      quantity ||
      "",

    targetPrice:
      targetPrice ||
      "",

    destination:
      destination ||
      "",

    thickness:
      thickness ||
      "",

    color:
      color ||
      "",

    leatherGrade:
      leatherGrade ||
      "",

    application:
      application ||
      "",

    keywords:
      unique(
        [
          product,
          thickness,
          color,
          leatherGrade,
          application,
          destination
        ]
          .filter(Boolean)
      ),

    raw:
      text,

    hasProduct:
      Boolean(product),

    hasQuantity:
      Boolean(quantity),

    hasTargetPrice:
      Boolean(targetPrice),

    hasDestination:
      Boolean(destination),

    hasSpecifications:
      Boolean(
        thickness ||
        color ||
        leatherGrade ||
        application
      ),

    lower
  };
}


function detectProduct(
  text
) {

  const lower =
    clean(
      text
    ).toLowerCase();


  for (
    const [
      term,
      label
    ] of PRODUCT_TERMS
  ) {

    if (
      lower.includes(
        term
      )
    ) {

      return label;
    }
  }


  /*
   * Fallback:
   * take a short phrase before common commercial details.
   */

  const firstPart =
    clean(
      text
    )
      .split(
        /(?:,|;|\b\d+(?:\.\d+)?\s*mm\b|\b\d[\d,]*\s*(?:pairs?|pcs?|pieces?|units?)\b)/i
      )[0]
      .trim();


  if (
    firstPart &&
    firstPart.length <= 120
  ) {

    return firstPart;
  }


  return "";
}


function detectQuantity(
  text
) {

  const value =
    clean(
      text
    );


  const patterns = [
    /\b(\d{1,3}(?:,\d{3})+|\d+)\s*(pairs?|pcs?|pieces?|units?|sets?|meters?|metres?|yards?|kg|kgs|kilograms?)\b/i,
    /\bquantity\s*[:：]?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\s*([A-Za-z]+))?/i,
    /\bqty\s*[:：]?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\s*([A-Za-z]+))?/i
  ];


  for (
    const pattern of patterns
  ) {

    const match =
      value.match(
        pattern
      );


    if (
      match
    ) {

      const number =
        match[1];


      const unit =
        match[2] ||
        "";


      return clean(
        `${number} ${unit}`
      );
    }
  }


  return "";
}


function detectTargetPrice(
  text
) {

  const value =
    clean(
      text
    );


  const patterns = [
    /(?:target\s*price|price\s*target|budget)\s*[:：]?\s*(?:usd|\$|us\$)?\s*(\d+(?:\.\d+)?)(?:\s*[-–]\s*(?:usd|\$|us\$)?\s*(\d+(?:\.\d+)?))?/i,
    /(?:usd|us\$|\$)\s*(\d+(?:\.\d+)?)(?:\s*[-–]\s*(?:usd|us\$|\$)?\s*(\d+(?:\.\d+)?))?\s*(?:\/\s*(?:pair|pc|piece|unit))?/i
  ];


  for (
    const pattern of patterns
  ) {

    const match =
      value.match(
        pattern
      );


    if (
      match
    ) {

      if (
        match[2]
      ) {

        return `$${match[1]}–$${match[2]}`;
      }


      return `$${match[1]}`;
    }
  }


  return "";
}


function detectDestination(
  text
) {

  const lower =
    clean(
      text
    ).toLowerCase();


  for (
    const [
      term,
      destination
    ] of DESTINATION_RULES
  ) {

    if (
      lower.includes(
        term
      )
    ) {

      return destination;
    }
  }


  return "";
}


function detectThickness(
  text
) {

  const match =
    clean(
      text
    ).match(
      /\b(\d+(?:\.\d+)?)\s*mm\b/i
    );


  return match
    ? `${match[1]}mm`
    : "";
}


function detectColor(
  text
) {

  const lower =
    clean(
      text
    ).toLowerCase();


  const colors = [
    ["black", "Black"],
    ["brown", "Brown"],
    ["dark brown", "Dark brown"],
    ["light brown", "Light brown"],
    ["white", "White"],
    ["red", "Red"],
    ["blue", "Blue"],
    ["navy", "Navy"],
    ["green", "Green"],
    ["grey", "Grey"],
    ["gray", "Gray"],
    ["beige", "Beige"],
    ["tan", "Tan"],
    ["camel", "Camel"],
    ["burgundy", "Burgundy"],
    ["wine", "Wine"],
    ["yellow", "Yellow"],
    ["orange", "Orange"],
    ["pink", "Pink"],
    ["purple", "Purple"]
  ];


  /*
   * Longer phrases first.
   */

  colors.sort(
    (a, b) =>
      b[0].length -
      a[0].length
  );


  for (
    const [
      term,
      label
    ] of colors
  ) {

    if (
      new RegExp(
        `\\b${escapeRegExp(term)}\\b`,
        "i"
      ).test(
        lower
      )
    ) {

      return label;
    }
  }


  return "";
}


function detectLeatherGrade(
  text
) {

  const lower =
    clean(
      text
    ).toLowerCase();


  const grades = [
    ["full-grain", "Full-grain"],
    ["full grain", "Full-grain"],
    ["top-grain", "Top-grain"],
    ["top grain", "Top-grain"],
    ["genuine leather", "Genuine leather"],
    ["split leather", "Split leather"],
    ["nubuck", "Nubuck"],
    ["suede", "Suede"],
    ["corrected grain", "Corrected-grain"]
  ];


  for (
    const [
      term,
      label
    ] of grades
  ) {

    if (
      lower.includes(
        term
      )
    ) {

      return label;
    }
  }


  return "";
}


function detectApplication(
  text
) {

  const lower =
    clean(
      text
    ).toLowerCase();


  if (
    /\bsneakers?\b/.test(
      lower
    )
  ) {

    return "Sneakers / footwear";
  }


  if (
    /\bshoe\s+upper\b|\bupper\s+leather\b/.test(
      lower
    )
  ) {

    return "Footwear / shoe upper";
  }


  if (
    /\bfootwear\b|\bshoes?\b/.test(
      lower
    )
  ) {

    return "Footwear";
  }


  if (
    /\bhandbags?\b|\bbags?\b/.test(
      lower
    )
  ) {

    return "Bags / leather goods";
  }


  if (
    /\bfurniture\b|\bupholstery\b/.test(
      lower
    )
  ) {

    return "Furniture / upholstery";
  }


  if (
    /\bautomotive\b|\bcar\s+seat\b/.test(
      lower
    )
  ) {

    return "Automotive";
  }


  return "";
}


/* =========================================================
   CASEVO READINESS SCORE
   ========================================================= */

function calculateReadiness(
  normalized
) {

  let requirementClarity =
    0;


  if (
    normalized.product
  ) {
    requirementClarity += 40;
  }


  if (
    normalized.quantity
  ) {
    requirementClarity += 25;
  }


  if (
    normalized.destination
  ) {
    requirementClarity += 20;
  }


  if (
    normalized.requirement &&
    normalized.requirement.length >= 25
  ) {
    requirementClarity += 15;
  }


  requirementClarity =
    Math.min(
      100,
      requirementClarity
    );


  let specificationQuality =
    30;


  if (
    normalized.thickness
  ) {
    specificationQuality += 20;
  }


  if (
    normalized.color
  ) {
    specificationQuality += 15;
  }


  if (
    normalized.leatherGrade
  ) {
    specificationQuality += 20;
  }


  if (
    normalized.application
  ) {
    specificationQuality += 15;
  }


  specificationQuality =
    Math.min(
      100,
      specificationQuality
    );


  let commercialReadiness =
    25;


  if (
    normalized.quantity
  ) {
    commercialReadiness += 25;
  }


  if (
    normalized.destination
  ) {
    commercialReadiness += 17;
  }


  if (
    normalized.targetPrice
  ) {
    commercialReadiness += 33;
  }


  commercialReadiness =
    Math.min(
      100,
      commercialReadiness
    );


  const readinessScore =
    Math.round(
      requirementClarity * 0.35 +
      specificationQuality * 0.35 +
      commercialReadiness * 0.30
    );


  return {
    readinessScore,
    casevoScore:
      readinessScore,

    requirementClarity,
    specificationQuality,
    commercialReadiness,

    label:
      readinessScore >= 85
        ? "Strong sourcing brief"
        : readinessScore >= 70
          ? "Good sourcing brief"
          : readinessScore >= 55
            ? "Usable sourcing brief"
            : "More sourcing details recommended"
  };
}


/* =========================================================
   PRODUCT RELEVANCE
   ========================================================= */

function calculateProductRelevance(
  text,
  product
) {

  const haystack =
    clean(
      text
    ).toLowerCase();


  const source =
    clean(
      product
    ).toLowerCase();


  if (
    !haystack ||
    !source
  ) {
    return 0;
  }


  const stopWords =
    new Set([
      "the",
      "and",
      "for",
      "with",
      "from",
      "this",
      "that",
      "manufacturer",
      "factory",
      "supplier",
      "company",
      "premium",
      "custom",
      "product",
      "products"
    ]);


  const tokens =
    unique(
      source
        .replace(
          /[^a-z0-9\s-]/g,
          " "
        )
        .split(
          /\s+/
        )
        .map(token =>
          token.trim()
        )
        .filter(token =>
          token.length >= 3 &&
          !stopWords.has(
            token
          )
        )
    );


  if (
    !tokens.length
  ) {
    return 0;
  }


  let count =
    0;


  for (
    const token of tokens
  ) {

    if (
      haystack.includes(
        token
      )
    ) {
      count += 1;
    }
  }


  return count;
}


/* =========================================================
   LOCATION
   ========================================================= */

function inferLocation(
  result
) {

  const text =
    clean(
      `${result?.title || ""} ${result?.content || ""} ${result?.url || ""}`
    ).toLowerCase();


  for (
    const [
      label,
      terms
    ] of LOCATION_RULES
  ) {

    if (
      terms.some(
        term =>
          text.includes(
            term
          )
      )
    ) {

      return label;
    }
  }


  return "Not determined";
}


/* =========================================================
   SUPPLIER TYPE
   ========================================================= */

function detectSupplierType(
  result
) {

  const text =
    clean(
      `${result?.title || ""} ${result?.content || ""}`
    ).toLowerCase();


  const hasManufacturer =
    countSignals(
      text,
      MANUFACTURER_SIGNALS
    ) > 0;


  const hasExporter =
    /\bexporter\b|\bexporting\b|\bexport\b/i.test(
      text
    );


  const hasTrading =
    /\btrading company\b|\btrader\b/i.test(
      text
    );


  if (
    hasManufacturer &&
    hasExporter
  ) {

    return "Manufacturer / Exporter";
  }


  if (
    hasManufacturer
  ) {

    return "Manufacturer";
  }


  if (
    hasTrading
  ) {

    return "Trading company";
  }


  if (
    hasExporter
  ) {

    return "Exporter";
  }


  return "Supplier candidate";
}


/* =========================================================
   CERTIFICATIONS
   ========================================================= */

function extractCertifications(
  result
) {

  const text =
    clean(
      `${result?.title || ""} ${result?.content || ""} ${result?.raw_content || ""}`
    );


  const certifications =
    [];


  for (
    const [
      label,
      pattern
    ] of CERTIFICATION_RULES
  ) {

    if (
      pattern.test(
        text
      )
    ) {

      certifications.push(
        label
      );
    }
  }


  return unique(
    certifications
  ).slice(
    0,
    8
  );
}


/* =========================================================
   MOQ
   ========================================================= */

function extractMOQ(
  result
) {

  const text =
    sanitizeWebText(
      `${result?.content || ""} ${result?.raw_content || ""}`
    );


  const patterns = [
    /\bmoq\s*[:：]?\s*(\d{1,3}(?:,\d{3})+|\d+)\s*(pairs?|pcs?|pieces?|units?|sets?|meters?|metres?|yards?|kg|kgs)?\b/i,

    /\bminimum\s+order(?:\s+quantity)?\s*[:：]?\s*(\d{1,3}(?:,\d{3})+|\d+)\s*(pairs?|pcs?|pieces?|units?|sets?|meters?|metres?|yards?|kg|kgs)?\b/i
  ];


  for (
    const pattern of patterns
  ) {

    const match =
      text.match(
        pattern
      );


    if (
      match
    ) {

      return clean(
        `${match[1]} ${match[2] || ""}`
      );
    }
  }


  return "";
}


/* =========================================================
   CONTACT EXTRACTION
   ========================================================= */

function extractEmail(
  text
) {

  const value =
    clean(
      text
    );


  const matches =
    value.match(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig
    );


  if (
    !matches?.length
  ) {
    return "";
  }


  const filtered =
    matches.filter(
      email =>
        !/\.(?:png|jpg|jpeg|gif|svg|webp)$/i.test(
          email
        )
    );


  return filtered[0] || "";
}


function extractPhone(
  text
) {

  const value =
    clean(
      text
    );


  const patterns = [
    /(?:tel|telephone|phone|mobile|whatsapp)\s*[:：]?\s*(\+?\d[\d\s().-]{6,20}\d)/i,
    /(\+86[\s-]?\d[\d\s-]{7,15}\d)/i
  ];


  for (
    const pattern of patterns
  ) {

    const match =
      value.match(
        pattern
      );


    if (
      match?.[1]
    ) {

      return clean(
        match[1]
      );
    }
  }


  return "";
}


/* =========================================================
   EVIDENCE EXTRACTION
   ========================================================= */

function extractRelevantEvidence(
  text,
  product
) {

  const value =
    sanitizeWebText(
      text
    );


  if (
    !value
  ) {
    return "";
  }


  const sentences =
    value
      .split(
        /(?<=[.!?])\s+/
      )
      .map(sentence =>
        clean(
          sentence
        )
      )
      .filter(Boolean);


  const productTokens =
    unique(
      clean(
        product
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9\s-]/g,
          " "
        )
        .split(
          /\s+/
        )
        .filter(token =>
          token.length >= 4
        )
    );


  const ranked =
    sentences
      .map(sentence => {

        const lower =
          sentence.toLowerCase();


        let score =
          0;


        score +=
          countSignals(
            lower,
            MANUFACTURER_SIGNALS
          ) * 3;


        score +=
          countSignals(
            lower,
            COMMERCIAL_SIGNALS
          ) * 2;


        score +=
          countSignals(
            lower,
            COMPANY_SIGNALS
          );


        for (
          const token of productTokens
        ) {

          if (
            lower.includes(
              token
            )
          ) {
            score += 2;
          }
        }


        return {
          sentence,
          score
        };
      })
      .sort(
        (a, b) =>
          b.score -
          a.score
      );


  const selected =
    ranked
      .filter(
        item =>
          item.score > 0
      )
      .slice(
        0,
        3
      )
      .map(
        item =>
          item.sentence
      );


  const output =
    selected.length
      ? selected.join(" ")
      : value;


  return truncate(
    output,
    MAX_EVIDENCE_LENGTH
  );
}


/* =========================================================
   LOW-VALUE PAGE FILTERS
   ========================================================= */

function isLowValueTitle(
  title
) {

  const lower =
    clean(
      title
    ).toLowerCase();


  if (
    !lower
  ) {
    return true;
  }


  return LOW_VALUE_TITLE_TERMS.some(
    term =>
      lower.includes(
        term
      )
  );
}


function isLowValuePath(
  url
) {

  try {

    const pathname =
      new URL(
        normalizeUrl(
          url
        )
      ).pathname.toLowerCase();


    return LOW_VALUE_PATHS.some(
      path =>
        pathname.includes(
          path
        )
    );

  } catch {

    return true;
  }
}


/* =========================================================
   DOMAIN FILTER
   ========================================================= */

function isExcludedDomain(
  domain
) {

  const value =
    clean(
      domain
    )
      .toLowerCase()
      .replace(
        /^www\./,
        ""
      );


  if (
    !value
  ) {
    return true;
  }


  if (
    EXCLUDED_TLDS.some(
      suffix =>
        value.endsWith(
          suffix
        )
    )
  ) {

    return true;
  }


  return EXCLUDED_DOMAINS.some(
    blocked =>
      value === blocked ||
      value.endsWith(
        `.${blocked}`
      )
  );
}
/* =========================================================
   COMMON TEXT / SIGNAL UTILITIES
   ========================================================= */

function countSignals(
  text,
  signals
) {

  const value =
    clean(
      text
    ).toLowerCase();


  let count =
    0;


  for (
    const signal of signals || []
  ) {

    if (
      value.includes(
        String(
          signal
        ).toLowerCase()
      )
    ) {

      count += 1;
    }
  }


  return count;
}


function unique(
  values
) {

  return [
    ...new Set(
      (values || [])
        .filter(Boolean)
    )
  ];
}


function clean(
  value
) {

  if (
    value === null ||
    typeof value ===
      "undefined"
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
      MAX_INPUT_LENGTH
    );
}


/* =========================================================
   WEB TEXT SANITIZATION
   ========================================================= */

function sanitizeWebText(
  value
) {

  return String(
    value ||
    ""
  )

    /*
     * Remove scripts / styles.
     */
    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      " "
    )

    .replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      " "
    )

    /*
     * Markdown images.
     */
    .replace(
      /!\[[^\]]*\]\([^)]+\)/g,
      " "
    )

    /*
     * Markdown links:
     * keep visible anchor text.
     */
    .replace(
      /\[([^\]]+)\]\([^)]+\)/g,
      "$1"
    )

    /*
     * URLs.
     */
    .replace(
      /https?:\/\/[^\s<>"']+/gi,
      " "
    )

    .replace(
      /www\.[^\s<>"']+/gi,
      " "
    )

    /*
     * HTML tags.
     */
    .replace(
      /<[^>]*>/g,
      " "
    )

    /*
     * Common HTML entities.
     */
    .replace(
      /&(?:amp|nbsp|quot|lt|gt|#39);/gi,
      " "
    )

    /*
     * Very long encoded strings.
     */
    .replace(
      /(?:%[0-9A-Fa-f]{2}){8,}/g,
      " "
    )

    .replace(
      /[A-Za-z0-9+/]{120,}={0,2}/g,
      " "
    )

    /*
     * Excessive repeated characters.
     */
    .replace(
      /(.)\1{12,}/g,
      "$1$1$1"
    )

    /*
     * Common low-value legal / cookie UI.
     */
    .replace(
      /\b(?:cookie policy|privacy policy|terms of use|subscribe now|sign up now)\b/gi,
      " "
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim()

    .slice(
      0,
      MAX_INPUT_LENGTH
    );
}


/* =========================================================
   URL UTILITIES
   ========================================================= */

function normalizeUrl(
  value
) {

  try {

    let input =
      clean(
        value
      );


    if (
      !input
    ) {
      return "";
    }


    /*
     * Tavily normally returns absolute URLs,
     * but accept bare domains safely too.
     */

    if (
      !/^https?:\/\//i.test(
        input
      )
    ) {

      input =
        `https://${input}`;
    }


    const parsed =
      new URL(
        input
      );


    if (
      parsed.protocol !==
        "http:" &&
      parsed.protocol !==
        "https:"
    ) {

      return "";
    }


    parsed.hash =
      "";


    const tracking =
      [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "gclid",
        "fbclid",
        "msclkid"
      ];


    for (
      const key of tracking
    ) {

      parsed.searchParams.delete(
        key
      );
    }


    return parsed.toString();


  } catch {

    return "";
  }
}


function getDomain(
  url
) {

  try {

    const normalized =
      normalizeUrl(
        url
      );


    if (
      !normalized
    ) {
      return "";
    }


    return new URL(
      normalized
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
   OUTPUT TRUNCATION
   ========================================================= */

function truncate(
  value,
  maxLength
) {

  const text =
    clean(
      value
    );


  if (
    !maxLength ||
    text.length <=
      maxLength
  ) {

    return text;
  }


  const shortened =
    text.slice(
      0,
      maxLength
    );


  const lastSpace =
    shortened.lastIndexOf(
      " "
    );


  if (
    lastSpace >
    Math.floor(
      maxLength * 0.60
    )
  ) {

    return `${shortened
      .slice(
        0,
        lastSpace
      )
      .trim()}...`;
  }


  return `${shortened.trim()}...`;
}


/* =========================================================
   REGEX SAFETY
   ========================================================= */

function escapeRegExp(
  value
) {

  return String(
    value ||
    ""
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}


/* =========================================================
   JSON SAFETY
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

  const timestamp =
    Date.now()
      .toString(
        36
      )
      .toUpperCase();


  const random =
    Math.random()
      .toString(
        36
      )
      .slice(
        2,
        8
      )
      .toUpperCase();


  return `CASEVO-${timestamp}-${random}`;
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
