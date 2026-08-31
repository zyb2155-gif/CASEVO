/**
 * CASEVO AI SOURCING ENGINE
 * Version 4.1.3 — Verified Identity Sync
 *
 * GET  /api/health
 * POST /api/sourcing
 * POST /api/verify-supplier
 *
 * Required secret: TAVILY_API_KEY
 */

const VERSION = "4.1.3";
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
  "quora.com", "medium.com", "substack.com", "wordpress.com", "blogspot.com",
  "craigslist.org"
];

const LOW_VALUE_TITLE_TERMS = [
  "top 10",
  "top 20",
  "best manufacturers",
  "best suppliers",
  "best shoe manufacturers",
  "manufacturer list",
  "supplier list",
  "factory list",
  "directory",
  "buyers guide",
  "buyer's guide",
  "how to",
  "what is",
  "complete guide",
  "ultimate guide",
  "review",
  "reviews",
  "comparison",
  "market report",
  "industry report",
  "news",
  "blog"
];

const LOW_VALUE_PATHS = [
  "/blog/",
  "/blogs/",
  "/news/",
  "/article/",
  "/articles/",
  "/guide/",
  "/guides/",
  "/category/",
  "/categories/",
  "/tag/",
  "/tags/",
  "/directory/",
  "/directories/",
  "/review/",
  "/reviews/"
];

const MANUFACTURER_SIGNALS = [
  "manufacturer",
  "manufacturing",
  "factory",
  "production",
  "production line",
  "production capacity",
  "workshop",
  "plant",
  "facility",
  "oem",
  "odm",
  "private label"
];

const COMPANY_SIGNALS = [
  "about us",
  "company profile",
  "our company",
  "company overview",
  "established",
  "founded",
  "contact us",
  "our factory",
  "our team",
  "headquarters"
];

const COMMERCIAL_SIGNALS = [
  "oem",
  "odm",
  "private label",
  "custom manufacturing",
  "export",
  "exporter",
  "wholesale",
  "minimum order",
  "moq",
  "quote",
  "inquiry",
  "enquiry"
];

const CHINA_SIGNALS = [
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
  "chengdu",
  "jiangsu",
  "sichuan"
];

const COMPANY_SUFFIX_RE =
  /\b(?:co\.?\s*,?\s*ltd\.?|company\s+limited|ltd\.?|limited|inc\.?|corporation|corp\.?|llc)\b/i;

const NON_IDENTITY_RE =
  /\b(?:contact\s*us|about\s*us|our\s+(?:factory|process|products?|services?)|request\s+(?:a\s+)?(?:factory\s+)?quote|start\s+your|thanks?|thank\s+you|learn\s+more|read\s+more|get\s+in\s+touch|privacy\s+policy|terms\s+of\s+use)\b/i;

const DESCRIPTOR_RE =
  /\b(?:private\s+label|custom|premium|reliable|formal|casual|men'?s|women'?s|leather|shoe|shoes|footwear|goods?)\b/i;

const ROLE_END_RE =
  /\b(?:manufacturers?|suppliers?|factories|factory|exporters?|wholesalers?)\b\s*$/i;

const GENERIC_TITLE_TERMS = [
  "shoe manufacturer",
  "shoes manufacturer",
  "footwear manufacturer",
  "leather shoe manufacturer",
  "leather shoes manufacturer",
  "custom shoes manufacturer",
  "custom footwear manufacturer",
  "shoe supplier",
  "shoes supplier",
  "leather supplier",
  "shoe factory",
  "shoes factory",
  "leather factory",
  "oem shoe manufacturer",
  "odm shoe manufacturer",
  "private label manufacturer",
  "private label shoes manufacturer",
  "private label manufacturers shoes leather goods",
  "custom mens formal leather shoes manufacturer",
  "premium leather shoes",
  "reliable leather shoes manufacturer"
];

const CERTIFICATION_RULES = [
  ["ISO 9001", /\biso\s*9001\b/i],
  ["ISO 14001", /\biso\s*14001\b/i],
  ["BSCI", /\bbsci\b/i],
  ["SEDEX", /\bsedex\b/i],
  ["SMETA", /\bsmeta\b/i],
  ["LWG", /\blwg\b/i],
  ["REACH", /\breach\b/i],
  ["RoHS", /\brohs\b/i],
  ["OEKO-TEX", /\boeko[\s-]?tex\b/i],
  ["GRS", /\bgrs\b/i],
  ["GOTS", /\bgots\b/i],
  ["FSC", /\bfsc\b/i],
  ["WRAP", /\bwrap\b/i]
];

