/* CASEVO v4.2.4.7 Frontend Recovery + Supplier Discovery Restore */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const valueOf = id => (byId(id)?.value || "").trim();
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
  function renderSuppliers(suppliers = []) {
    const grid = byId("supplierGrid");
    if (!grid) return;
    grid.innerHTML = "";
    if (!suppliers.length) {
      addText(grid, "p", "No supplier candidates were returned. Refine the requirement and try again.", "supplier-empty");
      return;
    }
    for (const supplier of suppliers) {
      const card = document.createElement("article");
      card.className = "supplier-card";
      const top = document.createElement("div");
      top.className = "supplier-card-top";
      addText(top, "span", supplier.country || "Location not confirmed", "eyebrow");
      addText(top, "strong", `${Number.isFinite(Number(supplier.score)) ? Math.round(Number(supplier.score)) : 0} / 100`, "supplier-score");
      card.appendChild(top);
      addText(card, "h4", supplier.name || "Supplier candidate");
      addText(card, "p", supplier.summary || supplier.evidence || "Review source evidence before qualification.");
      addText(card, "small", supplier.verificationStatus || "Human verification required", "verification-status");
      const actions = document.createElement("div");
      actions.className = "supplier-actions";
      if (/^https?:\/\//i.test(supplier.sourceUrl || "")) {
        const source = addText(actions, "a", "Review source →");
        source.href = supplier.sourceUrl;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
      }
      const verify = addText(actions, "a", "Verify Supplier →", "button button-red");
      verify.href = "#contact";
      verify.addEventListener("click", () => {
        const need = byId("contactNeed");
        if (need && !need.value) need.value = `Please verify supplier: ${supplier.name || "Supplier candidate"}`;
      });
      card.appendChild(actions);
      grid.appendChild(card);
    }
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
  async function runCASEVOSourcing() {
    const response = await fetch("/api/sourcing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: valueOf("request"), product: valueOf("product"), quantity: valueOf("quantity"), targetPrice: valueOf("price"), destination: valueOf("destination") })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed (${response.status})`);
    renderBrief(data.brief);
    renderSuppliers(data.suppliers);
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
