/**
 * CASEVO v4.2.3.5 — Diagnostic UI Hotfix
 * Keeps one Decision panel per supplier and refreshes it after Human Verification.
 */
(() => {
  "use strict";

  const DECISION_LABEL = "CASEVO DECISION";

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const list = (value) => Array.isArray(value) ? value.filter(Boolean) : [];
  const clean = (value) => String(value ?? "").trim();


  function diagnosticMarkup(payload = {}) {
    const diag = payload.searchDiagnostics || {};
    const category = clean(diag.category || "");
    const status = diag.status ?? "";
    const attempts = diag.attempts ?? "";
    const details = clean(payload.details || "");
    const message = clean(payload.diagnosticMessage || "");

    if (!category && !status && !attempts && !details && !message) return "";

    return `<div class="casevo-search-diagnostic">
      <div><b>Error Category</b><span>${esc(category || "unknown")}</span></div>
      <div><b>HTTP Status</b><span>${esc(status || "none")}</span></div>
      <div><b>Attempts</b><span>${esc(attempts || "unknown")}</span></div>
      ${details ? `<div class="casevo-diagnostic-wide"><b>Details</b><span>${esc(details)}</span></div>` : ""}
      ${message ? `<div class="casevo-diagnostic-wide"><b>Diagnostic</b><span>${esc(message)}</span></div>` : ""}
    </div>`;
  }

  function renderSearchDiagnostic(payload = {}) {
    if (payload?.ok !== false) return;
    if (clean(payload?.error) !== "Supplier web search temporarily unavailable.") return;

    let tries = 0;
    const tick = () => {
      const results = document.getElementById("results");
      if (!results) return;
      const existing = results.querySelector(".casevo-search-diagnostic");
      if (existing) existing.remove();

      const errorText = [...results.querySelectorAll("*")].find((el) =>
        clean(el.textContent) === "Supplier web search temporarily unavailable."
      );

      const markup = diagnosticMarkup(payload);
      if (errorText && markup) {
        const box = errorText.closest("div");
        (box || errorText).insertAdjacentHTML("beforeend", markup);
        return;
      }

      tries += 1;
      if (tries < 12) setTimeout(tick, 180);
    };
    tick();
  }

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

  function decisionKey(d) {
    return JSON.stringify([d.score, d.tier, d.reasons, d.risks, d.action]);
  }

  function decisionMarkup(d) {
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
      .casevo-search-diagnostic{margin-top:14px;padding-top:12px;border-top:1px solid rgba(164,54,39,.3);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px 14px;font-size:11px;line-height:1.45}
      .casevo-search-diagnostic>div{display:flex;flex-direction:column;gap:4px}
      .casevo-search-diagnostic b{font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#a43627}
      .casevo-diagnostic-wide{grid-column:1/-1}
      @media(max-width:640px){.casevo-search-diagnostic{grid-template-columns:1fr}}
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

  function captureSourcingPayload(payload) {
    const arrays = supplierArrays(payload);
    if (!arrays.length) return;
    latestSuppliers = arrays[0].map((supplier) => ({ ...supplier }));
    scheduleApply();
  }

  function normalizedIdentity(supplier = {}) {
    return [
      supplier.domain,
      supplier.website,
      supplier.sourceUrl,
      supplier.authoritativeName,
      supplier.companyName,
      supplier.name
    ].map((value) => clean(value).toLowerCase()).filter(Boolean);
  }

  function findSupplierIndex(requestSupplier = {}) {
    if (!latestSuppliers.length) return -1;
    const requestKeys = new Set(normalizedIdentity(requestSupplier));
    if (!requestKeys.size) return -1;

    return latestSuppliers.findIndex((supplier) =>
      normalizedIdentity(supplier).some((key) => requestKeys.has(key))
    );
  }

  function requestSupplierFromFetchArgs(args) {
    try {
      const options = args?.[1] || {};
      const raw = options.body;
      if (typeof raw !== "string") return {};
      const body = JSON.parse(raw);
      return body?.supplier || body || {};
    } catch (_) {
      return {};
    }
  }

  function captureVerificationPayload(payload, requestSupplier) {
    if (!payload?.ok) return;
    const index = findSupplierIndex(requestSupplier);
    if (index < 0) return;

    const current = latestSuppliers[index] || {};
    const verified = payload.supplier || {};
    const verification = payload.verification || {};
    const decision = payload.decision || verified.decision || {};
    const qualification = payload.qualification || verified.qualification || {};

    latestSuppliers[index] = {
      ...current,
      ...verified,

      verificationScore:
        verified.verificationScore ?? verification.score ?? current.verificationScore,
      verificationStatus:
        verified.verificationStatus ?? verification.status ?? current.verificationStatus,
      verificationSignals:
        verified.verificationSignals ?? verification.signals ?? current.verificationSignals,

      qualificationScore:
        verified.qualificationScore ?? qualification.score ?? current.qualificationScore,
      qualificationStatus:
        verified.qualificationStatus ?? qualification.status ?? current.qualificationStatus,
      qualificationStrengths:
        verified.qualificationStrengths ?? qualification.strengths ?? current.qualificationStrengths,
      qualificationGaps:
        verified.qualificationGaps ?? qualification.gaps ?? current.qualificationGaps,
      recommendedAction:
        verified.recommendedAction ?? qualification.recommendedAction ?? current.recommendedAction,
      qualification:
        Object.keys(qualification).length ? qualification : current.qualification,

      decisionScore:
        verified.decisionScore ?? decision.score ?? current.decisionScore,
      decisionTier:
        verified.decisionTier ?? decision.tier ?? current.decisionTier,
      decisionReasons:
        verified.decisionReasons ?? decision.reasons ?? current.decisionReasons,
      riskFlags:
        verified.riskFlags ?? decision.riskFlags ?? current.riskFlags,
      nextBestAction:
        verified.nextBestAction ?? decision.nextBestAction ?? current.nextBestAction,
      decision:
        Object.keys(decision).length ? decision : current.decision
    };

    scheduleApply();
  }

  function decisionAnchor(card) {
    return [...card.querySelectorAll("button")].find((button) =>
      /verify supplier|verification complete/i.test(button.textContent || "")
    ) || card.querySelector(".casevo-decision-panel");
  }

  function cards() {
    const grid = document.getElementById("supplierGrid");
    if (!grid) return [];

    grid.querySelectorAll(":scope > .casevo-decision-panel").forEach((panel) => panel.remove());

    return [...grid.children].filter((el) =>
      el.nodeType === 1 && !el.classList.contains("casevo-decision-panel")
    );
  }

  function renderDecision(card, supplier) {
    const d = decisionFromSupplier(supplier);
    if (!hasDecision(d)) return;

    const key = decisionKey(d);
    const existing = card.querySelector(":scope > .casevo-decision-panel");
    if (existing && existing.dataset.casevoDecisionKey === key) return;

    if (existing) {
      existing.outerHTML = decisionMarkup(d);
      const replaced = card.querySelector(":scope > .casevo-decision-panel");
      if (replaced) replaced.dataset.casevoDecisionKey = key;
      return;
    }

    const anchor = decisionAnchor(card);
    if (!anchor) return;

    anchor.insertAdjacentHTML("beforebegin", decisionMarkup(d));
    const inserted = card.querySelector(":scope > .casevo-decision-panel");
    if (inserted) inserted.dataset.casevoDecisionKey = key;
  }

  function applyDecisionUI() {
    installStyles();
    if (!latestSuppliers.length) return;
    const supplierCards = cards();
    supplierCards.slice(0, latestSuppliers.length).forEach((card, index) => {
      renderDecision(card, latestSuppliers[index]);
    });
  }

  let timer = null;
  function scheduleApply() {
    clearTimeout(timer);
    let tries = 0;
    const tick = () => {
      applyDecisionUI();
      tries += 1;
      if (tries < 8) timer = setTimeout(tick, 200);
    };
    tick();
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
    const requestSupplier = /\/api\/verify-supplier(?:\?|$)/.test(url)
      ? requestSupplierFromFetchArgs(args)
      : {};

    const response = await nativeFetch(...args);

    try {
      if (/\/api\/sourcing(?:\?|$)/.test(url)) {
        response.clone().json().then((payload) => {
          captureSourcingPayload(payload);
          renderSearchDiagnostic(payload);
        }).catch(() => {});
      } else if (/\/api\/verify-supplier(?:\?|$)/.test(url)) {
        response.clone().json()
          .then((payload) => captureVerificationPayload(payload, requestSupplier))
          .catch(() => {});
      }
    } catch (_) {}

    return response;
  };

  function start() {
    installStyles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
