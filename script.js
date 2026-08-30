/*
========================================================
CASEVO AI — Sourcing Frontend
========================================================

Frontend responsibilities:
1. Read sourcing requirements from the page
2. Normalize user input
3. Submit to /api/sourcing
4. Render sourcing results
5. Gracefully handle API errors
6. Provide a local demo fallback when the API is unavailable

No OpenAI API key is required in the browser.

========================================================
*/

(function () {
  "use strict";

  console.log("CASEVO AI Sourcing frontend loaded.");

  /* =====================================================
     CONFIG
  ===================================================== */

  const API_ENDPOINT = "/api/sourcing";

  const DEMO_MODE_ON_API_ERROR = true;

  /* =====================================================
     STATE
  ===================================================== */

  const state = {
    submitting: false,
    lastRequest: null,
    lastResponse: null
  };

  /* =====================================================
     HELPERS
  ===================================================== */

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function normalize(value) {
    return String(value || "")
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

  function firstExisting(selectors) {
    for (const selector of selectors) {
      const el = qs(selector);
      if (el) return el;
    }

    return null;
  }

  function getLabelText(element) {
    if (!element) return "";

    const id = element.getAttribute("id");

    if (id) {
      const label = qs('label[for="' + CSS.escape(id) + '"]');
      if (label) return normalize(label.textContent);
    }

    const parentLabel = element.closest("label");

    if (parentLabel) {
      return normalize(parentLabel.textContent);
    }

    return "";
  }

  function findByLabel(words, tagNames) {
    const elements = qsa(tagNames || "input, textarea, select");

    for (const element of elements) {
      const label = getLabelText(element).toLowerCase();
      const placeholder = normalize(
        element.getAttribute("placeholder") || ""
      ).toLowerCase();
      const name = normalize(
        element.getAttribute("name") || ""
      ).toLowerCase();
      const id = normalize(
        element.getAttribute("id") || ""
      ).toLowerCase();

      for (const word of words) {
        const w = word.toLowerCase();

        if (
          label.includes(w) ||
          placeholder.includes(w) ||
          name.includes(w) ||
          id.includes(w)
        ) {
          return element;
        }
      }
    }

    return null;
  }

  function getElementValue(element) {
    if (!element) return "";
    return normalize(element.value);
  }

  /* =====================================================
     FIND FORM ELEMENTS
  ===================================================== */

  function detectFormElements() {
    const textareas = qsa("textarea");
    const inputs = qsa("input");

    let requirement = firstExisting([
      "#sourcingRequest",
      "#sourcing-requirement",
      "#requirement",
      "#request",
      '[name="request"]',
      '[name="requirement"]',
      '[name="sourcingRequest"]',
      '[name="sourcing_requirement"]',
      'textarea[data-field="request"]',
      'textarea[data-field="requirement"]'
    ]);

    if (!requirement) {
      requirement = findByLabel(
        [
          "what are you sourcing",
          "sourcing",
          "requirement",
          "request",
          "product or material",
          "describe"
        ],
        "textarea"
      );
    }

    if (!requirement && textareas.length > 0) {
      requirement = textareas[0];
    }

    let product = firstExisting([
      "#product",
      "#productMaterial",
      "#product-material",
      "#material",
      '[name="product"]',
      '[name="material"]',
      '[name="productMaterial"]',
      '[name="product_material"]',
      'input[data-field="product"]',
      'input[data-field="material"]'
    ]);

    if (!product) {
      product = findByLabel(
        [
          "product",
          "material",
          "product / material"
        ],
        "input, textarea, select"
      );
    }

    let quantity = firstExisting([
      "#quantity",
      "#qty",
      '[name="quantity"]',
      '[name="qty"]',
      'input[data-field="quantity"]'
    ]);

    if (!quantity) {
      quantity = findByLabel(
        [
          "quantity",
          "qty",
          "volume"
        ],
        "input, textarea, select"
      );
    }

    let targetPrice = firstExisting([
      "#targetPrice",
      "#target-price",
      "#price",
      '[name="targetPrice"]',
      '[name="target_price"]',
      '[name="price"]',
      'input[data-field="target-price"]',
      'input[data-field="targetPrice"]'
    ]);

    if (!targetPrice) {
      targetPrice = findByLabel(
        [
          "target price",
          "price",
          "budget"
        ],
        "input, textarea, select"
      );
    }

    let destination = firstExisting([
      "#destination",
      "#dest",
      '[name="destination"]',
      '[name="dest"]',
      'input[data-field="destination"]'
    ]);

    if (!destination) {
      destination = findByLabel(
        [
          "destination",
          "country",
          "market",
          "ship to"
        ],
        "input, textarea, select"
      );
    }

    const button =
      firstExisting([
        "#analyzeButton",
        "#analyze",
        "#submitSourcing",
        "#sourcingSubmit",
        '[data-casevo="analyze"]',
        '[data-action="analyze"]',
        'button[type="submit"]'
      ]) ||
      qsa("button").find(function (button) {
        return /analyze|find matches|start sourcing/i.test(
          normalize(button.textContent)
        );
      }) ||
      null;

    const form =
      firstExisting([
        "#sourcingForm",
        "#sourcing-form",
        'form[data-casevo="sourcing"]',
        'form'
      ]) || null;

    return {
      form,
      requirement,
      product,
      quantity,
      targetPrice,
      destination,
      button
    };
  }

  /* =====================================================
     FORM DEBUG
  ===================================================== */

  function logElements(elements) {
    console.log("CASEVO: Elements found:", {
      form: elements.form,
      textarea: elements.requirement,
      product: elements.product,
      quantity: elements.quantity,
      targetPrice: elements.targetPrice,
      destination: elements.destination,
      button: elements.button
    });
  }

  /* =====================================================
     COLLECT FORM VALUES
  ===================================================== */

  function collectFormValues(elements) {
    const requirement = getElementValue(elements.requirement);
    const product = getElementValue(elements.product);
    const quantity = getElementValue(elements.quantity);
    const targetPrice = getElementValue(elements.targetPrice);
    const destination = getElementValue(elements.destination);

    /*
     IMPORTANT:

     The textarea is the main sourcing request.

     If the user only fills the textarea, that is valid.
     We therefore do NOT require all five fields.
    */

    const request = {
      requirement: requirement,
      request: requirement,

      product: product,
      material: product,

      quantity: quantity,

      target_price: targetPrice,
      targetPrice: targetPrice,

      destination: destination,

      source: "casevo-web",
      version: "MVP-2"
    };

    console.log("CASEVO: Form values collected:", request);

    return request;
  }

  /* =====================================================
     VALIDATION
  ===================================================== */

  function validateRequest(data) {
    if (!data) {
      return {
        valid: false,
        message: "Please enter a sourcing requirement."
      };
    }

    /*
     The requirement can come from the main textarea
     OR from the individual product/material field.
    */

    const combined = [
      data.requirement,
      data.request,
      data.product,
      data.material,
      data.quantity,
      data.target_price,
      data.destination
    ]
      .map(normalize)
      .filter(Boolean)
      .join(" ");

    if (!combined) {
      return {
        valid: false,
        message: "Please enter a sourcing requirement."
      };
    }

    return {
      valid: true,
      message: ""
    };
  }

  /* =====================================================
     STATUS MESSAGE
  ===================================================== */

  function findStatusContainer() {
    const existing = firstExisting([
      "#sourcingStatus",
      "#status",
      ".sourcing-status",
      ".form-status",
      ".status-message",
      "[data-casevo-status]"
    ]);

    if (existing) return existing;

    return null;
  }

  function showStatus(message, type) {
    let container = findStatusContainer();

    if (!container) {
      const button = detectFormElements().button;

      if (button && button.parentElement) {
        container = document.createElement("div");

        container.className = "casevo-status-message";

        container.style.marginTop = "14px";
        container.style.padding = "12px 16px";
        container.style.border = "1px solid rgba(120,90,60,.25)";
        container.style.fontSize = "13px";
        container.style.lineHeight = "1.5";

        button.parentElement.appendChild(container);
      }
    }

    if (!container) return;

    container.textContent = message;

    if (type === "error") {
      container.style.color = "#a52d23";
    } else if (type === "success") {
      container.style.color = "#315f45";
    } else {
      container.style.color = "#6b6259";
    }

    container.style.display = "block";
  }

  /* =====================================================
     BUTTON STATE
  ===================================================== */

  function setButtonLoading(button, loading) {
    if (!button) return;

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
      }

      button.disabled = true;
      button.style.opacity = "0.65";
      button.style.cursor = "wait";

      button.textContent = "Analyzing sourcing request…";
    } else {
      button.disabled = false;
      button.style.opacity = "";
      button.style.cursor = "";

      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
      }
    }
  }

  /* =====================================================
     API REQUEST
  ===================================================== */

  async function callSourcingAPI(data) {
    console.log("CASEVO: Sending sourcing request to:", API_ENDPOINT);

    const response = await fetch(API_ENDPOINT, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },

      body: JSON.stringify(data)
    });

    const contentType =
      response.headers.get("content-type") || "";

    let result;

    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();

      try {
        result = JSON.parse(text);
      } catch (error) {
        result = {
          ok: response.ok,
          raw: text
        };
      }
    }

    if (!response.ok) {
      const error = new Error(
        "Sourcing API returned HTTP " + response.status
      );

      error.status = response.status;
      error.payload = result;

      throw error;
    }

    return result;
  }

  /* =====================================================
     DEMO FALLBACK
  ===================================================== */

  function buildDemoResponse(data) {
    const requestText =
      data.requirement ||
      data.request ||
      data.product ||
      data.material ||
      "China footwear material sourcing";

    const product =
      data.product ||
      data.material ||
      inferProduct(requestText);

    const quantity =
      data.quantity ||
      inferQuantity(requestText) ||
      "Not specified";

    const targetPrice =
      data.target_price ||
      inferPrice(requestText) ||
      "Not specified";

    const destination =
      data.destination ||
      inferDestination(requestText) ||
      "Not specified";

    return {
      ok: true,

      mode: "demo",

      service: "CASEVO AI Sourcing",

      version: "MVP-2",

      brief: {
        requirement: requestText,
        product: product,
        quantity: quantity,
        target_price: targetPrice,
        destination: destination
      },

      match: {
        supplier_match: 94,
        casevo_score: 86,
        verification: "Human Review"
      },

      message:
        "Your sourcing requirement has been structured successfully. Supplier intelligence will be connected in the next phase.",

      suppliers: [
        {
          name: "Qualified China Supplier — Demo",
          location: "China",
          category: product,
          match: 94,
          score: 86,
          verification: "Pending Human Review",
          status: "Demo Result"
        },

        {
          name: "China Footwear Materials Supplier — Demo",
          location: "China",
          category: product,
          match: 89,
          score: 82,
          verification: "Pending Human Review",
          status: "Demo Result"
        },

        {
          name: "China Manufacturing Partner — Demo",
          location: "China",
          category: product,
          match: 84,
          score: 78,
          verification: "Pending Human Review",
          status: "Demo Result"
        }
      ]
    };
  }

  function inferProduct(text) {
    const value = String(text || "").toLowerCase();

    if (value.includes("leather")) {
      return "Leather";
    }

    if (value.includes("shoe")) {
      return "Footwear";
    }

    if (value.includes("sneaker")) {
      return "Sneaker Materials";
    }

    if (value.includes("sole")) {
      return "Shoe Soles";
    }

    if (value.includes("upper")) {
      return "Footwear Upper";
    }

    if (value.includes("component")) {
      return "Footwear Components";
    }

    return "Footwear / Materials";
  }

  function inferQuantity(text) {
    const match = String(text || "").match(
      /[\d,]+\s*(?:pairs?|pcs?|pieces?|kg|tons?|tonnes?|meters?|sqm|square\s*meters?)/i
    );

    return match ? normalize(match[0]) : "";
  }

  function inferPrice(text) {
    const match = String(text || "").match(
      /(?:USD|US\$|\$)\s*[\d,.]+(?:\s*(?:per|\/)\s*(?:sqm|sqft|square\s*meter|m2|meter))?/i
    );

    return match ? normalize(match[0]) : "";
  }

  function inferDestination(text) {
    const value = String(text || "");

    const match = value.match(
      /destination\s+(?:is\s+)?([A-Za-z][A-Za-z\s]{1,30})/i
    );

    return match ? normalize(match[1]) : "";
  }

  /* =====================================================
     RESULT CONTAINER
  ===================================================== */

  function findResultContainer() {
    const existing = firstExisting([
      "#sourcingResults",
      "#sourcing-results",
      "#results",
      ".sourcing-results",
      ".results",
      "[data-casevo-results]"
    ]);

    if (existing) return existing;

    const form = detectFormElements().form;

    if (!form) return null;

    const container = document.createElement("div");

    container.id = "casevo-sourcing-results";

    container.style.marginTop = "48px";

    form.parentElement.appendChild(container);

    return container;
  }

  /* =====================================================
     RENDER RESULT
  ===================================================== */

  function renderResults(response, requestData) {
    const container = findResultContainer();

    if (!container) {
      console.warn(
        "CASEVO: Result container could not be created."
      );
      return;
    }

    const data = response || {};

    const brief =
      data.brief ||
      data.request ||
      data.normalized_request ||
      {};

    const match =
      data.match ||
      data.score ||
      {};

    const suppliers =
      Array.isArray(data.suppliers)
        ? data.suppliers
        : Array.isArray(data.matches)
        ? data.matches
        : [];

    const supplierMatch =
      match.supplier_match ??
      match.supplierMatch ??
      data.supplier_match ??
      94;

    const casevoScore =
      match.casevo_score ??
      match.casevoScore ??
      data.casevo_score ??
      86;

    const verification =
      match.verification ||
      data.verification ||
      "Human Review";

    const requirement =
      brief.requirement ||
      brief.request ||
      requestData.requirement ||
      requestData.request ||
      requestData.product ||
      "Sourcing requirement";

    let suppliersHtml = "";

    if (suppliers.length > 0) {
      suppliersHtml = suppliers
        .map(function (supplier, index) {
          const name =
            supplier.name ||
            supplier.company ||
            supplier.supplier ||
            "China Supplier";

          const location =
            supplier.location ||
            supplier.city ||
            supplier.country ||
            "China";

          const category =
            supplier.category ||
            supplier.product ||
            supplier.material ||
            "Footwear / Materials";

          const matchScore =
            supplier.match ??
            supplier.match_score ??
            supplier.matchScore ??
            "—";

          const score =
            supplier.score ??
            supplier.casevo_score ??
            supplier.casevoScore ??
            "—";

          const verify =
            supplier.verification ||
            supplier.status ||
            "Pending Human Review";

          return `
            <article class="casevo-supplier-card"
              style="
                border:1px solid rgba(40,30,20,.16);
                padding:24px;
                margin-top:14px;
                background:#f7f1e6;
              ">

              <div style="
                display:flex;
                justify-content:space-between;
                gap:20px;
                align-items:flex-start;
              ">

                <div>
                  <div style="
                    font-size:11px;
                    letter-spacing:.16em;
                    text-transform:uppercase;
                    color:#a83227;
                    margin-bottom:8px;
                  ">
                    SUPPLIER MATCH ${String(index + 1).padStart(2, "0")}
                  </div>

                  <h3 style="
                    margin:0 0 8px;
                    font-size:22px;
                    font-weight:500;
                  ">
                    ${escapeHtml(name)}
                  </h3>

                  <div style="
                    color:#6f675f;
                    font-size:14px;
                  ">
                    ${escapeHtml(location)}
                    ·
                    ${escapeHtml(category)}
                  </div>
                </div>

                <div style="
                  font-size:26px;
                  font-weight:600;
                  white-space:nowrap;
                ">
                  ${escapeHtml(matchScore)}%
                </div>

              </div>

              <div style="
                display:grid;
                grid-template-columns:repeat(2,minmax(0,1fr));
                gap:16px;
                margin-top:22px;
                padding-top:18px;
                border-top:1px solid rgba(40,30,20,.12);
              ">

                <div>
                  <div style="
                    font-size:10px;
                    letter-spacing:.12em;
                    color:#80766d;
                    text-transform:uppercase;
                  ">
                    CASEVO SCORE
                  </div>

                  <div style="
                    margin-top:5px;
                    font-size:17px;
                  ">
                    ${escapeHtml(score)} / 100
                  </div>
                </div>

                <div>
                  <div style="
                    font-size:10px;
                    letter-spacing:.12em;
                    color:#80766d;
                    text-transform:uppercase;
                  ">
                    VERIFICATION
                  </div>

                  <div style="
                    margin-top:5px;
                    font-size:17px;
                  ">
                    ${escapeHtml(verify)}
                  </div>
                </div>

              </div>

            </article>
          `;
        })
        .join("");
    }

    if (!suppliersHtml) {
      suppliersHtml = `
        <div style="
          border:1px solid rgba(40,30,20,.16);
          padding:24px;
          margin-top:20px;
          background:#f7f1e6;
        ">
          <strong>
            Supplier intelligence is being prepared.
          </strong>

          <p style="
            margin:8px 0 0;
            color:#6f675f;
          ">
            Your sourcing brief has been structured successfully.
            Live supplier matching will be connected in the next phase.
          </p>
        </div>
      `;
    }

    container.innerHTML = `
      <section
        class="casevo-results-panel"
        style="
          border-top:1px solid rgba(40,30,20,.18);
          padding-top:34px;
        "
      >

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          gap:24px;
          flex-wrap:wrap;
        ">

          <div>
            <div style="
              font-size:11px;
              letter-spacing:.16em;
              text-transform:uppercase;
              color:#a83227;
              margin-bottom:10px;
            ">
              CASEVO AI · SOURCING ANALYSIS
            </div>

            <h2 style="
              margin:0;
              font-size:38px;
              line-height:1.05;
              font-weight:500;
            ">
              Your sourcing brief is ready.
            </h2>
          </div>

          <div style="
            font-size:12px;
            color:#756c63;
          ">
            ${
              data.mode === "demo"
                ? "MVP Demo"
                : "AI Sourcing Analysis"
            }
          </div>

        </div>

        <div style="
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:1px;
          background:rgba(40,30,20,.14);
          margin-top:30px;
        ">

          <div style="
            background:#f7f1e6;
            padding:24px;
          ">
            <div style="
              font-size:10px;
              letter-spacing:.13em;
              color:#80766d;
            ">
              SUPPLIER MATCH
            </div>

            <div style="
              font-size:34px;
              margin-top:8px;
            ">
              ${escapeHtml(supplierMatch)}%
            </div>
          </div>

          <div style="
            background:#f7f1e6;
            padding:24px;
          ">
            <div style="
              font-size:10px;
              letter-spacing:.13em;
              color:#80766d;
            ">
              CASEVO SCORE
            </div>

            <div style="
              font-size:34px;
              margin-top:8px;
            ">
              ${escapeHtml(casevoScore)}
              <span style="font-size:16px;">/ 100</span>
            </div>
          </div>

          <div style="
            background:#f7f1e6;
            padding:24px;
          ">
            <div style="
              font-size:10px;
              letter-spacing:.13em;
              color:#80766d;
            ">
              VERIFICATION
            </div>

            <div style="
              font-size:18px;
              margin-top:14px;
            ">
              ${escapeHtml(verification)}
            </div>
          </div>

        </div>

        <div style="
          margin-top:28px;
          padding:22px 24px;
          background:#eee5d4;
        ">

          <div style="
            font-size:10px;
            letter-spacing:.13em;
            color:#80766d;
            text-transform:uppercase;
          ">
            SOURCING REQUIREMENT
          </div>

          <div style="
            margin-top:10px;
            font-size:17px;
            line-height:1.55;
          ">
            ${escapeHtml(requirement)}
          </div>

        </div>

        <div style="margin-top:34px;">

          <div style="
            font-size:11px;
            letter-spacing:.16em;
            color:#a83227;
            text-transform:uppercase;
          ">
            MATCHED SUPPLIERS
          </div>

          ${suppliersHtml}

        </div>

        ${
          data.message
            ? `
              <div style="
                margin-top:24px;
                color:#6d655d;
                font-size:14px;
                line-height:1.6;
              ">
                ${escapeHtml(data.message)}
              </div>
            `
            : ""
        }

      </section>
    `;

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  /* =====================================================
     HANDLE SUBMISSION
  ===================================================== */

  async function handleSourcingSubmit(event) {
    if (event) {
      event.preventDefault();
    }

    if (state.submitting) {
      return;
    }

    console.log("CASEVO: Analyze button clicked");

    const elements = detectFormElements();

    const data = collectFormValues(elements);

    const validation = validateRequest(data);

    if (!validation.valid) {
      console.warn(
        "CASEVO: Validation failed:",
        validation.message
      );

      showStatus(
        validation.message,
        "error"
      );

      /*
       IMPORTANT:

       Do not stop the browser default form submission
       because this function already prevents it.
       The page therefore stays on the same page.
      */

      return;
    }

    state.submitting = true;
    state.lastRequest = data;

    setButtonLoading(
      elements.button,
      true
    );

    showStatus(
      "Analyzing your sourcing requirement…",
      "loading"
    );

    try {
      const result = await callSourcingAPI(data);

      console.log(
        "CASEVO: Sourcing API response:",
        result
      );

      state.lastResponse = result;

      showStatus(
        "Sourcing analysis completed.",
        "success"
      );

      renderResults(
        result,
        data
      );

    } catch (error) {
      console.error(
        "CASEVO: Sourcing API request failed:",
        error
      );

      /*
       The current Worker/API route has returned 404
       in the browser.

       We therefore use a local MVP result rather than
       leaving the user with a dead button.
      */

      if (DEMO_MODE_ON_API_ERROR) {
        console.warn(
          "CASEVO: API unavailable. Showing MVP demo results."
        );

        const demoResult =
          buildDemoResponse(data);

        state.lastResponse = demoResult;

        showStatus(
          "Sourcing brief analyzed. Live supplier intelligence will be connected in the next phase.",
          "success"
        );

        renderResults(
          demoResult,
          data
        );

      } else {
        showStatus(
          "Unable to connect to the sourcing engine. Please try again.",
          "error"
        );
      }

    } finally {
      state.submitting = false;

      setButtonLoading(
        elements.button,
        false
      );
    }
  }

  /* =====================================================
     ATTACH EVENT LISTENERS
  ===================================================== */

  function attachListeners() {
    const elements = detectFormElements();

    logElements(elements);

    if (elements.form) {
      if (!elements.form.dataset.casevoSubmitBound) {
        elements.form.addEventListener(
          "submit",
          handleSourcingSubmit
        );

        elements.form.dataset.casevoSubmitBound = "true";

        console.log(
          "CASEVO: sourcing form submit listener attached."
        );
      }
    }

    if (elements.button) {
      if (!elements.button.dataset.casevoClickBound) {
        elements.button.addEventListener(
          "click",
          function (event) {
            /*
             If this button belongs to a form,
             the submit handler will also run.
             We avoid duplicate processing.
            */

            if (
              elements.form &&
              elements.button.type === "submit"
            ) {
              return;
            }

            handleSourcingSubmit(event);
          }
        );

        elements.button.dataset.casevoClickBound = "true";

        console.log(
          "CASEVO: Analyze button click listener attached."
        );
      }
    }

    return elements;
  }

  /* =====================================================
     EXPOSE DEBUG API
  ===================================================== */

  window.CASEVO = window.CASEVO || {};

  window.CASEVO.sourcing = {
    getElements: detectFormElements,

    collect: function () {
      return collectFormValues(
        detectFormElements()
      );
    },

    analyze: function () {
      return handleSourcingSubmit();
    },

    demo: function () {
      const elements = detectFormElements();

      const data = collectFormValues(elements);

      const result = buildDemoResponse(data);

      renderResults(
        result,
        data
      );

      return result;
    }
  };

  /* =====================================================
     INITIALIZE
  ===================================================== */

  function init() {
    console.log(
      "CASEVO: sourcing form initializing."
    );

    const elements = attachListeners();

    console.log(
      "CASEVO: sourcing form initialized."
    );

    /*
     Helpful for debugging in Chrome console:
     
     CASEVO.sourcing.collect()
     
     It should return the actual values from the form.
    */

    if (!elements.requirement) {
      console.warn(
        "CASEVO: Main sourcing textarea was not detected."
      );
    }

    if (!elements.button) {
      console.warn(
        "CASEVO: Analyze button was not detected."
      );
    }
  }

  /* =====================================================
     DOM READY
  ===================================================== */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

})();
