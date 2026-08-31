/* ============================================================
   CASEVO AI SOURCING — FINAL script.js
   ============================================================
   IMPORTANT:
   - Uses the EXISTING #results container in index.html.
   - NEVER inserts results inside .sourcing-grid.
   - Sends POST /api/sourcing.
   - Matches the current CASEVO Worker 3.0 response.
   - Uses public-web results as unverified discovery leads.
   ============================================================ */

(function () {
  "use strict";

  const API_ENDPOINT = "/api/sourcing";

  console.log("CASEVO: Final sourcing frontend loaded.");
  console.log("CASEVO API endpoint:", API_ENDPOINT);

  /* ==========================================================
     HELPERS
     ========================================================== */

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function clean(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function first() {
    for (const value of arguments) {
      const result = clean(value);

      if (result) {
        return result;
      }
    }

    return "";
  }

  function valueOf(element) {
    if (!element) {
      return "";
    }

    return clean(element.value);
  }

  function setButtonText(button, text) {
    if (!button) {
      return;
    }

    if (
      button.tagName &&
      button.tagName.toLowerCase() === "input"
    ) {
      button.value = text;
    } else {
      button.textContent = text;
    }
  }

  /* ==========================================================
     LOCATE FORM
     ========================================================== */

  const form =
    $("#sourcingForm") ||
    $("#sourcing-form") ||
    $("form");

  if (!form) {
    console.warn(
      "CASEVO: sourcing form not found."
    );
    return;
  }

  /* ==========================================================
     LOCATE FIELDS
     ========================================================== */

  const requirementField =
    $("#request", form) ||
    $("#requirement", form) ||
    $("textarea", form);

  const productField =
    $("#product", form) ||
    $("#product-material", form);

  const quantityField =
    $("#quantity", form);

  const priceField =
    $("#price", form) ||
    $("#target-price", form);

  const destinationField =
    $("#destination", form);

  const submitButton =
    $("button[type='submit']", form) ||
    $("input[type='submit']", form) ||
    $("button", form);

  /* ==========================================================
     USE EXISTING RESULTS CONTAINER
     ==========================================================

     DO NOT create another result container.

     index.html already contains:

       <div class="sourcing-grid">
         <form ...>
         <aside ...>
       </div>

       <div class="results" id="results" hidden>
         ...
       </div>

     Therefore #results MUST remain outside .sourcing-grid.
     ========================================================== */

  const results = $("#results");
  const resultTitle = $("#resultTitle");
  const brief = $("#brief");
  const supplierGrid = $("#supplierGrid");

  if (!results || !brief || !supplierGrid) {
    console.error(
      "CASEVO: Required result elements are missing."
    );

    return;
  }

  /* ==========================================================
     FALLBACK EXTRACTION
     ========================================================== */

  function extractProduct(text) {
    const value = clean(text);
    const lower = value.toLowerCase();

    const phrases = [
      "premium full-grain leather shoe upper",
      "full-grain leather shoe upper",
      "full grain leather shoe upper",
      "leather shoe upper",
      "shoe upper",
      "upper leather",
      "full-grain leather",
      "genuine leather",
      "cow leather",
      "leather",
      "footwear",
      "sneakers",
      "sneaker"
    ];

    for (const phrase of phrases) {
      if (lower.includes(phrase)) {
        return phrase;
      }
    }

    return "";
  }

  function extractQuantity(text) {
    const match = clean(text).match(
      /\b\d[\d,.\s]*\s*(?:pairs?|pcs?|pieces?|kg|kgs?|tons?|tonnes?|mt|sqm|sq\s*ft|sqft|units?)\b/i
    );

    return match
      ? clean(match[0])
      : "";
  }

  function extractPrice(text) {
    const match = clean(text).match(
      /(?:USD|US\$|\$)\s*[\d,.]+(?:\s*(?:per|\/)\s*[a-zA-Z0-9 ._-]+)?/i
    );

    return match
      ? clean(match[0])
      : "";
  }

  function extractDestination(text) {
    const lower = clean(text).toLowerCase();

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
     FORM VALUES
     ========================================================== */

  function getValues() {
    const requirement =
      valueOf(requirementField);

    return {
      requirement,

      product:
        valueOf(productField),

      quantity:
        valueOf(quantityField),

      targetPrice:
        valueOf(priceField),

      destination:
        valueOf(destinationField)
    };
  }

  /* ==========================================================
     READINESS FALLBACK
     ========================================================== */

  function calculateReadiness(values) {
    const requirement =
      clean(values.requirement);

    const product =
      first(
        values.product,
        extractProduct(requirement)
      );

    const quantity =
      first(
        values.quantity,
        extractQuantity(requirement)
      );

    const targetPrice =
      first(
        values.targetPrice,
        extractPrice(requirement)
      );

    const destination =
      first(
        values.destination,
        extractDestination(requirement)
      );

    let clarity = 20;
    let specification = 15;
    let commercial = 20;

    if (requirement.length >= 20) {
      clarity += 25;
    }

    if (product) {
      clarity += 20;
    }

    if (
      /full[- ]?grain|genuine|leather|material/i.test(
        requirement
      )
    ) {
      specification += 20;
    }

    if (
      /\d+(?:\.\d+)?\s*mm/i.test(
        requirement
      )
    ) {
      specification += 20;
    }

    if (
      /black|brown|white|red|blue|color|colour/i.test(
        requirement
      )
    ) {
      specification += 10;
    }

    if (quantity) {
      commercial += 20;
    }

    if (targetPrice) {
      commercial += 20;
    }

    if (destination) {
      commercial += 20;
    }

    clarity =
      Math.min(100, clarity);

    specification =
      Math.min(100, specification);

    commercial =
      Math.min(100, commercial);

    return {
      clarity,
      specification,
      commercial,

      score:
        Math.round(
          (
            clarity +
            specification +
            commercial
          ) / 3
        )
    };
  }

  /* ==========================================================
     NORMALIZE WORKER RESPONSE
     ========================================================== */

  function normalize(data, formValues) {
    const root =
      data || {};

    const analysis =
      root.analysis || {};

    const normalized =
      analysis.normalized || {};

    const scoring =
      analysis.scoring ||
      root.scoring ||
      {};

    const requirement =
      first(
        analysis.requirement,
        root.requirement,
        formValues.requirement
      );

    const product =
      first(
        analysis.product,
        normalized.product,
        formValues.product,
        extractProduct(requirement)
      );

    const quantity =
      first(
        analysis.quantity,
        normalized.quantity,
        formValues.quantity,
        extractQuantity(requirement)
      );

    const targetPrice =
      first(
        analysis.targetPrice,
        analysis.target_price,
        normalized.targetPrice,
        normalized.target_price,
        formValues.targetPrice,
        extractPrice(requirement)
      );

    const destination =
      first(
        analysis.destination,
        normalized.destination,
        formValues.destination,
        extractDestination(requirement)
      );

    let matches = [];

    if (
      Array.isArray(root.matches)
    ) {
      matches =
        root.matches;
    } else if (
      Array.isArray(analysis.matches)
    ) {
      matches =
        analysis.matches;
    }

    const fallback =
      calculateReadiness({
        requirement,
        product,
        quantity,
        targetPrice,
        destination
      });

    return {
      requestId:
        first(
          root.requestId,
          root.request_id
        ),

      message:
        first(
          root.message
        ),

      requirement,

      product,

      quantity,

      targetPrice,

      destination,

      score:
        first(
          scoring.score,
          root.score,
          analysis.score,
          fallback.score
        ),

      clarity:
        first(
          scoring.clarity,
          fallback.clarity
        ),

      specification:
        first(
          scoring.specification,
          scoring.specificationQuality,
          fallback.specification
        ),

      commercial:
        first(
          scoring.commercial,
          scoring.commercialReadiness,
          fallback.commercial
        ),

      scoringNote:
        first(
          scoring.note,
          root.scoringNote
        ),

      matches,

      meta:
        root.meta || {}
    };
  }

  /* ==========================================================
     UI STATE
     ========================================================== */

  function setLoading(loading) {
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
            ? submitButton.value
            : submitButton.textContent;
      }

      submitButton.disabled = true;

      submitButton.style.opacity =
        "0.65";

      submitButton.style.cursor =
        "wait";

      setButtonText(
        submitButton,
        "Analyzing..."
      );

    } else {

      submitButton.disabled = false;

      submitButton.style.opacity =
        "";

      submitButton.style.cursor =
        "";

      setButtonText(
        submitButton,
        submitButton.dataset.casevoOriginalText ||
          "Analyze & Find Matches"
      );
    }
  }

  function showResults() {
    results.hidden = false;

    results.removeAttribute(
      "aria-hidden"
    );
  }

  function clearOldSearchInfo() {
    results
      .querySelectorAll(
        ".casevo-search-info"
      )
      .forEach(function (node) {
        node.remove();
      });
  }

  /* ==========================================================
     LOADING
     ========================================================== */

  function renderLoading() {
    showResults();

    if (resultTitle) {
      resultTitle.textContent =
        "Analyzing sourcing requirement.";
    }

    brief.innerHTML = `
      <p>
        CASEVO is searching public supplier information
        and structuring the sourcing requirement.
      </p>
    `;

    supplierGrid.innerHTML = "";
  }

  /* ==========================================================
     ERROR
     ========================================================== */

  function renderError(
    message,
    requestId
  ) {
    showResults();

    if (resultTitle) {
      resultTitle.textContent =
        "Supplier discovery could not be completed.";
    }

    brief.innerHTML = `
      <div class="casevo-runtime-error"
           style="
             border:1px solid #d96b5e;
             padding:18px;
             margin-bottom:18px;
           ">

        <strong>
          ${esc(
            message ||
              "The sourcing analysis request failed."
          )}
        </strong>

        ${
          requestId
            ? `
              <div
                style="
                  margin-top:10px;
                  font-size:11px;
                  color:#756d64;
                "
              >
                Request ID:
                ${esc(requestId)}
              </div>
            `
            : ""
        }

      </div>
    `;

    supplierGrid.innerHTML = "";
  }

  /* ==========================================================
     BRIEF
     ========================================================== */

  function renderBrief(result) {
    const rows = [
      [
        "PRODUCT / MATERIAL",
        result.product
      ],
      [
        "QUANTITY",
        result.quantity
      ],
      [
        "TARGET PRICE",
        result.targetPrice
      ],
      [
        "DESTINATION",
        result.destination
      ]
    ];

    brief.innerHTML = `
      <div class="casevo-structured-brief">

        ${rows
          .map(function (row) {
            return `
              <div
                class="casevo-brief-row"
                style="
                  display:flex;
                  justify-content:space-between;
                  gap:20px;
                  padding:14px 0;
                  border-bottom:1px solid rgba(0,0,0,.12);
                "
              >

                <span
                  style="
                    font-size:9px;
                    letter-spacing:.12em;
                    text-transform:uppercase;
                    color:#777066;
                  "
                >
                  ${esc(row[0])}
                </span>

                <strong
                  style="
                    text-align:right;
                    font-size:12px;
                    font-weight:500;
                  "
                >
                  ${esc(
                    row[1] ||
                      "Not specified"
                  )}
                </strong>

              </div>
            `;
          })
          .join("")}

        <div
          class="casevo-readiness-block"
          style="
            margin-top:22px;
            padding-top:18px;
            border-top:1px solid rgba(0,0,0,.15);
          "
        >

          <div
            style="
              font-size:9px;
              letter-spacing:.14em;
              text-transform:uppercase;
              color:#b42f24;
              margin-bottom:10px;
            "
          >
            SOURCING READINESS
          </div>

          <div
            class="casevo-readiness-row"
            style="
              display:flex;
              justify-content:space-between;
              padding:9px 0;
              border-bottom:1px solid rgba(0,0,0,.08);
            "
          >
            <span>
              Requirement clarity
            </span>

            <strong>
              ${esc(result.clarity)}%
            </strong>
          </div>

          <div
            class="casevo-readiness-row"
            style="
              display:flex;
              justify-content:space-between;
              padding:9px 0;
              border-bottom:1px solid rgba(0,0,0,.08);
            "
          >
            <span>
              Specification quality
            </span>

            <strong>
              ${esc(result.specification)}%
            </strong>
          </div>

          <div
            class="casevo-readiness-row"
            style="
              display:flex;
              justify-content:space-between;
              padding:9px 0;
            "
          >
            <span>
              Commercial readiness
            </span>

            <strong>
              ${esc(result.commercial)}%
            </strong>
          </div>

          ${
            result.scoringNote
              ? `
                <p
                  style="
                    margin-top:12px;
                    font-size:11px;
                    line-height:1.6;
                    color:#6d665e;
                  "
                >
                  ${esc(
                    result.scoringNote
                  )}
                </p>
              `
              : ""
          }

        </div>

      </div>
    `;
  }

  /* ==========================================================
     SAFE URL
     ========================================================== */

  function safeHttpUrl(value) {
    const raw =
      clean(value);

    if (!raw) {
      return "";
    }

    try {
      const url =
        new URL(
          /^https?:\/\//i.test(raw)
            ? raw
            : "https://" + raw
        );

      if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
      ) {
        return "";
      }

      return url.href;

    } catch {
      return "";
    }
  }

  /* ==========================================================
     SUPPLIER CARD
     ========================================================== */

  function renderSupplier(
    match,
    index
  ) {
    const supplier =
      match || {};

    const name =
      first(
        supplier.name,
        supplier.title,
        supplier.company,
        supplier.domain,
        `Supplier result ${index + 1}`
      );

    const location =
      first(
        supplier.location,
        "Not determined"
      );

    const score =
      first(
        supplier.matchScore,
        supplier.match_score,
        supplier.score,
        "—"
      );

    const description =
      first(
        supplier.capability,
        supplier.description,
        supplier.note,
        supplier.evidence,
        supplier.content
      );

    const website =
      safeHttpUrl(
        first(
          supplier.website,
          supplier.url
        )
      );

    const verification =
      first(
        supplier.verificationStatus,
        supplier.verification_status,
        "Unverified — due diligence required"
      );

    return `
      <article
        class="casevo-supplier-card"
        style="
          border:1px solid rgba(0,0,0,.14);
          padding:20px;
          margin-bottom:14px;
          background:rgba(255,255,255,.18);
        "
      >

        <div
          class="casevo-supplier-head"
          style="
            display:flex;
            justify-content:space-between;
            gap:20px;
            align-items:flex-start;
          "
        >

          <div>

            <div
              class="casevo-supplier-index"
              style="
                font-size:8px;
                letter-spacing:.14em;
                color:#b42f24;
                text-transform:uppercase;
                margin-bottom:6px;
              "
            >
              SUPPLIER ${index + 1}
            </div>

            <h4
              style="
                margin:0;
                font-family:Georgia,serif;
                font-size:21px;
                line-height:1.1;
                font-weight:400;
              "
            >
              ${esc(name)}
            </h4>

            <div
              class="casevo-supplier-location"
              style="
                margin-top:7px;
                font-size:11px;
                color:#6d665e;
              "
            >
              ${esc(location)}
            </div>

          </div>

          <div
            class="casevo-supplier-score"
            style="
              min-width:65px;
              text-align:right;
            "
          >

            <small
              style="
                display:block;
                font-size:8px;
                letter-spacing:.12em;
                color:#777066;
                margin-bottom:5px;
              "
            >
              MATCH
            </small>

            <strong>
              ${esc(score)}%
            </strong>

          </div>

        </div>

        ${
          description
            ? `
              <p
                class="casevo-supplier-description"
                style="
                  margin:16px 0 0;
                  font-size:12px;
                  line-height:1.65;
                  color:#4f4942;
                "
              >
                ${esc(description)}
              </p>
            `
            : ""
        }

        ${
          website
            ? `
              <a
                class="casevo-supplier-link"
                href="${esc(website)}"
                target="_blank"
                rel="noopener noreferrer"
                style="
                  display:inline-block;
                  margin-top:14px;
                  color:#a92f26;
                  font-size:11px;
                  text-decoration:none;
                "
              >
                Visit supplier website →
              </a>
            `
            : ""
        }

        <div
          class="casevo-supplier-verification"
          style="
            margin-top:14px;
            padding-top:12px;
            border-top:1px solid rgba(0,0,0,.09);
            font-size:10px;
            line-height:1.5;
            color:#7a7167;
          "
        >
          ${esc(verification)}
        </div>

      </article>
    `;
  }

  /* ==========================================================
     FINAL RESULT
     ========================================================== */

  function renderResult(
    data,
    formValues
  ) {
    const result =
      normalize(
        data,
        formValues
      );

    showResults();

    if (resultTitle) {
      resultTitle.textContent =
        "Supplier matches";
    }

    renderBrief(result);

    const matches =
      Array.isArray(result.matches)
        ? result.matches
            .filter(Boolean)
            .slice(0, 10)
        : [];

    if (matches.length > 0) {

      supplierGrid.innerHTML =
        matches
          .map(function (match, index) {
            return renderSupplier(
              match,
              index
            );
          })
          .join("");

    } else {

      supplierGrid.innerHTML = `
        <div
          class="casevo-no-matches"
          style="
            border:1px solid #d8cdbd;
            padding:20px;
            background:rgba(255,255,255,.16);
          "
        >

          <h4
            style="
              margin:0;
              font-family:Georgia,serif;
              font-size:22px;
              font-weight:400;
            "
          >
            No verified supplier matches were returned.
          </h4>

          <p
            style="
              margin-top:12px;
              font-size:12px;
              line-height:1.65;
            "
          >
            CASEVO completed the public-web sourcing
            analysis, but no supplier identity could be
            verified for this request.
          </p>

          <p
            style="
              margin-top:10px;
              font-size:12px;
              line-height:1.65;
              color:#696158;
            "
          >
            Supplier identity, manufacturing capability,
            certifications, MOQ and commercial contacts
            should be independently verified before
            placing an order.
          </p>

        </div>
      `;
    }

    /* --------------------------------------------------------
       SEARCH INFORMATION
       -------------------------------------------------------- */

    const meta =
      result.meta || {};

    const searchInfo =
      document.createElement("div");

    searchInfo.className =
      "casevo-search-info";

    searchInfo.style.cssText = `
      margin-top:24px;
      padding-top:18px;
      border-top:1px solid rgba(0,0,0,.14);
      font-size:10px;
      line-height:1.6;
      color:#777066;
    `;

    searchInfo.innerHTML = `
      <div
        style="
          color:#b42f24;
          font-size:8px;
          letter-spacing:.15em;
          text-transform:uppercase;
          margin-bottom:8px;
        "
      >
        SEARCH INFORMATION
      </div>

      <div>
        Supplier data:
        ${esc(
          first(
            meta.supplierData,
            meta.source,
            "Public web search"
          )
        )}
      </div>

      <div>
        Results scanned:
        ${esc(
          first(
            meta.resultsScanned,
            "0"
          )
        )}
      </div>

      <div>
        Suppliers returned:
        ${esc(
          first(
            meta.suppliersReturned,
            String(matches.length)
          )
        )}
      </div>

      <div
        style="
          margin-top:10px;
        "
      >
        Verification notice:
        ${esc(
          first(
            meta.verificationNote,
            "Public-web supplier results are discovery leads, not commercial verification."
          )
        )}
      </div>

      ${
        result.requestId
          ? `
            <div
              style="
                margin-top:8px;
              "
            >
              Request ID:
              ${esc(
                result.requestId
              )}
            </div>
          `
          : ""
      }
    `;

    results.appendChild(
      searchInfo
    );
  }

  /* ==========================================================
     API REQUEST
     ========================================================== */

  async function callWorker(
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

    const raw =
      await response.text();

    let data;

    try {
      data =
        JSON.parse(raw);

    } catch (error) {

      console.error(
        "CASEVO: Invalid JSON returned:",
        raw
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
      const error =
        new Error(
          first(
            data.error,
            data.message,
            "Supplier discovery could not be completed."
          )
        );

      error.requestId =
        first(
          data.requestId,
          data.request_id
        );

      throw error;
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

    clearOldSearchInfo();

    const values =
      getValues();

    console.log(
      "CASEVO: Form values:",
      values
    );

    /* --------------------------------------------------------
       REQUIRED FIELD
       -------------------------------------------------------- */

    if (!values.requirement) {

      renderError(
        "Please enter a sourcing requirement."
      );

      if (requirementField) {
        requirementField.focus();
      }

      return;
    }

    /* --------------------------------------------------------
       LOADING
       -------------------------------------------------------- */

    setLoading(true);

    renderLoading();

    /* --------------------------------------------------------
       API
       -------------------------------------------------------- */

    try {

      const data =
        await callWorker(
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
          "The sourcing analysis request failed.",
        error.requestId
      );

    } finally {

      setLoading(false);
    }
  }

  /* ==========================================================
     BIND FORM ONLY ONCE
     ========================================================== */

  if (
    form.dataset.casevoBound ===
    "true"
  ) {
    console.warn(
      "CASEVO: form already bound."
    );

    return;
  }

  form.dataset.casevoBound =
    "true";

  form.addEventListener(
    "submit",
    handleSubmit
  );

  /* ==========================================================
     PUBLIC CASEVO HELPER
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

      return callWorker({
        requirement:
          clean(
            request.requirement
          ),

        product:
          clean(
            request.product
          ),

        quantity:
          clean(
            request.quantity
          ),

        targetPrice:
          clean(
            request.targetPrice ||
            request.target_price
          ),

        destination:
          clean(
            request.destination
          )
      });
    };

  /* ==========================================================
     FINAL DEBUG
     ========================================================== */

  console.log(
    "CASEVO: FINAL script.js initialized successfully."
  );

  console.log(
    "CASEVO: Form:",
    form
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
    "CASEVO: Price field:",
    priceField
  );

  console.log(
    "CASEVO: Destination field:",
    destinationField
  );

  console.log(
    "CASEVO: Results:",
    results
  );

})();
