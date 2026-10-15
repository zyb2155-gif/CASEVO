/* CASEVO v4.2.7.0 Local Supplier Verification Report */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const valueOf = id => (byId(id)?.value || "").trim();
  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
  const scoreText = value => Number.isFinite(Number(value)) ? `${Math.round(Number(value))} / 100` : "Not available";
  function addText(parent, tag, text, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }
  function renderBrief(brief = {}) {
    const container = byId("brief");
    if (!container) return;
    container.innerHTML = "";
    for (const [label, value] of [["Product / Material", brief.product], ["Quantity", brief.quantity], ["Target Price", brief.targetPrice], ["Destination", brief.destination]]) {
      const item = document.createElement("div");
      addText(item, "span", label);
      addText(item, "strong", value || "Not specified");
      container.appendChild(item);
    }
  }
  function verificationReportHtml(supplier = {}, brief = {}, result = {}) {
    const verifiedSupplier = { ...supplier, ...(result.supplier || {}) };
    const verification = result.verification || {};
    const decision = result.decision || {};
    const reasons = decision.reasons || verifiedSupplier.decisionReasons || verification.signals || [];
    const risks = decision.riskFlags || verifiedSupplier.riskFlags || [];
    const list = (items, empty) => `<ul>${(items.length ? items : [empty]).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    const sourceUrl = verifiedSupplier.sourceUrl || supplier.sourceUrl || "Not available";
    const officialWebsite = verification.officialWebsite || "Not confirmed";
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CASEVO Verification Report — ${escapeHtml(verifiedSupplier.name || "Supplier")}</title>
<style>
  :root{color-scheme:light;--ink:#231f1a;--red:#a43627;--line:#d8d0c5;--paper:#faf7f1}*{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.55 Arial,sans-serif}.page{max-width:900px;margin:0 auto;padding:48px}
  header{border-bottom:3px solid var(--red);padding-bottom:24px;margin-bottom:28px}h1{font-family:Georgia,serif;font-size:34px;margin:5px 0}.eyebrow{color:var(--red);font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase}
  .notice{border:1px solid var(--red);padding:14px 16px;background:#fff4f1;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:22px 0}.panel{border:1px solid var(--line);background:#fff;padding:18px}.panel h2{font-size:14px;margin:0 0 12px;text-transform:uppercase;letter-spacing:.08em}.row{display:grid;grid-template-columns:150px 1fr;gap:12px;padding:7px 0;border-top:1px solid #eee}.row:first-of-type{border-top:0}.row b{font-size:12px}a{color:var(--red);overflow-wrap:anywhere}li{margin:5px 0}.actions{margin-top:30px}.actions button{padding:10px 16px;border:0;background:var(--red);color:white;font-weight:700;cursor:pointer}.meta{color:#6d645a;font-size:11px;margin-top:28px}
  @media(max-width:650px){.page{padding:24px}.grid{grid-template-columns:1fr}.row{grid-template-columns:1fr;gap:2px}}
  @media print{body{background:#fff}.page{max-width:none;padding:15mm}.actions{display:none}.panel{break-inside:avoid}}
</style></head><body><main class="page">
<header><div class="eyebrow">CASEVO · AI preliminary verification</div><h1>CASEVO Supplier Verification Report</h1><p>${escapeHtml(verifiedSupplier.name || "Supplier candidate")}</p></header>
<p class="notice">AI preliminary verification — not a final endorsement. Human validation is still required before commercial engagement.</p>
<section class="grid">
  <div class="panel"><h2>Purchase requirement</h2>
    <div class="row"><b>Description</b><span>${escapeHtml(brief.description || "Not specified")}</span></div>
    <div class="row"><b>Product / Material</b><span>${escapeHtml(brief.product || "Not specified")}</span></div>
    <div class="row"><b>Quantity</b><span>${escapeHtml(brief.quantity || "Not specified")}</span></div>
    <div class="row"><b>Target price</b><span>${escapeHtml(brief.targetPrice || "Not specified")}</span></div>
    <div class="row"><b>Destination</b><span>${escapeHtml(brief.destination || "Not specified")}</span></div>
  </div>
  <div class="panel"><h2>Supplier</h2>
    <div class="row"><b>Name</b><span>${escapeHtml(verifiedSupplier.name || "Not available")}</span></div>
    <div class="row"><b>Type</b><span>${escapeHtml(verifiedSupplier.type || "Not available")}</span></div>
    <div class="row"><b>Location</b><span>${escapeHtml(verifiedSupplier.country || "Not confirmed")}</span></div>
    <div class="row"><b>Summary</b><span>${escapeHtml(verifiedSupplier.summary || "Not available")}</span></div>
    <div class="row"><b>Source</b><a href="${escapeHtml(/^https?:\/\//i.test(sourceUrl) ? sourceUrl : "#")}">${escapeHtml(sourceUrl)}</a></div>
    <div class="row"><b>Official website</b><span>${escapeHtml(officialWebsite)}</span></div>
  </div>
  <div class="panel"><h2>Scores & decision</h2>
    <div class="row"><b>Match score</b><span>${scoreText(verifiedSupplier.matchScore)}</span></div>
    <div class="row"><b>Evidence score</b><span>${scoreText(verifiedSupplier.evidenceScore)}</span></div>
    <div class="row"><b>Verification score</b><span>${scoreText(verification.score ?? verifiedSupplier.verificationScore)}</span></div>
    <div class="row"><b>Decision score</b><span>${scoreText(decision.score ?? verifiedSupplier.decisionScore)}</span></div>
    <div class="row"><b>Decision</b><span>${escapeHtml(decision.tier || verifiedSupplier.decisionTier || "Human review required")}</span></div>
    <div class="row"><b>Next action</b><span>${escapeHtml(decision.nextBestAction || verifiedSupplier.nextBestAction || "Complete human verification")}</span></div>
  </div>
  <div class="panel"><h2>Evidence</h2>${list(reasons, "No supporting evidence recorded.")}<h2>Risk flags</h2>${list(risks, "Human validation is still required.")}</div>
</section>
<section class="panel"><h2>Human verification checklist</h2>${list(["Confirm the supplier's legal registration and beneficial ownership.", "Confirm factory address, production capability, certifications, and audit evidence.", "Validate bank account ownership and commercial terms independently.", "Approve a sample and quality-control plan before placing a production order."], "Complete human verification.")}</section>
<div class="actions"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
<p class="meta">Generated locally in your browser on ${escapeHtml(new Date().toISOString())}. CASEVO did not upload this report.</p>
</main></body></html>`;
  }
  function downloadVerificationReport(supplier, brief, result) {
    const html = verificationReportHtml(supplier, brief, result);
    const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    const safeName = String((result.supplier || {}).name || supplier.name || "Supplier")
      .replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "Supplier";
    link.href = blobUrl;
    link.download = `CASEVO-Verification-Report-${safeName}-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
  }
  function renderSuppliers(suppliers = [], brief = {}) {
    const grid = byId("supplierGrid");
    if (!grid) return;
    grid.innerHTML = "";
    if (!suppliers.length) {
      addText(grid, "p", "No supplier candidates were returned. Refine the requirement and try again.", "supplier-empty");
      return;
    }
    suppliers.forEach((supplier, index) => {
      const card = document.createElement("article");
      card.className = "supplier supplier-card";
      card.dataset.casevoSupplierIndex = String(index);
      const top = document.createElement("div");
      top.className = "supplier-top supplier-card-top";
      addText(top, "span", supplier.country || "Location not confirmed", "eyebrow");
      addText(top, "strong", `${Number.isFinite(Number(supplier.score)) ? Math.round(Number(supplier.score)) : 0} / 100`, "score-number supplier-score");
      card.appendChild(top);
      const main = document.createElement("div");
      main.className = "casevo-supplier-main";
      addText(main, "h4", supplier.name || "Supplier candidate", "casevo-supplier-name");
      addText(main, "div", supplier.type || "Supplier candidate", "casevo-supplier-type");
      addText(main, "p", supplier.summary || supplier.evidence || "Review source evidence before qualification.", "supplier-summary");
      const meta = document.createElement("div");
      meta.className = "supplier-meta";
      for (const [label, value] of [["Match score", supplier.matchScore], ["Evidence score", supplier.evidenceScore]]) {
        const row = document.createElement("div");
        addText(row, "span", label);
        addText(row, "strong", Number.isFinite(Number(value)) ? `${Math.round(Number(value))} / 100` : "Pending");
        meta.appendChild(row);
      }
      main.appendChild(meta);
      addText(main, "small", supplier.verificationStatus || "Human verification required", "verified verification-status");
      card.appendChild(main);
      const actions = document.createElement("div");
      actions.className = "supplier-actions";
      if (/^https?:\/\//i.test(supplier.sourceUrl || "")) {
        const source = addText(actions, "a", "Review source →");
        source.href = supplier.sourceUrl;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
      }
      const verify = addText(actions, "button", "Verify Supplier →", "button button-red");
      verify.type = "button";
      verify.addEventListener("click", async () => {
        if (verify.disabled) return;
        verify.disabled = true;
        verify.textContent = "Verifying supplier…";
        let status = card.querySelector(".supplier-verification-status");
        if (!status) {
          status = document.createElement("p");
          status.className = "supplier-verification-status";
          card.insertBefore(status, actions);
        }
        status.textContent = "Searching public identity and manufacturing evidence…";
        try {
          const response = await fetch("/api/verify-supplier", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ supplier, brief })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `Verification failed (${response.status})`);
          const verificationLabel = main.querySelector(".verification-status");
          if (verificationLabel) verificationLabel.textContent = data.verification?.status || "AI preliminary verification";
          status.className = "supplier-verification-status verification-complete";
          status.textContent = "AI preliminary verification completed. Human validation is still required.";
          verify.textContent = "Verification complete";
          if (!actions.querySelector(".supplier-report-download")) {
            const report = addText(actions, "button", "Download verification report", "button supplier-report-download");
            report.type = "button";
            report.addEventListener("click", () => downloadVerificationReport(supplier, brief, data));
          }
        } catch (error) {
          status.className = "supplier-verification-status verification-error";
          status.textContent = error.message || "Verification unavailable. Please try again.";
          verify.disabled = false;
          verify.textContent = "Retry verification →";
        }
      });
      card.appendChild(actions);
      grid.appendChild(card);
    });
  }
  function showError(message) {
    const results = byId("results");
    const grid = byId("supplierGrid");
    if (results) results.hidden = false;
    if (byId("resultTitle")) byId("resultTitle").textContent = "Supplier discovery unavailable";
    if (grid) {
      grid.innerHTML = "";
      addText(grid, "p", message, "supplier-error");
    }
  }
  function showPending() {
    const results = byId("results");
    const brief = byId("brief");
    const grid = byId("supplierGrid");
    if (results) results.hidden = false;
    if (byId("resultTitle")) byId("resultTitle").textContent = "Searching suppliers…";
    if (brief) brief.innerHTML = "";
    if (grid) {
      grid.innerHTML = "";
      addText(grid, "p", "Searching live supplier evidence. This may take a few seconds.", "supplier-pending");
    }
  }
  async function runCASEVOSourcing() {
    showPending();
    const request = { description: valueOf("request"), product: valueOf("product"), quantity: valueOf("quantity"), targetPrice: valueOf("price"), destination: valueOf("destination") };
    const response = await fetch("/api/sourcing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed (${response.status})`);
    const reportBrief = { ...request, ...(data.brief || {}), description: request.description };
    renderBrief(reportBrief);
    renderSuppliers(data.suppliers, reportBrief);
    const results = byId("results");
    if (results) {
      results.hidden = false;
      results.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (byId("resultTitle")) byId("resultTitle").textContent = data.suppliers?.length ? "Supplier matches" : "Supplier discovery result";
    return data;
  }
  function initializeSourcingForm() {
    const form = byId("sourcingForm");
    if (!form || form.dataset?.casevoBound === "true") return;
    if (form.dataset) form.dataset.casevoBound = "true";
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      if (button) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = "Analyzing & searching…";
      }
      try { await runCASEVOSourcing(); }
      catch (error) {
        console.error("CASEVO sourcing failed:", error);
        showError(error.message || "Unable to complete supplier discovery. Please try again.");
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = button.dataset.originalText || "Analyze & Find Matches →";
        }
      }
    });
  }
  globalThis.runCASEVOSourcing = runCASEVOSourcing;
  globalThis.toggleMenu = () => document.querySelector(".nav-links")?.classList.toggle("open");
  globalThis.submitContact = event => {
    event.preventDefault();
    const message = byId("contactMessage");
    if (message) message.hidden = false;
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeSourcingForm);
  else initializeSourcingForm();
})();

