/* CASEVO v4.4.0 Local Quote Comparison Workspace */
(() => {
  "use strict";
  const KEY = "casevo.quotes.v1", VERSION = 1, MAX = 25;
  let activeItems = [], documentState = emptyDocument(), selectedKeys = new Set(), editingKey = "";
  const textFields = ["supplierKey", "supplierName", "quoteDate", "currency", "pricingUnit", "incoterm", "paymentTerms", "validUntil", "packaging", "certifications", "reference", "buyerNote"];
  const numericFields = ["unitPrice", "moq", "sampleCost", "leadTimeDays"];
  const required = ["supplierKey", "supplierName", "currency", "pricingUnit", "unitPrice", "moq", "leadTimeDays"];
  function emptyDocument() { return { schemaVersion: VERSION, updatedAt: new Date().toISOString(), quotes: [] }; }
  const isObject = value => value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const escapeHtml = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  function normalizeNumber(value) {
    if (value === "" || value === null || value === undefined) return "";
    const number = Number(String(value).replaceAll(",", "").trim());
    return Number.isFinite(number) ? number : NaN;
  }
  function containsForbidden(value) {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(containsForbidden);
    return Object.keys(value).some(key => ["__proto__", "prototype", "constructor"].includes(key) || containsForbidden(value[key]));
  }
  function validateQuote(input) {
    const errors = {};
    if (!isObject(input) || containsForbidden(input)) return { valid: false, errors: { document: "Invalid quote" } };
    const quote = { supplierKey: "", supplierName: "", quoteDate: "", currency: "", unitPrice: "", pricingUnit: "", moq: "", sampleCost: "", leadTimeDays: "", incoterm: "", paymentTerms: "", validUntil: "", packaging: "", certifications: "", reference: "", buyerNote: "", updatedAt: new Date().toISOString() };
    for (const field of textFields) {
      if (typeof input[field] !== "string") errors[field] = "Invalid text";
      else if (input[field].length > 2000) errors[field] = "Maximum 2000 characters";
      else quote[field] = input[field].trim();
    }
    quote.currency = quote.currency.toUpperCase();
    if (quote.currency && !/^[A-Z]{3}$/.test(quote.currency)) errors.currency = "Use a 3-letter currency code";
    for (const field of numericFields) {
      const number = normalizeNumber(input[field]);
      if (number === "") quote[field] = "";
      else if (!Number.isFinite(number) || number < 0 || (["unitPrice", "moq", "leadTimeDays"].includes(field) && number <= 0)) errors[field] = "Enter a positive number";
      else quote[field] = number;
    }
    for (const field of required) if (quote[field] === "") errors[field] ||= "Required";
    return { valid: !Object.keys(errors).length, errors, quote };
  }
  function validateDocument(value) {
    if (!isObject(value) || containsForbidden(value) || value.schemaVersion !== VERSION || !Array.isArray(value.quotes) || value.quotes.length > MAX) return { valid: false, document: emptyDocument() };
    const quotes = [], keys = new Set();
    for (const raw of value.quotes) {
      const result = validateQuote(raw);
      if (!result.valid || keys.has(result.quote.supplierKey)) return { valid: false, document: emptyDocument() };
      keys.add(result.quote.supplierKey); quotes.push(result.quote);
    }
    return { valid: true, document: { schemaVersion: VERSION, updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(), quotes } };
  }
  function loadQuotes() { try { const raw = localStorage.getItem(KEY); if (!raw) return emptyDocument(); return validateDocument(JSON.parse(raw)).document; } catch { return emptyDocument(); } }
  function saveQuotes(value) {
    const checked = validateDocument(value);
    if (!checked.valid) return { ok: false, error: "Invalid quote document" };
    checked.document.updatedAt = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(checked.document)); documentState = checked.document; return { ok: true, document: checked.document }; }
    catch { return { ok: false, error: "Quotes could not be saved in this browser" }; }
  }
  function upsertQuote(input) {
    const checked = validateQuote(input); if (!checked.valid) return checked;
    const quotes = [...documentState.quotes], index = quotes.findIndex(quote => quote.supplierKey === checked.quote.supplierKey);
    if (index >= 0) quotes[index] = checked.quote; else if (quotes.length >= MAX) return { valid: false, errors: { document: "Quote limit reached" } }; else quotes.push(checked.quote);
    const saved = saveQuotes({ ...documentState, quotes }); return saved.ok ? { valid: true, quote: checked.quote } : { valid: false, errors: { storage: saved.error } };
  }
  function removeQuote(supplierKey) { return saveQuotes({ ...documentState, quotes: documentState.quotes.filter(quote => quote.supplierKey !== supplierKey) }); }
  function compareQuotes(quotes) {
    const valid = quotes.map(quote => validateQuote(quote)).filter(result => result.valid).map(result => result.quote);
    const priceComparable = valid.length >= 2 && new Set(valid.map(quote => quote.currency)).size === 1 && new Set(valid.map(quote => quote.pricingUnit.toLowerCase())).size === 1;
    const lowest = priceComparable ? Math.min(...valid.map(quote => quote.unitPrice)) : null;
    const fastest = valid.length ? Math.min(...valid.map(quote => quote.leadTimeDays)) : null;
    return { priceComparable, lowestPriceKeys: lowest === null ? [] : valid.filter(quote => quote.unitPrice === lowest).map(quote => quote.supplierKey), fastestLeadTimeKeys: fastest === null ? [] : valid.filter(quote => quote.leadTimeDays === fastest).map(quote => quote.supplierKey) };
  }
  function comparisonHtml(quotes, items) {
    if (!Array.isArray(quotes) || quotes.length < 2 || quotes.length > 5) throw new Error("Select 2–5 valid quotes");
    const comparison = compareQuotes(quotes), itemByKey = new Map(items.map(item => [item.key, item]));
    const cells = render => quotes.map(quote => `<td>${render(quote)}</td>`).join("");
    const textRow = (label, getter) => `<tr><th>${label}</th>${cells(quote => escapeHtml(getter(quote) || "Missing"))}</tr>`;
    const priceRow = `<tr><th>Unit price</th>${cells(quote => `${escapeHtml(quote.currency)} ${escapeHtml(quote.unitPrice)} / ${escapeHtml(quote.pricingUnit)}${comparison.lowestPriceKeys.includes(quote.supplierKey) ? ' <b class="best">Lowest comparable price</b>' : ""}`)}</tr>`;
    const leadRow = `<tr><th>Lead time</th>${cells(quote => `${escapeHtml(quote.leadTimeDays)} days${comparison.fastestLeadTimeKeys.includes(quote.supplierKey) ? ' <b class="best">Fastest</b>' : ""}`)}</tr>`;
    const riskRow = textRow("Risk context", quote => (itemByKey.get(quote.supplierKey)?.decision?.riskFlags || []).join(" · "));
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CASEVO Quote Comparison Report</title><style>body{font:13px/1.5 Arial;background:#f5efe3;color:#1d1b18}.page{max-width:1200px;margin:auto;padding:36px}.notice{border-left:4px solid #a92d25;padding:12px;background:#fffaf1}.wrap{overflow:auto}table{width:100%;min-width:850px;border-collapse:collapse;background:#fff}th,td{border:1px solid #d8d0c5;padding:10px;text-align:left;vertical-align:top}th{background:#eee5d7}.best{display:block;color:#a92d25}.actions button{padding:10px;background:#a92d25;color:#fff;border:0}@media print{.actions{display:none}.page{padding:0}}</style></head><body><main class="page"><h1>CASEVO Quote Comparison Report</h1><p class="notice">Buyer-entered quotation data. Verify authenticity, currency, commercial terms, supplier identity, and risk before purchase.</p>${comparison.priceComparable ? "" : "<p><b>Price ranking disabled:</b> currencies or pricing units differ.</p>"}<div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div><div class="wrap"><table><thead><tr><th>Comparison</th>${quotes.map(quote => `<th>${escapeHtml(quote.supplierName)}</th>`).join("")}</tr></thead><tbody>${priceRow}${textRow("MOQ", quote => quote.moq)}${textRow("Sample cost", quote => quote.sampleCost === "" ? "" : `${quote.currency} ${quote.sampleCost}`)}${leadRow}${textRow("Incoterm", quote => quote.incoterm)}${textRow("Payment terms", quote => quote.paymentTerms)}${textRow("Valid until", quote => quote.validUntil)}${textRow("Packaging", quote => quote.packaging)}${textRow("Certifications", quote => quote.certifications)}${riskRow}${textRow("Buyer note", quote => quote.buyerNote)}</tbody></table></div></main></body></html>`;
  }
  function downloadComparison(quotes, items) { const url = URL.createObjectURL(new Blob([comparisonHtml(quotes, items)], { type: "text/html;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `CASEVO-Quote-Comparison-${new Date().toISOString().slice(0, 10)}.html`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function add(parent, tag, text = "", cls = "") { const node = document.createElement(tag); node.textContent = text; if (cls) node.className = cls; parent.appendChild(node); return node; }
  function renderWorkspace() {
    let overlay = document.getElementById("casevoQuotesWorkspace"); if (!overlay) { overlay = add(document.body, "div", "", "casevo-quotes-overlay"); overlay.id = "casevoQuotesWorkspace"; }
    overlay.innerHTML = ""; const panel = add(overlay, "section", "", "casevo-quotes-panel"); const header = add(panel, "header"); add(header, "h2", "Quote Comparison Workspace"); const close = add(header, "button", "×"); close.type = "button"; close.setAttribute("aria-label", "Close Quote workspace"); close.onclick = () => overlay.remove(); add(panel, "p", "Commercial quote data stays in this browser. Verify every supplier response before purchase.", "casevo-quotes-notice");
    const list = add(panel, "div", "", "casevo-quotes-list");
    for (const item of activeItems) {
      const saved = documentState.quotes.find(quote => quote.supplierKey === item.key), row = add(list, "article", "", "casevo-quote-row"); const check = document.createElement("input"); check.type = "checkbox"; check.disabled = !saved; check.checked = selectedKeys.has(item.key); check.setAttribute("aria-label", `Select quote for ${item.supplier.name}`); check.onchange = () => { check.checked ? selectedKeys.add(item.key) : selectedKeys.delete(item.key); renderWorkspace(); }; row.appendChild(check); add(row, "h3", item.supplier.name); add(row, "p", saved ? `${saved.currency} ${saved.unitPrice} / ${saved.pricingUnit} · MOQ ${saved.moq} · ${saved.leadTimeDays} days` : "No quote recorded"); const edit = add(row, "button", saved ? "Edit quote" : "Add quote"); edit.type = "button"; edit.setAttribute("aria-label", `Edit quote for ${item.supplier.name}`); edit.onclick = () => { editingKey = item.key; renderWorkspace(); }; if (saved) { const remove = add(row, "button", "Remove quote"); remove.type = "button"; remove.onclick = () => { if (window.confirm(`Remove quote for ${item.supplier.name}?`)) { removeQuote(item.key); selectedKeys.delete(item.key); renderWorkspace(); } }; }
    }
    if (editingKey) renderEditor(panel, activeItems.find(item => item.key === editingKey));
    const actions = add(panel, "div", "", "casevo-quotes-actions"); const compare = add(actions, "button", "Download Quote Comparison", "button button-red"); compare.type = "button"; const selected = documentState.quotes.filter(quote => selectedKeys.has(quote.supplierKey)); compare.disabled = selected.length < 2 || selected.length > 5; compare.onclick = () => downloadComparison(selected, activeItems);
  }
  function renderEditor(panel, item) {
    if (!item) return; const saved = documentState.quotes.find(quote => quote.supplierKey === item.key) || {}; const form = add(panel, "form", "", "casevo-quote-form"); add(form, "h3", `Quote: ${item.supplier.name}`); const fields = [["quoteDate", "Quote date"], ["currency", "Currency"], ["unitPrice", "Unit price"], ["pricingUnit", "Pricing unit"], ["moq", "MOQ"], ["sampleCost", "Sample cost"], ["leadTimeDays", "Lead time days"], ["incoterm", "Incoterm"], ["paymentTerms", "Payment terms"], ["validUntil", "Valid until"], ["packaging", "Packaging"], ["certifications", "Certifications"], ["reference", "Reference"], ["buyerNote", "Buyer note"]]; const controls = {};
    for (const [name, title] of fields) { const label = add(form, "label"); add(label, "span", title); const control = document.createElement(["paymentTerms", "packaging", "certifications", "reference", "buyerNote"].includes(name) ? "textarea" : "input"); control.setAttribute("aria-label", title); control.maxLength = 2000; control.value = saved[name] ?? ""; label.appendChild(control); controls[name] = control; }
    const status = add(form, "p", "", "casevo-quote-status"); const save = add(form, "button", "Save quote", "button button-red"); save.type = "button"; save.onclick = () => { const result = upsertQuote({ supplierKey: item.key, supplierName: item.supplier.name, ...Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value])) }); if (!result.valid) { status.textContent = Object.values(result.errors)[0]; status.dataset.error = "true"; return; } editingKey = ""; renderWorkspace(); };
  }
  function openWorkspace(items) { activeItems = Array.isArray(items) ? items.filter(item => item?.verification?.status === "AI preliminary verification") : []; documentState = loadQuotes(); selectedKeys = new Set([...selectedKeys].filter(key => activeItems.some(item => item.key === key))); renderWorkspace(); return !!activeItems.length; }
  window.addEventListener("casevo:quotes-open", event => openWorkspace(event.detail?.items));
  globalThis.CASEVOQuotes = { emptyDocument, normalizeNumber, validateQuote, validateDocument, loadQuotes, saveQuotes, upsertQuote, removeQuote, compareQuotes, comparisonHtml, downloadComparison, openWorkspace };
})();

