/* =========================================================
   CASEVO AI SOURCING — FRONTEND
   No OpenAI API key required.
   Sends sourcing requirements to /api/sourcing
   ========================================================= */

(function () {
  "use strict";

  const API_ENDPOINT = "/api/sourcing";

  // ---------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value ?? "")
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

  function findInputByLabel(labelText) {
    const labels = qsa("label");

    const target = labels.find((label) =>
      label.textContent
        .trim()
        .toLowerCase()
        .includes(labelText.toLowerCase())
    );

    if (!target) return null;

    const forId = target.getAttribute("for");

    if (forId) {
      return document.getElementById(forId);
    }

    return target.parentElement
      ? target.parentElement.querySelector("input, textarea, select")
      : null;
  }

  function getField(selectors, labelText) {
    return firstExisting(selectors) || findInputByLabel(labelText);
  }

  // ---------------------------------------------------------
  // Locate CASEVO sourcing form
  // ---------------------------------------------------------

  function locateForm() {
    const directForm = firstExisting([
      "#sourcing-form",
      "#sourcingForm",
      "#ai-sourcing-form",
      "#aiSourcingForm",
      "form[data-sourcing-form]",
      "form"
    ]);

    return directForm;
  }

  const form = locateForm();

  if (!form) {
    console.warn("CASEVO: sourcing form not found.");
    return;
  }

  // ---------------------------------------------------------
  // Locate fields
  // ---------------------------------------------------------

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
    "what are you sourcing"
  );

  const productField = getField(
    [
      "#product",
      "#product-material",
      "#productMaterial",
      "input[name='product']",
      "input[name='product_material']"
    ],
    "product / material"
  );

  const quantityField = getField(
    [
      "#quantity",
      "input[name='quantity']"
    ],
    "quantity"
  );

  const priceField = getField(
    [
      "#target-price",
      "#targetPrice",
      "#price",
      "input[name='target_price']",
      "input[name='price']"
    ],
    "target price"
  );

  const destinationField = getField(
    [
      "#destination",
      "input[name='destination']"
    ],
    "destination"
  );

  // ---------------------------------------------------------
  // Find submit button
  // ---------------------------------------------------------

  let submitButton = firstExisting([
    "#analyze-button",
    "#analyzeButton",
    "#find-matches",
    "#findMatches",
    "button[type='submit']"
  ], form);

  if (!submitButton) {
    submitButton = qsa("button", form).find((button) =>
      /analy|match|source|find/i.test(button.textContent)
    );
  }

  // ---------------------------------------------------------
  // Create result area
  // ---------------------------------------------------------

  let resultContainer = qs("#casevo-results");

  if (!resultContainer) {
    resultContainer = document.createElement("div");
    resultContainer.id = "casevo-results";

    resultContainer.style.cssText = `
      margin-top: 32px;
      width: 100%;
      box-sizing: border-box;
    `;

    form.insertAdjacentElement("afterend", resultContainer);
  }

  // ---------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------

  function setLoading(loading) {
    if (!submitButton) return;

    if (loading) {
      submitButton.dataset.originalText =
        submitButton.textContent || "Analyze & Find Matches";

      submitButton.disabled = true;
      submitButton.style.opacity = "0.65";
      submitButton.style.cursor = "wait";

      submitButton.textContent = "Analyzing sourcing requirement...";
    } else {
      submitButton.disabled = false;
      submitButton.style.opacity = "";
      submitButton.style.cursor = "";

      submitButton.textContent =
        submitButton.dataset.originalText ||
        "Analyze & Find Matches";
    }
  }

  // ---------------------------------------------------------
  // Result rendering
  // ---------------------------------------------------------

  function renderError(message) {
    resultContainer.innerHTML = `
      <div style="
        border:1px solid #e3c9c2;
        background:#fff8f6;
        padding:24px;
        color:#8f2f24;
        font-family:Arial,sans-serif;
      ">
        <div style="
          font-size:12px;
          letter-spacing:2px;
          text-transform:uppercase;
          margin-bottom:10px;
        ">
          CASEVO / ERROR
        </div>

        <div style="
          font-size:18px;
          line-height:1.5;
        ">
          ${escapeHtml(message)}
        </div>
      </div>
    `;

    resultContainer.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function renderResult(data) {
    const brief = data.brief || {};
    const analysis = data.analysis || {};
    const normalized = analysis.normalized || {};
    const scoring = analysis.scoring || {};
    const matches = analysis.matches || [];

    const requirements = Array.isArray(normalized.requirements)
      ? normalized.requirements
      : [];

    const tags = Array.isArray(normalized.tags)
      ? normalized.tags
      : [];

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
          display:flex;
          justify-content:space-between;
          gap:20px;
          align-items:flex-start;
          margin-bottom:30px;
          flex-wrap:wrap;
        ">

          <div>
            <div style="
              color:#b42f24;
              font-size:11px;
              letter-spacing:2px;
              text-transform:uppercase;
              margin-bottom:10px;
            ">
              CASEVO AI / SOURCING BRIEF
            </div>

            <h2 style="
              margin:0;
              font-family:Georgia,serif;
              font-size:32px;
              font-weight:500;
            ">
              ${escapeHtml(
                normalized.product || brief.product || "Sourcing Requirement"
              )}
            </h2>
          </div>

          <div style="
            border:1px solid #cdbfae;
            padding:14px 20px;
            min-width:150px;
            text-align:center;
            background:#fffaf2;
          ">
            <div style="
              font-size:10px;
              letter-spacing:1.5px;
              text-transform:uppercase;
              color:#756d63;
              margin-bottom:5px;
            ">
              CASEVO SCORE
            </div>

            <div style="
              font-size:30px;
              font-weight:600;
            ">
              ${escapeHtml(scoring.score ?? "—")}
              <span style="font-size:14px;color:#777;">/100</span>
            </div>
          </div>

        </div>

        <div style="
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
          gap:1px;
          background:#d8cdbc;
          margin-bottom:30px;
        ">

          ${infoCard(
            "PRODUCT / MATERIAL",
            normalized.product || brief.product || "Not specified"
          )}

          ${infoCard(
            "QUANTITY",
            normalized.quantity || brief.quantity || "Not specified"
          )}

          ${infoCard(
            "TARGET PRICE",
            normalized.targetPrice || brief.targetPrice || "Not specified"
          )}

          ${infoCard(
            "DESTINATION",
            normalized.destination || brief.destination || "Not specified"
          )}

        </div>

        <div style="
          display:grid;
          grid-template-columns:minmax(0,1.4fr) minmax(280px,0.8fr);
          gap:28px;
        ">

          <div>

            <div style="
              font-size:11px;
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
              padding:22px;
            ">

              ${
                requirements.length
                  ? requirements
                      .map(
                        (item) => `
                          <div style="
                            display:flex;
                            gap:12px;
                            padding:10px 0;
                            border-bottom:1px solid #e7ded2;
                          ">
                            <span style="color:#b42f24;">01</span>
                            <span>${escapeHtml(item)}</span>
                          </div>
                        `
                      )
                      .join("")
                  : `
                    <div style="color:#777;">
                      No detailed specifications were detected.
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
                        (tag) => `
                          <span style="
                            border:1px solid #cfc3b4;
                            padding:6px 10px;
                            font-size:11px;
                            letter-spacing:.5px;
                            background:#fffaf4;
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

          <div>

            <div style="
              font-size:11px;
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
              ">
                <span>Requirement clarity</span>
                <strong>${escapeHtml(scoring.clarity ?? "—")}</strong>
              </div>

              <div style="
                display:flex;
                justify-content:space-between;
                margin-bottom:18px;
              ">
                <span>Specification quality</span>
                <strong>${escapeHtml(scoring.specification ?? "—")}</strong>
              </div>

              <div style="
                display:flex;
                justify-content:space-between;
              ">
                <span>Commercial readiness</span>
                <strong>${escapeHtml(scoring.commercial ?? "—")}</strong>
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
                    ${escapeHtml(scoring.note)}
                  </div>
                `
                : ""
            }

          </div>

        </div>

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
            SUPPLIER MATCHING
          </div>

          ${
            matches.length
              ? matches
                  .map(
                    (match, index) => `
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
                            <strong style="font-size:17px;">
                              ${escapeHtml(
                                match.name ||
                                  `Supplier Profile ${index + 1}`
                              )}
                            </strong>

                            <div style="
                              color:#746d64;
                              font-size:13px;
                              margin-top:5px;
                            ">
                              ${escapeHtml(
                                match.location || "China"
                              )}
                            </div>
                          </div>

                          <div style="
                            font-weight:600;
                          ">
                            ${escapeHtml(match.matchScore ?? "—")}%
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
                                ${escapeHtml(match.note)}
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
                  line-height:1.6;
                ">
                  No verified supplier records are connected to this MVP yet.
                  CASEVO has not invented supplier identities or contact details.
                  The requirement has been successfully structured and is ready
                  for supplier verification.
                </div>
              `
          }

        </div>

        <div style="
          margin-top:28px;
          font-size:11px;
          line-height:1.6;
          color:#81786e;
        ">
          CASEVO MVP analysis. Supplier identities and commercial data are only
          displayed when connected to verified sourcing records.
        </div>

      </div>
    `;

    resultContainer.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

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

  // ---------------------------------------------------------
  // Submit
  // ---------------------------------------------------------

  async function submitSourcingRequest(event) {
    event.preventDefault();

    const requirement = requirementField
      ? requirementField.value.trim()
      : "";

    const product = productField
      ? productField.value.trim()
      : "";

    const quantity = quantityField
      ? quantityField.value.trim()
      : "";

    const targetPrice = priceField
      ? priceField.value.trim()
      : "";

    const destination = destinationField
      ? destinationField.value.trim()
      : "";

    if (!requirement && !product) {
      renderError(
        "Please describe what you want to source before running the analysis."
      );

      if (requirementField) {
        requirementField.focus();
      }

      return;
    }

    const payload = {
      requirement,
      product,
      quantity,
      targetPrice,
      destination,
      source: "CASEVO website",
      timestamp: new Date().toISOString()
    };

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
          font-size:11px;
          letter-spacing:2px;
          text-transform:uppercase;
          color:#b42f24;
          margin-bottom:12px;
        ">
          CASEVO AI
        </div>

        <div style="
          font-family:Georgia,serif;
          font-size:24px;
        ">
          Structuring your sourcing requirement...
        </div>
      </div>
    `;

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const rawText = await response.text();

      let data;

      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        throw new Error(
          "CASEVO server returned an invalid response."
        );
      }

      if (!response.ok || data.ok === false) {
        throw new Error(
          data.error ||
            data.message ||
            "Unable to analyze this sourcing request."
        );
      }

      renderResult(data);

    } catch (error) {
      console.error("CASEVO sourcing error:", error);

      renderError(
        error.message ||
          "Unable to connect to CASEVO sourcing service."
      );

    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------
  // Bind form
  // ---------------------------------------------------------

  form.addEventListener("submit", submitSourcingRequest);

  if (submitButton) {
    submitButton.addEventListener("click", function () {
      // Native form submit handles the actual request.
      // This listener intentionally does not submit twice.
    });
  }

  // ---------------------------------------------------------
  // Example request helper
  // ---------------------------------------------------------

  window.CASEVO = window.CASEVO || {};

  window.CASEVO.analyze = function (request) {
    if (!request || typeof request !== "object") {
      return Promise.reject(
        new Error("Invalid CASEVO sourcing request.")
      );
    }

    return fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    }).then(async (response) => {
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "CASEVO API request failed."
        );
      }

      return data;
    });
  };

  console.log(
    "CASEVO AI Sourcing frontend initialized — API key not required."
  );
})();
