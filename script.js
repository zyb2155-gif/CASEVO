(function () {
  "use strict";

  /*
   * ============================================================
   * CASEVO AI SOURCING — FRONTEND v3.1
   * ============================================================
   *
   * Frontend:
   * 1. Collect sourcing requirements
   * 2. Reliably detect all form fields
   * 3. Automatically recover destination from the main request
   * 4. POST to /api/sourcing
   * 5. Render real supplier search results
   *
   * Backend:
   * Cloudflare Worker
   * POST /api/sourcing
   *
   * ============================================================
   */

  const API_ENDPOINT = "/api/sourcing";

  console.log("========================================");
  console.log("CASEVO AI Sourcing frontend v3.1 loaded");
  console.log("API:", API_ENDPOINT);
  console.log("========================================");


  // ============================================================
  // BASIC HELPERS
  // ============================================================

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from(
      (root || document).querySelectorAll(selector)
    );
  }

  function normalize(value) {
    return String(value || "")
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

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function setHtml(el, html) {
    if (!el) return;
    el.innerHTML = html;
  }


  // ============================================================
  // FIND SOURCING FORM
  // ============================================================

  function findSourcingForm() {
    const forms = qsa("form");

    if (!forms.length) {
      console.warn("CASEVO: No form elements found.");
      return null;
    }

    /*
     * Prefer the form containing:
     * sourcing / destination / quantity / product
     */

    const scoring = forms.map(function (form) {
      const text = (
        form.innerText ||
        form.textContent ||
        ""
      ).toLowerCase();

      let score = 0;

      if (text.includes("sourcing")) {
        score += 10;
      }

      if (text.includes("what are you sourcing")) {
        score += 10;
      }

      if (text.includes("product")) {
        score += 5;
      }

      if (text.includes("material")) {
        score += 5;
      }

      if (text.includes("quantity")) {
        score += 5;
      }

      if (text.includes("destination")) {
        score += 10;
      }

      if (text.includes("target price")) {
        score += 5;
      }

      return {
        form: form,
        score: score
      };
    });

    scoring.sort(function (a, b) {
      return b.score - a.score;
    });

    console.log(
      "CASEVO: Form detection:",
      scoring
    );

    return scoring[0].form;
  }


  // ============================================================
  // ELEMENT TEXT / LABEL DETECTION
  // ============================================================

  function getElementContext(el) {
    if (!el) return "";

    let context = "";

    context += " ";
    context += el.name || "";
    context += " ";
    context += el.id || "";
    context += " ";
    context += el.placeholder || "";
    context += " ";
    context += el.getAttribute("aria-label") || "";
    context += " ";
    context += el.getAttribute("data-field") || "";
    context += " ";
    context += el.getAttribute("data-name") || "";
    context += " ";

    /*
     * Include associated label.
     */

    if (el.id) {
      const label = qs(
        'label[for="' +
          CSS.escape(el.id) +
          '"]'
      );

      if (label) {
        context += " ";
        context += label.innerText || label.textContent || "";
      }
    }

    /*
     * Include parent text.
     */

    if (el.parentElement) {
      context += " ";
      context +=
        el.parentElement.innerText ||
        el.parentElement.textContent ||
        "";
    }

    /*
     * Include grandparent text.
     */

    if (
      el.parentElement &&
      el.parentElement.parentElement
    ) {
      context += " ";
      context +=
        el.parentElement.parentElement.innerText ||
        el.parentElement.parentElement.textContent ||
        "";
    }

    return normalize(context).toLowerCase();
  }


  // ============================================================
  // FIND TEXTAREA
  // ============================================================

  function findRequirementTextarea(form) {
    if (!form) return null;

    const textareas = qsa(
      "textarea",
      form
    );

    if (!textareas.length) {
      return null;
    }

    /*
     * First try explicit attributes.
     */

    for (const textarea of textareas) {
      const context =
        getElementContext(textarea);

      if (
        context.includes("requirement") ||
        context.includes("requirements") ||
        context.includes("sourcing") ||
        context.includes("what are you sourcing") ||
        context.includes("brief") ||
        context.includes("request")
      ) {
        return textarea;
      }
    }

    /*
     * The large textarea is normally the sourcing requirement.
     */

    if (textareas.length === 1) {
      return textareas[0];
    }

    /*
     * Prefer the largest textarea.
     */

    return textareas.sort(function (a, b) {
      const aSize =
        (a.rows || 0) *
        (a.cols || 0);

      const bSize =
        (b.rows || 0) *
        (b.cols || 0);

      return bSize - aSize;
    })[0];
  }


  // ============================================================
  // FIND INPUT BY SEMANTIC MEANING
  // ============================================================

  function findInputByMeaning(
    form,
    keywords,
    fallbackIndex
  ) {
    if (!form) return null;

    const inputs = qsa(
      'input:not([type="hidden"]), select',
      form
    );

    if (!inputs.length) {
      return null;
    }

    /*
     * Strong semantic match.
     */

    for (const input of inputs) {
      const context =
        getElementContext(input);

      for (const keyword of keywords) {
        if (context.includes(keyword)) {
          return input;
        }
      }
    }

    /*
     * Fallback to visible input order.
     */

    if (
      typeof fallbackIndex === "number" &&
      inputs[fallbackIndex]
    ) {
      return inputs[fallbackIndex];
    }

    return null;
  }


  // ============================================================
  // SPECIFIC FIELD FINDERS
  // ============================================================

  function findProductInput(form) {
    return findInputByMeaning(
      form,
      [
        "product / material",
        "product/material",
        "product_material",
        "productmaterial",
        "material",
        "product"
      ],
      0
    );
  }


  function findQuantityInput(form) {
    return findInputByMeaning(
      form,
      [
        "quantity",
        "qty",
        "volume",
        "order quantity",
        "order_quantity"
      ],
      1
    );
  }


  function findPriceInput(form) {
    return findInputByMeaning(
      form,
      [
        "target price",
        "target_price",
        "targetprice",
        "price"
      ],
      2
    );
  }


  function findDestinationInput(form) {
    /*
     * IMPORTANT:
     * Destination is the field that previously failed.
     *
     * We deliberately search very aggressively here.
     */

    const inputs = qsa(
      'input:not([type="hidden"]), select',
      form
    );

    /*
     * 1. Exact semantic search.
     */

    const exactKeywords = [
      "destination",
      "shipping destination",
      "ship to",
      "shipping to",
      "country",
      "market",
      "delivery country",
      "destination country"
    ];

    for (const input of inputs) {
      const context =
        getElementContext(input);

      for (const keyword of exactKeywords) {
        if (context.includes(keyword)) {
          console.log(
            "CASEVO: Destination field detected:",
            input,
            "via:",
            keyword
          );

          return input;
        }
      }
    }

    /*
     * 2. Look for placeholder examples such as:
     * e.g. USA
     */

    for (const input of inputs) {
      const placeholder =
        normalize(
          input.placeholder || ""
        ).toLowerCase();

      if (
        placeholder.includes("usa") ||
        placeholder.includes("country") ||
        placeholder.includes("destination")
      ) {
        console.log(
          "CASEVO: Destination detected by placeholder:",
          input
        );

        return input;
      }
    }

    /*
     * 3. Use visible input order as final fallback.
     *
     * The CASEVO form currently uses:
     * Product
     * Quantity
     * Target Price
     * Destination
     */

    if (inputs.length >= 4) {
      console.log(
        "CASEVO: Destination detected by fallback index."
      );

      return inputs[3];
    }

    return null;
  }


  // ============================================================
  // EXTRACT DESTINATION FROM REQUIREMENT
  // ============================================================

  function extractDestinationFromRequirement(
    requirement
  ) {
    const text = normalize(requirement);

    if (!text) {
      return "";
    }

    /*
     * United States
     */

    if (
      /\bunited states\b/i.test(text) ||
      /\bUSA\b/i.test(text) ||
      /\bU\.S\.A\.\b/i.test(text) ||
      /\bU\.S\.\b/i.test(text) ||
      /\bUS\b/i.test(text) ||
      /\bUnited States of America\b/i.test(text)
    ) {
      return "United States";
    }

    /*
     * Canada
     */

    if (/\bcanada\b/i.test(text)) {
      return "Canada";
    }

    /*
     * United Kingdom
     */

    if (
      /\bunited kingdom\b/i.test(text) ||
      /\bUK\b/i.test(text) ||
      /\bU\.K\.\b/i.test(text)
    ) {
      return "United Kingdom";
    }

    /*
     * Australia
     */

    if (/\baustralia\b/i.test(text)) {
      return "Australia";
    }

    /*
     * Germany
     */

    if (/\bgermany\b/i.test(text)) {
      return "Germany";
    }

    /*
     * France
     */

    if (/\bfrance\b/i.test(text)) {
      return "France";
    }

    /*
     * Italy
     */

    if (/\bitaly\b/i.test(text)) {
      return "Italy";
    }

    /*
     * Spain
     */

    if (/\bspain\b/i.test(text)) {
      return "Spain";
    }

    /*
     * Netherlands
     */

    if (
      /\bnetherlands\b/i.test(text) ||
      /\bholland\b/i.test(text)
    ) {
      return "Netherlands";
    }

    /*
     * Japan
     */

    if (/\bjapan\b/i.test(text)) {
      return "Japan";
    }

    /*
     * South Korea
     */

    if (
      /\bsouth korea\b/i.test(text) ||
      /\bkorea\b/i.test(text)
    ) {
      return "South Korea";
    }

    /*
     * Singapore
     */

    if (/\bsingapore\b/i.test(text)) {
      return "Singapore";
    }

    /*
     * United Arab Emirates
     */

    if (
      /\bunited arab emirates\b/i.test(text) ||
      /\bUAE\b/i.test(text)
    ) {
      return "United Arab Emirates";
    }

    /*
     * Saudi Arabia
     */

    if (/\bsaudi arabia\b/i.test(text)) {
      return "Saudi Arabia";
    }

    /*
     * India
     */

    if (/\bindia\b/i.test(text)) {
      return "India";
    }

    /*
     * Mexico
     */

    if (/\bmexico\b/i.test(text)) {
      return "Mexico";
    }

    /*
     * Brazil
     */

    if (/\bbrazil\b/i.test(text)) {
      return "Brazil";
    }

    /*
     * China
     */

    if (/\bchina\b/i.test(text)) {
      return "China";
    }

    return "";
  }


  // ============================================================
  // COLLECT FORM VALUES
  // ============================================================

  function collectFormValues(form) {
    const textarea =
      findRequirementTextarea(form);

    const productInput =
      findProductInput(form);

    const quantityInput =
      findQuantityInput(form);

    const priceInput =
      findPriceInput(form);

    const destinationInput =
      findDestinationInput(form);


    let requirement = normalize(
      textarea
        ? textarea.value
        : ""
    );

    let product = normalize(
      productInput
        ? productInput.value
        : ""
    );

    let quantity = normalize(
      quantityInput
        ? quantityInput.value
        : ""
    );

    let targetPrice = normalize(
      priceInput
        ? priceInput.value
        : ""
    );

    let destination = normalize(
      destinationInput
        ? destinationInput.value
        : ""
    );


    /*
     * ==========================================================
     * CRITICAL FIX
     * ==========================================================
     *
     * If Destination is empty in the separate field,
     * automatically extract it from the main requirement.
     *
     * Example:
     *
     * "Premium leather shoe upper...
     * shipping to the United States."
     *
     * becomes:
     *
     * destination = "United States"
     */

    if (!destination) {
      destination =
        extractDestinationFromRequirement(
          requirement
        );

      if (destination) {
        console.log(
          "CASEVO: Destination recovered from requirement:",
          destination
        );
      }
    }


    /*
     * Also recover product if the product field
     * wasn't detected correctly.
     */

    if (!product) {
      const lower =
        requirement.toLowerCase();

      if (
        lower.includes("leather shoe upper")
      ) {
        product =
          "leather shoe upper";
      }
    }


    /*
     * Recover quantity from requirement.
     */

    if (!quantity) {
      const quantityMatch =
        requirement.match(
          /([\d,]+)\s*(pairs?|pcs?|pieces?|units?|sets?|kg|tons?|sq\s*ft|sqft)/i
        );

      if (quantityMatch) {
        quantity =
          normalize(
            quantityMatch[0]
          );
      }
    }


    /*
     * Recover target price.
     */

    if (!targetPrice) {
      const priceMatch =
        requirement.match(
          /(?:\$|USD\s*)\s*\d+(?:\.\d+)?(?:\s*\/\s*[a-z]+)?/i
        );

      if (priceMatch) {
        targetPrice =
          normalize(
            priceMatch[0]
          );
      }
    }


    const values = {
      requirement: requirement,
      product: product,
      quantity: quantity,
      targetPrice: targetPrice,
      destination: destination
    };


    console.log(
      "========================================"
    );

    console.log(
      "CASEVO: FINAL FORM VALUES"
    );

    console.log(
      JSON.stringify(
        values,
        null,
        2
      )
    );

    console.log(
      "========================================"
    );


    return values;
  }


  // ============================================================
  // VALIDATION
  // ============================================================

  function validate(values) {

    if (!values.requirement) {
      return {
        valid: false,
        message:
          "Please enter a sourcing requirement."
      };
    }


    if (
      values.requirement.length < 8
    ) {
      return {
        valid: false,
        message:
          "Please provide a little more detail about your sourcing requirement."
      };
    }


    /*
     * Destination is important for supplier matching.
     *
     * BUT:
     * We do not immediately fail here.
     *
     * First attempt recovery from requirement.
     */

    if (!values.destination) {
      values.destination =
        extractDestinationFromRequirement(
          values.requirement
        );
    }


    /*
     * If still empty, ask user.
     */

    if (!values.destination) {
      return {
        valid: false,
        message:
          "Please enter a destination, such as USA, United States, Canada, or the United Kingdom."
      };
    }


    return {
      valid: true,
      message: ""
    };
  }


  // ============================================================
  // FIND ANALYZE BUTTON
  // ============================================================

  function findAnalyzeButton(form) {
    if (!form) return null;

    const buttons = qsa(
      'button, input[type="submit"], input[type="button"]',
      form
    );

    if (!buttons.length) {
      return null;
    }


    for (const button of buttons) {

      const text = normalize(
        button.innerText ||
        button.value ||
        button.textContent ||
        ""
      ).toLowerCase();


      if (
        text.includes("analyze") ||
        text.includes("find matches") ||
        text.includes("analyse") ||
        text.includes("match") ||
        text.includes("start sourcing")
      ) {
        return button;
      }
    }


    return buttons[
      buttons.length - 1
    ];
  }


  // ============================================================
  // STATUS AREA
  // ============================================================

  function findStatusArea(form) {

    const selectors = [
      "[data-casevo-status]",
      "#casevo-status",
      ".casevo-status",
      ".sourcing-status",
      ".form-status"
    ];


    for (const selector of selectors) {

      const el =
        qs(selector, form);

      if (el) {
        return el;
      }
    }


    /*
     * Create runtime status.
     */

    const button =
      findAnalyzeButton(form);


    if (
      button &&
      button.parentElement
    ) {

      const existing =
        qs(
          ".casevo-runtime-status",
          button.parentElement
        );

      if (existing) {
        return existing;
      }


      const status =
        document.createElement(
          "div"
        );


      status.className =
        "casevo-runtime-status";


      status.style.marginTop =
        "14px";

      status.style.padding =
        "12px 14px";

      status.style.border =
        "1px solid rgba(0,0,0,.15)";

      status.style.fontSize =
        "14px";

      status.style.lineHeight =
        "1.5";

      status.style.display =
        "none";


      button.parentElement.appendChild(
        status
      );


      return status;
    }


    return null;
  }


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


    status.style.display =
      "block";


    if (type === "error") {

      status.style.borderColor =
        "rgba(180,40,30,.45)";

      status.style.color =
        "#8f241d";

    } else if (
      type === "success"
    ) {

      status.style.borderColor =
        "rgba(30,100,70,.35)";

      status.style.color =
        "#245c43";

    } else {

      status.style.borderColor =
        "rgba(0,0,0,.15)";

      status.style.color =
        "inherit";
    }


    setText(
      status,
      message
    );
  }


  // ============================================================
  // RESULTS CONTAINER
  // ============================================================

  function findResultsContainer(form) {

    let container =
      qs(
        "[data-casevo-results]"
      ) ||
      qs(
        "#casevo-results"
      ) ||
      qs(
        ".casevo-results"
      );


    if (container) {
      return container;
    }


    container =
      document.createElement(
        "div"
      );


    container.id =
      "casevo-results";


    container.style.marginTop =
      "24px";

    container.style.padding =
      "24px";

    container.style.border =
      "1px solid rgba(0,0,0,.14)";

    container.style.background =
      "rgba(255,255,255,.18)";


    /*
     * Put result after form.
     */

    if (
      form &&
      form.parentElement
    ) {

      form.parentElement.appendChild(
        container
      );
    }


    return container;
  }


  // ============================================================
  // RENDER RESULTS
  // ============================================================

  function renderResult(
    form,
    data
  ) {

    console.log(
      "CASEVO: Rendering Worker result:",
      data
    );


    const container =
      findResultsContainer(form);


    if (!container) {
      return;
    }


    const analysis =
      data.analysis ||
      data.brief ||
      {};


    const matches =
      Array.isArray(
        data.matches
      )
        ? data.matches
        : [];


    let html = "";


    /*
     * Header
     */

    html +=
      '<div style="' +
      'font-size:12px;' +
      'letter-spacing:.16em;' +
      'text-transform:uppercase;' +
      'margin-bottom:10px;' +
      '">' +
      "CASEVO AI" +
      "</div>";


    html +=
      '<h3 style="' +
      'margin:0 0 18px;' +
      'font-size:28px;' +
      '">' +
      "Sourcing analysis completed." +
      "</h3>";


    /*
     * Product
     */

    if (
      analysis.product
    ) {

      html +=
        "<p>" +
        "<strong>Product / Material:</strong> " +
        escapeHtml(
          analysis.product
        ) +
        "</p>";
    }


    /*
     * Quantity
     */

    if (
      analysis.quantity
    ) {

      html +=
        "<p>" +
        "<strong>Quantity:</strong> " +
        escapeHtml(
          analysis.quantity
        ) +
        "</p>";
    }


    /*
     * Target price
     */

    if (
      analysis.targetPrice
    ) {

      html +=
        "<p>" +
        "<strong>Target Price:</strong> " +
        escapeHtml(
          analysis.targetPrice
        ) +
        "</p>";
    }


    /*
     * Destination
     */

    if (
      analysis.destination
    ) {

      html +=
        "<p>" +
        "<strong>Destination:</strong> " +
        escapeHtml(
          analysis.destination
        ) +
        "</p>";
    }


    /*
     * Supplier matches
     */

    if (
      matches.length
    ) {

      html +=
        '<div style="' +
        'margin-top:24px;' +
        '">';


      html +=
        '<div style="' +
        'font-size:12px;' +
        'letter-spacing:.12em;' +
        'text-transform:uppercase;' +
        'margin-bottom:12px;' +
        '">' +
        "Potential Supplier Matches" +
        "</div>";


      matches.forEach(
        function (
          match,
          index
        ) {

          html +=
            '<div style="' +
            'border-top:1px solid rgba(0,0,0,.15);' +
            'padding:18px 0;' +
            '">';


          html +=
            '<div style="' +
            'font-size:20px;' +
            'font-weight:600;' +
            'margin-bottom:8px;' +
            '">' +
            escapeHtml(
              match.name ||
              "Supplier Match " +
              (index + 1)
            ) +
            "</div>";


          if (
            match.location
          ) {

            html +=
              "<div>" +
              "<strong>Location:</strong> " +
              escapeHtml(
                match.location
              ) +
              "</div>";
          }


          if (
            match.capability
          ) {

            html +=
              "<div style=\"margin-top:6px;\">" +
              "<strong>Capability:</strong> " +
              escapeHtml(
                match.capability
              ) +
              "</div>";
          }


          if (
            typeof match.matchScore !==
            "undefined"
          ) {

            html +=
              "<div style=\"margin-top:6px;\">" +
              "<strong>Match score:</strong> " +
              escapeHtml(
                match.matchScore
              ) +
              "/99" +
              "</div>";
          }


          if (
            typeof match.score !==
            "undefined" &&
            typeof match.matchScore ===
            "undefined"
          ) {

            html +=
              "<div style=\"margin-top:6px;\">" +
              "<strong>Match score:</strong> " +
              escapeHtml(
                match.score
              ) +
              "</div>";
          }


          if (
            match.website
          ) {

            html +=
              '<div style="margin-top:10px;">' +
              '<a href="' +
              escapeHtml(
                match.website
              ) +
              '" target="_blank" rel="noopener noreferrer">' +
              "Visit supplier website →" +
              "</a>" +
              "</div>";
          }


          if (
            match.evidence
          ) {

            html +=
              '<div style="' +
              'margin-top:12px;' +
              'padding:12px;' +
              'border:1px solid rgba(0,0,0,.10);' +
              'font-size:13px;' +
              'line-height:1.6;' +
              '">' +
              "<strong>Public-web evidence:</strong><br>" +
              escapeHtml(
                match.evidence
              ) +
              "</div>";
          }


          if (
            match.verificationStatus
          ) {

            html +=
              '<div style="' +
              'margin-top:10px;' +
              'font-size:12px;' +
              'opacity:.7;' +
              '">' +
              escapeHtml(
                match.verificationStatus
              ) +
              "</div>";
          }


          html +=
            "</div>";
        }
      );


      html +=
        "</div>";

    } else {

      /*
       * No supplier matches.
       */

      html +=
        '<div style="' +
        'margin-top:20px;' +
        'padding:16px;' +
        'border:1px solid rgba(0,0,0,.12);' +
        'line-height:1.6;' +
        '">' +
        "The sourcing requirement was successfully received by CASEVO." +
        "</div>";
    }


    /*
     * Metadata
     */

    if (
      data.meta
    ) {

      html +=
        '<div style="' +
        'margin-top:18px;' +
        'font-size:12px;' +
        'opacity:.65;' +
        'line-height:1.6;' +
        '">';


      if (
        data.meta.supplierData
      ) {

        html +=
          "Supplier data: " +
          escapeHtml(
            data.meta.supplierData
          ) +
          "<br>";
      }


      if (
        data.meta.verified ===
        false
      ) {

        html +=
          "Verification: Public-web discovery; independent verification required.<br>";
      }


      html +=
        "</div>";
    }


    /*
     * Request ID
     */

    if (
      data.requestId
    ) {

      html +=
        '<div style="' +
        'margin-top:16px;' +
        'font-size:12px;' +
        'opacity:.65;' +
        '">' +
        "Request ID: " +
        escapeHtml(
          data.requestId
        ) +
        "</div>";
    }


    setHtml(
      container,
      html
    );


    /*
     * Scroll to result.
     */

    try {

      container.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

    } catch (error) {
      console.log(
        "CASEVO: scrollIntoView unavailable."
      );
    }
  }


  // ============================================================
  // SEND REQUEST TO CLOUDFLARE WORKER
  // ============================================================

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


    console.log(
      "CASEVO: API payload:",
      JSON.stringify(
        payload,
        null,
        2
      )
    );


    let response;


    try {

      response =
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

    } catch (networkError) {

      console.error(
        "CASEVO: Network error:",
        networkError
      );

      throw new Error(
        "Unable to connect to the CASEVO sourcing engine."
      );
    }


    console.log(
      "CASEVO: Worker HTTP status:",
      response.status
    );


    const contentType =
      response.headers.get(
        "content-type"
      ) || "";


    let data;


    /*
     * JSON response.
     */

    if (
      contentType.includes(
        "application/json"
      )
    ) {

      try {

        data =
          await response.json();

      } catch (jsonError) {

        console.error(
          "CASEVO: JSON parse error:",
          jsonError
        );

        throw new Error(
          "The CASEVO sourcing engine returned invalid JSON."
        );
      }

    } else {

      const text =
        await response.text();


      console.error(
        "CASEVO: Worker returned non-JSON:",
        text
      );


      throw new Error(
        "The CASEVO sourcing engine returned an unexpected response."
      );
    }


    console.log(
      "CASEVO: API response:",
      data
    );


    /*
     * Worker error.
     */

    if (
      !response.ok
    ) {

      const errorMessage =
        data.error ||
        data.message ||
        data.details ||
        (
          "Worker request failed with HTTP " +
          response.status
        );


      throw new Error(
        errorMessage
      );
    }


    /*
     * Successful response.
     */

    return data;
  }


  // ============================================================
  // SUBMIT HANDLER
  // ============================================================

  async function handleSubmit(
    event
  ) {

    event.preventDefault();


    const form =
      event.currentTarget;


    const button =
      findAnalyzeButton(
        form
      );


    const originalText =
      button
        ? (
            button.innerText ||
            button.value ||
            "Analyze & Find Matches"
          )
        : "";


    /*
     * Collect everything.
     */

    const values =
      collectFormValues(
        form
      );


    /*
     * Validate.
     */

    const validation =
      validate(
        values
      );


    if (
      !validation.valid
    ) {

      showStatus(
        form,
        validation.message,
        "error"
      );


      console.warn(
        "CASEVO: Validation failed:",
        validation.message
      );


      return;
    }


    /*
     * Disable button.
     */

    if (button) {

      button.disabled =
        true;


      if (
        button.tagName.toLowerCase() ===
        "input"
      ) {

        button.value =
          "Analyzing...";

      } else {

        button.innerText =
          "Analyzing...";
      }


      button.style.opacity =
        "0.7";

      button.style.cursor =
        "wait";
    }


    /*
     * Status.
     */

    showStatus(
      form,
      "Connecting to CASEVO sourcing engine...",
      "loading"
    );


    try {

      const data =
        await sendToWorker(
          values
        );


      /*
       * Success.
       */

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
        "CASEVO: Sourcing request failed:",
        error
      );


      showStatus(
        form,
        error.message ||
          "Unable to connect to the CASEVO sourcing engine.",
        "error"
      );

    } finally {

      /*
       * Restore button.
       */

      if (button) {

        button.disabled =
          false;


        if (
          button.tagName.toLowerCase() ===
          "input"
        ) {

          button.value =
            originalText;

        } else {

          button.innerText =
            originalText;
        }


        button.style.opacity =
          "";

        button.style.cursor =
          "";
      }
    }
  }


  // ============================================================
  // INITIALIZATION
  // ============================================================

  function initialize() {

    console.log(
      "CASEVO: Initializing sourcing frontend..."
    );


    const form =
      findSourcingForm();


    if (!form) {

      console.warn(
        "CASEVO: No sourcing form found."
      );

      return;
    }


    const textarea =
      findRequirementTextarea(
        form
      );

    const productInput =
      findProductInput(
        form
      );

    const quantityInput =
      findQuantityInput(
        form
      );

    const priceInput =
      findPriceInput(
        form
      );

    const destinationInput =
      findDestinationInput(
        form
      );

    const button =
      findAnalyzeButton(
        form
      );


    console.log(
      "========================================"
    );

    console.log(
      "CASEVO: FORM ELEMENTS"
    );

    console.log(
      "Requirement:",
      textarea
    );

    console.log(
      "Product:",
      productInput
    );

    console.log(
      "Quantity:",
      quantityInput
    );

    console.log(
      "Target Price:",
      priceInput
    );

    console.log(
      "Destination:",
      destinationInput
    );

    console.log(
      "Analyze Button:",
      button
    );

    console.log(
      "========================================"
    );


    /*
     * Prevent duplicate initialization.
     */

    if (
      form.dataset.casevoInitialized ===
      "true"
    ) {

      console.log(
        "CASEVO: Form already initialized."
      );

      return;
    }


    form.dataset.casevoInitialized =
      "true";


    /*
     * Submit event.
     */

    form.addEventListener(
      "submit",
      handleSubmit
    );


    /*
     * Button fallback.
     *
     * Some page builders do not correctly
     * submit forms.
     */

    if (button) {

      button.addEventListener(
        "click",
        function (event) {

          console.log(
            "CASEVO: Analyze button clicked."
          );


          /*
           * If the button is not a submit button,
           * manually trigger the submit handler.
           */

          const type =
            (
              button.getAttribute(
                "type"
              ) || ""
            ).toLowerCase();


          if (
            type !== "submit" &&
            !button.form
          ) {

            event.preventDefault();

            handleSubmit({
              preventDefault:
                function () {},

              currentTarget:
                form
            });
          }
        }
      );
    }


    /*
     * Debug API endpoint.
     */

    console.log(
      "CASEVO: API endpoint ready:",
      API_ENDPOINT
    );


    console.log(
      "CASEVO: Frontend initialization complete."
    );
  }


  // ============================================================
  // START
  // ============================================================

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

})();
