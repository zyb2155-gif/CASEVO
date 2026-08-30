/* ============================================================
   CASEVO AI SOURCING — FINAL FRONTEND
   ============================================================

   Purpose:
   - Read the CASEVO sourcing form
   - POST to /api/sourcing
   - Support the current Tavily Worker response format
   - Render supplier discovery results correctly
   - Keep the right-side analysis panel aligned
   - Never invent supplier information

   Current Worker endpoint:
   POST /api/sourcing
   ============================================================ */

(function () {
  "use strict";

  const API_ENDPOINT = "/api/sourcing";

  console.log("CASEVO: Final sourcing frontend loaded.");
  console.log("CASEVO API endpoint:", API_ENDPOINT);

  /* ==========================================================
     BASIC HELPERS
     ========================================================== */

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from(
      (root || document).querySelectorAll(selector)
    );
  }

  function clean(value) {
    if (value === null || typeof value === "undefined") {
      return "";
    }

    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function firstExisting(selectors, root) {
    for (const selector of selectors) {
      const element = qs(selector, root);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function textOf(element) {
    if (!element) return "";
    return clean(
      "value" in element
        ? element.value
        : element.textContent
    );
  }

  function firstNonEmpty() {
    for (const value of arguments) {
      const cleaned = clean(value);

      if (cleaned) {
        return cleaned;
      }
    }

    return "";
  }

  /* ==========================================================
     FORM DISCOVERY
     ========================================================== */

  function findSourcingForm() {
    const explicit = firstExisting([
      "#sourcing-form",
      "#sourcingForm",
      "#ai-sourcing-form",
      "#aiSourcingForm",
      "form[data-sourcing-form]"
    ]);

    if (explicit) {
      return explicit;
    }

    const forms = qsa("form");

    if (!forms.length) {
      return null;
    }

    const matchingForm = forms.find(function (form) {
      const text = clean(
        form.innerText || form.textContent || ""
      ).toLowerCase();

      return (
        text.includes("what are you sourcing") ||
        text.includes("product / material") ||
        text.includes("quantity") ||
        text.includes("target price") ||
        text.includes("destination")
      );
    });

    return matchingForm || forms[0];
  }

  const form = findSourcingForm();

  if (!form) {
    console.warn("CASEVO: sourcing form not found.");
    return;
  }

  /* ==========================================================
     FIELD DISCOVERY
     ========================================================== */

  function findTextarea() {
    return firstExisting(
      [
        "#requirement",
        "#requirements",
        "#sourcing-requirement",
        "#sourcingRequirement",
        "#brief",
        "#sourcingBrief",
        'textarea[name="requirement"]',
        'textarea[name="requirements"]',
        'textarea[name="request"]',
        'textarea[name="brief"]',
        "textarea"
      ],
      form
    );
  }

  function findInput(names, ids, labelWords) {
    const selectors = [];

    (ids || []).forEach(function (id) {
      selectors.push(id);
    });

    (names || []).forEach(function (name) {
      selectors.push(
        'input[name="' + name + '"]'
      );
    });

    const direct = firstExisting(
      selectors,
      form
    );

    if (direct) {
      return direct;
    }

    const inputs = qsa(
      "input",
      form
    );

    const matching = inputs.find(function (input) {
      const text = (
        clean(input.name) +
        " " +
        clean(input.id) +
        " " +
        clean(input.placeholder)
      ).toLowerCase();

      return (labelWords || []).some(function (word) {
        return text.includes(word.toLowerCase());
      });
    });

    return matching || null;
  }

  const requirementField = findTextarea();

  const productField = findInput(
    [
      "product",
      "material",
      "product_material"
    ],
    [
      "#product",
      "#product-material",
      "#productMaterial"
    ],
    [
      "product",
      "material"
    ]
  );

  const quantityField = findInput(
    ["quantity"],
    ["#quantity"],
    ["quantity"]
  );

  const targetPriceField = findInput(
    [
      "target_price",
      "targetPrice",
      "price"
    ],
    [
      "#target-price",
      "#targetPrice",
      "#price"
    ],
    [
      "price",
      "target"
    ]
  );

  const destinationField = findInput(
    ["destination"],
    ["#destination"],
    ["destination"]
  );

  /* ==========================================================
     BUTTON
     ========================================================== */

  let submitButton = firstExisting(
    [
      "#analyze-button",
      "#analyzeButton",
      "#find-matches",
      "#findMatches",
      "button[type='submit']",
      "input[type='submit']"
    ],
    form
  );

  if (!submitButton) {
    submitButton = qsa(
      "button",
      form
    ).find(function (button) {
      return /analy|match|source|find/i.test(
        button.textContent || ""
      );
    });
  }

  /* ==========================================================
     RESULT CONTAINER
     ========================================================== */

  let resultContainer = qs(
    "#casevo-results"
  );

  if (!resultContainer) {
    resultContainer = document.createElement("div");

    resultContainer.id = "casevo-results";

    /*
     * Important:
     * The form already sits inside the CASEVO two-column
     * layout. The result container becomes the second column.
     */
    form.insertAdjacentElement(
      "afterend",
      resultContainer
    );
  }

  /* ==========================================================
     FINAL RESULT CSS
     ========================================================== */

  function injectStyles() {
    if (qs("#casevo-final-runtime-styles")) {
      return;
    }

    const style = document.createElement("style");

    style.id =
      "casevo-final-runtime-styles";

    style.textContent = `
      #casevo-results {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        align-self: start;
        margin: 0;
      }

      #casevo-results *,
      #casevo-results *::before,
      #casevo-results *::after {
        box-sizing: border-box;
      }

      .casevo-result-panel {
        width: 100%;
        min-width: 0;
        border: 1px solid #d8cdbd;
        background: #f8f1e6;
        color: #171512;
        padding: 28px;
        overflow: hidden;
      }

      .casevo-kicker {
        color: #b42f24;
        font-size: 9px;
        line-height: 1.4;
        letter-spacing: 2px;
        text-transform: uppercase;
        margin-bottom: 10px;
      }

      .casevo-result-title {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 30px;
        line-height: 1.02;
        font-weight: 400;
        letter-spacing: -0.5px;
      }

      .casevo-result-subtitle {
        margin-top: 12px;
        font-size: 12px;
        line-height: 1.55;
        color: #635c54;
      }

      .casevo-score {
        margin-top: 22px;
        border: 1px solid #cdbfae;
        background: #fffaf3;
        padding: 16px;
      }

      .casevo-score-label {
        font-size: 8px;
        line-height: 1.4;
        letter-spacing: 1.6px;
        text-transform: uppercase;
        color: #82796f;
        margin-bottom: 8px;
      }

      .casevo-score-value {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 28px;
        line-height: 1;
      }

      .casevo-score-value span {
        font-family: Arial, sans-serif;
        font-size: 11px;
        color: #625b53;
      }

      .casevo-info {
        margin-top: 24px;
        background: #fffaf3;
        border: 1px solid #ddd2c2;
      }

      .casevo-info-row {
        padding: 15px 14px;
        border-bottom: 1px solid #ddd2c2;
      }

      .casevo-info-row:last-child {
        border-bottom: 0;
      }

      .casevo-info-label {
        font-size: 8px;
        line-height: 1.4;
        letter-spacing: 1.5px;
        color: #82796f;
        text-transform: uppercase;
        margin-bottom: 6px;
      }

      .casevo-info-value {
        font-size: 12px;
        line-height: 1.45;
        color: #171512;
        overflow-wrap: anywhere;
      }

      .casevo-section {
        margin-top: 28px;
        padding-top: 22px;
        border-top: 1px solid #d8cdbd;
      }

      .casevo-section-kicker {
        color: #b42f24;
        font-size: 8px;
        line-height: 1.4;
        letter-spacing: 1.7px;
        text-transform: uppercase;
        margin-bottom: 9px;
      }

      .casevo-section-title {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 22px;
        line-height: 1.08;
        font-weight: 400;
      }

      .casevo-readiness {
        margin-top: 14px;
        border: 1px solid #ddd2c2;
        background: #fffaf3;
      }

      .casevo-readiness-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px;
        border-bottom: 1px solid #ddd2c2;
      }

      .casevo-readiness-row:last-child {
        border-bottom: 0;
      }

      .casevo-readiness-name {
        font-size: 11px;
        line-height: 1.4;
        color: #292622;
      }

      .casevo-readiness-score {
        flex: 0 0 auto;
        font-size: 11px;
        font-weight: 600;
        color: #171512;
      }

      .casevo-readiness-note {
        margin-top: 10px;
        font-size: 10px;
        line-height: 1.55;
        color: #716960;
      }

      .casevo-supplier {
        margin-top: 14px;
        padding: 16px;
        border: 1px solid #ddd2c2;
        background: #fffaf3;
      }

      .casevo-supplier + .casevo-supplier {
        margin-top: 10px;
      }

      .casevo-supplier-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .casevo-supplier-rank {
        font-size: 8px;
        letter-spacing: 1px;
        color: #b42f24;
        text-transform: uppercase;
        margin-bottom: 5px;
      }

      .casevo-supplier-name {
        font-size: 14px;
        line-height: 1.3;
        font-weight: 600;
        overflow-wrap: anywhere;
      }

      .casevo-supplier-location {
        margin-top: 5px;
        font-size: 10px;
        color: #756d64;
      }

      .casevo-match {
        flex: 0 0 auto;
        text-align: right;
        font-size: 17px;
        font-weight: 600;
        white-space: nowrap;
      }

      .casevo-match-label {
        display: block;
        font-size: 7px;
        line-height: 1.4;
        letter-spacing: 1px;
        color: #82796f;
        text-transform: uppercase;
        margin-bottom: 3px;
      }

      .casevo-capability {
        margin-top: 12px;
        font-size: 10px;
        line-height: 1.55;
        color: #625b53;
      }

      .casevo-evidence {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #e6ddd2;
        font-size: 9px;
        line-height: 1.55;
        color: #716960;
      }

      .casevo-supplier-link {
        display: inline-block;
        margin-top: 12px;
        color: #9f2b22;
        font-size: 10px;
        text-decoration: none;
        border-bottom: 1px solid #c9a59e;
        padding-bottom: 2px;
      }

      .casevo-supplier-link:hover {
        color: #6f1f19;
      }

      .casevo-verification {
        margin-top: 10px;
        font-size: 8px;
        line-height: 1.5;
        color: #8a7068;
      }

      .casevo-empty {
        margin-top: 14px;
        padding: 18px;
        border: 1px solid #ddd2c2;
        background: #fffaf3;
        font-size: 10px;
        line-height: 1.6;
        color: #625b53;
      }

      .casevo-meta {
        margin-top: 22px;
        padding-top: 15px;
        border-top: 1px solid #d8cdbd;
        font-size: 8px;
        line-height: 1.6;
        color: #83796e;
        overflow-wrap: anywhere;
      }

      .casevo-error {
        width: 100%;
        border: 1px solid #d64a3d;
        background: #fff9f7;
        padding: 24px;
        color: #8f2f24;
      }

      .casevo-error-title {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 25px;
        line-height: 1.05;
        font-weight: 400;
      }

      .casevo-error-text {
        margin-top: 10px;
        font-size: 11px;
        line-height: 1.6;
        color: #5f4944;
      }

      .casevo-loading {
        width: 100%;
        border: 1px solid #d8cdbd;
        background: #f8f1e6;
        padding: 30px 24px;
      }

      .casevo-loading-title {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 24px;
        line-height: 1.1;
        font-weight: 400;
      }

      @media (max-width: 900px) {
        #casevo-results {
          margin-top: 24px;
        }

        .casevo-result-panel {
          padding: 22px;
        }

        .casevo-result-title {
          font-size: 27px;
        }
      }

      @media (max-width: 600px) {
        .casevo-result-panel {
          padding: 18px;
        }

        .casevo-supplier-top {
          display: block;
        }

        .casevo-match {
          margin-top: 10px;
          text-align: left;
        }
      }
    `;

    document.head.appendChild(style);
  }

  injectStyles();

  /* ==========================================================
     FORM VALUES
     ========================================================== */

  function getFormValues() {
    return {
      requirement: textOf(requirementField),
      product: textOf(productField),
      quantity: textOf(quantityField),
      targetPrice: textOf(targetPriceField),
      destination: textOf(destinationField)
    };
  }

  /* ==========================================================
     SIMPLE PRODUCT EXTRACTION FALLBACK
     ========================================================== */

  function extractProduct(requirement) {
    const text = clean(requirement);

    if (!text) {
      return "";
    }

    const lower = text.toLowerCase();

    const phrases = [
      "full-grain leather shoe upper",
      "full grain leather shoe upper",
      "leather shoe upper",
      "shoe upper",
      "upper leather",
      "genuine leather",
      "cow leather",
      "leather",
      "sneaker",
      "footwear",
      "rubber",
      "textile",
      "fabric"
    ];

    for (const phrase of phrases) {
      if (lower.includes(phrase)) {
        return phrase;
      }
    }

    return "";
  }

  /* ==========================================================
     QUANTITY FALLBACK
     ========================================================== */

  function extractQuantity(requirement) {
    const text = clean(requirement);

    const match = text.match(
      /(\d[\d,.\s]*)\s*(pairs?|pcs?|pieces?|kg|tons?|mt|sqm|sqft|units?)/i
    );

    return match
      ? clean(match[0])
      : "";
  }

  /* ==========================================================
     PRICE FALLBACK
     ========================================================== */

  function extractPrice(requirement) {
    const text = clean(requirement);

    const match = text.match(
      /(?:usd|us\$|\$)\s*[\d,.]+(?:\s*(?:per|\/)\s*[a-zA-Z0-9 ]+)?/i
    );

    return match
      ? clean(match[0])
      : "";
  }

  /* ==========================================================
     DESTINATION FALLBACK
     ========================================================== */

  function extractDestination(requirement) {
    const text = clean(requirement);
    const lower = text.toLowerCase();

    const destinations = [
      "United States",
      "USA",
      "United Kingdom",
      "UK",
      "Canada",
      "Australia",
      "Germany",
      "France",
      "Italy",
      "Spain",
      "Japan",
      "South Korea",
      "Singapore",
      "India",
      "Vietnam",
      "Indonesia",
      "Thailand",
      "Turkey",
      "Mexico",
      "Brazil",
      "UAE",
      "Saudi Arabia"
    ];

    for (const destination of destinations) {
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

  /* ==========================================================
     SCORE
     ========================================================== */

  function calculateReadiness(values) {
    const requirement = clean(
      values.requirement
    );

    const product = clean(
      values.product
    ) || extractProduct(requirement);

    const quantity = clean(
      values.quantity
    ) || extractQuantity(requirement);

    const targetPrice = clean(
      values.targetPrice
    ) || extractPrice(requirement);

    const destination = clean(
      values.destination
    ) || extractDestination(requirement);

    let clarity = 20;
    let specification = 15;
    let commercial = 20;

    if (requirement.length >= 20) {
      clarity += 20;
    }

    if (product) {
      clarity += 15;
      specification += 10;
    }

    if (
      /1\.?\s*4\s*mm|thickness|mm\b/i.test(
        requirement
      )
    ) {
      specification += 20;
    }

    if (
      /full[- ]?grain|grain|genuine leather|leather/i.test(
        requirement
      )
    ) {
      specification += 10;
    }

    if (
      /black|brown|white|red|blue|color|colour/i.test(
        requirement
      )
    ) {
      specification += 5;
    }

    if (quantity) {
      commercial += 20;
    }

    if (targetPrice) {
      commercial += 20;
    }

    if (destination) {
      commercial += 15;
    }

    clarity = Math.min(
      100,
      clarity
    );

    specification = Math.min(
      100,
      specification
    );

    commercial = Math.min(
      100,
      commercial
    );

    const score = Math.round(
      (
        clarity +
        specification +
        commercial
      ) / 3
    );

    return {
      score,
      clarity,
      specification,
      commercial
    };
  }

  /* ==========================================================
     NORMALIZE API RESPONSE
     ========================================================== */

  function normalizeApiResponse(
    data,
    formValues
  ) {
    const root = data || {};

    const brief =
      root.brief || {};

    const analysis =
      root.analysis || {};

    /*
     * Current Tavily Worker:
     *
     * analysis.product
     * analysis.quantity
     * analysis.targetPrice
     * analysis.destination
     *
     * Older Worker:
     *
     * analysis.normalized.product
     * analysis.normalized.quantity
     * analysis.normalized.targetPrice
     * analysis.normalized.destination
     */

    const normalized =
      analysis.normalized || {};

    const requirement =
      firstNonEmpty(
        analysis.requirement,
        brief.requirement,
        formValues.requirement
      );

    const product =
      firstNonEmpty(
        normalized.product,
        analysis.product,
        brief.product,
        formValues.product,
        extractProduct(requirement)
      );

    const quantity =
      firstNonEmpty(
        normalized.quantity,
        analysis.quantity,
        brief.quantity,
        formValues.quantity,
        extractQuantity(requirement)
      );

    const targetPrice =
      firstNonEmpty(
        normalized.targetPrice,
        normalized.target_price,
        analysis.targetPrice,
        analysis.target_price,
        brief.targetPrice,
        brief.target_price,
        formValues.targetPrice,
        extractPrice(requirement)
      );

    const destination =
      firstNonEmpty(
        normalized.destination,
        analysis.destination,
        brief.destination,
        formValues.destination,
        extractDestination(requirement)
      );

    let matches = [];

    if (
      Array.isArray(root.matches)
    ) {
      matches = root.matches;
    } else if (
      Array.isArray(analysis.matches)
    ) {
      matches = analysis.matches;
    } else if (
      Array.isArray(normalized.matches)
    ) {
      matches = normalized.matches;
    }

    const oldScoring =
      analysis.scoring ||
      root.scoring ||
      {};

    const calculated =
      calculateReadiness({
        requirement,
        product,
        quantity,
        targetPrice,
        destination
      });

    const score =
      oldScoring.score ??
      root.score ??
      analysis.score ??
      calculated.score;

    const clarity =
      oldScoring.clarity ??
      calculated.clarity;

    const specification =
      oldScoring.specification ??
      oldScoring.specificationQuality ??
      calculated.specification;

    const commercial =
      oldScoring.commercial ??
      oldScoring.commercialReadiness ??
      calculated.commercial;

    return {
      requestId:
        firstNonEmpty(
          root.requestId,
          root.request_id
        ),

      message:
        firstNonEmpty(
          root.message
        ),

      requirement,
      product,
      quantity,
      targetPrice,
      destination,

      score,
      clarity,
      specification,
      commercial,

      scoringNote:
        firstNonEmpty(
          oldScoring.note,
          root.scoringNote
        ),

      matches,

      meta:
        root.meta || {}
    };
  }

  /* ==========================================================
     LOADING
     ========================================================== */

  function setButtonLoading(
    loading
  ) {
    if (!submitButton) {
      return;
    }

    if (loading) {
      if (
        !submitButton.dataset.casevoOriginalText
      ) {
        submitButton.dataset.casevoOriginalText =
          submitButton.tagName.toLowerCase() ===
          "input"
            ? (
                submitButton.value ||
                "Analyze & Find Matches"
              )
            : (
                submitButton.innerText ||
                "Analyze & Find Matches"
              );
      }

      submitButton.disabled = true;
      submitButton.style.opacity = "0.65";
      submitButton.style.cursor = "wait";

      if (
        submitButton.tagName.toLowerCase() ===
        "input"
      ) {
        submitButton.value =
          "Analyzing...";
      } else {
        submitButton.innerText =
          "Analyzing...";
      }

    } else {
      submitButton.disabled = false;
      submitButton.style.opacity = "";
      submitButton.style.cursor = "";

      const original =
        submitButton.dataset.casevoOriginalText ||
        "Analyze & Find Matches";

      if (
        submitButton.tagName.toLowerCase() ===
        "input"
      ) {
        submitButton.value =
          original;
      } else {
        submitButton.innerText =
          original;
      }
    }
  }

  /* ==========================================================
     RENDER LOADING
     ========================================================== */

  function renderLoading() {
    resultContainer.innerHTML = `
      <div class="casevo-loading">

        <div class="casevo-kicker">
          CASEVO AI / SOURCING ANALYSIS
        </div>

        <h2 class="casevo-loading-title">
          Analyzing sourcing requirement.
        </h2>

        <div class="casevo-result-subtitle">
          Searching public supplier information and
          structuring the sourcing request.
        </div>

      </div>
    `;
  }

  /* ==========================================================
     RENDER ERROR
     ========================================================== */

  function renderError(
    message,
    requestId
  ) {
    const safeMessage =
      firstNonEmpty(
        message,
        "The sourcing analysis request failed."
      );

    resultContainer.innerHTML = `
      <div class="casevo-error">

        <div class="casevo-kicker">
          CASEVO AI / ERROR
        </div>

        <h2 class="casevo-error-title">
          Supplier discovery could not be completed.
        </h2>

        <div class="casevo-error-text">
          ${escapeHtml(safeMessage)}
        </div>

        ${
          requestId
            ? `
              <div class="casevo-meta">
                Request ID:
                ${escapeHtml(requestId)}
              </div>
            `
            : ""
        }

      </div>
    `;
  }

  /* ==========================================================
     INFO ROW
     ========================================================== */

  function infoRow(
    label,
    value
  ) {
    return `
      <div class="casevo-info-row">

        <div class="casevo-info-label">
          ${escapeHtml(label)}
        </div>

        <div class="casevo-info-value">
          ${escapeHtml(
            value || "Not specified"
          )}
        </div>

      </div>
    `;
  }

  /* ==========================================================
     READINESS ROW
     ========================================================== */

  function readinessRow(
    label,
    value
  ) {
    return `
      <div class="casevo-readiness-row">

        <div class="casevo-readiness-name">
          ${escapeHtml(label)}
        </div>

        <div class="casevo-readiness-score">
          ${escapeHtml(value)}%
        </div>

      </div>
    `;
  }

  /* ==========================================================
     SUPPLIER MATCH
     ========================================================== */

  function renderSupplier(
    match,
    index
  ) {
    const supplier =
      match || {};

    const name =
      firstNonEmpty(
        supplier.name,
        supplier.title,
        supplier.company,
        supplier.domain,
        `Supplier result ${index + 1}`
      );

    const location =
      firstNonEmpty(
        supplier.location,
        "Not determined"
      );

    const website =
      firstNonEmpty(
        supplier.website,
        supplier.url
      );

    const domain =
      firstNonEmpty(
        supplier.domain
      );

    const score =
      supplier.matchScore ??
      supplier.match_score ??
      supplier.score ??
      "—";

    const capability =
      firstNonEmpty(
        supplier.capability,
        supplier.note,
        supplier.description
      );

    const evidence =
      firstNonEmpty(
        supplier.evidence,
        supplier.content
      );

    const verification =
      firstNonEmpty(
        supplier.verificationStatus,
        supplier.verification_status,
        "Unverified — due diligence required"
      );

    return `
      <div class="casevo-supplier">

        <div class="casevo-supplier-top">

          <div>

            <div class="casevo-supplier-rank">
              SUPPLIER ${index + 1}
            </div>

            <div class="casevo-supplier-name">
              ${escapeHtml(name)}
            </div>

            <div class="casevo-supplier-location">
              ${escapeHtml(location)}
            </div>

          </div>

          <div class="casevo-match">

            <span class="casevo-match-label">
              Match
            </span>

            ${escapeHtml(score)}%

          </div>

        </div>

        ${
          capability
            ? `
              <div class="casevo-capability">
                ${escapeHtml(capability)}
              </div>
            `
            : ""
        }

        ${
          evidence
            ? `
              <div class="casevo-evidence">
                ${escapeHtml(evidence)}
              </div>
            `
            : ""
        }

        ${
          website
            ? `
              <a
                class="casevo-supplier-link"
                href="${escapeHtml(website)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit supplier website →
              </a>
            `
            : domain
              ? `
                <div class="casevo-evidence">
                  Source domain:
                  ${escapeHtml(domain)}
                </div>
              `
              : ""
        }

        <div class="casevo-verification">
          ${escapeHtml(verification)}
        </div>

      </div>
    `;
  }

  /* ==========================================================
     RENDER RESULT
     ========================================================== */

  function renderResult(
    data,
    formValues
  ) {
    const result =
      normalizeApiResponse(
        data,
        formValues
      );

    const hasMatches =
      Array.isArray(result.matches) &&
      result.matches.length > 0;

    const matchTitle =
      hasMatches
        ? `${result.matches.length} supplier result${
            result.matches.length === 1
              ? ""
              : "s"
          } returned.`
        : "No verified supplier matches were returned.";

    const supplierHtml =
      hasMatches
        ? result.matches
            .slice(0, 10)
            .map(function (match, index) {
              return renderSupplier(
                match,
                index
              );
            })
            .join("")
        : `
            <div class="casevo-empty">

              <strong>
                No verified supplier records were returned.
              </strong>

              <div style="margin-top:8px;">
                CASEVO completed the public-web sourcing
                analysis, but no verified supplier identity
                was returned for this request.
              </div>

              <div style="margin-top:8px;">
                Supplier identity, manufacturing capability,
                certifications and commercial contacts should
                be independently verified before placing an order.
              </div>

            </div>
          `;

    const verificationNote =
      firstNonEmpty(
        result.meta.verificationNote,
        "Public-web supplier results are discovery leads, not commercial verification."
      );

    const searchProvider =
      firstNonEmpty(
        result.meta.supplierData,
        result.meta.source,
        "Public web search"
      );

    resultContainer.innerHTML = `
      <div class="casevo-result-panel">

        <!-- =================================================
             HEADER
             ================================================= -->

        <div class="casevo-kicker">
          CASEVO AI / SOURCING ANALYSIS
        </div>

        <h2 class="casevo-result-title">
          Real supplier<br>
          discovery completed.
        </h2>

        <div class="casevo-result-subtitle">
          CASEVO supplier discovery completed successfully.
        </div>

        <!-- =================================================
             SCORE
             ================================================= -->

        <div class="casevo-score">

          <div class="casevo-score-label">
            CASEVO SCORE
          </div>

          <div class="casevo-score-value">
            ${escapeHtml(result.score)}
            <span>/100</span>
          </div>

        </div>

        <!-- =================================================
             SOURCING REQUIREMENT
             ================================================= -->

        <div class="casevo-info">

          ${infoRow(
            "PRODUCT / MATERIAL",
            result.product
          )}

          ${infoRow(
            "QUANTITY",
            result.quantity
          )}

          ${infoRow(
            "TARGET PRICE",
            result.targetPrice
          )}

          ${infoRow(
            "DESTINATION",
            result.destination
          )}

        </div>

        <!-- =================================================
             SOURCING READINESS
             ================================================= -->

        <div class="casevo-section">

          <div class="casevo-section-kicker">
            SOURCING READINESS
          </div>

          <div class="casevo-readiness">

            ${readinessRow(
              "Requirement clarity",
              result.clarity
            )}

            ${readinessRow(
              "Specification quality",
              result.specification
            )}

            ${readinessRow(
              "Commercial readiness",
              result.commercial
            )}

          </div>

          ${
            result.scoringNote
              ? `
                <div class="casevo-readiness-note">
                  ${escapeHtml(
                    result.scoringNote
                  )}
                </div>
              `
              : ""
          }

        </div>

        <!-- =================================================
             REAL SUPPLIER MATCHES
             ================================================= -->

        <div class="casevo-section">

          <div class="casevo-section-kicker">
            REAL SUPPLIER MATCHES
          </div>

          <h3 class="casevo-section-title">
            ${escapeHtml(matchTitle)}
          </h3>

          ${supplierHtml}

        </div>

        <!-- =================================================
             SEARCH INFORMATION
             ================================================= -->

        <div class="casevo-section">

          <div class="casevo-section-kicker">
            SEARCH INFORMATION
          </div>

          <div class="casevo-meta">

            <div>
              Supplier data:
              ${escapeHtml(searchProvider)}
            </div>

            ${
              result.meta.searchQuery
                ? `
                  <div style="margin-top:5px;">
                    Search query:
                    ${escapeHtml(
                      result.meta.searchQuery
                    )}
                  </div>
                `
                : ""
            }

            ${
              result.meta.tavilyRequestId
                ? `
                  <div style="margin-top:5px;">
                    Search request:
                    ${escapeHtml(
                      result.meta.tavilyRequestId
                    )}
                  </div>
                `
                : ""
            }

            <div style="margin-top:10px;">
              Verification notice:
              ${escapeHtml(
                verificationNote
              )}
            </div>

            ${
              result.requestId
                ? `
                  <div style="margin-top:10px;">
                    Request ID:
                    ${escapeHtml(
                      result.requestId
                    )}
                  </div>
                `
                : ""
            }

          </div>

        </div>

      </div>
    `;
  }

  /* ==========================================================
     API REQUEST
     ========================================================== */

  async function sendToWorker(
    values
  ) {
    console.log(
      "CASEVO: Sending sourcing request:",
      values
    );

    const response =
      await fetch(
        API_ENDPOINT,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            "Accept":
              "application/json"
          },

          body: JSON.stringify({
            requirement:
              values.requirement,

            product:
              values.product,

            quantity:
              values.quantity,

            targetPrice:
              values.targetPrice,

            destination:
              values.destination
          })
        }
      );

    console.log(
      "CASEVO: Worker HTTP status:",
      response.status
    );

    const rawText =
      await response.text();

    let data;

    try {
      data =
        JSON.parse(rawText);
    } catch (error) {
      console.error(
        "CASEVO: Invalid JSON:",
        rawText
      );

      throw new Error(
        "CASEVO server returned an invalid response."
      );
    }

    console.log(
      "CASEVO: Worker response:",
      data
    );

    if (
      !response.ok ||
      data.ok === false
    ) {
      throw new Error(
        firstNonEmpty(
          data.error,
          data.message,
          "Unable to complete supplier discovery."
        )
      );
    }

    return data;
  }

  /* ==========================================================
     SUBMIT
     ========================================================== */

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    const values =
      getFormValues();

    console.log(
      "CASEVO: Form values:",
      values
    );

    /*
     * Requirement is the primary field.
     *
     * The current Worker requires it.
     */
    if (!values.requirement) {
      renderError(
        "Please enter a sourcing requirement."
      );

      if (requirementField) {
        requirementField.focus();
      }

      return;
    }

    setButtonLoading(true);

    renderLoading();

    try {
      const data =
        await sendToWorker(
          values
        );

      renderResult(
        data,
        values
      );

      console.log(
        "CASEVO: Supplier discovery completed.",
        data
      );

    } catch (error) {
      console.error(
        "CASEVO: Supplier discovery failed:",
        error
      );

      renderError(
        error.message ||
          "Unable to connect to the CASEVO sourcing engine."
      );

    } finally {
      setButtonLoading(false);
    }
  }

  /* ==========================================================
     FORM BINDING
     ========================================================== */

  /*
   * Remove our previous listener if this script is
   * accidentally loaded twice.
   */
  if (
    form.dataset.casevoFinalBound ===
    "true"
  ) {
    console.warn(
      "CASEVO: Form already bound."
    );

    return;
  }

  form.dataset.casevoFinalBound =
    "true";

  form.addEventListener(
    "submit",
    handleSubmit
  );

  /*
   * Some site builders use a normal button instead
   * of native form submission.
   *
   * We only trigger submit when the button is not
   * already type=submit.
   */
  if (
    submitButton &&
    submitButton.tagName.toLowerCase() ===
      "button" &&
    submitButton.type !== "submit"
  ) {
    submitButton.addEventListener(
      "click",
      function () {
        form.requestSubmit();
      }
    );
  }

  /* ==========================================================
     PUBLIC CASEVO API
     ========================================================== */

  window.CASEVO =
    window.CASEVO || {};

  window.CASEVO.analyze =
    async function (request) {
      if (
        !request ||
        typeof request !==
          "object"
      ) {
        throw new Error(
          "Invalid CASEVO sourcing request."
        );
      }

      const response =
        await fetch(
          API_ENDPOINT,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
              "Accept":
                "application/json"
            },

            body: JSON.stringify(
              request
            )
          }
        );

      const rawText =
        await response.text();

      let data;

      try {
        data =
          JSON.parse(rawText);
      } catch {
        throw new Error(
          "CASEVO server returned invalid JSON."
        );
      }

      if (
        !response.ok ||
        data.ok === false
      ) {
        throw new Error(
          firstNonEmpty(
            data.error,
            data.message,
            "CASEVO API request failed."
          )
        );
      }

      return data;
    };

  /* ==========================================================
     DEBUG INFORMATION
     ========================================================== */

  console.log(
    "CASEVO: Final frontend initialized."
  );

  console.log(
    "CASEVO: Requirement field:",
    requirementField
  );

  console.log(
    "CASEVO: Product field:",
    productField
  );

  console.log(
    "CASEVO: Quantity field:",
    quantityField
  );

  console.log(
    "CASEVO: Target price field:",
    targetPriceField
  );

  console.log(
    "CASEVO: Destination field:",
    destinationField
  );

  console.log(
    "CASEVO: Submit button:",
    submitButton
  );

})();
