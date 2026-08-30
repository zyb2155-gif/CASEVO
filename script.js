/* =========================================================
   CASEVO AI
   REAL SUPPLIER DISCOVERY ENGINE
   Frontend Script v3.0
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     CONFIG
     ========================================================= */

  const API_ENDPOINT = "/api/sourcing";

  const CASEVO = {
    name: "CASEVO AI",
    version: "3.0.0"
  };

  /* =========================================================
     HELPERS
     ========================================================= */

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function generateRequestId() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";

    for (let i = 0; i < 8; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }

    return `CASEVO-${Date.now().toString(36).toUpperCase()}-${result}`;
  }

  function getElementByText(text) {
    const elements = Array.from(
      document.querySelectorAll("button, a, h1, h2, h3, p, label, span")
    );

    return elements.find((el) => {
      return normalizeText(el.textContent).toLowerCase() === text.toLowerCase();
    });
  }

  function findInputByLabel(labelText) {
    const labels = Array.from(document.querySelectorAll("label"));

    for (const label of labels) {
      const text = normalizeText(label.textContent).toLowerCase();

      if (text.includes(labelText.toLowerCase())) {
        const forId = label.getAttribute("for");

        if (forId) {
          const element = document.getElementById(forId);

          if (element) {
            return element;
          }
        }

        const inside = label.querySelector("input, textarea");

        if (inside) {
          return inside;
        }

        const parent = label.parentElement;

        if (parent) {
          const nearby = parent.querySelector("input, textarea");

          if (nearby) {
            return nearby;
          }
        }
      }
    }

    return null;
  }

  function findInputByPlaceholder(text) {
    const elements = Array.from(
      document.querySelectorAll("input, textarea")
    );

    return elements.find((element) => {
      const placeholder = normalizeText(
        element.getAttribute("placeholder")
      ).toLowerCase();

      return placeholder.includes(text.toLowerCase());
    });
  }

  function findTextarea() {
    return (
      document.querySelector("textarea") ||
      findInputByLabel("what are you sourcing") ||
      findInputByPlaceholder("what are you sourcing")
    );
  }

  function findProductInput() {
    return (
      findInputByLabel("product / material") ||
      findInputByPlaceholder("upper leather") ||
      findInputByPlaceholder("product")
    );
  }

  function findQuantityInput() {
    return (
      findInputByLabel("quantity") ||
      findInputByPlaceholder("5,000 pairs") ||
      findInputByPlaceholder("quantity")
    );
  }

  function findPriceInput() {
    return (
      findInputByLabel("target price") ||
      findInputByPlaceholder("$4 / sqft") ||
      findInputByPlaceholder("target price")
    );
  }

  function findDestinationInput() {
    return (
      findInputByLabel("destination") ||
      findInputByPlaceholder("USA") ||
      findInputByPlaceholder("destination")
    );
  }

  /* =========================================================
     FORM ELEMENTS
     ========================================================= */

  function getFormElements() {
    return {
      request: findTextarea(),
      product: findProductInput(),
      quantity: findQuantityInput(),
      targetPrice: findPriceInput(),
      destination: findDestinationInput()
    };
  }

  /* =========================================================
     FIND ANALYZE BUTTON
     ========================================================= */

  function findAnalyzeButton() {
    const buttons = Array.from(
      document.querySelectorAll("button, input[type='submit']")
    );

    const keywords = [
      "analyze",
      "find matches",
      "start ai sourcing",
      "start sourcing"
    ];

    for (const button of buttons) {
      const text = normalizeText(
        button.textContent || button.value
      ).toLowerCase();

      if (
        keywords.some((keyword) => text.includes(keyword))
      ) {
        return button;
      }
    }

    return null;
  }

  /* =========================================================
     FIND FORM
     ========================================================= */

  function findForm() {
    const button = findAnalyzeButton();

    if (!button) {
      return null;
    }

    return (
      button.closest("form") ||
      button.parentElement?.parentElement ||
      button.parentElement
    );
  }

  /* =========================================================
     LOADING STATE
     ========================================================= */

  function setLoading(button, loading) {
    if (!button) return;

    if (loading) {
      button.dataset.originalText =
        button.innerHTML;

      button.disabled = true;

      button.innerHTML = `
        <span style="
          display:inline-flex;
          align-items:center;
          gap:8px;
        ">
          <span style="
            width:12px;
            height:12px;
            border:2px solid currentColor;
            border-right-color:transparent;
            border-radius:50%;
            display:inline-block;
            animation:casevoSpin .8s linear infinite;
          "></span>
          Finding suppliers...
        </span>
      `;
    } else {
      button.disabled = false;

      if (button.dataset.originalText) {
        button.innerHTML =
          button.dataset.originalText;
      }
    }
  }

  /* =========================================================
     CSS FOR LOADING
     ========================================================= */

  function injectRuntimeCSS() {
    if (document.getElementById("casevo-runtime-css")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "casevo-runtime-css";

    style.textContent = `
      @keyframes casevoSpin {
        from {
          transform: rotate(0deg);
        }

        to {
          transform: rotate(360deg);
        }
      }

      .casevo-supplier-card {
        border: 1px solid #d8d0c4;
        padding: 22px;
        margin-top: 18px;
        background: #fbf8f1;
      }

      .casevo-supplier-card:hover {
        border-color: #b52e25;
      }

      .casevo-supplier-name {
        font-family: Georgia, serif;
        font-size: 24px;
        line-height: 1.15;
        margin-bottom: 10px;
      }

      .casevo-supplier-meta {
        font-size: 13px;
        line-height: 1.6;
        color: #555;
      }

      .casevo-supplier-link {
        display: inline-block;
        margin-top: 12px;
        color: #b52e25;
        text-decoration: none;
        font-weight: 600;
      }

      .casevo-supplier-link:hover {
        text-decoration: underline;
      }

      .casevo-match-score {
        display: inline-block;
        margin-top: 12px;
        padding: 5px 9px;
        background: #1e1c19;
        color: white;
        font-size: 11px;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      .casevo-status {
        border: 1px solid #d8d0c4;
        padding: 18px;
        margin-top: 18px;
        background: #fbf8f1;
      }

      .casevo-status.error {
        border-color: #c84a40;
      }

      .casevo-status.success {
        border-color: #b9b09f;
      }

      .casevo-status-title {
        font-weight: 700;
        margin-bottom: 7px;
      }

      .casevo-analysis-box {
        margin-top: 24px;
      }

      .casevo-eyebrow {
        font-size: 10px;
        letter-spacing: .18em;
        text-transform: uppercase;
        color: #a52d25;
        margin-bottom: 10px;
      }

      .casevo-empty {
        border: 1px solid #d8d0c4;
        padding: 20px;
        margin-top: 18px;
        color: #555;
        line-height: 1.6;
      }

      .casevo-supplier-description {
        margin-top: 10px;
        color: #444;
        line-height: 1.55;
      }

      .casevo-request-id {
        margin-top: 18px;
        font-size: 11px;
        color: #777;
      }

      .casevo-source {
        margin-top: 12px;
        font-size: 11px;
        color: #777;
      }
    `;

    document.head.appendChild(style);
  }

  /* =========================================================
     RESULT CONTAINER
     ========================================================= */

  function findExistingResultsArea() {
    const headings = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, p, div")
    );

    const target = headings.find((element) => {
      const text = normalizeText(
        element.textContent
      ).toLowerCase();

      return (
        text.includes("real supplier discovery completed") ||
        text.includes("potential suppliers found") ||
        text.includes("sourcing analysis completed")
      );
    });

    if (target) {
      return (
        target.closest("section") ||
        target.closest("article") ||
        target.closest(".card") ||
        target.parentElement?.parentElement ||
        target.parentElement
      );
    }

    return null;
  }

  function getResultsContainer() {
    let container = document.getElementById(
      "casevo-results-container"
    );

    if (container) {
      return container;
    }

    const existing = findExistingResultsArea();

    if (existing) {
      container = existing;
      container.id = "casevo-results-container";
      return container;
    }

    const form = findForm();

    container = document.createElement("div");

    container.id = "casevo-results-container";

    container.style.marginTop = "30px";

    if (form && form.parentElement) {
      form.parentElement.appendChild(container);
    } else {
      document.body.appendChild(container);
    }

    return container;
  }

  /* =========================================================
     NORMALIZE SUPPLIER DATA
     ========================================================= */

  function normalizeSupplier(item) {
    if (!item) {
      return null;
    }

    if (typeof item === "string") {
      return {
        name: item,
        website: "",
        location: "",
        description: "",
        score: null
      };
    }

    return {
      name:
        item.name ||
        item.company ||
        item.companyName ||
        item.title ||
        item.supplier ||
        "Supplier",

      website:
        item.website ||
        item.url ||
        item.link ||
        item.domain ||
        "",

      location:
        item.location ||
        item.city ||
        item.country ||
        item.address ||
        "",

      description:
        item.description ||
        item.summary ||
        item.reason ||
        item.snippet ||
        item.about ||
        "",

      score:
        item.score ??
        item.matchScore ??
        item.match ??
        item.relevance ??
        null
    };
  }

  /* =========================================================
     EXTRACT SUPPLIERS FROM API RESPONSE
     ========================================================= */

  function extractSuppliers(data) {
    if (!data) {
      return [];
    }

    const possibleArrays = [
      data.suppliers,
      data.matches,
      data.results,
      data.supplierMatches,
      data.supplier_matches,
      data.data?.suppliers,
      data.data?.matches,
      data.data?.results
    ];

    for (const list of possibleArrays) {
      if (Array.isArray(list)) {
        return list
          .map(normalizeSupplier)
          .filter(Boolean);
      }
    }

    return [];
  }

  /* =========================================================
     FORMAT SCORE
     ========================================================= */

  function formatScore(score) {
    if (
      score === null ||
      score === undefined ||
      score === ""
    ) {
      return "";
    }

    let number = Number(score);

    if (!Number.isFinite(number)) {
      return "";
    }

    if (number <= 1) {
      number = number * 100;
    }

    number = Math.round(number);

    return `${Math.max(0, Math.min(100, number))}% match`;
  }

  /* =========================================================
     RENDER REQUEST SUMMARY
     ========================================================= */

  function renderRequestSummary(values, requestId) {
    return `
      <div class="casevo-analysis-box">

        <div class="casevo-eyebrow">
          CASEVO AI / SOURCING ANALYSIS
        </div>

        <h2>
          Real supplier discovery completed.
        </h2>

        <div style="margin-top:18px; line-height:1.8;">
          <strong>Product / Material:</strong>
          ${escapeHTML(values.product || "Not specified")}
        </div>

        <div style="line-height:1.8;">
          <strong>Quantity:</strong>
          ${escapeHTML(values.quantity || "Not specified")}
        </div>

        <div style="line-height:1.8;">
          <strong>Target Price:</strong>
          ${escapeHTML(values.targetPrice || "Not specified")}
        </div>

        <div style="line-height:1.8;">
          <strong>Destination:</strong>
          ${escapeHTML(values.destination || "Not specified")}
        </div>

        <div class="casevo-request-id">
          Request ID: ${escapeHTML(requestId)}
        </div>

      </div>
    `;
  }

  /* =========================================================
     RENDER SUPPLIER
     ========================================================= */

  function renderSupplier(supplier, index) {
    const name = escapeHTML(
      supplier.name || `Supplier ${index + 1}`
    );

    const location = escapeHTML(
      supplier.location || ""
    );

    const description = escapeHTML(
      supplier.description ||
      "Public-web evidence indicates potential supplier capability related to this sourcing requirement."
    );

    let websiteHTML = "";

    if (supplier.website) {
      let url = supplier.website;

      if (
        !url.startsWith("http://") &&
        !url.startsWith("https://")
      ) {
        url = `https://${url}`;
      }

      websiteHTML = `
        <a
          class="casevo-supplier-link"
          href="${escapeHTML(url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Visit supplier website →
        </a>
      `;
    }

    const score = formatScore(
      supplier.score
    );

    const scoreHTML = score
      ? `<div class="casevo-match-score">${score}</div>`
      : "";

    return `
      <div class="casevo-supplier-card">

        <div class="casevo-eyebrow">
          Supplier ${index + 1}
        </div>

        <div class="casevo-supplier-name">
          ${name}
        </div>

        ${
          location
            ? `
              <div class="casevo-supplier-meta">
                <strong>Location:</strong>
                ${location}
              </div>
            `
            : ""
        }

        <div class="casevo-supplier-description">
          ${description}
        </div>

        ${scoreHTML}

        ${websiteHTML}

      </div>
    `;
  }

  /* =========================================================
     RENDER RESULTS
     ========================================================= */

  function renderResults(
    values,
    data,
    requestId
  ) {
    const container =
      getResultsContainer();

    const suppliers =
      extractSuppliers(data);

    let html =
      renderRequestSummary(
        values,
        requestId
      );

    html += `
      <div style="margin-top:30px;">
        <div class="casevo-eyebrow">
          REAL SUPPLIER MATCHES
        </div>

        <h3 style="
          font-family:Georgia,serif;
          font-size:30px;
          line-height:1.15;
          margin:0;
        ">
          ${
            suppliers.length
              ? `${suppliers.length} potential suppliers found.`
              : "Supplier discovery completed."
          }
        </h3>
      </div>
    `;

    if (suppliers.length) {
      suppliers.forEach(
        (supplier, index) => {
          html += renderSupplier(
            supplier,
            index
          );
        }
      );
    } else {
      html += `
        <div class="casevo-empty">

          CASEVO completed the supplier discovery
          analysis, but no supplier matches were
          returned from the public web search.

          <br><br>

          Try using a more specific product or
          material description, such as:

          <br><br>

          <strong>
            Premium full-grain leather shoe upper,
            1.4mm, black, men's sneakers
          </strong>

        </div>
      `;
    }

    html += `
      <div class="casevo-source">
        Supplier data source:
        Public web search via Tavily
      </div>
    `;

    container.innerHTML = html;

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  /* =========================================================
     ERROR RENDER
     ========================================================= */

  function renderError(
    values,
    error,
    requestId
  ) {
    const container =
      getResultsContainer();

    container.innerHTML = `
      <div class="casevo-status error">

        <div class="casevo-eyebrow">
          CASEVO AI / ERROR
        </div>

        <div class="casevo-status-title">
          Supplier discovery could not be completed.
        </div>

        <div style="line-height:1.6;">
          ${escapeHTML(
            error ||
            "The supplier search service returned an unexpected response."
          )}
        </div>

        <div class="casevo-request-id">
          Request ID: ${escapeHTML(requestId)}
        </div>

      </div>
    `;

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  /* =========================================================
     BUILD REQUEST BODY
     ========================================================= */

  function buildRequestBody(
    values,
    requestId
  ) {
    return {

      /* Primary fields */
      request: values.request,

      product: values.product,

      material: values.product,

      quantity: values.quantity,

      targetPrice: values.targetPrice,

      target_price: values.targetPrice,

      destination: values.destination,

      /* Additional aliases for compatibility */
      query: values.request,

      sourcingRequest: values.request,

      sourcing_request: values.request,

      productMaterial: values.product,

      product_material: values.product,

      /* CASEVO metadata */
      requestId: requestId,

      request_id: requestId,

      service: CASEVO.name,

      version: CASEVO.version
    };
  }

  /* =========================================================
     API REQUEST
     ========================================================= */

  async function callSourcingAPI(
    values,
    requestId
  ) {
    const body =
      buildRequestBody(
        values,
        requestId
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

          body: JSON.stringify(body)
        }
      );

    const text =
      await response.text();

    let data = null;

    try {
      data = text
        ? JSON.parse(text)
        : null;
    } catch (error) {
      data = {
        raw: text
      };
    }

    if (!response.ok) {
      const message =
        data?.error ||
        data?.message ||
        data?.details ||
        `Supplier search failed (${response.status})`;

      throw new Error(message);
    }

    if (
      data &&
      data.ok === false
    ) {
      throw new Error(
        data.error ||
        data.message ||
        "Supplier search failed."
      );
    }

    return data;
  }

  /* =========================================================
     VALIDATE FORM
     ========================================================= */

  function validate(values) {
    if (!values.request) {
      return "Please describe what you are sourcing.";
    }

    if (
      !values.product &&
      !values.request
    ) {
      return "Please enter a product or material.";
    }

    if (!values.destination) {
      return "Please enter a destination.";
    }

    return "";
  }

  /* =========================================================
     MAIN ANALYZE HANDLER
     ========================================================= */

  async function handleAnalyze(event) {
    if (event) {
      event.preventDefault();
    }

    const fields =
      getFormElements();

    const values = {
      request:
        normalizeText(
          fields.request?.value
        ),

      product:
        normalizeText(
          fields.product?.value
        ),

      quantity:
        normalizeText(
          fields.quantity?.value
        ),

      targetPrice:
        normalizeText(
          fields.targetPrice?.value
        ),

      destination:
        normalizeText(
          fields.destination?.value
        )
    };

    const error =
      validate(values);

    const button =
      findAnalyzeButton();

    if (error) {
      renderError(
        values,
        error,
        generateRequestId()
      );

      return;
    }

    const requestId =
      generateRequestId();

    /* Save latest request locally */
    try {
      localStorage.setItem(
        "casevo_last_request_id",
        requestId
      );

      localStorage.setItem(
        "casevo_last_request",
        JSON.stringify(values)
      );
    } catch (storageError) {
      console.warn(
        "CASEVO localStorage unavailable.",
        storageError
      );
    }

    setLoading(
      button,
      true
    );

    const container =
      getResultsContainer();

    container.innerHTML = `
      <div class="casevo-status">

        <div class="casevo-eyebrow">
          CASEVO AI / SOURCING ENGINE
        </div>

        <div class="casevo-status-title">
          Searching the public web for real suppliers...
        </div>

        <div style="
          margin-top:8px;
          color:#666;
          line-height:1.6;
        ">
          CASEVO is analyzing supplier evidence,
          manufacturing capability and relevance.
        </div>

        <div class="casevo-request-id">
          Request ID: ${escapeHTML(requestId)}
        </div>

      </div>
    `;

    try {
      const data =
        await callSourcingAPI(
          values,
          requestId
        );

      console.log(
        "CASEVO sourcing response:",
        data
      );

      renderResults(
        values,
        data,
        requestId
      );

    } catch (error) {
      console.error(
        "CASEVO supplier search error:",
        error
      );

      renderError(
        values,
        error?.message ||
          "Unable to connect to the supplier discovery service.",
        requestId
      );

    } finally {
      setLoading(
        button,
        false
      );
    }
  }

  /* =========================================================
     ATTACH EVENT
     ========================================================= */

  function attachAnalyzeHandler() {
    const button =
      findAnalyzeButton();

    if (!button) {
      console.warn(
        "CASEVO: Analyze button not found."
      );

      return false;
    }

    if (
      button.dataset.casevoAttached ===
      "true"
    ) {
      return true;
    }

    button.dataset.casevoAttached =
      "true";

    button.addEventListener(
      "click",
      handleAnalyze
    );

    const form =
      button.closest("form");

    if (form) {
      form.addEventListener(
        "submit",
        handleAnalyze
      );
    }

    return true;
  }

  /* =========================================================
     ENTER KEY SUPPORT
     ========================================================= */

  function attachKeyboardSupport() {
    const textarea =
      findTextarea();

    if (!textarea) {
      return;
    }

    textarea.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Enter" &&
          (event.ctrlKey ||
            event.metaKey)
        ) {
          event.preventDefault();

          handleAnalyze(event);
        }
      }
    );
  }

  /* =========================================================
     AUTO-FILL DEMO REQUEST
     ========================================================= */

  function improveDemoFields() {
    const fields =
      getFormElements();

    /*
      We intentionally do NOT overwrite
      user-entered values.
    */

    if (
      fields.product &&
      !fields.product.value
    ) {
      fields.product.setAttribute(
        "autocomplete",
        "off"
      );
    }

    if (
      fields.quantity &&
      !fields.quantity.value
    ) {
      fields.quantity.setAttribute(
        "autocomplete",
        "off"
      );
    }

    if (
      fields.targetPrice &&
      !fields.targetPrice.value
    ) {
      fields.targetPrice.setAttribute(
        "autocomplete",
        "off"
      );
    }

    if (
      fields.destination &&
      !fields.destination.value
    ) {
      fields.destination.setAttribute(
        "autocomplete",
        "off"
      );
    }
  }

  /* =========================================================
     DEBUG INFO
     ========================================================= */

  function exposeDebugAPI() {
    window.CASEVO = {

      version:
        CASEVO.version,

      endpoint:
        API_ENDPOINT,

      getFields:
        getFormElements,

      analyze:
        handleAnalyze,

      generateRequestId:
        generateRequestId,

      getLastRequest() {
        try {
          return JSON.parse(
            localStorage.getItem(
              "casevo_last_request"
            ) || "null"
          );
        } catch {
          return null;
        }
      },

      getLastRequestId() {
        try {
          return localStorage.getItem(
            "casevo_last_request_id"
          );
        } catch {
          return null;
        }
      }
    };
  }

  /* =========================================================
     INITIALIZE
     ========================================================= */

  function initialize() {
    injectRuntimeCSS();

    exposeDebugAPI();

    improveDemoFields();

    attachAnalyzeHandler();

    attachKeyboardSupport();

    console.log(
      `CASEVO AI frontend ${CASEVO.version} initialized.`
    );

    console.log(
      `API endpoint: ${API_ENDPOINT}`
    );
  }

  /* =========================================================
     WAIT FOR DOM
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }

  /* =========================================================
     HANDLE DYNAMIC PAGE CONTENT
     ========================================================= */

  const observer =
    new MutationObserver(() => {
      attachAnalyzeHandler();
    });

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

})();
