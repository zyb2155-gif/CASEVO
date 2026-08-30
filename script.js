/* =========================================================
   CASEVO AI — FINAL FRONTEND SCRIPT
   Version: 4.0.0
   Purpose:
   - AI China sourcing request submission
   - Real supplier discovery result rendering
   - Robust response normalization
   - Form-value fallback protection
   - No invented supplier records
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     CONFIGURATION
     ========================================================= */

  const CONFIG = {
    VERSION: "4.0.0",

    /*
     * If your HTML already defines:
     *
     *   const API_ENDPOINT = "...";
     *
     * we use it automatically.
     *
     * You can also define:
     *
     *   window.CASEVO_API_ENDPOINT
     *
     * before this script.
     */
    endpoint:
      window.CASEVO_API_ENDPOINT ||
      window.API_ENDPOINT ||
      "/api/analyze",

    timeout: 45000,

    selectors: {
      form: [
        "#sourcing-form",
        "#sourcingForm",
        "form[data-sourcing-form]",
        "form"
      ],

      requirement: [
        "#requirement",
        "#sourcing-requirement",
        "#sourcingRequirement",
        "textarea[name='requirement']",
        "textarea[name='sourcingRequirement']",
        "textarea"
      ],

      product: [
        "#product",
        "#product-material",
        "#productMaterial",
        "input[name='product']",
        "input[name='productMaterial']"
      ],

      quantity: [
        "#quantity",
        "input[name='quantity']"
      ],

      targetPrice: [
        "#targetPrice",
        "#target-price",
        "input[name='targetPrice']",
        "input[name='target_price']"
      ],

      destination: [
        "#destination",
        "input[name='destination']"
      ],

      submit: [
        "#analyze-button",
        "#analyzeButton",
        "button[type='submit']",
        "input[type='submit']"
      ],

      result: [
        "#analysis-result",
        "#analysisResult",
        "#sourcing-result",
        "#sourcingResult",
        "[data-analysis-result]",
        "[data-sourcing-result]",
        ".analysis-result",
        ".sourcing-result"
      ],

      score: [
        "#casevo-score",
        "#casevoScore",
        "[data-casevo-score]"
      ],

      matches: [
        "#supplier-matches",
        "#supplierMatches",
        "[data-supplier-matches]"
      ]
    }
  };


  /* =========================================================
     STATE
     ========================================================= */

  const state = {
    submitting: false,
    lastRequestId: null,
    lastPayload: null,
    lastResponse: null
  };


  /* =========================================================
     BASIC HELPERS
     ========================================================= */

  function first(selectorList, root = document) {
    for (const selector of selectorList) {
      try {
        const element = root.querySelector(selector);

        if (element) {
          return element;
        }
      } catch (_) {
        // Ignore invalid selector and continue.
      }
    }

    return null;
  }


  function all(selectorList, root = document) {
    const found = [];

    for (const selector of selectorList) {
      try {
        root.querySelectorAll(selector).forEach((element) => {
          if (!found.includes(element)) {
            found.push(element);
          }
        });
      } catch (_) {
        // Ignore invalid selector.
      }
    }

    return found;
  }


  function clean(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }


  function escapeHtml(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function hasValue(value) {
    return clean(value).length > 0;
  }


  function displayValue(value, fallback = "Not specified") {
    return hasValue(value) ? escapeHtml(value) : fallback;
  }


  function generateRequestId() {
    const random =
      Math.random().toString(36).substring(2, 8).toUpperCase();

    const time =
      Date.now().toString(36).substring(0, 6).toUpperCase();

    return `CASEVO-${time}-${random}`;
  }


  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }


  /* =========================================================
     DOM DISCOVERY
     ========================================================= */

  function getForm() {
    return first(CONFIG.selectors.form);
  }


  function getFields() {
    return {
      requirement: first(CONFIG.selectors.requirement),
      product: first(CONFIG.selectors.product),
      quantity: first(CONFIG.selectors.quantity),
      targetPrice: first(CONFIG.selectors.targetPrice),
      destination: first(CONFIG.selectors.destination)
    };
  }


  function getSubmitButton() {
    return first(CONFIG.selectors.submit);
  }


  function getResultContainer() {
    return first(CONFIG.selectors.result);
  }


  /* =========================================================
     FORM READING
     ========================================================= */

  function readForm() {
    const fields = getFields();

    return {
      requirement: clean(fields.requirement?.value),
      product: clean(fields.product?.value),
      quantity: clean(fields.quantity?.value),
      targetPrice: clean(fields.targetPrice?.value),
      destination: clean(fields.destination?.value)
    };
  }


  /* =========================================================
     REQUIREMENT NORMALIZATION
     ========================================================= */

  function buildRequirement(payload) {
    if (hasValue(payload.requirement)) {
      return payload.requirement;
    }

    const parts = [];

    if (hasValue(payload.product)) {
      parts.push(`Product / Material: ${payload.product}`);
    }

    if (hasValue(payload.quantity)) {
      parts.push(`Quantity: ${payload.quantity}`);
    }

    if (hasValue(payload.targetPrice)) {
      parts.push(`Target Price: ${payload.targetPrice}`);
    }

    if (hasValue(payload.destination)) {
      parts.push(`Destination: ${payload.destination}`);
    }

    return parts.join(". ");
  }


  function buildPayload(formData) {
    const requirement = buildRequirement(formData);

    return {
      requirement,
      product: clean(formData.product),
      quantity: clean(formData.quantity),
      targetPrice: clean(formData.targetPrice),
      destination: clean(formData.destination)
    };
  }


  /* =========================================================
     VALIDATION
     ========================================================= */

  function validatePayload(payload) {
    if (!hasValue(payload.requirement)) {
      return {
        ok: false,
        message: "Please enter a sourcing requirement."
      };
    }

    return {
      ok: true,
      message: ""
    };
  }


  /* =========================================================
     RESULT CONTAINER
     ========================================================= */

  function ensureResultContainer() {
    let container = getResultContainer();

    if (container) {
      return container;
    }

    const form = getForm();

    if (!form) {
      return null;
    }

    container = document.createElement("section");

    container.id = "casevo-analysis-result";

    container.setAttribute(
      "data-analysis-result",
      "true"
    );

    container.style.marginTop = "32px";

    form.insertAdjacentElement(
      "afterend",
      container
    );

    return container;
  }


  /* =========================================================
     UI STATUS
     ========================================================= */

  function setButtonLoading(loading) {
    const button = getSubmitButton();

    if (!button) {
      return;
    }

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText =
          button.textContent || "Analyze & Find Matches";
      }

      button.disabled = true;
      button.setAttribute("aria-busy", "true");

      button.textContent = "Analyzing…";
      button.style.opacity = "0.7";
      button.style.cursor = "wait";
    } else {
      button.disabled = false;
      button.removeAttribute("aria-busy");

      button.textContent =
        button.dataset.originalText ||
        "Analyze & Find Matches";

      button.style.opacity = "";
      button.style.cursor = "";
    }
  }


  function showLoading() {
    const container = ensureResultContainer();

    if (!container) {
      return;
    }

    container.innerHTML = `
      <section
        class="casevo-result-loading"
        style="
          border:1px solid #d8d0c4;
          padding:28px;
          background:#f7f2e9;
          margin-top:24px;
        "
      >
        <div
          style="
            font-size:11px;
            letter-spacing:.16em;
            text-transform:uppercase;
            color:#b52d24;
            margin-bottom:12px;
          "
        >
          CASEVO AI / SOURCING ANALYSIS
        </div>

        <h2
          style="
            margin:0 0 12px;
            font-family:Georgia,serif;
            font-weight:500;
          "
        >
          Analyzing sourcing requirement…
        </h2>

        <p
          style="
            margin:0;
            color:#666;
          "
        >
          CASEVO is analyzing the requirement and searching available
          public supplier information.
        </p>
      </section>
    `;

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }


  /* =========================================================
     ERROR UI
     ========================================================= */

  function showError(message, requestId = null) {
    const container = ensureResultContainer();

    if (!container) {
      alert(message);
      return;
    }

    const safeMessage =
      hasValue(message)
        ? escapeHtml(message)
        : "Supplier discovery could not be completed.";

    const safeRequestId =
      requestId ||
      state.lastRequestId ||
      generateRequestId();

    container.innerHTML = `
      <section
        class="casevo-result-error"
        style="
          border:1px solid #c7352c;
          padding:28px;
          background:#f8f3eb;
          margin-top:24px;
        "
      >
        <div
          style="
            font-size:10px;
            letter-spacing:.18em;
            text-transform:uppercase;
            color:#b52d24;
            margin-bottom:12px;
          "
        >
          CASEVO AI / ERROR
        </div>

        <h2
          style="
            margin:0 0 10px;
            font-family:Georgia,serif;
            font-weight:500;
          "
        >
          Supplier discovery could not be completed.
        </h2>

        <p style="margin:0 0 14px;">
          ${safeMessage}
        </p>

        <div
          style="
            font-size:11px;
            color:#777;
          "
        >
          Request ID: ${escapeHtml(safeRequestId)}
        </div>
      </section>
    `;

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }


  /* =========================================================
     FETCH WITH TIMEOUT
     ========================================================= */

  async function fetchWithTimeout(
    url,
    options = {},
    timeout = CONFIG.timeout
  ) {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }


  /* =========================================================
     RESPONSE PARSING
     ========================================================= */

  async function parseResponse(response) {
    const contentType =
      response.headers.get("content-type") || "";

    if (
      contentType.includes("application/json") ||
      contentType.includes("+json")
    ) {
      return await response.json();
    }

    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch (_) {
      return {
        ok: response.ok,
        raw: text
      };
    }
  }


  /* =========================================================
     RESPONSE EXTRACTION
     ========================================================= */

  function unwrapResponse(data) {
    if (!data || typeof data !== "object") {
      return {};
    }

    /*
     * Cloudflare / API wrappers sometimes return:
     *
     * { result: {...} }
     *
     * or
     *
     * { data: {...} }
     *
     * or
     *
     * { response: {...} }
     */

    if (
      data.result &&
      typeof data.result === "object"
    ) {
      return data.result;
    }

    if (
      data.data &&
      typeof data.data === "object"
    ) {
      return data.data;
    }

    if (
      data.response &&
      typeof data.response === "object"
    ) {
      return data.response;
    }

    return data;
  }


  function getNested(object, paths) {
    for (const path of paths) {
      let current = object;

      for (const key of path.split(".")) {
        if (
          current === null ||
          current === undefined
        ) {
          current = undefined;
          break;
        }

        current = current[key];
      }

      if (
        current !== undefined &&
        current !== null &&
        clean(current) !== ""
      ) {
        return current;
      }
    }

    return null;
  }


  /* =========================================================
     SUPPLIER EXTRACTION
     ========================================================= */

  function extractMatches(data) {
    const candidates = [
      getNested(data, ["analysis.matches"]),
      getNested(data, ["matches"]),
      getNested(data, ["suppliers"]),
      getNested(data, ["supplierMatches"]),
      getNested(data, ["supplier_matches"]),
      getNested(data, ["results"]),
      getNested(data, ["analysis.suppliers"]),
      getNested(data, ["brief.matches"])
    ];

    for (const value of candidates) {
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }


  /* =========================================================
     NORMALIZED RESULT
     ========================================================= */

  function normalizeResult(raw, submitted) {
    const data = unwrapResponse(raw);

    const normalized =
      getNested(data, [
        "analysis.normalized",
        "normalized",
        "brief.normalized"
      ]) || {};

    const scoring =
      getNested(data, [
        "analysis.scoring",
        "scoring",
        "score",
        "casevoScore"
      ]);

    const matches = extractMatches(data);

    /*
     * IMPORTANT:
     *
     * The form submission is the authoritative fallback.
     *
     * This prevents:
     *
     * Product / Material: Not specified
     * Quantity: Not specified
     * Destination: Not specified
     *
     * when the backend returns the sourcing analysis
     * without repeating the submitted values.
     */

    const product =
      getNested(normalized, [
        "product",
        "productMaterial",
        "material"
      ]) ||
      getNested(data, [
        "product",
        "productMaterial",
        "material"
      ]) ||
      submitted.product ||
      "Sourcing Requirement";


    const quantity =
      getNested(normalized, [
        "quantity",
        "orderQuantity"
      ]) ||
      getNested(data, [
        "quantity",
        "orderQuantity"
      ]) ||
      submitted.quantity ||
      "";


    const targetPrice =
      getNested(normalized, [
        "targetPrice",
        "price",
        "target_price"
      ]) ||
      getNested(data, [
        "targetPrice",
        "price",
        "target_price"
      ]) ||
      submitted.targetPrice ||
      "";


    const destination =
      getNested(normalized, [
        "destination",
        "shipTo",
        "market"
      ]) ||
      getNested(data, [
        "destination",
        "shipTo",
        "market"
      ]) ||
      submitted.destination ||
      "";


    const requirement =
      getNested(data, [
        "requirement",
        "sourcingRequirement",
        "brief.requirement"
      ]) ||
      submitted.requirement ||
      "";


    return {
      raw: raw,
      data: data,

      ok:
        raw?.ok !== false &&
        data?.ok !== false,

      requestId:
        getNested(data, [
          "requestId",
          "request_id",
          "id"
        ]) ||
        raw?.requestId ||
        generateRequestId(),

      requirement,

      normalized: {
        product,
        quantity,
        targetPrice,
        destination
      },

      scoring,

      matches,

      provider:
        getNested(data, [
          "searchProvider",
          "search.provider",
          "provider"
        ]) ||
        "",

      verification:
        getNested(data, [
          "verification",
          "verificationStatus",
          "analysis.verification"
        ]) ||
        "",

      message:
        getNested(data, [
          "message",
          "statusMessage",
          "analysis.message"
        ]) ||
        ""
    };
  }


  /* =========================================================
     SCORE
     ========================================================= */

  function extractScore(result) {
    const scoring = result.scoring;

    if (
      typeof scoring === "number" &&
      Number.isFinite(scoring)
    ) {
      return scoring;
    }

    if (
      typeof scoring === "string" &&
      scoring.trim() !== ""
    ) {
      const parsed = Number(
        scoring.replace(/[^\d.]/g, "")
      );

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    if (
      scoring &&
      typeof scoring === "object"
    ) {
      const value =
        scoring.score ??
        scoring.total ??
        scoring.value ??
        scoring.casevoScore ??
        scoring.casevo_score;

      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    const direct =
      getNested(result.data, [
        "casevoScore",
        "casevo_score",
        "score",
        "analysis.score"
      ]);

    if (direct !== null) {
      const parsed = Number(
        String(direct).replace(/[^\d.]/g, "")
      );

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }


  /* =========================================================
     SUPPLIER CARD
     ========================================================= */

  function supplierName(supplier) {
    if (typeof supplier === "string") {
      return supplier;
    }

    return (
      supplier?.name ||
      supplier?.company ||
      supplier?.supplierName ||
      supplier?.supplier_name ||
      supplier?.manufacturer ||
      "Supplier"
    );
  }


  function supplierDescription(supplier) {
    if (typeof supplier === "string") {
      return "";
    }

    return (
      supplier?.description ||
      supplier?.summary ||
      supplier?.capability ||
      supplier?.evidence ||
      ""
    );
  }


  function supplierUrl(supplier) {
    if (!supplier || typeof supplier !== "object") {
      return "";
    }

    return (
      supplier.url ||
      supplier.website ||
      supplier.websiteUrl ||
      supplier.website_url ||
      ""
    );
  }


  function renderSupplierMatches(matches) {
    if (!Array.isArray(matches) || matches.length === 0) {
      return `
        <section
          class="casevo-supplier-empty"
          style="
            border-top:1px solid #d8d0c4;
            padding-top:26px;
            margin-top:28px;
          "
        >
          <div
            style="
              font-size:10px;
              letter-spacing:.18em;
              text-transform:uppercase;
              color:#b52d24;
              margin-bottom:12px;
            "
          >
            REAL SUPPLIER MATCHES
          </div>

          <h3
            style="
              margin:0 0 18px;
              font-family:Georgia,serif;
              font-size:27px;
              line-height:1.08;
              font-weight:500;
            "
          >
            No verified supplier matches were returned.
          </h3>

          <div
            style="
              border:1px solid #d8d0c4;
              padding:20px;
              background:#faf6ef;
            "
          >
            <strong>
              No verified supplier records were returned.
            </strong>

            <p
              style="
                margin:12px 0 0;
                line-height:1.6;
                color:#666;
              "
            >
              CASEVO completed the public-web sourcing analysis,
              but no verified supplier identity was returned for
              this request.
            </p>

            <p
              style="
                margin:12px 0 0;
                line-height:1.6;
                color:#666;
              "
            >
              Supplier identities, manufacturing capability,
              certifications and commercial contacts should be
              independently verified before placing an order.
            </p>
          </div>
        </section>
      `;
    }

    return `
      <section
        class="casevo-supplier-matches"
        style="
          border-top:1px solid #d8d0c4;
          padding-top:26px;
          margin-top:28px;
        "
      >
        <div
          style="
            font-size:10px;
            letter-spacing:.18em;
            text-transform:uppercase;
            color:#b52d24;
            margin-bottom:12px;
          "
        >
          REAL SUPPLIER MATCHES
        </div>

        <h3
          style="
            margin:0 0 20px;
            font-family:Georgia,serif;
            font-size:27px;
            line-height:1.08;
            font-weight:500;
          "
        >
          Potential suppliers found on the public web.
        </h3>

        <div>
          ${matches
            .map((supplier, index) => {
              const name = supplierName(supplier);
              const description =
                supplierDescription(supplier);
              const url = supplierUrl(supplier);

              return `
                <article
                  style="
                    border:1px solid #d8d0c4;
                    padding:20px;
                    background:#faf6ef;
                    margin-bottom:14px;
                  "
                >
                  <div
                    style="
                      font-size:10px;
                      color:#b52d24;
                      letter-spacing:.14em;
                      text-transform:uppercase;
                      margin-bottom:8px;
                    "
                  >
                    SUPPLIER ${index + 1}
                  </div>

                  <h4
                    style="
                      margin:0 0 8px;
                      font-family:Georgia,serif;
                      font-size:22px;
                      font-weight:500;
                    "
                  >
                    ${escapeHtml(name)}
                  </h4>

                  ${
                    hasValue(description)
                      ? `
                        <p
                          style="
                            margin:0;
                            line-height:1.6;
                            color:#555;
                          "
                        >
                          ${escapeHtml(description)}
                        </p>
                      `
                      : ""
                  }

                  ${
                    hasValue(url)
                      ? `
                        <p style="margin:14px 0 0;">
                          <a
                            href="${escapeHtml(url)}"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View public source →
                          </a>
                        </p>
                      `
                      : ""
                  }
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }


  /* =========================================================
     READINESS
     ========================================================= */

  function calculateReadiness(result) {
    const n = result.normalized;

    const requirementClarity =
      hasValue(result.requirement)
        ? "Ready"
        : "Incomplete";

    const specificationQuality =
      [
        n.product,
        n.quantity,
        n.targetPrice,
        n.destination
      ].filter(hasValue).length;

    const commercialReadiness =
      hasValue(n.quantity) &&
      hasValue(n.destination)
        ? "Ready"
        : "Partial";

    return {
      requirementClarity,
      specificationQuality,
      commercialReadiness
    };
  }


  function renderReadiness(result) {
    const readiness =
      calculateReadiness(result);

    /*
     * Static positioning is intentional.
     *
     * This prevents the black readiness panel from becoming
     * a floating overlay over the supplier result on smaller
     * screens.
     */

    return `
      <section
        class="casevo-readiness"
        style="
          border-top:1px solid #d8d0c4;
          margin-top:28px;
          padding-top:24px;
          position:relative;
          z-index:1;
          width:100%;
          box-sizing:border-box;
        "
      >
        <div
          style="
            font-size:10px;
            letter-spacing:.16em;
            text-transform:uppercase;
            color:#b52d24;
            margin-bottom:12px;
          "
        >
          SOURCING READINESS
        </div>

        <div
          style="
            border:1px solid #d8d0c4;
            background:#faf6ef;
          "
        >
          ${readinessRow(
            "Requirement clarity",
            readiness.requirementClarity
          )}

          ${readinessRow(
            "Specification quality",
            `${readiness.specificationQuality}/4`
          )}

          ${readinessRow(
            "Commercial readiness",
            readiness.commercialReadiness
          )}
        </div>
      </section>
    `;
  }


  function readinessRow(label, value) {
    return `
      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:20px;
          padding:16px 18px;
          border-bottom:1px solid #d8d0c4;
          background:#faf6ef;
          color:#111;
        "
      >
        <span>${escapeHtml(label)}</span>

        <strong
          style="
            font-weight:500;
            white-space:nowrap;
          "
        >
          ${escapeHtml(value)}
        </strong>
      </div>
    `;
  }


  /* =========================================================
     VERIFICATION NOTICE
     ========================================================= */

  function renderVerification(result) {
    return `
      <div
        style="
          border-top:1px solid #d8d0c4;
          margin-top:28px;
          padding-top:20px;
          font-size:11px;
          line-height:1.65;
          color:#666;
        "
      >
        <strong style="color:#444;">
          Verification notice:
        </strong>

        CASEVO public-web supplier discovery identifies
        potential supplier capabilities from public information.
        Company identity, manufacturing capability,
        certifications, pricing, MOQ, production capacity and
        contact information should be independently verified
        before placing an order.
      </div>
    `;
  }


  /* =========================================================
     RESULT RENDERING
     ========================================================= */

  function renderResult(result) {
    const container = ensureResultContainer();

    if (!container) {
      return;
    }

    const score = extractScore(result);

    const scoreDisplay =
      score === null
        ? "—"
        : Math.round(score);

    const normalized = result.normalized;

    const product =
      normalized.product ||
      "Sourcing Requirement";

    const quantity =
      normalized.quantity;

    const targetPrice =
      normalized.targetPrice;

    const destination =
      normalized.destination;

    const requestId =
      result.requestId ||
      state.lastRequestId;

    const matches =
      Array.isArray(result.matches)
        ? result.matches
        : [];

    const provider =
      result.provider ||
      "Public web search";

    container.innerHTML = `
      <section
        class="casevo-analysis-complete"
        style="
          border:1px solid #d8d0c4;
          padding:30px;
          background:#f8f3eb;
          margin-top:24px;
          box-sizing:border-box;
          width:100%;
        "
      >

        <div
          style="
            font-size:10px;
            letter-spacing:.18em;
            text-transform:uppercase;
            color:#b52d24;
            margin-bottom:12px;
          "
        >
          CASEVO AI / SOURCING ANALYSIS
        </div>

        <h2
          style="
            margin:0 0 10px;
            font-family:Georgia,serif;
            font-weight:500;
            font-size:34px;
            line-height:1.05;
          "
        >
          Real supplier discovery completed.
        </h2>

        <p
          style="
            margin:0 0 24px;
            color:#666;
          "
        >
          CASEVO supplier discovery completed successfully.
        </p>


        <!-- SCORE -->

        <div
          style="
            display:inline-block;
            border:1px solid #d0c5b6;
            padding:16px 20px;
            margin-bottom:26px;
            min-width:110px;
            background:#fbf7f0;
          "
        >
          <div
            style="
              font-size:9px;
              letter-spacing:.15em;
              text-transform:uppercase;
              color:#8a8176;
              margin-bottom:10px;
            "
          >
            CASEVO SCORE
          </div>

          <div
            style="
              font-size:24px;
              font-family:Georgia,serif;
            "
          >
            ${escapeHtml(String(scoreDisplay))}
            <span
              style="
                font-size:12px;
                font-family:Arial,sans-serif;
              "
            >
              /100
            </span>
          </div>
        </div>


        <!-- REQUIREMENT SUMMARY -->

        <div
          style="
            border:1px solid #d8d0c4;
            background:#faf6ef;
          "
        >

          ${summaryRow(
            "PRODUCT / MATERIAL",
            product
          )}

          ${summaryRow(
            "QUANTITY",
            quantity
          )}

          ${summaryRow(
            "TARGET PRICE",
            targetPrice
          )}

          ${summaryRow(
            "DESTINATION",
            destination
          )}

        </div>


        <!-- READINESS -->

        ${renderReadiness(result)}


        <!-- SUPPLIERS -->

        ${renderSupplierMatches(matches)}


        <!-- SEARCH INFORMATION -->

        <section
          style="
            border-top:1px solid #d8d0c4;
            margin-top:28px;
            padding-top:22px;
          "
        >

          <div
            style="
              font-size:10px;
              letter-spacing:.16em;
              text-transform:uppercase;
              color:#b52d24;
              margin-bottom:12px;
            "
          >
            SEARCH INFORMATION
          </div>

          <div
            style="
              font-size:11px;
              line-height:1.65;
              color:#666;
            "
          >
            Supplier data: ${escapeHtml(provider)}
            <br>
            CASEVO Request ID: ${escapeHtml(requestId)}
          </div>

        </section>


        <!-- VERIFICATION -->

        ${renderVerification(result)}


        <!-- REQUEST ID -->

        <div
          style="
            margin-top:22px;
            font-size:10px;
            color:#888;
          "
        >
          Request ID: ${escapeHtml(requestId)}
        </div>

      </section>
    `;

    /*
     * Remove accidental fixed-position readiness overlays
     * created by older CSS/scripts.
     */

    cleanupLegacyReadinessOverlays();

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }


  function summaryRow(label, value) {
    return `
      <div
        style="
          padding:18px 20px;
          border-bottom:1px solid #d8d0c4;
        "
      >

        <div
          style="
            font-size:9px;
            letter-spacing:.16em;
            text-transform:uppercase;
            color:#8a8176;
            margin-bottom:8px;
          "
        >
          ${escapeHtml(label)}
        </div>

        <div
          style="
            font-size:15px;
            color:#111;
          "
        >
          ${displayValue(value)}
        </div>

      </div>
    `;
  }


  /* =========================================================
     LEGACY UI CLEANUP
     ========================================================= */

  function cleanupLegacyReadinessOverlays() {
    /*
     * The screenshot showed a black floating panel caused by
     * the previous readiness component.
     *
     * We do not delete arbitrary page elements.
     *
     * Instead, we neutralize only elements that clearly look
     * like old CASEVO readiness overlays.
     */

    const candidates = all([
      ".casevo-readiness-overlay",
      ".casevo-readiness-popup",
      ".readiness-overlay",
      ".sourcing-readiness-overlay",
      "[data-casevo-readiness-overlay]"
    ]);

    candidates.forEach((element) => {
      element.style.position = "static";
      element.style.inset = "auto";
      element.style.zIndex = "1";
      element.style.transform = "none";
      element.style.width = "100%";
      element.style.maxWidth = "100%";
      element.style.boxSizing = "border-box";
    });
  }


  /* =========================================================
     API REQUEST
     ========================================================= */

  async function analyze(formData) {
    const payload = buildPayload(formData);

    const validation =
      validatePayload(payload);

    if (!validation.ok) {
      throw new Error(validation.message);
    }

    state.lastPayload = payload;
    state.lastRequestId = generateRequestId();

    const response = await fetchWithTimeout(
      CONFIG.endpoint,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },

        body: JSON.stringify(payload)
      }
    );

    const data =
      await parseResponse(response);

    if (!response.ok) {
      const serverMessage =
        getNested(data, [
          "error",
          "message",
          "errors.0.message"
        ]) ||
        "The sourcing analysis request failed.";

      throw new Error(
        clean(serverMessage)
      );
    }

    if (
      data &&
      data.ok === false
    ) {
      const message =
        getNested(data, [
          "error",
          "message"
        ]) ||
        "Supplier discovery could not be completed.";

      throw new Error(
        clean(message)
      );
    }

    return data;
  }


  /* =========================================================
     FORM SUBMIT
     ========================================================= */

  async function handleSubmit(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (state.submitting) {
      return false;
    }

    const formData = readForm();

    const payload =
      buildPayload(formData);

    const validation =
      validatePayload(payload);

    if (!validation.ok) {
      state.lastRequestId =
        generateRequestId();

      showError(
        validation.message,
        state.lastRequestId
      );

      return false;
    }

    state.submitting = true;

    setButtonLoading(true);

    showLoading();

    try {
      const raw =
        await analyze(formData);

      state.lastResponse = raw;

      const result =
        normalizeResult(
          raw,
          payload
        );

      /*
       * VERY IMPORTANT:
       *
       * Always preserve submitted values.
       *
       * If the API only returns analysis information,
       * the UI still shows:
       *
       * full-grain leather shoe upper
       * 5,000 pairs
       * United States
       *
       * instead of "Not specified".
       */

      result.normalized.product =
        result.normalized.product ||
        payload.product ||
        "Sourcing Requirement";

      result.normalized.quantity =
        result.normalized.quantity ||
        payload.quantity;

      result.normalized.targetPrice =
        result.normalized.targetPrice ||
        payload.targetPrice;

      result.normalized.destination =
        result.normalized.destination ||
        payload.destination;

      result.requirement =
        result.requirement ||
        payload.requirement;

      result.requestId =
        result.requestId ||
        state.lastRequestId;

      renderResult(result);

      return result;
    } catch (error) {
      console.error(
        "[CASEVO] Sourcing request failed:",
        error
      );

      const message =
        error?.name === "AbortError"
          ? "The sourcing analysis timed out. Please try again."
          : (
              error?.message ||
              "Supplier discovery could not be completed."
            );

      showError(
        message,
        state.lastRequestId
      );

      return null;
    } finally {
      state.submitting = false;

      setButtonLoading(false);
    }
  }


  /* =========================================================
     EVENT BINDING
     ========================================================= */

  function bindForm() {
    const form = getForm();

    if (!form) {
      console.warn(
        "[CASEVO] Sourcing form was not found."
      );

      return false;
    }

    /*
     * Prevent duplicate listeners when this script is
     * reloaded or injected more than once.
     */

    if (
      form.dataset.casevoBound === "true"
    ) {
      return true;
    }

    form.addEventListener(
      "submit",
      handleSubmit
    );

    form.dataset.casevoBound = "true";

    /*
     * Some existing pages use a button click handler
     * rather than a native form submit.
     */

    const button =
      getSubmitButton();

    if (
      button &&
      button.type !== "submit" &&
      button.dataset.casevoClickBound !== "true"
    ) {
      button.addEventListener(
        "click",
        handleSubmit
      );

      button.dataset.casevoClickBound = "true";
    }

    return true;
  }


  /* =========================================================
     INPUT AUTO-CLEANUP
     ========================================================= */

  function bindInputHelpers() {
    const fields = getFields();

    Object.values(fields).forEach((field) => {
      if (!field) {
        return;
      }

      field.addEventListener(
        "input",
        () => {
          field.removeAttribute(
            "aria-invalid"
          );
        }
      );
    });
  }


  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.CASEVO = window.CASEVO || {};

  window.CASEVO.version =
    CONFIG.VERSION;

  window.CASEVO.endpoint =
    CONFIG.endpoint;

  window.CASEVO.analyze =
    async function(input) {
      /*
       * Supports:
       *
       * CASEVO.analyze()
       *
       * CASEVO.analyze({
       *   requirement: "...",
       *   product: "...",
       *   quantity: "...",
       *   targetPrice: "...",
       *   destination: "..."
       * })
       */

      const formData =
        input &&
        typeof input === "object"
          ? {
              requirement:
                clean(input.requirement),

              product:
                clean(input.product),

              quantity:
                clean(input.quantity),

              targetPrice:
                clean(input.targetPrice),

              destination:
                clean(input.destination)
            }
          : readForm();

      const raw =
        await analyze(formData);

      const payload =
        buildPayload(formData);

      const result =
        normalizeResult(
          raw,
          payload
        );

      result.normalized.product =
        result.normalized.product ||
        payload.product ||
        "Sourcing Requirement";

      result.normalized.quantity =
        result.normalized.quantity ||
        payload.quantity;

      result.normalized.targetPrice =
        result.normalized.targetPrice ||
        payload.targetPrice;

      result.normalized.destination =
        result.normalized.destination ||
        payload.destination;

      renderResult(result);

      return result;
    };


  window.CASEVO.readForm =
    readForm;


  window.CASEVO.getState =
    function() {
      return {
        submitting:
          state.submitting,

        lastRequestId:
          state.lastRequestId,

        lastPayload:
          state.lastPayload,

        lastResponse:
          state.lastResponse
      };
    };


  /* =========================================================
     INITIALIZATION
     ========================================================= */

  function init() {
    bindForm();

    bindInputHelpers();

    cleanupLegacyReadinessOverlays();

    console.log(
      `[CASEVO AI] Frontend initialized — v${CONFIG.VERSION}`
    );

    console.log(
      "[CASEVO AI] API endpoint:",
      CONFIG.endpoint
    );
  }


  /* =========================================================
     DOM READY
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }


  /* =========================================================
     HANDLE DYNAMIC PAGE LOADING
     ========================================================= */

  let mutationTimer = null;

  const observer =
    new MutationObserver(() => {
      clearTimeout(
        mutationTimer
      );

      mutationTimer =
        setTimeout(() => {
          bindForm();
          bindInputHelpers();
          cleanupLegacyReadinessOverlays();
        }, 150);
    });


  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );


})();
