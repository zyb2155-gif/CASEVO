/* ============================================================
   CASEVO AI SOURCING — FRONTEND FINAL POSITION FIX
   ============================================================

   Compatible with CASEVO Worker v4.0.0

   IMPORTANT:
   - Uses the EXISTING #results container in index.html.
   - Uses the EXISTING #brief container.
   - Uses the EXISTING #supplierGrid container.
   - NEVER creates #casevo-results.
   - NEVER inserts results after the form.
   - Keeps the right-side CASEVO panel in its original position.
   - POSTs sourcing requests to /api/sourcing.
   ============================================================ */

(function () {
  "use strict";

  const API_ENDPOINT = "/api/sourcing";

  const MAX_SUPPLIERS = 8;
  const MAX_CAPABILITY = 420;
  const MAX_EVIDENCE = 700;


  /* ==========================================================
     BASIC HELPERS
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


  function firstNonEmpty() {
    for (const value of arguments) {
      const text = clean(value);

      if (text) {
        return text;
      }
    }

    return "";
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


  function truncate(
    value,
    maxLength
  ) {
    const text = clean(value);

    if (
      !text ||
      text.length <= maxLength
    ) {
      return text;
    }

    const cut =
      text.slice(
        0,
        maxLength
      );

    const lastSpace =
      cut.lastIndexOf(" ");

    return (
      (
        lastSpace >
        maxLength * 0.6
          ? cut.slice(
              0,
              lastSpace
            )
          : cut
      ).trim() + "…"
    );
  }


  function safeUrl(value) {
    const raw =
      clean(value);

    if (!raw) {
      return "";
    }

    try {
      const parsed =
        new URL(
          raw,
          window.location.href
        );

      if (
        parsed.protocol !== "http:" &&
        parsed.protocol !== "https:"
      ) {
        return "";
      }

      return parsed.href;

    } catch {
      return "";
    }
  }


  /* ==========================================================
     WEB TEXT CLEANING
     ========================================================== */

  function cleanWebText(value) {
    let text =
      clean(value);

    if (!text) {
      return "";
    }

    text =
      text

        /* Markdown images */
        .replace(
          /!\[[^\]]*\]\([^)]+\)/g,
          " "
        )

        /* Markdown links */
        .replace(
          /\[([^\]]+)\]\([^)]+\)/g,
          "$1"
        )

        /* URLs */
        .replace(
          /https?:\/\/\S+/gi,
          " "
        )

        .replace(
          /www\.\S+/gi,
          " "
        )

        /* HTML */
        .replace(
          /<[^>]*>/g,
          " "
        )

        /* Encoded garbage */
        .replace(
          /(?:%[0-9A-Fa-f]{2}){8,}/g,
          " "
        )

        /* Base64-like garbage */
        .replace(
          /[A-Za-z0-9+/]{120,}={0,2}/g,
          " "
        )

        /* Repeated characters */
        .replace(
          /(.)\1{12,}/g,
          "$1$1$1"
        )

        /* Whitespace */
        .replace(
          /\s+/g,
          " "
        )

        .trim();

    return text;
  }


  /* ==========================================================
     SCORE NORMALIZATION
     ========================================================== */

  function normalizePercent(value) {
    if (
      value === null ||
      typeof value === "undefined" ||
      value === ""
    ) {
      return "—";
    }

    const text =
      clean(value);

    if (!text) {
      return "—";
    }

    if (
      /%$/.test(text)
    ) {
      return text;
    }

    const number =
      Number(text);

    return Number.isFinite(number)
      ? `${Math.round(number)}%`
      : text;
  }


  function normalizeScore(value) {
    if (
      value === null ||
      typeof value === "undefined" ||
      value === ""
    ) {
      return "—";
    }

    const number =
      Number(
        String(value)
          .replace("%", "")
          .trim()
      );

    return Number.isFinite(number)
      ? String(
          Math.max(
            0,
            Math.min(
              100,
              Math.round(number)
            )
          )
        )
      : clean(value);
  }


  /* ==========================================================
     FIND SOURCING FORM
     ========================================================== */

  function findSourcingForm() {
    const explicit = [
      "#sourcingForm",
      "#sourcing-form",
      "#ai-sourcing-form",
      "#aiSourcingForm",
      "form[data-sourcing-form]"
    ];

    for (
      const selector
      of explicit
    ) {
      const element =
        qs(selector);

      if (element) {
        return element;
      }
    }

    const forms =
      qsa("form");

    return (
      forms.find(
        function (form) {
          const text =
            clean(
              form.innerText ||
              form.textContent ||
              ""
            )
              .toLowerCase();

          return (
            text.includes(
              "what are you sourcing"
            ) ||
            text.includes(
              "product / material"
            ) ||
            text.includes(
              "target price"
            ) ||
            text.includes(
              "destination"
            )
          );
        }
      ) ||
      null
    );
  }


  const form =
    findSourcingForm();


  /* ==========================================================
     EXISTING RESULTS STRUCTURE
     ========================================================== */

  const resultContainer =
    qs("#results");

  const briefContainer =
    qs("#brief");

  const supplierGrid =
    qs("#supplierGrid");

  const resultTitle =
    qs("#resultTitle");


  if (!form) {
    console.error(
      "CASEVO: sourcing form not found."
    );

    return;
  }


  /*
   * IMPORTANT:
   *
   * We do NOT create a new result element.
   *
   * index.html already contains:
   *
   * #results
   * #brief
   * #supplierGrid
   */

  if (
    !resultContainer ||
    !briefContainer ||
    !supplierGrid
  ) {
    console.error(
      "CASEVO: existing result structure (#results / #brief / #supplierGrid) not found."
    );

    return;
  }


  /* ==========================================================
     FIELD HELPERS
     ========================================================== */

  function firstExisting(
    selectors,
    root
  ) {
    for (
      const selector
      of selectors
    ) {
      const element =
        qs(
          selector,
          root
        );

      if (element) {
        return element;
      }
    }

    return null;
  }


  function findInput(
    selectors,
    words
  ) {
    const direct =
      firstExisting(
        selectors,
        form
      );

    if (direct) {
      return direct;
    }

    return (
      qsa(
        "input",
        form
      ).find(
        function (input) {
          const haystack =
            (
              clean(
                input.id
              ) +
              " " +
              clean(
                input.name
              ) +
              " " +
              clean(
                input.placeholder
              )
            )
              .toLowerCase();

          return words.some(
            function (word) {
              return haystack.includes(
                word
              );
            }
          );
        }
      ) ||
      null
    );
  }


  /* ==========================================================
     REQUIREMENT FIELD
     ========================================================== */

  const requirementField =
    firstExisting(
      [
        "#request",
        "#requirement",
        "#requirements",
        "#sourcing-requirement",
        "#sourcingRequirement",

        'textarea[name="requirement"]',
        'textarea[name="requirements"]',
        'textarea[name="request"]',
        'textarea[name="brief"]',

        "textarea"
      ],
      form
    );


  /* ==========================================================
     PRODUCT FIELD
     ========================================================== */

  const productField =
    findInput(
      [
        "#product",
        "#product-material",
        "#productMaterial",

        'input[name="product"]',
        'input[name="material"]',
        'input[name="product_material"]'
      ],
      [
        "product",
        "material",
        "upper leather"
      ]
    );


  /* ==========================================================
     QUANTITY FIELD
     ========================================================== */

  const quantityField =
    findInput(
      [
        "#quantity",
        'input[name="quantity"]'
      ],
      [
        "quantity",
        "pairs",
        "pcs"
      ]
    );


  /* ==========================================================
     PRICE FIELD
     ========================================================== */

  const targetPriceField =
    findInput(
      [
        "#price",
        "#target-price",
        "#targetPrice",

        'input[name="price"]',
        'input[name="target_price"]',
        'input[name="targetPrice"]'
      ],
      [
        "price",
        "target"
      ]
    );


  /* ==========================================================
     DESTINATION FIELD
     ========================================================== */

  const destinationField =
    findInput(
      [
        "#destination",
        'input[name="destination"]'
      ],
      [
        "destination",
        "usa",
        "country"
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
          return /analy|match|source|find/i
            .test(
              button.textContent ||
              ""
            );
        }
      );
  }


  /* ==========================================================
     FORM VALUES
     ========================================================== */

  function valueOf(element) {
    if (!element) {
      return "";
    }

    return clean(
      "value" in element
        ? element.value
        : element.textContent
    );
  }


  function collectValues() {
    return {
      requirement:
        valueOf(
          requirementField
        ),

      product:
        valueOf(
          productField
        ),

      quantity:
        valueOf(
          quantityField
        ),

      targetPrice:
        valueOf(
          targetPriceField
        ),

      destination:
        valueOf(
          destinationField
        )
    };
  }


  /* ==========================================================
     RESPONSE NORMALIZATION
     ========================================================== */

  function normalizeResponse(
    data,
    values
  ) {
    const root =
      data || {};

    const analysis =
      root.analysis || {};

    const normalized =
      analysis.normalized || {};

    const brief =
      root.brief || {};

    const scoring =
      analysis.scoring ||
      root.scoring ||
      {};


    let matches = [];


    if (
      Array.isArray(
        analysis.matches
      )
    ) {
      matches =
        analysis.matches;

    } else if (
      Array.isArray(
        root.matches
      )
    ) {
      matches =
        root.matches;

    } else if (
      Array.isArray(
        normalized.matches
      )
    ) {
      matches =
        normalized.matches;
    }


    return {
      requestId:
        firstNonEmpty(
          root.requestId,
          root.request_id
        ),


      product:
        firstNonEmpty(
          normalized.product,
          brief.product,
          analysis.product,
          values.product,
          "Sourcing requirement"
        ),


      quantity:
        firstNonEmpty(
          normalized.quantity,
          brief.quantity,
          analysis.quantity,
          values.quantity,
          "Not specified"
        ),


      targetPrice:
        firstNonEmpty(
          normalized.targetPrice,
          normalized.target_price,

          brief.targetPrice,
          brief.target_price,

          analysis.targetPrice,
          analysis.target_price,

          values.targetPrice,

          "Not specified"
        ),


      destination:
        firstNonEmpty(
          normalized.destination,
          brief.destination,
          analysis.destination,
          values.destination,
          "Not specified"
        ),


      requirements:
        Array.isArray(
          normalized.requirements
        )
          ? normalized.requirements
          : [],


      scoring: {
        score:
          scoring.score ??
          "—",

        clarity:
          scoring.clarity ??
          "—",

        specification:
          scoring.specification ??
          scoring.specificationQuality ??
          "—",

        commercial:
          scoring.commercial ??
          scoring.commercialReadiness ??
          "—",

        note:
          clean(
            scoring.note
          )
      },


      matches:
        matches.slice(
          0,
          MAX_SUPPLIERS
        ),


      meta:
        root.meta || {}
    };
  }


  /* ==========================================================
     RUNTIME STYLES
     ========================================================== */

  function installStyles() {
    if (
      qs(
        "#casevo-position-fix-styles"
      )
    ) {
      return;
    }


    const style =
      document.createElement(
        "style"
      );


    style.id =
      "casevo-position-fix-styles";


    style.textContent = `

      /* =====================================================
         EXISTING RESULTS CONTAINER
         ===================================================== */

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


      /* =====================================================
         SOURCING BRIEF
         ===================================================== */

      #brief {
        display: grid;

        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );

        width: 100%;
        min-width: 0;

        margin:
          0
          0
          22px;

        border-top:
          1px solid
          var(
            --line,
            #d9d0c2
          );

        border-left:
          1px solid
          var(
            --line,
            #d9d0c2
          );
      }


      #brief .casevo-brief-cell {
        min-width: 0;

        padding:
          14px
          16px;

        border-right:
          1px solid
          var(
            --line,
            #d9d0c2
          );

        border-bottom:
          1px solid
          var(
            --line,
            #d9d0c2
          );

        background:
          rgba(
            255,
            255,
            255,
            .18
          );
      }


      #brief .casevo-brief-label,
      #brief .casevo-readiness-label {
        display: block;

        margin-bottom:
          7px;

        font-size:
          8px;

        letter-spacing:
          .14em;

        text-transform:
          uppercase;

        color:
          var(
            --muted,
            #756c61
          );
      }


      #brief .casevo-brief-value {
        font-size:
          11px;

        line-height:
          1.45;

        overflow-wrap:
          anywhere;

        word-break:
          break-word;
      }


      /* =====================================================
         READINESS
         ===================================================== */

      #brief .casevo-readiness {
        grid-column:
          1 / -1;

        display:
          grid;

        grid-template-columns:
          repeat(
            4,
            minmax(0, 1fr)
          );

        border-right:
          1px solid
          var(
            --line,
            #d9d0c2
          );

        border-bottom:
          1px solid
          var(
            --line,
            #d9d0c2
          );
      }


      #brief .casevo-readiness-item {
        min-width:
          0;

        padding:
          13px
          16px;

        border-right:
          1px solid
          var(
            --line,
            #d9d0c2
          );
      }


      #brief .casevo-readiness-item:last-child {
        border-right:
          0;
      }


      #brief .casevo-readiness-value {
        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size:
          18px;

        line-height:
          1;
      }


      /* =====================================================
         NORMALIZED REQUIREMENTS
         ===================================================== */

      #brief .casevo-requirements {
        grid-column:
          1 / -1;

        padding:
          14px
          16px;

        border-right:
          1px solid
          var(
            --line,
            #d9d0c2
          );

        border-bottom:
          1px solid
          var(
            --line,
            #d9d0c2
          );
      }


      #brief .casevo-requirement-tags {
        display:
          flex;

        flex-wrap:
          wrap;

        gap:
          6px;
      }


      #brief .casevo-requirement-tag {
        max-width:
          100%;

        padding:
          5px
          7px;

        border:
          1px solid
          var(
            --line,
            #d9d0c2
          );

        font-size:
          9px;

        line-height:
          1.4;

        overflow-wrap:
          anywhere;
      }


      /* =====================================================
         SUPPLIER GRID
         ===================================================== */

      #supplierGrid {
        display:
          grid !important;

        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          ) !important;

        gap:
          14px !important;

        align-items:
          start;

        width:
          100%;

        max-width:
          100%;

        min-width:
          0;
      }


      #supplierGrid .supplier {
        width:
          100%;

        min-width:
          0;

        max-width:
          100%;

        padding:
          18px;

        overflow:
          hidden;

        overflow-wrap:
          anywhere;

        word-break:
          break-word;
      }


      /* =====================================================
         SUPPLIER HEADER
         ===================================================== */

      #supplierGrid .casevo-supplier-top {
        display:
          flex;

        justify-content:
          space-between;

        align-items:
          flex-start;

        gap:
          12px;

        min-width:
          0;
      }


      #supplierGrid .casevo-supplier-main {
        flex:
          1 1 auto;

        min-width:
          0;
      }


      #supplierGrid .casevo-supplier-rank {
        margin-bottom:
          8px;

        font-size:
          8px;

        letter-spacing:
          .13em;

        text-transform:
          uppercase;

        color:
          var(
            --red,
            #a92d25
          );
      }


      #supplierGrid .casevo-supplier-name {
        margin:
          0;

        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size:
          17px;

        line-height:
          1.12;

        font-weight:
          500;

        overflow-wrap:
          anywhere;
      }


      #supplierGrid .casevo-supplier-location,
      #supplierGrid .casevo-supplier-type {
        margin-top:
          6px;

        font-size:
          9px;

        line-height:
          1.45;

        color:
          var(
            --muted,
            #756c61
          );
      }


      /* =====================================================
         MATCH SCORE
         ===================================================== */

      #supplierGrid .casevo-match-score {
        flex:
          0 0 auto;

        text-align:
          right;

        color:
          var(
            --red,
            #a92d25
          );
      }


      #supplierGrid .casevo-match-score strong {
        display:
          block;

        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size:
          20px;

        line-height:
          1;

        font-weight:
          500;
      }


      #supplierGrid .casevo-match-score span {
        display:
          block;

        margin-top:
          4px;

        font-size:
          7px;

        letter-spacing:
          .12em;

        text-transform:
          uppercase;

        color:
          var(
            --muted,
            #756c61
          );
      }


      /* =====================================================
         CAPABILITY
         ===================================================== */

      #supplierGrid .casevo-capability {
        margin-top:
          14px;

        padding-top:
          12px;

        border-top:
          1px solid
          var(
            --line,
            #d9d0c2
          );

        font-size:
          10px;

        line-height:
          1.55;

        color:
          var(
            --muted,
            #655d54
          );

        overflow-wrap:
          anywhere;
      }


      /* =====================================================
         CONTACTS
         ===================================================== */

      #supplierGrid .casevo-contact-row {
        display:
          flex;

        flex-wrap:
          wrap;

        gap:
          8px
          12px;

        margin-top:
          13px;

        font-size:
          9px;

        line-height:
          1.45;
      }


      #supplierGrid .casevo-contact-row a {
        color:
          var(
            --red,
            #a92d25
          );

        text-decoration:
          none;

        overflow-wrap:
          anywhere;
      }


      /* =====================================================
         EVIDENCE
         ===================================================== */

      #supplierGrid .casevo-evidence {
        margin-top:
          13px;

        padding-top:
          11px;

        border-top:
          1px solid
          var(
            --line,
            #d9d0c2
          );
      }


      #supplierGrid .casevo-evidence summary {
        cursor:
          pointer;

        font-size:
          9px;

        color:
          var(
            --muted,
            #655d54
          );
      }


      #supplierGrid .casevo-evidence-text {
        margin-top:
          10px;

        font-size:
          9px;

        line-height:
          1.5;

        color:
          var(
            --muted,
            #655d54
          );

        overflow-wrap:
          anywhere;

        word-break:
          break-word;
      }


      /* =====================================================
         VERIFICATION
         ===================================================== */

      #supplierGrid .casevo-verification {
        margin-top:
          13px;

        padding-top:
          10px;

        border-top:
          1px solid
          var(
            --line,
            #d9d0c2
          );

        font-size:
          8px;

        line-height:
          1.45;

        color:
          var(
            --muted,
            #756c61
          );
      }


      /* =====================================================
         LOADING / ERROR / EMPTY
         ===================================================== */

      #supplierGrid .casevo-empty,
      #supplierGrid .casevo-error,
      #supplierGrid .casevo-loading {
        grid-column:
          1 / -1;

        width:
          100%;

        padding:
          22px;

        border:
          1px solid
          var(
            --line,
            #d9d0c2
          );

        background:
          rgba(
            255,
            255,
            255,
            .18
          );

        font-size:
          11px;

        line-height:
          1.6;
      }


      #supplierGrid .casevo-error {
        border-color:
          #c85a4f;

        color:
          #8f2f24;
      }


      /* =====================================================
         TABLET
         ===================================================== */

      @media (
        max-width:
          900px
      ) {

        #brief {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }


        #brief .casevo-readiness {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
        }


        #supplierGrid {
          grid-template-columns:
            1fr !important;
        }

      }


      /* =====================================================
         MOBILE
         ===================================================== */

      @media (
        max-width:
          600px
      ) {

        #brief,
        #brief .casevo-readiness {
          grid-template-columns:
            1fr;
        }

      }

    `;


    document.head.appendChild(
      style
    );
  }


  installStyles();


  /* ==========================================================
     SHOW EXISTING RESULTS
     ========================================================== */

  function showResults() {
    resultContainer.hidden =
      false;

    resultContainer.style.display =
      "";
  }


  /* ==========================================================
     BUTTON LOADING STATE
     ========================================================== */

  function setLoading(
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
          "Analyzing…";

      } else {

        submitButton.textContent =
          "Analyzing…";
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

        submitButton.textContent =
          original;
      }
    }
  }


  /* ==========================================================
     BRIEF COMPONENTS
     ========================================================== */

  function briefCell(
    label,
    value
  ) {

    return `
      <div class="casevo-brief-cell">

        <span class="casevo-brief-label">
          ${escapeHtml(label)}
        </span>

        <div class="casevo-brief-value">
          ${escapeHtml(
            value ||
            "Not specified"
          )}
        </div>

      </div>
    `;
  }


  function readinessItem(
    label,
    value
  ) {

    return `
      <div class="casevo-readiness-item">

        <span class="casevo-readiness-label">
          ${escapeHtml(label)}
        </span>

        <div class="casevo-readiness-value">
          ${escapeHtml(value)}
        </div>

      </div>
    `;
  }


  /* ==========================================================
     RENDER BRIEF
     ========================================================== */

  function renderBrief(
    result
  ) {

    const requirementTags =
      result.requirements

        .slice(
          0,
          10
        )

        .map(
          function (item) {

            return `
              <span class="casevo-requirement-tag">
                ${escapeHtml(item)}
              </span>
            `;
          }
        )

        .join("");


    briefContainer.innerHTML =

      briefCell(
        "Product / Material",
        result.product
      ) +

      briefCell(
        "Quantity",
        result.quantity
      ) +

      briefCell(
        "Target Price",
        result.targetPrice
      ) +

      briefCell(
        "Destination",
        result.destination
      ) +

      `

        <div class="casevo-readiness">

          ${readinessItem(
            "CASEVO Score",
            `${normalizeScore(
              result.scoring.score
            )}/100`
          )}

          ${readinessItem(
            "Requirement clarity",
            normalizePercent(
              result.scoring.clarity
            )
          )}

          ${readinessItem(
            "Specification quality",
            normalizePercent(
              result.scoring.specification
            )
          )}

          ${readinessItem(
            "Commercial readiness",
            normalizePercent(
              result.scoring.commercial
            )
          )}

        </div>

      ` +

      (
        requirementTags

          ? `

            <div class="casevo-requirements">

              <span class="casevo-brief-label">
                Normalized requirements
              </span>

              <div class="casevo-requirement-tags">
                ${requirementTags}
              </div>

            </div>

          `

          : ""
      );
  }


  /* ==========================================================
     SUPPLIER CARD
     ========================================================== */

  function renderSupplierCard(
    supplier,
    index
  ) {

    const item =
      supplier || {};


    const name =
      firstNonEmpty(
        item.name,
        item.company,
        item.title,
        item.domain,
        `Supplier ${index + 1}`
      );


    const location =
      firstNonEmpty(
        item.location,
        item.country,
        item.region,
        "Not determined"
      );


    const supplierType =
      firstNonEmpty(
        item.supplierType,
        item.type,
        "Potential Manufacturer"
      );


    const score =
      normalizeScore(
        item.matchScore ??
        item.match_score ??
        item.score ??
        item.match
      );


    const website =
      safeUrl(
        firstNonEmpty(
          item.website,
          item.sourceUrl,
          item.url,
          item.link
        )
      );


    const email =
      firstNonEmpty(
        item.contactEmail,
        item.email
      );


    const phone =
      firstNonEmpty(
        item.contactPhone,
        item.phone
      );


    const capability =
      truncate(
        cleanWebText(
          firstNonEmpty(
            item.capability,
            item.description,
            item.note,
            item.summary
          )
        ),
        MAX_CAPABILITY
      );


    const evidence =
      truncate(
        cleanWebText(
          firstNonEmpty(
            item.evidence,
            item.content,
            item.snippet
          )
        ),
        MAX_EVIDENCE
      );


    const verification =
      firstNonEmpty(
        item.verificationStatus,
        item.verification_status,
        item.verification,
        "Unverified — due diligence required"
      );


    return `

      <article class="supplier">

        <div class="casevo-supplier-top">

          <div class="casevo-supplier-main">

            <div class="casevo-supplier-rank">
              SUPPLIER ${index + 1}
            </div>

            <h4 class="casevo-supplier-name">
              ${escapeHtml(name)}
            </h4>

            <div class="casevo-supplier-location">
              ${escapeHtml(location)}
            </div>

            <div class="casevo-supplier-type">
              ${escapeHtml(supplierType)}
            </div>

          </div>


          <div class="casevo-match-score">

            <strong>
              ${escapeHtml(score)}
              ${score === "—" ? "" : "%"}
            </strong>

            <span>
              Match
            </span>

          </div>

        </div>


        ${
          capability

            ? `

              <div class="casevo-capability">
                ${escapeHtml(capability)}
              </div>

            `

            : ""
        }


        <div class="casevo-contact-row">

          ${
            website

              ? `

                <a
                  href="${escapeAttr(website)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit supplier website →
                </a>

              `

              : ""
          }


          ${
            email

              ? `

                <a
                  href="mailto:${escapeAttr(email)}"
                >
                  ${escapeHtml(email)}
                </a>

              `

              : ""
          }


          ${
            phone

              ? `

                <span>
                  ${escapeHtml(phone)}
                </span>

              `

              : ""
          }

        </div>


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
          ${escapeHtml(verification)}
        </div>

      </article>

    `;
  }


  /* ==========================================================
     LOADING
     ========================================================== */

  function renderLoading() {

    showResults();


    if (resultTitle) {
      resultTitle.textContent =
        "Analyzing sourcing requirement…";
    }


    briefContainer.innerHTML =
      "";


    supplierGrid.innerHTML =
      `

        <div class="casevo-loading">

          CASEVO is structuring the sourcing brief
          and searching public supplier information…

        </div>

      `;
  }


  /* ==========================================================
     ERROR
     ========================================================== */

  function renderError(
    message
  ) {

    showResults();


    if (resultTitle) {
      resultTitle.textContent =
        "Supplier discovery could not be completed.";
    }


    briefContainer.innerHTML =
      "";


    supplierGrid.innerHTML =
      `

        <div class="casevo-error">

          <strong>
            CASEVO AI / ERROR
          </strong>

          <br>

          ${escapeHtml(
            firstNonEmpty(
              message,
              "The sourcing request failed."
            )
          )}

        </div>

      `;
  }


  /* ==========================================================
     RESULT
     ========================================================== */

  function renderResult(
    data,
    values
  ) {

    const result =
      normalizeResponse(
        data,
        values
      );


    showResults();


    /* --------------------------------------------------------
       TITLE
       -------------------------------------------------------- */

    if (resultTitle) {

      resultTitle.textContent =
        result.matches.length

          ? "Supplier matches"

          : "No supplier matches were returned.";
    }


    /* --------------------------------------------------------
       BADGE
       -------------------------------------------------------- */

    const badge =
      qs(
        ".analysis-badge",
        resultContainer
      );


    if (badge) {

      badge.textContent =
        "STRUCTURED BRIEF READY";
    }


    /* --------------------------------------------------------
       BRIEF
       -------------------------------------------------------- */

    renderBrief(
      result
    );


    /* --------------------------------------------------------
       SUPPLIERS
       -------------------------------------------------------- */

    if (
      !result.matches.length
    ) {

      supplierGrid.innerHTML =
        `

          <div class="casevo-empty">

            <strong>
              No supplier matches were returned.
            </strong>

            <br><br>

            CASEVO completed the sourcing analysis,
            but no supplier candidates were returned
            for this request.

            Try adding more specific product,
            material, manufacturing or certification
            requirements.

          </div>

        `;

    } else {

      supplierGrid.innerHTML =
        result.matches

          .map(
            function (
              supplier,
              index
            ) {

              return renderSupplierCard(
                supplier,
                index
              );
            }
          )

          .join("");
    }


    /* --------------------------------------------------------
       HUMAN VERIFICATION NOTE
       -------------------------------------------------------- */

    const humanNote =
      qs(
        ".human-note",
        resultContainer
      );


    if (humanNote) {

      humanNote.style.display =
        "";
    }


    /* --------------------------------------------------------
       SCROLL TO EXISTING RESULT SECTION
       -------------------------------------------------------- */

    setTimeout(
      function () {

        try {

          resultContainer
            .scrollIntoView({
              behavior:
                "smooth",

              block:
                "start"
            });

        } catch {

          resultContainer
            .scrollIntoView();
        }

      },
      80
    );
  }


  /* ==========================================================
     SEND REQUEST
     ========================================================== */

  async function sendRequest(
    values
  ) {

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
              values
            )

        }
      );


    const rawText =
      await response.text();


    let data;


    try {

      data =
        rawText
          ? JSON.parse(
              rawText
            )
          : {};

    } catch {

      throw new Error(
        `CASEVO server returned invalid JSON (HTTP ${response.status}).`
      );
    }


    if (
      !response.ok ||
      data.ok === false
    ) {

      throw new Error(

        firstNonEmpty(

          data.error,

          data.details,

          data.message,

          `CASEVO API request failed (HTTP ${response.status}).`

        )

      );
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


    const values =
      collectValues();


    console.log(
      "CASEVO sourcing request:",
      values
    );


    /* --------------------------------------------------------
       VALIDATION
       -------------------------------------------------------- */

    if (
      !values.requirement &&
      !values.product
    ) {

      renderError(
        "Please enter a sourcing requirement."
      );


      if (
        requirementField
      ) {

        requirementField.focus();
      }


      return;
    }


    /* --------------------------------------------------------
       LOADING
       -------------------------------------------------------- */

    setLoading(
      true
    );


    renderLoading();


    /* --------------------------------------------------------
       REQUEST
       -------------------------------------------------------- */

    try {

      const data =
        await sendRequest(
          values
        );


      console.log(
        "CASEVO sourcing response:",
        data
      );


      renderResult(
        data,
        values
      );


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

      setLoading(
        false
      );
    }
  }


  /* ==========================================================
     FORM BINDING
     ========================================================== */

  if (
    form.dataset.casevoBound !==
    "true"
  ) {

    form.dataset.casevoBound =
      "true";


    form.addEventListener(
      "submit",
      handleSubmit
    );
  }


  /* ==========================================================
     PUBLIC API
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


      return sendRequest(
        request
      );
    };


  /* ==========================================================
     MOBILE MENU SUPPORT
     ========================================================== */

  window.toggleMenu =
    window.toggleMenu ||
    function () {

      const nav =
        qs(
          ".nav-links"
        );


      if (!nav) {
        return;
      }


      nav.style.display =
        nav.style.display ===
        "flex"

          ? ""

          : "flex";
    };


  /* ==========================================================
     CONTACT FORM SUPPORT
     ========================================================== */

  window.submitContact =
    window.submitContact ||
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
     READY
     ========================================================== */

  console.log(
    "CASEVO frontend initialized — existing #results layout preserved."
  );

})();
