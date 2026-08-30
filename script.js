/* ============================================================
   CASEVO AI SOURCING — FRONTEND v3.0
   Real Supplier Discovery Frontend
   ============================================================

   Frontend responsibilities:
   1. Collect sourcing requirements
   2. Send request to /api/sourcing
   3. Read CASEVO Worker v3 response
   4. Display real public-web supplier matches
   5. Never expose Tavily API key in browser

   API:
   POST /api/sourcing
   GET  /api/health

   Compatible response structures:
   - data.matches
   - data.analysis.matches
   ============================================================ */

(function () {
  "use strict";

  const API_ENDPOINT = "/api/sourcing";

  console.log("CASEVO AI Sourcing frontend v3.0 loaded.");
  console.log("CASEVO API:", API_ENDPOINT);

  /* ============================================================
     BASIC HELPERS
     ============================================================ */

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from(
      (root || document).querySelectorAll(selector)
    );
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clean(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function firstExisting(selectors, root) {
    for (const selector of selectors) {
      const element = qs(selector, root || document);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function findByLabel(text) {
    const labels = qsa("label");

    const target = labels.find(function (label) {
      return clean(label.textContent)
        .toLowerCase()
        .includes(String(text).toLowerCase());
    });

    if (!target) {
      return null;
    }

    const forId = target.getAttribute("for");

    if (forId) {
      return document.getElementById(forId);
    }

    if (target.parentElement) {
      return target.parentElement.querySelector(
        "input, textarea, select"
      );
    }

    return null;
  }

  function getField(selectors, labelText, root) {
    return (
      firstExisting(selectors, root) ||
      findByLabel(labelText)
    );
  }

  function safeUrl(url) {
    const value = clean(url);

    if (!value) {
      return "";
    }

    try {
      const parsed = new URL(value);

      if (
        parsed.protocol === "http:" ||
        parsed.protocol === "https:"
      ) {
        return parsed.href;
      }
    } catch (error) {
      return "";
    }

    return "";
  }

  function formatScore(value) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    const number = Number(value);

    if (!Number.isNaN(number)) {
      return Math.round(number);
    }

    return escapeHtml(value);
  }

  function normalizeScore(match) {
    if (!match || typeof match !== "object") {
      return null;
    }

    const possible = [
      match.matchScore,
      match.match_score,
      match.score,
      match.relevance,
      match.similarity
    ];

    for (const value of possible) {
      if (
        value !== null &&
        value !== undefined &&
        value !== ""
      ) {
        const number = Number(value);

        if (!Number.isNaN(number)) {
          if (number >= 0 && number <= 1) {
            return Math.round(number * 100);
          }

          return Math.round(number);
        }
      }
    }

    return null;
  }

  /* ============================================================
     FIND FORM
     ============================================================ */

  function findSourcingForm() {
    const preferred = firstExisting([
      "#sourcing-form",
      "#sourcingForm",
      "#ai-sourcing-form",
      "#aiSourcingForm",
      "form[data-sourcing-form]"
    ]);

    if (preferred) {
      return preferred;
    }

    const forms = qsa("form");

    if (!forms.length) {
      return null;
    }

    const sourcingForm = forms.find(function (form) {
      const text = clean(
        form.innerText ||
        form.textContent ||
        ""
      ).toLowerCase();

      return (
        text.includes("sourcing") ||
        text.includes("product") ||
        text.includes("quantity") ||
        text.includes("destination")
      );
    });

    return sourcingForm || forms[0];
  }

  const form = findSourcingForm();

  if (!form) {
    console.warn(
      "CASEVO: sourcing form was not found."
    );

    return;
  }

  /* ============================================================
     FIND FORM FIELDS
     ============================================================ */

  const requirementField = getField(
    [
      "#requirement",
      "#requirements",
      "#sourcing-requirement",
      "#sourcingRequirement",
      "#brief",
      "#sourcingBrief",
      "textarea[name='requirement']",
      "textarea[name='requirements']",
      "textarea[name='request']",
      "textarea[name='brief']",
      "textarea"
    ],
    "what are you sourcing",
    form
  );

  const productField = getField(
    [
      "#product",
      "#product-material",
      "#productMaterial",
      "input[name='product']",
      "input[name='material']",
      "input[name='product_material']"
    ],
    "product / material",
    form
  );

  const quantityField = getField(
    [
      "#quantity",
      "input[name='quantity']"
    ],
    "quantity",
    form
  );

  const priceField = getField(
    [
      "#target-price",
      "#targetPrice",
      "#price",
      "input[name='targetPrice']",
      "input[name='target_price']",
      "input[name='price']"
    ],
    "target price",
    form
  );

  const destinationField = getField(
    [
      "#destination",
      "input[name='destination']",
      "select[name='destination']"
    ],
    "destination",
    form
  );

  /* ============================================================
     FIND SUBMIT BUTTON
     ============================================================ */

  let submitButton = firstExisting(
    [
      "#analyze-button",
      "#analyzeButton",
      "#find-matches",
      "#findMatches",
      "button[type='submit']"
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

  /* ============================================================
     CREATE RESULT CONTAINER
     ============================================================ */

  let resultContainer = qs("#casevo-results");

  if (!resultContainer) {
    resultContainer = document.createElement("div");

    resultContainer.id = "casevo-results";

    resultContainer.style.cssText = `
      margin-top: 32px;
      width: 100%;
      box-sizing: border-box;
    `;

    form.insertAdjacentElement(
      "afterend",
      resultContainer
    );
  }

  /* ============================================================
     LOADING
     ============================================================ */

  function setLoading(loading) {
    if (!submitButton) {
      return;
    }

    if (loading) {
      submitButton.dataset.originalText =
        submitButton.textContent ||
        "Analyze & Find Matches";

      submitButton.disabled = true;
      submitButton.style.opacity = "0.65";
      submitButton.style.cursor = "wait";

      submitButton.textContent =
        "Searching real suppliers...";
    } else {
      submitButton.disabled = false;
      submitButton.style.opacity = "";
      submitButton.style.cursor = "";

      submitButton.textContent =
        submitButton.dataset.originalText ||
        "Analyze & Find Matches";
    }
  }

  /* ============================================================
     ERROR
     ============================================================ */

  function renderError(message) {
    resultContainer.innerHTML = `
      <div style="
        border:1px solid #e3c9c2;
        background:#fff8f6;
        padding:28px;
        box-sizing:border-box;
        color:#8f2f24;
        font-family:Arial,sans-serif;
      ">

        <div style="
          font-size:11px;
          letter-spacing:2px;
          text-transform:uppercase;
          margin-bottom:12px;
        ">
          CASEVO / SEARCH ERROR
        </div>

        <div style="
          font-size:20px;
          line-height:1.5;
          font-family:Georgia,serif;
        ">
          ${escapeHtml(message)}
        </div>

        <div style="
          margin-top:14px;
          font-size:13px;
          color:#6f625a;
          line-height:1.6;
        ">
          Please try the sourcing request again.
          If the problem continues, check the CASEVO Worker logs.
        </div>

      </div>
    `;

    resultContainer.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  /* ============================================================
     LOADING RESULT
     ============================================================ */

  function renderSearching() {
    resultContainer.innerHTML = `
      <div style="
        background:#f7f1e6;
        border:1px solid #ded3c2;
        padding:32px;
        box-sizing:border-box;
        font-family:Arial,sans-serif;
        color:#1d1b18;
      ">

        <div style="
          color:#b42f24;
          font-size:11px;
          letter-spacing:2px;
          text-transform:uppercase;
          margin-bottom:12px;
        ">
          CASEVO AI / REAL SUPPLIER DISCOVERY
        </div>

        <div style="
          font-family:Georgia,serif;
          font-size:30px;
          line-height:1.2;
          margin-bottom:14px;
        ">
          Searching the public web...
        </div>

        <div style="
          color:#665f57;
          font-size:14px;
          line-height:1.7;
        ">
          CASEVO is analyzing your sourcing requirement
          and searching for relevant supplier companies.
        </div>

        <div style="
          margin-top:22px;
          height:4px;
          width:100%;
          background:#e4d9cb;
          overflow:hidden;
        ">
          <div style="
            width:55%;
            height:100%;
            background:#b42f24;
            animation:casevoLoading 1.4s infinite ease-in-out;
          "></div>
        </div>

        <style>
          @keyframes casevoLoading {
            0% {
              transform:translateX(-100%);
            }
            100% {
              transform:translateX(200%);
            }
          }
        </style>

      </div>
    `;

    resultContainer.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  /* ============================================================
     NORMALIZE WORKER RESPONSE
     ============================================================ */

  function getResponseData(data) {
    const response = data || {};

    const analysisObject =
      response.analysis &&
      typeof response.analysis === "object"
        ? response.analysis
        : {};

    const normalized =
      analysisObject.normalized ||
      response.normalized ||
      {};

    const scoring =
      analysisObject.scoring ||
      response.scoring ||
      {};

    let matches = [];

    if (Array.isArray(response.matches)) {
      matches = response.matches;
    } else if (
      Array.isArray(analysisObject.matches)
    ) {
      matches = analysisObject.matches;
    } else if (
      Array.isArray(response.suppliers)
    ) {
      matches = response.suppliers;
    } else if (
      Array.isArray(response.results)
    ) {
      matches = response.results;
    }

    const brief =
      response.brief &&
      typeof response.brief === "object"
        ? response.brief
        : {};

    const meta =
      response.meta &&
      typeof response.meta === "object"
        ? response.meta
        : {};

    return {
      response,
      analysisObject,
      normalized,
      scoring,
      matches,
      brief,
      meta
    };
  }

  /* ============================================================
     SUPPLIER MATCH CARD
     ============================================================ */

  function renderSupplierCard(match, index) {
    const supplier =
      match && typeof match === "object"
        ? match
        : {};

    const name =
      clean(
        supplier.name ||
        supplier.company ||
        supplier.title ||
        supplier.supplierName
      ) ||
      `Supplier ${index + 1}`;

    const location =
      clean(
        supplier.location ||
        supplier.address ||
        supplier.country ||
        supplier.city
      ) ||
      "Location not specified";

    const website =
      safeUrl(
        supplier.website ||
        supplier.url ||
        supplier.link ||
        supplier.sourceUrl
      );

    const score = normalizeScore(supplier);

    const supplierType =
      clean(
        supplier.supplierType ||
        supplier.supplier_type ||
        supplier.type ||
        supplier.category
      );

    const capability =
      clean(
        supplier.capability ||
        supplier.capabilities ||
        supplier.description ||
        supplier.note ||
        supplier.content ||
        supplier.snippet
      );

    const evidence =
      clean(
        supplier.evidence ||
        supplier.source ||
        supplier.sourceTitle ||
        supplier.title
      );

    const domain =
      clean(
        supplier.domain ||
        (
          website
            ? new URL(website).hostname
            : ""
        )
      );

    return `
      <div style="
        background:#fffaf3;
        border:1px solid #d9cebf;
        padding:24px;
        margin-bottom:14px;
        box-sizing:border-box;
      ">

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:20px;
          flex-wrap:wrap;
        ">

          <div style="
            min-width:0;
            flex:1;
          ">

            <div style="
              font-family:Georgia,serif;
              font-size:23px;
              line-height:1.25;
              color:#181715;
            ">
              ${escapeHtml(name)}
            </div>

            <div style="
              margin-top:7px;
              color:#70685f;
              font-size:13px;
            ">
              ${escapeHtml(location)}
            </div>

          </div>

          <div style="
            min-width:82px;
            text-align:right;
          ">

            <div style="
              color:#b42f24;
              font-size:10px;
              letter-spacing:1.5px;
              text-transform:uppercase;
            ">
              MATCH
            </div>

            <div style="
              margin-top:3px;
              font-size:25px;
              font-weight:600;
              color:#171614;
            ">
              ${formatScore(score)}%
            </div>

          </div>

        </div>

        ${
          supplierType
            ? `
              <div style="
                margin-top:18px;
                display:inline-block;
                border:1px solid #cfc3b5;
                padding:6px 10px;
                font-size:10px;
                letter-spacing:1px;
                text-transform:uppercase;
                color:#665f57;
              ">
                ${escapeHtml(supplierType)}
              </div>
            `
            : ""
        }

        ${
          capability
            ? `
              <div style="
                margin-top:18px;
                padding-top:17px;
                border-top:1px solid #e2d9ce;
                color:#514b45;
                font-size:14px;
                line-height:1.7;
              ">
                ${escapeHtml(capability)}
              </div>
            `
            : ""
        }

        ${
          evidence
            ? `
              <div style="
                margin-top:14px;
                color:#82786e;
                font-size:12px;
                line-height:1.6;
              ">
                <strong>Web evidence:</strong>
                ${escapeHtml(evidence)}
              </div>
            `
            : ""
        }

        ${
          domain
            ? `
              <div style="
                margin-top:10px;
                color:#8a8178;
                font-size:11px;
              ">
                Source domain:
                ${escapeHtml(domain)}
              </div>
            `
            : ""
        }

        ${
          website
            ? `
              <div style="
                margin-top:18px;
              ">
                <a
                  href="${escapeHtml(website)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="
                    display:inline-block;
                    background:#b42f24;
                    color:#fff;
                    text-decoration:none;
                    padding:10px 16px;
                    font-size:12px;
                    letter-spacing:.3px;
                  "
                >
                  Visit Supplier Website →
                </a>
              </div>
            `
            : ""
        }

      </div>
    `;
  }

  /* ============================================================
     RENDER RESULT
     ============================================================ */

  function renderResult(data) {
    const parsed = getResponseData(data);

    const normalized = parsed.normalized;
    const scoring = parsed.scoring;
    const matches = parsed.matches;
    const brief = parsed.brief;
    const meta = parsed.meta;

    const product =
      clean(
        normalized.product ||
        brief.product ||
        data.product
      ) ||
      "Sourcing Requirement";

    const quantity =
      clean(
        normalized.quantity ||
        brief.quantity ||
        data.quantity
      );

    const targetPrice =
      clean(
        normalized.targetPrice ||
        normalized.target_price ||
        brief.targetPrice ||
        data.targetPrice
      );

    const destination =
      clean(
        normalized.destination ||
        brief.destination ||
        data.destination
      );

    const requestId =
      clean(
        data.requestId ||
        data.request_id ||
        data.id
      );

    const searchQuery =
      clean(
        meta.searchQuery ||
        meta.search_query
      );

    const supplierSource =
      clean(
        meta.supplierData ||
        meta.source
      ) ||
      "Public web search";

    const score =
      scoring.score ??
      scoring.overall ??
      data.score ??
      null;

    resultContainer.innerHTML = `
      <div style="
        background:#f7f1e6;
        border:1px solid #ded3c2;
        padding:32px;
        box-sizing:border-box;
        font-family:Arial,sans-serif;
        color:#1d1b18;
      ">

        <!-- HEADER -->

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:25px;
          flex-wrap:wrap;
          margin-bottom:30px;
        ">

          <div>

            <div style="
              color:#b42f24;
              font-size:11px;
              letter-spacing:2px;
              text-transform:uppercase;
              margin-bottom:10px;
            ">
              CASEVO AI / SOURCING ANALYSIS
            </div>

            <h2 style="
              margin:0;
              font-family:Georgia,serif;
              font-size:34px;
              line-height:1.15;
              font-weight:500;
            ">
              Real supplier discovery completed.
            </h2>

          </div>

          ${
            score !== null &&
            score !== undefined
              ? `
                <div style="
                  min-width:100px;
                  text-align:right;
                ">

                  <div style="
                    color:#8a8178;
                    font-size:10px;
                    letter-spacing:1.5px;
                    text-transform:uppercase;
                  ">
                    CASEVO SCORE
                  </div>

                  <div style="
                    font-size:32px;
                    font-weight:600;
                    margin-top:3px;
                  ">
                    ${formatScore(score)}
                  </div>

                </div>
              `
              : ""
          }

        </div>

        <!-- SOURCING BRIEF -->

        <div style="
          background:#fffaf3;
          border:1px solid #ddd2c2;
          padding:22px;
          box-sizing:border-box;
        ">

          <div style="
            color:#b42f24;
            font-size:10px;
            letter-spacing:2px;
            text-transform:uppercase;
            margin-bottom:16px;
          ">
            SOURCING REQUIREMENT
          </div>

          <div style="
            font-family:Georgia,serif;
            font-size:22px;
            line-height:1.4;
          ">
            ${escapeHtml(product)}
          </div>

          <div style="
            display:grid;
            grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
            gap:18px;
            margin-top:22px;
          ">

            <div>
              <div style="
                font-size:10px;
                letter-spacing:1.5px;
                text-transform:uppercase;
                color:#8b8177;
              ">
                Quantity
              </div>

              <div style="
                margin-top:5px;
                font-size:14px;
              ">
                ${escapeHtml(quantity || "Not specified")}
              </div>
            </div>

            <div>
              <div style="
                font-size:10px;
                letter-spacing:1.5px;
                text-transform:uppercase;
                color:#8b8177;
              ">
                Target Price
              </div>

              <div style="
                margin-top:5px;
                font-size:14px;
              ">
                ${escapeHtml(targetPrice || "Not specified")}
              </div>
            </div>

            <div>
              <div style="
                font-size:10px;
                letter-spacing:1.5px;
                text-transform:uppercase;
                color:#8b8177;
              ">
                Destination
              </div>

              <div style="
                margin-top:5px;
                font-size:14px;
              ">
                ${escapeHtml(destination || "Not specified")}
              </div>
            </div>

          </div>

        </div>

        <!-- SUPPLIER MATCHES -->

        <div style="
          margin-top:36px;
          padding-top:26px;
          border-top:1px solid #d8cdbc;
        ">

          <div style="
            color:#b42f24;
            font-size:11px;
            letter-spacing:2px;
            text-transform:uppercase;
            margin-bottom:8px;
          ">
            REAL SUPPLIER MATCHES
          </div>

          <div style="
            font-family:Georgia,serif;
            font-size:27px;
            line-height:1.3;
            margin-bottom:20px;
          ">
            Potential suppliers found on the public web.
          </div>

          ${
            matches.length
              ? `
                <div>
                  ${matches
                    .slice(0, 12)
                    .map(renderSupplierCard)
                    .join("")}
                </div>
              `
              : `
                <div style="
                  background:#fffaf3;
                  border:1px solid #ddd2c2;
                  padding:24px;
                  color:#665f57;
                  line-height:1.7;
                  font-size:14px;
                ">
                  CASEVO completed the sourcing analysis,
                  but no supplier matches were returned from
                  the public web search.
                </div>
              `
          }

        </div>

        <!-- SEARCH INFORMATION -->

        <div style="
          margin-top:30px;
          padding-top:22px;
          border-top:1px solid #d8cdbc;
        ">

          <div style="
            color:#8a8178;
            font-size:10px;
            letter-spacing:1.5px;
            text-transform:uppercase;
            margin-bottom:10px;
          ">
            SEARCH INFORMATION
          </div>

          <div style="
            color:#665f57;
            font-size:12px;
            line-height:1.7;
          ">

            <div>
              <strong>Supplier data:</strong>
              ${escapeHtml(supplierSource)}
            </div>

            ${
              searchQuery
                ? `
                  <div style="margin-top:4px;">
                    <strong>Search query:</strong>
                    ${escapeHtml(searchQuery)}
                  </div>
                `
                : ""
            }

            ${
              requestId
                ? `
                  <div style="margin-top:4px;">
                    <strong>Request ID:</strong>
                    ${escapeHtml(requestId)}
                  </div>
                `
                : ""
            }

          </div>

        </div>

        <!-- VERIFICATION NOTICE -->

        <div style="
          margin-top:24px;
          background:#f0e9dd;
          border:1px solid #d8cdbc;
          padding:18px;
          color:#665f57;
          font-size:12px;
          line-height:1.7;
        ">

          <strong style="color:#1d1b18;">
            Verification notice
          </strong>

          <br>

          Public-web supplier matches are discovery results,
          not commercial verification. Company identity,
          manufacturing capability, certifications, pricing,
          MOQ, production capacity and contact information
          should be independently verified before placing an order.

        </div>

      </div>
    `;

    resultContainer.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  /* ============================================================
     COLLECT FORM DATA
     ============================================================ */

  function collectFormData() {
    const requirement =
      requirementField
        ? clean(requirementField.value)
        : "";

    const product =
      productField
        ? clean(productField.value)
        : "";

    const quantity =
      quantityField
        ? clean(quantityField.value)
        : "";

    const targetPrice =
      priceField
        ? clean(priceField.value)
        : "";

    const destination =
      destinationField
        ? clean(destinationField.value)
        : "";

    return {
      requirement,
      product,
      quantity,
      targetPrice,
      destination
    };
  }

  /* ============================================================
     SUBMIT SOURCING REQUEST
     ============================================================ */

  async function submitSourcingRequest(event) {
    event.preventDefault();

    const payload = collectFormData();

    if (
      !payload.requirement &&
      !payload.product
    ) {
      renderError(
        "Please describe what you want to source before running the analysis."
      );

      if (requirementField) {
        requirementField.focus();
      }

      return;
    }

    renderSearching();
    setLoading(true);

    console.log(
      "CASEVO sourcing request:",
      payload
    );

    try {
      const response = await fetch(
        API_ENDPOINT,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },

          body: JSON.stringify(payload)
        }
      );

      const rawText =
        await response.text();

      let data;

      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        console.error(
          "CASEVO invalid JSON:",
          rawText
        );

        throw new Error(
          "CASEVO server returned an invalid response."
        );
      }

      console.log(
        "CASEVO sourcing response:",
        data
      );

      if (
        !response.ok ||
        data.ok === false
      ) {
        throw new Error(
          data.error ||
          data.message ||
          "Unable to complete the supplier search."
        );
      }

      renderResult(data);

    } catch (error) {
      console.error(
        "CASEVO sourcing error:",
        error
      );

      renderError(
        error && error.message
          ? error.message
          : "Unable to connect to CASEVO sourcing service."
      );

    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     FORM EVENT
     ============================================================ */

  form.addEventListener(
    "submit",
    submitSourcingRequest
  );

  /* ============================================================
     PUBLIC CASEVO API
     ============================================================ */

  window.CASEVO =
    window.CASEVO || {};

  window.CASEVO.analyze =
    async function (request) {
      if (
        !request ||
        typeof request !== "object"
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

            body:
              JSON.stringify(request)
          }
        );

      const rawText =
        await response.text();

      let data;

      try {
        data =
          JSON.parse(rawText);
      } catch (error) {
        throw new Error(
          "CASEVO server returned invalid JSON."
        );
      }

      if (
        !response.ok ||
        data.ok === false
      ) {
        throw new Error(
          data.error ||
          data.message ||
          "CASEVO API request failed."
        );
      }

      return data;
    };

  /* ============================================================
     OPTIONAL HEALTH CHECK
     ============================================================ */

  async function checkCasevoHealth() {
    try {
      const response =
        await fetch(
          "/api/health",
          {
            method: "GET",
            headers: {
              "Accept":
                "application/json"
            }
          }
        );

      if (!response.ok) {
        console.warn(
          "CASEVO health check failed."
        );

        return;
      }

      const data =
        await response.json();

      console.log(
        "CASEVO health:",
        data
      );

    } catch (error) {
      console.warn(
        "CASEVO health check unavailable:",
        error
      );
    }
  }

  checkCasevoHealth();

  console.log(
    "CASEVO AI Sourcing frontend initialized successfully."
  );

})();
