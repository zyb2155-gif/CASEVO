/* =========================================================
   CASEVO AI SOURCING — FINAL FRONTEND
   Version 4.0
   ---------------------------------------------------------
   - Sends sourcing requirements to /api/sourcing
   - Reads product / quantity / price / destination
   - Extracts missing fields from the sourcing description
   - Preserves original user requirement
   - Renders real Worker response
   - No API key is exposed in frontend
   ========================================================= */

(function () {
  "use strict";

  const API_ENDPOINT = "/api/sourcing";

  /* =========================================================
     BASIC HELPERS
     ========================================================= */

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function clean(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function firstExisting(selectors, root = document) {
    for (const selector of selectors) {
      const element = qs(selector, root);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function findInputByLabel(labelText) {
    const labels = qsa("label");

    const target = labels.find((label) =>
      clean(label.textContent)
        .toLowerCase()
        .includes(labelText.toLowerCase())
    );

    if (!target) {
      return null;
    }

    const forId = target.getAttribute("for");

    if (forId) {
      return document.getElementById(forId);
    }

    return target.parentElement
      ? target.parentElement.querySelector(
          "input, textarea, select"
        )
      : null;
  }

  function findByPlaceholder(text) {
    const fields = qsa(
      "input[placeholder], textarea[placeholder]"
    );

    const target = text.toLowerCase();

    return (
      fields.find((field) =>
        String(field.placeholder || "")
          .toLowerCase()
          .includes(target)
      ) || null
    );
  }

  function getField(selectors, labelText, placeholderText) {
    return (
      firstExisting(selectors) ||
      findInputByLabel(labelText) ||
      (placeholderText
        ? findByPlaceholder(placeholderText)
        : null)
    );
  }

  /* =========================================================
     FIND FORM
     ========================================================= */

  function locateForm() {
    return firstExisting([
      "#sourcing-form",
      "#sourcingForm",
      "#ai-sourcing-form",
      "#aiSourcingForm",
      "form[data-sourcing-form]",
      "form"
    ]);
  }

  const form = locateForm();

  if (!form) {
    console.warn(
      "CASEVO: sourcing form was not found."
    );
    return;
  }

  /* =========================================================
     FIND FORM FIELDS
     ========================================================= */

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
      "textarea[name='brief']",
      "textarea"
    ],
    "what are you sourcing",
    "what are you sourcing"
  );

  const productField = getField(
    [
      "#product",
      "#product-material",
      "#productMaterial",
      "#material",
      "input[name='product']",
      "input[name='product_material']",
      "input[name='material']"
    ],
    "product / material",
    "upper leather"
  );

  const quantityField = getField(
    [
      "#quantity",
      "input[name='quantity']"
    ],
    "quantity",
    "5,000"
  );

  const priceField = getField(
    [
      "#target-price",
      "#targetPrice",
      "#price",
      "input[name='target_price']",
      "input[name='targetPrice']",
      "input[name='price']"
    ],
    "target price",
    "$4"
  );

  const destinationField = getField(
    [
      "#destination",
      "input[name='destination']",
      "select[name='destination']"
    ],
    "destination",
    "USA"
  );

  /* =========================================================
     DEBUG
     ========================================================= */

  console.log(
    "CASEVO fields:",
    {
      requirementField,
      productField,
      quantityField,
      priceField,
      destinationField
    }
  );

  /* =========================================================
     SUBMIT BUTTON
     ========================================================= */

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
    ).find((button) =>
      /analy|match|source|find/i.test(
        button.textContent
      )
    );
  }

  /* =========================================================
     RESULT CONTAINER
     ========================================================= */

  let resultContainer =
    qs("#casevo-results");

  if (!resultContainer) {
    resultContainer =
      document.createElement("div");

    resultContainer.id =
      "casevo-results";

    resultContainer.style.cssText = `
      margin-top:32px;
      width:100%;
      box-sizing:border-box;
    `;

    form.insertAdjacentElement(
      "afterend",
      resultContainer
    );
  }

  /* =========================================================
     LOADING
     ========================================================= */

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
        "Analyzing sourcing requirement...";
    } else {
      submitButton.disabled = false;
      submitButton.style.opacity = "";
      submitButton.style.cursor = "";

      submitButton.textContent =
        submitButton.dataset.originalText ||
        "Analyze & Find Matches";
    }
  }

  /* =========================================================
     TEXT PARSING
     ========================================================= */

  function extractQuantity(text) {
    const source = clean(text);

    const patterns = [
      /(\d[\d,]*(?:\.\d+)?)\s*(pairs?|pcs?|pieces?|units?|kg|kgs?|tons?|tonnes?|meters?|metres?|yards?|sq\s*ft|sqft|square\s*feet)/i,

      /quantity\s*[:\-]?\s*(\d[\d,]*(?:\.\d+)?\s*\w*)/i,

      /(\d[\d,]*(?:\.\d+)?)\s*pair/i
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);

      if (match) {
        if (match[2]) {
          return clean(
            `${match[1]} ${match[2]}`
          );
        }

        if (match[1]) {
          return clean(match[1]);
        }
      }
    }

    return "";
  }

  function extractDestination(text) {
    const source = clean(text);

    const patterns = [
      /shipping\s+to\s+([A-Za-z][A-Za-z .,'-]+)/i,

      /ship(?:ping)?\s+(?:to|into)\s+([A-Za-z][A-Za-z .,'-]+)/i,

      /destination\s*[:\-]?\s*([A-Za-z][A-Za-z .,'-]+)/i,

      /deliver(?:y)?\s+(?:to|in)\s+([A-Za-z][A-Za-z .,'-]+)/i
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);

      if (match && match[1]) {
        let value = clean(match[1]);

        value = value
          .replace(/[.,;:]+$/, "")
          .trim();

        if (value) {
          return value;
        }
      }
    }

    return "";
  }

  function extractTargetPrice(text) {
    const source = clean(text);

    const patterns = [
      /(?:target\s+price|budget|price)\s*[:\-]?\s*(\$?\s*[\d,.]+(?:\s*\/\s*[A-Za-z]+)?)/i,

      /(\$\s*[\d,.]+(?:\s*\/\s*(?:sq\s*ft|sqft|unit|pair|kg))?)/i,

      /(?:at|under|below)\s+(\$\s*[\d,.]+)/i
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);

      if (match && match[1]) {
        return clean(match[1]);
      }
    }

    return "";
  }

  function extractProduct(text) {
    const source = clean(text);

    if (!source) {
      return "";
    }

    /*
     * Try to remove commercial/logistics information
     * and keep the actual product/material description.
     */

    let product = source;

    product = product
      .replace(
        /^we\s+(?:need|are\s+looking\s+for|want)\s+/i,
        ""
      )
      .replace(
        /^looking\s+for\s+/i,
        ""
      )
      .replace(
        /^need\s+/i,
        ""
      )
      .replace(
        /^source\s+/i,
        ""
      );

    product = product
      .replace(
        /,\s*\d[\d,]*(?:\.\d+)?\s*(?:pairs?|pcs?|pieces?|units?|kg|kgs?|tons?|tonnes?|meters?|metres?|yards?)/i,
        ""
      );

    product = product
      .replace(
        /,\s*shipping\s+to\s+.+$/i,
        ""
      );

    product = product
      .replace(
        /\s+shipping\s+to\s+.+$/i,
        ""
      );

    product = product
      .replace(
        /\s+for\s+shipping\s+to\s+.+$/i,
        ""
      );

    product = product
      .replace(
        /,\s*destination\s*:.+$/i,
        ""
      );

    product = product
      .replace(
        /,\s*(?:target\s+price|budget|price)\s*:.+$/i,
        ""
      );

    product = product
      .replace(
        /,\s*\$[\d,.]+.*$/i,
        ""
      );

    return clean(product)
      .replace(/[.,;:]+$/, "")
      .trim();
  }

  /* =========================================================
     NORMALIZE FORM DATA
     ========================================================= */

  function getFormValues() {
    const requirement =
      requirementField
        ? clean(requirementField.value)
        : "";

    let product =
      productField
        ? clean(productField.value)
        : "";

    let quantity =
      quantityField
        ? clean(quantityField.value)
        : "";

    let targetPrice =
      priceField
        ? clean(priceField.value)
        : "";

    let destination =
      destinationField
        ? clean(destinationField.value)
        : "";

    /*
     * IMPORTANT:
     * If the individual fields are empty,
     * extract them from the main sourcing description.
     */

    if (requirement) {
      if (!quantity) {
        quantity =
          extractQuantity(requirement);
      }

      if (!destination) {
        destination =
          extractDestination(requirement);
      }

      if (!targetPrice) {
        targetPrice =
          extractTargetPrice(requirement);
      }

      if (!product) {
        product =
          extractProduct(requirement);
      }
    }

    /*
     * If the user filled product but not requirement,
     * create a useful requirement.
     */

    let finalRequirement =
      requirement;

    if (!finalRequirement) {
      const parts = [];

      if (product) {
        parts.push(product);
      }

      if (quantity) {
        parts.push(`Quantity: ${quantity}`);
      }

      if (targetPrice) {
        parts.push(
          `Target price: ${targetPrice}`
        );
      }

      if (destination) {
        parts.push(
          `Shipping to: ${destination}`
        );
      }

      finalRequirement =
        parts.join(", ");
    }

    return {
      requirement: finalRequirement,
      product,
      quantity,
      targetPrice,
      destination
    };
  }

  /* =========================================================
     ERROR RENDER
     ========================================================= */

  function renderError(
    message,
    requestId = ""
  ) {
    resultContainer.innerHTML = `
      <div style="
        border:1px solid #d99b91;
        background:#fff8f6;
        padding:28px;
        box-sizing:border-box;
        color:#7f281f;
        font-family:Arial,sans-serif;
      ">

        <div style="
          font-size:10px;
          letter-spacing:2px;
          text-transform:uppercase;
          margin-bottom:10px;
          color:#b42f24;
        ">
          CASEVO AI / ERROR
        </div>

        <div style="
          font-size:20px;
          line-height:1.4;
          font-weight:600;
        ">
          Supplier discovery could not be completed.
        </div>

        <div style="
          margin-top:10px;
          font-size:14px;
          line-height:1.6;
        ">
          ${escapeHtml(message)}
        </div>

        ${
          requestId
            ? `
              <div style="
                margin-top:18px;
                font-size:11px;
                color:#81786e;
              ">
                Request ID:
                ${escapeHtml(requestId)}
              </div>
            `
            : ""
        }

      </div>
    `;

    resultContainer.scrollIntoView({
      behavior:"smooth",
      block:"start"
    });
  }

  /* =========================================================
     INFO CARD
     ========================================================= */

  function infoCard(
    label,
    value
  ) {
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
          line-height:1.45;
        ">
          ${escapeHtml(
            value || "Not specified"
          )}
        </div>

      </div>
    `;
  }

  /* =========================================================
     RESULT RENDER
     ========================================================= */

  function renderResult(
    data,
    submitted
  ) {
    const brief =
      data.brief || {};

    const analysis =
      data.analysis || {};

    const normalized =
      analysis.normalized || {};

    const scoring =
      analysis.scoring || {};

    const matches =
      Array.isArray(
        analysis.matches
      )
        ? analysis.matches
        : [];

    /*
     * IMPORTANT:
     * Prefer submitted values.
     *
     * This prevents the UI from displaying:
     * "Sourcing Requirement"
     * or
     * "Not specified"
     * when the user actually entered the data.
     */

    const displayProduct =
      submitted.product ||
      normalized.product ||
      brief.product ||
      "Sourcing Requirement";

    const displayQuantity =
      submitted.quantity ||
      normalized.quantity ||
      brief.quantity ||
      "Not specified";

    const displayTargetPrice =
      submitted.targetPrice ||
      normalized.targetPrice ||
      brief.targetPrice ||
      "Not specified";

    const displayDestination =
      submitted.destination ||
      normalized.destination ||
      brief.destination ||
      "Not specified";

    const requirements =
      Array.isArray(
        normalized.requirements
      )
        ? normalized.requirements
        : [];

    const tags =
      Array.isArray(
        normalized.tags
      )
        ? normalized.tags
        : [];

    const requestId =
      data.requestId ||
      data.request_id ||
      data.id ||
      "";

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

            <h2 style="
              margin:0;
              font-family:Georgia,serif;
              font-size:34px;
              line-height:1.08;
              font-weight:500;
            ">
              Real supplier discovery completed.
            </h2>

            <div style="
              margin-top:10px;
              color:#665f57;
              font-size:13px;
              line-height:1.5;
            ">
              CASEVO supplier discovery completed successfully.
            </div>

          </div>

          <div style="
            border:1px solid #cdbfae;
            padding:14px 22px;
            min-width:120px;
            text-align:center;
            background:#fffaf2;
          ">

            <div style="
              font-size:9px;
              letter-spacing:1.5px;
              text-transform:uppercase;
              color:#81786e;
              margin-bottom:7px;
            ">
              CASEVO SCORE
            </div>

            <div style="
              font-size:28px;
              font-weight:600;
            ">
              ${escapeHtml(
                scoring.score ?? "—"
              )}

              <span style="
                font-size:13px;
                color:#777;
              ">
                /100
              </span>
            </div>

          </div>

        </div>

        <!-- BASIC INFORMATION -->

        <div style="
          display:grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(180px,1fr)
            );
          gap:1px;
          background:#d8cdbc;
          margin-bottom:30px;
        ">

          ${infoCard(
            "PRODUCT / MATERIAL",
            displayProduct
          )}

          ${infoCard(
            "QUANTITY",
            displayQuantity
          )}

          ${infoCard(
            "TARGET PRICE",
            displayTargetPrice
          )}

          ${infoCard(
            "DESTINATION",
            displayDestination
          )}

        </div>

        <!-- ORIGINAL REQUEST -->

        <div style="
          margin-bottom:30px;
        ">

          <div style="
            color:#b42f24;
            font-size:10px;
            letter-spacing:2px;
            text-transform:uppercase;
            margin-bottom:10px;
          ">
            SOURCING REQUIREMENT
          </div>

          <div style="
            background:#fffaf3;
            border:1px solid #ddd2c2;
            padding:20px;
            font-size:14px;
            line-height:1.7;
          ">
            ${escapeHtml(
              submitted.requirement ||
              brief.requirement ||
              "Requirement received by CASEVO."
            )}
          </div>

        </div>

        <!-- ANALYSIS -->

        <div style="
          display:grid;
          grid-template-columns:
            minmax(0,1.4fr)
            minmax(260px,0.8fr);
          gap:28px;
        ">

          <!-- NORMALIZED REQUIREMENTS -->

          <div>

            <div style="
              font-size:10px;
              letter-spacing:2px;
              color:#b42f24;
              text-transform:uppercase;
              margin-bottom:10px;
            ">
              NORMALIZED REQUIREMENTS
            </div>

            <div style="
              background:#fffaf3;
              border:1px solid #ddd2c2;
              padding:20px;
            ">

              ${
                requirements.length
                  ? requirements
                      .map(
                        (
                          item,
                          index
                        ) => `
                          <div style="
                            display:flex;
                            gap:12px;
                            padding:10px 0;
                            border-bottom:
                              1px solid #e7ded2;
                          ">

                            <span style="
                              color:#b42f24;
                              min-width:24px;
                            ">
                              ${String(
                                index + 1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>

                            <span>
                              ${escapeHtml(
                                item
                              )}
                            </span>

                          </div>
                        `
                      )
                      .join("")
                  : `
                    <div style="
                      color:#665f57;
                      line-height:1.6;
                    ">
                      CASEVO successfully structured
                      the sourcing requirement.
                    </div>
                  `
              }

            </div>

            ${
              tags.length
                ? `
                  <div style="
                    display:flex;
                    flex-wrap:wrap;
                    gap:8px;
                    margin-top:14px;
                  ">

                    ${tags
                      .map(
                        (tag) => `
                          <span style="
                            border:1px solid #cfc2b2;
                            padding:7px 10px;
                            background:#fffaf3;
                            font-size:11px;
                            color:#665f57;
                          ">
                            ${escapeHtml(tag)}
                          </span>
                        `
                      )
                      .join("")}

                  </div>
                `
                : ""
            }

          </div>

          <!-- SCORE -->

          <div>

            <div style="
              font-size:10px;
              letter-spacing:2px;
              color:#b42f24;
              text-transform:uppercase;
              margin-bottom:10px;
            ">
              SOURCING READINESS
            </div>

            <div style="
              background:#211f1c;
              color:white;
              padding:24px;
            ">

              <div style="
                display:flex;
                justify-content:space-between;
                margin-bottom:18px;
                gap:15px;
              ">
                <span>
                  Requirement clarity
                </span>

                <strong>
                  ${escapeHtml(
                    scoring.clarity ?? "—"
                  )}
                </strong>
              </div>

              <div style="
                display:flex;
                justify-content:space-between;
                margin-bottom:18px;
                gap:15px;
              ">
                <span>
                  Specification quality
                </span>

                <strong>
                  ${escapeHtml(
                    scoring.specification ?? "—"
                  )}
                </strong>
              </div>

              <div style="
                display:flex;
                justify-content:space-between;
                gap:15px;
              ">
                <span>
                  Commercial readiness
                </span>

                <strong>
                  ${escapeHtml(
                    scoring.commercial ?? "—"
                  )}
                </strong>
              </div>

            </div>

            ${
              scoring.note
                ? `
                  <div style="
                    margin-top:14px;
                    font-size:13px;
                    line-height:1.6;
                    color:#665f57;
                  ">
                    ${escapeHtml(
                      scoring.note
                    )}
                  </div>
                `
                : ""
            }

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
            font-size:10px;
            letter-spacing:2px;
            text-transform:uppercase;
            margin-bottom:8px;
          ">
            REAL SUPPLIER MATCHES
          </div>

          ${
            matches.length
              ? matches
                  .map(
                    (
                      match,
                      index
                    ) => `
                      <div style="
                        background:#fffaf3;
                        border:1px solid #ddd2c2;
                        padding:20px;
                        margin-bottom:10px;
                      ">

                        <div style="
                          display:flex;
                          justify-content:space-between;
                          gap:15px;
                          flex-wrap:wrap;
                        ">

                          <div>

                            <strong style="
                              font-size:17px;
                            ">
                              ${escapeHtml(
                                match.name ||
                                `Supplier ${
                                  index + 1
                                }`
                              )}
                            </strong>

                            <div style="
                              color:#746d64;
                              font-size:13px;
                              margin-top:5px;
                            ">
                              ${escapeHtml(
                                match.location ||
                                "China"
                              )}
                            </div>

                          </div>

                          <div style="
                            font-weight:600;
                          ">
                            ${escapeHtml(
                              match.matchScore ??
                              match.score ??
                              "—"
                            )}%
                          </div>

                        </div>

                        ${
                          match.note
                            ? `
                              <div style="
                                margin-top:12px;
                                color:#625c55;
                                font-size:13px;
                                line-height:1.5;
                              ">
                                ${escapeHtml(
                                  match.note
                                )}
                              </div>
                            `
                            : ""
                        }

                        ${
                          match.url
                            ? `
                              <div style="
                                margin-top:14px;
                              ">
                                <a
                                  href="${escapeHtml(
                                    match.url
                                  )}"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style="
                                    color:#b42f24;
                                    font-size:13px;
                                  "
                                >
                                  View public source →
                                </a>
                              </div>
                            `
                            : ""
                        }

                      </div>
                    `
                  )
                  .join("")
              : `
                <div style="
                  background:#fffaf3;
                  border:1px solid #ddd2c2;
                  padding:22px;
                  color:#665f57;
                  line-height:1.7;
                ">

                  CASEVO completed the public-web
                  supplier search, but no supplier
                  records were returned for this request.

                  <br><br>

                  Try adding more specific material,
                  product, country, manufacturing
                  capability, or certification
                  requirements.

                </div>
              `
          }

        </div>

        <!-- SEARCH INFORMATION -->

        <div style="
          margin-top:28px;
          padding-top:20px;
          border-top:1px solid #d8cdbc;
          font-size:11px;
          line-height:1.7;
          color:#81786e;
        ">

          <div>
            Supplier data:
            Public web search
          </div>

          <div>
            Verification:
            Public-web discovery;
            independent verification required.
          </div>

          ${
            requestId
              ? `
                <div style="
                  margin-top:7px;
                ">
                  Request ID:
                  ${escapeHtml(
                    requestId
                  )}
                </div>
              `
              : ""
          }

        </div>

      </div>
    `;

    resultContainer.scrollIntoView({
      behavior:"smooth",
      block:"start"
    });
  }

  /* =========================================================
     SUBMIT
     ========================================================= */

  async function submitSourcingRequest(
    event
  ) {
    event.preventDefault();

    const submitted =
      getFormValues();

    console.log(
      "CASEVO final sourcing payload:",
      submitted
    );

    /*
     * At least one meaningful sourcing field
     * must exist.
     */

    if (
      !submitted.requirement &&
      !submitted.product
    ) {
      renderError(
        "Please describe what you want to source before running the analysis."
      );

      if (requirementField) {
        requirementField.focus();
      }

      return;
    }

    /*
     * Construct final payload.
     *
     * IMPORTANT:
     * Worker receives BOTH:
     * - requirement
     * - structured fields
     */

    const payload = {
      requirement:
        submitted.requirement,

      product:
        submitted.product,

      productMaterial:
        submitted.product,

      quantity:
        submitted.quantity,

      targetPrice:
        submitted.targetPrice,

      target_price:
        submitted.targetPrice,

      destination:
        submitted.destination,

      source:
        "CASEVO website",

      timestamp:
        new Date().toISOString()
    };

    console.log(
      "CASEVO sending payload:",
      payload
    );

    setLoading(true);

    resultContainer.innerHTML = `
      <div style="
        padding:32px;
        background:#f7f1e6;
        border:1px solid #ded3c2;
        text-align:center;
        color:#625b53;
        font-family:Arial,sans-serif;
      ">

        <div style="
          font-size:10px;
          letter-spacing:2px;
          text-transform:uppercase;
          color:#b42f24;
          margin-bottom:12px;
        ">
          CASEVO AI / SOURCING
        </div>

        <div style="
          font-family:Georgia,serif;
          font-size:25px;
          line-height:1.25;
        ">
          Searching public supplier intelligence...
        </div>

        <div style="
          margin-top:10px;
          font-size:13px;
          color:#81786e;
        ">
          CASEVO is analyzing supplier capabilities,
          product relevance and public-web evidence.
        </div>

      </div>
    `;

    try {
      const response =
        await fetch(
          API_ENDPOINT,
          {
            method:"POST",

            headers:{
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

      const rawText =
        await response.text();

      console.log(
        "CASEVO raw server response:",
        rawText
      );

      let data;

      try {
        data =
          JSON.parse(
            rawText
          );
      } catch (error) {
        throw new Error(
          "CASEVO server returned an invalid JSON response."
        );
      }

      console.log(
        "CASEVO parsed response:",
        data
      );

      if (
        !response.ok ||
        data.ok === false
      ) {
        throw new Error(
          data.error ||
          data.message ||
          "Unable to analyze this sourcing request."
        );
      }

      /*
       * Keep submitted values together with response.
       * This guarantees correct display even when
       * Worker normalization omits a field.
       */

      renderResult(
        data,
        submitted
      );

    } catch (error) {
      console.error(
        "CASEVO sourcing error:",
        error
      );

      renderError(
        error.message ||
        "Unable to connect to CASEVO sourcing service."
      );

    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     FORM BINDING
     ========================================================= */

  form.addEventListener(
    "submit",
    submitSourcingRequest
  );

  /*
   * Do NOT add another submit action to the button.
   * Native form submit is responsible for the request.
   */

  /* =========================================================
     PUBLIC CASEVO API
     ========================================================= */

  window.CASEVO =
    window.CASEVO || {};

  window.CASEVO.analyze =
    function (request) {

      if (
        !request ||
        typeof request !== "object"
      ) {
        return Promise.reject(
          new Error(
            "Invalid CASEVO sourcing request."
          )
        );
      }

      return fetch(
        API_ENDPOINT,
        {
          method:"POST",

          headers:{
            "Content-Type":
              "application/json",

            "Accept":
              "application/json"
          },

          body:
            JSON.stringify(
              request
            )
        }
      )
        .then(
          async (response) => {

            const raw =
              await response.text();

            let data;

            try {
              data =
                JSON.parse(raw);
            } catch (error) {
              throw new Error(
                "CASEVO API returned invalid JSON."
              );
            }

            if (!response.ok) {
              throw new Error(
                data.error ||
                data.message ||
                "CASEVO API request failed."
              );
            }

            return data;
          }
        );
    };

  /* =========================================================
     INITIALIZATION MESSAGE
     ========================================================= */

  console.log(
    "CASEVO AI Sourcing frontend initialized."
  );

  console.log(
    "API endpoint:",
    API_ENDPOINT
  );

})();
