/*
============================================================
CASEVO AI SOURCING — FRONTEND
============================================================
Frontend for CASEVO AI China Sourcing platform.

API:
  POST /api/sourcing

No OpenAI API key is required in the browser.

Main flow:
  User input
      ↓
  Analyze & Find Matches
      ↓
  POST /api/sourcing
      ↓
  Worker response
      ↓
  Render sourcing intelligence
============================================================
*/

(function () {
  "use strict";

  const API_ENDPOINT = "/api/sourcing";

  console.log("CASEVO AI Sourcing frontend loaded.");
  console.log("CASEVO API:", API_ENDPOINT);

  /* ========================================================
     BASIC HELPERS
  ======================================================== */

  function qs(selector, root) {
    root = root || document;
    return root.querySelector(selector);
  }

  function qsa(selector, root) {
    root = root || document;
    return Array.from(root.querySelectorAll(selector));
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function isVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  function findFirst(selectors, root) {
    for (const selector of selectors) {
      const element = qs(selector, root);

      if (element) {
        return element;
      }
    }

    return null;
  }

  /* ========================================================
     FIND ELEMENTS
  ======================================================== */

  function findSourcingTextarea() {
    const selectors = [
      "#sourcingRequest",
      "#sourcing-request",
      "#request",
      "#brief",
      "#requirements",
      "#description",
      "textarea[name='request']",
      "textarea[name='requirements']",
      "textarea[name='description']",
      "textarea"
    ];

    return findFirst(selectors);
  }

  function findInputByLabel(labelText) {
    const wanted = normalizeText(labelText);

    const labels = qsa("label");

    for (const label of labels) {
      const text = normalizeText(label.textContent);

      if (!text.includes(wanted)) {
        continue;
      }

      const forId = label.getAttribute("for");

      if (forId) {
        const target = document.getElementById(forId);

        if (target) {
          return target;
        }
      }

      const nested = label.querySelector("input, textarea, select");

      if (nested) {
        return nested;
      }

      let parent = label.parentElement;

      for (let i = 0; i < 3 && parent; i++) {
        const input = parent.querySelector(
          "input, textarea, select"
        );

        if (input) {
          return input;
        }

        parent = parent.parentElement;
      }
    }

    /*
      Fallback:
      Look for text near input fields.
    */

    const fields = qsa("input, textarea, select");

    for (const field of fields) {
      const parent = field.parentElement;

      if (!parent) continue;

      const parentText = normalizeText(parent.textContent);

      if (parentText.includes(wanted)) {
        return field;
      }
    }

    return null;
  }

  function findProductInput() {
    return findFirst(
      [
        "#product",
        "#material",
        "#productMaterial",
        "#product-material",
        "input[name='product']",
        "input[name='material']"
      ]
    ) || findInputByLabel("product / material")
      || findInputByLabel("product")
      || findInputByLabel("material");
  }

  function findQuantityInput() {
    return findFirst(
      [
        "#quantity",
        "input[name='quantity']",
        "input[name='qty']"
      ]
    ) || findInputByLabel("quantity");
  }

  function findPriceInput() {
    return findFirst(
      [
        "#targetPrice",
        "#target-price",
        "#price",
        "input[name='targetPrice']",
        "input[name='target_price']",
        "input[name='price']"
      ]
    ) || findInputByLabel("target price")
      || findInputByLabel("price");
  }

  function findDestinationInput() {
    return findFirst(
      [
        "#destination",
        "#dest",
        "input[name='destination']",
        "input[name='dest']"
      ]
    ) || findInputByLabel("destination");
  }

  function findAnalyzeButton() {
    const directSelectors = [
      "#analyzeButton",
      "#analyze-button",
      "#analyze",
      "#findMatches",
      "#find-matches",
      "#submitSourcing",
      "#sourcingSubmit",
      "button[type='submit']"
    ];

    const direct = findFirst(directSelectors);

    if (direct) {
      return direct;
    }

    const buttons = qsa(
      "button, a, input[type='button'], input[type='submit']"
    );

    const keywords = [
      "analyze",
      "find matches",
      "find match",
      "sourcing",
      "start ai sourcing"
    ];

    for (const button of buttons) {
      const text = normalizeText(
        button.innerText ||
        button.textContent ||
        button.value
      );

      if (!text) continue;

      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return button;
        }
      }
    }

    return null;
  }

  /* ========================================================
     FORM DISCOVERY
  ======================================================== */

  function getFormElements() {
    const textarea = findSourcingTextarea();
    const product = findProductInput();
    const quantity = findQuantityInput();
    const price = findPriceInput();
    const destination = findDestinationInput();
    const button = findAnalyzeButton();

    return {
      textarea,
      product,
      quantity,
      price,
      destination,
      button
    };
  }

  /* ========================================================
     UI STATUS
  ======================================================== */

  function getStatusElement() {
    let status = qs("#casevo-status");

    if (status) {
      return status;
    }

    status = document.createElement("div");

    status.id = "casevo-status";

    status.style.marginTop = "18px";
    status.style.padding = "12px 14px";
    status.style.border = "1px solid rgba(0,0,0,.12)";
    status.style.background = "rgba(255,255,255,.45)";
    status.style.fontSize = "13px";
    status.style.lineHeight = "1.5";
    status.style.display = "none";

    const button = findAnalyzeButton();

    if (button && button.parentElement) {
      button.parentElement.appendChild(status);
    } else {
      document.body.appendChild(status);
    }

    return status;
  }

  function showStatus(message, type) {
    const status = getStatusElement();

    status.style.display = "block";

    if (type === "error") {
      status.style.borderColor = "#b52d25";
      status.style.color = "#8f211b";
    } else if (type === "success") {
      status.style.borderColor = "#777";
      status.style.color = "#222";
    } else {
      status.style.borderColor = "rgba(0,0,0,.12)";
      status.style.color = "#555";
    }

    status.textContent = message;
  }

  function hideStatus() {
    const status = qs("#casevo-status");

    if (status) {
      status.style.display = "none";
    }
  }

  /* ========================================================
     RESULT AREA
  ======================================================== */

  function findResultContainer() {
    const selectors = [
      "#sourcingResults",
      "#sourcing-results",
      "#results",
      "#resultsContainer",
      "#supplierResults",
      "#supplier-results",
      ".sourcing-results",
      ".supplier-results",
      ".results"
    ];

    const existing = findFirst(selectors);

    if (existing) {
      return existing;
    }

    /*
      If the original HTML has no result container,
      create one after the sourcing form.
    */

    const textarea = findSourcingTextarea();

    if (textarea) {
      let parent = textarea.parentElement;

      for (let i = 0; i < 5 && parent; i++) {
        if (
          parent.querySelector("button") ||
          parent.querySelector("input")
        ) {
          const result = document.createElement("div");

          result.id = "casevo-results";

          result.style.marginTop = "40px";

          parent.insertAdjacentElement(
            "afterend",
            result
          );

          return result;
        }

        parent = parent.parentElement;
      }
    }

    const result = document.createElement("div");

    result.id = "casevo-results";
    result.style.margin = "40px auto";
    result.style.maxWidth = "1100px";

    document.body.appendChild(result);

    return result;
  }

  function clearResults() {
    const container = findResultContainer();

    if (container) {
      container.innerHTML = "";
    }
  }

  /* ========================================================
     REQUEST DATA
  ======================================================== */

  function collectRequest() {
    const elements = getFormElements();

    const requestText = elements.textarea
      ? elements.textarea.value.trim()
      : "";

    const product = elements.product
      ? elements.product.value.trim()
      : "";

    const quantity = elements.quantity
      ? elements.quantity.value.trim()
      : "";

    const targetPrice = elements.price
      ? elements.price.value.trim()
      : "";

    const destination = elements.destination
      ? elements.destination.value.trim()
      : "";

    console.log("CASEVO: Form values collected", {
      request: requestText,
      product: product,
      quantity: quantity,
      targetPrice: targetPrice,
      destination: destination
    });

    return {
      request: requestText,
      product: product,
      quantity: quantity,
      targetPrice: targetPrice,
      destination: destination
    };
  }

  /* ========================================================
     VALIDATION
  ======================================================== */

  function validateRequest(data) {
    if (!data.request && !data.product) {
      return "Please enter a sourcing requirement.";
    }

    return null;
  }

  /* ========================================================
     BUTTON STATE
  ======================================================== */

  function setButtonLoading(button, loading) {
    if (!button) return;

    if (loading) {
      if (!button.dataset.casevoOriginalText) {
        button.dataset.casevoOriginalText =
          button.innerHTML;
      }

      button.disabled = true;
      button.style.opacity = "0.65";
      button.style.cursor = "wait";

      button.innerHTML =
        "Analyzing sourcing requirements <span>→</span>";
    } else {
      button.disabled = false;
      button.style.opacity = "";
      button.style.cursor = "";

      if (button.dataset.casevoOriginalText) {
        button.innerHTML =
          button.dataset.casevoOriginalText;
      }
    }
  }

  /* ========================================================
     API REQUEST
  ======================================================== */

  async function callSourcingAPI(data) {
    console.log(
      "CASEVO: Sending sourcing request to",
      API_ENDPOINT
    );

    const payload = {
      request: data.request,
      product: data.product,
      material: data.product,
      quantity: data.quantity,
      targetPrice: data.targetPrice,
      target_price: data.targetPrice,
      destination: data.destination
    };

    console.log("CASEVO: API payload", payload);

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log(
      "CASEVO: API HTTP status:",
      response.status
    );

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
          text: text
        };
      }
    }

    console.log("CASEVO: API response received", result);

    if (!response.ok) {
      throw new Error(
        result && result.error
          ? result.error
          : "Sourcing API returned HTTP " +
            response.status
      );
    }

    return result;
  }

  /* ========================================================
     RESULT NORMALIZATION
  ======================================================== */

  function getValue(object, keys, fallback) {
    if (!object || typeof object !== "object") {
      return fallback;
    }

    for (const key of keys) {
      if (
        object[key] !== undefined &&
        object[key] !== null
      ) {
        return object[key];
      }
    }

    return fallback;
  }

  function normalizeSuppliers(data) {
    if (!data || typeof data !== "object") {
      return [];
    }

    const suppliers = getValue(
      data,
      [
        "suppliers",
        "matches",
        "supplier_matches",
        "supplierMatches",
        "results"
      ],
      []
    );

    if (!Array.isArray(suppliers)) {
      return [];
    }

    return suppliers;
  }

  /* ========================================================
     SCORE HELPERS
  ======================================================== */

  function getScore(data) {
    const value = getValue(
      data,
      [
        "casevo_score",
        "casevoScore",
        "score",
        "CASEVO Score"
      ],
      null
    );

    if (value === null) {
      return null;
    }

    if (typeof value === "string") {
      const match = value.match(/\d+(?:\.\d+)?/);

      if (match) {
        return match[0];
      }
    }

    return value;
  }

  function getMatchScore(supplier) {
    const value = getValue(
      supplier,
      [
        "match",
        "match_score",
        "matchScore",
        "supplier_match",
        "supplierMatch",
        "score"
      ],
      null
    );

    if (value === null) {
      return null;
    }

    return value;
  }

  /* ========================================================
     RENDER HEADER
  ======================================================== */

  function renderResults(data) {
    const container = findResultContainer();

    if (!container) {
      return;
    }

    const suppliers = normalizeSuppliers(data);
    const score = getScore(data);

    let html = "";

    html += `
      <section
        class="casevo-result-section"
        style="
          border-top:1px solid rgba(0,0,0,.15);
          padding-top:32px;
        "
      >
    `;

    html += `
      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          gap:30px;
          margin-bottom:28px;
          flex-wrap:wrap;
        "
      >
        <div>
          <div
            style="
              font-size:11px;
              letter-spacing:.18em;
              text-transform:uppercase;
              color:#b52d25;
              margin-bottom:10px;
            "
          >
            CASEVO / SOURCING INTELLIGENCE
          </div>

          <h2
            style="
              margin:0;
              font-size:36px;
              line-height:1.05;
              font-weight:600;
            "
          >
            Sourcing analysis
          </h2>
        </div>
    `;

    if (score !== null) {
      html += `
        <div
          style="
            min-width:150px;
            padding:18px 22px;
            background:#1d1b19;
            color:#fff;
          "
        >
          <div
            style="
              font-size:10px;
              letter-spacing:.16em;
              text-transform:uppercase;
              opacity:.65;
            "
          >
            CASEVO Score
          </div>

          <div
            style="
              font-size:34px;
              font-weight:600;
              margin-top:5px;
            "
          >
            ${escapeHtml(score)}
          </div>
        </div>
      `;
    }

    html += `
      </div>
    `;

    /*
      Summary
    */

    const summary = getValue(
      data,
      [
        "summary",
        "analysis",
        "message",
        "recommendation",
        "brief"
      ],
      ""
    );

    if (summary) {
      html += `
        <div
          style="
            padding:20px 22px;
            border:1px solid rgba(0,0,0,.12);
            margin-bottom:28px;
            line-height:1.7;
          "
        >
          ${escapeHtml(summary)}
        </div>
      `;
    }

    /*
      Supplier matches
    */

    if (suppliers.length > 0) {
      html += `
        <div
          style="
            font-size:11px;
            letter-spacing:.18em;
            text-transform:uppercase;
            margin-bottom:14px;
          "
        >
          Supplier Matches
        </div>

        <div
          style="
            display:grid;
            grid-template-columns:
              repeat(auto-fit,minmax(260px,1fr));
            gap:16px;
          "
        >
      `;

      suppliers.forEach(function (supplier, index) {
        html += renderSupplierCard(
          supplier,
          index
        );
      });

      html += `
        </div>
      `;
    } else {
      html += `
        <div
          style="
            border:1px solid rgba(0,0,0,.12);
            padding:24px;
            line-height:1.7;
          "
        >
          <strong>
            Analysis completed.
          </strong>

          <div style="margin-top:8px;color:#666;">
            No supplier records were returned by the
            current sourcing engine.
          </div>
        </div>
      `;
    }

    /*
      Verification
    */

    const verification = getValue(
      data,
      [
        "verification",
        "verified",
        "verification_status",
        "verificationStatus"
      ],
      null
    );

    if (verification !== null) {
      html += `
        <div
          style="
            margin-top:24px;
            font-size:13px;
            color:#666;
          "
        >
          Verification:
          <strong style="color:#222;">
            ${escapeHtml(verification)}
          </strong>
        </div>
      `;
    }

    html += `
      </section>
    `;

    container.innerHTML = html;

    /*
      Smoothly move user to result area.
    */

    setTimeout(function () {
      try {
        container.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      } catch (error) {
        // Ignore scrolling errors.
      }
    }, 100);
  }

  /* ========================================================
     SUPPLIER CARD
  ======================================================== */

  function renderSupplierCard(supplier, index) {
    if (
      !supplier ||
      typeof supplier !== "object"
    ) {
      return "";
    }

    const name = getValue(
      supplier,
      [
        "name",
        "supplier_name",
        "supplierName",
        "company",
        "company_name",
        "companyName"
      ],
      "Supplier " + (index + 1)
    );

    const location = getValue(
      supplier,
      [
        "location",
        "city",
        "province",
        "region"
      ],
      ""
    );

    const category = getValue(
      supplier,
      [
        "category",
        "material",
        "product",
        "specialty"
      ],
      ""
    );

    const match = getMatchScore(supplier);

    const scoreText =
      match !== null
        ? String(match)
        : "—";

    return `
      <article
        style="
          border:1px solid rgba(0,0,0,.14);
          padding:22px;
          background:rgba(255,255,255,.3);
        "
      >
        <div
          style="
            display:flex;
            justify-content:space-between;
            gap:15px;
            align-items:flex-start;
          "
        >
          <div>
            <div
              style="
                font-size:20px;
                font-weight:600;
                line-height:1.2;
              "
            >
              ${escapeHtml(name)}
            </div>

            ${
              location
                ? `
                  <div
                    style="
                      margin-top:7px;
                      color:#777;
                      font-size:13px;
                    "
                  >
                    ${escapeHtml(location)}
                  </div>
                `
                : ""
            }
          </div>

          <div
            style="
              text-align:right;
              white-space:nowrap;
            "
          >
            <div
              style="
                font-size:10px;
                letter-spacing:.12em;
                text-transform:uppercase;
                color:#777;
              "
            >
              Match
            </div>

            <div
              style="
                font-size:23px;
                font-weight:600;
                margin-top:2px;
              "
            >
              ${escapeHtml(scoreText)}
            </div>
          </div>
        </div>

        ${
          category
            ? `
              <div
                style="
                  margin-top:18px;
                  padding-top:15px;
                  border-top:1px solid rgba(0,0,0,.09);
                  font-size:13px;
                  color:#555;
                "
              >
                ${escapeHtml(category)}
              </div>
            `
            : ""
        }
      </article>
    `;
  }

  /* ========================================================
     MAIN CLICK HANDLER
  ======================================================== */

  async function handleAnalyze(event) {
    /*
      IMPORTANT:
      Prevent normal link navigation and form submission.
    */

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    console.log(
      "CASEVO: Analyze button clicked"
    );

    hideStatus();
    clearResults();

    const elements = getFormElements();

    console.log(
      "CASEVO: Detected form elements",
      elements
    );

    if (!elements.button) {
      console.error(
        "CASEVO: Analyze button could not be found."
      );

      showStatus(
        "CASEVO could not detect the Analyze button.",
        "error"
      );

      return false;
    }

    const data = collectRequest();

    const validationError =
      validateRequest(data);

    if (validationError) {
      console.warn(
        "CASEVO: Validation failed:",
        validationError
      );

      showStatus(
        validationError,
        "error"
      );

      if (elements.textarea) {
        elements.textarea.focus();
      }

      return false;
    }

    setButtonLoading(
      elements.button,
      true
    );

    showStatus(
      "Analyzing your sourcing requirement…",
      "loading"
    );

    try {
      const result =
        await callSourcingAPI(data);

      console.log(
        "CASEVO: Rendering sourcing results"
      );

      renderResults(result);

      showStatus(
        "Analysis completed successfully.",
        "success"
      );

      return true;

    } catch (error) {
      console.error(
        "CASEVO: Sourcing request failed:",
        error
      );

      showStatus(
        "We could not complete the sourcing analysis. " +
        (error && error.message
          ? error.message
          : "Please try again."),
        "error"
      );

      return false;

    } finally {
      setButtonLoading(
        elements.button,
        false
      );
    }
  }

  /* ========================================================
     FORM SUBMISSION HANDLER
  ======================================================== */

  function bindForm(form) {
    if (!form) {
      return;
    }

    if (form.dataset.casevoBound === "true") {
      return;
    }

    form.dataset.casevoBound = "true";

    form.addEventListener(
      "submit",
      handleAnalyze
    );

    console.log(
      "CASEVO: sourcing form submit listener attached."
    );
  }

  /* ========================================================
     BUTTON BINDING
  ======================================================== */

  function bindAnalyzeButton() {
    const button = findAnalyzeButton();

    if (!button) {
      console.warn(
        "CASEVO: Analyze button not found."
      );

      return false;
    }

    if (
      button.dataset.casevoClickBound === "true"
    ) {
      return true;
    }

    button.dataset.casevoClickBound = "true";

    button.addEventListener(
      "click",
      handleAnalyze,
      false
    );

    console.log(
      "CASEVO: Analyze button click listener attached.",
      button
    );

    return true;
  }

  /* ========================================================
     INITIALIZATION
  ======================================================== */

  function initialize() {
    console.log(
      "CASEVO: sourcing form initializing."
    );

    const elements =
      getFormElements();

    console.log(
      "CASEVO: Elements found:",
      {
        textarea: !!elements.textarea,
        product: !!elements.product,
        quantity: !!elements.quantity,
        price: !!elements.price,
        destination: !!elements.destination,
        button: !!elements.button
      }
    );

    /*
      Bind forms.
    */

    const forms = qsa("form");

    forms.forEach(function (form) {
      const text =
        normalizeText(form.textContent);

      /*
        Bind any form containing sourcing-related
        controls, or simply the first form if it
        contains our textarea.
      */

      if (
        text.includes("sourcing") ||
        text.includes("product") ||
        form.querySelector("textarea")
      ) {
        bindForm(form);
      }
    });

    /*
      Bind Analyze button.
    */

    bindAnalyzeButton();

    /*
      Retry because some page builders dynamically
      insert content after DOMContentLoaded.
    */

    let attempts = 0;

    const retryTimer =
      setInterval(function () {
        attempts++;

        const bound =
          bindAnalyzeButton();

        if (bound || attempts >= 20) {
          clearInterval(retryTimer);
        }
      }, 500);

    console.log(
      "CASEVO: sourcing form initialized."
    );
  }

  /* ========================================================
     OBSERVE DYNAMIC DOM CHANGES
  ======================================================== */

  function observePage() {
    if (!window.MutationObserver) {
      return;
    }

    const observer =
      new MutationObserver(function () {
        bindAnalyzeButton();
      });

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  /* ========================================================
     START
  ======================================================== */

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        initialize();
        observePage();
      }
    );
  } else {
    initialize();
    observePage();
  }

})();