const PRODUCT_TERMS = [
  ["premium full-grain leather shoe upper", "Premium full-grain leather shoe upper"],
  ["full-grain leather shoe upper", "Full-grain leather shoe upper"],
  ["full grain leather shoe upper", "Full-grain leather shoe upper"],
  ["leather shoe upper", "Leather shoe upper"],
  ["shoe upper leather", "Leather shoe upper"],
  ["upper leather", "Upper leather"],
  ["genuine leather", "Genuine leather"],
  ["cow leather", "Cow leather"],
  ["cowhide", "Cowhide leather"],
  ["microfiber leather", "Microfiber leather"],
  ["synthetic leather", "Synthetic leather"],
  ["pu leather", "PU leather"],
  ["rubber", "Rubber"],
  ["eva", "EVA"],
  ["tpr", "TPR"],
  ["textile", "Textile"],
  ["fabric", "Fabric"],
  ["sneaker", "Sneaker"],
  ["footwear", "Footwear"],
  ["shoe", "Shoe"],
  ["鞋面革", "Upper leather"],
  ["皮革", "Leather"],
  ["鞋面", "Shoe upper"],
  ["鞋", "Footwear"]
];

const DESTINATION_RULES = [
  ["united states", "United States"],
  ["u.s.a.", "United States"],
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
  ["韩国", "South Korea"],
  ["singapore", "Singapore"],
  ["新加坡", "Singapore"],
  ["india", "India"],
  ["印度", "India"],
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

const LOCATION_RULES = [
  ["Guangzhou, China", ["guangzhou"]],
  ["Dongguan, China", ["dongguan"]],
  ["Foshan, China", ["foshan"]],
  ["Shenzhen, China", ["shenzhen"]],
  ["Quanzhou, China", ["quanzhou"]],
  ["Jinjiang, China", ["jinjiang"]],
  ["Wenzhou, China", ["wenzhou"]],
  ["Putian, China", ["putian"]],
  ["Chengdu, China", ["chengdu"]],
  ["Yiwu, China", ["yiwu"]],
  ["Guangdong, China", ["guangdong"]],
  ["Zhejiang, China", ["zhejiang"]],
  ["Fujian, China", ["fujian"]],
  ["Jiangsu, China", ["jiangsu"]],
  ["Sichuan, China", ["sichuan"]],
  ["China", ["china", "chinese"]],
  ["India", ["india"]],
  ["Vietnam", ["vietnam"]],
  ["Indonesia", ["indonesia"]],
  ["Thailand", ["thailand"]],
  ["Bangladesh", ["bangladesh"]],
  ["Pakistan", ["pakistan"]],
  ["Turkey", ["turkey"]],
  ["Italy", ["italy"]],
  ["Spain", ["spain"]],
  ["Portugal", ["portugal"]],
  ["Germany", ["germany"]],
  ["France", ["france"]],
  ["Japan", ["japan"]],
  ["South Korea", ["south korea", "korea"]],
  ["Mexico", ["mexico"]],
  ["Brazil", ["brazil"]]
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return jsonResponse({
        ok: true,
        service: "CASEVO AI Sourcing",
        version: VERSION,
        engine:
          "CASEVO Real Supplier Discovery + Human Verification + Company Identity Lock",
        searchProvider: "Tavily",
        apiKeyConfigured: Boolean(env.TAVILY_API_KEY),
        timestamp: new Date().toISOString()
      });
    }

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

    if (url.pathname === "/api/verify-supplier") {
      if (request.method !== "POST") {
        return jsonResponse(
          {
            ok: false,
            error:
              "Method not allowed. Use POST /api/verify-supplier."
          },
          405
        );
      }

      return handleSupplierVerification(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      "CASEVO Worker is running.",
      {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type":
            "text/plain; charset=utf-8"
        }
      }
    );
  }
};

