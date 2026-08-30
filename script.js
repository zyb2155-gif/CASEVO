/* ============================================================
   CASEVO AI SOURCING — FINAL FRONTEND
   ============================================================

   Frontend responsibilities:
   1. Read the CASEVO sourcing form
   2. Normalize user input
   3. Extract missing information from the main requirement
   4. POST to /api/sourcing
   5. Safely parse Worker responses
   6. Render real supplier discovery results
   7. Show the REAL backend error when something fails

   No OpenAI API key is used in the browser.
   ============================================================ */

(function () {
  "use strict";

  /* ============================================================
     CONFIG
     ============================================================ */

  const API_ENDPOINT = new URL(
    "/api/sourcing",
    window.location.origin
  ).toString();

  const HEALTH_ENDPOINT = new URL(
    "/api/health",
    window.location.origin
  ).toString();

  console.log("CASEVO frontend loaded.");
  console.log("CASEVO sourcing endpoint:", API_ENDPOINT);

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

  function clean(value) {
    return String(value == null ? "" : value)
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
    return element ? clean(element.value) : "";
  }

  /* ============================================================
     FORM DISCOVERY
     ============================================================ */

  function findSourcingForm() {
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
        text.includes("what are you sourcing") ||
        text.includes("product / material") ||
        text.includes("quantity") ||
        text.includes("destination") ||
        text.includes("analyze & find matches")
      );
    });

    return sourcingForm || forms[0];
  }

  /* ============================================================
     FIELD DISCOVERY
     ============================================================ */

  function findField(selectors, labelText, form) {
    const direct = firstExisting(selectors, form);

    if (direct) {
      return direct;
    }

    const labels = qsa("label", form || document);

    const wanted = clean(labelText).toLowerCase();

    for (const label of labels) {
      const labelValue = clean(
        label.textContent || ""
      ).toLowerCase();

      if (!labelValue.includes(wanted)) {
        continue;
      }

      const forId = label.getAttribute("for");

      if (forId) {
        const linked = document.getElementById(forId);

        if (linked) {
          return linked;
        }
      }

      const parent = label.parentElement;

      if (parent) {
        const field = qs(
          "textarea, input, select",
          parent
        );

        if (field) {
          return field;
        }
      }
    }

    return null;
  }

  /* ============================================================
     REQUIREMENT FIELD
     ============================================================ */

  function getRequirementField(form) {
    return findField(
      [
        "#requirement",
        "#requirements",
        "#sourcing-requirement",
        "#sourcingRequirement",
        "#sourcing-brief",
        "#sourcingBrief",
        "#brief",
        'textarea[name="requirement"]',
        'textarea[name="requirements"]',
        'textarea[name="request"]',
        'textarea[name="brief"]',
        "textarea"
      ],
      "what are you sourcing",
      form
    );
  }

  /* ============================================================
     PRODUCT FIELD
     ============================================================ */

  function getProductField(form) {
    return findField(
      [
        "#product",
        "#product-material",
        "#productMaterial",
        "#material",
        'input[name="product"]',
        'input[name="material"]',
        'input[name="product_material"]'
      ],
      "product / material",
      form
    );
  }

  /* ============================================================
     QUANTITY FIELD
     ============================================================ */

  function getQuantityField(form) {
    return findField(
      [
        "#quantity",
        'input[name="quantity"]',
        'input[name="qty"]'
      ],
      "quantity",
      form
    );
  }

  /* ============================================================
     PRICE FIELD
     ============================================================ */

  function getPriceField(form) {
    return findField(
      [
        "#target-price",
        "#targetPrice",
        "#price",
        'input[name="targetPrice"]',
        'input[name="target_price"]',
        'input[name="price"]'
      ],
      "target price",
      form
    );
  }

  /* ============================================================
     DESTINATION FIELD
     ============================================================ */

  function getDestinationField(form) {
    return findField(
      [
        "#destination",
        'input[name="destination"]',
        'select[name="destination"]'
      ],
      "destination",
      form
    );
  }

  /* ============================================================
     PRODUCT EXTRACTION
     ============================================================ */

  function extractProduct(requirement) {
    const text = clean(requirement);

    if (!text) {
      return "";
    }

    const patterns = [
      /premium\s+full[-\s]?grain\s+leather\s+shoe\s+upper/i,
      /full[-\s]?grain\s+leather\s+shoe\s+upper/i,
      /leather\s+shoe\s+upper/i,
      /shoe\s+upper/i,
      /footwear\s+upper/i,
      /upper\s+leather/i,
      /genuine\s+leather/i,
      /cow\s+leather/i,
      /leather/i,
      /sneakers?/i,
      /footwear/i,
      /rubber\s+sole/i,
      /sole/i,
      /textile/i,
      /fabric/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);

      if (match) {
        return clean(match[0]);
      }
    }

    return "";
  }

  /* ============================================================
     QUANTITY EXTRACTION
     ============================================================ */

  function extractQuantity(requirement) {
    const text = clean(requirement);

    if (!text) {
      return "";
    }

    const patterns = [
      /[\d,]+(?:\.\d+)?\s*pairs?/i,
      /[\d,]+(?:\.\d+)?\s*pcs?/i,
      /[\d,]+(?:\.\d+)?\s*pieces?/i,
      /[\d,]+(?:\.\d+)?\s*units?/i,
      /[\d,]+(?:\.\d+)?\s*kg/i,
      /[\d,]+(?:\.\d+)?\s*tons?/i,
      /[\d,]+(?:\.\d+)?\s*sqm/i,
      /[\d,]+(?:\.\d+)?\s*sqft/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);

      if (match) {
        return clean(match[0]);
      }
    }

    return "";
  }

  /* ============================================================
     PRICE EXTRACTION
     ============================================================ */

  function extractPrice(requirement) {
    const text = clean(requirement);

    if (!text) {
      return "";
    }

    const patterns = [
      /(?:USD|US\$|\$)\s*[\d,.]+(?:\s*(?:per|\/)\s*[A-Za-z0-9 ]+)?/i,
      /[\d,.]+\s*(?:USD|US\$)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);

      if (match) {
        return clean(match[0]);
      }
    }

    return "";
  }

  /* ============================================================
     DESTINATION EXTRACTION
     ============================================================ */

  function extractDestination(requirement) {
    const text = clean(requirement);

    if (!text) {
      return "";
    }

    const destinations = [
      "United States",
      "USA",
      "US",
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
      "Korea",
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

    const lower = text.toLowerCase();

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

  /* ============================================================
     THICKNESS EXTRACTION
     ============================================================ */

  function extractThickness(requirement) {
    const text = clean(requirement);

    const match = text.match(
      /\b\d+(?:\.\d+)?\s*mm\b/i
    );

    return match
      ? clean(match[0])
      : "";
  }

  /* ============================================================
     COLOR EXTRACTION
     ============================================================ */

  function extractColor(requirement) {
    const text = clean(requirement).toLowerCase();

    const colors = [
      "black",
      "white",
      "brown",
      "dark brown",
      "tan",
      "red",
      "blue",
      "green",
      "grey",
      "gray",
      "beige",
      "navy",
      "natural"
    ];

    for (const color of colors) {
      if (text.includes(color)) {
        return color;
      }
    }

    return "";
  }

  /* ============================================================
     BUILD COMPLETE REQUEST
     ============================================================ */

  function buildPayload(form) {
    const requirementField =
      getRequirementField(form);

    const productField =
      getProductField(form);

    const quantityField =
      getQuantityField(form);

    const priceField =
      getPriceField(form);

    const destinationField =
      getDestinationField(form);

    const requirement =
      textOf(requirementField);

    let product =
      textOf(productField);

    let quantity =
      textOf(quantityField);

    let targetPrice =
      textOf(priceField);

    let destination =
      textOf(destinationField);

    /*
     * IMPORTANT:
     * If the smaller fields are empty, derive them
     * from the main sourcing requirement.
     */

    if (!product) {
      product =
        extractProduct(requirement);
    }

    if (!quantity) {
      quantity =
        extractQuantity(requirement);
    }

    if (!targetPrice) {
      targetPrice =
        extractPrice(requirement);
    }

    if (!destination) {
      destination =
        extractDestination(requirement);
    }

    const thickness =
      extractThickness(requirement);

    const color =
      extractColor(requirement);

    return {
      requirement,
      product,
      quantity,
      targetPrice,
      destination,

      /*
       * Additional structured information.
       * The Worker can safely ignore these fields
       * if it does not use them.
       */
      thickness,
      color,

      source: "CASEVO website",
      client: "getcasevo.com",
      timestamp: new Date().toISOString()
    };
  }

  /* ============================================================
     RESULT CONTAINER
     ============================================================ */

  function getResultContainer(form) {
    let container =
      qs("#casevo-results");

    if (container) {
      return container;
    }

    container =
      document.createElement("div");

    container.id =
      "casevo-results";

    container.style.cssText = `
      width:100%;
      box-sizing:border-box;
      margin-top:32px;
    `;

    if (form) {
      form.insertAdjacentElement(
        "afterend",
        container
      );
    } else {
      document.body.appendChild(container);
    }

    return container;
  }

  /* ============================================================
     LOADING
     ============================================================ */

  function setLoading(button, loading) {
    if (!button) {
      return;
    }

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText =
          button.textContent ||
          "Analyze & Find Matches";
      }

      button.disabled = true;
      button.style.opacity = "0.65";
      button.style.cursor = "wait";

      button.textContent =
        "Analyzing sourcing requirement...";
    } else {
      button.disabled = false;
      button.style.opacity = "";
      button.style.cursor = "";

      button.textContent =
        button.dataset.originalText ||
        "Analyze & Find Matches";
    }
  }

  /* ============================================================
     LOADING UI
     ============================================================ */

  function renderLoading(container) {
    container.innerHTML = `
      <div style="
        border:1px solid #ded3c2;
        background:#f7f1e6;
        padding:32px;
        text-align:center;
        box-sizing:border-box;
        color:#1d1b18;
      ">
        <div style="
          color:#b42f24;
          font-size:10px;
          letter-spacing:2px;
          text-transform:uppercase;
          margin-bottom:12px;
        ">
          CASEVO AI
        </div>

        <div style="
          font-family:Georgia,serif;
          font-size:28px;
          line-height:1.2;
        ">
          Searching real supplier data...
        </div>

        <div style="
          margin-top:12px;
          color:#756d63;
          font-size:13px;
        ">
          CASEVO is analyzing the sourcing requirement
          and querying the supplier discovery engine.
        </div>
      </div>
    `;
  }

  /* ============================================================
     ERROR UI
     ============================================================ */

  function renderError(
    container,
    message,
    details,
    status
  ) {
    const safeMessage =
      clean(message) ||
      "The sourcing analysis request failed.";

    const safeDetails =
      clean(details);

    const statusText =
      status
        ? `HTTP ${status}`
        : "";

    container.innerHTML = `
      <div style="
        border:1px solid #b42f24;
        background:#fffaf5;
        padding:28px;
        box-sizing:border-box;
        color:#1d1b18;
      ">

        <div style="
          color:#b42f24;
          font-size:10px;
          letter-spacing:2px;
          text-transform:uppercase;
          margin-bottom:12px;
        ">
          CASEVO AI / ERROR
        </div>

        <div style="
          font-family:Georgia,serif;
          font-size:30px;
          line-height:1.1;
          margin-bottom:12px;
        ">
          Supplier discovery could not be completed.
        </div>

        <div style="
          font-size:14px;
          line-height:1.6;
          margin-bottom:16px;
        ">
          ${escapeHtml(safeMessage)}
        </div>

        ${
          safeDetails
            ? `
              <div style="
                border:1px solid #ded3c2;
                background:#f7f1e6;
                padding:16px;
                font-family:monospace;
                font-size:12px;
                line-height:1.6;
                white-space:pre-wrap;
                word-break:break-word;
              ">
                ${escapeHtml(safeDetails)}
              </div>
            `
            : ""
        }

        ${
          statusText
            ? `
              <div style="
                margin-top:12px;
                font-size:11px;
                color:#81786e;
              ">
                ${escapeHtml(statusText)}
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

  /* ============================================================
     SUPPLIER RESULT NORMALIZATION
     ============================================================ */

  function getMatches(data) {
    if (
      data &&
      data.analysis &&
      Array.isArray(data.analysis.matches)
    ) {
      return data.analysis.matches;
    }

    if (
      data &&
      Array.isArray(data.matches)
    ) {
      return data.matches;
    }

    if (
      data &&
      data.analysis &&
      Array.isArray(data.analysis.suppliers)
    ) {
      return data.analysis.suppliers;
    }

    return [];
  }

  /* ============================================================
     SCORE
     ============================================================ */

  function getScore(data) {
    if (
      data &&
      data.analysis &&
      data.analysis.scoring
    ) {
      return data.analysis.scoring;
    }

    if (
      data &&
      data.scoring
    ) {
      return data.scoring;
    }

    return {};
  }

  /* ============================================================
     BRIEF
     ============================================================ */

  function getBrief(data) {
    if (
      data &&
      data.brief
    ) {
      return data.brief;
    }

    if (
      data &&
      data.analysis
    ) {
      return data.analysis;
    }

    return {};
  }

  /* ============================================================
     RESULT RENDERING
     ============================================================ */

  function renderResult(
    container,
    data
  ) {
    const brief =
      getBrief(data);

    const scoring =
      getScore(data);

    const matches =
      getMatches(data);

    const normalized =
      data?.analysis?.normalized ||
      {};

    const product =
      clean(
        normalized.product ||
        brief.product
      ) ||
      "Sourcing Requirement";

    const quantity =
      clean(
        normalized.quantity ||
        brief.quantity
      ) ||
      "Not specified";

    const targetPrice =
      clean(
        normalized.targetPrice ||
        brief.targetPrice
      ) ||
      "Not specified";

    const destination =
      clean(
        normalized.destination ||
        brief.destination
      ) ||
      "Not specified";

    const score =
      scoring.score ??
      data?.score ??
      "—";

    const clarity =
      scoring.clarity ??
      "—";

    const specification =
      scoring.specification ??
      scoring.specificationQuality ??
      "—";

    const commercial =
      scoring.commercial ??
      scoring.commercialReadiness ??
      "—";

    const note =
      scoring.note ||
      data?.message ||
      "Supplier discovery completed successfully.";

    let supplierHtml = "";

    if (matches.length) {
      supplierHtml =
        matches
          .map(function (match, index) {
            const name =
              clean(
                match.name ||
                match.company ||
                match.title
              ) ||
              `Supplier ${index + 1}`;

            const location =
              clean(
                match.location ||
                match.country
              ) ||
              "Location not determined";

            const website =
              clean(
                match.website ||
                match.url
              );

            const capability =
              clean(
                match.capability ||
                match.description ||
                match.evidence
              );

            const matchScore =
              match.matchScore ??
              match.score ??
              "—";

            const verification =
              clean(
                match.verificationStatus ||
                match.verification ||
                "Public-web result — independent verification required."
              );

            return `
              <div style="
                background:#fffaf3;
                border:1px solid #ddd2c2;
                padding:22px;
                margin-bottom:12px;
              ">

                <div style="
                  display:flex;
                  justify-content:space-between;
                  gap:20px;
                  flex-wrap:wrap;
                ">

                  <div>
                    <div style="
                      font-family:Georgia,serif;
                      font-size:21px;
                      line-height:1.2;
                    ">
                      ${escapeHtml(name)}
                    </div>

                    <div style="
                      margin-top:6px;
                      color:#756d63;
                      font-size:12px;
                    ">
                      ${escapeHtml(location)}
                    </div>
                  </div>

                  <div style="
                    font-weight:600;
                    font-size:16px;
                  ">
                    ${escapeHtml(matchScore)}%
                  </div>

                </div>

                ${
                  capability
                    ? `
                      <div style="
                        margin-top:16px;
                        font-size:13px;
                        line-height:1.6;
                        color:#4f4942;
                      ">
                        ${escapeHtml(capability)}
                      </div>
                    `
                    : ""
                }

                ${
                  website
                    ? `
                      <div style="
                        margin-top:14px;
                      ">
                        <a
                          href="${escapeHtml(website)}"
                          target="_blank"
                          rel="noopener noreferrer"
                          style="
                            color:#b42f24;
                            text-decoration:none;
                            font-size:12px;
                          "
                        >
                          Visit supplier website →
                        </a>
                      </div>
                    `
                    : ""
                }

                <div style="
                  margin-top:14px;
                  padding-top:12px;
                  border-top:1px solid #e4dbcf;
                  color:#81786e;
                  font-size:11px;
                  line-height:1.5;
                ">
                  ${escapeHtml(verification)}
                </div>

              </div>
            `;
          })
          .join("");
    } else {
      supplierHtml = `
        <div style="
          background:#fffaf3;
          border:1px solid #ddd2c2;
          padding:24px;
          line-height:1.7;
          color:#625c55;
        ">
          <strong style="
            display:block;
            color:#1d1b18;
            margin-bottom:10px;
          ">
            No verified supplier matches were returned.
          </strong>

          CASEVO completed the supplier discovery request,
          but no supplier records were returned from the
          public-web search.

          <div style="
            margin-top:12px;
            font-size:12px;
          ">
            Supplier identity, manufacturing capability,
            certifications, MOQ, production capacity and
            commercial contacts should be independently
            verified before placing an order.
          </div>
        </div>
      `;
    }

    const requestId =
      data?.requestId ||
      data?.meta?.requestId ||
      data?.meta?.tavilyRequestId ||
      "Not available";

    const supplierSource =
      data?.meta?.supplierData ||
      data?.meta?.source ||
      "Public web search";

    const verified =
      data?.meta?.verified === true
        ? "Verified"
        : "Public-web discovery; independent verification required";

    container.innerHTML = `
      <div style="
        background:#f7f1e6;
        border:1px solid #ded3c2;
        padding:32px;
        box-sizing:border-box;
        color:#1d1b18;
      ">

        <div style="
          display:flex;
          justify-content:space-between;
          gap:24px;
          flex-wrap:wrap;
          margin-bottom:30px;
        ">

          <div>
            <div style="
              color:#b42f24;
              font-size:10px;
              letter-spacing:2px;
              text-transform:uppercase;
              margin-bottom:10px;
            ">
              CASEVO AI / SOURCING ANALYSIS
            </div>

            <div style="
              font-family:Georgia,serif;
              font-size:34px;
              line-height:1.08;
            ">
              Real supplier
              <br>
              discovery completed.
            </div>

            <div style="
              margin-top:12px;
              color:#625c55;
              font-size:13px;
            ">
              CASEVO supplier discovery completed successfully.
            </div>
          </div>

          <div style="
            border:1px solid #cdbfae;
            background:#fffaf3;
            padding:16px 24px;
            min-width:130px;
            text-align:center;
          ">

            <div style="
              font-size:9px;
              letter-spacing:1.5px;
              color:#81786e;
              margin-bottom:8px;
            ">
              CASEVO SCORE
            </div>

            <div style="
              font-size:28px;
              font-weight:600;
            ">
              ${escapeHtml(score)}
              <span style="
                font-size:13px;
                color:#756d63;
              ">
                /100
              </span>
            </div>

          </div>

        </div>

        <div style="
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(180px,1fr));
          gap:1px;
          background:#d8cdbc;
          margin-bottom:30px;
        ">

          ${infoCard(
            "PRODUCT / MATERIAL",
            product
          )}

          ${infoCard(
            "QUANTITY",
            quantity
          )}

          ${infoCard(
            "TARGET PRICE",
            targetPrice
          )}

          ${infoCard(
            "DESTINATION",
            destination
          )}

        </div>

        <div style="
          display:grid;
          grid-template-columns:
            minmax(0,1.35fr)
            minmax(260px,.75fr);
          gap:28px;
        ">

          <div>

            <div style="
              color:#b42f24;
              font-size:10px;
              letter-spacing:2px;
              text-transform:uppercase;
              margin-bottom:10px;
            ">
              REAL SUPPLIER MATCHES
            </div>

            <div style="
              font-family:Georgia,serif;
              font-size:28px;
              line-height:1.15;
              margin-bottom:18px;
            ">
              ${
                matches.length
                  ? `${matches.length} supplier result${
                      matches.length === 1
                        ? ""
                        : "s"
                    } returned.`
                  : "No verified supplier matches were returned."
              }
            </div>

            ${supplierHtml}

          </div>

          <div>

            <div style="
              color:#b42f24;
              font-size:10px;
              letter-spacing:2px;
              text-transform:uppercase;
              margin-bottom:10px;
            ">
              SOURCING READINESS
            </div>

            <div style="
              background:#211f1c;
              color:#fff;
              padding:22px;
            ">

              ${scoreRow(
                "Requirement clarity",
                clarity
              )}

              ${scoreRow(
                "Specification quality",
                specification
              )}

              ${scoreRow(
                "Commercial readiness",
                commercial
              )}

            </div>

            <div style="
              margin-top:14px;
              color:#625c55;
              font-size:12px;
              line-height:1.6;
            ">
              ${escapeHtml(note)}
            </div>

          </div>

        </div>

        <div style="
          margin-top:32px;
          padding-top:22px;
          border-top:1px solid #d8cdbc;
          font-size:11px;
          line-height:1.7;
          color:#81786e;
        ">

          <div>
            <strong>Supplier data:</strong>
            ${escapeHtml(supplierSource)}
          </div>

          <div>
            <strong>Verification:</strong>
            ${escapeHtml(verified)}
          </div>

          <div>
            <strong>Request ID:</strong>
            ${escapeHtml(requestId)}
          </div>

        </div>

      </div>
    `;

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  /* ============================================================
     INFO CARD
     ============================================================ */

  function infoCard(label, value) {
    return `
      <div style="
        background:#fffaf3;
        padding:18px;
      ">

        <div style="
          font-size:9px;
          letter-spacing:1.5px;
          color:#81786e;
          margin-bottom:8px;
        ">
          ${escapeHtml(label)}
        </div>

        <div style="
          font-size:14px;
          line-height:1.4;
        ">
          ${escapeHtml(value)}
        </div>

      </div>
    `;
  }

  /* ============================================================
     SCORE ROW
     ============================================================ */

  function scoreRow(label, value) {
    return `
      <div style="
        display:flex;
        justify-content:space-between;
        gap:15px;
        padding-bottom:14px;
        margin-bottom:14px;
        border-bottom:1px solid rgba(255,255,255,.18);
      ">

        <span>
          ${escapeHtml(label)}
        </span>

        <strong>
          ${escapeHtml(value)}
        </strong>

      </div>
    `;
  }

  /* ============================================================
     SAFE RESPONSE PARSER
     ============================================================ */

  async function parseResponse(response) {
    const rawText =
      await response.text();

    let data = null;

    try {
      data =
        rawText
          ? JSON.parse(rawText)
          : null;
    } catch (error) {
      return {
        ok: false,
        invalidJson: true,
        status: response.status,
        rawText
      };
    }

    return {
      ok:
        response.ok &&
        data &&
        data.ok !== false,

      status:
        response.status,

      data
    };
  }

  /* ============================================================
     ERROR MESSAGE EXTRACTION
     ============================================================ */

  function extractError(responseData) {
    const data =
      responseData?.data;

    if (!data) {
      if (responseData?.invalidJson) {
        return {
          message:
            "CASEVO server returned an invalid response.",
          details:
            responseData.rawText ||
            "The server did not return JSON."
        };
      }

      return {
        message:
          "Unable to connect to CASEVO sourcing service.",
        details:
          ""
      };
    }

    return {
      message:
        data.error ||
        data.message ||
        "The sourcing analysis request failed.",

      details:
        data.details ||
        data.detail ||
        data.error_description ||
        ""
    };
  }

  /* ============================================================
     SUBMIT
     ============================================================ */

  async function submitSourcingRequest(
    event,
    form,
    button,
    container
  ) {
    if (event) {
      event.preventDefault();
    }

    const payload =
      buildPayload(form);

    console.log(
      "CASEVO request payload:",
      payload
    );

    /*
     * Main requirement MUST exist.
     */

    if (!payload.requirement) {
      renderError(
        container,
        "Please enter a sourcing requirement.",
        "",
        400
      );

      const requirementField =
        getRequirementField(form);

      if (requirementField) {
        requirementField.focus();
      }

      return;
    }

    setLoading(
      button,
      true
    );

    renderLoading(
      container
    );

    try {
      const response =
        await fetch(
          API_ENDPOINT,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Accept":
                "application/json",

              "Cache-Control":
                "no-cache"
            },

            body:
              JSON.stringify(
                payload
              )
          }
        );

      console.log(
        "CASEVO response status:",
        response.status
      );

      const parsed =
        await parseResponse(
          response
        );

      console.log(
        "CASEVO response:",
        parsed
      );

      if (!parsed.ok) {
        const error =
          extractError(
            parsed
          );

        throw {
          message:
            error.message,

          details:
            error.details,

          status:
            parsed.status
        };
      }

      renderResult(
        container,
        parsed.data
      );

    } catch (error) {
      console.error(
        "CASEVO sourcing error:",
        error
      );

      renderError(
        container,

        error?.message ||
          "The sourcing analysis request failed.",

        error?.details ||
          "",

        error?.status ||
          ""
      );

    } finally {
      setLoading(
        button,
        false
      );
    }
  }

  /* ============================================================
     HEALTH CHECK
     ============================================================ */

  async function checkHealth() {
    try {
      const response =
        await fetch(
          HEALTH_ENDPOINT +
            "?t=" +
            Date.now(),
          {
            method: "GET",
            headers: {
              "Accept":
                "application/json",
              "Cache-Control":
                "no-cache"
            }
          }
        );

      const text =
        await response.text();

      let data = null;

      try {
        data =
          JSON.parse(text);
      } catch {
        data = null;
      }

      console.log(
        "CASEVO health:",
        response.status,
        data || text
      );

      return {
        ok:
          response.ok &&
          data &&
          data.ok !== false,

        status:
          response.status,

        data
      };

    } catch (error) {
      console.warn(
        "CASEVO health check failed:",
        error
      );

      return {
        ok: false,
        status: 0,
        data: null
      };
    }
  }

  /* ============================================================
     INITIALIZE
     ============================================================ */

  function initialize() {
    const form =
      findSourcingForm();

    if (!form) {
      console.warn(
        "CASEVO: sourcing form not found."
      );

      return;
    }

    const requirementField =
      getRequirementField(form);

    const productField =
      getProductField(form);

    const quantityField =
      getQuantityField(form);

    const priceField =
      getPriceField(form);

    const destinationField =
      getDestinationField(form);

    console.log(
      "CASEVO fields:",
      {
        requirement:
          !!requirementField,

        product:
          !!productField,

        quantity:
          !!quantityField,

        targetPrice:
          !!priceField,

        destination:
          !!destinationField
      }
    );

    let button =
      firstExisting(
        [
          "#analyze-button",
          "#analyzeButton",
          "#find-matches",
          "#findMatches",
          'button[type="submit"]'
        ],
        form
      );

    if (!button) {
      button =
        qsa(
          "button",
          form
        ).find(function (element) {
          return /analy|match|source|find/i.test(
            element.textContent || ""
          );
        });
    }

    const container =
      getResultContainer(
        form
      );

    /*
     * Remove previous CASEVO submit handlers
     * when this script is accidentally loaded twice.
     */

    if (
      form.dataset.casevoBound === "true"
    ) {
      console.warn(
        "CASEVO: form already initialized."
      );

      return;
    }

    form.dataset.casevoBound =
      "true";

    form.addEventListener(
      "submit",
      function (event) {
        submitSourcingRequest(
          event,
          form,
          button,
          container
        );
      }
    );

    /*
     * If the button is not a native submit button,
     * bind click as a fallback.
     */

    if (
      button &&
      button.type !== "submit"
    ) {
      button.addEventListener(
        "click",
        function (event) {
          event.preventDefault();

          submitSourcingRequest(
            event,
            form,
            button,
            container
          );
        }
      );
    }

    /*
     * Global CASEVO helper.
     */

    window.CASEVO =
      window.CASEVO || {};

    window.CASEVO.analyze =
      async function (request) {
        const payload =
          request &&
          typeof request === "object"
            ? request
            : {};

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
                JSON.stringify(
                  payload
                )
            }
          );

        const parsed =
          await parseResponse(
            response
          );

        if (!parsed.ok) {
          const error =
            extractError(
              parsed
            );

          const exception =
            new Error(
              error.message
            );

          exception.details =
            error.details;

          exception.status =
            parsed.status;

          throw exception;
        }

        return parsed.data;
      };

    /*
     * Run health check in background.
     */

    checkHealth();

    console.log(
      "CASEVO AI Sourcing frontend initialized successfully."
    );
  }

  /* ============================================================
     START
     ============================================================ */

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

})();
