/**
 * =========================================================
 * CASEVO AI — FRONTEND SOURCING CLIENT
 * =========================================================
 *
 * Frontend client for:
 *
 *   POST /api/sourcing
 *   GET  /api/health
 *
 * Compatible with CASEVO Worker v4.0.0
 *
 * Expected response:
 *
 * data.brief
 * data.analysis.normalized
 * data.analysis.scoring
 * data.analysis.matches
 *
 * Also supports:
 *
 * data.matches
 *
 * =========================================================
 */

(() => {
  "use strict";

  const CASEVO_FRONTEND_VERSION = "4.0.0";

  const API_ENDPOINT = "/api/sourcing";
  const HEALTH_ENDPOINT = "/api/health";

  let form = null;
  let submitButton = null;

  let requirementField = null;
  let productField = null;
  let quantityField = null;
  let priceField = null;
  let destinationField = null;

  let statusElement = null;
  let resultsElement = null;

  let isSubmitting = false;


  /* =======================================================
     INITIALIZATION
     ======================================================= */

  document.addEventListener("DOMContentLoaded", () => {
    initializeCasevo();
  });


  function initializeCasevo() {

    form = findSourcingForm();

    if (!form) {
      console.warn(
        "[CASEVO] Sourcing form was not found."
      );

      return;
    }

    locateFields();

    createStatusArea();

    createResultsArea();

    attachFormHandler();

    console.log(
      `[CASEVO] Frontend initialized — v${CASEVO_FRONTEND_VERSION}`
    );
  }


  /* =======================================================
     FIND FORM
     ======================================================= */

  function findSourcingForm() {

    const selectors = [
      "#sourcingForm",
      "#sourcing-form",
      "form[data-sourcing-form]",
      "form[action*='sourcing']",
      "form"
    ];

    for (const selector of selectors) {

      const element =
        document.querySelector(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }


  /* =======================================================
     FIND FIELDS
     ======================================================= */

  function locateFields() {

    const textareas =
      Array.from(
        form.querySelectorAll("textarea")
      );

    const inputs =
      Array.from(
        form.querySelectorAll("input")
      );


    /*
     * Main sourcing requirement
     */

    requirementField =
      findFieldBySelectors([
        "#requirement",
        "#requirements",
        "#sourcingRequirement",
        "#sourcing-requirement",
        "[name='requirement']",
        "[name='requirements']",
        "[name='brief']",
        "textarea"
      ]);


    /*
     * Product / material
     */

    productField =
      findFieldBySelectors([
        "#product",
        "#productMaterial",
        "#product-material",
        "[name='product']",
        "[name='product_material']",
        "[name='productMaterial']"
      ]);


    /*
     * Quantity
     */

    quantityField =
      findFieldBySelectors([
        "#quantity",
        "[name='quantity']"
      ]);


    /*
     * Target price
     */

    priceField =
      findFieldBySelectors([
        "#targetPrice",
        "#target-price",
        "#price",
        "[name='targetPrice']",
        "[name='target_price']",
        "[name='price']"
      ]);


    /*
     * Destination
     */

    destinationField =
      findFieldBySelectors([
        "#destination",
        "[name='destination']"
      ]);


    /*
     * Fallback based on placeholder / label
     */

    if (!productField) {

      productField =
        findFieldByPlaceholder([
          "upper leather",
          "product",
          "material"
        ]);
    }


    if (!quantityField) {

      quantityField =
        findFieldByPlaceholder([
          "5,000 pairs",
          "quantity",
          "pairs",
          "pcs"
        ]);
    }


    if (!priceField) {

      priceField =
        findFieldByPlaceholder([
          "$4",
          "price",
          "target price"
        ]);
    }


    if (!destinationField) {

      destinationField =
        findFieldByPlaceholder([
          "USA",
          "United States",
          "destination"
        ]);
    }


    /*
     * Button
     */

    submitButton =
      form.querySelector(
        "button[type='submit']"
      );


    if (!submitButton) {

      submitButton =
        Array.from(
          form.querySelectorAll("button")
        ).find(
          button =>
            /analyze|find matches|search/i.test(
              button.textContent || ""
            )
        );
    }


    console.log(
      "[CASEVO] Fields detected:",
      {
        requirement: Boolean(requirementField),
        product: Boolean(productField),
        quantity: Boolean(quantityField),
        price: Boolean(priceField),
        destination: Boolean(destinationField),
        submitButton: Boolean(submitButton)
      }
    );
  }


  function findFieldBySelectors(
    selectors
  ) {

    for (const selector of selectors) {

      const element =
        form.querySelector(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }


  function findFieldByPlaceholder(
    keywords
  ) {

    const fields =
      Array.from(
        form.querySelectorAll(
          "input, textarea"
        )
      );

    for (const field of fields) {

      const placeholder =
        (
          field.getAttribute(
            "placeholder"
          ) || ""
        ).toLowerCase();

      if (
        keywords.some(
          keyword =>
            placeholder.includes(
              keyword.toLowerCase()
            )
        )
      ) {

        return field;
      }
    }

    return null;
  }


  /* =======================================================
     FORM HANDLER
     ======================================================= */

  function attachFormHandler() {

    form.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        event.stopPropagation();

        if (isSubmitting) {
          return;
        }

        await submitSourcingRequest();
      }
    );


    /*
     * Extra protection for buttons that may not
     * behave correctly because of existing page scripts.
     */

    if (submitButton) {

      submitButton.addEventListener(
        "click",
        event => {

          if (
            submitButton.type !== "submit"
          ) {

            event.preventDefault();

            if (!isSubmitting) {
              submitSourcingRequest();
            }
          }
        }
      );
    }
  }


  /* =======================================================
     READ FORM
     ======================================================= */

  function getFieldValue(
    field
  ) {

    if (!field) {
      return "";
    }

    return String(
      field.value || ""
    ).trim();
  }


  function collectFormData() {

    return {

      requirement:
        getFieldValue(
          requirementField
        ),

      product:
        getFieldValue(
          productField
        ),

      quantity:
        getFieldValue(
          quantityField
        ),

      targetPrice:
        getFieldValue(
          priceField
        ),

      destination:
        getFieldValue(
          destinationField
        )

    };
  }


  /* =======================================================
     SUBMIT REQUEST
     ======================================================= */

  async function submitSourcingRequest() {

    const input =
      collectFormData();


    /*
     * Requirement validation
     */

    if (
      !input.requirement &&
      !input.product
    ) {

      showError(
        "Please enter a sourcing requirement."
      );

      focusRequirement();

      return;
    }


    isSubmitting = true;

    setLoadingState(true);

    clearResults();

    showStatus(
      "Analyzing your sourcing requirement…",
      "loading"
    );


    try {

      console.log(
        "[CASEVO] Sending sourcing request:",
        input
      );


      const response =
        await fetch(
          API_ENDPOINT,
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

              "Accept":
                "application/json"

            },

            body:
              JSON.stringify(
                input
              )

          }
        );


      console.log(
        "[CASEVO] API response status:",
        response.status
      );


      const rawText =
        await response.text();


      let data = null;


      try {

        data =
          rawText
            ? JSON.parse(rawText)
            : null;

      } catch {

        throw new Error(
          `The sourcing service returned an invalid response (HTTP ${response.status}).`
        );
      }


      /*
       * HTTP error
       */

      if (!response.ok) {

        const message =
          data?.error ||
          data?.details ||
          `Sourcing service returned HTTP ${response.status}.`;

        throw new Error(
          message
        );
      }


      /*
       * Worker-level error
       */

      if (
        data &&
        data.ok === false
      ) {

        throw new Error(
          data.error ||
          data.details ||
          "Supplier search failed."
        );
      }


      /*
       * Render successful result
       */

      renderResponse(
        data
      );


      showStatus(
        "Supplier discovery completed.",
        "success"
      );


      console.log(
        "[CASEVO] Sourcing response:",
        data
      );


    } catch (error) {

      console.error(
        "[CASEVO] Sourcing request failed:",
        error
      );


      showError(
        getFriendlyErrorMessage(
          error
        )
      );

    } finally {

      isSubmitting = false;

      setLoadingState(false);
    }
  }


  /* =======================================================
     FRIENDLY ERROR
     ======================================================= */

  function getFriendlyErrorMessage(
    error
  ) {

    const message =
      String(
        error?.message ||
        ""
      );


    if (
      /failed to fetch/i.test(
        message
      )
    ) {

      return (
        "CASEVO could not connect to the sourcing service. " +
        "Please check your connection and try again."
      );
    }


    if (
      /tavily/i.test(
        message
      )
    ) {

      return (
        "The supplier search service returned an error. " +
        "Please try again in a moment."
      );
    }


    if (
      /TAVILY_API_KEY/i.test(
        message
      )
    ) {

      return (
        "The sourcing service is not fully configured yet. " +
        "Please check the Cloudflare Worker secret configuration."
      );
    }


    return (
      message ||
      "Supplier discovery failed. Please try again."
    );
  }


  /* =======================================================
     LOADING STATE
     ======================================================= */

  function setLoadingState(
    loading
  ) {

    if (!submitButton) {
      return;
    }


    if (loading) {

      submitButton.disabled = true;

      submitButton.dataset.originalText =
        submitButton.textContent;

      submitButton.textContent =
        "Analyzing…";

      submitButton.setAttribute(
        "aria-busy",
        "true"
      );

      submitButton.style.opacity =
        "0.7";

      submitButton.style.cursor =
        "wait";

    } else {

      submitButton.disabled = false;

      const original =
        submitButton.dataset.originalText;

      if (original) {

        submitButton.textContent =
          original;
      }

      submitButton.removeAttribute(
        "aria-busy"
      );

      submitButton.style.opacity =
        "";

      submitButton.style.cursor =
        "";
    }
  }


  /* =======================================================
     STATUS AREA
     ======================================================= */

  function createStatusArea() {

    statusElement =
      document.getElementById(
        "casevo-status"
      );


    if (statusElement) {
      return;
    }


    statusElement =
      document.createElement(
        "div"
      );


    statusElement.id =
      "casevo-status";


    statusElement.setAttribute(
      "role",
      "status"
    );


    statusElement.setAttribute(
      "aria-live",
      "polite"
    );


    statusElement.style.cssText = `
      margin-top: 14px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      min-height: 18px;
      transition: opacity .2s ease;
    `;


    /*
     * Put status immediately after form
     */

    form.insertAdjacentElement(
      "afterend",
      statusElement
    );
  }


  function showStatus(
    message,
    type = "normal"
  ) {

    if (!statusElement) {
      return;
    }


    statusElement.textContent =
      message;


    statusElement.style.opacity =
      "1";


    if (type === "loading") {

      statusElement.style.color =
        "#7b6750";

    } else if (
      type === "success"
    ) {

      statusElement.style.color =
        "#3d6848";

    } else if (
      type === "error"
    ) {

      statusElement.style.color =
        "#a52e25";

    } else {

      statusElement.style.color =
        "#666";
    }
  }


  function showError(
    message
  ) {

    showStatus(
      message,
      "error"
    );


    ensureResultsArea();


    resultsElement.innerHTML = `

      <div class="casevo-error-box">

        <div class="casevo-error-title">
          Sourcing request could not be completed
        </div>

        <div class="casevo-error-message">
          ${escapeHtml(message)}
        </div>

        <button
          type="button"
          class="casevo-retry-button"
          id="casevo-retry-button"
        >
          Try Again
        </button>

      </div>

    `;


    const retryButton =
      document.getElementById(
        "casevo-retry-button"
      );


    if (retryButton) {

      retryButton.addEventListener(
        "click",
        () => {

          if (!isSubmitting) {
            submitSourcingRequest();
          }

        }
      );
    }


    scrollToResults();
  }


  /* =======================================================
     RESULTS AREA
     ======================================================= */

  function createResultsArea() {

    resultsElement =
      document.getElementById(
        "casevo-results"
      );


    if (resultsElement) {
      return;
    }


    resultsElement =
      document.createElement(
        "section"
      );


    resultsElement.id =
      "casevo-results";


    resultsElement.setAttribute(
      "aria-live",
      "polite"
    );


    resultsElement.style.cssText = `
      width: 100%;
      max-width: 100%;
      margin: 42px 0 80px;
      box-sizing: border-box;
    `;


    /*
     * Insert after status.
     */

    if (statusElement) {

      statusElement.insertAdjacentElement(
        "afterend",
        resultsElement
      );

    } else {

      form.insertAdjacentElement(
        "afterend",
        resultsElement
      );
    }
  }


  function ensureResultsArea() {

    if (!resultsElement) {
      createResultsArea();
    }
  }


  function clearResults() {

    ensureResultsArea();

    resultsElement.innerHTML =
      "";
  }


  /* =======================================================
     RENDER RESPONSE
     ======================================================= */

  function renderResponse(
    data
  ) {

    ensureResultsArea();


    const analysis =
      data?.analysis || {};


    const normalized =
      analysis.normalized ||
      {};


    const scoring =
      analysis.scoring ||
      {};


    const matches =
      Array.isArray(
        analysis.matches
      )
        ? analysis.matches
        : (
          Array.isArray(
            data?.matches
          )
            ? data.matches
            : []
        );


    const brief =
      data?.brief ||
      {};


    resultsElement.innerHTML = `

      <div class="casevo-results-shell">

        ${renderBrief(
          brief,
          normalized
        )}

        ${renderReadiness(
          scoring
        )}

        ${renderSupplierSection(
          matches
        )}

      </div>

    `;


    addResultsStyles();

    scrollToResults();
  }


  /* =======================================================
     BRIEF
     ======================================================= */

  function renderBrief(
    brief,
    normalized
  ) {

    const product =
      brief.product ||
      normalized.product ||
      "Sourcing requirement";


    const quantity =
      brief.quantity ||
      normalized.quantity ||
      "";


    const targetPrice =
      brief.targetPrice ||
      normalized.targetPrice ||
      "";


    const destination =
      brief.destination ||
      normalized.destination ||
      "";


    const requirements =
      Array.isArray(
        normalized.requirements
      )
        ? normalized.requirements
        : [];


    return `

      <div class="casevo-brief-card">

        <div class="casevo-section-label">
          CASEVO AI
        </div>

        <div class="casevo-brief-heading">
          Structured sourcing brief
        </div>

        <div class="casevo-brief-grid">

          <div class="casevo-brief-item">
            <div class="casevo-item-label">
              PRODUCT / MATERIAL
            </div>
            <div class="casevo-item-value">
              ${escapeHtml(product)}
            </div>
          </div>

          <div class="casevo-brief-item">
            <div class="casevo-item-label">
              QUANTITY
            </div>
            <div class="casevo-item-value">
              ${escapeHtml(
                quantity || "Not specified"
              )}
            </div>
          </div>

          <div class="casevo-brief-item">
            <div class="casevo-item-label">
              TARGET PRICE
            </div>
            <div class="casevo-item-value">
              ${escapeHtml(
                targetPrice || "Not specified"
              )}
            </div>
          </div>

          <div class="casevo-brief-item">
            <div class="casevo-item-label">
              DESTINATION
            </div>
            <div class="casevo-item-value">
              ${escapeHtml(
                destination || "Not specified"
              )}
            </div>
          </div>

        </div>

        ${
          requirements.length
            ? `

              <div class="casevo-requirements">

                <div class="casevo-item-label">
                  NORMALIZED REQUIREMENTS
                </div>

                <div class="casevo-tags">

                  ${requirements
                    .map(
                      item =>
                        `
                        <span class="casevo-tag">
                          ${escapeHtml(item)}
                        </span>
                        `
                    )
                    .join("")
                  }

                </div>

              </div>

            `
            : ""
        }

      </div>

    `;
  }


  /* =======================================================
     READINESS
     ======================================================= */

  function renderReadiness(
    scoring
  ) {

    if (!scoring) {
      return "";
    }


    const score =
      Number(
        scoring.score || 0
      );


    const clarity =
      scoring.clarity ||
      `${score}%`;


    const specification =
      scoring.specification ||
      "—";


    const commercial =
      scoring.commercial ||
      "—";


    return `

      <div class="casevo-readiness-card">

        <div class="casevo-readiness-main">

          <div>

            <div class="casevo-section-label">
              REQUEST READINESS
            </div>

            <div class="casevo-readiness-title">
              ${score}/100
            </div>

          </div>

          <div class="casevo-readiness-note">

            ${
              escapeHtml(
                scoring.note ||
                "Readiness reflects requirement completeness, not supplier verification."
              )
            }

          </div>

        </div>


        <div class="casevo-score-grid">

          ${renderScoreItem(
            "CLARITY",
            clarity
          )}

          ${renderScoreItem(
            "SPECIFICATION",
            specification
          )}

          ${renderScoreItem(
            "COMMERCIAL",
            commercial
          )}

        </div>

      </div>

    `;
  }


  function renderScoreItem(
    label,
    value
  ) {

    return `

      <div class="casevo-score-item">

        <div class="casevo-score-label">
          ${escapeHtml(label)}
        </div>

        <div class="casevo-score-value">
          ${escapeHtml(String(value))}
        </div>

      </div>

    `;
  }


  /* =======================================================
     SUPPLIER SECTION
     ======================================================= */

  function renderSupplierSection(
    matches
  ) {

    if (!matches.length) {

      return `

        <div class="casevo-no-results">

          <div class="casevo-section-label">
            SUPPLIER DISCOVERY
          </div>

          <div class="casevo-no-results-title">
            No strong supplier candidates were returned.
          </div>

          <div class="casevo-no-results-text">
            Try adding more specific product, material,
            location, quantity or manufacturing requirements.
          </div>

        </div>

      `;
    }


    return `

      <div class="casevo-suppliers">

        <div class="casevo-suppliers-header">

          <div>

            <div class="casevo-section-label">
              SUPPLIER DISCOVERY
            </div>

            <div class="casevo-suppliers-title">
              Potential supplier matches
            </div>

          </div>

          <div class="casevo-supplier-count">
            ${matches.length} candidate${matches.length === 1 ? "" : "s"}
          </div>

        </div>


        <div class="casevo-supplier-list">

          ${matches
            .map(
              supplier =>
                renderSupplierCard(
                  supplier
                )
            )
            .join("")
          }

        </div>


        <div class="casevo-disclaimer">

          Public-web candidates are not verified suppliers.
          Company identity, manufacturing capability,
          certifications, MOQ, production capacity and
          commercial contacts must be independently verified
          before placing an order.

        </div>

      </div>

    `;
  }


  /* =======================================================
     SUPPLIER CARD
     ======================================================= */

  function renderSupplierCard(
    supplier
  ) {

    const name =
      supplier.name ||
      "Potential manufacturer";


    const location =
      supplier.location ||
      "Not determined";


    const supplierType =
      supplier.supplierType ||
      "Potential Manufacturer";


    const capability =
      supplier.capability ||
      "";


    const score =
      Number(
        supplier.matchScore || 0
      );


    const website =
      supplier.website ||
      supplier.sourceUrl ||
      "";


    const sourceUrl =
      supplier.sourceUrl ||
      supplier.website ||
      "";


    const email =
      supplier.contactEmail ||
      "";


    const phone =
      supplier.contactPhone ||
      "";


    const evidence =
      supplier.evidence ||
      "";


    const verification =
      supplier.verificationStatus ||
      "Unverified — due diligence required";


    const rank =
      supplier.rank ||
      "";


    return `

      <article class="casevo-supplier-card">

        <div class="casevo-supplier-top">

          <div class="casevo-rank">
            ${escapeHtml(
              String(rank)
            )}
          </div>


          <div class="casevo-supplier-title-area">

            <h3 class="casevo-supplier-name">
              ${escapeHtml(name)}
            </h3>

            <div class="casevo-supplier-type">
              ${escapeHtml(supplierType)}
            </div>

          </div>


          <div class="casevo-match-score">

            <div class="casevo-score-number">
              ${score}
            </div>

            <div class="casevo-score-caption">
              MATCH
            </div>

          </div>

        </div>


        <div class="casevo-supplier-meta">

          <div class="casevo-meta-item">

            <span class="casevo-meta-label">
              LOCATION
            </span>

            <span class="casevo-meta-value">
              ${escapeHtml(location)}
            </span>

          </div>


          ${
            website
              ? `

                <div class="casevo-meta-item">

                  <span class="casevo-meta-label">
                    WEBSITE
                  </span>

                  <a
                    class="casevo-supplier-link"
                    href="${safeUrl(website)}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit website ↗
                  </a>

                </div>

              `
              : ""
          }


          ${
            email
              ? `

                <div class="casevo-meta-item">

                  <span class="casevo-meta-label">
                    EMAIL
                  </span>

                  <a
                    class="casevo-supplier-link"
                    href="mailto:${escapeAttribute(email)}"
                  >
                    ${escapeHtml(email)}
                  </a>

                </div>

              `
              : ""
          }


          ${
            phone
              ? `

                <div class="casevo-meta-item">

                  <span class="casevo-meta-label">
                    PHONE
                  </span>

                  <span class="casevo-meta-value">
                    ${escapeHtml(phone)}
                  </span>

                </div>

              `
              : ""
          }

        </div>


        ${
          capability
            ? `

              <div class="casevo-capability">

                <div class="casevo-meta-label">
                  CAPABILITY SIGNAL
                </div>

                <div class="casevo-capability-text">
                  ${escapeHtml(capability)}
                </div>

              </div>

            `
            : ""
        }


        ${
          evidence
            ? `

              <details class="casevo-evidence">

                <summary>
                  View public-web evidence
                </summary>

                <div class="casevo-evidence-text">
                  ${escapeHtml(evidence)}
                </div>

              </details>

            `
            : ""
        }


        <div class="casevo-verification">

          <span class="casevo-verification-dot"></span>

          ${escapeHtml(verification)}

        </div>


        ${
          sourceUrl
            ? `

              <div class="casevo-source">

                Source:
                <a
                  href="${safeUrl(sourceUrl)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Public web result ↗
                </a>

              </div>

            `
            : ""
        }

      </article>

    `;
  }


  /* =======================================================
     STYLES
     ======================================================= */

  function addResultsStyles() {

    if (
      document.getElementById(
        "casevo-results-styles"
      )
    ) {

      return;
    }


    const style =
      document.createElement(
        "style"
      );


    style.id =
      "casevo-results-styles";


    style.textContent = `

      #casevo-results {
        box-sizing: border-box;
        width: 100%;
      }


      .casevo-results-shell {
        width: 100%;
        box-sizing: border-box;
      }


      .casevo-brief-card,
      .casevo-readiness-card,
      .casevo-suppliers,
      .casevo-no-results,
      .casevo-error-box {
        box-sizing: border-box;
        width: 100%;
        border: 1px solid #d8d0c2;
        background: #f8f4ec;
        margin-bottom: 18px;
      }


      .casevo-brief-card {
        padding: 28px;
      }


      .casevo-section-label {
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 10px;
        font-weight: 700;
        letter-spacing: .18em;
        color: #a72d24;
        text-transform: uppercase;
        margin-bottom: 10px;
      }


      .casevo-brief-heading,
      .casevo-suppliers-title {
        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size: 28px;
        line-height: 1.12;
        color: #1e1711;
        margin-bottom: 22px;
      }


      .casevo-brief-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));

        border-top: 1px solid #d8d0c2;
      }


      .casevo-brief-item {
        padding: 17px 18px 17px 0;
        border-bottom: 1px solid #d8d0c2;
      }


      .casevo-brief-item:nth-child(even) {
        padding-left: 18px;
        border-left: 1px solid #d8d0c2;
      }


      .casevo-item-label,
      .casevo-meta-label,
      .casevo-score-label {
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 9px;
        font-weight: 700;
        letter-spacing: .14em;
        color: #786e61;
        text-transform: uppercase;
        margin-bottom: 7px;
      }


      .casevo-item-value {
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 14px;
        line-height: 1.55;
        color: #201a14;
      }


      .casevo-requirements {
        padding-top: 22px;
      }


      .casevo-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }


      .casevo-tag {
        display: inline-block;
        padding: 7px 10px;
        border: 1px solid #d0c6b7;
        background: #eee7da;
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 11px;
        color: #423a31;
      }


      .casevo-readiness-card {
        padding: 24px 28px;
        background: #eee6d7;
      }


      .casevo-readiness-main {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 30px;
      }


      .casevo-readiness-title {
        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size: 38px;
        line-height: 1;
        color: #1e1711;
      }


      .casevo-readiness-note {
        max-width: 440px;
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 11px;
        line-height: 1.55;
        color: #6e6254;
      }


      .casevo-score-grid {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));

        margin-top: 24px;
        border-top: 1px solid #d0c6b7;
      }


      .casevo-score-item {
        padding-top: 15px;
      }


      .casevo-score-item + .casevo-score-item {
        padding-left: 20px;
        border-left: 1px solid #d0c6b7;
      }


      .casevo-score-value {
        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size: 22px;
        color: #1e1711;
      }


      .casevo-suppliers {
        padding: 28px;
        background: #f8f4ec;
      }


      .casevo-suppliers-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 22px;
      }


      .casevo-suppliers-title {
        margin-bottom: 0;
      }


      .casevo-supplier-count {
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 11px;
        color: #75695a;
      }


      .casevo-supplier-list {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));

        gap: 16px;
      }


      .casevo-supplier-card {
        position: relative;
        box-sizing: border-box;
        padding: 23px;
        border: 1px solid #d6cdbf;
        background: #fbf8f1;
      }


      .casevo-supplier-top {
        display: flex;
        align-items: flex-start;
        gap: 13px;
      }


      .casevo-rank {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 28px;
        width: 28px;
        height: 28px;
        border: 1px solid #cfc4b4;
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 10px;
        color: #75695a;
      }


      .casevo-supplier-title-area {
        min-width: 0;
        flex: 1;
      }


      .casevo-supplier-name {
        margin: 0;
        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size: 20px;
        line-height: 1.15;
        font-weight: 600;
        color: #1d1711;
        word-break: break-word;
      }


      .casevo-supplier-type {
        margin-top: 6px;
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 10px;
        color: #776b5d;
      }


      .casevo-match-score {
        flex: 0 0 auto;
        text-align: right;
      }


      .casevo-score-number {
        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size: 26px;
        line-height: 1;
        color: #a72d24;
      }


      .casevo-score-caption {
        margin-top: 4px;
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 8px;
        letter-spacing: .14em;
        color: #847767;
      }


      .casevo-supplier-meta {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));

        gap: 15px;
        margin-top: 22px;
        padding-top: 18px;
        border-top: 1px solid #ddd5c9;
      }


      .casevo-meta-item {
        min-width: 0;
      }


      .casevo-meta-value,
      .casevo-supplier-link {
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 12px;
        line-height: 1.45;
        color: #302820;
        word-break: break-word;
      }


      .casevo-supplier-link {
        color: #9d2d25;
        text-decoration: none;
      }


      .casevo-supplier-link:hover {
        text-decoration: underline;
      }


      .casevo-capability {
        margin-top: 20px;
        padding-top: 18px;
        border-top: 1px solid #ddd5c9;
      }


      .casevo-capability-text {
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 12px;
        line-height: 1.6;
        color: #443a30;
      }


      .casevo-evidence {
        margin-top: 18px;
        border-top: 1px solid #ddd5c9;
        padding-top: 14px;
      }


      .casevo-evidence summary {
        cursor: pointer;
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 10px;
        font-weight: 700;
        color: #6e6254;
      }


      .casevo-evidence-text {
        margin-top: 12px;
        padding: 13px;
        background: #f0eadf;
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 11px;
        line-height: 1.55;
        color: #4c4237;
        white-space: pre-wrap;
      }


      .casevo-verification {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-top: 20px;
        padding-top: 14px;
        border-top: 1px solid #ddd5c9;
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 10px;
        color: #7a6d5e;
      }


      .casevo-verification-dot {
        width: 6px;
        height: 6px;
        flex: 0 0 6px;
        border-radius: 50%;
        background: #a72d24;
      }


      .casevo-source {
        margin-top: 10px;
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 10px;
        color: #887b6b;
      }


      .casevo-source a {
        color: #9d2d25;
        text-decoration: none;
      }


      .casevo-source a:hover {
        text-decoration: underline;
      }


      .casevo-disclaimer {
        margin-top: 20px;
        padding-top: 18px;
        border-top: 1px solid #d8d0c2;
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 10px;
        line-height: 1.6;
        color: #827667;
      }


      .casevo-no-results,
      .casevo-error-box {
        padding: 30px;
      }


      .casevo-no-results-title,
      .casevo-error-title {
        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size: 24px;
        line-height: 1.2;
        color: #211a13;
        margin-bottom: 10px;
      }


      .casevo-no-results-text,
      .casevo-error-message {
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 12px;
        line-height: 1.6;
        color: #665a4c;
      }


      .casevo-error-box {
        border-color: #d6b9b4;
        background: #fbf1ef;
      }


      .casevo-error-title {
        color: #8e2922;
      }


      .casevo-retry-button {
        margin-top: 20px;
        padding: 11px 20px;
        border: 0;
        background: #ad3128;
        color: #fff;
        cursor: pointer;
        font-family:
          Arial,
          Helvetica,
          sans-serif;

        font-size: 11px;
        font-weight: 700;
      }


      .casevo-retry-button:hover {
        opacity: .9;
      }


      @media (
        max-width: 760px
      ) {

        .casevo-brief-grid,
        .casevo-supplier-list {
          grid-template-columns: 1fr;
        }


        .casevo-brief-item:nth-child(even) {
          padding-left: 0;
          border-left: 0;
        }


        .casevo-readiness-main {
          display: block;
        }


        .casevo-readiness-note {
          margin-top: 15px;
        }


        .casevo-score-grid {
          grid-template-columns: 1fr;
        }


        .casevo-score-item + .casevo-score-item {
          padding-left: 0;
          border-left: 0;
          margin-top: 15px;
        }


        .casevo-supplier-meta {
          grid-template-columns: 1fr;
        }


        .casevo-suppliers-header {
          display: block;
        }


        .casevo-supplier-count {
          margin-top: 8px;
        }

      }

    `;


    document.head.appendChild(
      style
    );
  }


  /* =======================================================
     FOCUS
     ======================================================= */

  function focusRequirement() {

    if (!requirementField) {
      return;
    }


    requirementField.focus();


    try {

      requirementField.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

    } catch {
      // Ignore unsupported scroll behavior.
    }
  }


  /* =======================================================
     SCROLL RESULTS
     ======================================================= */

  function scrollToResults() {

    if (!resultsElement) {
      return;
    }


    window.setTimeout(
      () => {

        try {

          resultsElement.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

        } catch {

          resultsElement.scrollIntoView();
        }

      },
      80
    );
  }


  /* =======================================================
     SECURITY HELPERS
     ======================================================= */

  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }


  function escapeAttribute(
    value
  ) {

    return escapeHtml(
      value
    );
  }


  function safeUrl(
    value
  ) {

    const raw =
      String(
        value || ""
      ).trim();


    if (!raw) {
      return "#";
    }


    try {

      const parsed =
        new URL(
          raw,
          window.location.origin
        );


      if (
        parsed.protocol !== "http:" &&
        parsed.protocol !== "https:"
      ) {

        return "#";
      }


      return escapeAttribute(
        parsed.href
      );

    } catch {

      return "#";
    }
  }


  /* =======================================================
     OPTIONAL HEALTH CHECK
     ======================================================= */

  async function checkCasevoHealth() {

    try {

      const response =
        await fetch(
          HEALTH_ENDPOINT,
          {
            method: "GET",
            headers: {
              "Accept":
                "application/json"
            },
            cache: "no-store"
          }
        );


      if (!response.ok) {

        console.warn(
          "[CASEVO] Health check returned:",
          response.status
        );

        return false;
      }


      const data =
        await response.json();


      console.log(
        "[CASEVO] Backend health:",
        data
      );


      return Boolean(
        data?.ok
      );

    } catch (error) {

      console.warn(
        "[CASEVO] Health check failed:",
        error
      );


      return false;
    }
  }


  /*
   * Run health check after page initialization.
   * This does NOT block sourcing requests.
   */

  window.setTimeout(
    () => {
      checkCasevoHealth();
    },
    500
  );


  /* =======================================================
     DEBUG API
     ======================================================= */

  window.CASEVO = {

    version:
      CASEVO_FRONTEND_VERSION,

    endpoint:
      API_ENDPOINT,

    health:
      checkCasevoHealth,

    submit:
      submitSourcingRequest,

    collect:
      collectFormData

  };


})();
