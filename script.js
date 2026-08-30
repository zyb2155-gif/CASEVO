/* =========================================================
   CASEVO AI — FRONTEND SOURCING ENGINE
   Final Script Version
   ---------------------------------------------------------
   Frontend responsibilities:
   1. Read sourcing request
   2. Normalize / extract structured requirements
   3. Call /api/sourcing
   4. Normalize Worker response
   5. Render sourcing results
   6. Render CASEVO score / readiness
   7. Never invent supplier identities
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     CONFIG
     ========================================================= */

  const API_ENDPOINT = "/api/sourcing";

  const DEBUG =
    new URLSearchParams(window.location.search).get("debug") === "1";

  const log = (...args) => {
    if (DEBUG) {
      console.log("[CASEVO]", ...args);
    }
  };

  const warn = (...args) => {
    console.warn("[CASEVO]", ...args);
  };

  /* =========================================================
     DOM HELPERS
     ========================================================= */

  function all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function first(selectors, root = document) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function text(element) {
    return element ? String(element.textContent || "").trim() : "";
  }

  function value(element) {
    return element ? String(element.value || "").trim() : "";
  }

  function escapeHTML(input) {
    return String(input ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeUrl(url) {
    if (!url) return "";

    try {
      const parsed = new URL(url, window.location.origin);

      if (
        parsed.protocol === "http:" ||
        parsed.protocol === "https:"
      ) {
        return parsed.href;
      }
    } catch (_) {}

    return "";
  }

  /* =========================================================
     FIND FORM ELEMENTS
     ========================================================= */

  function findTextarea() {
    return first([
      "#sourcing-request",
      "#request",
      "#description",
      "#sourcingDescription",
      "#sourcing-description",
      "textarea[name='request']",
      "textarea[name='description']",
      "textarea[name='sourcingRequest']",
      "textarea"
    ]);
  }

  function findInputByName(names) {
    for (const name of names) {
      const element = document.querySelector(
        `input[name="${name}"], textarea[name="${name}"], select[name="${name}"]`
      );

      if (element) return element;
    }

    return null;
  }

  function findInputById(ids) {
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) return element;
    }

    return null;
  }

  function findInputByPlaceholder(words) {
    const inputs = all("input, textarea, select");

    for (const element of inputs) {
      const placeholder = String(
        element.getAttribute("placeholder") || ""
      ).toLowerCase();

      for (const word of words) {
        if (placeholder.includes(word.toLowerCase())) {
          return element;
        }
      }
    }

    return null;
  }

  function findInputByLabel(words) {
    const labels = all("label");

    for (const label of labels) {
      const labelText = text(label).toLowerCase();

      if (!words.some((word) => labelText.includes(word.toLowerCase()))) {
        continue;
      }

      const forId = label.getAttribute("for");

      if (forId) {
        const element = document.getElementById(forId);
        if (element) return element;
      }

      const nested = label.querySelector(
        "input, textarea, select"
      );

      if (nested) return nested;

      const parent = label.parentElement;

      if (parent) {
        const nearby = parent.querySelector(
          "input, textarea, select"
        );

        if (nearby) return nearby;
      }
    }

    return null;
  }

  function findProductInput() {
    return (
      findInputById([
        "product",
        "material",
        "product-material",
        "productMaterial"
      ]) ||
      findInputByName([
        "product",
        "material",
        "productMaterial"
      ]) ||
      findInputByPlaceholder([
        "upper leather",
        "product",
        "material"
      ]) ||
      findInputByLabel([
        "product / material",
        "product",
        "material"
      ])
    );
  }

  function findQuantityInput() {
    return (
      findInputById([
        "quantity",
        "qty"
      ]) ||
      findInputByName([
        "quantity",
        "qty"
      ]) ||
      findInputByPlaceholder([
        "5,000 pairs",
        "quantity",
        "qty"
      ]) ||
      findInputByLabel([
        "quantity"
      ])
    );
  }

  function findPriceInput() {
    return (
      findInputById([
        "price",
        "target-price",
        "targetPrice"
      ]) ||
      findInputByName([
        "price",
        "targetPrice",
        "target_price"
      ]) ||
      findInputByPlaceholder([
        "$4",
        "target price",
        "price"
      ]) ||
      findInputByLabel([
        "target price",
        "price"
      ])
    );
  }

  function findDestinationInput() {
    return (
      findInputById([
        "destination",
        "dest"
      ]) ||
      findInputByName([
        "destination",
        "dest"
      ]) ||
      findInputByPlaceholder([
        "USA",
        "destination"
      ]) ||
      findInputByLabel([
        "destination"
      ])
    );
  }

  function findSubmitButton() {
    const buttons = all(
      "button, input[type='submit'], a"
    );

    const candidates = buttons.filter((element) => {
      const label = (
        text(element) ||
        element.getAttribute("value") ||
        ""
      ).toLowerCase();

      return (
        label.includes("analyze") ||
        label.includes("find matches") ||
        label.includes("start ai sourcing") ||
        label.includes("sourcing")
      );
    });

    return candidates[0] || null;
  }

  /* =========================================================
     FORM REFERENCES
     ========================================================= */

  const els = {
    textarea: null,
    product: null,
    quantity: null,
    price: null,
    destination: null,
    submit: null
  };

  function refreshElements() {
    els.textarea = findTextarea();
    els.product = findProductInput();
    els.quantity = findQuantityInput();
    els.price = findPriceInput();
    els.destination = findDestinationInput();
    els.submit = findSubmitButton();

    log("Form elements:", els);
  }

  /* =========================================================
     TEXT NORMALIZATION
     ========================================================= */

  function normalizeSpaces(input) {
    return String(input || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanSentence(input) {
    return normalizeSpaces(input)
      .replace(/\s+,/g, ",")
      .replace(/,\s*,+/g, ",")
      .trim();
  }

  function lower(input) {
    return normalizeSpaces(input).toLowerCase();
  }

  /* =========================================================
     REQUIREMENT EXTRACTION
     ========================================================= */

  function extractQuantity(request) {
    const source = normalizeSpaces(request);

    const patterns = [
      /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\s*(?:pairs?|pcs?|pieces?|units?|sets?|rolls?|kg|kgs|tons?|tonnes?)\b/i,

      /\b\d+(?:\.\d+)?\s*(?:pairs?|pcs?|pieces?|units?|sets?|rolls?|kg|kgs|tons?|tonnes?)\b/i,

      /\b(?:qty|quantity)\s*[:=-]?\s*([\d,]+(?:\.\d+)?)\b/i
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);

      if (match) {
        return cleanSentence(match[0]);
      }
    }

    return "";
  }

  function extractDestination(request) {
    const source = normalizeSpaces(request);

    const patterns = [
      /\bshipping\s+to\s+(?:the\s+)?([A-Za-z][A-Za-z .,'-]{1,60})(?:[.!]|$)/i,

      /\bship(?:ped)?\s+to\s+(?:the\s+)?([A-Za-z][A-Za-z .,'-]{1,60})(?:[.!]|$)/i,

      /\bdeliver(?:y)?\s+to\s+(?:the\s+)?([A-Za-z][A-Za-z .,'-]{1,60})(?:[.!]|$)/i,

      /\bdestination\s*[:=-]\s*(?:the\s+)?([A-Za-z][A-Za-z .,'-]{1,60})(?:[.!]|$)/i
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);

      if (match && match[1]) {
        return cleanDestination(match[1]);
      }
    }

    return "";
  }

  function cleanDestination(input) {
    let result = cleanSentence(input);

    result = result
      .replace(/\bfor\s+.*$/i, "")
      .replace(/\bwith\s+.*$/i, "")
      .replace(/\bincluding\s+.*$/i, "")
      .replace(/\bshipping\s+.*$/i, "")
      .replace(/\s*\.$/, "")
      .trim();

    const aliases = {
      usa: "United States",
      us: "United States",
      "u.s.": "United States",
      "u.s.a.": "United States",
      uk: "United Kingdom",
      "u.k.": "United Kingdom"
    };

    const alias = aliases[result.toLowerCase()];

    return alias || result;
  }

  function extractThickness(request) {
    const source = normalizeSpaces(request);

    const match = source.match(
      /\b\d+(?:\.\d+)?\s*mm\b/i
    );

    return match ? cleanSentence(match[0]) : "";
  }

  function extractColor(request) {
    const source = lower(request);

    const colors = [
      "black",
      "white",
      "brown",
      "dark brown",
      "tan",
      "beige",
      "red",
      "blue",
      "navy",
      "green",
      "grey",
      "gray",
      "yellow",
      "orange",
      "pink",
      "purple"
    ];

    for (const color of colors) {
      if (source.includes(color)) {
        return color;
      }
    }

    return "";
  }

  function extractMaterial(request) {
    const source = lower(request);

    const materialPatterns = [
      {
        test: /full[-\s]?grain\s+leather/,
        value: "full-grain leather"
      },
      {
        test: /top[-\s]?grain\s+leather/,
        value: "top-grain leather"
      },
      {
        test: /genuine\s+leather/,
        value: "genuine leather"
      },
      {
        test: /split\s+leather/,
        value: "split leather"
      },
      {
        test: /\bleather\b/,
        value: "leather"
      },
      {
        test: /\brubber\b/,
        value: "rubber"
      },
      {
        test: /\bcotton\b/,
        value: "cotton"
      },
      {
        test: /\bmesh\b/,
        value: "mesh"
      },
      {
        test: /\bsynthetic\b/,
        value: "synthetic material"
      },
      {
        test: /\bpu\b/,
        value: "PU"
      },
      {
        test: /\bpvc\b/,
        value: "PVC"
      }
    ];

    for (const item of materialPatterns) {
      if (item.test.test(source)) {
        return item.value;
      }
    }

    return "";
  }

  function extractProduct(request) {
    const source = normalizeSpaces(request);
    const lowerSource = lower(request);

    const material = extractMaterial(request);

    if (
      lowerSource.includes("shoe upper") ||
      lowerSource.includes("shoe uppers") ||
      lowerSource.includes("upper leather") ||
      lowerSource.includes("footwear upper")
    ) {
      if (material) {
        return `${material} shoe upper`;
      }

      return "shoe upper";
    }

    if (
      lowerSource.includes("sneaker") &&
      material
    ) {
      return `${material} for sneakers`;
    }

    if (material) {
      return material;
    }

    const candidates = [
      "shoe",
      "sneakers",
      "footwear",
      "bag",
      "handbag",
      "wallet",
      "belt",
      "garment",
      "fabric",
      "component",
      "sole",
      "outsole",
      "insole"
    ];

    for (const candidate of candidates) {
      if (lowerSource.includes(candidate)) {
        return candidate;
      }
    }

    return "";
  }

  function extractPrice(request) {
    const source = normalizeSpaces(request);

    const patterns = [
      /(?:target\s+price|price)\s*[:=-]?\s*(US\$|\$|USD\s*)\s*\d+(?:\.\d+)?(?:\s*\/\s*[A-Za-z]+)?/i,

      /(US\$|\$|USD\s*)\s*\d+(?:\.\d+)?(?:\s*\/\s*[A-Za-z]+)?/i,

      /\b\d+(?:\.\d+)?\s*(?:USD|US\$)\b/i
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);

      if (match) {
        return cleanSentence(match[0]);
      }
    }

    return "";
  }

  /* =========================================================
     BUILD STRUCTURED REQUIREMENTS
     ========================================================= */

  function getRawValues() {
    refreshElements();

    return {
      request: els.textarea ? value(els.textarea) : "",
      product: els.product ? value(els.product) : "",
      quantity: els.quantity ? value(els.quantity) : "",
      price: els.price ? value(els.price) : "",
      destination: els.destination ? value(els.destination) : ""
    };
  }

  function buildRequirements() {
    const raw = getRawValues();

    const description = normalizeSpaces(raw.request);

    const extracted = {
      product: raw.product || extractProduct(description),
      quantity: raw.quantity || extractQuantity(description),
      price: raw.price || extractPrice(description),
      destination:
        raw.destination ||
        extractDestination(description),

      thickness: extractThickness(description),
      color: extractColor(description)
    };

    /*
     * Important:
     * Do not require the separate fields if the main
     * textarea already contains the information.
     */

    const requirements = {
      request: description,
      description,

      product: extracted.product,
      material: extracted.product,

      quantity: extracted.quantity,

      targetPrice: extracted.price,
      price: extracted.price,

      destination: extracted.destination,

      specifications: {
        thickness: extracted.thickness,
        color: extracted.color
      }
    };

    log("Raw values:", raw);
    log("Structured requirements:", requirements);

    return requirements;
  }

  /* =========================================================
     SYNCHRONIZE STRUCTURED FIELDS
     ========================================================= */

  function syncStructuredFields() {
    const requirements = buildRequirements();

    if (els.product && !value(els.product)) {
      if (requirements.product) {
        els.product.value = requirements.product;
      }
    }

    if (els.quantity && !value(els.quantity)) {
      if (requirements.quantity) {
        els.quantity.value = requirements.quantity;
      }
    }

    if (els.price && !value(els.price)) {
      if (requirements.price) {
        els.price.value = requirements.price;
      }
    }

    if (els.destination && !value(els.destination)) {
      if (requirements.destination) {
        els.destination.value = requirements.destination;
      }
    }

    return requirements;
  }

  /* =========================================================
     SEARCH QUERY BUILDER
     ========================================================= */

  function buildSearchQuery(requirements) {
    const parts = [];

    if (requirements.product) {
      parts.push(requirements.product);
    }

    if (
      requirements.description &&
      !parts.some(
        (item) =>
          lower(requirements.description).includes(
            lower(item)
          )
      )
    ) {
      parts.push(requirements.description);
    }

    if (requirements.destination) {
      parts.push(
        `supplier for ${requirements.destination}`
      );
    }

    parts.push(
      "manufacturer factory supplier OEM ODM"
    );

    return normalizeSpaces(parts.join(" "));
  }

  /* =========================================================
     VALIDATION
     ========================================================= */

  function validateRequirements(requirements) {
    const errors = [];

    if (!requirements.request) {
      errors.push(
        "Please describe what you want to source before running the analysis."
      );
    }

    /*
     * Destination is NOT mandatory anymore.
     *
     * If destination is absent, Worker can still perform
     * supplier discovery based on the product/material.
     */

    return errors;
  }

  /* =========================================================
     REQUEST ID
     ========================================================= */

  function generateRequestId() {
    const now = new Date();

    const stamp =
      now
        .toISOString()
        .replace(/\D/g, "")
        .slice(0, 14);

    const random =
      Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase();

    return `CASEVO-${stamp}-${random}`;
  }

  /* =========================================================
     FETCH SOURCING API
     ========================================================= */

  async function callSourcingAPI(requirements) {
    const requestId = generateRequestId();

    const payload = {
      requestId,

      request: requirements.request,

      description: requirements.description,

      product: requirements.product,

      material: requirements.material,

      quantity: requirements.quantity,

      targetPrice: requirements.targetPrice,

      price: requirements.price,

      destination: requirements.destination,

      specifications: requirements.specifications,

      searchQuery: buildSearchQuery(requirements)
    };

    log("POST", API_ENDPOINT, payload);

    const response = await fetch(API_ENDPOINT, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },

      body: JSON.stringify(payload)
    });

    const contentType =
      response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const rawText = await response.text();

      try {
        data = JSON.parse(rawText);
      } catch (_) {
        data = {
          ok: response.ok,
          message: rawText
        };
      }
    }

    log("API response:", response.status, data);

    if (!response.ok) {
      const message =
        data?.error ||
        data?.message ||
        `Supplier discovery request failed (${response.status}).`;

      throw new Error(message);
    }

    if (data?.ok === false) {
      throw new Error(
        data?.error ||
          data?.message ||
          "Supplier discovery could not be completed."
      );
    }

    return {
      ...data,
      requestId:
        data?.requestId ||
        data?.request_id ||
        requestId
    };
  }

  /* =========================================================
     RESPONSE NORMALIZATION
     ========================================================= */

  function findArray(data, keys) {
    for (const key of keys) {
      if (Array.isArray(data?.[key])) {
        return data[key];
      }
    }

    if (Array.isArray(data)) {
      return data;
    }

    return [];
  }

  function normalizeSupplier(item) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const name =
      item.name ||
      item.companyName ||
      item.company ||
      item.supplierName ||
      item.title ||
      "";

    const website =
      item.website ||
      item.url ||
      item.link ||
      item.sourceUrl ||
      item.source_url ||
      "";

    const description =
      item.description ||
      item.snippet ||
      item.summary ||
      item.content ||
      "";

    const location =
      item.location ||
      item.address ||
      item.country ||
      "";

    const score =
      item.score ??
      item.matchScore ??
      item.match_score ??
      item.supplierMatch ??
      item.supplier_match ??
      null;

    const source =
      item.source ||
      item.domain ||
      "";

    /*
     * Do not call arbitrary search snippets suppliers.
     * A supplier record must at least have a meaningful
     * company/title or URL.
     */

    if (!name && !website) {
      return null;
    }

    return {
      name: String(name).trim(),
      website: safeUrl(website),
      description: String(description).trim(),
      location: String(location).trim(),
      score,
      source: String(source).trim()
    };
  }

  function normalizeSuppliers(data) {
    const candidates = findArray(data, [
      "suppliers",
      "supplierMatches",
      "supplier_matches",
      "matches",
      "results",
      "records",
      "items",
      "sources"
    ]);

    return candidates
      .map(normalizeSupplier)
      .filter(Boolean)
      .filter((supplier, index, array) => {
        const key =
          lower(supplier.name) ||
          lower(supplier.website);

        return (
          index ===
          array.findIndex(
            (item) =>
              (
                lower(item.name) ||
                lower(item.website)
              ) === key
          )
        );
      });
  }

  function getScore(data) {
    const candidates = [
      data?.casevoScore,
      data?.casevo_score,
      data?.score,
      data?.readinessScore,
      data?.readiness_score,
      data?.analysis?.casevoScore,
      data?.analysis?.score,
      data?.analysis?.readinessScore
    ];

    for (const candidate of candidates) {
      if (
        candidate !== undefined &&
        candidate !== null &&
        candidate !== ""
      ) {
        const numeric = Number(candidate);

        if (
          Number.isFinite(numeric) &&
          numeric >= 0 &&
          numeric <= 100
        ) {
          return Math.round(numeric);
        }
      }
    }

    return null;
  }

  /* =========================================================
     SCORE ENGINE
     ========================================================= */

  function calculateReadiness(requirements) {
    let clarity = 0;
    let specification = 0;
    let commercial = 0;

    if (requirements.request) {
      clarity += 40;
    }

    if (requirements.product) {
      clarity += 35;
    }

    if (requirements.destination) {
      clarity += 25;
    }

    if (requirements.specifications.thickness) {
      specification += 35;
    }

    if (requirements.specifications.color) {
      specification += 20;
    }

    if (
      requirements.description &&
      requirements.description.length > 60
    ) {
      specification += 20;
    }

    if (requirements.product) {
      specification += 25;
    }

    if (requirements.quantity) {
      commercial += 50;
    }

    if (requirements.targetPrice) {
      commercial += 50;
    }

    const score = Math.round(
      clarity * 0.35 +
      specification * 0.35 +
      commercial * 0.30
    );

    return {
      clarity: Math.min(100, clarity),
      specification: Math.min(
        100,
        specification
      ),
      commercial: Math.min(
        100,
        commercial
      ),
      score: Math.min(100, score)
    };
  }

  /* =========================================================
     FIND RESULT CONTAINER
     ========================================================= */

  function findResultContainer() {
    return (
      document.querySelector(
        "#sourcing-results"
      ) ||
      document.querySelector(
        "#results"
      ) ||
      document.querySelector(
        "[data-sourcing-results]"
      ) ||
      document.querySelector(
        ".sourcing-results"
      ) ||
      document.querySelector(
        ".analysis-results"
      )
    );
  }

  function createResultContainer() {
    let container = findResultContainer();

    if (container) return container;

    const form =
      els.submit?.closest("form") ||
      els.textarea?.closest("section") ||
      els.textarea?.parentElement;

    if (!form) return null;

    container = document.createElement("section");

    container.id = "sourcing-results";

    container.className =
      "casevo-generated-results";

    form.insertAdjacentElement(
      "afterend",
      container
    );

    return container;
  }

  /* =========================================================
     RENDER HELPERS
     ========================================================= */

  function renderScore(score, readiness) {
    const actualScore =
      score !== null
        ? score
        : readiness.score;

    return `
      <div class="casevo-score-card">
        <div class="casevo-eyebrow">
          CASEVO SCORE
        </div>

        <div class="casevo-score-number">
          ${escapeHTML(actualScore)}
          <span>/100</span>
        </div>

        <div class="casevo-score-breakdown">
          <div>
            <span>Requirement clarity</span>
            <strong>${readiness.clarity}</strong>
          </div>

          <div>
            <span>Specification quality</span>
            <strong>${readiness.specification}</strong>
          </div>

          <div>
            <span>Commercial readiness</span>
            <strong>${readiness.commercial}</strong>
          </div>
        </div>
      </div>
    `;
  }

  function renderRequirements(requirements) {
    return `
      <div class="casevo-requirements">
        <div class="casevo-eyebrow">
          SOURCING REQUIREMENT
        </div>

        <div class="casevo-requirement-row">
          <span>PRODUCT / MATERIAL</span>
          <strong>
            ${escapeHTML(
              requirements.product ||
              "Sourcing Requirement"
            )}
          </strong>
        </div>

        <div class="casevo-requirement-row">
          <span>QUANTITY</span>
          <strong>
            ${escapeHTML(
              requirements.quantity ||
              "Not specified"
            )}
          </strong>
        </div>

        <div class="casevo-requirement-row">
          <span>TARGET PRICE</span>
          <strong>
            ${escapeHTML(
              requirements.targetPrice ||
              "Not specified"
            )}
          </strong>
        </div>

        <div class="casevo-requirement-row">
          <span>DESTINATION</span>
          <strong>
            ${escapeHTML(
              requirements.destination ||
              "Not specified"
            )}
          </strong>
        </div>

        ${
          requirements.specifications.thickness ||
          requirements.specifications.color
            ? `
              <div class="casevo-requirement-row">
                <span>SPECIFICATIONS</span>
                <strong>
                  ${escapeHTML(
                    [
                      requirements.specifications.thickness,
                      requirements.specifications.color
                    ]
                      .filter(Boolean)
                      .join(", ")
                  )}
                </strong>
              </div>
            `
            : ""
        }
      </div>
    `;
  }

  function renderSupplierCard(supplier, index) {
    const website = safeUrl(
      supplier.website
    );

    const score =
      supplier.score !== null &&
      supplier.score !== undefined
        ? Number(supplier.score)
        : null;

    return `
      <article class="casevo-supplier-card">

        <div class="casevo-supplier-index">
          ${String(index + 1).padStart(2, "0")}
        </div>

        <div class="casevo-supplier-main">

          <h3>
            ${escapeHTML(
              supplier.name ||
              "Supplier record"
            )}
          </h3>

          ${
            supplier.location
              ? `
                <div class="casevo-supplier-location">
                  ${escapeHTML(
                    supplier.location
                  )}
                </div>
              `
              : ""
          }

          ${
            supplier.description
              ? `
                <p>
                  ${escapeHTML(
                    supplier.description
                  )}
                </p>
              `
              : ""
          }

          <div class="casevo-supplier-meta">

            ${
              score !== null &&
              Number.isFinite(score)
                ? `
                  <span>
                    Match ${escapeHTML(
                      Math.round(score)
                    )}%
                  </span>
                `
                : ""
            }

            ${
              supplier.source
                ? `
                  <span>
                    ${escapeHTML(
                      supplier.source
                    )}
                  </span>
                `
                : ""
            }

          </div>

          ${
            website
              ? `
                <a
                  class="casevo-supplier-link"
                  href="${escapeHTML(
                    website
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View public source →
                </a>
              `
              : ""
          }

        </div>

      </article>
    `;
  }

  function renderSuppliers(suppliers) {
    if (!suppliers.length) {
      return `
        <div class="casevo-no-results">

          <h2>
            No verified supplier
            matches were returned.
          </h2>

          <div class="casevo-no-results-box">

            <strong>
              No verified supplier records
              were returned.
            </strong>

            <p>
              CASEVO completed the public-web
              sourcing analysis, but no supplier
              identity was returned for this request.
            </p>

            <p>
              Try adding a more specific material,
              product type, manufacturing capability,
              certification, or destination.
            </p>

          </div>

        </div>
      `;
    }

    return `
      <div class="casevo-supplier-results">

        <div class="casevo-eyebrow">
          REAL SUPPLIER MATCHES
        </div>

        <h2>
          Potential suppliers
          found on the public web.
        </h2>

        <div class="casevo-supplier-list">
          ${suppliers
            .map(renderSupplierCard)
            .join("")}
        </div>

      </div>
    `;
  }

  function renderSearchInfo(data, requestId) {
    const provider =
      data?.searchProvider ||
      data?.search_provider ||
      data?.provider ||
      data?.engine ||
      "Public web search";

    return `
      <div class="casevo-search-information">

        <div class="casevo-eyebrow">
          SEARCH INFORMATION
        </div>

        <p>
          <strong>Supplier data:</strong>
          ${escapeHTML(provider)}
        </p>

        <p>
          <strong>CASEVO Request ID:</strong>
          ${escapeHTML(requestId || "N/A")}
        </p>

        <div class="casevo-verification-notice">

          <strong>
            Verification notice
          </strong>

          <p>
            CASEVO identifies potential supplier
            capabilities from public information.
            Company identity, manufacturing
            capability, certifications, pricing,
            MOQ, production capacity and contact
            information should be independently
            verified before placing an order.
          </p>

        </div>

      </div>
    `;
  }

  /* =========================================================
     MAIN RESULT RENDER
     ========================================================= */

  function renderResults(data, requirements) {
    const container =
      createResultContainer();

    if (!container) {
      warn(
        "Could not find or create result container."
      );
      return;
    }

    const suppliers =
      normalizeSuppliers(data);

    const apiScore =
      getScore(data);

    const readiness =
      calculateReadiness(requirements);

    const requestId =
      data?.requestId ||
      data?.request_id ||
      data?.id ||
      "N/A";

    container.innerHTML = `
      <div class="casevo-analysis">

        <div class="casevo-analysis-header">

          <div>
            <div class="casevo-eyebrow">
              CASEVO AI / SOURCING ANALYSIS
            </div>

            <h1>
              Real supplier
              discovery completed.
            </h1>

            <p>
              CASEVO supplier discovery
              completed successfully.
            </p>
          </div>

          ${renderScore(
            apiScore,
            readiness
          )}

        </div>

        ${renderRequirements(
          requirements
        )}

        ${renderSuppliers(
          suppliers
        )}

        ${renderSearchInfo(
          data,
          requestId
        )}

      </div>
    `;

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    log(
      "Rendered suppliers:",
      suppliers
    );
  }

  /* =========================================================
     ERROR RENDERING
     ========================================================= */

  function renderError(error, requestId) {
    const container =
      createResultContainer();

    if (!container) {
      alert(
        error?.message ||
          "Supplier discovery could not be completed."
      );
      return;
    }

    container.innerHTML = `
      <div class="casevo-error">

        <div class="casevo-eyebrow">
          CASEVO AI / ERROR
        </div>

        <h2>
          Supplier discovery could not
          be completed.
        </h2>

        <p>
          ${escapeHTML(
            error?.message ||
              "An unexpected error occurred."
          )}
        </p>

        ${
          requestId
            ? `
              <div class="casevo-request-id">
                Request ID:
                ${escapeHTML(requestId)}
              </div>
            `
            : ""
        }

      </div>
    `;

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  /* =========================================================
     BUTTON STATE
     ========================================================= */

  function setLoading(loading) {
    if (!els.submit) return;

    if (loading) {
      els.submit.dataset.casevoOriginalText =
        els.submit.textContent;

      if (
        "value" in els.submit &&
        els.submit.tagName === "INPUT"
      ) {
        els.submit.value =
          "Analyzing...";
      } else {
        els.submit.innerHTML =
          "Analyzing... →";
      }

      els.submit.disabled = true;

      els.submit.setAttribute(
        "aria-busy",
        "true"
      );
    } else {
      const original =
        els.submit.dataset
          .casevoOriginalText;

      if (
        original &&
        els.submit.tagName === "INPUT"
      ) {
        els.submit.value = original;
      } else if (original) {
        els.submit.textContent = original;
      } else {
        els.submit.innerHTML =
          "Analyze & Find Matches →";
      }

      els.submit.disabled = false;

      els.submit.removeAttribute(
        "aria-busy"
      );
    }
  }

  /* =========================================================
     FORM SUBMISSION
     ========================================================= */

  let submitting = false;

  async function handleSubmit(event) {
    if (event) {
      event.preventDefault();
    }

    if (submitting) {
      return;
    }

    refreshElements();

    /*
     * IMPORTANT:
     * First synchronize the structured fields
     * from the main sourcing textarea.
     */

    const requirements =
      syncStructuredFields();

    const validationErrors =
      validateRequirements(
        requirements
      );

    if (validationErrors.length) {
      renderError(
        new Error(
          validationErrors.join(" ")
        )
      );

      return;
    }

    submitting = true;

    setLoading(true);

    try {
      const data =
        await callSourcingAPI(
          requirements
        );

      renderResults(
        data,
        requirements
      );
    } catch (error) {
      console.error(
        "[CASEVO] Sourcing error:",
        error
      );

      renderError(error);
    } finally {
      submitting = false;

      setLoading(false);
    }
  }

  /* =========================================================
     FORM EVENT BINDING
     ========================================================= */

  function bindForm() {
    refreshElements();

    if (!els.submit) {
      warn(
        "CASEVO submit button was not found."
      );
      return;
    }

    const form =
      els.submit.closest("form");

    if (form) {
      form.addEventListener(
        "submit",
        handleSubmit
      );
    } else {
      els.submit.addEventListener(
        "click",
        handleSubmit
      );
    }

    /*
     * When user types into the main textarea,
     * automatically update the structured
     * fields when they are empty.
     */

    if (els.textarea) {
      let timer = null;

      els.textarea.addEventListener(
        "input",
        () => {
          clearTimeout(timer);

          timer = setTimeout(() => {
            syncStructuredFields();
          }, 250);
        }
      );

      /*
       * Initial synchronization
       */

      syncStructuredFields();
    }
  }

  /* =========================================================
     AUTO-DETECT DYNAMIC DOM
     ========================================================= */

  function observeDOM() {
    const observer =
      new MutationObserver(() => {
        if (
          !els.submit ||
          !document.body.contains(
            els.submit
          )
        ) {
          bindForm();
        }
      });

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  /* =========================================================
     ADD SMALL INLINE STYLES
     ---------------------------------------------------------
     Only for generated result elements.
     Existing site design remains untouched.
     ========================================================= */

  function injectGeneratedStyles() {
    if (
      document.getElementById(
        "casevo-generated-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "casevo-generated-styles";

    style.textContent = `
      .casevo-generated-results {
        margin-top: 48px;
        width: 100%;
      }

      .casevo-analysis {
        border: 1px solid rgba(0,0,0,.18);
        padding: 32px;
        background: rgba(255,255,255,.12);
      }

      .casevo-analysis-header {
        display: flex;
        justify-content: space-between;
        gap: 32px;
        align-items: flex-start;
      }

      .casevo-analysis h1,
      .casevo-analysis h2,
      .casevo-analysis h3 {
        margin-top: 0;
      }

      .casevo-eyebrow {
        font-size: 10px;
        letter-spacing: .18em;
        text-transform: uppercase;
        margin-bottom: 12px;
      }

      .casevo-score-card {
        min-width: 180px;
        border: 1px solid rgba(0,0,0,.18);
        padding: 20px;
      }

      .casevo-score-number {
        font-size: 36px;
        font-weight: 600;
        margin-bottom: 20px;
      }

      .casevo-score-number span {
        font-size: 12px;
        font-weight: 400;
      }

      .casevo-score-breakdown {
        display: grid;
        gap: 10px;
      }

      .casevo-score-breakdown div {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        font-size: 12px;
      }

      .casevo-requirements {
        margin-top: 32px;
        border: 1px solid rgba(0,0,0,.14);
      }

      .casevo-requirement-row {
        padding: 16px 18px;
        border-top: 1px solid rgba(0,0,0,.12);
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .casevo-requirement-row span {
        font-size: 9px;
        letter-spacing: .15em;
        text-transform: uppercase;
        opacity: .65;
      }

      .casevo-supplier-results {
        margin-top: 42px;
      }

      .casevo-supplier-list {
        display: grid;
        gap: 14px;
      }

      .casevo-supplier-card {
        display: flex;
        gap: 18px;
        border: 1px solid rgba(0,0,0,.16);
        padding: 20px;
      }

      .casevo-supplier-index {
        font-size: 11px;
        opacity: .55;
      }

      .casevo-supplier-main {
        flex: 1;
      }

      .casevo-supplier-main h3 {
        margin-bottom: 6px;
      }

      .casevo-supplier-location {
        font-size: 12px;
        opacity: .7;
        margin-bottom: 10px;
      }

      .casevo-supplier-main p {
        line-height: 1.6;
        font-size: 13px;
      }

      .casevo-supplier-meta {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
        font-size: 11px;
        opacity: .7;
        margin-top: 12px;
      }

      .casevo-supplier-link {
        display: inline-block;
        margin-top: 14px;
        font-size: 12px;
        text-decoration: underline;
      }

      .casevo-no-results {
        margin-top: 42px;
      }

      .casevo-no-results-box {
        border: 1px solid rgba(0,0,0,.16);
        padding: 22px;
        max-width: 620px;
        line-height: 1.6;
      }

      .casevo-search-information {
        margin-top: 42px;
        padding-top: 24px;
        border-top: 1px solid rgba(0,0,0,.14);
        font-size: 12px;
        line-height: 1.6;
      }

      .casevo-verification-notice {
        margin-top: 20px;
        padding: 18px;
        border: 1px solid rgba(0,0,0,.14);
      }

      .casevo-error {
        border: 1px solid #b52c24;
        padding: 28px;
        background: rgba(255,255,255,.15);
      }

      .casevo-request-id {
        margin-top: 20px;
        font-size: 11px;
        opacity: .65;
      }

      @media (max-width: 760px) {
        .casevo-analysis-header {
          flex-direction: column;
        }

        .casevo-score-card {
          width: 100%;
          box-sizing: border-box;
        }

        .casevo-analysis {
          padding: 22px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =========================================================
     INITIALIZE
     ========================================================= */

  function init() {
    log("CASEVO frontend initializing...");

    injectGeneratedStyles();

    bindForm();

    observeDOM();

    /*
     * Debug helper.
     * Available from browser console:
     *
     * CASEVO.test()
     * CASEVO.requirements()
     */

    window.CASEVO = {
      test() {
        const requirements =
          buildRequirements();

        console.table(requirements);

        return requirements;
      },

      requirements() {
        return buildRequirements();
      },

      async analyze() {
        await handleSubmit();
      }
    };

    log(
      "CASEVO frontend initialized."
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();
