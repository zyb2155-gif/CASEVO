/* =========================================================
   CASEVO AI
   China Sourcing Intelligence
   Front-end sourcing engine
   Final Production Version
   ========================================================= */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     CONFIGURATION
     --------------------------------------------------------- */

  const API_ENDPOINT = "/api/sourcing";

  const DEFAULT_REQUEST =
    "Premium full-grain leather shoe upper for men's sneakers, 1.4mm, black, 5,000 pairs, shipping to the United States.";

  const REQUEST_TIMEOUT = 30000;


  /* ---------------------------------------------------------
     DOM HELPERS
     --------------------------------------------------------- */

  function qs(selectors) {
    if (!Array.isArray(selectors)) {
      selectors = [selectors];
    }

    for (const selector of selectors) {
      const element = document.querySelector(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function qsa(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function text(value) {
    return value == null ? "" : String(value).trim();
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  /* ---------------------------------------------------------
     FIND FORM ELEMENTS
     --------------------------------------------------------- */

  const descriptionField = qs([
    "#sourcing-request",
    "#request",
    "#description",
    "#requirements",
    'textarea[name="request"]',
    'textarea[name="description"]',
    'textarea[name="requirements"]',
    "textarea"
  ]);

  const materialField = qs([
    "#product-material",
    "#material",
    "#product",
    'input[name="product"]',
    'input[name="material"]',
    'input[name="product_material"]'
  ]);

  const quantityField = qs([
    "#quantity",
    'input[name="quantity"]'
  ]);

  const targetPriceField = qs([
    "#target-price",
    "#price",
    'input[name="target_price"]',
    'input[name="price"]'
  ]);

  const destinationField = qs([
    "#destination",
    "#shipping-destination",
    "#ship-to",
    'input[name="destination"]',
    'input[name="shipping_destination"]'
  ]);

  const submitButton = qs([
    "#analyze-button",
    "#analyze",
    "#find-matches",
    "#submit-sourcing",
    'button[type="submit"]',
    'input[type="submit"]'
  ]);


  /* ---------------------------------------------------------
     FIND RESULT CONTAINERS
     --------------------------------------------------------- */

  let resultContainer = qs([
    "#sourcing-result",
    "#results",
    "#analysis-result",
    "#supplier-results",
    ".sourcing-result"
  ]);

  let errorContainer = qs([
    "#sourcing-error",
    "#error-result",
    "#analysis-error",
    ".sourcing-error"
  ]);


  /* ---------------------------------------------------------
     CREATE RESULT CONTAINER IF NECESSARY
     --------------------------------------------------------- */

  function ensureResultContainer() {
    if (resultContainer) {
      return resultContainer;
    }

    const anchor =
      qs([
        "#sourcing-form",
        "#ai-sourcing",
        ".sourcing-form",
        "form"
      ]) || descriptionField;

    if (!anchor) {
      return null;
    }

    resultContainer = document.createElement("div");

    resultContainer.id = "sourcing-result";

    resultContainer.style.marginTop = "32px";

    anchor.parentNode.insertBefore(
      resultContainer,
      anchor.nextSibling
    );

    return resultContainer;
  }


  function ensureErrorContainer() {
    if (errorContainer) {
      return errorContainer;
    }

    const anchor =
      resultContainer ||
      qs([
        "#sourcing-form",
        "#ai-sourcing",
        ".sourcing-form",
        "form"
      ]) ||
      descriptionField;

    if (!anchor) {
      return null;
    }

    errorContainer = document.createElement("div");

    errorContainer.id = "sourcing-error";

    errorContainer.style.marginTop = "24px";

    anchor.parentNode.insertBefore(
      errorContainer,
      anchor.nextSibling
    );

    return errorContainer;
  }


  /* ---------------------------------------------------------
     REQUEST ID
     --------------------------------------------------------- */

  function generateRequestId() {
    const now = new Date();

    const datePart =
      now.getTime().toString(36).toUpperCase();

    const randomPart =
      Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

    return `CASEVO-${datePart}-${randomPart}`;
  }


  /* ---------------------------------------------------------
     NORMALIZE TEXT
     --------------------------------------------------------- */

  function normalizeSpaces(value) {
    return text(value)
      .replace(/\s+/g, " ")
      .trim();
  }


  /* ---------------------------------------------------------
     PARSE PRODUCT / MATERIAL
     --------------------------------------------------------- */

  function parseMaterial(description) {
    const value = normalizeSpaces(description);

    if (!value) {
      return "";
    }

    const patterns = [
      /(?:premium\s+)?full[-\s]?grain\s+leather\s+shoe\s+upper/i,
      /full[-\s]?grain\s+leather\s+shoe\s+upper/i,
      /leather\s+shoe\s+upper/i,
      /shoe\s+upper/i,
      /upper\s+leather/i,
      /leather/i,
      /rubber/i,
      /fabric/i
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);

      if (match) {
        return normalizeSpaces(match[0]);
      }
    }

    /*
      If no known material was detected,
      use the first meaningful phrase before
      a specification such as thickness, color,
      quantity or destination.
    */

    let fallback = value
      .split(/[,;|]/)[0]
      .replace(
        /\b\d+(?:\.\d+)?\s*mm\b/gi,
        ""
      )
      .trim();

    fallback = fallback
      .replace(
        /\b\d[\d,]*\s*(?:pairs?|pcs?|pieces?|units?)\b/gi,
        ""
      )
      .trim();

    return normalizeSpaces(fallback);
  }


  /* ---------------------------------------------------------
     PARSE QUANTITY
     --------------------------------------------------------- */

  function parseQuantity(description) {
    const value = normalizeSpaces(description);

    if (!value) {
      return "";
    }

    const patterns = [
      /(\d[\d,]*)\s*(pairs?)/i,
      /(\d[\d,]*)\s*(pcs?)/i,
      /(\d[\d,]*)\s*(pieces?)/i,
      /quantity\s*[:=]?\s*(\d[\d,]*)/i,
      /(\d[\d,]*)\s*units?/i
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);

      if (!match) {
        continue;
      }

      if (match[2]) {
        return `${match[1]} ${match[2]}`;
      }

      return match[1];
    }

    return "";
  }


  /* ---------------------------------------------------------
     PARSE TARGET PRICE
     --------------------------------------------------------- */

  function parseTargetPrice(description) {
    const value = normalizeSpaces(description);

    if (!value) {
      return "";
    }

    const patterns = [
      /(?:target\s+price|price|budget)\s*[:=]?\s*([^\s,;]+)/i,
      /(\$\s?\d+(?:\.\d+)?(?:\s*\/\s*\w+)?)/i,
      /(\d+(?:\.\d+)?\s*(?:usd|dollars?))/i
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);

      if (match) {
        return normalizeSpaces(match[1]);
      }
    }

    return "";
  }


  /* ---------------------------------------------------------
     PARSE DESTINATION
     --------------------------------------------------------- */

  function parseDestination(description) {
    const value = normalizeSpaces(description);

    if (!value) {
      return "";
    }

    const patterns = [
      /shipping\s+to\s+(?:the\s+)?([A-Za-z][A-Za-z .'-]+?)(?:\.|,|$)/i,
      /ship(?:ping)?\s+(?:to|for)\s+(?:the\s+)?([A-Za-z][A-Za-z .'-]+?)(?:\.|,|$)/i,
      /deliver(?:y|ing)?\s+(?:to|for)\s+(?:the\s+)?([A-Za-z][A-Za-z .'-]+?)(?:\.|,|$)/i,
      /destination\s*[:=]\s*([A-Za-z][A-Za-z .'-]+)/i,
      /to\s+(?:the\s+)?(United States|USA|US|United Kingdom|UK|Germany|France|Italy|Spain|Canada|Australia|Japan|South Korea|India|Mexico|Brazil|Netherlands|Belgium|Vietnam|Thailand|Singapore)/i
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);

      if (!match) {
        continue;
      }

      let destination = normalizeSpaces(match[1]);

      destination = destination
        .replace(/[.,]+$/, "")
        .trim();

      if (!destination) {
        continue;
      }

      const normalized = destination.toLowerCase();

      if (
        normalized === "usa" ||
        normalized === "us"
      ) {
        return "United States";
      }

      if (
        normalized === "uk"
      ) {
        return "United Kingdom";
      }

      return destination;
    }

    return "";
  }


  /* ---------------------------------------------------------
     AUTO-FILL STRUCTURED FIELDS
     --------------------------------------------------------- */

  function populateStructuredFields() {
    if (!descriptionField) {
      return;
    }

    const description =
      normalizeSpaces(descriptionField.value);

    if (!description) {
      return;
    }

    /*
      Only populate empty fields.
      This means user-entered values
      always take priority.
    */

    if (
      materialField &&
      !text(materialField.value)
    ) {
      const material = parseMaterial(description);

      if (material) {
        materialField.value = material;
      }
    }

    if (
      quantityField &&
      !text(quantityField.value)
    ) {
      const quantity = parseQuantity(description);

      if (quantity) {
        quantityField.value = quantity;
      }
    }

    if (
      targetPriceField &&
      !text(targetPriceField.value)
    ) {
      const price = parseTargetPrice(description);

      if (price) {
        targetPriceField.value = price;
      }
    }

    if (
      destinationField &&
      !text(destinationField.value)
    ) {
      const destination =
        parseDestination(description);

      if (destination) {
        destinationField.value = destination;
      }
    }
  }


  /* ---------------------------------------------------------
     BUILD SOURCING REQUEST
     --------------------------------------------------------- */

  function buildSourcingRequest() {
    const description =
      normalizeSpaces(
        descriptionField
          ? descriptionField.value
          : ""
      );

    let material =
      materialField
        ? normalizeSpaces(materialField.value)
        : "";

    let quantity =
      quantityField
        ? normalizeSpaces(quantityField.value)
        : "";

    let targetPrice =
      targetPriceField
        ? normalizeSpaces(targetPriceField.value)
        : "";

    let destination =
      destinationField
        ? normalizeSpaces(destinationField.value)
        : "";

    /*
      CRITICAL FIX:
      Parse missing structured fields
      directly from the main request.
    */

    if (description) {
      if (!material) {
        material = parseMaterial(description);
      }

      if (!quantity) {
        quantity = parseQuantity(description);
      }

      if (!targetPrice) {
        targetPrice = parseTargetPrice(description);
      }

      if (!destination) {
        destination =
          parseDestination(description);
      }
    }

    /*
      Normalize common destination values.
    */

    if (
      /^(usa|us|u\.s\.a\.?|u\.s\.?)$/i.test(
        destination
      )
    ) {
      destination = "United States";
    }

    if (
      /^uk$/i.test(destination)
    ) {
      destination = "United Kingdom";
    }

    return {
      request: description,
      description,
      product: material,
      material,
      quantity,
      target_price: targetPrice,
      targetPrice,
      destination
    };
  }


  /* ---------------------------------------------------------
     VALIDATE REQUEST
     --------------------------------------------------------- */

  function validateRequest(data) {
    const errors = [];

    if (!data.request) {
      errors.push(
        "Please describe what you want to source."
      );
    }

    /*
      Destination is mandatory because the
      supplier search needs a target market.

      However, it can be automatically extracted
      from the main request.
    */

    if (!data.destination) {
      errors.push(
        "Please enter a destination or include shipping information in your sourcing request."
      );
    }

    return errors;
  }


  /* ---------------------------------------------------------
     UI STATE
     --------------------------------------------------------- */

  function setLoading(isLoading) {
    if (!submitButton) {
      return;
    }

    if (isLoading) {
      submitButton.disabled = true;

      submitButton.dataset.originalText =
        submitButton.textContent;

      submitButton.textContent =
        "Analyzing & Searching...";

      submitButton.style.opacity = "0.65";
      submitButton.style.cursor = "wait";
    } else {
      submitButton.disabled = false;

      const original =
        submitButton.dataset.originalText;

      if (original) {
        submitButton.textContent = original;
      }

      submitButton.style.opacity = "";
      submitButton.style.cursor = "";
    }
  }


  /* ---------------------------------------------------------
     SHOW ERROR
     --------------------------------------------------------- */

  function showError(message, requestId) {
    const container =
      ensureErrorContainer();

    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="casevo-error-panel"
           style="
             border:1px solid #c83227;
             padding:24px;
             background:#fbf7ef;
           ">

        <div style="
          font-size:10px;
          letter-spacing:.18em;
          text-transform:uppercase;
          color:#b52c23;
          margin-bottom:12px;
        ">
          CASEVO AI / ERROR
        </div>

        <h3 style="
          margin:0 0 10px;
          font-size:22px;
        ">
          Supplier discovery could not be completed.
        </h3>

        <p style="
          margin:0 0 12px;
          line-height:1.6;
        ">
          ${escapeHtml(message)}
        </p>

        ${
          requestId
            ? `
              <div style="
                font-size:11px;
                opacity:.65;
              ">
                Request ID: ${escapeHtml(requestId)}
              </div>
            `
            : ""
        }

      </div>
    `;

    container.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }


  /* ---------------------------------------------------------
     CLEAR ERROR
     --------------------------------------------------------- */

  function clearError() {
    if (errorContainer) {
      errorContainer.innerHTML = "";
    }
  }


  /* ---------------------------------------------------------
     SHOW LOADING RESULT
     --------------------------------------------------------- */

  function showLoadingResult() {
    const container =
      ensureResultContainer();

    if (!container) {
      return;
    }

    container.innerHTML = `
      <div
        style="
          border:1px solid #d7cec0;
          padding:28px;
          background:#fbf7ef;
        "
      >

        <div style="
          font-size:10px;
          letter-spacing:.18em;
          text-transform:uppercase;
          margin-bottom:14px;
          color:#b52c23;
        ">
          CASEVO AI / SOURCING ANALYSIS
        </div>

        <h2 style="
          margin:0 0 12px;
          font-family:Georgia,serif;
          font-size:30px;
        ">
          Searching for real suppliers.
        </h2>

        <p style="
          margin:0;
          line-height:1.7;
          opacity:.72;
        ">
          CASEVO is analyzing the sourcing requirement
          and searching public supplier information.
        </p>

      </div>
    `;
  }


  /* ---------------------------------------------------------
     FETCH WITH TIMEOUT
     --------------------------------------------------------- */

  async function fetchWithTimeout(
    url,
    options = {},
    timeout = REQUEST_TIMEOUT
  ) {
    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () => controller.abort(),
        timeout
      );

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }


  /* ---------------------------------------------------------
     API REQUEST
     --------------------------------------------------------- */

  async function callSourcingAPI(payload) {
    const response =
      await fetchWithTimeout(
        API_ENDPOINT,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            "Accept":
              "application/json"
          },

          body: JSON.stringify(payload)
        }
      );

    let body = null;

    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const message =
        body &&
        (
          body.error ||
          body.message ||
          body.detail
        );

      throw new Error(
        message ||
        `Supplier search failed (${response.status}).`
      );
    }

    if (!body) {
      throw new Error(
        "The supplier search returned an invalid response."
      );
    }

    return body;
  }


  /* ---------------------------------------------------------
     EXTRACT SUPPLIERS
     --------------------------------------------------------- */

  function extractSuppliers(data) {
    if (!data) {
      return [];
    }

    const candidates = [
      data.suppliers,
      data.matches,
      data.results,
      data.supplierMatches,
      data.supplier_matches,
      data.data &&
        data.data.suppliers,
      data.data &&
        data.data.matches,
      data.data &&
        data.data.results
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }

    return [];
  }


  /* ---------------------------------------------------------
     EXTRACT SCORE
     --------------------------------------------------------- */

  function extractScore(data) {
    if (!data) {
      return null;
    }

    const values = [
      data.score,
      data.casevoScore,
      data.casevo_score,
      data.data &&
        data.data.score,
      data.data &&
        data.data.casevoScore,
      data.data &&
        data.data.casevo_score
    ];

    for (const value of values) {
      if (
        value !== null &&
        value !== undefined &&
        value !== ""
      ) {
        const number =
          Number(
            String(value)
              .replace(/[^\d.]/g, "")
          );

        if (
          Number.isFinite(number)
        ) {
          return Math.max(
            0,
            Math.min(100, number)
          );
        }
      }
    }

    return null;
  }


  /* ---------------------------------------------------------
     EXTRACT REQUEST ID
     --------------------------------------------------------- */

  function extractRequestId(data, fallback) {
    if (!data) {
      return fallback;
    }

    return (
      data.requestId ||
      data.request_id ||
      data.id ||
      (data.data &&
        (
          data.data.requestId ||
          data.data.request_id ||
          data.data.id
        )) ||
      fallback
    );
  }


  /* ---------------------------------------------------------
     SUPPLIER NAME
     --------------------------------------------------------- */

  function supplierName(supplier) {
    if (!supplier) {
      return "Supplier";
    }

    return (
      supplier.name ||
      supplier.company ||
      supplier.companyName ||
      supplier.company_name ||
      "Supplier"
    );
  }


  /* ---------------------------------------------------------
     SUPPLIER DESCRIPTION
     --------------------------------------------------------- */

  function supplierDescription(supplier) {
    if (!supplier) {
      return "";
    }

    return (
      supplier.description ||
      supplier.summary ||
      supplier.capability ||
      supplier.capabilities ||
      ""
    );
  }


  /* ---------------------------------------------------------
     SUPPLIER URL
     --------------------------------------------------------- */

  function supplierUrl(supplier) {
    if (!supplier) {
      return "";
    }

    return (
      supplier.website ||
      supplier.url ||
      supplier.source ||
      ""
    );
  }


  /* ---------------------------------------------------------
     SUPPLIER LOCATION
     --------------------------------------------------------- */

  function supplierLocation(supplier) {
    if (!supplier) {
      return "";
    }

    return (
      supplier.location ||
      supplier.city ||
      supplier.address ||
      supplier.region ||
      ""
    );
  }


  /* ---------------------------------------------------------
     RENDER SUPPLIER
     --------------------------------------------------------- */

  function renderSupplier(supplier, index) {
    const name =
      supplierName(supplier);

    const description =
      supplierDescription(supplier);

    const location =
      supplierLocation(supplier);

    const url =
      supplierUrl(supplier);

    const score =
      supplier.score ||
      supplier.matchScore ||
      supplier.match_score ||
      null;

    const safeUrl =
      /^https?:\/\//i.test(url)
        ? url
        : "";

    return `
      <article
        class="casevo-supplier-card"
        style="
          border-top:1px solid #d7cec0;
          padding:24px 0;
        "
      >

        <div style="
          display:flex;
          justify-content:space-between;
          gap:20px;
          align-items:flex-start;
        ">

          <div>

            <div style="
              font-size:10px;
              letter-spacing:.15em;
              text-transform:uppercase;
              color:#b52c23;
              margin-bottom:8px;
            ">
              Supplier ${index + 1}
            </div>

            <h3 style="
              margin:0 0 8px;
              font-family:Georgia,serif;
              font-size:25px;
            ">
              ${escapeHtml(name)}
            </h3>

            ${
              location
                ? `
                  <div style="
                    font-size:13px;
                    margin-bottom:10px;
                    opacity:.7;
                  ">
                    ${escapeHtml(location)}
                  </div>
                `
                : ""
            }

          </div>

          ${
            score !== null &&
            score !== undefined
              ? `
                <div style="
                  min-width:80px;
                  text-align:right;
                ">
                  <div style="
                    font-size:10px;
                    letter-spacing:.12em;
                    text-transform:uppercase;
                    opacity:.55;
                  ">
                    Match
                  </div>

                  <strong style="
                    font-size:20px;
                  ">
                    ${escapeHtml(score)}%
                  </strong>
                </div>
              `
              : ""
          }

        </div>

        ${
          description
            ? `
              <p style="
                margin:12px 0;
                line-height:1.65;
                font-size:14px;
              ">
                ${escapeHtml(description)}
              </p>
            `
            : ""
        }

        ${
          safeUrl
            ? `
              <a
                href="${escapeHtml(safeUrl)}"
                target="_blank"
                rel="noopener noreferrer"
                style="
                  display:inline-block;
                  margin-top:8px;
                  color:#b52c23;
                  text-decoration:none;
                  font-size:13px;
                "
              >
                View public supplier source →
              </a>
            `
            : ""
        }

      </article>
    `;
  }


  /* ---------------------------------------------------------
     RENDER NO MATCHES
     --------------------------------------------------------- */

  function renderNoMatches(data, request) {
    const container =
      ensureResultContainer();

    if (!container) {
      return;
    }

    const requestId =
      extractRequestId(
        data,
        generateRequestId()
      );

    container.innerHTML = `
      <section
        style="
          border:1px solid #d7cec0;
          padding:28px;
          background:#fbf7ef;
        "
      >

        <div style="
          font-size:10px;
          letter-spacing:.18em;
          text-transform:uppercase;
          color:#b52c23;
          margin-bottom:12px;
        ">
          CASEVO AI / SOURCING ANALYSIS
        </div>

        <h2 style="
          margin:0 0 10px;
          font-family:Georgia,serif;
          font-size:30px;
        ">
          Real supplier discovery completed.
        </h2>

        <p style="
          margin:0 0 26px;
          line-height:1.6;
          opacity:.7;
        ">
          CASEVO completed the public-web supplier
          discovery process successfully.
        </p>


        <div style="
          border:1px solid #d7cec0;
          padding:20px;
          margin-bottom:24px;
        ">

          <div style="
            font-size:10px;
            letter-spacing:.14em;
            text-transform:uppercase;
            color:#b52c23;
            margin-bottom:14px;
          ">
            Sourcing requirement
          </div>

          <div style="
            line-height:1.7;
          ">
            ${escapeHtml(
              request.material ||
              "Sourcing Requirement"
            )}
          </div>

        </div>


        <div style="
          border-top:1px solid #d7cec0;
          padding-top:22px;
        ">

          <div style="
            font-size:10px;
            letter-spacing:.15em;
            text-transform:uppercase;
            color:#b52c23;
            margin-bottom:10px;
          ">
            Real supplier matches
          </div>

          <h3 style="
            margin:0 0 16px;
            font-family:Georgia,serif;
            font-size:25px;
          ">
            No verified supplier matches were returned.
          </h3>

          <div style="
            border:1px solid #d7cec0;
            padding:20px;
            line-height:1.65;
            font-size:14px;
          ">

            <strong>
              No verified supplier records were returned.
            </strong>

            <p style="margin:12px 0;">
              CASEVO completed the public-web sourcing
              analysis, but no supplier identity was
              returned for this request.
            </p>

            <p style="margin:0;">
              Supplier identities, manufacturing capability,
              certifications and commercial contacts should
              be independently verified before placing an order.
            </p>

          </div>

        </div>


        <div style="
          margin-top:24px;
          padding-top:20px;
          border-top:1px solid #d7cec0;
          font-size:11px;
          line-height:1.6;
          opacity:.7;
        ">

          Verification notice: CASEVO public-web supplier
          discovery identifies potential supplier capabilities
          from public information. Company identity,
          manufacturing capability, certifications, pricing,
          MOQ, production capacity and contact information
          should be independently verified before placing an order.

        </div>


        <div style="
          margin-top:14px;
          font-size:10px;
          opacity:.55;
        ">
          Request ID: ${escapeHtml(requestId)}
        </div>

      </section>
    `;

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }


  /* ---------------------------------------------------------
     RENDER RESULTS
     --------------------------------------------------------- */

  function renderResults(data, request) {
    const container =
      ensureResultContainer();

    if (!container) {
      return;
    }

    const suppliers =
      extractSuppliers(data);

    const score =
      extractScore(data);

    const requestId =
      extractRequestId(
        data,
        generateRequestId()
      );

    if (!suppliers.length) {
      renderNoMatches(
        {
          ...data,
          requestId
        },
        request
      );

      return;
    }

    container.innerHTML = `
      <section
        style="
          border:1px solid #d7cec0;
          padding:28px;
          background:#fbf7ef;
        "
      >

        <div style="
          font-size:10px;
          letter-spacing:.18em;
          text-transform:uppercase;
          color:#b52c23;
          margin-bottom:12px;
        ">
          CASEVO AI / SOURCING ANALYSIS
        </div>

        <h2 style="
          margin:0 0 10px;
          font-family:Georgia,serif;
          font-size:30px;
        ">
          Real supplier discovery completed.
        </h2>

        <p style="
          margin:0 0 24px;
          line-height:1.6;
          opacity:.7;
        ">
          CASEVO supplier discovery completed successfully.
        </p>


        ${
          score !== null
            ? `
              <div style="
                border:1px solid #d7cec0;
                display:inline-block;
                padding:16px 22px;
                margin-bottom:26px;
              ">

                <div style="
                  font-size:9px;
                  letter-spacing:.15em;
                  text-transform:uppercase;
                  opacity:.6;
                  margin-bottom:6px;
                ">
                  CASEVO Score
                </div>

                <strong style="
                  font-size:24px;
                ">
                  ${escapeHtml(score)}
                </strong>

                <span style="
                  font-size:12px;
                  opacity:.6;
                ">
                  /100
                </span>

              </div>
            `
            : ""
        }


        <div style="
          border-top:1px solid #d7cec0;
          padding-top:22px;
        ">

          <div style="
            font-size:10px;
            letter-spacing:.15em;
            text-transform:uppercase;
            color:#b52c23;
            margin-bottom:10px;
          ">
            Real supplier matches
          </div>

          <h3 style="
            margin:0 0 18px;
            font-family:Georgia,serif;
            font-size:26px;
          ">
            ${suppliers.length}
            supplier${suppliers.length === 1 ? "" : "s"}
            found.
          </h3>

          <div>
            ${suppliers
              .map(renderSupplier)
              .join("")}
          </div>

        </div>


        <div style="
          margin-top:24px;
          padding-top:20px;
          border-top:1px solid #d7cec0;
          font-size:11px;
          line-height:1.6;
          opacity:.7;
        ">
          Verification notice: Public-web supplier matches
          are discovery results, not commercial verification.
          Company identity, manufacturing capability,
          certifications, pricing, MOQ, production capacity
          and contact information should be independently
          verified before placing an order.
        </div>


        <div style="
          margin-top:14px;
          font-size:10px;
          opacity:.55;
        ">
          Request ID: ${escapeHtml(requestId)}
        </div>

      </section>
    `;

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }


  /* ---------------------------------------------------------
     SUBMIT SOURCING
     --------------------------------------------------------- */

  async function submitSourcing(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    clearError();

    /*
      First extract missing fields from
      the main sourcing description.
    */

    populateStructuredFields();

    const request =
      buildSourcingRequest();

    const requestId =
      generateRequestId();

    const validationErrors =
      validateRequest(request);

    if (validationErrors.length) {
      showError(
        validationErrors.join(" "),
        requestId
      );

      return;
    }

    setLoading(true);

    showLoadingResult();

    /*
      This payload intentionally includes
      multiple compatible field names.

      That makes the front end compatible
      with the current CASEVO worker.
    */

    const payload = {
      requestId,

      request: request.request,

      description: request.description,

      product: request.product,

      material: request.material,

      quantity: request.quantity,

      target_price:
        request.target_price,

      targetPrice:
        request.targetPrice,

      destination:
        request.destination,

      shipping_destination:
        request.destination,

      shippingDestination:
        request.destination
    };


    try {
      const result =
        await callSourcingAPI(payload);

      renderResults(
        result,
        request
      );

    } catch (error) {
      console.error(
        "CASEVO sourcing error:",
        error
      );

      let message =
        error &&
        error.name === "AbortError"
          ? "The supplier search timed out. Please try again."
          : (
              error &&
              error.message
            ) ||
            "The supplier search could not be completed.";

      showError(
        message,
        requestId
      );

    } finally {
      setLoading(false);
    }
  }


  /* ---------------------------------------------------------
     INPUT AUTO-PARSING
     --------------------------------------------------------- */

  if (descriptionField) {
    descriptionField.addEventListener(
      "blur",
      () => {
        populateStructuredFields();
      }
    );

    descriptionField.addEventListener(
      "input",
      () => {
        /*
          Do not continuously overwrite fields.
          Only parse when structured fields are empty.
        */

        if (
          !materialField ||
          !text(materialField.value)
        ) {
          const material =
            parseMaterial(
              descriptionField.value
            );

          if (material && material.length < 120) {
            if (materialField) {
              materialField.value = material;
            }
          }
        }

        if (
          !quantityField ||
          !text(quantityField.value)
        ) {
          const quantity =
            parseQuantity(
              descriptionField.value
            );

          if (quantity && quantityField) {
            quantityField.value = quantity;
          }
        }

        if (
          !destinationField ||
          !text(destinationField.value)
        ) {
          const destination =
            parseDestination(
              descriptionField.value
            );

          if (
            destination &&
            destinationField
          ) {
            destinationField.value =
              destination;
          }
        }
      }
    );
  }


  /* ---------------------------------------------------------
     FORM HANDLING
     --------------------------------------------------------- */

  const form =
    qs([
      "#sourcing-form",
      "#ai-sourcing-form",
      "form"
    ]);

  if (form) {
    form.addEventListener(
      "submit",
      submitSourcing
    );
  }


  if (submitButton) {
    submitButton.addEventListener(
      "click",
      submitSourcing
    );
  }


  /* ---------------------------------------------------------
     INITIAL DEFAULT DATA
     --------------------------------------------------------- */

  function initializeDefaults() {
    /*
      Do not force defaults into the user's form.
      Only use the demo request when the textarea
      is already present and completely empty.
    */

    if (
      descriptionField &&
      !text(descriptionField.value)
    ) {
      /*
        Keep production site clean:
        no automatic demo request.
      */

      return;
    }

    populateStructuredFields();
  }


  /* ---------------------------------------------------------
     HANDLE PAGE LOAD
     --------------------------------------------------------- */

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initializeDefaults
    );
  } else {
    initializeDefaults();
  }


  /* ---------------------------------------------------------
     PUBLIC DEBUG API
     --------------------------------------------------------- */

  window.CASEVO = {
    version: "3.0.0-final",

    parseMaterial,

    parseQuantity,

    parseTargetPrice,

    parseDestination,

    buildSourcingRequest,

    submitSourcing
  };

})();
