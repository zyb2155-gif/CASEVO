/* CASEVO v4.3.0 Local RFQ Workspace */
(() => {
  "use strict";
  const STORAGE_KEY = "casevo.rfqDraft.v1";
  const SCHEMA_VERSION = 1;
  const LIMITS = { requirement: 2000, quantity: 200, targetPrice: 200, destination: 200, incoterm: 100, deliveryDate: 100, responseDeadline: 100, sampleRequest: 500, paymentTerms: 500, qualityRequirements: 1500, buyerMessage: 2000 };
  const REQUIRED = ["requirement", "quantity", "destination", "responseDeadline"];
  const plain = value => String(value ?? "").trim();
  function safeHttpUrl(value) { try { const url = new URL(plain(value)); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } }
  function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
  function defaultDraft(items = []) {
    const brief = items[0]?.brief || {};
    return { schemaVersion: SCHEMA_VERSION, updatedAt: new Date().toISOString(), requirement: plain(brief.description || brief.product), quantity: plain(brief.quantity), targetPrice: plain(brief.targetPrice), destination: plain(brief.destination), incoterm: "FOB", deliveryDate: "", responseDeadline: "", sampleRequest: "Please confirm sample availability, cost, and lead time.", paymentTerms: "Please propose your standard payment terms.", qualityRequirements: "Please provide relevant quality certifications, test reports, and your quality-control process.", buyerMessage: "Please quote your best offer and confirm production capacity, MOQ, lead time, packaging, and export experience." };
  }
  function validateDraft(value) {
    const errors = {};
    if (!value || typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== SCHEMA_VERSION) return { valid: false, errors: { document: "Invalid RFQ draft" } };
    for (const [field, limit] of Object.entries(LIMITS)) {
      if (typeof value[field] !== "string") errors[field] = "Invalid text";
      else if (value[field].length > limit) errors[field] = `Maximum ${limit} characters`;
    }
    for (const field of REQUIRED) if (!plain(value[field])) errors[field] = "Required";
    return { valid: Object.keys(errors).length === 0, errors };
  }
  function normalizeDraft(value, items) {
    const base = defaultDraft(items);
    if (!value || typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== SCHEMA_VERSION) return base;
    const next = { ...base };
    for (const field of Object.keys(LIMITS)) if (typeof value[field] === "string" && value[field].length <= LIMITS[field]) next[field] = value[field];
    next.updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : base.updatedAt;
    return next;
  }
  function loadDraft(items = []) { try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? normalizeDraft(JSON.parse(raw), items) : defaultDraft(items); } catch { return defaultDraft(items); } }
  function saveDraft(draft) {
    const validation = validateDraft(draft);
    if (!validation.valid) return { ok: false, errors: validation.errors };
    const next = { ...draft, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return { ok: true, draft: next }; } catch { return { ok: false, errors: { storage: "Draft could not be saved in this browser" } }; }
  }
  function rfqHtml(draft, items) {
    const validation = validateDraft(draft);
    if (!validation.valid || !Array.isArray(items) || items.length < 1 || items.length > 5) throw new Error("Valid RFQ fields and 1–5 suppliers are required");
    const field = (label, value) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || "Not specified")}</td></tr>`;
    const supplierSections = items.map((item, index) => {
      const supplier = item.supplier || {}; const source = safeHttpUrl(supplier.sourceUrl);
      return `<section class="supplier"><p class="kicker">RFQ ${index + 1} OF ${items.length}</p><h2>To: ${escapeHtml(supplier.name || "Supplier")}</h2><p>${escapeHtml(supplier.country || "Location not confirmed")}${source ? ` · <a href="${escapeHtml(source)}">Supplier evidence source</a>` : ""}</p><p>${escapeHtml(draft.buyerMessage)}</p><table>${field("Requirement", draft.requirement)}${field("Quantity", draft.quantity)}${field("Target price", draft.targetPrice)}${field("Destination", draft.destination)}${field("Incoterm", draft.incoterm)}${field("Desired delivery", draft.deliveryDate)}${field("Response deadline", draft.responseDeadline)}${field("Sample request", draft.sampleRequest)}${field("Payment terms", draft.paymentTerms)}${field("Quality requirements", draft.qualityRequirements)}</table><h3>Please include</h3><p>Unit price, MOQ, sample terms, production lead time, packaging, payment terms, certifications, export markets, and quotation validity.</p></section>`;
    }).join("");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CASEVO Request for Quotation</title><style>body{margin:0;background:#f5efe3;color:#1d1b18;font:14px/1.55 Arial,sans-serif}.page{max-width:900px;margin:auto;padding:42px}h1,h2{font-family:Georgia,serif}.notice{border-left:4px solid #a92d25;padding:12px;background:#fffaf1}.supplier{page-break-after:always;margin:35px 0;padding:28px;background:#fffaf1;border:1px solid #d6cdbf}.supplier:last-child{page-break-after:auto}.kicker{font-size:11px;letter-spacing:.14em;color:#a92d25;font-weight:700}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:10px;border:1px solid #d6cdbf;text-align:left;vertical-align:top}th{width:180px;background:#eee5d7}a{color:#a92d25}.actions{margin:20px 0}.actions button{padding:10px 16px;border:0;background:#a92d25;color:#fff;font-weight:700}@media print{.page{padding:0}.actions{display:none}.supplier{border:0;padding:0}}</style></head><body><main class="page"><h1>CASEVO Request for Quotation</h1><p class="notice">Prepared from AI preliminary verification. This document is a buyer draft, not a supplier endorsement or proof of delivery.</p><p><b>Buyer copy:</b> ${items.length} supplier${items.length === 1 ? "" : "s"} selected · Response requested by ${escapeHtml(draft.responseDeadline)}</p><div class="actions"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>${supplierSections}</main></body></html>`;
  }
  function download(draft, items) { const url = URL.createObjectURL(new Blob([rfqHtml(draft, items)], { type: "text/html;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `CASEVO-RFQ-${new Date().toISOString().slice(0, 10)}.html`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function add(parent, tag, text, className = "") { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; parent.appendChild(node); return node; }
  function openWorkspace(items) {
    const selected = Array.isArray(items) ? items.filter(item => item?.verification?.status === "AI preliminary verification").slice(0, 5) : [];
    if (!selected.length) return false;
    document.getElementById("casevoRfqWorkspace")?.remove(); let draft = loadDraft(selected);
    const overlay = add(document.body, "div", "", "casevo-rfq-overlay"); overlay.id = "casevoRfqWorkspace"; overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true");
    const panel = add(overlay, "section", "", "casevo-rfq-panel"); const header = add(panel, "header", ""); add(header, "div", "CASEVO v4.3.0", "eyebrow"); add(header, "h2", "Create RFQ"); const close = add(header, "button", "×"); close.type = "button"; close.setAttribute("aria-label", "Close RFQ workspace"); close.addEventListener("click", () => overlay.remove());
    add(panel, "p", `Preparing a local RFQ for ${selected.length} verified supplier${selected.length === 1 ? "" : "s"}. Nothing is sent automatically.`, "casevo-rfq-notice"); add(panel, "p", selected.map(item => item.supplier?.name || "Supplier").join(" · "), "casevo-rfq-suppliers");
    const form = add(panel, "form", "", "casevo-rfq-form");
    const fields = [["requirement", "Requirement", "textarea"], ["quantity", "Quantity", "input"], ["targetPrice", "Target price", "input"], ["destination", "Destination", "input"], ["incoterm", "Incoterm", "input"], ["deliveryDate", "Desired delivery date", "input"], ["responseDeadline", "Response deadline", "input"], ["sampleRequest", "Sample request", "textarea"], ["paymentTerms", "Payment terms", "textarea"], ["qualityRequirements", "Quality requirements", "textarea"], ["buyerMessage", "Buyer message", "textarea"]];
    const controls = {};
    for (const [name, labelText, tag] of fields) { const label = add(form, "label", ""); add(label, "span", labelText); const control = document.createElement(tag); control.name = name; control.value = draft[name]; control.maxLength = LIMITS[name]; control.setAttribute("aria-label", labelText); label.appendChild(control); const error = add(label, "small", "", "casevo-rfq-error"); controls[name] = { control, error }; }
    const status = add(panel, "p", "", "casevo-rfq-status"); const actions = add(panel, "div", "", "casevo-rfq-actions"); const save = add(actions, "button", "Save draft locally"); save.type = "button"; const downloadButton = add(actions, "button", "Download RFQ package", "button button-red"); downloadButton.type = "button"; const print = add(actions, "button", "Print current RFQ"); print.type = "button";
    const sync = () => { draft = { ...draft, ...Object.fromEntries(Object.entries(controls).map(([name, { control }]) => [name, control.value])) }; const validation = validateDraft(draft); Object.entries(controls).forEach(([name, { error }]) => { error.textContent = validation.errors[name] || ""; }); downloadButton.disabled = !validation.valid; print.disabled = !validation.valid; return validation; };
    Object.values(controls).forEach(({ control }) => control.addEventListener("input", sync)); save.addEventListener("click", () => { const result = sync().valid ? saveDraft(draft) : { ok: false, errors: { validation: "Complete the required fields" } }; status.textContent = result.ok ? "Draft saved only in this browser." : Object.values(result.errors)[0]; status.dataset.error = String(!result.ok); }); downloadButton.addEventListener("click", () => { if (sync().valid) download(draft, selected); }); print.addEventListener("click", () => { if (!sync().valid) return; const popup = window.open(URL.createObjectURL(new Blob([rfqHtml(draft, selected)], { type: "text/html" })), "_blank", "noopener"); if (!popup) status.textContent = "Allow pop-ups to print the RFQ."; }); sync(); controls.requirement.control.focus(); return true;
  }
  window.addEventListener("casevo:rfq-create", event => openWorkspace(event.detail?.items));
  globalThis.CASEVORFQ = { defaultDraft, validateDraft, loadDraft, saveDraft, rfqHtml, openWorkspace, download, safeHttpUrl, escapeHtml };
})();

