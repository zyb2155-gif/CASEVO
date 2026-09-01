/* ============================================================
   CASEVO AI SOURCING — v4.1.4 VERIFIED IDENTITY AUTHORITY
   Purpose:
   - Let Human Verification override discovery-stage display names.
   - If verification cannot confirm identity, replace suspicious display
     identity with "Company identity not confirmed".
   - Does not change sourcing scores or verification requests.
   ============================================================ */
(function () {
  "use strict";

  const UNKNOWN = "Company identity not confirmed";

  function clean(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function getVerificationValue(panel, label) {
    const rows = Array.from(
      panel.querySelectorAll(".casevo-verification-row")
    );

    const row = rows.find(function (item) {
      const key = clean(
        item.querySelector("span")?.textContent
      ).toLowerCase();

      return key === label.toLowerCase();
    });

    return clean(
      row?.querySelector("strong")?.textContent
    );
  }

  function authoritativeIdentity(panel) {
    const value = getVerificationValue(
      panel,
      "Company identity"
    );

    if (!value) {
      return "";
    }

    if (/^(?:not confirmed|partial identity evidence|confirmed public-web identity signal)$/i.test(value)) {
      return value.toLowerCase() === "not confirmed"
        ? UNKNOWN
        : "";
    }

    return value;
  }

  function applyVerificationIdentity(panel) {
    if (!panel || panel.hidden) {
      return;
    }

    const card = panel.closest(".supplier");
    const heading = card?.querySelector(
      ".casevo-supplier-name"
    );

    if (!card || !heading) {
      return;
    }

    const identity = authoritativeIdentity(panel);

    if (!identity) {
      return;
    }

    if (clean(heading.textContent) !== identity) {
      heading.textContent = identity;
      card.dataset.casevoAuthoritativeIdentity = identity;
    }
  }

  function scan(root) {
    const scope = root || document;

    scope
      .querySelectorAll?.(
        ".casevo-verification-panel"
      )
      .forEach(applyVerificationIdentity);
  }

  function start() {
    scan(document);

    const observer = new MutationObserver(function (mutations) {
      let shouldScan = false;

      for (const mutation of mutations) {
        if (
          mutation.type === "childList" ||
          mutation.type === "attributes" ||
          mutation.type === "characterData"
        ) {
          shouldScan = true;
          break;
        }
      }

      if (shouldScan) {
        scan(document);
      }
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["hidden"]
    });

    console.log(
      "CASEVO v4.1.4 Verified Identity Authority enabled."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }
})();
