/* =========================================================
   CASEVO AI SOURCING — FRONTEND
   ---------------------------------------------------------
   CASEVO China Sourcing Intelligence
   Frontend client for Cloudflare Worker

   API:
   POST /api/sourcing
   GET  /api/health

   No OpenAI API key required on frontend.
   ========================================================= */

(function () {
  "use strict";

  /* =======================================================
     CONFIGURATION
     ======================================================= */

  const API_ENDPOINT = "/api/sourcing";
  const HEALTH_ENDPOINT = "/api/health";

  const CONFIG = {
    requestTimeout: 30000,
    maxRequirementLength: 5000
  };


  /* =======================================================
     BASIC HELPERS
     ======================================================= */

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from(
      (root || document).querySelectorAll(selector)
    );
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cleanText(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatValue(value, fallback) {
    const text = cleanText(value);

    if (!text) {
      return fallback || "Not specified";
    }

    return text;
  }

  function unique(array) {
    return Array.from(
      new Set(
        (array || []).filter(Boolean)
      )
    );
  }


  /* =======================================================
     DOM READY
     ======================================================= */

  document.addEventListener("DOMContentLoaded", function () {
    initCasevo();
  });


  function initCasevo() {
    setupSmoothNavigation();
    setupForm();
    setupInteractiveButtons();
  }


  /* =======================================================
     FIND SOURCING FORM
     ======================================================= */

  function findSourcingForm() {
    const direct = qs("#sourcingForm");

    if (direct) {
      return direct;
    }

    const formCandidates = qsa("form");

    for (const form of formCandidates) {
      const textarea =
        qs("#request", form) ||
        qs("textarea", form);

      if (textarea) {
        return form;
      }
    }

    return null;
  }


  /* =======================================================
     FIND FORM FIELDS
     ======================================================= */

  function getFormFields(form) {
    return {
      form,

      request:
        qs("#request", form) ||
        qs("textarea[name='request']", form) ||
        qs("textarea[name='requirement']", form) ||
        qs("textarea", form),

      product:
        qs("#product", form) ||
        qs("input[name='product']", form) ||
        findInputByLabel(form, [
          "product",
          "product / material",
          "material"
        ]),

      quantity:
        qs("#quantity", form) ||
        qs("input[name='quantity']", form) ||
        findInputByLabel(form, [
          "quantity"
        ]),

      targetPrice:
        qs("#price", form) ||
        qs("#targetPrice", form) ||
        qs("input[name='price']", form) ||
        qs("input[name='targetPrice']", form) ||
        findInputByLabel(form, [
          "target price",
          "price"
        ]),

      destination:
        qs("#destination", form) ||
        qs("input[name='destination']", form) ||
        findInputByLabel(form, [
          "destination"
        ]),

      button:
        qs("button[type='submit']", form) ||
        qs("input[type='submit']", form) ||
        qs("button", form)
    };
  }


  function findInputByLabel(root, names) {
    const labels = qsa("label", root);

    for (const label of labels) {
      const labelText = cleanText(
        label.textContent
      ).toLowerCase();

      for (const name of names) {
        if (
          labelText.includes(
            name.toLowerCase()
          )
        ) {
          const forId =
            label.getAttribute("for");

          if (forId) {
            const input =
              document.getElementById(forId);

            if (input) {
              return input;
            }
          }

          const nested =
            qs("input, textarea", label);

          if (nested) {
            return nested;
          }
        }
      }
    }

    return null;
  }


  /* =======================================================
     FORM SETUP
     ======================================================= */

  function setupForm() {
    const form = findSourcingForm();

    if (!form) {
      console.warn(
        "CASEVO: sourcing form was not found."
      );

      return;
    }

    const fields = getFormFields(form);

    form.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();
        event.stopPropagation();

        submitSourcingRequest(fields);
      },
      false
    );

    /*
     * Extra protection for buttons that may have
     * unusual HTML behavior.
     */
    if (fields.button) {
      fields.button.addEventListener(
        "click",
        function (event) {
          /*
           * Do not prevent the browser's normal submit
           * if this is a submit button.
           */
          if (
            fields.button.type === "submit" ||
            fields.button.type === ""
          ) {
            return;
          }

          event.preventDefault();

          submitSourcingRequest(fields);
        },
        false
      );
    }

    /*
     * Make sure Enter / Cmd+Enter works inside textarea.
     */
    if (fields.request) {
      fields.request.addEventListener(
        "keydown",
        function (event) {
          if (
            event.key === "Enter" &&
            (event.metaKey || event.ctrlKey)
          ) {
            event.preventDefault();

            submitSourcingRequest(fields);
          }
        }
      );
    }

    console.log(
      "CASEVO: sourcing form initialized."
    );
  }


  /* =======================================================
     SUBMIT SOURCING REQUEST
     ======================================================= */

  async function submitSourcingRequest(fields) {
    if (!fields || !fields.form) {
      showError(
        "CASEVO sourcing form could not be initialized."
      );

      return;
    }

    /*
     * Prevent duplicate submissions.
     */
    if (
      fields.form.dataset.casevoSubmitting === "true"
    ) {
      return;
    }

    const requirement = cleanText(
      fields.request
        ? fields.request.value
        : ""
    );

    const product = cleanText(
      fields.product
        ? fields.product.value
        : ""
    );

    const quantity = cleanText(
      fields.quantity
        ? fields.quantity.value
        : ""
    );

    const targetPrice = cleanText(
      fields.targetPrice
        ? fields.targetPrice.value
        : ""
    );

    const destination = cleanText(
      fields.destination
        ? fields.destination.value
        : ""
    );

    /*
     * The main requirement OR product is required.
     */
    if (!requirement && !product) {
      showValidationMessage(
        fields.request ||
        fields.product,
        "Please describe what you want to source."
      );

      return;
    }

    if (
      requirement.length >
      CONFIG.maxRequirementLength
    ) {
      showValidationMessage(
        fields.request,
        "Please keep the sourcing requirement under 5,000 characters."
      );

      return;
    }

    const payload = {
      requirement: requirement,
      product: product,
      quantity: quantity,
      targetPrice: targetPrice,
      destination: destination
    };

    /*
     * Update UI immediately.
     */
    setSubmittingState(
      fields,
      true
    );

    showLoadingState();

    try {
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

            body:
              JSON.stringify(payload)
          },
          CONFIG.requestTimeout
        );

      /*
       * Try to parse JSON even when HTTP status
       * is not 200.
       */
      const data =
        await parseJSONResponse(response);

      if (!response.ok) {
        const message =
          data &&
          data.error
            ? data.error
            : "The sourcing service returned an error.";

        throw new Error(message);
      }

      if (
        !data ||
        data.ok !== true
      ) {
        throw new Error(
          data && data.error
            ? data.error
            : "CASEVO could not complete the sourcing analysis."
        );
      }

      renderResults(data);

      /*
       * Scroll to results.
       */
      scrollToResults();

    } catch (error) {
      console.error(
        "CASEVO sourcing error:",
        error
      );

      showError(
        getFriendlyError(error)
      );

    } finally {
      setSubmittingState(
        fields,
        false
      );
    }
  }


  /* =======================================================
     FETCH WITH TIMEOUT
     ======================================================= */

  async function fetchWithTimeout(
    url,
    options,
    timeout
  ) {
    const controller =
      new AbortController();

    const timer =
      setTimeout(
        function () {
          controller.abort();
        },
        timeout
      );

    try {
      return await fetch(
        url,
        {
          ...(options || {}),
          signal:
            controller.signal
        }
      );

    } finally {
      clearTimeout(timer);
    }
  }


  /* =======================================================
     PARSE JSON
     ======================================================= */

  async function parseJSONResponse(
    response
  ) {
    const text =
      await response.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);

    } catch (error) {
      console.error(
        "CASEVO invalid JSON response:",
        text
      );

      throw new Error(
        "The sourcing service returned an invalid response."
      );
    }
  }


  /* =======================================================
     BUTTON STATE
     ======================================================= */

  function setSubmittingState(
    fields,
    submitting
  ) {
    if (
      fields &&
      fields.form
    ) {
      fields.form.dataset.casevoSubmitting =
        submitting
          ? "true"
          : "false";
    }

    if (
      !fields ||
      !fields.button
    ) {
      return;
    }

    const button =
      fields.button;

    if (!button.dataset.originalText) {
      button.dataset.originalText =
        button.textContent ||
        "Analyze & Find Matches";
    }

    if (submitting) {
      button.disabled = true;

      button.dataset.casevoOriginalHTML =
        button.innerHTML;

      button.innerHTML =
        "Analyzing requirement&nbsp;&nbsp;→";

      button.setAttribute(
        "aria-busy",
        "true"
      );

    } else {
      button.disabled = false;

      if (
        button.dataset.casevoOriginalHTML
      ) {
        /*
         * Restore the original button text,
         * rather than keeping the loading state.
         */
        button.innerHTML =
          button.dataset.casevoOriginalHTML;
      } else {
        button.textContent =
          button.dataset.originalText;
      }

      button.removeAttribute(
        "aria-busy"
      );
    }
  }


  /* =======================================================
     LOADING STATE
     ======================================================= */

  function showLoadingState() {
    const container =
      getOrCreateResultsContainer();

    container.innerHTML = `
      <section
        class="casevo-results casevo-loading"
        aria-live="polite"
      >
        <div class="casevo-results-inner">

          <div class="casevo-section-label">
            CASEVO AI / SOURCING ENGINE
          </div>

          <h2>
            Analyzing your sourcing requirement.
          </h2>

          <p>
            CASEVO is structuring the requirement
            and evaluating sourcing readiness.
          </p>

          <div class="casevo-loader">
            <span></span>
            <span></span>
            <span></span>
          </div>

        </div>
      </section>
    `;

    container.hidden = false;
  }


  /* =======================================================
     RESULTS CONTAINER
     ======================================================= */

  function getOrCreateResultsContainer() {
    let container =
      document.getElementById(
        "casevoResults"
      );

    if (container) {
      return container;
    }

    container =
      document.createElement("div");

    container.id =
      "casevoResults";

    container.className =
      "casevo-results-container";

    container.setAttribute(
      "aria-live",
      "polite"
    );

    /*
     * Put the results immediately after
     * the sourcing form.
     */
    const form =
      findSourcingForm();

    if (form && form.parentNode) {
      form.parentNode.insertBefore(
        container,
        form.nextSibling
      );

    } else {
      document.body.appendChild(
        container
      );
    }

    injectResultStyles();

    return container;
  }


  /* =======================================================
     RENDER RESULTS
     ======================================================= */

  function renderResults(data) {
    const container =
      getOrCreateResultsContainer();

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
        : [];

    const score =
      clampNumber(
        scoring.score,
        0,
        100
      );

    const clarity =
      clampNumber(
        scoring.clarity,
        0,
        100
      );

    const specification =
      clampNumber(
        scoring.specification,
        0,
        100
      );

    const commercial =
      clampNumber(
        scoring.commercial,
        0,
        100
      );

    const requirements =
      Array.isArray(
        normalized.requirements
      )
        ? normalized.requirements
        : [];

    const certifications =
      Array.isArray(
        normalized.certifications
      )
        ? normalized.certifications
        : [];

    const tags =
      Array.isArray(
        normalized.tags
      )
        ? normalized.tags
        : [];

    const scoreLabel =
      getScoreLabel(score);

    container.innerHTML = `
      <section
        class="casevo-results"
        id="casevoAnalysis"
      >

        <div class="casevo-results-inner">

          <!-- =========================================
               HEADER
               ========================================= -->

          <div class="casevo-result-header">

            <div>
              <div class="casevo-section-label">
                CASEVO AI / SOURCING ANALYSIS
              </div>

              <h2>
                Sourcing intelligence brief
              </h2>

              <p>
                Your requirement has been structured
                for supplier screening.
              </p>
            </div>

            <div class="casevo-score-card">

              <div class="casevo-score-caption">
                CASEVO SCORE
              </div>

              <div class="casevo-score-number">
                ${score}
                <span>/100</span>
              </div>

              <div class="casevo-score-label">
                ${escapeHTML(scoreLabel)}
              </div>

            </div>

          </div>


          <!-- =========================================
               BRIEF
               ========================================= -->

          <div class="casevo-result-grid">

            ${resultCard(
              "Product / Material",
              formatValue(
                brief.product ||
                normalized.product
              )
            )}

            ${resultCard(
              "Quantity",
              formatValue(
                brief.quantity ||
                normalized.quantity
              )
            )}

            ${resultCard(
              "Target Price",
              formatValue(
                brief.targetPrice ||
                normalized.targetPrice
              )
            )}

            ${resultCard(
              "Destination",
              formatValue(
                brief.destination ||
                normalized.destination
              )
            )}

            ${resultCard(
              "Material",
              formatValue(
                normalized.material
              )
            )}

            ${resultCard(
              "Thickness / Gauge",
              formatValue(
                normalized.thickness
              )
            )}

            ${resultCard(
              "Color / Finish",
              formatValue(
                normalized.color
              )
            )}

            ${resultCard(
              "Industry",
              formatValue(
                normalized.industry
              )
            )}

          </div>


          <!-- =========================================
               SCORE BREAKDOWN
               ========================================= -->

          <div class="casevo-analysis-section">

            <div class="casevo-section-label">
              SOURCING READINESS
            </div>

            <h3>
              Requirement quality
            </h3>

            <div class="casevo-metrics">

              ${metricBar(
                "Clarity",
                clarity
              )}

              ${metricBar(
                "Technical specification",
                specification
              )}

              ${metricBar(
                "Commercial readiness",
                commercial
              )}

            </div>

            <div class="casevo-note">
              ${escapeHTML(
                scoring.note ||
                "Requirement analyzed successfully."
              )}
            </div>

          </div>


          <!-- =========================================
               REQUIREMENTS
               ========================================= -->

          ${
            requirements.length
              ? `
                <div class="casevo-analysis-section">

                  <div class="casevo-section-label">
                    STRUCTURED REQUIREMENT
                  </div>

                  <h3>
                    Sourcing specification
                  </h3>

                  <div class="casevo-requirements">

                    ${requirements
                      .map(
                        function (item) {
                          return `
                            <div class="casevo-requirement">
                              <span>+</span>
                              <span>
                                ${escapeHTML(item)}
                              </span>
                            </div>
                          `;
                        }
                      )
                      .join("")}

                  </div>

                </div>
              `
              : ""
          }


          <!-- =========================================
               TAGS
               ========================================= -->

          ${
            tags.length
              ? `
                <div class="casevo-tags">

                  ${tags
                    .map(
                      function (tag) {
                        return `
                          <span class="casevo-tag">
                            ${escapeHTML(tag)}
                          </span>
                        `;
                      }
                    )
                    .join("")}

                </div>
              `
              : ""
          }


          <!-- =========================================
               CERTIFICATIONS
               ========================================= -->

          ${
            certifications.length
              ? `
                <div class="casevo-analysis-section">

                  <div class="casevo-section-label">
                    COMPLIANCE
                  </div>

                  <h3>
                    Certification requirements
                  </h3>

                  <div class="casevo-certifications">

                    ${certifications
                      .map(
                        function (cert) {
                          return `
                            <span>
                              ${escapeHTML(cert)}
                            </span>
                          `;
                        }
                      )
                      .join("")}

                  </div>

                </div>
              `
              : ""
          }


          <!-- =========================================
               ADDITIONAL REQUIREMENTS
               ========================================= -->

          <div class="casevo-detail-grid">

            ${detailItem(
              "Packaging",
              normalized.packaging
            )}

            ${detailItem(
              "MOQ",
              normalized.moq
            )}

            ${detailItem(
              "Lead Time",
              normalized.leadTime
            )}

          </div>


          <!-- =========================================
               SUPPLIER MATCHES
               ========================================= -->

          <div class="casevo-analysis-section">

            <div class="casevo-section-label">
              SUPPLIER MATCHING
            </div>

            <h3>
              Matching supplier profiles
            </h3>

            <p class="casevo-disclaimer">
              CASEVO does not fabricate supplier identities.
              Profiles shown here represent sourcing capabilities.
              Verified supplier identity and commercial contact
              details require supplier verification.
            </p>

            <div class="casevo-supplier-list">

              ${
                matches.length
                  ? matches
                      .map(
                        function (
                          supplier,
                          index
                        ) {
                          return renderSupplier(
                            supplier,
                            index
                          );
                        }
                      )
                      .join("")
                  : `
                    <div class="casevo-empty">
                      No matching capability profile
                      was generated for this requirement.
                    </div>
                  `
              }

            </div>

          </div>


          <!-- =========================================
               NEXT STEP
               ========================================= -->

          <div class="casevo-next-step">

            <div>

              <div class="casevo-section-label">
                NEXT STEP
              </div>

              <h3>
                Ready for supplier verification?
              </h3>

              <p>
                This sourcing brief can now be used
                as the basis for verified supplier discovery,
                qualification and RFQ.
              </p>

            </div>

            <button
              type="button"
              class="casevo-next-button"
              id="casevoRequestVerification"
            >
              Request Supplier Verification&nbsp;&nbsp;→
            </button>

          </div>


          <!-- =========================================
               FOOTER
               ========================================= -->

          <div class="casevo-result-footer">

            CASEVO AI Sourcing ·
            Structured intelligence for China sourcing

          </div>

        </div>

      </section>
    `;

    container.hidden = false;

    setupVerificationButton(
      data
    );
  }


  /* =======================================================
     RESULT CARD
     ======================================================= */

  function resultCard(
    label,
    value
  ) {
    return `
      <div class="casevo-result-card">

        <div class="casevo-card-label">
          ${escapeHTML(label)}
        </div>

        <div class="casevo-card-value">
          ${escapeHTML(value)}
        </div>

      </div>
    `;
  }


  /* =======================================================
     METRIC BAR
     ======================================================= */

  function metricBar(
    label,
    value
  ) {
    const safeValue =
      clampNumber(
        value,
        0,
        100
      );

    return `
      <div class="casevo-metric">

        <div class="casevo-metric-top">

          <span>
            ${escapeHTML(label)}
          </span>

          <strong>
            ${safeValue}
          </strong>

        </div>

        <div class="casevo-metric-track">

          <div
            class="casevo-metric-fill"
            style="width:${safeValue}%"
          ></div>

        </div>

      </div>
    `;
  }


  /* =======================================================
     DETAIL ITEM
     ======================================================= */

  function detailItem(
    label,
    value
  ) {
    if (!value) {
      return "";
    }

    return `
      <div class="casevo-detail-item">

        <div class="casevo-card-label">
          ${escapeHTML(label)}
        </div>

        <div class="casevo-detail-value">
          ${escapeHTML(value)}
        </div>

      </div>
    `;
  }


  /* =======================================================
     SUPPLIER RENDER
     ======================================================= */

  function renderSupplier(
    supplier,
    index
  ) {
    const name =
      supplier &&
      supplier.name
        ? supplier.name
        : "Supplier capability profile";

    const location =
      supplier &&
      supplier.location
        ? supplier.location
        : "China";

    const matchScore =
      clampNumber(
        supplier &&
        supplier.matchScore,
        0,
        100
      );

    const note =
      supplier &&
      supplier.note
        ? supplier.note
        : "Supplier verification is required.";

    return `
      <article
        class="casevo-supplier-card"
      >

        <div class="casevo-supplier-top">

          <div>

            <div class="casevo-supplier-index">
              ${String(index + 1).padStart(2, "0")}
            </div>

            <h4>
              ${escapeHTML(name)}
            </h4>

            <div class="casevo-supplier-location">
              ${escapeHTML(location)}
            </div>

          </div>

          <div class="casevo-match">

            <div class="casevo-match-label">
              MATCH
            </div>

            <div class="casevo-match-score">
              ${matchScore}%
            </div>

          </div>

        </div>

        <div class="casevo-supplier-note">
          ${escapeHTML(note)}
        </div>

        <div class="casevo-supplier-status">
          <span></span>
          Verification required
        </div>

      </article>
    `;
  }


  /* =======================================================
     SCORE LABEL
     ======================================================= */

  function getScoreLabel(
    score
  ) {
    if (score >= 85) {
      return "Strong sourcing brief";
    }

    if (score >= 70) {
      return "Good sourcing brief";
    }

    if (score >= 50) {
      return "Basic sourcing brief";
    }

    return "Needs more specification";
  }


  /* =======================================================
     NUMBER HELPERS
     ======================================================= */

  function clampNumber(
    value,
    min,
    max
  ) {
    const number =
      Number(value);

    if (!Number.isFinite(number)) {
      return min;
    }

    return Math.min(
      max,
      Math.max(
        min,
        Math.round(number)
      )
    );
  }


  /* =======================================================
     ERROR HANDLING
     ======================================================= */

  function showError(
    message
  ) {
    const container =
      getOrCreateResultsContainer();

    container.innerHTML = `
      <section
        class="casevo-results casevo-error"
        aria-live="assertive"
      >

        <div class="casevo-results-inner">

          <div class="casevo-section-label">
            CASEVO AI / CONNECTION ERROR
          </div>

          <h2>
            We could not complete the analysis.
          </h2>

          <p>
            ${escapeHTML(message)}
          </p>

          <button
            type="button"
            class="casevo-retry-button"
            id="casevoRetryButton"
          >
            Try Again&nbsp;&nbsp;→
          </button>

        </div>

      </section>
    `;

    container.hidden = false;

    const retry =
      qs("#casevoRetryButton");

    if (retry) {
      retry.addEventListener(
        "click",
        function () {
          const form =
            findSourcingForm();

          if (form) {
            const fields =
              getFormFields(form);

            submitSourcingRequest(
              fields
            );
          }
        }
      );
    }

    scrollToResults();
  }


  function showValidationMessage(
    element,
    message
  ) {
    if (element) {
      element.focus();
    }

    const container =
      getOrCreateResultsContainer();

    container.innerHTML = `
      <section
        class="casevo-results casevo-error"
        aria-live="assertive"
      >

        <div class="casevo-results-inner">

          <div class="casevo-section-label">
            REQUIREMENT NEEDED
          </div>

          <h2>
            Tell us what you need to source.
          </h2>

          <p>
            ${escapeHTML(message)}
          </p>

        </div>

      </section>
    `;

    container.hidden = false;

    scrollToResults();
  }


  function getFriendlyError(
    error
  ) {
    if (!error) {
      return "An unexpected error occurred.";
    }

    if (
      error.name === "AbortError"
    ) {
      return (
        "The sourcing analysis timed out. " +
        "Please try again."
      );
    }

    const message =
      cleanText(
        error.message
      );

    if (
      message.includes(
        "Failed to fetch"
      )
    ) {
      return (
        "CASEVO could not connect to the sourcing engine. " +
        "Please refresh the page and try again."
      );
    }

    return (
      message ||
      "The sourcing analysis could not be completed."
    );
  }


  /* =======================================================
     SCROLL TO RESULTS
     ======================================================= */

  function scrollToResults() {
    const container =
      document.getElementById(
        "casevoResults"
      );

    if (!container) {
      return;
    }

    setTimeout(
      function () {
        container.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      },
      100
    );
  }


  /* =======================================================
     VERIFICATION BUTTON
     ======================================================= */

  function setupVerificationButton(
    data
  ) {
    const button =
      qs("#casevoRequestVerification");

    if (!button) {
      return;
    }

    button.addEventListener(
      "click",
      function () {
        const form =
          findSourcingForm();

        /*
         * For MVP, show the next-stage message.
         * This does not fabricate a supplier or contact.
         */
        const message =
          document.createElement(
            "div"
          );

        message.className =
          "casevo-verification-message";

        message.innerHTML = `
          <strong>
            Supplier verification request ready.
          </strong>
          <span>
            CASEVO can use this sourcing brief
            for verified supplier discovery and
            commercial qualification.
          </span>
        `;

        button.parentNode.appendChild(
          message
        );

        button.disabled = true;
        button.textContent =
          "Verification Request Ready";
      }
    );
  }


  /* =======================================================
     SMOOTH NAVIGATION
     ======================================================= */

  function setupSmoothNavigation() {
    const links =
      qsa("a[href^='#']");

    links.forEach(
      function (link) {
        link.addEventListener(
          "click",
          function (event) {
            const href =
              link.getAttribute(
                "href"
              );

            if (
              !href ||
              href === "#"
            ) {
              return;
            }

            const target =
              document.querySelector(
                href
              );

            if (!target) {
              return;
            }

            event.preventDefault();

            target.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          }
        );
      }
    );
  }


  /* =======================================================
     INTERACTIVE BUTTONS
     ======================================================= */

  function setupInteractiveButtons() {
    /*
     * Start AI Sourcing buttons.
     */
    const sourcingButtons =
      qsa(
        "a, button"
      ).filter(
        function (element) {
          const text =
            cleanText(
              element.textContent
            ).toLowerCase();

          return (
            text.includes(
              "start ai sourcing"
            ) ||
            text.includes(
              "start sourcing"
            ) ||
            text.includes(
              "get started"
            )
          );
        }
      );

    sourcingButtons.forEach(
      function (button) {
        /*
         * Do not override buttons that already
         * have explicit form behavior.
         */
        if (
          button.closest(
            "form"
          )
        ) {
          return;
        }

        button.addEventListener(
          "click",
          function () {
            const form =
              findSourcingForm();

            if (!form) {
              return;
            }

            setTimeout(
              function () {
                form.scrollIntoView({
                  behavior: "smooth",
                  block: "center"
                });

                const fields =
                  getFormFields(form);

                if (
                  fields.request
                ) {
                  setTimeout(
                    function () {
                      fields.request.focus();
                    },
                    500
                  );
                }
              },
              50
            );
          }
        );
      }
    );
  }


  /* =======================================================
     HEALTH CHECK
     ======================================================= */

  async function checkAPIHealth() {
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
        return false;
      }

      const data =
        await response.json();

      return (
        data &&
        data.ok === true
      );

    } catch (error) {
      console.warn(
        "CASEVO API health check failed:",
        error
      );

      return false;
    }
  }


  /* =======================================================
     RESULT STYLES
     -------------------------------------------------------
     These styles are injected only for the results
     generated by this script. They do not replace
     style.css.
     ======================================================= */

  function injectResultStyles() {
    if (
      document.getElementById(
        "casevoDynamicStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "casevoDynamicStyles";

    style.textContent = `

      /* ===============================================
         CASEVO RESULTS
         =============================================== */

      .casevo-results-container {
        width: 100%;
        box-sizing: border-box;
      }

      .casevo-results {
        width: 100%;
        margin: 70px 0 0;
        padding: 80px 0;
        background: #1d1b18;
        color: #f7f0e4;
        box-sizing: border-box;
      }

      .casevo-results-inner {
        width: min(1100px, calc(100% - 48px));
        margin: 0 auto;
        box-sizing: border-box;
      }

      .casevo-section-label {
        font-size: 11px;
        line-height: 1.4;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 16px;
        opacity: 0.75;
      }

      .casevo-results h2 {
        margin: 0;
        font-size: clamp(38px, 5vw, 68px);
        line-height: 0.98;
        letter-spacing: -0.035em;
        font-weight: 500;
      }

      .casevo-results h3 {
        margin: 0 0 22px;
        font-size: 30px;
        line-height: 1.1;
        font-weight: 500;
      }

      .casevo-results p {
        color: rgba(247,240,228,0.72);
        line-height: 1.7;
      }

      .casevo-result-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 50px;
        padding-bottom: 55px;
        border-bottom: 1px solid rgba(247,240,228,0.18);
      }

      .casevo-result-header > div:first-child {
        max-width: 720px;
      }

      .casevo-score-card {
        min-width: 190px;
        padding: 24px;
        border: 1px solid rgba(247,240,228,0.22);
        text-align: right;
        box-sizing: border-box;
      }

      .casevo-score-caption {
        font-size: 10px;
        letter-spacing: 0.16em;
        font-weight: 700;
        opacity: 0.65;
        margin-bottom: 12px;
      }

      .casevo-score-number {
        font-size: 54px;
        line-height: 1;
        font-weight: 600;
      }

      .casevo-score-number span {
        font-size: 18px;
        opacity: 0.5;
      }

      .casevo-score-label {
        margin-top: 10px;
        font-size: 12px;
        opacity: 0.7;
      }

      .casevo-result-grid {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 1px;
        margin-top: 55px;
        background: rgba(247,240,228,0.16);
        border: 1px solid rgba(247,240,228,0.16);
      }

      .casevo-result-card {
        min-height: 125px;
        padding: 24px;
        background: #1d1b18;
        box-sizing: border-box;
      }

      .casevo-card-label {
        font-size: 10px;
        line-height: 1.4;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        opacity: 0.55;
        margin-bottom: 12px;
      }

      .casevo-card-value {
        font-size: 17px;
        line-height: 1.45;
      }

      .casevo-analysis-section {
        margin-top: 70px;
        padding-top: 45px;
        border-top: 1px solid rgba(247,240,228,0.18);
      }

      .casevo-metrics {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 35px;
      }

      .casevo-metric-top {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        font-size: 13px;
        margin-bottom: 10px;
      }

      .casevo-metric-top strong {
        font-weight: 600;
      }

      .casevo-metric-track {
        height: 5px;
        background: rgba(247,240,228,0.15);
        overflow: hidden;
      }

      .casevo-metric-fill {
        height: 100%;
        background: #f7f0e4;
        transition: width 0.7s ease;
      }

      .casevo-note {
        margin-top: 30px;
        padding: 20px;
        border-left: 2px solid #b52d24;
        background: rgba(247,240,228,0.05);
        color: rgba(247,240,228,0.75);
        line-height: 1.7;
        font-size: 14px;
      }

      .casevo-requirements {
        border-top: 1px solid rgba(247,240,228,0.15);
      }

      .casevo-requirement {
        display: flex;
        gap: 15px;
        padding: 17px 0;
        border-bottom: 1px solid rgba(247,240,228,0.12);
        line-height: 1.5;
      }

      .casevo-requirement span:first-child {
        color: #b52d24;
        font-weight: 700;
      }

      .casevo-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 35px;
      }

      .casevo-tag {
        display: inline-flex;
        padding: 8px 12px;
        border: 1px solid rgba(247,240,228,0.22);
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.8;
      }

      .casevo-certifications {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .casevo-certifications span {
        padding: 10px 14px;
        border: 1px solid rgba(247,240,228,0.2);
        font-size: 12px;
      }

      .casevo-detail-grid {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 1px;
        margin-top: 45px;
        background: rgba(247,240,228,0.16);
      }

      .casevo-detail-item {
        padding: 24px;
        background: #1d1b18;
      }

      .casevo-detail-value {
        font-size: 16px;
      }

      .casevo-disclaimer {
        max-width: 760px;
        margin-bottom: 35px;
      }

      .casevo-supplier-list {
        display: grid;
        gap: 14px;
      }

      .casevo-supplier-card {
        padding: 28px;
        border: 1px solid rgba(247,240,228,0.18);
        box-sizing: border-box;
      }

      .casevo-supplier-top {
        display: flex;
        justify-content: space-between;
        gap: 30px;
      }

      .casevo-supplier-index {
        font-size: 10px;
        letter-spacing: 0.14em;
        opacity: 0.45;
        margin-bottom: 9px;
      }

      .casevo-supplier-card h4 {
        margin: 0 0 7px;
        font-size: 21px;
        font-weight: 500;
      }

      .casevo-supplier-location {
        font-size: 13px;
        opacity: 0.6;
      }

      .casevo-match {
        min-width: 90px;
        text-align: right;
      }

      .casevo-match-label {
        font-size: 9px;
        letter-spacing: 0.14em;
        opacity: 0.5;
        margin-bottom: 6px;
      }

      .casevo-match-score {
        font-size: 28px;
        font-weight: 600;
      }

      .casevo-supplier-note {
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid rgba(247,240,228,0.12);
        font-size: 13px;
        line-height: 1.7;
        color: rgba(247,240,228,0.68);
      }

      .casevo-supplier-status {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 20px;
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.6;
      }

      .casevo-supplier-status span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #b52d24;
        display: inline-block;
      }

      .casevo-empty {
        padding: 30px;
        border: 1px solid rgba(247,240,228,0.15);
        color: rgba(247,240,228,0.65);
      }

      .casevo-next-step {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 40px;
        margin-top: 75px;
        padding: 35px;
        background: #f7f0e4;
        color: #1d1b18;
        box-sizing: border-box;
      }

      .casevo-next-step p {
        color: rgba(29,27,24,0.65);
        max-width: 620px;
        margin-bottom: 0;
      }

      .casevo-next-button,
      .casevo-retry-button {
        border: 0;
        background: #b52d24;
        color: #fff;
        padding: 17px 22px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
      }

      .casevo-next-button:hover,
      .casevo-retry-button:hover {
        opacity: 0.9;
      }

      .casevo-next-button:disabled {
        opacity: 0.55;
        cursor: default;
      }

      .casevo-verification-message {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-top: 20px;
        font-size: 13px;
      }

      .casevo-verification-message span {
        opacity: 0.65;
      }

      .casevo-result-footer {
        margin-top: 55px;
        padding-top: 25px;
        border-top: 1px solid rgba(247,240,228,0.15);
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        opacity: 0.45;
      }

      /* ===============================================
         LOADING
         =============================================== */

      .casevo-loading {
        min-height: 350px;
        display: flex;
        align-items: center;
        box-sizing: border-box;
      }

      .casevo-loader {
        display: flex;
        gap: 7px;
        margin-top: 35px;
      }

      .casevo-loader span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #b52d24;
        animation: casevoPulse 1.1s infinite ease-in-out;
      }

      .casevo-loader span:nth-child(2) {
        animation-delay: 0.15s;
      }

      .casevo-loader span:nth-child(3) {
        animation-delay: 0.3s;
      }

      @keyframes casevoPulse {
        0%, 80%, 100% {
          opacity: 0.25;
          transform: translateY(0);
        }

        40% {
          opacity: 1;
          transform: translateY(-5px);
        }
      }

      /* ===============================================
         ERROR
         =============================================== */

      .casevo-error {
        background: #f7f0e4;
        color: #1d1b18;
        border-top: 1px solid rgba(29,27,24,0.15);
        border-bottom: 1px solid rgba(29,27,24,0.15);
      }

      .casevo-error p {
        color: rgba(29,27,24,0.65);
        max-width: 700px;
      }

      /* ===============================================
         MOBILE
         =============================================== */

      @media (max-width: 850px) {

        .casevo-results {
          padding: 55px 0;
        }

        .casevo-results-inner {
          width: min(
            100% - 30px,
            1100px
          );
        }

        .casevo-result-header {
          flex-direction: column;
          gap: 30px;
        }

        .casevo-score-card {
          width: 100%;
          text-align: left;
        }

        .casevo-result-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .casevo-metrics {
          grid-template-columns: 1fr;
          gap: 25px;
        }

        .casevo-detail-grid {
          grid-template-columns: 1fr;
        }

        .casevo-next-step {
          flex-direction: column;
          align-items: flex-start;
        }

      }

      @media (max-width: 560px) {

        .casevo-result-grid {
          grid-template-columns: 1fr;
        }

        .casevo-supplier-top {
          flex-direction: column;
        }

        .casevo-match {
          text-align: left;
        }

        .casevo-next-button,
        .casevo-retry-button {
          width: 100%;
        }

      }

    `;

    document.head.appendChild(
      style
    );
  }


  /* =======================================================
     DEBUG INFORMATION
     ======================================================= */

  window.CASEVO = {
    version: "MVP-3 Frontend",

    apiEndpoint:
      API_ENDPOINT,

    healthEndpoint:
      HEALTH_ENDPOINT,

    findForm:
      findSourcingForm,

    checkHealth:
      checkAPIHealth,

    analyze:
      function () {
        const form =
          findSourcingForm();

        if (!form) {
          console.error(
            "CASEVO: sourcing form not found."
          );

          return;
        }

        submitSourcingRequest(
          getFormFields(form)
        );
      }
  };


  /* =======================================================
     STARTUP LOG
     ======================================================= */

  console.log(
    "CASEVO AI Sourcing frontend loaded."
  );

  console.log(
    "CASEVO API:",
    API_ENDPOINT
  );

})();
