/**
 * CASEVO v4.2.3 — Supplier Decision UI
 * Additive frontend layer. Preserves script.js and v4.2.0 identity intelligence.
 */
(() => {
  "use strict";

  const DECISION_LABEL = "CASEVO DECISION";

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];

  function decisionFromSupplier(supplier = {}) {
    const nested = supplier.decision || {};
    return {
      score: supplier.decisionScore ?? nested.score ?? nested.decisionScore ?? null,
      tier: supplier.decisionTier ?? nested.tier ?? nested.decisionTier ?? "",
      reasons: list(supplier.decisionReasons ?? nested.reasons ?? nested.decisionReasons),
      risks: list(supplier.riskFlags ?? nested.riskFlags ?? nested.risks),
      action: supplier.nextBestAction ?? nested.nextBestAction ?? nested.action ?? ""
    };
  }

  function hasDecision(d) {
    return d.score !== null || d.tier || d.reasons.length || d.risks.length || d.action;
  }

  function decisionMarkup(d) {
    if (!hasDecision(d)) return "";
    const score = d.score !== null ? `<strong>${esc(d.score)}/100</strong>` : "";
    const reasons = d.reasons.length
      ? `<div class="casevo-decision-row"><b>Why</b><span>${d.reasons.map(esc).join(" · ")}</span></div>` : "";
    const risks = d.risks.length
      ? `<div class="casevo-decision-row casevo-risk"><b>Risk flags</b><span>${d.risks.map(esc).join(" · ")}</span></div>` : "";
    const action = d.action
      ? `<div class="casevo-decision-row"><b>Next best action</b><span>${esc(d.action)}</span></div>` : "";

    return `<section class="casevo-decision-panel">
      <div class="casevo-decision-head">
        <span>${DECISION_LABEL}</span>
        <span class="casevo-decision-tier">${esc(d.tier || "Decision pending")}</span>
        ${score}
      </div>
      ${reasons}${risks}${action}
    </section>`;
  }

  function installStyles() {
    if (document.getElementById("casevo-v423-decision-styles")) return;
    const style = document.createElement("style");
    style.id = "casevo-v423-decision-styles";
    style.textContent = `
      .casevo-decision-panel{margin:14px 0 10px;padding:13px 14px;border:1px solid rgba(164,54,39,.32);background:rgba(164,54,39,.045)}
      .casevo-decision-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
      .casevo-decision-head>span:first-child{font-weight:700;color:#a43627}
      .casevo-decision-head strong{margin-left:auto;font-size:15px;letter-spacing:0;color:#a43627}
      .casevo-decision-tier{padding:4px 7px;border:1px solid rgba(164,54,39,.28);font-weight:700}
      .casevo-decision-row{display:grid;grid-template-columns:110px 1fr;gap:10px;padding-top:9px;margin-top:9px;border-top:1px solid rgba(35,31,26,.12);font-size:11px;line-height:1.45}
      .casevo-decision-row b{font-size:9px;letter-spacing:.08em;text-transform:uppercase}
      .casevo-risk b{color:#a43627}
      @media(max-width:640px){.casevo-decision-row{grid-template-columns:1fr}.casevo-decision-head strong{margin-left:0}}
    `;
    document.head.appendChild(style);
  }

  function supplierArrays(payload) {
    const arrays = [];
    if (Array.isArray(payload?.matches)) arrays.push(payload.matches);
    if (Array.isArray(payload?.analysis?.matches)) arrays.push(payload.analysis.matches);
    if (Array.isArray(payload?.data?.matches)) arrays.push(payload.data.matches);
    if (Array.isArray(payload?.data?.analysis?.matches)) arrays.push(payload.data.analysis.matches);
    return arrays;
  }

  let latestSuppliers = [];

  function capturePayload(payload) {
    const arrays = supplierArrays(payload);
    if (arrays.length) latestSuppliers = arrays[0];
    scheduleApply();
  }

  function cards() {
    const grid = document.getElementById("supplierGrid");
    if (!grid) return [];
    return [...grid.children].filter(el => el.nodeType === 1);
  }

  function applyDecisionUI() {
    installStyles();
    const supplierCards = cards();
    if (!supplierCards.length || !latestSuppliers.length) return;

    supplierCards.forEach((card, index) => {
      const supplier = latestSuppliers[index];
      if (!supplier) return;
      const d = decisionFromSupplier(supplier);
      if (!hasDecision(d)) return;

      let panel = card.querySelector(".casevo-decision-panel");
      const markup = decisionMarkup(d);
      if (panel) {
        panel.outerHTML = markup;
        return;
      }

      const verifyButton = [...card.querySelectorAll("button")].find(
        b => /verify supplier/i.test(b.textContent || "")
      );
      if (verifyButton) {
        const holder = verifyButton.closest("div") || verifyButton;
        holder.insertAdjacentHTML("beforebegin", markup);
      } else {
        card.insertAdjacentHTML("beforeend", markup);
      }
    });
  }

  let timer = null;
  function scheduleApply() {
    clearTimeout(timer);
    let tries = 0;
    const tick = () => {
      applyDecisionUI();
      tries += 1;
      if (tries < 12) timer = setTimeout(tick, 180);
    };
    tick();
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (/\/api\/(sourcing|verify-supplier)(?:\?|$)/.test(url)) {
        response.clone().json().then(capturePayload).catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  const observer = new MutationObserver(() => {
    if (latestSuppliers.length) scheduleApply();
  });

  function start() {
    installStyles();
    const grid = document.getElementById("supplierGrid");
    if (grid) observer.observe(grid, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
