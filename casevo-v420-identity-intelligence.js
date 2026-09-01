/* ============================================================
   CASEVO AI SOURCING — v4.2.0 SUPPLIER IDENTITY INTELLIGENCE
   - Legal company / Brand / Unconfirmed identity badges
   - Verification-authority card-name synchronization
   - Additive only: existing sourcing UI, scores and verification remain intact
   ============================================================ */
(function () {
  "use strict";

  const UNKNOWN = "Company identity not confirmed";
  const originalFetch = window.fetch.bind(window);
  const discoveryByRank = new Map();

  function clean(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeIdentityType(value) {
    const type = clean(value).toLowerCase();
    return ["legal_company", "brand", "unconfirmed"].includes(type)
      ? type
      : "unconfirmed";
  }

  function identityLabel(identityType) {
    switch (normalizeIdentityType(identityType)) {
      case "legal_company":
        return "Legal company";
      case "brand":
        return "Brand / trade name";
      default:
        return "Unconfirmed identity";
    }
  }

  function installStyles() {
    if (document.getElementById("casevo-v420-identity-styles")) return;
    const style = document.createElement("style");
    style.id = "casevo-v420-identity-styles";
    style.textContent = `
      #supplierGrid .casevo-identity-badge {
        display:inline-flex;
        align-items:center;
        margin-top:7px;
        padding:4px 7px;
        border:1px solid var(--line,#d9d0c2);
        font-size:7px;
        line-height:1.2;
        letter-spacing:.11em;
        text-transform:uppercase;
        color:var(--muted,#756c61);
        background:rgba(255,255,255,.2);
      }
      #supplierGrid .casevo-identity-badge[data-identity-type="legal_company"] {
        border-color:rgba(87,101,69,.45);
      }
      #supplierGrid .casevo-identity-badge[data-identity-type="brand"] {
        border-style:dashed;
      }
      #supplierGrid .casevo-identity-badge[data-identity-type="unconfirmed"] {
        border-color:rgba(169,45,37,.35);
      }
    `;
    document.head.appendChild(style);
  }

  function getCard(index) {
    return document.querySelector(
      `[data-casevo-supplier-index="${index}"]`
    );
  }

  function ensureBadge(card, identityType) {
    if (!card) return;
    const main = card.querySelector(".casevo-supplier-main");
    if (!main) return;

    let badge = main.querySelector(".casevo-identity-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "casevo-identity-badge";
      const typeLine = main.querySelector(".casevo-supplier-type");
      if (typeLine) {
        typeLine.insertAdjacentElement("afterend", badge);
      } else {
        main.appendChild(badge);
      }
    }

    const type = normalizeIdentityType(identityType);
    badge.dataset.identityType = type;
    badge.textContent = identityLabel(type);
  }

  function applyIdentityToCard(index, identity) {
    const card = getCard(index);
    if (!card) return;

    const identityType = normalizeIdentityType(identity?.identityType);
    const authoritativeName = clean(identity?.authoritativeName);
    const heading = card.querySelector(".casevo-supplier-name");

    if (heading) {
      if (identityType === "unconfirmed") {
        heading.textContent = UNKNOWN;
      } else if (authoritativeName && authoritativeName !== UNKNOWN) {
        heading.textContent = authoritativeName;
      }
    }

    card.dataset.casevoIdentityType = identityType;
    card.dataset.casevoAuthoritativeName =
      identityType === "unconfirmed" ? UNKNOWN : authoritativeName;

    ensureBadge(card, identityType);
  }


  function applyIdentityEventually(index, identity, attempts = 0) {
    const card = getCard(index);

    if (card) {
      applyIdentityToCard(index, identity);
      return;
    }

    if (attempts < 10) {
      window.setTimeout(function () {
        applyIdentityEventually(index, identity, attempts + 1);
      }, 50);
    }
  }

  function getMatches(data) {
    if (Array.isArray(data?.analysis?.matches)) return data.analysis.matches;
    if (Array.isArray(data?.matches)) return data.matches;
    return [];
  }

  function applyDiscoveryResult(data) {
    const matches = getMatches(data);
    matches.forEach(function (supplier, index) {
      const identity = {
        identityType: supplier?.identityType,
        authoritativeName:
          supplier?.authoritativeName ||
          supplier?.companyName ||
          supplier?.name ||
          UNKNOWN
      };
      discoveryByRank.set(index + 1, identity);
      applyIdentityEventually(index, identity);
    });
  }

  function applyVerificationResult(data, requestSupplier) {
    const verification = data?.verification || {};
    const responseSupplier = data?.supplier || {};
    const rank = Number(
      requestSupplier?.rank || responseSupplier?.rank || 0
    );

    let index = Number.isFinite(rank) && rank > 0 ? rank - 1 : -1;

    if (index < 0) {
      const requestedName = clean(
        requestSupplier?.authoritativeName ||
        requestSupplier?.companyName ||
        requestSupplier?.name
      );
      const cards = Array.from(document.querySelectorAll(
        "[data-casevo-supplier-index]"
      ));
      index = cards.findIndex(function (card) {
        return clean(
          card.querySelector(".casevo-supplier-name")?.textContent
        ) === requestedName;
      });
    }

    if (index < 0) return;

    const identityType = normalizeIdentityType(
      verification.identityType || responseSupplier.identityType
    );
    const authoritativeName = clean(
      verification.authoritativeName ||
      responseSupplier.authoritativeName ||
      verification.companyName ||
      responseSupplier.companyName ||
      (identityType === "unconfirmed" ? UNKNOWN : "")
    );

    applyIdentityEventually(index, {
      identityType,
      authoritativeName
    });
  }

  function parseRequestSupplier(input, init) {
    try {
      const url = typeof input === "string" ? input : input?.url || "";
      if (!/\/api\/verify-supplier(?:\?|$)/.test(url)) return null;
      const raw = init?.body;
      if (typeof raw !== "string") return null;
      return JSON.parse(raw)?.supplier || null;
    } catch {
      return null;
    }
  }

  window.fetch = async function casevoIdentityFetch(input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const requestSupplier = parseRequestSupplier(input, init);
    const response = await originalFetch(input, init);

    if (
      /\/api\/sourcing(?:\?|$)/.test(url) ||
      /\/api\/verify-supplier(?:\?|$)/.test(url)
    ) {
      response.clone().json().then(function (data) {
        window.setTimeout(function () {
          if (/\/api\/sourcing(?:\?|$)/.test(url)) {
            applyDiscoveryResult(data);
          } else {
            applyVerificationResult(data, requestSupplier);
          }
        }, 40);
      }).catch(function () {});
    }

    return response;
  };

  installStyles();

  window.CASEVO = window.CASEVO || {};
  window.CASEVO.identityIntelligence = {
    identityLabel,
    applyIdentityToCard,
    applyIdentityEventually,
    applyDiscoveryResult,
    applyVerificationResult
  };

  console.log(
    "CASEVO frontend v4.2.0 initialized — Supplier Identity Intelligence enabled."
  );
})();
