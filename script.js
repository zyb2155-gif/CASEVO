/* ============================================================
   CASEVO AI SOURCING — FRONTEND
   Version 4.1.0
   Supplier Discovery + Human Verification
   ============================================================

   Compatible with:
   POST /api/sourcing
   POST /api/verify-supplier

   IMPORTANT:
   - Uses existing #results
   - Uses existing #brief
   - Uses existing #supplierGrid
   - Does NOT create a second results section
   - Keeps existing page structure intact
   ============================================================ */

(function () {
  "use strict";

  const SOURCING_ENDPOINT =
    "/api/sourcing";

  const VERIFY_ENDPOINT =
    "/api/verify-supplier";

  const MAX_SUPPLIERS = 8;

  const MAX_CAPABILITY = 420;

  const MAX_EVIDENCE = 700;


  /* ==========================================================
     STATE
     ========================================================== */

  const state = {
    lastFormValues: null,
    lastResult: null,
    suppliers: []
  };


  /* ==========================================================
     BASIC HELPERS
     ========================================================== */

  function qs(
    selector,
    root
  ) {
    return (
      root ||
      document
    ).querySelector(
      selector
    );
  }


  function qsa(
    selector,
    root
  ) {
    return Array.from(
      (
        root ||
        document
      ).querySelectorAll(
        selector
      )
    );
  }


  function clean(
    value
  ) {
    if (
      value === null ||
      typeof value ===
        "undefined"
    ) {
      return "";
    }

    return String(
      value
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }


  function firstNonEmpty() {
    for (
      const value
      of arguments
    ) {
      const text =
        clean(
          value
        );

      if (
        text
      ) {
        return text;
      }
    }

    return "";
  }


  function escapeHtml(
    value
  ) {
    return String(
      value === null ||
      typeof value ===
        "undefined"
        ? ""
        : value
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


  function escapeAttr(
    value
  ) {
    return escapeHtml(
      value
    );
  }


  function truncate(
    value,
    maxLength
  ) {
    const text =
      clean(
        value
      );

    if (
      !text ||
      text.length <=
        maxLength
    ) {
      return text;
    }

    const cut =
      text.slice(
        0,
        maxLength
      );

    const lastSpace =
      cut.lastIndexOf(
        " "
      );

    return (
      (
        lastSpace >
        maxLength *
          0.6

          ? cut.slice(
              0,
              lastSpace
            )

          : cut
      ).trim() +
      "…"
    );
  }


  function safeUrl(
    value
  ) {
    const raw =
      clean(
        value
      );

    if (
      !raw
    ) {
      return "";
    }

    try {
      const parsed =
        new URL(
          raw,
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


  function normalizePercent(
    value
  ) {
    if (
      value === null ||
      typeof value ===
        "undefined" ||
      value === ""
    ) {
      return "—";
    }

    const text =
      clean(
        value
      );

    if (
      /%$/.test(
        text
      )
    ) {
      return text;
    }

    const number =
      Number(
        text
      );

    return Number.isFinite(
      number
    )
      ? `${Math.round(
          number
        )}%`
      : text;
  }


  function normalizeScore(
    value
  ) {
    if (
      value === null ||
      typeof value ===
        "undefined" ||
      value === ""
    ) {
      return "—";
    }

    const number =
      Number(
        String(
          value
        )
          .replace(
            "%",
            ""
          )
          .trim()
      );

    return Number.isFinite(
      number
    )
      ? String(
          Math.max(
            0,
            Math.min(
              100,
              Math.round(
                number
              )
            )
          )
        )
      : clean(
          value
        );
  }


  /* ==========================================================
     WEB TEXT CLEANING
     ========================================================== */

  function cleanWebText(
    value
  ) {
    let text =
      clean(
        value
      );

    if (
      !text
    ) {
      return "";
    }

    text =
      text

        .replace(
          /!\[[^\]]*\]\([^)]+\)/g,
          " "
        )

        .replace(
          /\[([^\]]+)\]\([^)]+\)/g,
          "$1"
        )

        .replace(
          /https?:\/\/\S+/gi,
          " "
        )

        .replace(
          /www\.\S+/gi,
          " "
        )

        .replace(
          /<[^>]*>/g,
          " "
        )

        .replace(
          /(?:%[0-9A-Fa-f]{2}){8,}/g,
          " "
        )

        .replace(
          /[A-Za-z0-9+/]{120,}={0,2}/g,
          " "
        )

        .replace(
          /(.)\1{12,}/g,
          "$1$1$1"
        )

        .replace(
          /\s+/g,
          " "
        )

        .trim();

    return text;
  }


  /* ==========================================================
     FIND SOURCING FORM
     ========================================================== */

  function findSourcingForm() {
    const selectors = [
      "#sourcingForm",
      "#sourcing-form",
      "#ai-sourcing-form",
      "#aiSourcingForm",
      "form[data-sourcing-form]"
    ];

    for (
      const selector
      of selectors
    ) {
      const form =
        qs(
          selector
        );

      if (
        form
      ) {
        return form;
      }
    }


    const forms =
      qsa(
        "form"
      );


    return (
      forms.find(
        function (
          form
        ) {
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
     EXISTING RESULTS
     ========================================================== */

  const resultContainer =
    qs(
      "#results"
    );

  const briefContainer =
    qs(
      "#brief"
    );

  const supplierGrid =
    qs(
      "#supplierGrid"
    );

  const resultTitle =
    qs(
      "#resultTitle"
    );


  if (
    !form
  ) {
    console.error(
      "CASEVO: sourcing form not found."
    );

    return;
  }


  if (
    !resultContainer ||
    !briefContainer ||
    !supplierGrid
  ) {
    console.error(
      "CASEVO: #results / #brief / #supplierGrid not found."
    );

    return;
  }


  /* ==========================================================
     FIELD DISCOVERY
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

      if (
        element
      ) {
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

    if (
      direct
    ) {
      return direct;
    }


    return (
      qsa(
        "input",
        form
      )
        .find(
          function (
            input
          ) {
            const text =
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
              function (
                word
              ) {
                return text.includes(
                  word
                );
              }
            );
          }
        ) ||
      null
    );
  }


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
        "material"
      ]
    );


  const quantityField =
    findInput(
      [
        "#quantity",
        'input[name="quantity"]'
      ],
      [
        "quantity"
      ]
    );


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


  const destinationField =
    findInput(
      [
        "#destination",
        'input[name="destination"]'
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


  if (
    !submitButton
  ) {
    submitButton =
      qsa(
        "button",
        form
      )
        .find(
          function (
            button
          ) {
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

  function valueOf(
    element
  ) {
    if (
      !element
    ) {
      return "";
    }

    return clean(
      "value" in
        element

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
     NORMALIZE SOURCING RESPONSE
     ========================================================== */

  function normalizeResponse(
    data,
    values
  ) {
    const root =
      data ||
      {};

    const analysis =
      root.analysis ||
      {};

    const normalized =
      analysis.normalized ||
      {};

    const brief =
      root.brief ||
      {};

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
        root.meta ||
        {}
    };
  }


  /* ==========================================================
     RUNTIME STYLES
     ========================================================== */

  function installStyles() {
    if (
      qs(
        "#casevo-v410-styles"
      )
    ) {
      return;
    }


    const style =
      document.createElement(
        "style"
      );


    style.id =
      "casevo-v410-styles";


    style.textContent = `

      #results {
        width:100%;
        max-width:100%;
        min-width:0;
        overflow:hidden;
        box-sizing:border-box;
      }

      #results *,
      #results *::before,
      #results *::after {
        box-sizing:border-box;
      }


      /* BRIEF */

      #brief {
        display:grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0,1fr)
          );

        width:100%;
        min-width:0;

        margin:
          0 0 22px;

        border-top:
          1px solid var(--line,#d9d0c2);

        border-left:
          1px solid var(--line,#d9d0c2);
      }

      #brief .casevo-brief-cell {
        min-width:0;

        padding:
          14px 16px;

        border-right:
          1px solid var(--line,#d9d0c2);

        border-bottom:
          1px solid var(--line,#d9d0c2);
      }

      #brief .casevo-label {
        display:block;

        margin-bottom:
          7px;

        font-size:
          8px;

        letter-spacing:
          .14em;

        text-transform:
          uppercase;

        color:
          var(--muted,#756c61);
      }

      #brief .casevo-value {
        font-size:
          11px;

        line-height:
          1.45;

        overflow-wrap:
          anywhere;
      }


      /* READINESS */

      #brief .casevo-readiness {
        grid-column:
          1/-1;

        display:grid;

        grid-template-columns:
          repeat(
            4,
            minmax(0,1fr)
          );

        border-right:
          1px solid var(--line,#d9d0c2);

        border-bottom:
          1px solid var(--line,#d9d0c2);
      }

      #brief .casevo-readiness-item {
        min-width:0;

        padding:
          13px 16px;

        border-right:
          1px solid var(--line,#d9d0c2);
      }

      #brief .casevo-readiness-item:last-child {
        border-right:0;
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


      /* NORMALIZED REQUIREMENTS */

      #brief .casevo-requirements {
        grid-column:
          1/-1;

        padding:
          14px 16px;

        border-right:
          1px solid var(--line,#d9d0c2);

        border-bottom:
          1px solid var(--line,#d9d0c2);
      }

      #brief .casevo-tags {
        display:flex;

        flex-wrap:wrap;

        gap:6px;
      }

      #brief .casevo-tag {
        padding:
          5px 7px;

        border:
          1px solid var(--line,#d9d0c2);

        font-size:
          9px;

        line-height:
          1.4;
      }


      /* SUPPLIER GRID */

      #supplierGrid {
        display:grid !important;

        grid-template-columns:
          repeat(
            2,
            minmax(0,1fr)
          ) !important;

        gap:
          14px !important;

        align-items:start;

        width:100%;
        min-width:0;
      }

      #supplierGrid .supplier {
        width:100%;
        min-width:0;

        padding:18px;

        overflow:hidden;

        overflow-wrap:anywhere;
        word-break:break-word;
      }


      /* CARD HEADER */

      #supplierGrid .casevo-supplier-top {
        display:flex;

        justify-content:
          space-between;

        align-items:
          flex-start;

        gap:12px;
      }

      #supplierGrid .casevo-supplier-main {
        flex:
          1 1 auto;

        min-width:0;
      }

      #supplierGrid .casevo-supplier-rank {
        margin-bottom:8px;

        font-size:8px;

        letter-spacing:.13em;

        text-transform:uppercase;

        color:
          var(--red,#a92d25);
      }

      #supplierGrid .casevo-supplier-name {
        margin:0;

        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size:17px;

        line-height:1.12;

        font-weight:500;
      }

      #supplierGrid .casevo-supplier-location,
      #supplierGrid .casevo-supplier-type {
        margin-top:6px;

        font-size:9px;

        line-height:1.45;

        color:
          var(--muted,#756c61);
      }


      /* MATCH */

      #supplierGrid .casevo-match-score {
        flex:
          0 0 auto;

        text-align:right;

        color:
          var(--red,#a92d25);
      }

      #supplierGrid .casevo-match-score strong {
        display:block;

        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size:20px;

        line-height:1;

        font-weight:500;
      }

      #supplierGrid .casevo-match-score span {
        display:block;

        margin-top:4px;

        font-size:7px;

        letter-spacing:.12em;

        text-transform:uppercase;

        color:
          var(--muted,#756c61);
      }


      /* CAPABILITY */

      #supplierGrid .casevo-capability {
        margin-top:14px;

        padding-top:12px;

        border-top:
          1px solid var(--line,#d9d0c2);

        font-size:10px;

        line-height:1.55;

        color:
          var(--muted,#655d54);
      }


      /* CONTACTS */

      #supplierGrid .casevo-contact-row {
        display:flex;

        flex-wrap:wrap;

        gap:
          8px 12px;

        margin-top:13px;

        font-size:9px;
      }

      #supplierGrid .casevo-contact-row a {
        color:
          var(--red,#a92d25);

        text-decoration:none;
      }


      /* EVIDENCE */

      #supplierGrid .casevo-evidence {
        margin-top:13px;

        padding-top:11px;

        border-top:
          1px solid var(--line,#d9d0c2);
      }

      #supplierGrid .casevo-evidence summary {
        cursor:pointer;

        font-size:9px;

        color:
          var(--muted,#655d54);
      }

      #supplierGrid .casevo-evidence-text {
        margin-top:10px;

        font-size:9px;

        line-height:1.5;

        color:
          var(--muted,#655d54);
      }


      /* VERIFY BUTTON */

      #supplierGrid .casevo-verify-button {
        display:inline-flex;

        align-items:center;

        justify-content:center;

        margin-top:14px;

        padding:
          10px 13px;

        border:
          1px solid var(--red,#a92d25);

        background:
          transparent;

        color:
          var(--red,#a92d25);

        font-family:
          inherit;

        font-size:
          9px;

        font-weight:600;

        cursor:pointer;

        transition:
          all .2s ease;
      }

      #supplierGrid .casevo-verify-button:hover {
        background:
          var(--red,#a92d25);

        color:#fff;
      }

      #supplierGrid .casevo-verify-button:disabled {
        opacity:.55;
        cursor:wait;
      }


      /* VERIFICATION PANEL */

      #supplierGrid .casevo-verification-panel {
        margin-top:16px;

        padding:
          16px;

        border:
          1px solid var(--line,#d9d0c2);

        background:
          rgba(255,255,255,.22);
      }

      #supplierGrid .casevo-verification-eyebrow {
        margin-bottom:9px;

        font-size:8px;

        letter-spacing:.15em;

        text-transform:uppercase;

        color:
          var(--red,#a92d25);
      }

      #supplierGrid .casevo-verification-heading {
        display:flex;

        justify-content:
          space-between;

        align-items:
          flex-start;

        gap:14px;

        margin-bottom:13px;
      }

      #supplierGrid .casevo-verification-heading h5 {
        margin:0;

        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size:16px;

        font-weight:500;

        line-height:1.15;
      }

      #supplierGrid .casevo-verification-score {
        flex:
          0 0 auto;

        font-family:
          Georgia,
          "Times New Roman",
          serif;

        font-size:20px;

        color:
          var(--red,#a92d25);
      }

      #supplierGrid .casevo-verification-status {
        margin:
          0 0 14px;

        padding:
          9px 10px;

        border-left:
          2px solid var(--red,#a92d25);

        font-size:9px;

        line-height:1.45;
      }

      #supplierGrid .casevo-verification-list {
        border-top:
          1px solid var(--line,#d9d0c2);
      }

      #supplierGrid .casevo-verification-row {
        display:grid;

        grid-template-columns:
          minmax(0,1fr)
          minmax(0,1fr);

        gap:12px;

        padding:
          9px 0;

        border-bottom:
          1px solid var(--line,#d9d0c2);

        font-size:9px;

        line-height:1.4;
      }

      #supplierGrid .casevo-verification-row span:first-child {
        color:
          var(--muted,#756c61);
      }

      #supplierGrid .casevo-verification-row strong {
        font-weight:500;

        overflow-wrap:anywhere;
      }

      #supplierGrid .casevo-verification-summary {
        margin-top:13px;

        font-size:9px;

        line-height:1.55;

        color:
          var(--muted,#655d54);
      }

      #supplierGrid .casevo-verification-source {
        margin-top:12px;
      }

      #supplierGrid .casevo-verification-source details {
        margin-top:8px;
      }

      #supplierGrid .casevo-verification-source summary {
        cursor:pointer;

        font-size:9px;
      }

      #supplierGrid .casevo-source-item {
        margin-top:8px;

        padding-top:8px;

        border-top:
          1px solid var(--line,#d9d0c2);

        font-size:8px;

        line-height:1.45;
      }

      #supplierGrid .casevo-source-item a {
        color:
          var(--red,#a92d25);

        text-decoration:none;

        overflow-wrap:anywhere;
      }


      /* DISCOVERY STATUS */

      #supplierGrid .casevo-discovery-status {
        margin-top:13px;

        padding-top:10px;

        border-top:
          1px solid var(--line,#d9d0c2);

        font-size:8px;

        color:
          var(--muted,#756c61);
      }


      /* LOADING / ERROR */

      #supplierGrid .casevo-empty,
      #supplierGrid .casevo-error,
      #supplierGrid .casevo-loading {
        grid-column:1/-1;

        width:100%;

        padding:22px;

        border:
          1px solid var(--line,#d9d0c2);

        font-size:11px;

        line-height:1.6;
      }

      #supplierGrid .casevo-error {
        border-color:#c85a4f;
        color:#8f2f24;
      }


      @media (
        max-width:900px
      ) {

        #brief {
          grid-template-columns:
            repeat(
              2,
              minmax(0,1fr)
            );
        }

        #brief .casevo-readiness {
          grid-template-columns:
            repeat(
              2,
              minmax(0,1fr)
            );
        }

        #supplierGrid {
          grid-template-columns:
            1fr !important;
        }
      }


      @media (
        max-width:600px
      ) {

        #brief,
        #brief .casevo-readiness {
          grid-template-columns:
            1fr;
        }

        #supplierGrid .casevo-verification-row {
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
     SHOW RESULTS
     ========================================================== */

  function showResults() {
    resultContainer.hidden =
      false;

    resultContainer.style.display =
      "";
  }


  /* ==========================================================
     MAIN BUTTON LOADING
     ========================================================== */

  function setLoading(
    loading
  ) {
    if (
      !submitButton
    ) {
      return;
    }


    if (
      loading
    ) {

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
     BRIEF
     ========================================================== */

  function briefCell(
    label,
    value
  ) {
    return `
      <div class="casevo-brief-cell">

        <span class="casevo-label">
          ${escapeHtml(label)}
        </span>

        <div class="casevo-value">
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

        <span class="casevo-label">
          ${escapeHtml(label)}
        </span>

        <div class="casevo-readiness-value">
          ${escapeHtml(value)}
        </div>

      </div>
    `;
  }


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
          function (
            item
          ) {
            return `
              <span class="casevo-tag">
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

              <span class="casevo-label">
                Normalized requirements
              </span>

              <div class="casevo-tags">
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
      supplier ||
      {};


    const name =
      firstNonEmpty(
        item.companyName,
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


    const verificationStatus =
      firstNonEmpty(
        item.verificationStatus,
        item.verification_status,
        "Unverified — due diligence required"
      );


    return `
      <article
        class="supplier"
        data-casevo-supplier-index="${index}"
      >

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


        <button
          type="button"
          class="casevo-verify-button"
          data-casevo-verify="${index}"
        >
          Verify Supplier →
        </button>


        <div
          class="casevo-verification-panel"
          data-casevo-verification-panel="${index}"
          hidden
        ></div>


        <div class="casevo-discovery-status">
          ${escapeHtml(
            verificationStatus
          )}
        </div>

      </article>
    `;
  }


  /* ==========================================================
     DISCOVERY LOADING
     ========================================================== */

  function renderLoading() {
    showResults();


    if (
      resultTitle
    ) {
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
     DISCOVERY ERROR
     ========================================================== */

  function renderError(
    message
  ) {
    showResults();


    if (
      resultTitle
    ) {
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

          <br><br>

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
     RENDER DISCOVERY RESULT
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


    state.lastFormValues =
      values;

    state.lastResult =
      result;

    state.suppliers =
      result.matches;


    showResults();


    if (
      resultTitle
    ) {
      resultTitle.textContent =
        result.matches.length

          ? "Supplier matches"

          : "No supplier matches were returned.";
    }


    const badge =
      qs(
        ".analysis-badge",
        resultContainer
      );


    if (
      badge
    ) {
      badge.textContent =
        "STRUCTURED BRIEF READY";
    }


    renderBrief(
      result
    );


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
            but no supplier candidates passed the
            current company-quality filters.

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


    const humanNote =
      qs(
        ".human-note",
        resultContainer
      );


    if (
      humanNote
    ) {
      humanNote.style.display =
        "";
    }


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
     SEND SOURCING REQUEST
     ========================================================== */

  async function sendSourcingRequest(
    values
  ) {
    const response =
      await fetch(
        SOURCING_ENDPOINT,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
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
     VERIFY SUPPLIER REQUEST
     ========================================================== */

  async function verifySupplier(
    supplier,
    product
  ) {
    const response =
      await fetch(
        VERIFY_ENDPOINT,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json"
          },

          body:
            JSON.stringify({
              supplier,

              product:
                product ||
                ""
            })
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
        `Verification server returned invalid JSON (HTTP ${response.status}).`
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
          `Supplier verification failed (HTTP ${response.status}).`
        )
      );
    }


    return data;
  }


  /* ==========================================================
     VERIFICATION VALUE
     ========================================================== */

  function verificationRow(
    label,
    value
  ) {
    let displayValue =
      value;


    if (
      Array.isArray(
        displayValue
      )
    ) {
      displayValue =
        displayValue.join(
          ", "
        );
    }


    displayValue =
      firstNonEmpty(
        displayValue,
        "Not confirmed"
      );


    return `
      <div class="casevo-verification-row">

        <span>
          ${escapeHtml(label)}
        </span>

        <strong>
          ${escapeHtml(displayValue)}
        </strong>

      </div>
    `;
  }


  /* ==========================================================
     VERIFICATION SOURCES
     ========================================================== */

  function renderVerificationSources(
    evidence
  ) {
    if (
      !Array.isArray(
        evidence
      ) ||
      !evidence.length
    ) {
      return "";
    }


    const sources =
      evidence
        .slice(
          0,
          6
        )
        .map(
          function (
            item,
            index
          ) {
            const url =
              safeUrl(
                item?.url
              );


            const title =
              firstNonEmpty(
                item?.title,
                item?.domain,
                `Public source ${index + 1}`
              );


            const evidenceText =
              truncate(
                cleanWebText(
                  item?.evidence
                ),
                280
              );


            return `
              <div class="casevo-source-item">

                ${
                  url
                    ? `
                      <a
                        href="${escapeAttr(url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        ${escapeHtml(title)} →
                      </a>
                    `
                    : `
                      <strong>
                        ${escapeHtml(title)}
                      </strong>
                    `
                }

                ${
                  evidenceText
                    ? `
                      <div style="margin-top:5px;">
                        ${escapeHtml(evidenceText)}
                      </div>
                    `
                    : ""
                }

              </div>
            `;
          }
        )
        .join("");


    return `
      <div class="casevo-verification-source">

        <details>

          <summary>
            View verification sources
          </summary>

          ${sources}

        </details>

      </div>
    `;
  }


  /* ==========================================================
     RENDER VERIFICATION RESULT
     ========================================================== */

  function renderVerificationResult(
    panel,
    data
  ) {
    const verification =
      data?.verification ||
      {};

    const supplier =
      data?.supplier ||
      {};


    const score =
      normalizeScore(
        verification.score
      );


    const certifications =
      Array.isArray(
        verification.certifications
      )
        ? verification.certifications
        : (
            Array.isArray(
              supplier.certifications
            )
              ? supplier.certifications
              : []
          );


    const status =
      firstNonEmpty(
        verification.status,
        "Manual review required"
      );


    const summary =
      cleanWebText(
        verification.summary
      );


    panel.hidden =
      false;


    panel.innerHTML =
      `
        <div class="casevo-verification-eyebrow">
          CASEVO / HUMAN VERIFICATION
        </div>


        <div class="casevo-verification-heading">

          <h5>
            Supplier verification research
          </h5>

          <div class="casevo-verification-score">
            ${escapeHtml(score)}/100
          </div>

        </div>


        <div class="casevo-verification-status">
          ${escapeHtml(status)}
        </div>


        <div class="casevo-verification-list">

          ${verificationRow(
            "Company identity",
            verification.companyIdentity
          )}

          ${verificationRow(
            "Official website",
            verification.officialWebsite
          )}

          ${verificationRow(
            "Manufacturing capability",
            verification.manufacturingCapability
          )}

          ${verificationRow(
            "OEM / ODM",
            verification.oemOdm
          )}

          ${verificationRow(
            "MOQ",
            verification.moq ||
            supplier.moq
          )}

          ${verificationRow(
            "Certifications",
            certifications.length
              ? certifications
              : "Not confirmed"
          )}

          ${verificationRow(
            "Export capability",
            verification.exportCapability
          )}

          ${verificationRow(
            "Contact",
            verification.contact
          )}

          ${verificationRow(
            "Location",
            verification.location ||
            supplier.location
          )}

        </div>


        ${
          summary
            ? `
              <div class="casevo-verification-summary">
                ${escapeHtml(summary)}
              </div>
            `
            : ""
        }


        ${renderVerificationSources(
          data?.evidence
        )}


        <div
          style="
            margin-top:13px;
            padding-top:10px;
            border-top:1px solid var(--line,#d9d0c2);
            font-size:8px;
            line-height:1.45;
            color:var(--muted,#756c61);
          "
        >
          Public-web verification research only.
          Final company, banking, certification,
          production and commercial verification
          is still required before placing an order.
        </div>
      `;
  }


  /* ==========================================================
     VERIFICATION ERROR
     ========================================================== */

  function renderVerificationError(
    panel,
    message
  ) {
    panel.hidden =
      false;


    panel.innerHTML =
      `
        <div class="casevo-verification-eyebrow">
          CASEVO / VERIFICATION ERROR
        </div>

        <div
          style="
            font-size:9px;
            line-height:1.55;
          "
        >
          ${escapeHtml(
            firstNonEmpty(
              message,
              "Supplier verification could not be completed."
            )
          )}
        </div>
      `;
  }


  /* ==========================================================
     VERIFY CLICK HANDLER
     ========================================================== */

  async function handleVerifyClick(
    button
  ) {
    const index =
      Number(
        button.dataset
          .casevoVerify
      );


    if (
      !Number.isInteger(
        index
      ) ||
      !state.suppliers[
        index
      ]
    ) {
      return;
    }


    const supplier =
      state.suppliers[
        index
      ];


    const panel =
      qs(
        `[data-casevo-verification-panel="${index}"]`,
        supplierGrid
      );


    if (
      !panel
    ) {
      return;
    }


    /*
     * If already verified, toggle panel.
     */

    if (
      panel.dataset
        .casevoVerified ===
      "true"
    ) {
      panel.hidden =
        !panel.hidden;

      return;
    }


    const originalText =
      button.textContent;


    button.disabled =
      true;

    button.textContent =
      "Verifying…";


    panel.hidden =
      false;


    panel.innerHTML =
      `
        <div class="casevo-verification-eyebrow">
          CASEVO / HUMAN VERIFICATION
        </div>

        <div
          style="
            font-size:9px;
            line-height:1.55;
          "
        >
          Researching company identity,
          manufacturing capability,
          OEM/ODM, certifications,
          MOQ, export capability and
          public contact evidence…
        </div>
      `;


    try {
      const product =
        firstNonEmpty(
          state.lastResult?.product,
          state.lastFormValues?.product,
          state.lastFormValues?.requirement
        );


      const data =
        await verifySupplier(
          supplier,
          product
        );


      console.log(
        "CASEVO verification response:",
        data
      );


      renderVerificationResult(
        panel,
        data
      );


      panel.dataset
        .casevoVerified =
        "true";


      button.textContent =
        "Verification Complete ✓";


    } catch (
      error
    ) {
      console.error(
        "CASEVO verification failed:",
        error
      );


      renderVerificationError(
        panel,
        error?.message
      );


      button.textContent =
        "Retry Verification →";


    } finally {
      button.disabled =
        false;


      if (
        !panel.dataset
          .casevoVerified &&
        button.textContent ===
          "Verifying…"
      ) {
        button.textContent =
          originalText;
      }
    }
  }


  /* ==========================================================
     SUPPLIER GRID EVENT DELEGATION
     ========================================================== */

  supplierGrid.addEventListener(
    "click",
    function (
      event
    ) {
      const button =
        event.target.closest(
          "[data-casevo-verify]"
        );


      if (
        !button ||
        !supplierGrid.contains(
          button
        )
      ) {
        return;
      }


      event.preventDefault();


      handleVerifyClick(
        button
      );
    }
  );


  /* ==========================================================
     FORM SUBMIT
     ========================================================== */

  async function handleSubmit(
    event
  ) {
    event.preventDefault();


    const values =
      collectValues();


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


    setLoading(
      true
    );


    renderLoading();


    try {
      const data =
        await sendSourcingRequest(
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


    } catch (
      error
    ) {
      console.error(
        "CASEVO sourcing error:",
        error
      );


      renderError(
        error?.message ||
        "Unable to connect to CASEVO sourcing service."
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
    form.dataset
      .casevoBound !==
    "true"
  ) {
    form.dataset
      .casevoBound =
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
    window.CASEVO ||
    {};


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


      return sendSourcingRequest(
        request
      );
    };


  window.CASEVO.verifySupplier =
    async function (
      supplier,
      product
    ) {
      return verifySupplier(
        supplier,
        product
      );
    };


  /* ==========================================================
     MOBILE MENU
     ========================================================== */

  window.toggleMenu =
    window.toggleMenu ||
    function () {
      const nav =
        qs(
          ".nav-links"
        );


      if (
        !nav
      ) {
        return;
      }


      nav.style.display =
        nav.style.display ===
          "flex"

          ? ""

          : "flex";
    };


  /* ==========================================================
     CONTACT FORM
     ========================================================== */

  window.submitContact =
    window.submitContact ||
    function (
      event
    ) {
      if (
        event
      ) {
        event.preventDefault();
      }


      const message =
        qs(
          "#contactMessage"
        );


      if (
        message
      ) {
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
    "CASEVO frontend v4.1.0 initialized — Supplier Verification enabled."
  );

})();
