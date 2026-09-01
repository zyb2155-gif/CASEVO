/**
 * CASEVO AI SOURCING ENGINE
 * Version 4.2.3.3 — Search Reliability Hotfix
 *
 * GET  /api/health
 * POST /api/sourcing
 * POST /api/verify-supplier
 *
 * Required secret: TAVILY_API_KEY
 */

const VERSION = "4.2.3.3";
const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const SEARCH_TIMEOUT_MS = 15000;
const TAVILY_MAX_ATTEMPTS = 3;
const TAVILY_RETRY_BASE_MS = 650;
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
          "CASEVO Real Supplier Discovery + Human Verification + Supplier Identity Intelligence",
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

    const postVerification =
      buildPostVerificationDecision(
        supplier,
        evidence
      );

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
          "Supplier web search temporarily unavailable.",

        details:
          clean(
            error?.message ||
            "Unknown search error."
          ),
        searchDiagnostics: {
          category:
            clean(error?.category || "search_failure"),
          status:
            Number(error?.status || 0) || null,
          attempts:
            Array.isArray(error?.searchDiagnostics)
              ? error.searchDiagnostics.length
              : null
        }
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
          product,
          discoveryIdentity: {
            identityType:
              supplier.identityType,
            authoritativeName:
              supplier.authoritativeName ||
              supplier.companyName ||
              supplier.name,
            identityConfidence:
              supplier.identityConfidence,
            identityEvidence:
              supplier.identityEvidence
          }
        }
      );

    return jsonResponse({
      ok: true,

      requestId:
        createRequestId(),

      message:
        "CASEVO supplier verification research completed.",

      qualification: postVerification.qualification,

      decision: postVerification.decision,

      supplier: {
        name:
          evidence.companyName,

        companyName:
          evidence.companyName,

        companyIdentityConfirmed:
          evidence.companyName !==
          UNKNOWN_COMPANY,

        identityType:
          evidence.identityType,

        authoritativeName:
          evidence.authoritativeName,

        identityConfidence:
          evidence.identityConfidence,

        identityEvidence:
          evidence.identityEvidence,

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
          evidence.oemOdm,

        verificationScore:
          evidence.score,

        verificationStatus:
          evidence.status,

        verificationSignals:
          postVerification.supplier.verificationSignals,

        qualificationScore:
          postVerification.qualification.score,

        qualificationStatus:
          postVerification.qualification.status,

        qualificationStrengths:
          postVerification.qualification.strengths,

        qualificationGaps:
          postVerification.qualification.gaps,

        recommendedAction:
          postVerification.qualification.recommendedAction,

        qualification:
          postVerification.qualification,

        decisionScore:
          postVerification.decision.score,

        decisionTier:
          postVerification.decision.tier,

        decisionReasons:
          postVerification.decision.reasons,

        riskFlags:
          postVerification.decision.riskFlags,

        nextBestAction:
          postVerification.decision.nextBestAction,

        decision:
          postVerification.decision
      },

      verification: {
        score:
          evidence.score,

        status:
          evidence.status,

        companyIdentity:
          evidence.companyName !== UNKNOWN_COMPANY
            ? evidence.companyName
            : "Not confirmed",

        identityStatus:
          evidence.companyIdentity,

        companyName:
          evidence.companyName,

        identityType:
          evidence.identityType,

        authoritativeName:
          evidence.authoritativeName,

        identityConfidence:
          evidence.identityConfidence,

        identityEvidence:
          evidence.identityEvidence,

        authoritySource:
          evidence.authoritySource,

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

        verifiedIdentityAuthority:
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

  const verifiedIdentity =
    classifySupplierIdentity(
      companyName,
      {
        legalName,
        domainBrand,
        brandCorroborated:
          companyName !==
            UNKNOWN_COMPANY &&
          corroboratesBrand(
            companyName,
            {
              title:
                combined,
              content:
                combined
            },
            targetDomain
          )
      }
    );

  const authoritativeIdentity =
    resolveAuthoritativeIdentity({
      discovery:
        target.discoveryIdentity ||
        {},
      verified:
        verifiedIdentity
    });

  const authoritativeCompanyName =
    authoritativeIdentity.authoritativeName;

  const location =
    inferLocation({
      title:
        authoritativeCompanyName,
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
    authoritativeCompanyName !==
    UNKNOWN_COMPANY
  ) {
    score +=
      authoritativeIdentity.identityType ===
        "legal_company"
        ? 18
        : 12;

    signals.push(
      authoritativeIdentity.identityType ===
        "legal_company"
        ? "Legal company-name signal"
        : "Brand / trade-name identity signal"
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
    authoritativeCompanyName !==
    UNKNOWN_COMPANY
      ? (
          authoritativeIdentity.identityType ===
            "legal_company"
            ? "Confirmed public-web legal-company identity signal"
            : "Confirmed public-web brand / trade-name identity signal"
        )
      : "Not confirmed";

  const officialWebsite =
    targetDomain &&
    domainMatchCount >= 1 &&
    (
      authoritativeCompanyName !==
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
        authoritativeCompanyName,
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
                authoritativeCompanyName
              ),
              320
            )
        })
      );

  const summaryParts = [
    companyIdentity !==
    "Not confirmed"
      ? `Company identity signal found: ${authoritativeCompanyName}.`
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

    companyName:
      authoritativeCompanyName,

    identityType:
      authoritativeIdentity.identityType,

    authoritativeName:
      authoritativeIdentity.authoritativeName,

    identityConfidence:
      authoritativeIdentity.identityConfidence,

    identityEvidence:
      authoritativeIdentity.identityEvidence,

    authoritySource:
      authoritativeIdentity.authoritySource,

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

function isRetryableSearchStatus(status) {
  return status === 408 ||
    status === 425 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504;
}

function searchFailureCategory(status, error) {
  if (error?.name === "AbortError") return "timeout";
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "authentication";
  if (status >= 500) return "provider_unavailable";
  if (status >= 400) return "request_rejected";
  return "network";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retryDelayMs(attempt, response) {
  const retryAfter = Number(response?.headers?.get?.("Retry-After"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 5000);
  }
  return Math.min(TAVILY_RETRY_BASE_MS * (2 ** Math.max(0, attempt - 1)), 4000);
}

async function tavilySearch(
  query,
  apiKey
) {
  const diagnostics = [];
  let lastError = null;

  for (let attempt = 1; attempt <= TAVILY_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    let response = null;

    try {
      response = await fetch(
        TAVILY_ENDPOINT,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            query: clean(query).slice(0, MAX_QUERY_LENGTH),
            topic: "general",
            search_depth: "basic",
            max_results: RESULTS_PER_QUERY,
            include_answer: false,
            include_raw_content: true,
            include_images: false,
            exclude_domains: EXCLUDED_DOMAINS
          }),
          signal: controller.signal
        }
      );

      const data = await safeJson(response);

      if (response.ok) {
        return {
          ...data,
          _query: query,
          searchDiagnostics: diagnostics.concat([{
            attempt,
            ok: true,
            status: response.status
          }])
        };
      }

      const category = searchFailureCategory(response.status);
      const message = clean(
        data?.detail ||
        data?.error ||
        `Tavily API returned HTTP ${response.status}`
      );

      diagnostics.push({
        attempt,
        ok: false,
        status: response.status,
        category,
        message
      });

      lastError = new Error(message);
      lastError.status = response.status;
      lastError.category = category;
      lastError.searchDiagnostics = diagnostics;

      if (!isRetryableSearchStatus(response.status) || attempt >= TAVILY_MAX_ATTEMPTS) {
        throw lastError;
      }

      await sleep(retryDelayMs(attempt, response));
    } catch (error) {
      const isAbort = error?.name === "AbortError";
      const status = Number(error?.status || response?.status || 0);
      const category = error?.category || searchFailureCategory(status, error);

      if (!diagnostics.length || diagnostics[diagnostics.length - 1]?.attempt !== attempt) {
        diagnostics.push({
          attempt,
          ok: false,
          status: status || null,
          category,
          message: isAbort ? "Supplier search timed out." : clean(error?.message || "Network search failure.")
        });
      }

      lastError = error instanceof Error ? error : new Error(String(error));
      lastError.status = status || null;
      lastError.category = category;
      lastError.searchDiagnostics = diagnostics;

      const retryable = isAbort || !status || isRetryableSearchStatus(status);
      if (!retryable || attempt >= TAVILY_MAX_ATTEMPTS) {
        throw lastError;
      }

      await sleep(retryDelayMs(attempt, response));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Supplier web search temporarily unavailable.");
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

    const relevance =
      calculateSupplierRelevanceProfile(
        result,
        analysis
      );

    const matchScore =
      calculateMatchScore(
        result,
        analysis
      );

    if (
      matchScore < 45 ||
      (
        relevance.isSpecificComponentQuery &&
        relevance.score < 18
      )
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
      gate,
      matchScore,
      relevance,
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

function classifySupplierIdentity(
  candidate,
  context = {}
) {
  const cleaned =
    cleanCompanyCandidate(
      candidate
    );

  if (
    !cleaned ||
    isBadCompanyNameCandidate(
      cleaned
    )
  ) {
    return {
      identityType:
        "unconfirmed",

      authoritativeName:
        UNKNOWN_COMPANY,

      identityConfidence:
        0,

      identityEvidence:
        "No reliable company or brand identity signal was confirmed."
    };
  }

  const legalSignal =
    COMPANY_SUFFIX_RE.test(
      cleaned
    ) ||
    Boolean(
      context.legalName &&
      cleanCompanyCandidate(
        context.legalName
      ) === cleaned
    );

  if (
    legalSignal
  ) {
    return {
      identityType:
        "legal_company",

      authoritativeName:
        cleaned,

      identityConfidence:
        context.legalName
          ? 96
          : 90,

      identityEvidence:
        "Legal company-name signal found in public-web evidence."
    };
  }

  const domainBrand =
    cleanCompanyCandidate(
      context.domainBrand
    );

  const explicitBrand =
    cleanCompanyCandidate(
      context.brandName ||
      context.explicitBrand
    );

  const normalizedCandidate =
    normalizeBrand(
      cleaned
    );

  const brandCorroborated =
    Boolean(
      normalizedCandidate &&
      (
        normalizeBrand(
          domainBrand
        ) ===
          normalizedCandidate ||
        normalizeBrand(
          explicitBrand
        ) ===
          normalizedCandidate ||
        context.brandCorroborated ===
          true
      )
    );

  const plausibleBrand =
    cleaned.length <= 48 &&
    !ROLE_END_RE.test(
      cleaned
    ) &&
    !DESCRIPTOR_RE.test(
      cleaned
    );

  if (
    brandCorroborated &&
    plausibleBrand
  ) {
    return {
      identityType:
        "brand",

      authoritativeName:
        cleaned,

      identityConfidence:
        68,

      identityEvidence:
        "Brand or trade-name signal corroborated by public-web/domain evidence; legal entity not confirmed."
    };
  }

  return {
    identityType:
      "unconfirmed",

    authoritativeName:
      UNKNOWN_COMPANY,

    identityConfidence:
      20,

    identityEvidence:
      "Candidate identity was not strong enough to classify as a legal company or corroborated brand."
  };
}

function resolveAuthoritativeIdentity({
  discovery = {},
  verified = {}
} = {}) {
  const normalizeIdentity =
    value => {
      const type =
        [
          "legal_company",
          "brand",
          "unconfirmed"
        ].includes(
          value?.identityType
        )
          ? value.identityType
          : "unconfirmed";

      const name =
        type ===
        "unconfirmed"
          ? UNKNOWN_COMPANY
          : cleanCompanyCandidate(
              value?.authoritativeName
            ) ||
            UNKNOWN_COMPANY;

      return {
        identityType:
          name === UNKNOWN_COMPANY
            ? "unconfirmed"
            : type,

        authoritativeName:
          name,

        identityConfidence:
          Number.isFinite(
            Number(
              value?.identityConfidence
            )
          )
            ? Math.max(
                0,
                Math.min(
                  100,
                  Math.round(
                    Number(
                      value.identityConfidence
                    )
                  )
                )
              )
            : 0,

        identityEvidence:
          clean(
            value?.identityEvidence
          )
      };
    };

  const d =
    normalizeIdentity(
      discovery
    );

  const v =
    normalizeIdentity(
      verified
    );

  const options = [
    v.identityType ===
      "legal_company"
      ? {
          ...v,
          authoritySource:
            "verified"
        }
      : null,

    v.identityType ===
      "brand"
      ? {
          ...v,
          authoritySource:
            "verified"
        }
      : null,

    d.identityType ===
      "legal_company"
      ? {
          ...d,
          authoritySource:
            "discovery"
        }
      : null,

    d.identityType ===
      "brand"
      ? {
          ...d,
          authoritySource:
            "discovery"
        }
      : null
  ].filter(Boolean);

  return (
    options[0] ||
    {
      identityType:
        "unconfirmed",

      authoritativeName:
        UNKNOWN_COMPANY,

      identityConfidence:
        Math.max(
          d.identityConfidence,
          v.identityConfidence
        ),

      identityEvidence:
        v.identityEvidence ||
        d.identityEvidence ||
        "No authoritative supplier identity was confirmed.",

      authoritySource:
        "none"
    }
  );
}


function buildPostVerificationDecision(
  discoverySupplier = {},
  evidence = {}
) {
  const verificationSignals =
    unique([
      ...(Array.isArray(evidence.signals)
        ? evidence.signals
        : []),

      evidence.manufacturingCapability &&
      !/not confirmed|not determined|unknown/i.test(
        clean(evidence.manufacturingCapability)
      )
        ? "Manufacturing capability evidence"
        : "",

      evidence.exportCapability &&
      !/not confirmed|not determined|unknown/i.test(
        clean(evidence.exportCapability)
      )
        ? "Commercial capability / export evidence"
        : ""
    ].filter(Boolean));

  const verifiedSupplier = {
    ...discoverySupplier,

    name:
      evidence.companyName ||
      discoverySupplier.name,

    companyName:
      evidence.companyName ||
      discoverySupplier.companyName,

    companyIdentityConfirmed:
      evidence.companyName !==
      UNKNOWN_COMPANY,

    identityType:
      evidence.identityType ||
      discoverySupplier.identityType,

    authoritativeName:
      evidence.authoritativeName ||
      evidence.companyName ||
      discoverySupplier.authoritativeName,

    identityConfidence:
      evidence.identityConfidence ??
      discoverySupplier.identityConfidence,

    identityEvidence:
      evidence.identityEvidence ||
      discoverySupplier.identityEvidence,

    website:
      evidence.officialWebsite ||
      discoverySupplier.website,

    domain:
      evidence.domain ||
      discoverySupplier.domain,

    location:
      evidence.location ||
      discoverySupplier.location,

    contactEmail:
      evidence.email ||
      "",

    contactPhone:
      evidence.phone ||
      "",

    certifications:
      Array.isArray(evidence.certifications)
        ? evidence.certifications
        : [],

    moq:
      evidence.moq ||
      "",

    verificationScore:
      clampNumber(
        evidence.score,
        0,
        100
      ),

    verificationStatus:
      evidence.status ||
      discoverySupplier.verificationStatus,

    verificationSignals
  };

  const qualification =
    calculateQualificationProfile(
      verifiedSupplier
    );

  verifiedSupplier.qualificationScore =
    qualification.score;

  verifiedSupplier.qualificationStatus =
    qualification.status;

  verifiedSupplier.qualificationStrengths =
    qualification.strengths;

  verifiedSupplier.qualificationGaps =
    qualification.gaps;

  verifiedSupplier.recommendedAction =
    qualification.recommendedAction;

  verifiedSupplier.qualification =
    qualification;

  const decision =
    calculateSupplierDecision(
      verifiedSupplier
    );

  verifiedSupplier.decisionScore =
    decision.score;

  verifiedSupplier.decisionTier =
    decision.tier;

  verifiedSupplier.decisionReasons =
    decision.reasons;

  verifiedSupplier.riskFlags =
    decision.riskFlags;

  verifiedSupplier.nextBestAction =
    decision.nextBestAction;

  verifiedSupplier.decision =
    decision;

  return {
    supplier:
      verifiedSupplier,

    qualification,

    decision
  };
}


function calculateQualificationProfile(supplier = {}) {
  const identityConfirmed = supplier.companyIdentityConfirmed === true;
  const identityType = clean(supplier.identityType).toLowerCase();
  const relevance = clampNumber(supplier.relevanceScore, 0, 100);
  const verification = clampNumber(supplier.verificationScore, 0, 100);
  const certifications = Array.isArray(supplier.certifications) ? supplier.certifications : [];
  const moq = clean(supplier.moq);
  const hasMOQ = !!moq && !/not confirmed|not determined|unknown/i.test(moq);
  const hasContact = !!clean(supplier.contactEmail) || !!clean(supplier.contactPhone);
  const hasLocation = !!clean(supplier.location) && !/not determined|unknown/i.test(clean(supplier.location));
  const signals = Array.isArray(supplier.verificationSignals) ? supplier.verificationSignals : [];
  const hasManufacturing = signals.some(x => /manufacturing capability/i.test(clean(x)));
  const hasCommercial = signals.some(x => /commercial capability|export/i.test(clean(x)));

  let score = 0;
  score += Math.round(relevance * 0.30);
  score += Math.round(verification * 0.25);
  score += identityConfirmed ? (identityType === "legal_company" ? 15 : 10) : 0;
  score += hasManufacturing ? 10 : 0;
  score += hasMOQ ? 6 : 0;
  score += certifications.length ? 5 : 0;
  score += hasCommercial ? 4 : 0;
  score += hasContact ? 3 : 0;
  score += hasLocation ? 2 : 0;
  score = Math.max(0, Math.min(100, score));

  const criticalEvidenceComplete =
    identityConfirmed &&
    relevance >= 70 &&
    verification >= 70 &&
    hasManufacturing &&
    (hasMOQ || hasCommercial || hasContact);

  let status =
    score >= 80 && criticalEvidenceComplete ? "QUALIFIED" :
    score >= 60 ? "POTENTIAL" :
    score >= 40 ? "WEAK" :
    "REJECT";

  if (!identityConfirmed && status === "QUALIFIED") status = "POTENTIAL";

  const strengths = [];
  const gaps = [];
  if (relevance >= 80) strengths.push("Strong product relevance");
  else if (relevance < 60) gaps.push("Product relevance is limited");
  if (identityConfirmed) strengths.push(identityType === "legal_company" ? "Legal company identity signal" : "Brand / trade-name identity signal");
  else gaps.push("Company identity not confirmed");
  if (hasManufacturing) strengths.push("Manufacturing capability evidence");
  else gaps.push("Manufacturing capability needs confirmation");
  if (hasMOQ) strengths.push("MOQ evidence found");
  else gaps.push("MOQ not confirmed");
  if (certifications.length) strengths.push("Certification evidence found");
  else gaps.push("Certifications not confirmed");
  if (hasCommercial) strengths.push("Commercial / export capability evidence");
  else gaps.push("Export capability not confirmed");
  if (hasContact) strengths.push("Public contact evidence found");
  else gaps.push("Contact not confirmed");

  const recommendedAction =
    status === "QUALIFIED" ? "Proceed to RFQ / sampling after final due diligence" :
    status === "POTENTIAL" ? "Verify missing commercial evidence before RFQ / sampling" :
    status === "WEAK" ? "Further supplier verification required before outreach" :
    "Do not prioritize unless stronger evidence is found";

  return { score, status, strengths, gaps, recommendedAction };
}

function calculateSupplierDecision(supplier = {}) {
  const relevance = clampNumber(supplier.relevanceScore, 0, 100);
  const match = clampNumber(supplier.matchScore, 0, 100);
  const verification = clampNumber(supplier.verificationScore, 0, 100);
  const qualification = clampNumber(supplier.qualificationScore, 0, 100);
  const identityType = clean(supplier.identityType).toLowerCase();
  const identityConfirmed = supplier.companyIdentityConfirmed === true;
  const gaps = Array.isArray(supplier.qualificationGaps) ? supplier.qualificationGaps : [];

  let score = Math.round(
    relevance * 0.30 +
    match * 0.20 +
    verification * 0.20 +
    qualification * 0.30
  );

  if (identityType === "legal_company") score += 8;
  else if (identityType === "brand") score += 3;
  else score -= 15;

  score = Math.max(0, Math.min(100, score));

  const riskFlags = [];
  if (!identityConfirmed || identityType === "unconfirmed") riskFlags.push("Supplier identity is not confirmed");
  if (identityType === "brand") riskFlags.push("Brand / trade name found; legal company still requires confirmation");
  if (relevance < 60) riskFlags.push("Supplier-product relevance is below shortlist threshold");
  if (verification < 60) riskFlags.push("Public-web verification evidence is limited");
  for (const gap of gaps) {
    if (/MOQ|certification|contact|export|manufacturing/i.test(clean(gap))) riskFlags.push(clean(gap));
  }

  let tier;
  if (
    identityType === "legal_company" &&
    relevance >= 75 &&
    qualification >= 70 &&
    verification >= 60 &&
    score >= 75
  ) tier = "Priority shortlist";
  else if (
    identityConfirmed &&
    relevance >= 60 &&
    qualification >= 50 &&
    score >= 58
  ) tier = "Verify before shortlist";
  else if (relevance >= 40 && score >= 40) tier = "Hold / secondary";
  else tier = "Reject / insufficient evidence";

  // An unconfirmed identity can never be auto-promoted to the priority tier.
  if (identityType === "unconfirmed" && tier === "Priority shortlist") {
    tier = "Verify before shortlist";
  }

  const decisionReasons = [];
  if (relevance >= 80) decisionReasons.push("Strong product relevance");
  else if (relevance >= 60) decisionReasons.push("Acceptable product relevance");
  else decisionReasons.push("Product relevance requires caution");
  if (identityType === "legal_company") decisionReasons.push("Legal-company identity signal available");
  else if (identityType === "brand") decisionReasons.push("Brand / trade-name identity only");
  else decisionReasons.push("Identity remains unconfirmed");
  if (qualification >= 70) decisionReasons.push("Qualification evidence is comparatively strong");
  else if (qualification >= 50) decisionReasons.push("Qualification evidence is incomplete but usable");
  else decisionReasons.push("Qualification evidence is weak");
  if (verification >= 70) decisionReasons.push("Public-web verification is strong");
  else if (verification >= 50) decisionReasons.push("Public-web verification is moderate");
  else decisionReasons.push("Public-web verification is limited");

  const nextBestAction =
    tier === "Priority shortlist" ? "Proceed to RFQ / sampling after final commercial due diligence" :
    tier === "Verify before shortlist" ? "Verify legal identity and missing commercial evidence before shortlisting" :
    tier === "Hold / secondary" ? "Keep as a secondary candidate and investigate the highest-risk evidence gaps" :
    "Do not prioritize unless materially stronger supplier evidence is found";

  return {
    score,
    tier,
    reasons: unique(decisionReasons),
    riskFlags: unique(riskFlags),
    nextBestAction
  };
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
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

  const identity =
    classifySupplierIdentity(
      candidate.companyName,
      {
        legalName:
          candidate.gate?.legalName ||
          "",

        domainBrand:
          candidate.gate?.brandDomain ||
          companyNameFromDomain(
            candidate.domain
          ),

        brandCorroborated:
          candidate.companyName !==
            UNKNOWN_COMPANY &&
          corroboratesBrand(
            candidate.companyName,
            result,
            candidate.domain
          )
      }
    );

  const displayName =
    identity.authoritativeName;

  const identityConfirmed =
    identity.identityType !==
    "unconfirmed";

  const supplierRecord = {
    rank:
      index + 1,

    name:
      displayName,

    companyName:
      displayName,

    companyIdentityConfirmed:
      identityConfirmed,

    identityType:
      identity.identityType,

    authoritativeName:
      identity.authoritativeName,

    identityConfidence:
      identity.identityConfidence,

    identityEvidence:
      identity.identityEvidence,

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

    relevanceScore:
      candidate.relevance?.score ?? 0,

    relevanceTier:
      candidate.relevance?.tier || "unknown",

    relevanceSignals: {
      directComponent:
        candidate.relevance?.directComponentSignals ?? 0,
      wholeShoe:
        candidate.relevance?.wholeShoeSignals ?? 0,
      brandRetail:
        candidate.relevance?.brandRetailSignals ?? 0
    },

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
      identityConfirmed
        ? contact.email
        : "",

    contactPhone:
      identityConfirmed
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
      identity.identityType ===
      "unconfirmed"
        ? "Potential supplier domain found, but CASEVO could not confirm a reliable legal-company or brand identity from public-web evidence. Independent identity verification is required."
        : identity.identityType ===
          "brand"
          ? "Brand / trade-name candidate found. The associated legal company identity still requires independent verification."
          : "Strict company-filter candidate. Company identity, capability, certifications, MOQ and commercial terms still require independent verification."
  };

  const qualification = calculateQualificationProfile(supplierRecord);
  supplierRecord.qualificationScore = qualification.score;
  supplierRecord.qualificationStatus = qualification.status;
  supplierRecord.qualificationStrengths = qualification.strengths;
  supplierRecord.qualificationGaps = qualification.gaps;
  supplierRecord.recommendedAction = qualification.recommendedAction;
  supplierRecord.qualification = qualification;

  const decision = calculateSupplierDecision(supplierRecord);
  supplierRecord.decisionScore = decision.score;
  supplierRecord.decisionTier = decision.tier;
  supplierRecord.decisionReasons = decision.reasons;
  supplierRecord.riskFlags = decision.riskFlags;
  supplierRecord.nextBestAction = decision.nextBestAction;
  supplierRecord.decision = decision;

  return supplierRecord;
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
      "filter by organization",
      "barefoot shoe customization menu",
      "product catalog",
      "product catalogue"
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

  // v4.1.3 Verified Identity Sync:
  // Never promote UI labels, capability headings or SEO product titles
  // into the supplier identity field.
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

  // v4.1.4 Verified Identity Authority:
  // Reject navigation, catalogue and customization-page titles that
  // describe a page function rather than a legal or brand identity.
  if (
    /\b(?:menu|catalog|catalogue|collection|collections|navigation|shop\s+all|product\s+list)\b/i.test(name) &&
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

function calculateSupplierRelevanceProfile(
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

  const haystack =
    `${title} ${content}`
      .toLowerCase();

  const product =
    clean(
      analysis?.product ||
      analysis?.requirement ||
      ""
    ).toLowerCase();

  const specificComponentQuery =
    /\b(?:shoe\s+upper|footwear\s+upper|leather\s+upper|upper\s+leather|upper\s+material|footwear\s+components?|shoe\s+components?|outsole|midsole|insole|shoe\s+lining|footwear\s+lining|shoe\s+laces?|eyelets?)\b/i
      .test(
        product
      );

  const directComponentPatterns = [
    /\bshoe\s+uppers?\b/i,
    /\bfootwear\s+uppers?\b/i,
    /\bleather\s+uppers?\b/i,
    /\bupper\s+leather\b/i,
    /\bupper\s+materials?\b/i,
    /\bfootwear\s+components?\b/i,
    /\bshoe\s+components?\b/i,
    /\bupper\s+(?:manufactur(?:e|er|ing)|production|factory)\b/i,
    /\b(?:manufactur(?:e|er|ing)|production|factory)\s+(?:of\s+)?(?:shoe|footwear)\s+uppers?\b/i
  ];

  const exactMaterialPatterns = [
    /\bfull[\s-]?grain\b/i,
    /\bcow(?:hide)?\s+leather\b/i,
    /\bgenuine\s+leather\b/i,
    /\bupper\s+leather\b/i
  ];

  const wholeShoePatterns = [
    /\bfinished\s+(?:shoes?|footwear)\b/i,
    /\b(?:men'?s|women'?s)\s+(?:leather\s+)?shoes?\b/i,
    /\bcasual\s+shoes?\b/i,
    /\bdress\s+shoes?\b/i,
    /\bsneakers?\b/i,
    /\bshoe\s+manufacturer\b/i,
    /\bfootwear\s+manufacturer\b/i
  ];

  const brandRetailPatterns = [
    /\bnew\s+arrivals?\b/i,
    /\bshop\s+now\b/i,
    /\bretail\b/i,
    /\bcollection\b/i,
    /\bbrand\s+story\b/i,
    /\bstore\b/i
  ];

  const directCount =
    directComponentPatterns.filter(
      pattern =>
        pattern.test(
          haystack
        )
    ).length;

  const materialCount =
    exactMaterialPatterns.filter(
      pattern =>
        pattern.test(
          haystack
        )
    ).length;

  const wholeShoeCount =
    wholeShoePatterns.filter(
      pattern =>
        pattern.test(
          haystack
        )
    ).length;

  const brandRetailCount =
    brandRetailPatterns.filter(
      pattern =>
        pattern.test(
          haystack
        )
    ).length;

  const manufacturingCount =
    countSignals(
      haystack,
      MANUFACTURER_SIGNALS
    );

  const genericTokenRelevance =
    calculateProductRelevance(
      haystack,
      product
    );

  let score;

  if (
    specificComponentQuery
  ) {
    score =
      18;

    score +=
      Math.min(
        58,
        directCount * 16
      );

    score +=
      Math.min(
        14,
        materialCount * 7
      );

    if (
      directCount > 0 &&
      manufacturingCount > 0
    ) {
      score +=
        12;
    }

    if (
      directCount === 0
    ) {
      score -=
        Math.min(
          24,
          wholeShoeCount * 8
        );
    } else if (
      wholeShoeCount > 0
    ) {
      score -=
        Math.min(
          8,
          wholeShoeCount * 2
        );
    }

    score -=
      Math.min(
        24,
        brandRetailCount * 8
      );

    score +=
      Math.min(
        8,
        genericTokenRelevance
      );
  } else {
    score =
      25 +
      Math.min(
        55,
        genericTokenRelevance * 10
      ) +
      Math.min(
        15,
        manufacturingCount * 5
      ) -
      Math.min(
        20,
        brandRetailCount * 5
      );
  }

  score =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          score
        )
      )
    );

  const tier =
    score >= 80
      ? "high"
      : score >= 55
        ? "medium"
        : score >= 35
          ? "low"
          : "weak";

  return {
    score,
    tier,

    isSpecificComponentQuery:
      specificComponentQuery,

    directComponentSignals:
      directCount,

    wholeShoeSignals:
      wholeShoeCount,

    brandRetailSignals:
      brandRetailCount,

    manufacturingSignals:
      manufacturingCount
  };
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

  const relevance =
    calculateSupplierRelevanceProfile(
      result,
      analysis
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
      28,
      Math.round(
        relevance.score *
        0.28
      )
    );

  if (
    relevance.isSpecificComponentQuery
  ) {
    if (
      relevance.score >= 80
    ) {
      score +=
        8;
    } else if (
      relevance.score < 35
    ) {
      score -=
        25;
    } else if (
      relevance.score < 55
    ) {
      score -=
        15;
    }
  }

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
      20,
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
              score +=
                2;
            }
          }

          return {
            sentence,
            score,
            index
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          b.score -
          a.score ||
          a.index -
          b.index
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

function extractContactInfo(
  result
) {
  const text =
    `${result?.title || ""} ${result?.content || ""} ${result?.raw_content || ""}`;

  return {
    email:
      extractEmail(
        text
      ),

    phone:
      extractPhone(
        text
      )
  };
}

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

  return (
    filtered[0] ||
    ""
  );
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

    if (match) {
      return clean(
        `${match[1]} ${match[2] || ""}`
      );
    }
  }

  return "";
}

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

function isLowValueTitle(
  title
) {
  const lower =
    clean(
      title
    ).toLowerCase();

  if (!lower) {
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

  if (!value) {
    return true;
  }

  if (
    value.endsWith(
      ".gov"
    ) ||
    value.endsWith(
      ".edu"
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

function normalizeRequirement({
  requirement,
  productInput,
  quantityInput,
  targetPriceInput,
  destinationInput,
  combined
}) {
  const product =
    productInput ||
    extractProduct(
      combined
    );

  const quantity =
    quantityInput ||
    extractQuantity(
      combined
    );

  const targetPrice =
    targetPriceInput ||
    extractPrice(
      combined
    );

  const destination =
    destinationInput ||
    extractDestination(
      combined
    );

  const requirements =
    [];

  const thickness =
    combined.match(
      /\b\d+(?:\.\d+)?\s*(?:mm|cm|inch|inches)\b/i
    );

  if (thickness) {
    requirements.push(
      `Thickness: ${clean(
        thickness[0]
      )}`
    );
  }

  const lower =
    combined.toLowerCase();

  const colors = [
    "black",
    "white",
    "brown",
    "red",
    "blue",
    "green",
    "navy",
    "tan",
    "beige",
    "grey",
    "gray",
    "burgundy"
  ];

  const foundColors =
    colors.filter(
      color =>
        lower.includes(
          color
        )
    );

  if (
    foundColors.length
  ) {
    requirements.push(
      `Color: ${foundColors.join(", ")}`
    );
  }

  if (
    /full[\s-]?grain/i.test(
      combined
    )
  ) {
    requirements.push(
      "Leather grade: full-grain"
    );
  } else if (
    /top[\s-]?grain/i.test(
      combined
    )
  ) {
    requirements.push(
      "Leather grade: top-grain"
    );
  } else if (
    /genuine leather/i.test(
      combined
    )
  ) {
    requirements.push(
      "Material type: genuine leather"
    );
  }

  const applications =
    [];

  if (
    /shoe|sneaker|footwear/i.test(
      combined
    )
  ) {
    applications.push(
      "footwear"
    );
  }

  if (
    /upper/i.test(
      combined
    )
  ) {
    applications.push(
      "shoe upper"
    );
  }

  if (
    applications.length
  ) {
    requirements.push(
      `Application: ${unique(
        applications
      ).join(", ")}`
    );
  }

  if (
    !requirements.length &&
    requirement
  ) {
    requirements.push(
      requirement
    );
  }

  const tags =
    unique([
      product &&
        "product specified",

      quantity &&
        "quantity specified",

      targetPrice &&
        "target price specified",

      destination &&
        "destination specified",

      thickness &&
        "thickness specified",

      /full[\s-]?grain/i.test(
        combined
      ) &&
        "full-grain",

      /shoe|sneaker|footwear/i.test(
        combined
      ) &&
        "footwear",

      /upper/i.test(
        combined
      ) &&
        "shoe upper"
    ].filter(Boolean));

  return {
    requirement,
    product,
    quantity,
    targetPrice,
    destination,
    requirements,
    tags
  };
}

function calculateReadiness(
  analysis
) {
  const hasRequirement =
    Boolean(
      analysis.requirement
    );

  const hasProduct =
    Boolean(
      analysis.product
    );

  const hasQuantity =
    Boolean(
      analysis.quantity
    );

  const hasPrice =
    Boolean(
      analysis.targetPrice
    );

  const hasDestination =
    Boolean(
      analysis.destination
    );

  const hasSpecs =
    analysis.requirements.length >= 3;

  const clarity =
    hasRequirement
      ? 100
      : 0;

  const specification =
    Math.round(
      (
        Number(hasProduct) +
        Number(hasQuantity) +
        Number(hasDestination) +
        Number(hasSpecs)
      ) /
      4 *
      100
    );

  const commercial =
    Math.round(
      (
        Number(hasQuantity) +
        Number(hasPrice) +
        Number(hasDestination)
      ) /
      3 *
      100
    );

  const score =
    Math.round(
      clarity *
      0.35 +
      specification *
      0.40 +
      commercial *
      0.25
    );

  return {
    // v4.1.2 frontend compatibility aliases
    score,

    overallScore:
      score,

    totalScore:
      score,

    readinessScore:
      score,

    casevoScore:
      score,

    clarity,

    requirementsClarity:
      clarity,

    requirementClarity:
      clarity,

    specification,

    specificationQuality:
      specification,

    commercial,

    commercialReadiness:
      commercial,

    note:
      "Readiness reflects the completeness of the sourcing requirement, not supplier verification."
  };
}

function extractProduct(
  text
) {
  const value =
    clean(
      text
    ).toLowerCase();

  for (
    const [
      term,
      product
    ] of PRODUCT_TERMS
  ) {
    if (
      value.includes(
        term.toLowerCase()
      )
    ) {
      return product;
    }
  }

  return "";
}

function extractQuantity(
  text
) {
  const match =
    clean(
      text
    ).match(
      /(\d[\d,.\s]*)\s*(pairs?|pcs?|pieces?|kg|kgs|kilograms?|tons?|tonnes?|mt|sqm|sqft|square meters?|units?)/i
    );

  return match
    ? clean(
        match[0]
      )
    : "";
}

function extractPrice(
  text
) {
  const match =
    clean(
      text
    ).match(
      /(?:usd|us\$|\$)\s*[\d,.]+(?:\s*(?:per|\/)\s*[a-zA-Z0-9 ]+)?/i
    );

  return match
    ? clean(
        match[0]
      )
    : "";
}

function extractDestination(
  text
) {
  const value =
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
      value.includes(
        term
      )
    ) {
      return destination;
    }
  }

  return "";
}

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
    const signal of
    signals ||
    []
  ) {
    if (
      value.includes(
        String(
          signal
        ).toLowerCase()
      )
    ) {
      count +=
        1;
    }
  }

  return count;
}

function unique(
  values
) {
  return [
    ...new Set(
      (
        values ||
        []
      ).filter(Boolean)
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

function sanitizeWebText(
  value
) {
  return String(
    value ||
    ""
  )
    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      " "
    )

    .replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      " "
    )

    .replace(
      /!\[[^\]]*\]\([^)]+\)/g,
      " "
    )

    .replace(
      /\[([^\]]+)\]\([^)]+\)/g,
      "$1"
    )

    .replace(
      /https?:\/\/[^\s<>"']+/gi,
      " "
    )

    .replace(
      /www\.[^\s<>"']+/gi,
      " "
    )

    .replace(
      /<[^>]*>/g,
      " "
    )

    .replace(
      /&(?:amp|nbsp|quot|lt|gt|#39);/gi,
      " "
    )

    .replace(
      /(?:%[0-9A-Fa-f]{2}){8,}/g,
      " "
    )

    .replace(
      /[A-Za-z0-9+/]{120,}={0,2}/g,
      " "
    )

    .replace(
      /(.)\1{12,}/g,
      "$1$1$1"
    )

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

function normalizeUrl(
  value
) {
  try {
    let input =
      clean(
        value
      );

    if (!input) {
      return "";
    }

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

    const tracking = [
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

    if (!normalized) {
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

function getWebsiteRoot(
  url
) {
  try {
    const normalized =
      normalizeUrl(
        url
      );

    if (!normalized) {
      return "";
    }

    const parsed =
      new URL(
        normalized
      );

    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return "";
  }
}

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
      maxLength *
      0.60
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

async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

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
