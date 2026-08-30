/* =========================================================
   CASEVO AI SOURCING — FRONTEND
   REAL SUPPLIER DISCOVERY UI
   =========================================================

   Frontend responsibilities:
   1. Collect sourcing requirements
   2. Validate the request
   3. POST to /api/sourcing
   4. Render REAL supplier search results
   5. Support Tavily Worker response format
   6. Never invent supplier identities or contacts

   API:
   POST /api/sourcing

   ========================================================= */

(function () {
  "use strict";

  const API_ENDPOINT = "/api/sourcing";

  console.log("CASEVO AI Sourcing frontend loaded.");
  console.log("CASEVO API:", API_ENDPOINT);

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

  function normalize(value) {
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
      const element = qs(selector, root || document);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function getValue(element) {
    if (!element) {
      return "";
    }

    return normalize(element.value);
  }

  /* =========================================================
     FIND FORM
     ========================================================= */

  function findSourcingForm() {
    const forms = qsa("form");

    if (!forms.length) {
      return null;
    }

    const preferred = forms.find(function (form) {
      const text = (
        form.innerText ||
        form.textContent ||
        ""
      ).toLowerCase();

      return (
        text.includes("what are you sourcing") ||
        text.includes("product / material") ||
        text.includes("quantity") ||
        text.includes("destination")
      );
    });

    return preferred || forms[0];
  }

  const form = findSourcingForm();

  if (!form) {
    console.warn(
      "CASEVO: sourcing form was not found."
    );

    return;
  }

  /* =========================================================
     FIND INPUTS
     ========================================================= */

  function findField(selectors, labelText) {
    const direct = firstExisting(selectors, form);

    if (direct) {
      return direct;
    }

    const labels = qsa("label", form);

    const label = labels.find(function (item) {
      return normalize(item.textContent)
        .toLowerCase()
        .includes(labelText.toLowerCase());
    });

    if (!label) {
      return null;
    }

    const forId = label.getAttribute("for");

    if (forId) {
      const linked = document.getElementById(forId);

      if (linked) {
        return linked;
      }
    }

    return label.parentElement
      ? label.parentElement.querySelector(
          "input, textarea, select"
        )
      : null;
  }

  const requirementField = findField(
    [
      "#requirement",
      "#requirements",
      "#sourcing-requirement",
      "#sourcingRequirement",
      "#brief",
      "#sourcingBrief",
      'textarea[name="requirement"]',
      'textarea[name="requirements"]',
      'textarea[name="request"]',
      'textarea[name="brief"]',
      "textarea"
    ],
    "what are you sourcing"
  );

  const productField = findField(
    [
      "#product",
      "#product-material",
      "#productMaterial",
      'input[name="product"]',
      'input[name="material"]',
      'input[name="product_material"]'
    ],
    "product / material"
  );

  const quantityField = findField(
    [
      "#quantity",
      'input[name="quantity"]'
    ],
    "quantity"
  );

  const targetPriceField = findField(
    [
      "#target-price",
      "#targetPrice",
      "#price",
      'input[name="target_price"]',
      'input[name="targetPrice"]',
      'input[name="price"]'
    ],
    "target price"
  );

  const destinationField = findField(
    [
      "#destination",
      "#shipping-destination",
      "#shippingDestination",
      'input[name="destination"]',
      'input[name="shipping_destination"]'
    ],
    "destination"
  );

  /* =========================================================
     FIND SUBMIT BUTTON
     ========================================================= */

  let submitButton = firstExisting(
    [
      "#analyze-button",
      "#analyzeButton",
      "#find-matches",
      "#findMatches",
      'button[type="submit"]'
    ],
    form
  );

  if (!submitButton) {
    submitButton = qsa("button", form).find(function (button) {
      return /analy|match|source|find/i.test(
        button.textContent || ""
      );
    });
  }

  /* =========================================================
     RESULT CONTAINER
     ========================================================= */

  let resultContainer = qs("#casevo-results");

  if (!resultContainer) {
    resultContainer = document.createElement("div");

    resultContainer.id = "casevo-results";

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
     DESTINATION DETECTION
     ========================================================= */

  function detectDestinationFromRequirement(text) {
    const value = normalize(text);
    const lower = value.toLowerCase();

    const destinations = [
      {
        terms: [
          "united states",
          "usa",
          "u.s.a",
          "u.s.",
          "america",
          "ship to the united states",
          "shipping to the united states",
          "美国"
        ],
        value: "United States"
      },
      {
        terms: [
          "united kingdom",
          "uk",
          "u.k.",
          "英国"
        ],
        value: "United Kingdom"
      },
      {
        terms: [
          "germany",
          "德国"
        ],
        value: "Germany"
      },
      {
        terms: [
          "france",
          "法国"
        ],
        value: "France"
      },
      {
        terms: [
          "italy",
          "意大利"
        ],
        value: "Italy"
      },
      {
        terms: [
          "spain",
          "西班牙"
        ],
        value: "Spain"
      },
      {
        terms: [
          "canada",
          "加拿大"
        ],
        value: "Canada"
      },
      {
        terms: [
          "australia",
          "澳大利亚"
        ],
        value: "Australia"
      },
      {
        terms: [
          "japan",
          "日本"
        ],
        value: "Japan"
      },
      {
        terms: [
          "south korea",
          "korea",
          "韩国"
        ],
        value: "South Korea"
      }
    ];

    for (const item of destinations) {
      for (const term of item.terms) {
        if (lower.includes(term.toLowerCase())) {
          return item.value;
        }
      }
    }

    return "";
  }

  /* =========================================================
     LOADING STATE
     ========================================================= */

  function setLoading(isLoading) {
    if (!submitButton) {
      return;
    }

    if (isLoading) {
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

  /* =========================================================
     SCROLL RESULT INTO VIEW
     ========================================================= */

  function scrollToResults() {
    if (!resultContainer) {
      return;
    }

    setTimeout(function () {
      resultContainer.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 50);
  }

  /* =========================================================
     ERROR
     ========================================================= */

  function renderError(message, requestId) {
    const safeMessage =
      normalize(message) ||
      "Unable to complete supplier discovery.";

    resultContainer.innerHTML = `
      <div style="
        border:1px solid #d96c5c;
        background:#fff8f5;
        padding:28px;
        box-sizing:border-box;
        font-family:Arial,sans-serif;
        color:#6f2119;
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
          font-size:25px;
          line-height:1.25;
          margin-bottom:12px;
        ">
          Supplier discovery could not be completed.
        </div>

        <div style="
          font-size:14px;
          line-height:1.6;
        ">
          ${escapeHtml(safeMessage)}
        </div>

        ${
          requestId
            ? `
              <div style="
                margin-top:18px;
                color:#8a8177;
                font-size:11px;
              ">
                Request ID: ${escapeHtml(requestId)}
              </div>
            `
            : ""
        }

      </div>
    `;

    scrollToResults();
  }

  /* =========================================================
     LOADING
     ========================================================= */

  function renderLoading() {
    resultContainer.innerHTML = `
      <div style="
        background:#f7f1e6;
        border:1px solid #ded3c2;
        padding:36px;
        text-align:center;
        font-family:Arial,sans-serif;
      ">

        <div style="
          color:#b42f24;
          font-size:10px;
          letter-spacing:2px;
          text-transform:uppercase;
          margin-bottom:14px;
        ">
          CASEVO AI / LIVE SEARCH
        </div>

        <div style="
          font-family:Georgia,serif;
          font-size:27px;
          line-height:1.3;
        ">
          Searching real suppliers on the public web...
        </div>

        <div style="
          margin-top:12px;
          color:#756d63;
          font-size:13px;
        ">
          CASEVO is analyzing supplier relevance and public-web evidence.
        </div>

      </div>
    `;
  }

  /* =========================================================
     SCORE
     ========================================================= */

  function scoreValue(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    return String(value);
  }

  /* =========================================================
     SUPPLIER ARRAY NORMALIZATION
     ========================================================= */

  function getSupplierMatches(data) {
    const candidates = [];

    if (Array.isArray(data.matches)) {
      candidates.push.apply(
        candidates,
        data.matches
      );
    }

    if (
      data.analysis &&
      Array.isArray(data.analysis.matches)
    ) {
      candidates.push.apply(
        candidates,
        data.analysis.matches
      );
    }

    if (Array.isArray(data.suppliers)) {
      candidates.push.apply(
        candidates,
        data.suppliers
      );
    }

    if (Array.isArray(data.results)) {
      candidates.push.apply(
        candidates,
        data.results
      );
    }

    /*
      Remove exact duplicates when the Worker exposes
      the same results in multiple locations.
    */

    const seen = new Set();

    return candidates.filter(function (item) {
      if (!item || typeof item !== "object") {
        return false;
      }

      const key =
        item.website ||
        item.url ||
        item.name ||
        JSON.stringify(item);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });
  }

  /* =========================================================
     ANALYSIS NORMALIZATION
     ========================================================= */

  function getAnalysis(data) {
    if (
      data.analysis &&
      typeof data.analysis === "object"
    ) {
      return data.analysis;
    }

    return {};
  }

  function getNormalized(data) {
    const analysis = getAnalysis(data);

    if (
      analysis.normalized &&
      typeof analysis.normalized === "object"
    ) {
      return analysis.normalized;
    }

    return {};
  }

  function getScoring(data) {
    const analysis = getAnalysis(data);

    if (
      analysis.scoring &&
      typeof analysis.scoring === "object"
    ) {
      return analysis.scoring;
    }

    if (
      data.scoring &&
      typeof data.scoring === "object"
    ) {
      return data.scoring;
    }

    return {};
  }

  /* =========================================================
     SUPPLIER CARD
     ========================================================= */

  function renderSupplierCard(match, index) {
    const name =
      match.name ||
      match.company ||
      match.title ||
      `Supplier ${index + 1}`;

    const location =
      match.location ||
      match.country ||
      "Location not identified";

    const website =
      match.website ||
      match.url ||
      "";

    const domain =
      match.domain ||
      "";

    const capability =
      match.capability ||
      match.description ||
      match.summary ||
      "";

    const evidence =
      match.evidence ||
      match.content ||
      match.note ||
      "";

    const verificationStatus =
      match.verificationStatus ||
      match.verification ||
      "Unverified — due diligence required";

    const matchScore =
      match.matchScore ??
      match.score ??
      "—";

    const rank =
      match.rank ||
      index + 1;

    return `
      <div style="
        background:#fffaf3;
        border:1px solid #d9cdbd;
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
              color:#b42f24;
              font-size:10px;
              letter-spacing:1.5px;
              margin-bottom:8px;
            ">
              MATCH ${escapeHtml(rank)}
            </div>

            <div style="
              font-family:Georgia,serif;
              font-size:23px;
              line-height:1.2;
              color:#171512;
            ">
              ${escapeHtml(name)}
            </div>

            <div style="
              margin-top:8px;
              color:#756d63;
              font-size:13px;
            ">
              ${escapeHtml(location)}
            </div>

            ${
              domain
                ? `
                  <div style="
                    margin-top:4px;
                    color:#93897e;
                    font-size:11px;
                  ">
                    ${escapeHtml(domain)}
                  </div>
                `
                : ""
            }

          </div>

          <div style="
            border:1px solid #cdbfae;
            background:#f7efe3;
            padding:12px 18px;
            min-width:95px;
            text-align:center;
          ">

            <div style="
              color:#81786e;
              font-size:9px;
              letter-spacing:1px;
              text-transform:uppercase;
              margin-bottom:5px;
            ">
              Match
            </div>

            <div style="
              font-size:24px;
              font-weight:600;
              color:#1d1b18;
            ">
              ${escapeHtml(scoreValue(matchScore))}%
            </div>

          </div>

        </div>

        ${
          capability
            ? `
              <div style="
                margin-top:20px;
                padding-top:16px;
                border-top:1px solid #e5dbce;
              ">

                <div style="
                  color:#b42f24;
                  font-size:9px;
                  letter-spacing:1.5px;
                  text-transform:uppercase;
                  margin-bottom:7px;
                ">
                  CAPABILITY
                </div>

                <div style="
                  font-size:13px;
                  line-height:1.6;
                  color:#4f4942;
                ">
                  ${escapeHtml(capability)}
                </div>

              </div>
            `
            : ""
        }

        ${
          evidence
            ? `
              <div style="
                margin-top:18px;
                padding:16px;
                background:#f4eee5;
                border-left:3px solid #b42f24;
              ">

                <div style="
                  color:#b42f24;
                  font-size:9px;
                  letter-spacing:1.5px;
                  text-transform:uppercase;
                  margin-bottom:7px;
                ">
                  PUBLIC-WEB EVIDENCE
                </div>

                <div style="
                  font-size:12px;
                  line-height:1.65;
                  color:#625c55;
                ">
                  ${escapeHtml(evidence)}
                </div>

              </div>
            `
            : ""
        }

        <div style="
          margin-top:18px;
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:15px;
          flex-wrap:wrap;
        ">

          <div style="
            color:#887f75;
            font-size:10px;
            line-height:1.5;
          ">
            ${escapeHtml(verificationStatus)}
          </div>

          ${
            website
              ? `
                <a
                  href="${escapeHtml(website)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="
                    display:inline-block;
                    border:1px solid #b42f24;
                    color:#b42f24;
                    padding:9px 14px;
                    text-decoration:none;
                    font-size:11px;
                    letter-spacing:.3px;
                    background:#fffaf3;
                  "
                >
                  Visit Supplier Website →
                </a>
              `
              : ""
          }

        </div>

      </div>
    `;
  }

  /* =========================================================
     RESULT RENDERING
     ========================================================= */

  function renderResult(data) {
    const normalized = getNormalized(data);
    const scoring = getScoring(data);
    const matches = getSupplierMatches(data);

    const analysis =
      data.analysis &&
      typeof data.analysis === "object"
        ? data.analysis
        : {};

    const product =
      normalized.product ||
      data.product ||
      data.brief?.product ||
      "Sourcing Requirement";

    const quantity =
      normalized.quantity ||
      data.quantity ||
      data.brief?.quantity ||
      "Not specified";

    const targetPrice =
      normalized.targetPrice ||
      data.targetPrice ||
      data.brief?.targetPrice ||
      "Not specified";

    const destination =
      normalized.destination ||
      data.destination ||
      data.brief?.destination ||
      detectDestinationFromRequirement(
        requirementField
          ? requirementField.value
          : ""
      ) ||
      "Not specified";

    const requestId =
      data.requestId ||
      data.request_id ||
      "";

    const meta =
      data.meta &&
      typeof data.meta === "object"
        ? data.meta
        : {};

    const message =
      data.message ||
      "Real supplier search completed successfully.";

    const requirements =
      Array.isArray(normalized.requirements)
        ? normalized.requirements
        : [];

    const tags =
      Array.isArray(normalized.tags)
        ? normalized.tags
        : [];

    resultContainer.innerHTML = `

      <div style="
        background:#f7f1e6;
        border:1px solid #d9cdbd;
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
              font-size:10px;
              letter-spacing:2px;
              text-transform:uppercase;
              margin-bottom:9px;
            ">
              CASEVO AI / SOURCING ANALYSIS
            </div>

            <div style="
              font-family:Georgia,serif;
              font-size:34px;
              line-height:1.12;
            ">
              Real supplier discovery completed.
            </div>

            <div style="
              margin-top:10px;
              color:#70685f;
              font-size:13px;
            ">
              ${escapeHtml(message)}
            </div>

          </div>

          <div style="
            border:1px solid #cdbfae;
            background:#fffaf3;
            padding:15px 20px;
            min-width:125px;
            text-align:center;
          ">

            <div style="
              font-size:9px;
              letter-spacing:1.5px;
              text-transform:uppercase;
              color:#81786e;
              margin-bottom:5px;
            ">
              CASEVO SCORE
            </div>

            <div style="
              font-size:29px;
              font-weight:600;
            ">
              ${escapeHtml(
                scoreValue(
                  scoring.score ||
                  data.score
                )
              )}
              <span style="
                font-size:13px;
                color:#81786e;
              ">
                /100
              </span>
            </div>

          </div>

        </div>

        <!-- SOURCING REQUIREMENT -->

        <div style="
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(180px,1fr));
          gap:1px;
          background:#d6cabb;
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

        <!-- REQUIREMENTS -->

        ${
          requirements.length
            ? `
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
                  NORMALIZED REQUIREMENTS
                </div>

                <div style="
                  background:#fffaf3;
                  border:1px solid #ddd2c2;
                  padding:20px;
                ">

                  ${requirements
                    .map(function (item, index) {
                      return `
                        <div style="
                          display:flex;
                          gap:12px;
                          padding:9px 0;
                          border-bottom:
                            1px solid #e6ddd2;
                          font-size:13px;
                          line-height:1.5;
                        ">

                          <span style="
                            color:#b42f24;
                            font-size:10px;
                            min-width:24px;
                          ">
                            ${String(index + 1)
                              .padStart(2, "0")}
                          </span>

                          <span>
                            ${escapeHtml(item)}
                          </span>

                        </div>
                      `;
                    })
                    .join("")}

                </div>

              </div>
            `
            : ""
        }

        <!-- TAGS -->

        ${
          tags.length
            ? `
              <div style="
                display:flex;
                flex-wrap:wrap;
                gap:7px;
                margin-bottom:30px;
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

        <!-- REAL SUPPLIER RESULTS -->

        <div style="
          padding-top:25px;
          border-top:1px solid #d7ccbd;
        ">

          <div style="
            color:#b42f24;
            font-size:10px;
            letter-spacing:2px;
            text-transform:uppercase;
            margin-bottom:9px;
          ">
            REAL SUPPLIER MATCHES
          </div>

          <div style="
            font-family:Georgia,serif;
            font-size:27px;
            line-height:1.2;
            margin-bottom:20px;
          ">
            ${
              matches.length
                ? `Potential suppliers found on the public web.`
                : `No supplier matches were returned.`
            }
          </div>

          ${
            matches.length
              ? matches
                  .slice(0, 10)
                  .map(renderSupplierCard)
                  .join("")
              : `
                <div style="
                  background:#fffaf3;
                  border:1px solid #ddd2c2;
                  padding:24px;
                  color:#665f57;
                  font-size:13px;
                  line-height:1.65;
                ">
                  CASEVO completed the public-web search,
                  but no supplier records were returned for
                  this request.
                  <br><br>
                  Try adding more specific material,
                  product, country, manufacturing capability,
                  or certification requirements.
                </div>
              `
          }

        </div>

        <!-- SEARCH INFORMATION -->

        <div style="
          margin-top:30px;
          padding-top:22px;
          border-top:1px solid #d7ccbd;
        ">

          <div style="
            color:#b42f24;
            font-size:10px;
            letter-spacing:2px;
            text-transform:uppercase;
            margin-bottom:10px;
          ">
            SEARCH INFORMATION
          </div>

          <div style="
            background:#f2ebdf;
            border:1px solid #ded3c5;
            padding:18px;
            font-size:11px;
            line-height:1.7;
            color:#72695f;
          ">

            <div>
              <strong>Supplier data:</strong>
              ${escapeHtml(
                meta.supplierData ||
                meta.source ||
                "Public web search"
              )}
            </div>

            ${
              meta.searchQuery
                ? `
                  <div>
                    <strong>Search query:</strong>
                    ${escapeHtml(meta.searchQuery)}
                  </div>
                `
                : ""
            }

            ${
              meta.tavilyRequestId
                ? `
                  <div>
                    <strong>Search request:</strong>
                    ${escapeHtml(
                      meta.tavilyRequestId
                    )}
                  </div>
                `
                : ""
            }

            ${
              meta.creditsUsed !== null &&
              meta.creditsUsed !== undefined
                ? `
                  <div>
                    <strong>Search credits:</strong>
                    ${escapeHtml(
                      meta.creditsUsed
                    )}
                  </div>
                `
                : ""
            }

            ${
              requestId
                ? `
                  <div>
                    <strong>CASEVO Request ID:</strong>
                    ${escapeHtml(requestId)}
                  </div>
                `
                : ""
            }

          </div>

        </div>

        <!-- VERIFICATION NOTICE -->

        <div style="
          margin-top:18px;
          padding:16px;
          border:1px solid #d8cdbd;
          background:#eee6d8;
          font-size:10px;
          line-height:1.65;
          color:#756d63;
        ">

          <strong style="
            color:#4e4943;
          ">
            Verification notice:
          </strong>

          ${
            escapeHtml(
              meta.verificationNote ||
              "Public-web supplier matches are discovery results and must be independently verified before commercial use."
            )
          }

        </div>

      </div>
    `;

    scrollToResults();
  }

  /* =========================================================
     INFO CARD
     ========================================================= */

  function infoCard(label, value) {
    return `
      <div style="
        background:#fffaf3;
        padding:18px;
        box-sizing:border-box;
      ">

        <div style="
          color:#81786e;
          font-size:9px;
          letter-spacing:1.5px;
          text-transform:uppercase;
          margin-bottom:8px;
        ">
          ${escapeHtml(label)}
        </div>

        <div style="
          font-size:14px;
          line-height:1.45;
        ">
          ${escapeHtml(value)}
        </div>

      </div>
    `;
  }

  /* =========================================================
     PARSE SERVER RESPONSE
     ========================================================= */

  async function parseResponse(response) {
    const rawText = await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch (error) {
      console.error(
        "CASEVO invalid JSON:",
        rawText
      );

      throw new Error(
        "CASEVO server returned an invalid response."
      );
    }

    if (!response.ok || data.ok === false) {
      const message =
        data.error ||
        data.message ||
        data.details ||
        `CASEVO API request failed (${response.status}).`;

      const error = new Error(message);

      error.requestId =
        data.requestId ||
        data.request_id ||
        "";

      throw error;
    }

    return data;
  }

  /* =========================================================
     SUBMIT SOURCING REQUEST
     ========================================================= */

  async function submitSourcingRequest(event) {
    event.preventDefault();

    const requirement =
      getValue(requirementField);

    const product =
      getValue(productField);

    const quantity =
      getValue(quantityField);

    const targetPrice =
      getValue(targetPriceField);

    let destination =
      getValue(destinationField);

    /* -------------------------------------------------------
       Basic validation
       ------------------------------------------------------- */

    if (!requirement && !product) {
      renderError(
        "Please describe what you want to source before running the analysis."
      );

      if (requirementField) {
        requirementField.focus();
      }

      return;
    }

    /*
       If destination is empty, attempt to extract it
       from the sourcing description.

       This prevents the previous:
       "Please enter a destination."
       problem when the destination is already written
       inside the textarea.
    */

    if (!destination) {
      destination =
        detectDestinationFromRequirement(
          requirement
        );
    }

    /*
       Do not invent a destination.
       If the user did not provide one and it cannot
       be detected, leave it blank and let the Worker
       decide whether it is required.
    */

    const payload = {
      requirement: requirement,
      product: product,
      quantity: quantity,
      targetPrice: targetPrice,
      destination: destination,
      source: "CASEVO website",
      timestamp: new Date().toISOString()
    };

    console.log(
      "CASEVO sourcing request:",
      payload
    );

    setLoading(true);
    renderLoading();

    try {
      const response = await fetch(
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

      const data =
        await parseResponse(response);

      console.log(
        "CASEVO sourcing response:",
        data
      );

      renderResult(data);

    } catch (error) {
      console.error(
        "CASEVO sourcing error:",
        error
      );

      renderError(
        error.message ||
        "Unable to connect to CASEVO sourcing service.",
        error.requestId || ""
      );

    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     FORM EVENT
     ========================================================= */

  form.addEventListener(
    "submit",
    submitSourcingRequest
  );

  /*
     Do NOT add another submit/click handler.
     Native form submission already triggers
     submitSourcingRequest().
  */

  /* =========================================================
     PUBLIC CASEVO API
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

            body: JSON.stringify(request)
          }
        );

      return parseResponse(
        response
      );
    };

  /* =========================================================
     DEBUG INFORMATION
     ========================================================= */

  console.log(
    "CASEVO AI Sourcing frontend initialized."
  );

  console.log(
    "Real supplier result parser enabled."
  );

  console.log(
    "Supported Worker response formats:",
    "matches, analysis.matches, suppliers, results"
  );

})();
