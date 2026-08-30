(function () {
  "use strict";

  /*
   * ============================================================
   * CASEVO AI SOURCING — FRONTEND
   * ============================================================
   *
   * Frontend responsibilities:
   * 1. Collect sourcing requirements
   * 2. Validate the request
   * 3. POST to Cloudflare Worker /api/sourcing
   * 4. Render the Worker response
   *
   * No OpenAI API key is required in the browser.
   * ============================================================
   */

  const API_ENDPOINT = "/api/sourcing";

  console.log("CASEVO AI Sourcing frontend loaded.");
  console.log("CASEVO API:", API_ENDPOINT);

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from(
      (root || document).querySelectorAll(selector)
    );
  }

  function firstExisting(selectors) {
    for (const selector of selectors) {
      const el = qs(selector);
      if (el) return el;
    }
    return null;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function setHtml(el, html) {
    if (!el) return;
    el.innerHTML = html;
  }

  // ------------------------------------------------------------
  // Locate sourcing form
  // ------------------------------------------------------------

  function findSourcingForm() {
    const forms = qsa("form");

    if (!forms.length) {
      return null;
    }

    // Prefer a form containing sourcing-related fields.
    const matching = forms.find(function (form) {
      const text = (
        form.innerText ||
        form.textContent ||
        ""
      ).toLowerCase();

      return (
        text.includes("sourcing") ||
        text.includes("product") ||
        text.includes("quantity") ||
        text.includes("destination")
      );
    });

    return matching || forms[0];
  }

  // ------------------------------------------------------------
  // Locate fields
  // ------------------------------------------------------------

  function findTextarea(form) {
    if (!form) return null;

    return (
      qs(
        'textarea[name="requirement"], textarea[name="requirements"], textarea[name="request"], textarea[name="brief"], textarea',
        form
      ) || null
    );
  }

  function findInput(form, names, indexFallback) {
    if (!form) return null;

    for (const name of names) {
      const el = qs(
        'input[name="' + name + '"]',
        form
      );

      if (el) return el;
    }

    const inputs = qsa("input", form);

    if (
      typeof indexFallback === "number" &&
      inputs[indexFallback]
    ) {
      return inputs[indexFallback];
    }

    return null;
  }

  // ------------------------------------------------------------
  // Collect form values
  // ------------------------------------------------------------

  function collectFormValues(form) {
    const textarea = findTextarea(form);

    const productInput = findInput(
      form,
      [
        "product",
        "material",
        "product_material",
        "productMaterial"
      ],
      0
    );

    const quantityInput = findInput(
      form,
      [
        "quantity",
        "qty",
        "volume",
        "order_quantity"
      ],
      1
    );

    const priceInput = findInput(
      form,
      [
        "price",
        "target_price",
        "targetPrice"
      ],
      2
    );

    const destinationInput = findInput(
      form,
      [
        "destination",
        "market",
        "country"
      ],
      3
    );

    const values = {
      requirement: normalize(
        textarea ? textarea.value : ""
      ),

      product: normalize(
        productInput ? productInput.value : ""
      ),

      quantity: normalize(
        quantityInput ? quantityInput.value : ""
      ),

      targetPrice: normalize(
        priceInput ? priceInput.value : ""
      ),

      destination: normalize(
        destinationInput ? destinationInput.value : ""
      )
    };

    console.log(
      "CASEVO: Form values collected",
      values
    );

    return values;
  }

  // ------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------

  function validate(values) {
    if (!values.requirement) {
      return {
        valid: false,
        message: "Please enter a sourcing requirement."
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

  // ------------------------------------------------------------
  // Find / create status area
  // ------------------------------------------------------------

  function findStatusArea(form) {
    const candidates = [
      "[data-casevo-status]",
      "#casevo-status",
      ".casevo-status",
      ".sourcing-status",
      ".form-status",
      ".status"
    ];

    for (const selector of candidates) {
      const el = qs(selector, form);
      if (el) return el;
    }

    // Look near the submit button.
    const button = findAnalyzeButton(form);

    if (button && button.parentElement) {
      const existing = qs(
        ".casevo-runtime-status",
        button.parentElement
      );

      if (existing) {
        return existing;
      }

      const status = document.createElement("div");

      status.className = "casevo-runtime-status";

      status.style.marginTop = "14px";
      status.style.padding = "12px 14px";
      status.style.border = "1px solid rgba(0,0,0,.15)";
      status.style.fontSize = "14px";
      status.style.lineHeight = "1.5";
      status.style.display = "none";

      button.parentElement.appendChild(status);

      return status;
    }

    return null;
  }

  function showStatus(form, message, type) {
    const status = findStatusArea(form);

    if (!status) {
      console.log("CASEVO STATUS:", message);
      return;
    }

    status.style.display = "block";

    if (type === "error") {
      status.style.borderColor =
        "rgba(180,40,30,.35)";
    } else if (type === "success") {
      status.style.borderColor =
        "rgba(30,100,70,.35)";
    } else {
      status.style.borderColor =
        "rgba(0,0,0,.15)";
    }

    setText(status, message);
  }

  // ------------------------------------------------------------
  // Locate Analyze button
  // ------------------------------------------------------------

  function findAnalyzeButton(form) {
    if (!form) return null;

    const buttons = qsa(
      'button, input[type="submit"]',
      form
    );

    for (const button of buttons) {
      const text = (
        button.innerText ||
        button.value ||
        button.textContent ||
        ""
      )
        .trim()
        .toLowerCase();

      if (
        text.includes("analyze") ||
        text.includes("find matches") ||
        text.includes("analyse") ||
        text.includes("match")
      ) {
        return button;
      }
    }

    return buttons[buttons.length - 1] || null;
  }

  // ------------------------------------------------------------
  // Render API result
  // ------------------------------------------------------------

  function renderResult(form, data) {
    console.log(
      "CASEVO: Rendering Worker result",
      data
    );

    let container =
      qs("[data-casevo-results]") ||
      qs("#casevo-results") ||
      qs(".casevo-results");

    if (!container) {
      container = document.createElement("div");

      container.id = "casevo-results";

      container.style.marginTop = "24px";
      container.style.padding = "24px";
      container.style.border =
        "1px solid rgba(0,0,0,.14)";
      container.style.background =
        "rgba(255,255,255,.18)";

      form.parentElement.appendChild(container);
    }

    const analysis =
      data.analysis ||
      data.brief ||
      {};

    const matches =
      Array.isArray(data.matches)
        ? data.matches
        : [];

    let html = "";

    html +=
      '<div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;margin-bottom:10px;">CASEVO AI</div>';

    html +=
      '<h3 style="margin:0 0 18px;font-size:28px;">Sourcing analysis completed.</h3>';

    if (analysis.product) {
      html +=
        "<p><strong>Product / Material:</strong> " +
        escapeHtml(analysis.product) +
        "</p>";
    }

    if (analysis.quantity) {
      html +=
        "<p><strong>Quantity:</strong> " +
        escapeHtml(analysis.quantity) +
        "</p>";
    }

    if (analysis.targetPrice) {
      html +=
        "<p><strong>Target Price:</strong> " +
        escapeHtml(analysis.targetPrice) +
        "</p>";
    }

    if (analysis.destination) {
      html +=
        "<p><strong>Destination:</strong> " +
        escapeHtml(analysis.destination) +
        "</p>";
    }

    if (matches.length) {
      html +=
        '<div style="margin-top:24px;">';

      html +=
        '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:12px;">Potential Supplier Matches</div>';

      matches.forEach(function (match, index) {
        html +=
          '<div style="border-top:1px solid rgba(0,0,0,.15);padding:14px 0;">';

        html +=
          "<strong>" +
          escapeHtml(
            match.name ||
            "Supplier Match " + (index + 1)
          ) +
          "</strong>";

        if (match.location) {
          html +=
            "<div>" +
            escapeHtml(match.location) +
            "</div>";
        }

        if (match.capability) {
          html +=
            "<div>" +
            escapeHtml(match.capability) +
            "</div>";
        }

        if (
          typeof match.score !== "undefined"
        ) {
          html +=
            "<div>Match score: " +
            escapeHtml(match.score) +
            "</div>";
        }

        html += "</div>";
      });

      html += "</div>";
    } else {
      html +=
        '<div style="margin-top:20px;padding:14px;border:1px solid rgba(0,0,0,.12);">';

      html +=
        "The sourcing requirement was successfully received by CASEVO.";

      html += "</div>";
    }

    if (data.requestId) {
      html +=
        '<div style="margin-top:16px;font-size:12px;opacity:.65;">Request ID: ' +
        escapeHtml(data.requestId) +
        "</div>";
    }

    setHtml(container, html);

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // ------------------------------------------------------------
  // API request
  // ------------------------------------------------------------

  async function sendToWorker(values) {
    console.log(
      "CASEVO: Sending sourcing request to:",
      API_ENDPOINT
    );

    const response = await fetch(
      API_ENDPOINT,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },

        body: JSON.stringify({
          requirement: values.requirement,
          product: values.product,
          quantity: values.quantity,
          targetPrice: values.targetPrice,
          destination: values.destination
        })
      }
    );

    console.log(
      "CASEVO: Worker HTTP status:",
      response.status
    );

    const contentType =
      response.headers.get("content-type") || "";

    let data;

    if (
      contentType.includes("application/json")
    ) {
      data = await response.json();
    } else {
      const text = await response.text();

      console.error(
        "CASEVO: Worker returned non-JSON:",
        text
      );

      throw new Error(
        "Worker returned an unexpected response."
      );
    }

    console.log(
      "CASEVO: Sourcing API response:",
      data
    );

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Worker request failed with HTTP " +
          response.status
      );
    }

    return data;
  }

  // ------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------

  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;

    const button = findAnalyzeButton(form);

    const originalText = button
      ? (
          button.innerText ||
          button.value ||
          "Analyze & Find Matches"
        )
      : "";

    const values = collectFormValues(form);

    const validation = validate(values);

    if (!validation.valid) {
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

    if (button) {
      button.disabled = true;

      if ("value" in button) {
        if (
          button.tagName.toLowerCase() ===
          "input"
        ) {
          button.value = "Analyzing...";
        }
      }

      if (
        button.tagName.toLowerCase() ===
        "button"
      ) {
        button.innerText =
          "Analyzing...";
      }

      button.style.opacity = "0.7";
      button.style.cursor = "wait";
    }

    showStatus(
      form,
      "Connecting to CASEVO sourcing engine...",
      "loading"
    );

    try {
      const data =
        await sendToWorker(values);

      showStatus(
        form,
        "Sourcing analysis completed.",
        "success"
      );

      renderResult(form, data);
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
      if (button) {
        button.disabled = false;

        if (
          button.tagName.toLowerCase() ===
          "input"
        ) {
          button.value = originalText;
        } else {
          button.innerText =
            originalText;
        }

        button.style.opacity = "";
        button.style.cursor = "";
      }
    }
  }

  // ------------------------------------------------------------
  // Initialization
  // ------------------------------------------------------------

  function initialize() {
    console.log(
      "CASEVO: sourcing form initializing."
    );

    const form = findSourcingForm();

    if (!form) {
      console.warn(
        "CASEVO: No sourcing form found."
      );
      return;
    }

    console.log(
      "CASEVO: Elements found:",
      {
        form: form,
        textarea: findTextarea(form),
        button: findAnalyzeButton(form)
      }
    );

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

    form.addEventListener(
      "submit",
      handleSubmit
    );

    const button =
      findAnalyzeButton(form);

    if (button) {
      button.addEventListener(
        "click",
        function () {
          console.log(
            "CASEVO: Analyze button clicked"
          );
        }
      );
    }

    console.log(
      "CASEVO: sourcing form initialized."
    );

    console.log(
      "CASEVO: API endpoint ready:",
      API_ENDPOINT
    );
  }

  // ------------------------------------------------------------
  // Start
  // ------------------------------------------------------------

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }

})();