async function handleSourcingRequest(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error:
          "Invalid JSON request body."
      },
      400
    );
  }

  const requirement =
    clean(
      body?.requirement ??
      body?.requirements ??
      body?.brief
    );

  const productInput =
    clean(
      body?.product ??
      body?.product_material ??
      body?.productMaterial
    );

  const quantityInput =
    clean(
      body?.quantity
    );

  const targetPriceInput =
    clean(
      body?.targetPrice ??
      body?.target_price ??
      body?.price
    );

  const destinationInput =
    clean(
      body?.destination
    );

  if (!requirement && !productInput) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Please enter a sourcing requirement."
      },
      400
    );
  }

  const combined =
    clean(
      [
        requirement,
        productInput,
        quantityInput,
        targetPriceInput,
        destinationInput
      ]
        .filter(Boolean)
        .join(" ")
    );

  const normalized =
    normalizeRequirement({
      requirement,
      productInput,
      quantityInput,
      targetPriceInput,
      destinationInput,
      combined
    });

  const scoring =
    calculateReadiness(
      normalized
    );

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

  try {
    const search =
      await searchSuppliersWithTavily(
        normalized,
        env.TAVILY_API_KEY
      );

    const matches =
      normalizeSupplierResults(
        search.results,
        normalized
      );

    const brief = {
      product:
        normalized.product ||
        "Sourcing requirement",

      quantity:
        normalized.quantity ||
        null,

      targetPrice:
        normalized.targetPrice ||
        null,

      destination:
        normalized.destination ||
        null,

      requirement:
        normalized.requirement ||
        combined
    };

    return jsonResponse({
      ok: true,

      requestId:
        createRequestId(),

      message:
        "CASEVO supplier discovery completed successfully.",

      brief,

      analysis: {
        normalized,
        scoring,
        matches
      },

      matches,

      meta: {
        source:
          "CASEVO AI Sourcing Engine",

        engine:
          "CASEVO Real Supplier Discovery",

        supplierData:
          "Public web search",

        verified:
          false,

        verificationNote:
          "Public-web candidates are not verified suppliers. Company identity, manufacturing capability, certifications, MOQ, production capacity and commercial contacts must be independently verified before placing an order.",

        searchQueries:
          search.searchQueries,

        resultsScanned:
          search.resultsScanned,

        domainsScanned:
          search.results.length,

        suppliersReturned:
          matches.length,

        creditsUsed:
          search.creditsUsed,

        strictCompanyFilter:
          true,

        companyIdentityLock:
          true,

        timestamp:
          new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(
      "CASEVO sourcing error:",
      error
    );

    return jsonResponse(
      {
        ok: false,

        error:
          "Supplier web search failed.",

        details:
          clean(
            error?.message ||
            "Unknown search error."
          )
      },
      502
    );
  }
}

async function handleSupplierVerification(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error:
          "Invalid JSON request body."
      },
      400
    );
  }

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

  const supplier =
    body?.supplier ||
    {};

  const suppliedName =
    clean(
      supplier.name ??
      supplier.companyName ??
      body?.name
    );

  const name =
    suppliedName === UNKNOWN_COMPANY
      ? ""
      : cleanCompanyCandidate(
          suppliedName
        );

  const website =
    normalizeUrl(
      supplier.website ??
      body?.website
    );

  const sourceUrl =
    normalizeUrl(
      supplier.sourceUrl ??
      body?.sourceUrl
    );

  const domain =
    clean(
      supplier.domain
    ) ||
    getDomain(
      website ||
      sourceUrl
    );

  const product =
    clean(
      body?.product ??
      body?.requirement ??
      body?.brief ??
      ""
    );

  if (
    !name &&
    !domain &&
    !website
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "A supplier name or website is required for verification."
      },
      400
    );
  }

  try {
    const queries =
      buildVerificationQueries({
        name,
        domain,
        product
      });

    const responses =
      await Promise.allSettled(
        queries.map(
          query =>
            tavilySearch(
              query,
              env.TAVILY_API_KEY
            )
        )
      );

    const successful =
      responses.filter(
        item =>
          item.status ===
          "fulfilled"
      );

    if (!successful.length) {
      const failure =
        responses.find(
          item =>
            item.status ===
            "rejected"
        );

      throw new Error(
        failure?.reason?.message ||
        "Supplier verification searches failed."
      );
    }

    const rawResults =
      successful.flatMap(
        item =>
          (
            item.value?.results ||
            []
          ).map(
            result => ({
              ...result,
              _query:
                item.value._query
            })
          )
      );

    const results =
      deduplicateVerificationResults(
        rawResults
      );

    const evidence =
      buildVerificationEvidence(
        results,
        {
          name,
          domain,
          website,
          product
        }
      );

    return jsonResponse({
      ok: true,

      requestId:
        createRequestId(),

      message:
        "CASEVO supplier verification research completed.",

      supplier: {
        name:
          evidence.companyName,

        companyName:
          evidence.companyName,

        companyIdentityConfirmed:
          evidence.companyName !==
          UNKNOWN_COMPANY,

        website:
          website ||
          (
            domain
              ? `https://${domain}`
              : ""
          ),

        domain:
          domain ||
          evidence.domain ||
          "",

        location:
          evidence.location,

        contactEmail:
          evidence.email,

        contactPhone:
          evidence.phone,

        supplierType:
          evidence.supplierType,

        certifications:
          evidence.certifications,

        moq:
          evidence.moq,

        exportCapability:
          evidence.exportCapability,

        manufacturingCapability:
          evidence.manufacturingCapability,

        oemOdm:
          evidence.oemOdm
      },

      verification: {
        score:
          evidence.score,

        status:
          evidence.status,

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
          evidence.email ||
          evidence.phone
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
    ).slice(
      0,
      160
    );

  const productText =
    clean(
      product
    ).slice(
      0,
      120
    );

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
    .slice(
      0,
      4
    )
    .map(
      query =>
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

  for (
    const result of results
  ) {
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
    results.filter(
      result => {
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
            domain ===
              targetDomain
          ) ||
          (
            targetName &&
            text.includes(
              targetName
            )
          )
        );
      }
    );

  const pool =
    related.length
      ? related
      : results;

  const combined =
    sanitizeWebText(
      pool
        .map(
          result =>
            `${result.title || ""}. ${result.content || ""} ${result.raw_content || ""}`
        )
        .join(" ")
    );

  const lower =
    combined.toLowerCase();

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
            ) ===
              targetDomain
        ).length
      : 0;

  const independentPages =
    new Set(
      pool
        .map(
          result =>
            getDomain(
              result.url
            )
        )
        .filter(Boolean)
    ).size;

  let score =
    0;

  const signals =
    [];

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
    score +=
      15;

    signals.push(
      "Official-domain evidence"
    );
  }

  if (
    manufacturingCount >= 1
  ) {
    score +=
      20;

    signals.push(
      "Manufacturing evidence"
    );
  }

  if (
    oemOdmFound
  ) {
    score +=
      10;

    signals.push(
      "OEM / ODM evidence"
    );
  }

  if (
    exportFound
  ) {
    score +=
      8;

    signals.push(
      "Export capability evidence"
    );
  }

  if (
    certifications.length
  ) {
    score +=
      10;

    signals.push(
      "Certification evidence"
    );
  }

  if (moq) {
    score +=
      5;

    signals.push(
      "MOQ evidence"
    );
  }

  if (email) {
    score +=
      5;

    signals.push(
      "Email evidence"
    );
  }

  if (phone) {
    score +=
      4;

    signals.push(
      "Phone evidence"
    );
  }

  if (
    location !==
    "Not determined"
  ) {
    score +=
      3;

    signals.push(
      "Location evidence"
    );
  }

  if (
    companyCount >= 1
  ) {
    score +=
      2;
  }

  if (
    independentPages >= 2
  ) {
    score +=
      5;

    signals.push(
      "Multiple public-web sources"
    );
  }

  score =
    Math.min(
      100,
      score
    );

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

  const companyIdentity =
    companyName !==
    UNKNOWN_COMPANY
      ? (
          legalName
            ? "Confirmed public-web identity signal"
            : "Partial identity evidence"
        )
      : "Not confirmed";

  const officialWebsite =
    targetDomain &&
    domainMatchCount >= 1 &&
    (
      companyName !==
      UNKNOWN_COMPANY ||
      companyCount >= 1
    )
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

  const items =
    pool
      .slice(
        0,
        8
      )
      .map(
        item => ({
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
        })
      );

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
      queries.map(
        query =>
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

  const allResults =
    [];

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
        (
          total,
          item
        ) =>
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
    clean(
      product
    ).slice(
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
    .map(
      query =>
        query.slice(
          0,
          MAX_QUERY_LENGTH
        )
    );
}

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
                clean(
                  query
                ).slice(
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
  } catch (error) {
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
      getDomain(url);

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
  const candidates =
    [];

  for (
    const result of
    Array.isArray(results)
      ? results
      : []
  ) {
    const url =
      normalizeUrl(
        result?.url
      );

    const domain =
      getDomain(url);

    if (
      !url ||
      !domain ||
      isExcludedDomain(domain) ||
      isLowValuePage(result)
    ) {
      continue;
    }

    const gate =
      evaluateRealCompanyGate(
        result,
        domain
      );

    if (!gate.pass) {
      continue;
    }

    const extractedName =
      extractTrustedCompanyName(
        result,
        domain,
        gate
      );

    const companyName =
      extractedName ||
      UNKNOWN_COMPANY;

    const matchScore =
      calculateMatchScore(
        result,
        analysis
      );

    if (
      matchScore < 45
    ) {
      continue;
    }

    const verification =
      calculateDiscoveryVerification(
        result,
        gate,
        companyName
      );

    candidates.push({
      result,
      domain,
      companyName,
      matchScore,
      verification,
      supplierType:
        detectSupplierType(
          result
        )
    });
  }

  candidates.sort(
    (
      a,
      b
    ) =>
      b.matchScore -
      a.matchScore ||
      b.verification.score -
      a.verification.score
  );

  return candidates
    .slice(
      0,
      MAX_SUPPLIERS
    )
    .map(
      (
        candidate,
        index
      ) =>
        buildSupplierRecord(
          candidate,
          analysis,
          index
        )
    );
}

function evaluateRealCompanyGate(
  result,
  domain
) {
  const title =
    sanitizeWebText(
      result?.title
    );

  const content =
    sanitizeWebText(
      result?.content ||
      result?.raw_content ||
      ""
    );

  const text =
    `${title} ${content}`
      .toLowerCase();

  const legalName =
    extractLegalCompanyName(
      content
    ) ||
    extractLegalCompanyName(
      title
    );

  const titleCompany =
    extractCompanyNameFromTitle(
      title
    );

  const contentCompany =
    extractCompanyNameFromContent(
      content
    );

  const brandDomain =
    companyNameFromDomain(
      domain
    );

  const identitySignal =
    Boolean(
      legalName ||
      titleCompany ||
      contentCompany ||
      brandDomain
    );

  const manufacturingSignal =
    countSignals(
      text,
      MANUFACTURER_SIGNALS
    ) >= 1;

  const companyPageSignal =
    countSignals(
      text,
      COMPANY_SIGNALS
    ) >= 1;

  const commercialSignal =
    countSignals(
      text,
      COMMERCIAL_SIGNALS
    ) >= 1;

  const independentDomain =
    Boolean(domain) &&
    !isExcludedDomain(
      domain
    );

  const evidenceCount =
    [
      identitySignal,
      manufacturingSignal,
      companyPageSignal,
      commercialSignal,
      independentDomain
    ].filter(Boolean).length;

  const strongIdentity =
    Boolean(
      legalName ||
      titleCompany ||
      contentCompany
    );

  const pass =
    independentDomain &&
    manufacturingSignal &&
    evidenceCount >= 3 &&
    (
      strongIdentity ||
      (
        brandDomain &&
        companyPageSignal
      )
    );

  return {
    pass,
    evidenceCount,
    legalName,
    titleCompany,
    contentCompany,
    brandDomain,
    manufacturingSignal,
    companyPageSignal,
    commercialSignal,
    independentDomain
  };
}

function extractTrustedCompanyName(
  result,
  domain,
  gate
) {
  const content =
    sanitizeWebText(
      result?.content ||
      result?.raw_content ||
      ""
    );

  const candidates = [
    gate?.legalName,
    gate?.contentCompany,
    gate?.titleCompany,
    extractLegalCompanyName(
      content
    ),
    extractCompanyNameFromContent(
      content
    ),
    extractCompanyNameFromTitle(
      result?.title ||
      ""
    )
  ];

  for (
    const candidate of candidates
  ) {
    const cleaned =
      cleanCompanyCandidate(
        candidate
      );

    if (cleaned) {
      return cleaned;
    }
  }

  const domainBrand =
    cleanCompanyCandidate(
      gate?.brandDomain ||
      companyNameFromDomain(
        domain
      )
    );

  if (
    domainBrand &&
    corroboratesBrand(
      domainBrand,
      result,
      domain
    )
  ) {
    return domainBrand;
  }

  return "";
}

function firstConfirmedCompanyName(
  candidates,
  context
) {
  for (
    const candidate of candidates
  ) {
    const cleaned =
      cleanCompanyCandidate(
        candidate
      );

    if (!cleaned) {
      continue;
    }

    if (
      COMPANY_SUFFIX_RE.test(
        cleaned
      )
    ) {
      return cleaned;
    }

    if (
      corroboratesBrand(
        cleaned,
        {
          title:
            context.content,

          content:
            context.content
        },
        context.domain
      )
    ) {
      return cleaned;
    }
  }

  return UNKNOWN_COMPANY;
}

function corroboratesBrand(
  candidate,
  result,
  domain
) {
  const brand =
    normalizeBrand(
      candidate
    );

  if (
    !brand ||
    brand.length < 3
  ) {
    return false;
  }

  const text =
    `${sanitizeWebText(
      result?.title
    )} ${sanitizeWebText(
      result?.content ||
      result?.raw_content ||
      ""
    )}`
      .toLowerCase();

  const domainToken =
    normalizeBrand(
      (
        domain ||
        ""
      ).split(".")[0]
    );

  const textHit =
    text.includes(
      brand.toLowerCase()
    );

  const domainHit =
    domainToken &&
    (
      domainToken.includes(
        brand.toLowerCase()
      ) ||
      brand
        .toLowerCase()
        .includes(
          domainToken
        )
    );

  return Boolean(
    textHit &&
    domainHit
  );
}

function normalizeBrand(
  value
) {
  return clean(
    value
  )
    .toLowerCase()
    .replace(
      /\b(?:co\.?|ltd\.?|limited|company|inc\.?|corporation|corp\.?|llc)\b/g,
      ""
    )
    .replace(
      /[^a-z0-9]/g,
      ""
    )
    .trim();
}

function buildSupplierRecord(
  candidate,
  analysis,
  index
) {
  const result =
    candidate.result;

  const contact =
    extractContactInfo(
      result
    );

  return {
    rank:
      index + 1,

    name:
      candidate.companyName,

    companyName:
      candidate.companyName,

    companyIdentityConfirmed:
      candidate.companyName !==
      UNKNOWN_COMPANY,

    location:
      inferLocation(
        result
      ),

    website:
      getWebsiteRoot(
        result.url
      ),

    sourceUrl:
      normalizeUrl(
        result.url
      ),

    domain:
      candidate.domain,

    supplierType:
      candidate.supplierType,

    capability:
      buildCapability(
        result,
        analysis
      ),

    matchScore:
      candidate.matchScore,

    verificationScore:
      candidate.verification.score,

    verificationStatus:
      candidate.verification.status,

    verificationSignals:
      candidate.verification.signals,

    certifications:
      extractCertifications(
        result
      ),

    moq:
      extractMOQ(
        result
      ),

    contactEmail:
      candidate.companyName !==
      UNKNOWN_COMPANY
        ? contact.email
        : "",

    contactPhone:
      candidate.companyName !==
      UNKNOWN_COMPANY
        ? contact.phone
        : "",

    evidence:
      buildEvidence(
        result,
        analysis
      ),

    source:
      "Public web search",

    note:
      candidate.companyName ===
      UNKNOWN_COMPANY
        ? "Potential supplier domain found, but CASEVO could not confirm a reliable company name from public-web evidence. Independent identity verification is required."
        : "Strict company-filter candidate. Company identity, capability, certifications, MOQ and commercial terms still require independent verification."
  };
}

function calculateDiscoveryVerification(
  result,
  gate,
  companyName
) {
  const content =
    sanitizeWebText(
      result?.content ||
      result?.raw_content ||
      ""
    );

  let score =
    0;

  const signals =
    [];

  if (
    companyName !==
    UNKNOWN_COMPANY
  ) {
    if (
      gate?.legalName
    ) {
      score +=
        25;

      signals.push(
        "Legal company-name signal"
      );
    } else {
      score +=
        18;

      signals.push(
        "Company identity signal"
      );
    }
  }

  if (
    gate?.manufacturingSignal
  ) {
    score +=
      22;

    signals.push(
      "Manufacturing capability signal"
    );
  }

  if (
    gate?.companyPageSignal
  ) {
    score +=
      12;

    signals.push(
      "Company-page signal"
    );
  }

  if (
    gate?.commercialSignal
  ) {
    score +=
      10;

    signals.push(
      "Commercial capability signal"
    );
  }

  if (
    extractEmail(
      content
    )
  ) {
    score +=
      10;

    signals.push(
      "Email found"
    );
  }

  if (
    extractPhone(
      content
    )
  ) {
    score +=
      6;

    signals.push(
      "Phone found"
    );
  }

  if (
    inferLocation(
      result
    ) !==
    "Not determined"
  ) {
    score +=
      5;

    signals.push(
      "Location signal"
    );
  }

  if (
    extractCertifications(
      result
    ).length
  ) {
    score +=
      10;

    signals.push(
      "Certification signal"
    );
  }

  score =
    Math.min(
      100,
      score
    );

  let status =
    "Unverified — due diligence required";

  if (
    companyName ===
    UNKNOWN_COMPANY
  ) {
    status =
      "Company identity not confirmed — manual verification required";
  } else if (
    score >= 75
  ) {
    status =
      "Strong public-web identity signals — verification required";
  } else if (
    score >= 55
  ) {
    status =
      "Moderate public-web identity signals — verification required";
  }

  return {
    score,
    status,

    signals:
      unique(signals)
  };
}
function isLowValuePage(
  result
) {
  const title =
    clean(
      result?.title
    ).toLowerCase();

  const url =
    clean(
      result?.url
    ).toLowerCase();

  const domain =
    getDomain(
      result?.url
    );

  if (
    !domain ||
    isExcludedDomain(
      domain
    )
  ) {
    return true;
  }

  const titleUrl =
    `${title} ${url}`;

  if (
    LOW_VALUE_TITLE_TERMS.some(
      term =>
        titleUrl.includes(
          term
        )
    )
  ) {
    return true;
  }

  if (
    LOW_VALUE_PATHS.some(
      path =>
        url.includes(
          path
        )
    )
  ) {
    return true;
  }

  if (
    /^(top|best|how|why|what|guide|list|review|directory|comparison)\b/i.test(
      title
    )
  ) {
    return true;
  }

  if (
    /\b(guide|difference|ideas|tips|trends|explained|everything you need to know)\b/i.test(
      title
    )
  ) {
    return true;
  }

  return false;
}

function isGenericCompanyTitle(
  value
) {
  const lower =
    clean(
      value
    ).toLowerCase();

  if (!lower) {
    return true;
  }

  if (
    GENERIC_TITLE_TERMS.some(
      term =>
        lower === term ||
        lower.startsWith(
          `${term} |`
        ) ||
        lower.startsWith(
          `${term} -`
        )
    )
  ) {
    return true;
  }

  if (
    ROLE_END_RE.test(
      lower
    ) &&
    DESCRIPTOR_RE.test(
      lower
    ) &&
    !COMPANY_SUFFIX_RE.test(
      lower
    )
  ) {
    return true;
  }

  if (
    /\bprivate\s+label\b/i.test(
      lower
    ) &&
    /\bmanufacturers?\b/i.test(
      lower
    ) &&
    !COMPANY_SUFFIX_RE.test(
      lower
    )
  ) {
    return true;
  }

  return false;
}

function extractLegalCompanyName(
  text
) {
  const value =
    sanitizeWebText(
      text
    );

  if (!value) {
    return "";
  }

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

  candidates.sort(
    (
      a,
      b
    ) => {
      const aw =
        a.split(
          /\s+/
        ).length;

      const bw =
        b.split(
          /\s+/
        ).length;

      if (
        aw !== bw
      ) {
        return aw - bw;
      }

      return (
        a.length -
        b.length
      );
    }
  );

  return candidates[0];
}

function extractCompanyNameFromContent(
  text
) {
  const value =
    sanitizeWebText(
      text
    );

  if (!value) {
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

function extractCompanyNameFromTitle(
  title
) {
  const value =
    sanitizeWebText(
      title
    );

  if (
    !value ||
    isGenericCompanyTitle(
      value
    )
  ) {
    return "";
  }

  const legal =
    extractLegalCompanyName(
      value
    );

  if (legal) {
    return legal;
  }

  const parts =
    value.split(
      /\s*[|–—]\s*|\s+-\s+/
    );

  for (
    const part of parts
  ) {
    const candidate =
      cleanCompanyCandidate(
        part
      );

    if (
      !candidate ||
      isBadCompanyNameCandidate(
        candidate
      )
    ) {
      continue;
    }

    if (
      candidate.split(
        /\s+/
      ).length <= 5 &&
      !ROLE_END_RE.test(
        candidate
      )
    ) {
      return candidate;
    }
  }

  return "";
}

function cleanCompanyCandidate(
  value
) {
  let name =
    sanitizeWebText(
      value
    );

  if (!name) {
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

  name =
    name
      .replace(
        /\s+[|–—-]\s+(?:official\s+site|official\s+website|home|homepage|manufacturer|supplier|factory).*$/i,
        ""
      )
      .trim();

  if (
    isBadCompanyNameCandidate(
      name
    )
  ) {
    return "";
  }

  return truncate(
    name,
    100
  );
}

function isBadCompanyNameCandidate(
  value
) {
  const name =
    clean(
      value
    );

  if (!name) {
    return true;
  }

  const lower =
    name.toLowerCase();

  const normalized =
    lower.replace(
      /[^a-z0-9]+/g,
      ""
    );

  if (
    name.length < 2 ||
    name.length > 100
  ) {
    return true;
  }

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
      "custom mens formal leather shoes manufacturer",
      "oem & odm footwear",
      "oem/odm footwear",
      "filter by organisation",
      "filter by organization"
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

  if (
    /^(?:filter\s+by|sort\s+by|view\s+all|show\s+all|load\s+more)\b/i.test(name) &&
    !COMPANY_SUFFIX_RE.test(name)
  ) {
    return true;
  }

  if (
    /\b(?:oem\s*(?:&|\/|and)?\s*odm|odm\s*(?:&|\/|and)?\s*oem)\b/i.test(name) &&
    /\b(?:footwear|shoes?|production|manufactur(?:e|er|ing)|factory|supplier)\b/i.test(name) &&
    !COMPANY_SUFFIX_RE.test(name)
  ) {
    return true;
  }

  if (
    /\b(?:shoe|shoes|footwear)\s+production\s+by\b/i.test(name) &&
    !COMPANY_SUFFIX_RE.test(name)
  ) {
    return true;
  }

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
      .split(
        /\s+/
      )
      .filter(Boolean);

  if (
    descriptorMatches >= 3 &&
    descriptorMatches >=
      Math.ceil(
        words.length *
        0.6
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

  if (
    words.length > 7 &&
    !COMPANY_SUFFIX_RE.test(
      name
    )
  ) {
    return true;
  }

  if (
    !/[a-z]/i.test(
      name
    )
  ) {
    return true;
  }

  return false;
}

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

  if (!cleanDomain) {
    return "";
  }

  const first =
    cleanDomain
      .split(".")[0]
      .replace(
        /[^a-z0-9_-]/g,
        ""
      );

  if (
    !first ||
    first.length < 4 ||
    first.length > 35
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
    first
      .split(
        /[-_]/
      )
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
      first
    )
  ) {
    return "";
  }

  const candidate =
    first
      .replace(
        /[-_]+/g,
        " "
      )
      .replace(
        /\b\w/g,
        char =>
          char.toUpperCase()
      )
      .trim();

  if (
    isBadCompanyNameCandidate(
      candidate
    )
  ) {
    return "";
  }

  return candidate;
}

function calculateMatchScore(
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

  const combined =
    `${title} ${content}`
      .toLowerCase();

  let score =
    35;

  const manufacturingCount =
    countSignals(
      combined,
      MANUFACTURER_SIGNALS
    );

  const commercialCount =
    countSignals(
      combined,
      COMMERCIAL_SIGNALS
    );

  const companyCount =
    countSignals(
      combined,
      COMPANY_SIGNALS
    );

  const chinaCount =
    countSignals(
      combined,
      CHINA_SIGNALS
    );

  const productRelevance =
    calculateProductRelevance(
      combined,
      analysis.product ||
      analysis.requirement
    );

  score +=
    Math.min(
      22,
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
      16,
      productRelevance * 3
    );

  if (
    chinaCount > 0
  ) {
    score +=
      4;
  }

  if (
    extractCertifications(
      result
    ).length
  ) {
    score +=
      2;
  }

  if (
    extractMOQ(
      result
    )
  ) {
    score +=
      1;
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
        .map(
          token =>
            token.trim()
        )
        .filter(
          token =>
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
      count +=
        1;
    }
  }

  return count;
}

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
    ) *
    10;

  score +=
    countSignals(
      combined,
      MANUFACTURER_SIGNALS
    ) *
    4;

  score +=
    countSignals(
      combined,
      COMPANY_SIGNALS
    ) *
    2;

  score +=
    countSignals(
      combined,
      COMMERCIAL_SIGNALS
    ) *
    2;

  if (
    isLowValueTitle(
      title
    )
  ) {
    score -=
      12;
  }

  if (
    isLowValuePath(
      result?.url
    )
  ) {
    score -=
      12;
  }

  return score;
}

function buildCapability(
  result,
  analysis
) {
  const evidence =
    extractRelevantEvidence(
      `${result?.title || ""}. ${result?.content || ""} ${result?.raw_content || ""}`,
      analysis.product ||
      analysis.requirement
    );

  return truncate(
    evidence ||
    "Public-web manufacturing signals found. Capability requires independent verification.",
    MAX_CAPABILITY_LENGTH
  );
}

function buildEvidence(
  result,
  analysis
) {
  return truncate(
    extractRelevantEvidence(
      `${result?.title || ""}. ${result?.content || ""} ${result?.raw_content || ""}`,
      analysis.product ||
      analysis.requirement
    ),
    MAX_EVIDENCE_LENGTH
  );
}

function extractRelevantEvidence(
  text,
  product
) {
  const value =
    sanitizeWebText(
      text
    );

  if (!value) {
    return "";
  }

  const sentences =
    value
      .split(
        /(?<=[.!?])\s+/
      )
      .map(
        sentence =>
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
        .filter(
          token =>
            token.length >= 4
        )
    );

  const ranked =
    sentences
      .map(
        (
          sentence,
          index
        ) => {
          const lower =
            sentence.toLowerCase();

          let score =
            0;

          score +=
            countSignals(
              lower,
              MANUFACTURER_SIGNALS
            ) *
            3;

          score +=
            countSignals(
              lower,
              COMMERCIAL_SIGNALS
            ) *
            2;
