/* ============================================================
   CASEVO AI SOURCING — FINAL CLEAN FRONTEND
   ============================================================

   IMPORTANT:
   - Uses the EXISTING #results container in index.html.
   - Uses the EXISTING #brief container.
   - Uses the EXISTING #supplierGrid container.
   - NEVER creates #casevo-results.
   - NEVER inserts anything after the sourcing form.
   - NEVER changes the page's main grid structure.
   - Sends sourcing requests to /api/sourcing.
   - Supports the current CASEVO Worker response format.
   - Prevents long URLs/text from breaking the layout.
   - Does not invent supplier information.
   ============================================================ */

(function () {
  "use strict";

  /* ==========================================================
     CONFIG
     ========================================================== */

  const API_ENDPOINT = "/api/sourcing";

  const MAX_SUPPLIERS = 12;

  console.log(
    "CASEVO: Final clean frontend loaded."
  );

  console.log(
    "CASEVO API endpoint:",
    API_ENDPOINT
  );


  /* ==========================================================
     BASIC DOM HELPERS
     ========================================================== */

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }


  function qsa(selector, root) {
    return Array.from(
      (root || document).querySelectorAll(selector)
    );
  }


  function clean(value) {
    if (
      value === null ||
      typeof value === "undefined"
    ) {
      return "";
    }

    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }


  function escapeHtml(value) {
    return String(
      value === null ||
      typeof value === "undefined"
        ? ""
        : value
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function escapeAttr(value) {
    return escapeHtml(value);
  }


  function firstNonEmpty() {
    for (const value of arguments) {
      const result = clean(value);

      if (result) {
        return result;
      }
    }

    return "";
  }


  function firstExisting(
    selectors,
    root
  ) {
    for (const selector of selectors) {
      const element = qs(
        selector,
        root
      );

      if (element) {
        return element;
      }
    }

    return null;
  }


  function textOf(element) {
    if (!element) {
      return "";
    }

    if (
      "value" in element
    ) {
      return clean(
        element.value
      );
    }

    return clean(
      element.textContent
    );
  }


  /* ==========================================================
     FIND SOURCING FORM
     ========================================================== */

  function findSourcingForm() {
    const explicit =
      firstExisting([
        "#sourcingForm",
        "#sourcing-form",
        "#ai-sourcing-form",
        "#aiSourcingForm",
        "form[data-sourcing-form]"
      ]);

    if (explicit) {
      return explicit;
    }


    const forms =
      qsa("form");


    if (!forms.length) {
      return null;
    }


    const sourcingForm =
      forms.find(
        function (form) {
          const text =
            clean(
              form.innerText ||
              form.textContent ||
              ""
            ).toLowerCase();

          return (
            text.includes(
              "what are you sourcing"
            ) ||
            text.includes(
              "product / material"
            ) ||
            text.includes(
              "quantity"
            ) ||
            text.includes(
              "target price"
            ) ||
            text.includes(
              "destination"
            )
          );
        }
      );


    return (
      sourcingForm ||
      forms[0]
    );
  }


  const form =
    findSourcingForm();


  if (!form) {
    console.warn(
      "CASEVO: Sourcing form not found."
    );

    return;
  }


  /* ==========================================================
     FIND EXISTING RESULT STRUCTURE
     ========================================================== */

  /*
   * IMPORTANT:
   *
   * index.html already contains:
   *
   * #results
   * #brief
   * #supplierGrid
   *
   * We MUST use those elements.
   *
   * We DO NOT create a second result container.
   */

  const resultContainer =
    qs("#results");

  const briefContainer =
    qs("#brief");

  const supplierGrid =
    qs("#supplierGrid");

  const resultTitle =
    qs("#resultTitle");


  if (!resultContainer) {
    console.error(
      "CASEVO: #results was not found."
    );

    return;
  }


  if (!briefContainer) {
    console.warn(
      "CASEVO: #brief was not found."
    );
  }


  if (!supplierGrid) {
    console.error(
      "CASEVO: #supplierGrid was not found."
    );

    return;
  }


  /* ==========================================================
     FIELD DISCOVERY
     ========================================================== */

  function findRequirementField() {
    return firstExisting(
      [
        "#request",
        "#requirement",
        "#requirements",
        "#sourcing-requirement",
        "#sourcingRequirement",
        "#sourcingBrief",
        'textarea[name="requirement"]',
        'textarea[name="requirements"]',
        'textarea[name="request"]',
        'textarea[name="brief"]',
        "textarea"
      ],
      form
    );
  }


  function findInputField(
    ids,
    names,
    labelWords
  ) {
    const selectors = [];


    (ids || []).forEach(
      function (id) {
        selectors.push(id);
      }
    );


    (names || []).forEach(
      function (name) {
        selectors.push(
          'input[name="' +
          name +
          '"]'
        );
      }
    );


    const direct =
      firstExisting(
        selectors,
        form
      );


    if (direct) {
      return direct;
    }


    const inputs =
      qsa(
        "input",
        form
      );


    const matching =
      inputs.find(
        function (input) {
          const text = (
            clean(input.name) +
            " " +
            clean(input.id) +
            " " +
            clean(input.placeholder)
          ).toLowerCase();


          return (
            labelWords || []
          ).some(
            function (word) {
              return text.includes(
                String(word)
                  .toLowerCase()
              );
            }
          );
        }
      );


    return matching || null;
  }


  const requirementField =
    findRequirementField();


  const productField =
    findInputField(
      [
        "#product",
        "#product-material",
        "#productMaterial"
      ],
      [
        "product",
        "material",
        "product_material"
      ],
      [
        "product",
        "material"
      ]
    );


  const quantityField =
    findInputField(
      [
        "#quantity"
      ],
      [
        "quantity"
      ],
      [
        "quantity"
      ]
    );


  const targetPriceField =
    findInputField(
      [
        "#price",
        "#target-price",
        "#targetPrice"
      ],
      [
        "price",
        "target_price",
        "targetPrice"
      ],
      [
        "price",
        "target"
      ]
    );


  const destinationField =
    findInputField(
      [
        "#destination"
      ],
      [
        "destination"
      ],
      [
        "destination"
      ]
    );


  /* ==========================================================
     SUBMIT BUTTON
     ========================================================== */

  let submitButton =
    firstExisting(
      [
        "#analyze-button",
        "#analyzeButton",
        "#find-matches",
        "#findMatches",
        'button[type="submit"]',
        'input[type="submit"]'
      ],
      form
    );


  if (!submitButton) {
    submitButton =
      qsa(
        "button",
        form
      ).find(
        function (button) {
          return /analy|match|source|find/i.test(
            button.textContent || ""
          );
        }
      );
  }


  /* ==========================================================
     FORM VALUES
     ========================================================== */

  function getFormValues() {
    return {
      requirement:
        textOf(
          requirementField
        ),

      product:
        textOf(
          productField
        ),

      quantity:
        textOf(
          quantityField
        ),

      targetPrice:
        textOf(
          targetPriceField
        ),

      destination:
        textOf(
          destinationField
        )
    };
  }


  /* ==========================================================
     FALLBACK PRODUCT EXTRACTION
     ========================================================== */

  function extractProduct(
    requirement
  ) {
    const text =
      clean(requirement);


    if (!text) {
      return "";
    }


    const lower =
      text.toLowerCase();


    const patterns = [
      {
        test:
          "full-grain leather shoe upper",
        value:
          "Premium full-grain leather shoe upper"
      },

      {
        test:
          "full grain leather shoe upper",
        value:
          "Premium full-grain leather shoe upper"
      },

      {
        test:
          "leather shoe upper",
        value:
          "Leather shoe upper"
      },

      {
        test:
          "shoe upper",
        value:
          "Shoe upper"
      },

      {
        test:
          "upper leather",
        value:
          "Upper leather"
      },

      {
        test:
          "genuine leather",
        value:
          "Genuine leather"
      },

      {
        test:
          "cow leather",
        value:
          "Cow leather"
      },

      {
        test:
          "leather",
        value:
          "Leather"
      },

      {
        test:
          "sneaker",
        value:
          "Sneaker"
      },

      {
        test:
          "footwear",
        value:
          "Footwear"
      },

      {
        test:
          "rubber",
        value:
          "Rubber"
      },

      {
        test:
          "textile",
        value:
          "Textile"
      },

      {
        test:
          "fabric",
        value:
          "Fabric"
      }
    ];


    for (
      const item of patterns
    ) {
      if (
        lower.includes(
          item.test
        )
      ) {
        return item.value;
      }
    }


    return "";
  }


  /* ==========================================================
     FALLBACK QUANTITY EXTRACTION
     ========================================================== */

  function extractQuantity(
    requirement
  ) {
    const text =
      clean(requirement);


    const match =
      text.match(
        /(\d[\d,.\s]*)\s*(pairs?|pcs?|pieces?|kg|tons?|mt|sqm|sqft|units?)/i
      );


    return match
      ? clean(match[0])
      : "";
  }


  /* ==========================================================
     FALLBACK PRICE EXTRACTION
     ========================================================== */

  function extractPrice(
    requirement
  ) {
    const text =
      clean(requirement);


    const match =
      text.match(
        /(?:usd|us\$|\$)\s*[\d,.]+(?:\s*(?:per|\/)\s*[a-zA-Z0-9 ]+)?/i
      );


    return match
      ? clean(match[0])
      : "";
  }


  /* ==========================================================
     FALLBACK DESTINATION EXTRACTION
     ========================================================== */

  function extractDestination(
    requirement
  ) {
    const text =
      clean(requirement);


    const lower =
      text.toLowerCase();


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


    for (
      const destination
      of destinations
    ) {
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
     READINESS CALCULATION
     ========================================================== */

  function calculateReadiness(
    values
  ) {
    const requirement =
      clean(
        values.requirement
      );


    const product =
      clean(
        values.product
      ) ||
      extractProduct(
        requirement
      );


    const quantity =
      clean(
        values.quantity
      ) ||
      extractQuantity(
        requirement
      );


    const targetPrice =
      clean(
        values.targetPrice
      ) ||
      extractPrice(
        requirement
      );


    const destination =
      clean(
        values.destination
      ) ||
      extractDestination(
        requirement
      );


    let clarity = 20;

    let specification = 15;

    let commercial = 20;


    if (
      requirement.length >= 20
    ) {
      clarity += 20;
    }


    if (product) {
      clarity += 15;
      specification += 10;
    }


    if (
      /1\.?\s*4\s*mm|thickness|mm\b/i.test(
        requirement
      )
    ) {
      specification += 20;
    }


    if (
      /full[- ]?grain|grain|genuine leather|leather/i.test(
        requirement
      )
    ) {
      specification += 10;
    }


    if (
      /black|brown|white|red|blue|color|colour/i.test(
        requirement
      )
    ) {
      specification += 5;
    }


    if (quantity) {
      commercial += 20;
    }


    if (targetPrice) {
      commercial += 20;
    }


    if (destination) {
      commercial += 15;
    }


    clarity =
      Math.min(
        100,
        clarity
      );


    specification =
      Math.min(
        100,
        specification
      );


    commercial =
      Math.min(
        100,
        commercial
      );


    const score =
      Math.round(
        (
          clarity +
          specification +
          commercial
        ) / 3
      );


    return {
      score,
      clarity,
      specification,
      commercial
    };
  }


  /* ==========================================================
     RESPONSE NORMALIZATION
     ========================================================== */

  function normalizeApiResponse(
    data,
    formValues
  ) {
    const root =
      data || {};


    const analysis =
      root.analysis ||
      {};


    const brief =
      root.brief ||
      {};


    /*
     * Current Worker:
     *
     * data.analysis.product
     * data.analysis.quantity
     * data.analysis.targetPrice
     * data.analysis.destination
     * data.analysis.requirement
     * data.matches
     *
     *
     * Older Worker:
     *
     * data.analysis.normalized
     * data.analysis.scoring
     * data.analysis.matches
     */

    const normalized =
      analysis.normalized ||
      {};


    const requirement =
      firstNonEmpty(
        analysis.requirement,
        normalized.requirement,
        brief.requirement,
        formValues.requirement
      );


    const product =
      firstNonEmpty(
        analysis.product,
        normalized.product,
        brief.product,
        formValues.product,
        extractProduct(
          requirement
        )
      );


    const quantity =
      firstNonEmpty(
        analysis.quantity,
        normalized.quantity,
        brief.quantity,
        formValues.quantity,
        extractQuantity(
          requirement
        )
      );


    const targetPrice =
      firstNonEmpty(
        analysis.targetPrice,
        analysis.target_price,
        normalized.targetPrice,
        normalized.target_price,
        brief.targetPrice,
        brief.target_price,
        formValues.targetPrice,
        extractPrice(
          requirement
        )
      );


    const destination =
      firstNonEmpty(
        analysis.destination,
        normalized.destination,
        brief.destination,
        formValues.destination,
        extractDestination(
          requirement
        )
      );


    let matches = [];


    if (
      Array.isArray(
        root.matches
      )
    ) {
      matches =
        root.matches;
    } else if (
      Array.isArray(
        analysis.matches
      )
    ) {
      matches =
        analysis.matches;
    } else if (
      Array.isArray(
        normalized.matches
      )
    ) {
      matches =
        normalized.matches;
    }


    const workerScoring =
      analysis.scoring ||
      root.scoring ||
      {};


    const calculated =
      calculateReadiness({
        requirement,
        product,
        quantity,
        targetPrice,
        destination
      });


    const score =
      workerScoring.score ??
      root.score ??
      analysis.score ??
      calculated.score;


    const clarity =
      workerScoring.clarity ??
      calculated.clarity;


    const specification =
      workerScoring.specification ??
      workerScoring.specificationQuality ??
      calculated.specification;


    const commercial =
      workerScoring.commercial ??
      workerScoring.commercialReadiness ??
      calculated.commercial;


    const meta =
      root.meta ||
      {};


    return {
      requestId:
        firstNonEmpty(
          root.requestId,
          root.request_id
        ),

      message:
        firstNonEmpty(
          root.message
        ),

      requirement,

      product,

      quantity,

      targetPrice,

      destination,

      score,

      clarity,

      specification,

      commercial,

      scoringNote:
        firstNonEmpty(
          workerScoring.note,
          root.scoringNote
        ),

      matches,

      meta
    };
  }


  /* ==========================================================
     SAFE URL
     ========================================================== */

  function safeUrl(
    value
  ) {
    const url =
      clean(value);


    if (!url) {
      return "";
    }


    try {
      const parsed =
        new URL(
          url,
          window.location.href
        );


      if (
        parsed.protocol !==
          "http:" &&
        parsed.protocol !==
          "https:"
      ) {
        return "";
      }


      return parsed.href;
    } catch {
      return "";
    }
  }


  /* ==========================================================
     CLEAN WEB TEXT
     ========================================================== */

  function cleanWebText(
    value
  ) {
    let text =
      clean(value);


    if (!text) {
      return "";
    }


    /*
     * Remove markdown images.
     */

    text =
      text.replace(
        /!\[[^\]]*\]\([^)]+\)/g,
        ""
      );


    /*
     * Convert markdown links
     * to their visible text.
     */

    text =
      text.replace(
        /\[([^\]]+)\]\([^)]+\)/g,
        "$1"
      );


    /*
     * Remove raw http/https URLs.
     *
     * This is important because
     * Tavily pages can contain extremely
     * long URLs that otherwise stretch
     * the visual layout.
     */

    text =
      text.replace(
        /https?:\/\/\S+/gi,
        ""
      );


    /*
     * Remove repeated whitespace.
     */

    text =
      text.replace(
        /\s+/g,
        " "
      );


    /*
     * Remove excessive repeated
     * punctuation.
     */

    text =
      text.replace(
        /([|])\1+/g,
        "$1"
      );


    text =
      text.replace(
        /(\.{4,})/g,
        "..."
      );


    return text.trim();
  }


  /* ==========================================================
     SUPPLIER LOCATION
     ========================================================== */

  function getSupplierLocation(
    supplier
  ) {
    return firstNonEmpty(
      supplier.location,
      supplier.country,
      supplier.region,
      supplier.city,
      supplier.address,
      "Not determined"
    );
  }


  /* ==========================================================
     SUPPLIER NAME
     ========================================================== */

  function getSupplierName(
    supplier,
    index
  ) {
    return firstNonEmpty(
      supplier.name,
      supplier.company,
      supplier.supplier,
      supplier.title,
      supplier.domain,
      `Supplier result ${index + 1}`
    );
  }


  /* ==========================================================
     SUPPLIER SCORE
     ========================================================== */

  function getSupplierScore(
    supplier
  ) {
    const raw =
      supplier.matchScore ??
      supplier.match_score ??
      supplier.score ??
      supplier.match;


    if (
      raw === null ||
      typeof raw === "undefined" ||
      raw === ""
    ) {
      return "—";
    }


    const number =
      Number(
        String(raw)
          .replace("%", "")
          .trim()
      );


    if (
      Number.isFinite(
        number
      )
    ) {
      return Math.max(
        0,
        Math.min(
          100,
          Math.round(
            number
          )
        )
      );
    }


    return clean(raw);
  }


  /* ==========================================================
     SUPPLIER CAPABILITY
     ========================================================== */

  function getSupplierCapability(
    supplier
  ) {
    return cleanWebText(
      firstNonEmpty(
        supplier.capability,
        supplier.description,
        supplier.note,
        supplier.summary,
        supplier.content
      )
    );
  }


  /* ==========================================================
     SUPPLIER EVIDENCE
     ========================================================== */

  function getSupplierEvidence(
    supplier
  ) {
    return cleanWebText(
      firstNonEmpty(
        supplier.evidence,
        supplier.snippet,
        supplier.content
      )
    );
  }


  /* ==========================================================
     SUPPLIER WEBSITE
     ========================================================== */

  function getSupplierWebsite(
    supplier
  ) {
    return safeUrl(
      firstNonEmpty(
        supplier.website,
        supplier.url,
        supplier.link
      )
    );
  }


  /* ==========================================================
     SUPPLIER VERIFICATION
     ========================================================== */

  function getVerificationStatus(
    supplier
  ) {
    return firstNonEmpty(
      supplier.verificationStatus,
      supplier.verification_status,
      supplier.verification,
      "Unverified — due diligence required"
    );
  }


  /* ==========================================================
     RUNTIME CSS
     ========================================================== */

  function installRuntimeStyles() {
    if (
      qs(
        "#casevo-clean-runtime-styles"
      )
    ) {
      return;
    }


    const style =
      document.createElement(
        "style"
      );


    style.id =
      "casevo-clean-runtime-styles";


    style.textContent = `
      /*
       * CASEVO FINAL FRONTEND SAFETY
       *
       * These rules are scoped to the existing
       * result section only.
       */

      #results {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        overflow: hidden;
      }

      #results *,
      #results *::before,
      #results *::after {
        box-sizing: border-box;
      }

      #brief {
        width: 100%;
        min-width: 0;
        max-width: 100%;
        overflow: hidden;
      }

      #supplierGrid {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        display: grid;
        grid-template-columns:
          repeat(
            3,
            minmax(0, 1fr)
          );
        gap: 18px;
        align-items: stretch;
      }

      #supplierGrid .supplier {
        width: 100%;
        min-width: 0;
        max-width: 100%;
        overflow: hidden;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      #supplierGrid .supplier-top {
        min-width: 0;
        max-width: 100%;
        gap: 12px;
      }

      #supplierGrid .supplier-top > div:first-child {
        min-width: 0;
        max-width: 100%;
      }

      #supplierGrid h4 {
        min-width: 0;
        max-width: 100%;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      #supplierGrid p,
      #supplierGrid div,
      #supplierGrid span,
      #supplierGrid small,
      #supplierGrid a {
        max-width: 100%;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      #supplierGrid .supplier-meta {
        min-width: 0;
      }

      #supplierGrid .supplier-meta div {
        min-width: 0;
        gap: 12px;
      }

      #supplierGrid .supplier-meta span,
      #supplierGrid .supplier-meta strong {
        min-width: 0;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      #results.casevo-error-results {
        border-top-color: #a92d25;
      }

      .casevo-error-box {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        border: 1px solid #a92d25;
        padding: 24px;
        background: rgba(255, 250, 241, .55);
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .casevo-error-box .eyebrow {
        color: #a92d25;
      }

      .casevo-error-box h3 {
        margin: 8px 0 10px;
        font-family: "Playfair Display", Georgia, serif;
        font-weight: 500;
        line-height: 1.1;
      }

      .casevo-loading-box {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        border: 1px solid var(--line);
        padding: 24px;
        background: rgba(255, 250, 241, .45);
      }

      .casevo-loading-box h3 {
        margin: 8px 0 8px;
        font-family: "Playfair Display", Georgia, serif;
        font-weight: 500;
      }

      @media (max-width: 900px) {
        #supplierGrid {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }
      }

      @media (max-width: 600px) {
        #supplierGrid {
          grid-template-columns: 1fr;
        }

        #supplierGrid .supplier-top {
          display: flex;
          flex-direction: column;
        }

        #supplierGrid .score-number {
          align-self: flex-start;
        }
      }
    `;


    document.head.appendChild(
      style
    );
  }


  installRuntimeStyles();


  /* ==========================================================
     SHOW RESULTS
     ========================================================== */

  function showResults() {
    resultContainer.hidden =
      false;

    resultContainer.style.display =
      "";


    /*
     * IMPORTANT:
     * Scroll only to the existing result section.
     * Never move or insert the container.
     */

    setTimeout(
      function () {
        try {
          resultContainer.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        } catch {
          // Ignore scroll errors.
        }
      },
      50
    );
  }


  /* ==========================================================
     HIDE RESULTS
     ========================================================== */

  function hideResults() {
    resultContainer.hidden =
      true;
  }


  /* ==========================================================
     BUTTON LOADING STATE
     ========================================================== */

  function setButtonLoading(
    loading
  ) {
    if (!submitButton) {
      return;
    }


    if (loading) {
      if (
        !submitButton.dataset
          .casevoOriginalText
      ) {
        submitButton.dataset
          .casevoOriginalText =
          submitButton.tagName
            .toLowerCase() ===
          "input"
            ? (
                submitButton.value ||
                "Analyze & Find Matches"
              )
            : (
                submitButton.textContent ||
                "Analyze & Find Matches"
              );
      }


      submitButton.disabled =
        true;


      submitButton.style.opacity =
        "0.65";


      submitButton.style.cursor =
        "wait";


      if (
        submitButton.tagName
          .toLowerCase() ===
        "input"
      ) {
        submitButton.value =
          "Analyzing...";
      } else {
        submitButton.innerText =
          "Analyzing...";
      }

    } else {
      submitButton.disabled =
        false;


      submitButton.style.opacity =
        "";


      submitButton.style.cursor =
        "";


      const original =
        submitButton.dataset
          .casevoOriginalText ||
        "Analyze & Find Matches";


      if (
        submitButton.tagName
          .toLowerCase() ===
        "input"
      ) {
        submitButton.value =
          original;
      } else {
        submitButton.innerText =
          original;
      }
    }
  }


  /* ==========================================================
     LOADING RENDER
     ========================================================== */

  function renderLoading() {
    showResults();


    if (resultTitle) {
      resultTitle.textContent =
        "Analyzing sourcing requirement...";
    }


    if (briefContainer) {
      briefContainer.innerHTML =
        `
          <span>
            CASEVO AI is structuring your sourcing request.
          </span>
        `;
    }


    supplierGrid.innerHTML =
      `
        <div
          class="casevo-loading-box"
          style="grid-column:1/-1;"
        >
          <div class="eyebrow">
            CASEVO AI / SOURCING ANALYSIS
          </div>

          <h3>
            Searching public supplier information.
          </h3>

          <p style="
            margin:0;
            color:var(--muted);
            font-size:12px;
            line-height:1.6;
          ">
            CASEVO is analyzing the requirement,
            matching supplier capabilities and
            preparing the sourcing shortlist.
          </p>
        </div>
      `;
  }


  /* ==========================================================
     ERROR RENDER
     ========================================================== */

  function renderError(
    message,
    requestId
  ) {
    showResults();


    resultContainer.classList.add(
      "casevo-error-results"
    );


    if (resultTitle) {
      resultTitle.textContent =
        "Supplier discovery could not be completed.";
    }


    if (briefContainer) {
      briefContainer.innerHTML =
        `
          <span>
            CASEVO AI / ERROR
          </span>
        `;
    }


    supplierGrid.innerHTML =
      `
        <div
          class="casevo-error-box"
          style="grid-column:1/-1;"
        >
          <div class="eyebrow">
            CASEVO AI / ERROR
          </div>

          <h3>
            Supplier discovery could not be completed.
          </h3>

          <p style="
            margin:0;
            color:var(--muted);
            font-size:12px;
            line-height:1.6;
          ">
            ${escapeHtml(
              firstNonEmpty(
                message,
                "The sourcing analysis request failed."
              )
            )}
          </p>

          ${
            requestId
              ? `
                <div style="
                  margin-top:16px;
                  padding-top:12px;
                  border-top:1px solid var(--line);
                  font-size:10px;
                  color:var(--muted);
                  overflow-wrap:anywhere;
                  word-break:break-word;
                ">
                  Request ID:
                  ${escapeHtml(requestId)}
                </div>
              `
              : ""
          }
        </div>
      `;


    /*
     * Keep the normal result structure.
     * Do not create another container.
     */
  }


  /* ==========================================================
     INFO ROW
     ========================================================== */

  function briefItem(
    label,
    value
  ) {
    return `
      <span>
        <strong style="
          font-size:9px;
          letter-spacing:.12em;
          text-transform:uppercase;
          margin-right:7px;
          color:var(--muted);
        ">
          ${escapeHtml(label)}
        </strong>

        ${escapeHtml(
          value || "Not specified"
        )}
      </span>
    `;
  }


  /* ==========================================================
     SUPPLIER CARD
     ========================================================== */

  function renderSupplier(
    supplier,
    index
  ) {
    const item =
      supplier || {};


    const name =
      getSupplierName(
        item,
        index
      );


    const location =
      getSupplierLocation(
        item
      );


    const score =
      getSupplierScore(
        item
      );


    const capability =
      getSupplierCapability(
        item
      );


    const evidence =
      getSupplierEvidence(
        item
      );


    const website =
      getSupplierWebsite(
        item
      );


    const verification =
      getVerificationStatus(
        item
      );


    /*
     * If capability and evidence are identical,
     * do not display the same long text twice.
     */

    const showEvidence =
      evidence &&
      evidence !== capability;


    return `
      <article
        class="supplier"
        data-casevo-supplier="${index + 1}"
      >

        <div class="supplier-top">

          <div
            style="
              min-width:0;
              max-width:100%;
            "
          >

            <small>
              SUPPLIER ${index + 1}
            </small>

            <h4>
              ${escapeHtml(name)}
            </h4>

            <small>
              ${escapeHtml(location)}
            </small>

          </div>

          <div
            class="score-number"
            style="
              flex:0 0 auto;
              white-space:nowrap;
            "
          >
            ${escapeHtml(score)}%
          </div>

        </div>


        ${
          capability
            ? `
              <div
                style="
                  margin-top:14px;
                  font-size:12px;
                  line-height:1.6;
                  color:var(--muted);
                  overflow-wrap:anywhere;
                  word-break:break-word;
                "
              >
                ${escapeHtml(
                  capability
                )}
              </div>
            `
            : ""
        }


        ${
          showEvidence
            ? `
              <div
                style="
                  margin-top:14px;
                  padding-top:12px;
                  border-top:1px solid var(--line);
                  font-size:11px;
                  line-height:1.6;
                  color:var(--muted);
                  overflow-wrap:anywhere;
                  word-break:break-word;
                "
              >
                ${escapeHtml(
                  evidence
                )}
              </div>
            `
            : ""
        }


        ${
          website
            ? `
              <a
                href="${escapeAttr(website)}"
                target="_blank"
                rel="noopener noreferrer"
                style="
                  display:inline-block;
                  margin-top:16px;
                  color:var(--red);
                  font-size:10px;
                  text-decoration:none;
                  overflow-wrap:anywhere;
                  word-break:break-word;
                "
              >
                Visit supplier website →
              </a>
            `
            : ""
        }


        <div
          class="verified"
          style="
            max-width:100%;
            overflow-wrap:anywhere;
            word-break:break-word;
            white-space:normal;
          "
        >
          ${escapeHtml(
            verification
          )}
        </div>

      </article>
    `;
  }


  /* ==========================================================
     RESULT RENDER
     ========================================================== */

  function renderResult(
    data,
    formValues
  ) {
    resultContainer.classList.remove(
      "casevo-error-results"
    );


    const result =
      normalizeApiResponse(
        data,
        formValues
      );


    showResults();


    /*
     * ----------------------------------------------------------
     * RESULT TITLE
     * ----------------------------------------------------------
     */

    const matches =
      Array.isArray(
        result.matches
      )
        ? result.matches
        : [];


    if (resultTitle) {
      resultTitle.textContent =
        matches.length
          ? "Supplier matches"
          : "No verified supplier matches were returned.";
    }


    /*
     * ----------------------------------------------------------
     * BRIEF
     * ----------------------------------------------------------
     */

    if (briefContainer) {
      briefContainer.innerHTML =
        [
          briefItem(
            "Product / Material",
            result.product
          ),

          briefItem(
            "Quantity",
            result.quantity
          ),

          briefItem(
            "Target Price",
            result.targetPrice
          ),

          briefItem(
            "Destination",
            result.destination
          ),

          briefItem(
            "Requirement clarity",
            `${result.clarity}%`
          ),

          briefItem(
            "Specification quality",
            `${result.specification}%`
          ),

          briefItem(
            "Commercial readiness",
            `${result.commercial}%`
          )
        ].join("");
    }


    /*
     * ----------------------------------------------------------
     * SUPPLIERS
     * ----------------------------------------------------------
     */

    if (!matches.length) {
      supplierGrid.innerHTML =
        `
          <div
            style="
              grid-column:1/-1;
              border:1px solid var(--line);
              padding:28px;
              background:rgba(255,250,241,.4);
              min-width:0;
              max-width:100%;
              overflow-wrap:anywhere;
              word-break:break-word;
            "
          >

            <h3
              style="
                margin:0 0 12px;
                font-family:'Playfair Display', Georgia, serif;
                font-size:24px;
                font-weight:500;
              "
            >
              No verified supplier matches were returned.
            </h3>

            <p
              style="
                margin:0;
                max-width:620px;
                color:var(--muted);
                font-size:12px;
                line-height:1.7;
              "
            >
              CASEVO completed the public-web sourcing
              analysis, but no supplier identity could be
              presented as verified for this request.
            </p>

            <p
              style="
                margin:14px 0 0;
                max-width:620px;
                color:var(--muted);
                font-size:12px;
                line-height:1.7;
              "
            >
              Supplier identity, manufacturing capability,
              certifications, MOQ and commercial contacts
              should be independently verified before
              placing an order.
            </p>

          </div>
        `;

      return;
    }


    /*
     * Limit the number of cards so that a bad search response
     * can never create an uncontrolled page explosion.
     */

    const visibleMatches =
      matches.slice(
        0,
        MAX_SUPPLIERS
      );


    supplierGrid.innerHTML =
      visibleMatches
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
        .join("");


    /*
     * ----------------------------------------------------------
     * RESULT INFORMATION
     * ----------------------------------------------------------
     */

    const humanNote =
      qs(
        ".human-note",
        resultContainer
      );


    if (humanNote) {
      humanNote.style.display =
        "";
    }


    /*
     * Update the badge if it exists.
     */

    const badge =
      qs(
        ".analysis-badge",
        resultContainer
      );


    if (badge) {
      badge.textContent =
        "STRUCTURED BRIEF READY";
    }


    console.log(
      "CASEVO: Rendered suppliers:",
      visibleMatches.length
    );


    console.log(
      "CASEVO: CASEVO Score:",
      result.score
    );
  }


  /* ==========================================================
     SEND TO WORKER
     ========================================================== */

  async function sendToWorker(
    values
  ) {
    console.log(
      "CASEVO: Sending request:",
      values
    );


    const payload = {
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
    };


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


    console.log(
      "CASEVO: Worker status:",
      response.status
    );


    const rawText =
      await response.text();


    let data;


    try {
      data =
        JSON.parse(
          rawText
        );
    } catch (error) {
      console.error(
        "CASEVO: Invalid JSON response:",
        rawText
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
      throw new Error(
        firstNonEmpty(
          data.error,
          data.message,
          data.details,
          "Unable to complete supplier discovery."
        )
      );
    }


    return data;
  }


  /* ==========================================================
     SUBMIT HANDLER
     ========================================================== */

  async function handleSubmit(
    event
  ) {
    event.preventDefault();


    const values =
      getFormValues();


    console.log(
      "CASEVO: Form values:",
      values
    );


    /*
     * Requirement is the primary input.
     *
     * This prevents the old problem where the browser
     * displayed "Please enter a sourcing requirement"
     * even though the visible textarea contained text.
     */

    if (
      !clean(
        values.requirement
      )
    ) {
      renderError(
        "Please enter a sourcing requirement."
      );


      if (requirementField) {
        requirementField.focus();
      }


      return;
    }


    setButtonLoading(
      true
    );


    renderLoading();


    try {
      const data =
        await sendToWorker(
          values
        );


      renderResult(
        data,
        values
      );


      console.log(
        "CASEVO: Supplier discovery completed successfully."
      );

    } catch (error) {
      console.error(
        "CASEVO: Supplier discovery failed:",
        error
      );


      renderError(
        error.message ||
        "Unable to connect to the CASEVO sourcing engine."
      );

    } finally {
      setButtonLoading(
        false
      );
    }
  }


  /* ==========================================================
     FORM BINDING
     ========================================================== */

  /*
   * Prevent duplicate event listeners if Cloudflare/browser
   * accidentally loads the JS more than once.
   */

  if (
    form.dataset.casevoBound ===
    "true"
  ) {
    console.warn(
      "CASEVO: Sourcing form already bound."
    );
  } else {
    form.dataset.casevoBound =
      "true";


    form.addEventListener(
      "submit",
      handleSubmit
    );
  }


  /* ==========================================================
     PUBLIC CASEVO API
     ========================================================== */

  window.CASEVO =
    window.CASEVO || {};


  window.CASEVO.analyze =
    async function (
      request
    ) {
      if (
        !request ||
        typeof request !==
          "object"
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
              JSON.stringify(
                request
              )
          }
        );


      const rawText =
        await response.text();


      let data;


      try {
        data =
          JSON.parse(
            rawText
          );
      } catch {
        throw new Error(
          "CASEVO server returned invalid JSON."
        );
      }


      if (
        !response.ok ||
        data.ok === false
      ) {
        throw new Error(
          firstNonEmpty(
            data.error,
            data.message,
            data.details,
            "CASEVO API request failed."
          )
        );
      }


      return data;
    };


  /* ==========================================================
     MOBILE MENU SUPPORT
     ========================================================== */

  /*
   * index.html has:
   *
   * onclick="toggleMenu()"
   *
   * Keep this function available so the page never throws
   * "toggleMenu is not defined".
   */

  window.toggleMenu =
    function () {
      const nav =
        qs(".nav-links");


      if (!nav) {
        return;
      }


      const current =
        nav.style.display;


      if (
        current ===
        "flex"
      ) {
        nav.style.display =
          "";
        return;
      }


      nav.style.display =
        "flex";


      nav.style.flexDirection =
        "column";


      nav.style.position =
        "absolute";


      nav.style.top =
        "100%";


      nav.style.left =
        "0";


      nav.style.right =
        "0";


      nav.style.padding =
        "20px 24px";


      nav.style.background =
        "var(--paper)";


      nav.style.borderBottom =
        "1px solid var(--line)";


      nav.style.zIndex =
        "999";
    };


  /* ==========================================================
     CONTACT FORM SUPPORT
     ========================================================== */

  /*
   * index.html uses:
   *
   * onsubmit="submitContact(event)"
   *
   * Keep this function available.
   */

  window.submitContact =
    function (
      event
    ) {
      if (event) {
        event.preventDefault();
      }


      const message =
        qs(
          "#contactMessage"
        );


      if (message) {
        message.hidden =
          false;

        message.textContent =
          "Thank you. Your request is ready for the next step.";
      }


      return false;
    };


  /* ==========================================================
     INPUT EVENT SAFETY
     ========================================================== */

  /*
   * Remove accidental result error styling when the user
   * starts a new request.
   */

  if (requirementField) {
    requirementField.addEventListener(
      "input",
      function () {
        if (
          resultContainer.classList.contains(
            "casevo-error-results"
          )
        ) {
          resultContainer.classList.remove(
            "casevo-error-results"
          );
        }
      }
    );
  }


  /* ==========================================================
     DEBUG
     ========================================================== */

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
    "CASEVO: Target price field:",
    targetPriceField
  );


  console.log(
    "CASEVO: Destination field:",
    destinationField
  );


  console.log(
    "CASEVO: Submit button:",
    submitButton
  );


  console.log(
    "CASEVO: Existing #results:",
    resultContainer
  );


  console.log(
    "CASEVO: Existing #supplierGrid:",
    supplierGrid
  );


  console.log(
    "CASEVO: Final clean frontend initialized."
  );

})();
