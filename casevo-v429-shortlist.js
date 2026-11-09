/* CASEVO v4.2.9.0 Local Shortlist Workspace */
(() => {
  "use strict";
  const STORAGE_KEY = "casevo.shortlist.v1";
  const SCHEMA_VERSION = 1;
  const MAX_ITEMS = 25;
  let documentState = emptyDocument();
  const selectedKeys = new Set();

  function emptyDocument() {
    return { schemaVersion: SCHEMA_VERSION, updatedAt: new Date().toISOString(), items: [] };
  }
  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
  function stableKey(supplier = {}) {
    return String(supplier.sourceUrl || supplier.authoritativeName || supplier.name || "").trim();
  }
  function validVerifiedItem(item) {
    return isPlainObject(item) && typeof item.key === "string" && item.key.length > 0 &&
      isPlainObject(item.supplier) && stableKey(item.supplier) === item.key &&
      isPlainObject(item.verification) && item.verification.status === "AI preliminary verification" &&
      isPlainObject(item.decision) && isPlainObject(item.brief) &&
      typeof item.note === "string" && item.note.length <= 1000;
  }
  function normalizeDocument(value) {
    if (!isPlainObject(value) || value.schemaVersion !== SCHEMA_VERSION || !Array.isArray(value.items)) return emptyDocument();
    const items = value.items.filter(validVerifiedItem).slice(0, MAX_ITEMS);
    return { schemaVersion: SCHEMA_VERSION, updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(), items };
  }
  function loadShortlist() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeDocument(JSON.parse(raw)) : emptyDocument();
    } catch {
      return emptyDocument();
    }
  }
  function saveShortlist(next) {
    const normalized = normalizeDocument(next);
    normalized.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      documentState = normalized;
      renderControl();
      if (document.getElementById("casevoShortlistDrawer")?.hidden === false) renderDrawer();
      return true;
    } catch {
      showStatus("Shortlist could not be saved in this browser.", true);
      return false;
    }
  }
  function showStatus(message, error = false) {
    let status = document.getElementById("casevoShortlistStatus");
    if (!status) {
      status = document.createElement("p");
      status.id = "casevoShortlistStatus";
      status.className = "casevo-shortlist-status";
      document.body.appendChild(status);
    }
    status.textContent = message;
    status.dataset.error = String(error);
  }
  function renderControl() {
    let control = document.getElementById("casevoShortlistControl");
    if (!control) {
      control = document.createElement("button");
      control.type = "button";
      control.id = "casevoShortlistControl";
      control.className = "casevo-shortlist-control";
      control.addEventListener("click", () => {
        const drawer = document.getElementById("casevoShortlistDrawer");
        if (drawer && !drawer.hidden) drawer.hidden = true;
        else renderDrawer();
      });
      document.body.appendChild(control);
    }
    control.textContent = `Shortlist ${documentState.items.length}`;
  }
  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch { return ""; }
  }
  function addText(parent, tag, text, className = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = String(text ?? "");
    parent.appendChild(element);
    return element;
  }
  function updateNote(key, note) {
    if (typeof note !== "string" || note.length > 1000) return false;
    const items = documentState.items.map(item => item.key === key ? { ...item, note } : item);
    return saveShortlist({ ...documentState, items });
  }
  function removeItem(key) {
    return saveShortlist({ ...documentState, items: documentState.items.filter(item => item.key !== key) });
  }
  function clearAll() {
    if (!window.confirm("Clear all saved suppliers from this browser?")) return false;
    return saveShortlist({ ...documentState, items: [] });
  }
  function containsForbiddenKeys(value) {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(containsForbiddenKeys);
    return Object.keys(value).some(key => ["__proto__", "prototype", "constructor"].includes(key) || containsForbiddenKeys(value[key]));
  }
  function validateImport(value, byteLength) {
    if (byteLength > 1024 * 1024) throw new Error("Import exceeds the 1 MB limit");
    if (!isPlainObject(value) || containsForbiddenKeys(value)) throw new Error("Invalid shortlist document");
    if (value.schemaVersion !== SCHEMA_VERSION) throw new Error("Unsupported shortlist schema");
    if (!Array.isArray(value.items) || value.items.length > MAX_ITEMS) throw new Error("Invalid shortlist item count");
    if (value.items.some(item => !validVerifiedItem(item))) throw new Error("Invalid or unverified shortlist item");
    if (value.items.some(item => item.supplier.sourceUrl && !safeHttpUrl(item.supplier.sourceUrl))) throw new Error("Invalid supplier source URL");
    const keys = new Set(value.items.map(item => item.key));
    if (keys.size !== value.items.length) throw new Error("Duplicate shortlist supplier keys");
    return { schemaVersion: SCHEMA_VERSION, updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(), items: value.items.map(item => structuredClone(item)) };
  }
  function exportShortlist() {
    const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(documentState, null, 2)], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `CASEVO-Shortlist-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }
  function shortlistComparisonHtml(items) {
    const scoreFields = [
      ["Match score", item => item.supplier.matchScore],
      ["Evidence score", item => item.supplier.evidenceScore],
      ["Verification score", item => item.verification.score],
      ["Decision score", item => item.decision.score]
    ];
    const highest = Object.fromEntries(scoreFields.map(([label, getter]) => [label, Math.max(...items.map(item => Number(getter(item)) || 0))]));
    const cells = render => items.map(item => `<td>${render(item)}</td>`).join("");
    const textRow = (label, getter) => `<tr><th>${escapeHtml(label)}</th>${cells(item => escapeHtml(getter(item) || "Not available"))}</tr>`;
    const scoreRows = scoreFields.map(([label, getter]) => `<tr><th>${label}</th>${cells(item => {
      const score = Number(getter(item));
      return `${Number.isFinite(score) ? `${Math.round(score)} / 100` : "Not available"}${score === highest[label] ? ' <small class="highest">Highest score</small>' : ""}`;
    })}</tr>`).join("");
    const sourceRow = `<tr><th>Source</th>${cells(item => {
      const url = safeHttpUrl(item.supplier.sourceUrl);
      return url ? `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>` : "Not available";
    })}</tr>`;
    const brief = items[0]?.brief || {};
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CASEVO Shortlist Comparison Report</title><style>
body{margin:0;background:#faf7f1;color:#231f1a;font:13px/1.5 Arial,sans-serif}.page{max-width:1200px;margin:auto;padding:42px}h1{font:34px Georgia,serif}.notice{border:1px solid #a43627;background:#fff4f1;padding:13px;font-weight:700}.brief{margin:18px 0;padding:14px;border:1px solid #d8d0c5}.wrap{overflow:auto}table{width:100%;min-width:780px;border-collapse:collapse;background:#fff}th,td{border:1px solid #d8d0c5;padding:11px;text-align:left;vertical-align:top}th{background:#f3ede4}.highest{color:#a43627;font-weight:700}a{color:#a43627}.actions{margin-top:22px}.actions button{padding:10px 16px;border:0;background:#a43627;color:#fff;font-weight:700}@media(max-width:650px){.page{padding:20px}}@media print{.page{padding:10mm}.actions{display:none}.wrap{overflow:visible}table{min-width:0;font-size:10px}}
</style></head><body><main class="page"><h1>CASEVO Shortlist Comparison Report</h1><p class="notice">AI preliminary verification — not a final endorsement. Human validation is still required before commercial engagement.</p><div class="brief"><b>Requirement:</b> ${escapeHtml(brief.description || brief.product || "Not specified")} · ${escapeHtml(brief.quantity || "Quantity not specified")} · ${escapeHtml(brief.destination || "Destination not specified")}</div><div class="wrap"><table><thead><tr><th>Comparison</th>${items.map(item => `<th>${escapeHtml(item.supplier.name || "Supplier")}</th>`).join("")}</tr></thead><tbody>${textRow("Location", item => item.supplier.country)}${scoreRows}${textRow("Evidence", item => (item.decision.reasons || []).join(" · "))}${textRow("Risk flags", item => (item.decision.riskFlags || []).join(" · "))}${textRow("Buyer note", item => item.note)}${sourceRow}</tbody></table></div><div class="actions"><button type="button" onclick="window.print()">Print / Save as PDF</button></div></main></body></html>`;
  }
  function downloadShortlistComparison() {
    const items = documentState.items.filter(item => selectedKeys.has(item.key));
    if (items.length < 2 || items.length > 5) return false;
    const blobUrl = URL.createObjectURL(new Blob([shortlistComparisonHtml(items)], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `CASEVO-Shortlist-Comparison-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return true;
  }
  async function importShortlist(file) {
    if (!file) return false;
    try {
      if (file.size > 1024 * 1024) throw new Error("Import exceeds the 1 MB limit");
      const parsed = JSON.parse(await file.text());
      const validated = validateImport(parsed, file.size);
      if (!window.confirm("Replace the current Shortlist with this backup?")) return false;
      const saved = saveShortlist(validated);
      if (saved) showStatus(`Imported ${validated.items.length} saved supplier${validated.items.length === 1 ? "" : "s"}.`);
      return saved;
    } catch (error) {
      showStatus(error.message || "Invalid shortlist import", true);
      return false;
    }
  }
  function renderDrawer() {
    let drawer = document.getElementById("casevoShortlistDrawer");
    if (!drawer) {
      drawer = document.createElement("aside");
      drawer.id = "casevoShortlistDrawer";
      drawer.className = "casevo-shortlist-drawer";
      document.body.appendChild(drawer);
    }
    drawer.hidden = false;
    drawer.innerHTML = "";
    const header = document.createElement("header");
    addText(header, "h2", "Local Shortlist");
    const close = addText(header, "button", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close Shortlist");
    close.addEventListener("click", () => { drawer.hidden = true; });
    drawer.appendChild(header);
    addText(drawer, "p", "Saved only in this browser. AI preliminary verification still requires human validation.", "casevo-shortlist-disclaimer");
    const list = document.createElement("div");
    list.className = "casevo-shortlist-list";
    if (!documentState.items.length) addText(list, "p", "No verified suppliers saved yet.", "casevo-shortlist-empty");
    documentState.items.forEach(item => {
      const article = document.createElement("article");
      article.className = "casevo-shortlist-item";
      const select = document.createElement("input");
      select.type = "checkbox";
      select.checked = selectedKeys.has(item.key);
      select.setAttribute("aria-label", `Select ${item.supplier.name || "supplier"} for comparison`);
      select.addEventListener("change", () => {
        if (select.checked && selectedKeys.size >= 5) {
          select.checked = false;
          showStatus("Maximum 5 saved suppliers can be compared.", true);
          return;
        }
        if (select.checked) selectedKeys.add(item.key);
        else selectedKeys.delete(item.key);
        renderDrawer();
      });
      article.appendChild(select);
      addText(article, "h3", item.supplier.name || "Saved supplier");
      addText(article, "p", `${item.supplier.country || "Location not confirmed"} · Match ${item.supplier.matchScore ?? "—"} · Verification ${item.verification.score ?? "—"}`);
      const url = safeHttpUrl(item.supplier.sourceUrl);
      if (url) {
        const source = addText(article, "a", "Review source →");
        source.href = url;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
      }
      const label = addText(article, "label", "Buyer note");
      const note = document.createElement("textarea");
      note.maxLength = 1000;
      note.value = item.note || "";
      note.setAttribute("aria-label", `Note for ${item.supplier.name || "supplier"}`);
      note.addEventListener("blur", () => updateNote(item.key, note.value));
      label.appendChild(note);
      const remove = addText(article, "button", "Remove", "casevo-shortlist-remove");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${item.supplier.name || "supplier"}`);
      remove.addEventListener("click", () => removeItem(item.key));
      list.appendChild(article);
    });
    drawer.appendChild(list);
    const clear = addText(drawer, "button", "Clear all", "casevo-shortlist-clear");
    clear.type = "button";
    clear.disabled = !documentState.items.length;
    clear.addEventListener("click", clearAll);
    const backupActions = document.createElement("div");
    backupActions.className = "casevo-shortlist-backup-actions";
    const exportButton = addText(backupActions, "button", "Export JSON");
    exportButton.type = "button";
    exportButton.disabled = !documentState.items.length;
    exportButton.addEventListener("click", exportShortlist);
    const importLabel = addText(backupActions, "label", "Import JSON");
    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = "application/json,.json";
    importInput.addEventListener("change", async () => {
      await importShortlist(importInput.files?.[0]);
      importInput.value = "";
    });
    importLabel.appendChild(importInput);
    drawer.appendChild(backupActions);
    const compare = addText(drawer, "button", "Download saved comparison", "button button-red casevo-shortlist-compare");
    compare.type = "button";
    compare.disabled = selectedKeys.size < 2 || selectedKeys.size > 5;
    compare.addEventListener("click", downloadShortlistComparison);
    const createRfq = addText(drawer, "button", "Create RFQ", "button casevo-shortlist-rfq");
    createRfq.type = "button";
    createRfq.disabled = selectedKeys.size < 1 || selectedKeys.size > 5;
    createRfq.addEventListener("click", () => {
      const items = documentState.items.filter(item => selectedKeys.has(item.key));
      if (items.length < 1 || items.length > 5) return false;
      window.dispatchEvent(new CustomEvent("casevo:rfq-create", { detail: { items: items.map(item => structuredClone(item)) } }));
      return true;
    });
    const manageQuotes = addText(drawer, "button", "Manage Quotes", "button casevo-shortlist-quotes");
    manageQuotes.type = "button";
    manageQuotes.disabled = !documentState.items.length;
    manageQuotes.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("casevo:quotes-open", { detail: { items: documentState.items.map(item => structuredClone(item)) } }));
    });
  }
  function upsertVerified(detail) {
    const supplier = { ...(detail.supplier || {}), ...(detail.result?.supplier || {}) };
    const verification = detail.result?.verification;
    const decision = detail.result?.decision;
    const key = stableKey(supplier);
    if (!key || verification?.status !== "AI preliminary verification" || !isPlainObject(decision)) return false;
    const item = { key, brief: { ...(detail.brief || {}) }, supplier, verification: { ...verification }, decision: { ...decision }, note: "", savedAt: new Date().toISOString() };
    const existingIndex = documentState.items.findIndex(entry => entry.key === key);
    const items = [...documentState.items];
    if (existingIndex >= 0) item.note = items[existingIndex].note || "", items[existingIndex] = item;
    else if (items.length >= MAX_ITEMS) return showStatus("Shortlist limit reached (25 suppliers).", true), false;
    else items.push(item);
    return saveShortlist({ ...documentState, items });
  }
  function installSaveButton(detail) {
    const actions = detail.actions;
    if (!actions || actions.querySelector(".casevo-shortlist-save")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button casevo-shortlist-save";
    button.textContent = "Save to Shortlist";
    const key = stableKey({ ...(detail.supplier || {}), ...(detail.result?.supplier || {}) });
    if (documentState.items.some(item => item.key === key)) button.textContent = "Saved to Shortlist", button.disabled = true;
    button.addEventListener("click", () => {
      if (!upsertVerified(detail)) return;
      button.textContent = "Saved to Shortlist";
      button.disabled = true;
    });
    actions.appendChild(button);
  }
  function initialize() {
    documentState = loadShortlist();
    renderControl();
    window.addEventListener("casevo:verification-complete", event => installSaveButton(event.detail || {}));
    window.addEventListener("storage", event => {
      if (event.key !== STORAGE_KEY) return;
      documentState = event.newValue ? normalizeDocument((() => { try { return JSON.parse(event.newValue); } catch { return {}; } })()) : emptyDocument();
      const validKeys = new Set(documentState.items.map(item => item.key));
      [...selectedKeys].forEach(key => { if (!validKeys.has(key)) selectedKeys.delete(key); });
      renderControl();
      if (document.getElementById("casevoShortlistDrawer")?.hidden === false) renderDrawer();
    });
    window.addEventListener("casevo:sourcing-start", () => {
      selectedKeys.clear();
      if (document.getElementById("casevoShortlistDrawer")?.hidden === false) renderDrawer();
    });
  }
  globalThis.CASEVOShortlist = { loadShortlist, saveShortlist, upsertVerified, stableKey, renderDrawer, updateNote, removeItem, clearAll, validateImport, exportShortlist, importShortlist, shortlistComparisonHtml, downloadShortlistComparison };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();

