/* =========================================================
   CASEVO AI SOURCING — FINAL FRONTEND
   =========================================================

   CASEVO website frontend

   API:
     POST /api/sourcing

   Requirements:
     - No OpenAI API key required in browser
     - Works with Cloudflare Worker
     - Reads the actual submitted form
     - Supports flexible HTML field names
     - Prevents duplicate submissions
     - Handles JSON and non-JSON Worker responses
     - Does not invent supplier identities or contacts

   ========================================================= */

(function () {
  "use strict";

  const API_ENDPOINT = "/api/sourcing";

  const CASEVO = {
    initialized: false,
    submitting: false
  };

  console.log("CASEVO AI Sourcing frontend loaded.");
  console.log("CASEVO API endpoint:", API_ENDPOINT);

  /* =========================================================
     BASIC HELPERS
     ========================================================= */

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

  function elementText(element) {
    if (!element) return "";

    return clean(
      element.innerText ||
      element.textContent ||
      ""
    );
  }

  /* =========================================================
     FIND LABEL
     ========================================================= */

  function findFieldByLabel(root, labelKeywords) {
    if (!root) return null;

    const labels = qsa("label", root);

    for (const label of labels) {
      const text = elementText(label).toLowerCase();

      const matched = labelKeywords.some(function (keyword) {
        return text.includes(keyword.toLowerCase());
      });

      if (!matched) {
        continue;
      }

      const forId = label.getAttribute("for");

      if (forId) {
        const target = document.getElementById(forId);

        if (target) {
          return target;
        }
      }

      const parent = label.parentElement;

      if (parent) {
        const field = qs(
          "input, textarea, select",
          parent
        );

        if (field) {
          return field;
        }
      }

      let sibling = label.nextElementSibling;

      while (sibling) {
        if (
          sibling.matches &&
          sibling.matches("input, textarea, select")
        ) {
          return sibling;
        }

        const nested = qs(
          "input, textarea, select",
          sibling
        );

        if (nested) {
          return nested;
        }

        sibling = sibling.nextElementSibling;
      }
    }

    return null;
  }

  /* =========================================================
     FIND SOURCING FORM
     ========================================================= */

  function getAllForms() {
    return qsa("form");
  }

  function formLooksLikeSourcingForm(form) {
    if (!form) return false;

    const text = elementText(form).toLowerCase();

    const hasTextarea = !!qs("textarea", form);

    const hasAnalyzeButton = qsa(
      "button, input[type='submit']",
      form
    ).some(function (button) {
      const buttonText = (
        button.innerText ||
        button.textContent ||
        button.value ||
        ""
      )
        .toLowerCase()
        .trim();

      return (
        buttonText.includes("analyze") ||
        buttonText.includes("find matches") ||
        buttonText.includes("source") ||
        buttonText.includes("match")
      );
    });

    const hasSourcingText =
      text.includes("what are you sourcing") ||
      text.includes("product / material") ||
      text.includes("target price") ||
      text.includes("destination");

    return (
      (hasTextarea && hasAnalyzeButton) ||
      hasSourcingText
    );
  }

  function findSourcingForm() {
    const forms = getAllForms();

    if (!forms.length) {
      return null;
    }

    for (const form of forms) {
      if (formLooksLikeSourcingForm(form)) {
        return form;
      }
    }

    return forms[0];
  }

  /* =========================================================
     FIND TEXTAREA
     ========================================================= */

  function findRequirementField(form) {
    if (!form) return null;

    const direct = firstExisting(
      [
        "#requirement",
        "#requirements",
        "#sourcing-requirement",
        "#sourcingRequirement",
        "#sourcing_request",
        "#sourcingRequest",
        "#brief",
        "#sourcingBrief",
        "#request",
        "textarea[name='requirement']",
        "textarea[name='requirements']",
        "textarea[name='sourcing_requirement']",
        "textarea[name='sourcingRequest']",
        "textarea[name='request']",
        "textarea[name='brief']"
      ],
      form
    );

    if (direct) {
      return direct;
    }

    const byLabel = findFieldByLabel(
      form,
      [
        "what are you sourcing",
        "sourcing requirement",
        "sourcing request",
        "describe what you want",
        "what do you need"
      ]
    );

    if (byLabel) {
      return byLabel;
    }

    return qs("textarea", form);
  }

  /* =========================================================
     FIND INPUT FIELD
     ========================================================= */

  function findInputField(
    form,
    selectors,
    labelKeywords,
    fallbackIndex
  ) {
    if (!form) return null;

    const direct = firstExisting(
      selectors,
      form
    );

    if (direct) {
      return direct;
    }

    const byLabel = findFieldByLabel(
      form,
      labelKeywords
    );

    if (byLabel) {
      return byLabel;
    }

    const inputs = qsa(
      "input:not([type='hidden']):not([type='submit']):not([type='button']), select",
      form
    );

    if (
      typeof fallbackIndex === "number" &&
      inputs[fallbackIndex]
    ) {
      return inputs[fallbackIndex];
    }

    return null;
  }

  /* =========================================================
     FIND PRODUCT / MATERIAL
     ========================================================= */

  function findProductField(form) {
    return findInputField(
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
      [
        "product / material",
        "product",
        "material"
      ],
      0
    );
  }

  /* =========================================================
     FIND QUANTITY
     ========================================================= */

  function findQuantityField(form) {
    return findInputField(
      form,
      [
        "#quantity",
        "#qty",
        "#volume",
        "#order-quantity",
        "#orderQuantity",
        "input[name='quantity']",
        "input[name='qty']",
        "input[name='volume']",
        "input[name='order_quantity']"
      ],
      [
        "quantity",
        "order quantity",
        "volume"
      ],
      1
    );
  }

  /* =========================================================
     FIND TARGET PRICE
     ========================================================= */

  function findPriceField(form) {
    return findInputField(
      form,
      [
        "#target-price",
        "#targetPrice",
        "#price",
        "input[name='target_price']",
        "input[name='targetPrice']",
        "input[name='price']"
      ],
      [
        "target price",
        "price"
      ],
      2
    );
  }

  /* =========================================================
     FIND DESTINATION
     ========================================================= */

  function findDestinationField(form) {
    return findInputField(
      form,
      [
        "#destination",
        "#market",
        "#country",
        "input[name='destination']",
        "input[name='market']",
        "input[name='country']",
        "select[name='destination']",
        "select[name='country']"
      ],
      [
        "destination",
        "shipping destination",
        "destination market",
        "country",
        "market"
      ],
      3
    );
  }

  /* =========================================================
     FIND ANALYZE BUTTON
     ========================================================= */

  function findAnalyzeButton(form) {
    if (!form) return null;

    const buttons = qsa(
      "button, input[type='submit'], input[type='button']",
      form
    );

    for (const button of buttons) {
      const text = (
        button.innerText ||
        button.textContent ||
        button.value ||
        ""
      )
        .toLowerCase()
        .trim();

      if (
        text.includes("analyze") ||
        text.includes("find matches") ||
        text.includes("analyse") ||
        text.includes("match")
      ) {
        return button;
      }
    }

    return null;
  }

  /* =========================================================
     COLLECT VALUES
     ========================================================= */

  function collectValues(form) {
    const requirementField =
      findRequirementField(form);

    const productField =
      findProductField(form);

    const quantityField =
      findQuantityField(form);

    const priceField =
      findPriceField(form);

    const destinationField =
      findDestinationField(form);

    const values = {
      requirement: clean(
        requirementField
          ? requirementField.value
          : ""
      ),

      product: clean(
        productField
          ? productField.value
          : ""
      ),

      quantity: clean(
        quantityField
          ? quantityField.value
          : ""
      ),

      targetPrice: clean(
        priceField
          ? priceField.value
          : ""
      ),

      destination: clean(
        destinationField
          ? destinationField.value
          : ""
      )
    };

    console.log(
      "CASEVO: collected form values",
      values
    );

    return values;
  }

  /* =========================================================
     VALIDATION
     ========================================================= */

  function validate(values) {
    /*
      Important:
      The large sourcing textarea is the primary field.

      Product / quantity / price / destination
      may be empty because the user can describe
      everything inside the main sourcing request.
    */

    if (!values.requirement) {
      return {
        valid: false,
        message:
          "Please describe what you want to source before running the analysis."
      };
    }

    if (values.requirement.length < 8) {
      return {
        valid: false,
        message:
          "Please provide a little more detail about your sourcing requirement."
      };
    }

    return {
      valid: true,
      message: ""
    };
  }

  /* =========================================================
     FIND RESULT CONTAINER
     ========================================================= */

  function findResultContainer(form) {
    /*
      Prefer a result area belonging to the current form.
    */

    if (form) {
      const local = firstExisting(
        [
          "[data-casevo-results]",
          "#casevo-results",
          ".casevo-results"
        ],
        form
      );

      if (local) {
        return local;
      }
    }

    /*
      Global existing result area.
    */

    const global = firstExisting([
      "[data-casevo-results]",
      "#casevo-results",
      ".casevo-results"
    ]);

    if (global) {
      return global;
    }

    /*
      Create a new one.
    */

    const container =
      document.createElement("div");

    container.id = "casevo-results";

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

  /* =========================================================
     FIND STATUS AREA
     ========================================================= */

  function findStatusArea(form) {
    if (!form) return null;

    const existing = firstExisting(
      [
        "[data-casevo-status]",
        "#casevo-status",
        ".casevo-status",
        ".sourcing-status",
        ".form-status",
        ".casevo-runtime-status"
      ],
      form
    );

    if (existing) {
      return existing;
    }

    const button = findAnalyzeButton(form);

    if (
      button &&
      button.parentElement
    ) {
      const status =
        document.createElement("div");

      status.className =
        "casevo-runtime-status";

      status.style.cssText = `
        display:none;
        margin-top:14px;
        padding:12px 14px;
        border:1px solid rgba(0,0,0,.15);
        font-size:13px;
        line-height:1.5;
        box-sizing:border-box;
      `;

      button.parentElement.appendChild(
        status
      );

      return status;
    }

    return null;
  }

  /* =========================================================
     SHOW STATUS
     ========================================================= */

  function showStatus(
    form,
    message,
    type
  ) {
    const status =
      findStatusArea(form);

    if (!status) {
      console.log(
        "CASEVO STATUS:",
        message
      );

      return;
    }

    status.style.display = "block";

    status.style.background =
      type === "error"
        ? "#fff8f6"
        : type === "success"
        ? "#f4faf6"
        : "#faf7f1";

    status.style.color =
      type === "error"
        ? "#8f2f24"
        : "#33302c";

    status.style.borderColor =
      type === "error"
        ? "rgba(180,40,30,.35)"
        : type === "success"
        ? "rgba(30,100,70,.35)"
        : "rgba(0,0,0,.15)";

    status.textContent = message;
  }

  /* =========================================================
     LOADING BUTTON
     ========================================================= */

  function setButtonLoading(
    button,
    loading
  ) {
    if (!button) return;

    if (loading) {
      if (!button.dataset.casevoOriginalText) {
        button.dataset.casevoOriginalText =
          button.innerText ||
          button.textContent ||
          button.value ||
          "Analyze & Find Matches";
      }

      button.disabled = true;

      button.style.opacity = "0.7";
      button.style.cursor = "wait";

      if (
        button.tagName.toLowerCase() ===
        "input"
      ) {
        button.value = "Analyzing...";
      } else {
        button.innerText =
          "Analyzing...";
      }

      return;
    }

    button.disabled = false;

    button.style.opacity = "";
    button.style.cursor = "";

    const original =
      button.dataset.casevoOriginalText ||
      "Analyze & Find Matches";

    if (
      button.tagName.toLowerCase() ===
      "input"
    ) {
      button.value = original;
    } else {
      button.innerText = original;
    }
  }

  /* =========================================================
     LOADING RESULT
     ========================================================= */

  function renderLoading(
    container
  ) {
    if (!container) return;

    container.innerHTML = `
      <div style="
        background:#f7f1e6;
        border:1px solid #ded3c2;
        padding:32px;
        box-sizing:border-box;
        text-align:center;
        color:#625b53;
        font-family:Arial,sans-serif;
      ">

        <div style="
          color:#b42f24;
          font-size:11px;
          letter-spacing:2px;
          text-transform:uppercase;
          margin-bottom:12px;
        ">
          CASEVO AI
        </div>

        <div style="
          font-family:Georgia,serif;
          font-size:25px;
          line-height:1.3;
        ">
          Analyzing your sourcing requirement...
        </div>

        <div style="
          margin-top:10px;
          font-size:13px;
          color:#777;
        ">
          Structuring specifications and checking supplier capabilities.
        </div>

      </div>
    `;
  }

  /* =========================================================
     ERROR RESULT
     ========================================================= */

  function renderError(
    container,
    message
  ) {
    if (!container) return;

    container.innerHTML = `
      <div style="
        background:#fff8f6;
        border:1px solid #d99a8e;
        padding:28px;
        box-sizing:border-box;
        font-family:Arial,sans-serif;
        color:#8f2f24;
      ">

        <div style="
          font-size:11px;
          letter-spacing:2px;
          text-transform:uppercase;
          margin-bottom:10px;
        ">
          CASEVO AI / ERROR
        </div>

        <h3 style="
          margin:0 0 12px;
          font-family:Georgia,serif;
          font-size:25px;
          font-weight:500;
          color:#8f2f24;
        ">
          Supplier discovery could not be completed.
        </h3>

        <div style="
          font-size:14px;
          line-height:1.6;
          color:#63342e;
        ">
          ${escapeHtml(message)}
        </div>

      </div>
    `;

    try {
      container.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      // Ignore browser scroll errors.
    }
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
        box-sizing:border-box;
      ">

        <div style="
          font-size:9px;
          letter-spacing:1.5px;
          color:#81786e;
          margin-bottom:8px;
          text-transform:uppercase;
        ">
          ${escapeHtml(label)}
        </div>

        <div style="
          font-size:14px;
          line-height:1.45;
          color:#1d1b18;
        ">
          ${escapeHtml(
            value || "Not specified"
          )}
        </div>

      </div>
    `;
  }

  /* =========================================================
     NORMALIZED REQUIREMENTS
     ========================================================= */

  function renderRequirements(
    normalized
  ) {
    const requirements =
      Array.isArray(
        normalized.requirements
      )
        ? normalized.requirements
        : [];

    if (!requirements.length) {
      return `
        <div style="
          background:#fffaf3;
          border:1px solid #ddd2c2;
          padding:20px;
          color:#777;
          line-height:1.6;
        ">
          No additional detailed specifications were detected.
        </div>
      `;
    }

    return `
      <div style="
        background:#fffaf3;
        border:1px solid #ddd2c2;
        padding:20px;
        box-sizing:border-box;
      ">

        ${requirements
          .map(function (item, index) {
            return `
              <div style="
                display:flex;
                gap:12px;
                padding:11px 0;
                border-bottom:${
                  index ===
                  requirements.length - 1
                    ? "none"
                    : "1px solid #e7ded2"
                };
              ">

                <span style="
                  color:#b42f24;
                  min-width:22px;
                  font-size:11px;
                  padding-top:2px;
                ">
                  ${String(
                    index + 1
                  ).padStart(2, "0")}
                </span>

                <span style="
                  font-size:14px;
                  line-height:1.5;
                ">
                  ${escapeHtml(item)}
                </span>

              </div>
            `;
          })
          .join("")}

      </div>
    `;
  }

  /* =========================================================
     SUPPLIER MATCHES
     ========================================================= */

  function renderMatches(
    matches
  ) {
    if (
      !Array.isArray(matches) ||
      !matches.length
    ) {
      return `
        <div style="
          background:#fffaf3;
          border:1px solid #ddd2c2;
          padding:22px;
          color:#665f57;
          line-height:1.6;
          font-size:14px;
        ">

          <strong style="
            display:block;
            margin-bottom:10px;
            color:#1d1b18;
          ">
            No verified supplier records were returned.
          </strong>

          CASEVO completed the public-web sourcing analysis,
          but no verified supplier identity was returned for
          this request.

          <div style="
            margin-top:14px;
            font-size:13px;
            color:#777;
          ">
            Supplier identities, manufacturing capability,
            certifications and commercial contacts should be
            independently verified before placing an order.
          </div>

        </div>
      `;
    }

    return matches
      .map(function (match, index) {
        const name =
          match.name ||
          match.company ||
          `Supplier Profile ${index + 1}`;

        const location =
          match.location ||
          match.country ||
          "China";

        const score =
          match.matchScore ??
          match.score ??
          "—";

        const note =
          match.note ||
          match.capability ||
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
                  color:#1d1b18;
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
                font-size:16px;
                font-weight:600;
                color:#b42f24;
              ">
                ${escapeHtml(score)}%
              </div>

            </div>

            ${
              note
                ? `
                  <div style="
                    margin-top:13px;
                    padding-top:12px;
                    border-top:1px solid #e7ded2;
                    color:#625c55;
                    font-size:13px;
                    line-height:1.55;
                  ">
                    ${escapeHtml(note)}
                  </div>
                `
                : ""
            }

          </div>
        `;
      })
      .join("");
  }

  /* =========================================================
     RENDER SUCCESS RESULT
     ========================================================= */

  function renderResult(
    form,
    data
  ) {
    console.log(
      "CASEVO: rendering result",
      data
    );

    const container =
      findResultContainer(form);

    if (!container) {
      console.error(
        "CASEVO: result container could not be created."
      );

      return;
    }

    const brief =
      data.brief || {};

    const analysis =
      data.analysis || {};

    const normalized =
      analysis.normalized || {};

    const scoring =
      analysis.scoring || {};

    const matches =
      Array.isArray(analysis.matches)
        ? analysis.matches
        : Array.isArray(data.matches)
        ? data.matches
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
      "—";

    const commercial =
      scoring.commercial ??
      "—";

    const note =
      scoring.note ||
      "The sourcing requirement has been structured and is ready for supplier verification.";

    const tags =
      Array.isArray(normalized.tags)
        ? normalized.tags
        : [];

    container.innerHTML = `

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
              line-height:1.15;
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
            min-width:125px;
            border:1px solid #cdbfae;
            background:#fffaf2;
            padding:16px 20px;
            text-align:center;
            box-sizing:border-box;
          ">

            <div style="
              color:#81786e;
              font-size:9px;
              letter-spacing:1.5px;
              text-transform:uppercase;
              margin-bottom:7px;
            ">
              CASEVO SCORE
            </div>

            <div style="
              font-size:30px;
              font-weight:600;
            ">
              ${escapeHtml(score)}
              <span style="
                font-size:13px;
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

        <!-- MAIN ANALYSIS -->

        <div style="
          display:grid;
          grid-template-columns:
            minmax(0,1.4fr)
            minmax(280px,.8fr);
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

            ${renderRequirements(
              normalized
            )}

            ${
              tags.length
                ? `
                  <div style="
                    display:flex;
                    flex-wrap:wrap;
                    gap:7px;
                    margin-top:15px;
                  ">

                    ${tags
                      .map(function (tag) {
                        return `
                          <span style="
                            border:1px solid #cfc3b4;
                            background:#fffaf4;
                            padding:6px 10px;
                            font-size:10px;
                            letter-spacing:.5px;
                          ">
                            ${escapeHtml(tag)}
                          </span>
                        `;
                      })
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
              color:#fff;
              padding:24px;
              box-sizing:border-box;
            ">

              <div style="
                display:flex;
                justify-content:space-between;
                gap:15px;
                margin-bottom:18px;
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
                gap:15px;
                margin-bottom:18px;
              ">
                <span>
                  Specification quality
                </span>

                <strong>
                  ${escapeHtml(specification)}
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
                  ${escapeHtml(commercial)}
                </strong>
              </div>

            </div>

            <div style="
              margin-top:14px;
              font-size:13px;
              line-height:1.6;
              color:#665f57;
            ">
              ${escapeHtml(note)}
            </div>

          </div>

        </div>

        <!-- SUPPLIER MATCHING -->

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

          <div style="
            font-family:Georgia,serif;
            font-size:27px;
            line-height:1.2;
            margin-bottom:18px;
          ">
            ${
              matches.length
                ? "Potential suppliers found on the public web."
                : "No verified supplier matches were returned."
            }
          </div>

          ${renderMatches(
            matches
          )}

        </div>

        <!-- VERIFICATION NOTICE -->

        <div style="
          margin-top:30px;
          padding-top:24px;
          border-top:1px solid #d8cdbc;
          font-size:11px;
          line-height:1.65;
          color:#81786e;
        ">

          <strong style="
            color:#625c55;
          ">
            Verification notice:
          </strong>

          CASEVO public-web supplier discovery identifies
          potential supplier capabilities from public information.
          Company identity, manufacturing capability,
          certifications, pricing, MOQ, production capacity and
          contact information should be independently verified
          before placing an order.

        </div>

        ${
          data.requestId
            ? `
              <div style="
                margin-top:18px;
                font-size:10px;
                color:#91887d;
              ">
                Request ID:
                ${escapeHtml(
                  data.requestId
                )}
              </div>
            `
            : ""
        }

      </div>
    `;

    try {
      container.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      // Ignore scroll errors.
    }
  }

  /* =========================================================
     API REQUEST
     ========================================================= */

  async function sendToWorker(
    values
  ) {
    console.log(
      "CASEVO: POST",
      API_ENDPOINT
    );

    const payload = {
      requirement:
        values.requirement || "",

      product:
        values.product || "",

      quantity:
        values.quantity || "",

      targetPrice:
        values.targetPrice || "",

      destination:
        values.destination || "",

      source:
        "CASEVO website",

      timestamp:
        new Date().toISOString()
    };

    console.log(
      "CASEVO: request payload",
      payload
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

          body:
            JSON.stringify(payload)
        }
      );

    console.log(
      "CASEVO: HTTP status",
      response.status
    );

    const rawText =
      await response.text();

    console.log(
      "CASEVO: raw response",
      rawText
    );

    let data = null;

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
        (
          "CASEVO Worker request failed with HTTP " +
          response.status
        )
      );
    }

    return data;
  }

  /* =========================================================
     HANDLE FORM SUBMIT
     ========================================================= */

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    /*
      CRITICAL FIX:

      Always use event.currentTarget.

      This means the fields are collected from
      the form that was actually submitted,
      rather than from a globally selected form.
    */

    const form =
      event.currentTarget;

    if (!form) {
      return;
    }

    if (CASEVO.submitting) {
      console.log(
        "CASEVO: submission already running."
      );

      return;
    }

    const button =
      findAnalyzeButton(form);

    const values =
      collectValues(form);

    console.log(
      "CASEVO: submitting values",
      values
    );

    const validation =
      validate(values);

    if (!validation.valid) {
      showStatus(
        form,
        validation.message,
        "error"
      );

      const requirementField =
        findRequirementField(form);

      if (requirementField) {
        requirementField.focus();
      }

      return;
    }

    CASEVO.submitting = true;

    setButtonLoading(
      button,
      true
    );

    showStatus(
      form,
      "Connecting to CASEVO sourcing engine...",
      "loading"
    );

    const resultContainer =
      findResultContainer(form);

    renderLoading(
      resultContainer
    );

    try {
      const data =
        await sendToWorker(
          values
        );

      console.log(
        "CASEVO: Worker success",
        data
      );

      showStatus(
        form,
        "Sourcing analysis completed.",
        "success"
      );

      renderResult(
        form,
        data
      );

    } catch (error) {
      console.error(
        "CASEVO: sourcing request failed",
        error
      );

      const message =
        error &&
        error.message
          ? error.message
          : "Unable to connect to the CASEVO sourcing engine.";

      showStatus(
        form,
        message,
        "error"
      );

      renderError(
        resultContainer,
        message
      );

    } finally {
      CASEVO.submitting = false;

      setButtonLoading(
        button,
        false
      );
    }
  }

  /* =========================================================
     BUTTON FALLBACK
     ========================================================= */

  function handleButtonFallback(
    event
  ) {
    const button =
      event.currentTarget;

    if (!button) {
      return;
    }

    /*
      If the button is inside a normal form,
      the submit event handles everything.
    */

    const form =
      button.closest("form");

    if (form) {
      return;
    }

    /*
      Fallback for pages where the button
      is not technically inside a form.
    */

    event.preventDefault();

    console.log(
      "CASEVO: analyze button is outside a form."
    );

    const pseudoForm =
      button.closest(
        "section, article, main, div"
      );

    if (!pseudoForm) {
      console.warn(
        "CASEVO: Could not locate sourcing container."
      );

      return;
    }

    const requirementField =
      firstExisting(
        [
          "#requirement",
          "#requirements",
          "#sourcing-requirement",
          "#sourcingRequirement",
          "#brief",
          "textarea"
        ],
        pseudoForm
      );

    const productField =
      firstExisting(
        [
          "#product",
          "#product-material",
          "#productMaterial",
          "#material",
          "input[name='product']",
          "input[name='material']"
        ],
        pseudoForm
      );

    const quantityField =
      firstExisting(
        [
          "#quantity",
          "#qty",
          "input[name='quantity']"
        ],
        pseudoForm
      );

    const priceField =
      firstExisting(
        [
          "#target-price",
          "#targetPrice",
          "#price",
          "input[name='target_price']",
          "input[name='price']"
        ],
        pseudoForm
      );

    const destinationField =
      firstExisting(
        [
          "#destination",
          "#market",
          "#country",
          "input[name='destination']",
          "input[name='country']"
        ],
        pseudoForm
      );

    const values = {
      requirement: clean(
        requirementField
          ? requirementField.value
          : ""
      ),

      product: clean(
        productField
          ? productField.value
          : ""
      ),

      quantity: clean(
        quantityField
          ? quantityField.value
          : ""
      ),

      targetPrice: clean(
        priceField
          ? priceField.value
          : ""
      ),

      destination: clean(
        destinationField
          ? destinationField.value
          : ""
      )
    };

    const validation =
      validate(values);

    if (!validation.valid) {
      alert(
        validation.message
      );

      return;
    }

    const fakeEvent = {
      preventDefault: function () {},

      currentTarget: {
        querySelector: function () {
          return null;
        },

        querySelectorAll: function () {
          return [];
        }
      }
    };

    /*
      Use a temporary hidden form only
      for fallback mode.
    */

    const temporaryForm =
      document.createElement("form");

    temporaryForm.style.display =
      "none";

    document.body.appendChild(
      temporaryForm
    );

    const hiddenRequirement =
      document.createElement(
        "textarea"
      );

    hiddenRequirement.name =
      "requirement";

    hiddenRequirement.value =
      values.requirement;

    temporaryForm.appendChild(
      hiddenRequirement
    );

    const hiddenProduct =
      document.createElement(
        "input"
      );

    hiddenProduct.name =
      "product";

    hiddenProduct.value =
      values.product;

    temporaryForm.appendChild(
      hiddenProduct
    );

    const hiddenQuantity =
      document.createElement(
        "input"
      );

    hiddenQuantity.name =
      "quantity";

    hiddenQuantity.value =
      values.quantity;

    temporaryForm.appendChild(
      hiddenQuantity
    );

    const hiddenPrice =
      document.createElement(
        "input"
      );

    hiddenPrice.name =
      "target_price";

    hiddenPrice.value =
      values.targetPrice;

    temporaryForm.appendChild(
      hiddenPrice
    );

    const hiddenDestination =
      document.createElement(
        "input"
      );

    hiddenDestination.name =
      "destination";

    hiddenDestination.value =
      values.destination;

    temporaryForm.appendChild(
      hiddenDestination
    );

    temporaryForm.appendChild(
      button.cloneNode(true)
    );

    temporaryForm.addEventListener(
      "submit",
      handleSubmit,
      { once: true }
    );

    temporaryForm
      .querySelector("button, input[type='submit']")
      ?.click();

    setTimeout(function () {
      temporaryForm.remove();
    }, 10000);
  }

  /* =========================================================
     INITIALIZE ONE FORM
     ========================================================= */

  function initializeForm(
    form
  ) {
    if (!form) {
      return;
    }

    if (
      form.dataset.casevoInitialized ===
      "true"
    ) {
      return;
    }

    const button =
      findAnalyzeButton(form);

    const textarea =
      findRequirementField(form);

    console.log(
      "CASEVO: initializing form",
      {
        form: form,
        textarea: textarea,
        button: button
      }
    );

    /*
      Only initialize forms that look like
      the CASEVO sourcing form.
    */

    if (
      !textarea &&
      !button
    ) {
      return;
    }

    form.dataset.casevoInitialized =
      "true";

    form.addEventListener(
      "submit",
      handleSubmit
    );

    /*
      Do not submit twice here.
      Native form submit will trigger handleSubmit.
    */

    console.log(
      "CASEVO: sourcing form initialized."
    );
  }

  /* =========================================================
     INITIALIZE BUTTONS OUTSIDE FORMS
     ========================================================= */

  function initializeStandaloneButtons() {
    const buttons =
      qsa(
        "button, input[type='submit'], input[type='button']"
      );

    buttons.forEach(function (button) {
      if (
        button.dataset.casevoButtonInitialized ===
        "true"
      ) {
        return;
      }

      const text = (
        button.innerText ||
        button.textContent ||
        button.value ||
        ""
      )
        .toLowerCase()
        .trim();

      const looksLikeAnalyze =
        text.includes("analyze") ||
        text.includes("find matches") ||
        text.includes("analyse");

      if (!looksLikeAnalyze) {
        return;
      }

      if (
        button.closest("form")
      ) {
        return;
      }

      button.dataset.casevoButtonInitialized =
        "true";

      button.addEventListener(
        "click",
        handleButtonFallback
      );

      console.log(
        "CASEVO: standalone analyze button initialized."
      );
    });
  }

  /* =========================================================
     INITIALIZE
     ========================================================= */

  function initialize() {
    if (CASEVO.initialized) {
      return;
    }

    CASEVO.initialized = true;

    console.log(
      "CASEVO: initializing frontend..."
    );

    const forms =
      getAllForms();

    console.log(
      "CASEVO: forms found:",
      forms.length
    );

    forms.forEach(
      initializeForm
    );

    initializeStandaloneButtons();

    /*
      Debug information.
    */

    const sourcingForm =
      findSourcingForm();

    if (sourcingForm) {
      console.log(
        "CASEVO: primary sourcing form detected.",
        {
          requirement:
            findRequirementField(
              sourcingForm
            ),

          product:
            findProductField(
              sourcingForm
            ),

          quantity:
            findQuantityField(
              sourcingForm
            ),

          targetPrice:
            findPriceField(
              sourcingForm
            ),

          destination:
            findDestinationField(
              sourcingForm
            ),

          button:
            findAnalyzeButton(
              sourcingForm
            )
        }
      );
    } else {
      console.warn(
        "CASEVO: no sourcing form detected."
      );
    }

    console.log(
      "CASEVO AI Sourcing frontend ready."
    );
  }

  /* =========================================================
     DOM READY
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
     PUBLIC API
     ========================================================= */

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

      return sendToWorker({
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
            request.targetPrice
          ),

        destination:
          clean(
            request.destination
          )
      });
    };

  console.log(
    "CASEVO: public API available as window.CASEVO.analyze()."
  );

})();
