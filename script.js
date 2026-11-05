/* CASEVO v4.2.8.0 Verified Supplier Comparison Report */
(() => {
  "use strict";
  const comparisonSelection = new Map();
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
  function comparisonKey(supplier = {}) {
    return supplier.sourceUrl || supplier.authoritativeName || supplier.name || "supplier";
  }
  function mergedVerifiedSupplier(entry) {
    return { ...entry.supplier, ...(entry.result.supplier || {}) };
  }
  function resetComparison() {
    comparisonSelection.forEach(entry => {
      if (entry.button?.isConnected) {
        entry.button.disabled = false;
        entry.button.textContent = "Add to comparison";
      }
    });
    comparisonSelection.clear();
    byId("casevoComparisonBar")?.remove();
  }
  function renderComparisonBar(message = "") {
    let bar = byId("casevoComparisonBar");
    if (!comparisonSelection.size) {
      bar?.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement("aside");
      bar.id = "casevoComparisonBar";
      bar.className = "casevo-comparison-bar";
      bar.setAttribute("aria-live", "polite");
      document.body.appendChild(bar);
    }
    bar.innerHTML = "";
    const heading = document.createElement("div");
    heading.className = "casevo-comparison-heading";
    addText(heading, "strong", "Verified supplier comparison");
    addText(heading, "span", `${comparisonSelection.size} of 5 selected`);
    bar.appendChild(heading);
    const chips = document.createElement("div");
    chips.className = "casevo-comparison-chips";
    comparisonSelection.forEach((entry, key) => {
      const supplier = mergedVerifiedSupplier(entry);
      const chip = document.createElement("span");
      addText(chip, "span", supplier.name || "Supplier");
      const remove = addText(chip, "button", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${supplier.name || "supplier"}`);
      remove.addEventListener("click", () => {
        if (entry.button?.isConnected) {
          entry.button.disabled = false;
          entry.button.textContent = "Add to comparison";
        }
        comparisonSelection.delete(key);
        renderComparisonBar();
      });
      chips.appendChild(chip);
    });
    bar.appendChild(chips);
    if (message) addText(bar, "p", message, "casevo-comparison-message");
    const download = addText(bar, "button", "Download comparison report", "button button-red casevo-comparison-download");
    download.type = "button";
    download.disabled = comparisonSelection.size < 2;
    download.title = download.disabled ? "Select at least 2 verified suppliers" : "Download local comparison report";
    download.addEventListener("click", downloadComparisonReport);
    bar.appendChild(download);
  }
  function addToComparison(supplier, brief, result, button) {
    const verifiedSupplier = { ...supplier, ...(result.supplier || {}) };
    const key = comparisonKey(verifiedSupplier);
    if (comparisonSelection.has(key)) return;
    if (comparisonSelection.size >= 5) {
      renderComparisonBar("Maximum 5 suppliers can be compared. Remove one to add another.");
      return;
    }
    comparisonSelection.set(key, { supplier, brief, result, button });
    button.disabled = true;
    button.textContent = "Added to comparison";
    renderComparisonBar();
  }
  function comparisonReportHtml(entries) {
    const suppliers = entries.map(mergedVerifiedSupplier);
    const value = (entry, supplier, field) => {
      const verification = entry.result.verification || {};
      const decision = entry.result.decision || {};
      if (field === "verificationScore") return verification.score ?? supplier.verificationScore;
      if (field === "decisionScore") return decision.score ?? supplier.decisionScore;
      return supplier[field];
    };
    const scoreFields = ["matchScore", "evidenceScore", "verificationScore", "decisionScore"];
    const highs = Object.fromEntries(scoreFields.map(field => [field, Math.max(...entries.map((entry, index) => Number(value(entry, suppliers[index], field)) || 0))]));
    const cells = renderer => entries.map((entry, index) => `<td>${renderer(entry, suppliers[index], index)}</td>`).join("");
    const scoreRow = (label, field) => `<tr><th>${escapeHtml(label)}</th>${cells((entry, supplier) => {
      const raw = value(entry, supplier, field);
      const highest = Number(raw) === highs[field] ? ' <small class="highest">Highest score</small>' : "";
      return `${escapeHtml(scoreText(raw))}${highest}`;
    })}</tr>`;
    const textRow = (label, renderer) => `<tr><th>${escapeHtml(label)}</th>${cells((entry, supplier, index) => escapeHtml(renderer(entry, supplier, index) || "Not available"))}</tr>`;
    const linkRow = `<tr><th>Source</th>${cells((entry, supplier) => {
      const url = /^https?:\/\//i.test(supplier.sourceUrl || "") ? supplier.sourceUrl : "";
      return url ? `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>` : "Not available";
    })}</tr>`;
    const brief = entries[0]?.brief || {};
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CASEVO Supplier Comparison Report</title><style>
body{margin:0;background:#faf7f1;color:#231f1a;font:13px/1.5 Arial,sans-serif}.page{max-width:1200px;margin:auto;padding:42px}.eyebrow{color:#a43627;font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase}h1{font:34px Georgia,serif;margin:8px 0 16px}.notice{border:1px solid #a43627;background:#fff4f1;padding:13px;font-weight:700}.brief{margin:20px 0;padding:16px;border:1px solid #d8d0c5;background:white}.table-wrap{overflow-x:auto;margin-top:22px}table{width:100%;min-width:820px;border-collapse:collapse;background:white}th,td{border:1px solid #d8d0c5;padding:12px;text-align:left;vertical-align:top}th{background:#f3ede4;width:150px}thead th{background:#231f1a;color:white}.highest{display:inline-block;margin-left:5px;color:#a43627;font-weight:700}a{color:#a43627;overflow-wrap:anywhere}.actions{margin-top:25px}.actions button{padding:10px 16px;border:0;background:#a43627;color:white;font-weight:700}.meta{color:#6d645a;font-size:11px;margin-top:24px}@media(max-width:650px){.page{padding:20px}}@media print{.page{max-width:none;padding:10mm}.actions{display:none}.table-wrap{overflow:visible}table{font-size:10px;min-width:0}th,td{padding:6px}}
</style></head><body><main class="page"><div class="eyebrow">CASEVO · Verified supplier comparison</div><h1>CASEVO Supplier Comparison Report</h1>
<p class="notice">AI preliminary verification — not a final endorsement. Human validation is still required before commercial engagement.</p>
<div class="brief"><b>Purchase requirement:</b> ${escapeHtml(brief.description || brief.product || "Not specified")} · ${escapeHtml(brief.quantity || "Quantity not specified")} · ${escapeHtml(brief.destination || "Destination not specified")}</div>
<div class="table-wrap"><table><thead><tr><th>Comparison</th>${suppliers.map(supplier => `<th>${escapeHtml(supplier.name || "Supplier")}</th>`).join("")}</tr></thead><tbody>
${textRow("Location", (entry, supplier) => supplier.country)}${textRow("Supplier type", (entry, supplier) => supplier.type)}
${scoreRow("Match score", "matchScore")}${scoreRow("Evidence score", "evidenceScore")}${scoreRow("Verification score", "verificationScore")}${scoreRow("Decision score", "decisionScore")}
${textRow("Decision", (entry, supplier) => entry.result.decision?.tier || supplier.decisionTier)}
${textRow("Evidence", (entry, supplier) => (entry.result.decision?.reasons || supplier.decisionReasons || []).join(" · "))}
${textRow("Risk flags", (entry, supplier) => (entry.result.decision?.riskFlags || supplier.riskFlags || []).join(" · "))}
${textRow("Next action", (entry, supplier) => entry.result.decision?.nextBestAction || supplier.nextBestAction)}${linkRow}
</tbody></table></div><div class="actions"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
<p class="meta">Generated locally in your browser on ${escapeHtml(new Date().toISOString())}. CASEVO did not upload this report.</p></main></body></html>`;
  }
  function downloadComparisonReport() {
    if (comparisonSelection.size < 2) return;
    const html = comparisonReportHtml([...comparisonSelection.values()]);
    const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `CASEVO-Supplier-Comparison-${new Date().toISOString().slice(0, 10)}.html`;
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
          if (!actions.querySelector(".supplier-comparison-add")) {
            const compare = addText(actions, "button", "Add to comparison", "button supplier-comparison-add");
            compare.type = "button";
            compare.addEventListener("click", () => addToComparison(supplier, brief, data, compare));
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
    resetComparison();
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

