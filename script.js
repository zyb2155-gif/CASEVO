/* ============================================================
   CASEVO AI SOURCING — FINAL FRONTEND
   ============================================================

   API:
   POST /api/sourcing

   Payload:
   {
     requirement,
     product,
     quantity,
     targetPrice,
     destination
   }

   Important:
   - Never sends an empty requirement when the form contains data.
   - Uses the textarea as the primary sourcing requirement.
   - Automatically builds a requirement from the other fields
     when the textarea is empty.
   - No API key is exposed in the browser.
   ============================================================ */

(function () {
  "use strict";

  const API_ENDPOINT = "/api/sourcing";

  console.log("CASEVO frontend loading...");
  console.log("CASEVO API endpoint:", API_ENDPOINT);

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

  /* ============================================================
     FIELD DISCOVERY
     ============================================================ */

  function findByLabel(labelText, root) {
    const scope = root || document;

    const labels = qsa("label", scope);

    const target = labels.find(function (label) {
      return clean(label.textContent)
        .toLowerCase()
        .includes(labelText.toLowerCase());
    });

    if (!target) {
      return null;
    }

    const forId = target.getAttribute("for");

    if (forId) {
      const linked = document.getElementById(forId);

      if (linked) {
        return linked;
      }
    }

    const parent = target.parentElement;

    if (parent) {
      const field = qs(
        "textarea, input, select",
        parent
      );

      if (field) {
        return field;
      }
    }

    return null;
  }

  function findTextarea(form) {
    if (!form) {
      return null;
    }

    return (
      firstExisting(
        [
          "#requirement",
          "#requirements",
          "#sourcing-requirement",
          "#sourcingRequirement",
          "#sourcing-brief",
          "#sourcingBrief",
          "#brief",
          "textarea[name='requirement']",
          "textarea[name='requirements']",
          "textarea[name='request']",
          "textarea[name='sourcing_requirement']",
          "textarea[name='brief']",
          "textarea"
        ],
        form
      ) ||
      findByLabel("what are you sourcing", form)
    );
  }

  function findInput(form, selectors, labelText) {
    if (!form) {
      return null;
    }

    const field = firstExisting(selectors, form);

    if (field) {
      return field;
    }

    if (labelText) {
      return findByLabel(labelText, form);
    }

    return null;
  }

  /* ============================================================
     FIND THE CORRECT SOURCING FORM
     ============================================================ */

  function findSourcingForm() {
    const forms = qsa("form");

    if (!forms.length) {
      return null;
    }

    /*
     * Prefer a form containing a textarea.
     * This is important because the sourcing textarea
     * is the main requirement field.
     */

    const textareaForm = forms.find(function (form) {
      return !!findTextarea(form);
    });

    if (textareaForm) {
      return textareaForm;
    }

    /*
     * Second attempt:
     * find a form containing sourcing-related fields.
     */

    const sourcingForm = forms.find(function (form) {
      const text = (
        form.innerText ||
        form.textContent ||
        ""
      ).toLowerCase();

      return (
        text.includes("what are you sourcing") ||
        text.includes("product / material") ||
        text.includes("quantity") ||
        text.includes("target price") ||
        text.includes("destination")
      );
    });

    if (sourcingForm) {
      return sourcingForm;
    }

    /*
     * Last fallback.
     */

    return forms[0];
  }

  /* ============================================================
     MAIN INITIALIZATION
     ============================================================ */

  function initializeCASEVO() {
    const form = findSourcingForm();

    if (!form) {
      console.warn(
        "CASEVO: sourcing form was not found."
      );
      return;
    }

    console.log(
      "CASEVO: sourcing form detected.",
      form
    );

    /* ----------------------------------------------------------
       Locate fields
       ---------------------------------------------------------- */

    const requirementField = findTextarea(form);

    const productField = findInput(
      form,
      [
        "#product",
        "#product-material",
        "#productMaterial",
        "#material",
        "input[name='product']",
        "input[name='material']",
        "input[name='product_material']",
        "input[name='productMaterial']"
      ],
      "product / material"
    );

    const quantityField = findInput(
      form,
      [
        "#quantity",
        "input[name='quantity']"
      ],
      "quantity"
    );

    const targetPriceField = findInput(
      form,
      [
        "#target-price",
        "#targetPrice",
        "#price",
        "input[name='target_price']",
        "input[name='targetPrice']",
        "input[name='price']"
      ],
      "target price"
    );

    const destinationField = findInput(
      form,
      [
        "#destination",
        "input[name='destination']"
      ],
      "destination"
    );

    console.log("CASEVO fields:", {
      requirement: requirementField,
      product: productField,
      quantity: quantityField,
      targetPrice: targetPriceField,
      destination: destinationField
    });

    /* ----------------------------------------------------------
       Find button
       ---------------------------------------------------------- */

    let submitButton = firstExisting(
      [
        "#analyze-button",
        "#analyzeButton",
        "#find-matches",
        "#findMatches",
        "#analyze",
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

    if (!submitButton) {
      console.warn(
        "CASEVO: analyze button was not found."
      );
    }

    /* ==========================================================
       RESULT CONTAINER
       ========================================================== */

    let resultContainer = qs(
      "#casevo-results"
    );

    if (!resultContainer) {
      resultContainer =
        document.createElement("div");

      resultContainer.id =
        "casevo-results";

      resultContainer.style.cssText = `
        width: 100%;
        box-sizing: border-box;
        margin-top: 32px;
      `;

      form.insertAdjacentElement(
        "afterend",
        resultContainer
      );
    }

    /* ==========================================================
       LOADING STATE
       ========================================================== */

    function setLoading(isLoading) {
      if (!submitButton) {
        return;
      }

      if (isLoading) {
        if (
          !submitButton.dataset.originalText
        ) {
          submitButton.dataset.originalText =
            submitButton.textContent ||
            "Analyze & Find Matches";
        }

        submitButton.disabled = true;
        submitButton.style.opacity = "0.65";
        submitButton.style.cursor = "wait";

        submitButton.textContent =
          "Analyzing...";
      } else {
        submitButton.disabled = false;
        submitButton.style.opacity = "";
        submitButton.style.cursor = "";

        submitButton.textContent =
          submitButton.dataset.originalText ||
          "Analyze & Find Matches";
      }
    }

    /* ==========================================================
       BUILD REQUIREMENT
       ========================================================== */

    function buildRequirement(
      rawRequirement,
      product,
      quantity,
      targetPrice,
      destination
    ) {
      const requirement =
        clean(rawRequirement);

      /*
       * PRIMARY:
       * Always preserve the actual textarea.
       */

      if (requirement) {
        return requirement;
      }

      /*
       * FALLBACK:
       * If textarea is empty, construct a sourcing
       * requirement from the other fields.
       */

      const parts = [];

      if (product) {
        parts.push(
          `Product / material: ${product}`
        );
      }

      if (quantity) {
        parts.push(
          `Quantity: ${quantity}`
        );
      }

      if (targetPrice) {
        parts.push(
          `Target price: ${targetPrice}`
        );
      }

      if (destination) {
        parts.push(
          `Destination: ${destination}`
        );
      }

      return clean(parts.join(". "));
    }

    /* ==========================================================
       COLLECT FORM DATA
       ========================================================== */

    function collectFormData() {
      const rawRequirement =
        requirementField
          ? requirementField.value
          : "";

      const product =
        productField
          ? productField.value
          : "";

      const quantity =
        quantityField
          ? quantityField.value
          : "";

      const targetPrice =
        targetPriceField
          ? targetPriceField.value
          : "";

      const destination =
        destinationField
          ? destinationField.value
          : "";

      const cleanRequirement =
        clean(rawRequirement);

      const cleanProduct =
        clean(product);

      const cleanQuantity =
        clean(quantity);

      const cleanTargetPrice =
        clean(targetPrice);

      const cleanDestination =
        clean(destination);

      /*
       * IMPORTANT:
       * This guarantees that requirement is NEVER
       * accidentally sent as an empty string when
       * the form contains useful information.
       */

      const finalRequirement =
        buildRequirement(
          cleanRequirement,
          cleanProduct,
          cleanQuantity,
          cleanTargetPrice,
          cleanDestination
        );

      return {
        requirement: finalRequirement,
        product: cleanProduct,
        quantity: cleanQuantity,
        targetPrice: cleanTargetPrice,
        destination: cleanDestination
      };
    }

    /* ==========================================================
       ERROR RENDERING
       ========================================================== */

    function renderError(message) {
      const safeMessage =
        escapeHtml(
          message ||
          "Unable to complete supplier discovery."
        );

      const requestId =
        "CASEVO-" +
        Math.random()
          .toString(36)
          .substring(2, 10)
          .toUpperCase();

      resultContainer.innerHTML = `
        <div style="
          border:1px solid #d84a3a;
          background:#fffaf7;
          padding:24px;
          box-sizing:border-box;
          color:#8f2f24;
          font-family:Arial,sans-serif;
        ">

          <div style="
            font-size:10px;
            letter-spacing:2px;
            text-transform:uppercase;
            margin-bottom:10px;
          ">
            CASEVO AI / ERROR
          </div>

          <div style="
            font-family:Georgia,serif;
            font-size:25px;
            line-height:1.15;
            color:#171513;
            margin-bottom:10px;
          ">
            Supplier discovery could not be completed.
          </div>

          <div style="
            font-size:14px;
            line-height:1.6;
          ">
            ${safeMessage}
          </div>

          <div style="
            margin-top:18px;
            font-size:10px;
            color:#8a8178;
          ">
            Request ID: ${requestId}
          </div>

        </div>
      `;

      resultContainer.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    /* ==========================================================
       INFO CARD
       ========================================================== */

    function infoCard(label, value) {
      return `
        <div style="
          background:#fffaf3;
          padding:18px;
          box-sizing:border-box;
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
            line-height:1.5;
          ">
            ${escapeHtml(
              value || "Not specified"
            )}
          </div>

        </div>
      `;
    }

    /* ==========================================================
       SUPPLIER MATCH CARD
       ========================================================== */

    function supplierCard(match, index) {
      const name =
        match.name ||
        match.company ||
        match.supplier ||
        `Supplier ${index + 1}`;

      const location =
        match.location ||
        match.country ||
        "China";

      const score =
        match.matchScore ??
        match.score ??
        match.match_score ??
        "—";

      const note =
        match.note ||
        match.description ||
        match.reason ||
        "";

      const website =
        match.website ||
        match.url ||
        "";

      return `
        <div style="
          background:#fffaf3;
          border:1px solid #ddd2c2;
          padding:20px;
          margin-bottom:12px;
          box-sizing:border-box;
        ">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:20px;
            flex-wrap:wrap;
          ">

            <div>

              <div style="
                font-size:17px;
                font-weight:600;
                color:#171513;
              ">
                ${escapeHtml(name)}
              </div>

              <div style="
                margin-top:5px;
                font-size:13px;
                color:#746d64;
              ">
                ${escapeHtml(location)}
              </div>

            </div>

            <div style="
              font-size:18px;
              font-weight:600;
            ">
              ${escapeHtml(score)}%
            </div>

          </div>

          ${
            note
              ? `
                <div style="
                  margin-top:14px;
                  color:#625c55;
                  font-size:13px;
                  line-height:1.6;
                ">
                  ${escapeHtml(note)}
                </div>
              `
              : ""
          }

          ${
            website
              ? `
                <div style="
                  margin-top:12px;
                ">
                  <a
                    href="${escapeHtml(website)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    style="
                      color:#a92f25;
                      font-size:12px;
                    "
                  >
                    View supplier source →
                  </a>
                </div>
              `
              : ""
          }

        </div>
      `;
    }

    /* ==========================================================
       RENDER SUCCESS RESULT
       ========================================================== */

    function renderResult(data) {
      const brief =
        data.brief || {};

      const analysis =
        data.analysis || {};

      const normalized =
        analysis.normalized || {};

      const scoring =
        analysis.scoring || {};

      let matches =
        analysis.matches ||
        data.matches ||
        [];

      if (!Array.isArray(matches)) {
        matches = [];
      }

      const requirements =
        Array.isArray(
          normalized.requirements
        )
          ? normalized.requirements
          : [];

      const tags =
        Array.isArray(normalized.tags)
          ? normalized.tags
          : [];

      const product =
        normalized.product ||
        brief.product ||
        "Sourcing Requirement";

      const quantity =
        normalized.quantity ||
        brief.quantity ||
        "Not specified";

      const targetPrice =
        normalized.targetPrice ||
        brief.targetPrice ||
        "Not specified";

      const destination =
        normalized.destination ||
        brief.destination ||
        "Not specified";

      const score =
        scoring.score ??
        data.score ??
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
                font-size:32px;
                line-height:1.15;
                font-weight:500;
                color:#171513;
              ">
                Real supplier
                <br>
                discovery completed.
              </h2>

              <div style="
                margin-top:12px;
                color:#665f57;
                font-size:13px;
              ">
                CASEVO supplier discovery completed successfully.
              </div>

            </div>

            <!-- SCORE -->

            <div style="
              border:1px solid #cdbfae;
              background:#fffaf3;
              padding:16px 22px;
              min-width:110px;
              text-align:center;
              box-sizing:border-box;
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
                  font-size:12px;
                  color:#777;
                ">
                  /100
                </span>
              </div>

            </div>

          </div>


          <!-- REQUIREMENT SUMMARY -->

          <div style="
            display:grid;
            grid-template-columns:
              repeat(auto-fit,minmax(180px,1fr));
            gap:1px;
            background:#d8cdbc;
            margin-bottom:32px;
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


          <!-- TWO COLUMN ANALYSIS -->

          <div style="
            display:grid;
            grid-template-columns:
              minmax(0,1.4fr)
              minmax(260px,.8fr);
            gap:28px;
          ">


            <!-- NORMALIZED REQUIREMENTS -->

            <div>

              <div style="
                color:#b42f24;
                font-size:10px;
                letter-spacing:2px;
                text-transform:uppercase;
                margin-bottom:10px;
              ">
                NORMALIZED REQUIREMENTS
              </div>

              <div style="
                background:#fffaf3;
                border:1px solid #ddd2c2;
                padding:22px;
                box-sizing:border-box;
              ">

                ${
                  requirements.length
                    ? requirements
                        .map(
                          function (
                            item,
                            index
                          ) {
                            return `
                              <div style="
                                display:flex;
                                gap:12px;
                                padding:10px 0;
                                border-bottom:
                                  1px solid #e7ded2;
                              ">

                                <span style="
                                  color:#b42f24;
                                  font-size:11px;
                                  min-width:20px;
                                ">
                                  ${String(
                                    index + 1
                                  ).padStart(
                                    2,
                                    "0"
                                  )}
                                </span>

                                <span style="
                                  font-size:13px;
                                  line-height:1.5;
                                ">
                                  ${escapeHtml(item)}
                                </span>

                              </div>
                            `;
                          }
                        )
                        .join("")
                    : `
                      <div style="
                        color:#777;
                        font-size:13px;
                      ">
                        The sourcing requirement was received successfully.
                      </div>
                    `
                }

              </div>


              ${
                tags.length
                  ? `
                    <div style="
                      display:flex;
                      gap:8px;
                      flex-wrap:wrap;
                      margin-top:16px;
                    ">

                      ${tags
                        .map(
                          function (tag) {
                            return `
                              <span style="
                                border:1px solid #cfc3b4;
                                background:#fffaf4;
                                padding:6px 10px;
                                font-size:10px;
                              ">
                                ${escapeHtml(tag)}
                              </span>
                            `;
                          }
                        )
                        .join("")}

                    </div>
                  `
                  : ""
              }

            </div>


            <!-- READINESS -->

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
                color:white;
                padding:24px;
                box-sizing:border-box;
              ">

                <div style="
                  display:flex;
                  justify-content:space-between;
                  gap:20px;
                  padding-bottom:16px;
                  margin-bottom:16px;
                  border-bottom:
                    1px solid #46423e;
                ">
                  <span>
                    Requirement clarity
                  </span>

                  <strong>
                    ${escapeHtml(clarity)}
                  </strong>
                </div>


                <div style="
                  display:flex;
                  justify-content:space-between;
                  gap:20px;
                  padding-bottom:16px;
                  margin-bottom:16px;
                  border-bottom:
                    1px solid #46423e;
                ">
                  <span>
                    Specification quality
                  </span>

                  <strong>
                    ${escapeHtml(
                      specification
                    )}
                  </strong>
                </div>


                <div style="
                  display:flex;
                  justify-content:space-between;
                  gap:20px;
                ">
                  <span>
                    Commercial readiness
                  </span>

                  <strong>
                    ${escapeHtml(commercial)}
                  </strong>
                </div>

              </div>


              ${
                note
                  ? `
                    <div style="
                      margin-top:14px;
                      color:#665f57;
                      font-size:12px;
                      line-height:1.6;
                    ">
                      ${escapeHtml(note)}
                    </div>
                  `
                  : ""
              }

            </div>

          </div>


          <!-- SUPPLIER MATCHES -->

          <div style="
            margin-top:36px;
            padding-top:28px;
            border-top:1px solid #d8cdbc;
          ">

            <div style="
              color:#b42f24;
              font-size:10px;
              letter-spacing:2px;
              text-transform:uppercase;
              margin-bottom:10px;
            ">
              REAL SUPPLIER MATCHES
            </div>


            ${
              matches.length
                ? `

                  <h3 style="
                    margin:0 0 18px 0;
                    font-family:Georgia,serif;
                    font-size:26px;
                    font-weight:500;
                  ">
                    Supplier matches
                    returned from
                    public-web discovery.
                  </h3>

                  ${matches
                    .map(
                      supplierCard
                    )
                    .join("")}

                `
                : `

                  <h3 style="
                    margin:0 0 18px 0;
                    font-family:Georgia,serif;
                    font-size:26px;
                    font-weight:500;
                  ">
                    No verified supplier
                    matches were returned.
                  </h3>

                  <div style="
                    background:#fffaf3;
                    border:1px solid #ddd2c2;
                    padding:22px;
                    color:#625c55;
                    font-size:13px;
                    line-height:1.7;
                    box-sizing:border-box;
                  ">

                    <strong style="
                      color:#171513;
                    ">
                      No verified supplier records were returned.
                    </strong>

                    <p style="
                      margin:12px 0 0 0;
                    ">
                      CASEVO completed the
                      public-web sourcing analysis,
                      but no verified supplier identity
                      was returned for this request.
                    </p>

                    <p style="
                      margin:12px 0 0 0;
                    ">
                      Supplier identities,
                      manufacturing capability,
                      certifications and commercial
                      contacts should be independently
                      verified before placing an order.
                    </p>

                  </div>

                `
            }

          </div>


          <!-- VERIFICATION NOTICE -->

          <div style="
            margin-top:28px;
            padding-top:22px;
            border-top:1px solid #d8cdbc;
            font-size:11px;
            line-height:1.65;
            color:#81786e;
          ">

            Verification notice:
            CASEVO public-web supplier discovery
            identifies potential supplier capabilities
            from publicly available information.
            Company identity, manufacturing capability,
            certifications, MOQ, production capacity
            and contact information should be
            independently verified before placing an order.

          </div>

        </div>
      `;

      resultContainer.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    /* ==========================================================
       SUBMIT REQUEST
       ========================================================== */

    async function submitSourcingRequest(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      const formData =
        collectFormData();

      console.log(
        "CASEVO form data:",
        formData
      );

      /*
       * CRITICAL VALIDATION
       *
       * Do NOT only check product.
       * The Worker expects requirement.
       */

      if (!formData.requirement) {
        renderError(
          "Please describe what you want to source before running the analysis."
        );

        if (requirementField) {
          requirementField.focus();
        }

        return;
      }

      /*
       * Show loading
       */

      setLoading(true);

      resultContainer.innerHTML = `
        <div style="
          background:#f7f1e6;
          border:1px solid #ded3c2;
          padding:36px;
          text-align:center;
          box-sizing:border-box;
          font-family:Arial,sans-serif;
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
            font-size:26px;
            line-height:1.2;
          ">
            Searching real suppliers...
          </div>

          <div style="
            margin-top:10px;
            color:#777;
            font-size:12px;
          ">
            CASEVO is analyzing the sourcing requirement
            and searching public supplier information.
          </div>

        </div>
      `;

      resultContainer.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      try {
        /*
         * IMPORTANT:
         * Explicitly construct the JSON payload.
         */

        const payload = {
          requirement: formData.requirement,
          product: formData.product,
          quantity: formData.quantity,
          targetPrice: formData.targetPrice,
          destination: formData.destination,
          source: "CASEVO website",
          timestamp:
            new Date().toISOString()
        };

        console.log(
          "CASEVO request payload:",
          payload
        );

        /*
         * Final safety check before fetch.
         */

        if (
          !payload.requirement ||
          !clean(payload.requirement)
        ) {
          throw new Error(
            "The sourcing requirement is empty."
          );
        }

        const response =
          await fetch(API_ENDPOINT, {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
              "Accept":
                "application/json"
            },

            body:
              JSON.stringify(payload)
          });

        /*
         * Read response as text first.
         * This prevents JSON parsing errors when
         * Cloudflare returns a plain-text error.
         */

        const rawText =
          await response.text();

        console.log(
          "CASEVO raw response:",
          rawText
        );

        let data;

        try {
          data =
            JSON.parse(rawText);
        } catch (parseError) {
          throw new Error(
            "CASEVO server returned an invalid response."
          );
        }

        console.log(
          "CASEVO parsed response:",
          data
        );

        /*
         * Worker error
         */

        if (
          !response.ok ||
          data.ok === false
        ) {
          throw new Error(
            data.error ||
            data.message ||
            "Supplier discovery failed."
          );
        }

        /*
         * SUCCESS
         */

        renderResult(data);

      } catch (error) {
        console.error(
          "CASEVO sourcing error:",
          error
        );

        renderError(
          error &&
          error.message
            ? error.message
            : "Unable to connect to CASEVO sourcing service."
        );

      } finally {
        setLoading(false);
      }
    }

    /* ==========================================================
       FORM EVENT
       ========================================================== */

    form.addEventListener(
      "submit",
      submitSourcingRequest
    );

    /*
     * IMPORTANT:
     *
     * We intentionally DO NOT call
     * form.submit() from the button click.
     *
     * Native form submit handles the request.
     */

    if (submitButton) {
      submitButton.addEventListener(
        "click",
        function () {
          /*
           * Intentionally empty.
           *
           * The form's submit event is the
           * single source of truth.
           */
        }
      );
    }

    /* ==========================================================
       PUBLIC CASEVO API
       ========================================================== */

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

        const requirement =
          clean(
            request.requirement
          );

        const product =
          clean(
            request.product
          );

        const quantity =
          clean(
            request.quantity
          );

        const targetPrice =
          clean(
            request.targetPrice
          );

        const destination =
          clean(
            request.destination
          );

        /*
         * Build requirement if caller
         * only supplied structured fields.
         */

        const finalRequirement =
          buildRequirement(
            requirement,
            product,
            quantity,
            targetPrice,
            destination
          );

        if (!finalRequirement) {
          return Promise.reject(
            new Error(
              "Please provide a sourcing requirement."
            )
          );
        }

        return fetch(
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
                finalRequirement,

              product:
                product,

              quantity:
                quantity,

              targetPrice:
                targetPrice,

              destination:
                destination,

              source:
                "CASEVO website",

              timestamp:
                new Date().toISOString()
            })
          }
        ).then(
          async function (response) {
            const rawText =
              await response.text();

            let data;

            try {
              data =
                JSON.parse(rawText);
            } catch (error) {
              throw new Error(
                "CASEVO server returned an invalid response."
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
          }
        );
      };

    console.log(
      "CASEVO AI Sourcing frontend initialized successfully."
    );

    console.log(
      "CASEVO requirement field:",
      requirementField
    );

    console.log(
      "CASEVO product field:",
      productField
    );

    console.log(
      "CASEVO quantity field:",
      quantityField
    );

    console.log(
      "CASEVO target price field:",
      targetPriceField
    );

    console.log(
      "CASEVO destination field:",
      destinationField
    );
  }

  /* ============================================================
     DOM READY
     ============================================================ */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initializeCASEVO
    );
  } else {
    initializeCASEVO();
  }

})();
