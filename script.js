const form = document.getElementById("sourcingForm");
const results = document.getElementById("results");
const brief = document.getElementById("brief");
const supplierGrid = document.getElementById("supplierGrid");
const resultTitle = document.getElementById("resultTitle");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const request = document.getElementById("request").value.trim();
  const product = document.getElementById("product").value.trim() || inferProduct(request);
  const quantity = document.getElementById("quantity").value.trim() || "Not specified";
  const price = document.getElementById("price").value.trim() || "Not specified";
  const destination = document.getElementById("destination").value.trim() || "Not specified";

  const keywords = request.toLowerCase();
  const material = keywords.includes("leather") ? "Leather" :
                   keywords.includes("mesh") ? "Mesh / Textile" :
                   keywords.includes("sole") ? "Sole / Component" :
                   "Footwear Material";

  resultTitle.textContent = `Illustrative matches for ${product}`;

  brief.innerHTML = [
    ["Product", product],
    ["Material", material],
    ["Quantity", quantity],
    ["Target Price", price],
    ["Destination", destination]
  ].map(([k,v]) => `<span><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</span>`).join("");

  const demoSuppliers = [
    {
      name: "Supplier Match A",
      location: "Dongguan, Guangdong",
      score: 86,
      match: "High",
      moq: "To verify",
      capability: "Footwear materials",
      status: "Human verification required"
    },
    {
      name: "Supplier Match B",
      location: "Guangdong, China",
      score: 81,
      match: "High",
      moq: "To verify",
      capability: "Leather / components",
      status: "Human verification required"
    },
    {
      name: "Supplier Match C",
      location: "China",
      score: 74,
      match: "Medium",
      moq: "To verify",
      capability: "Footwear supply chain",
      status: "Human verification required"
    }
  ];

  supplierGrid.innerHTML = demoSuppliers.map(s => `
    <article class="supplier">
      <div class="supplier-top">
        <span class="status">DEMO MATCH</span>
        <span class="score-number">${s.score}</span>
      </div>
      <h4>${s.name}</h4>
      <small>${s.location}</small>
      <div class="supplier-meta">
        <div><span>Product Match</span><b>${s.match}</b></div>
        <div><span>Capability</span><b>${s.capability}</b></div>
        <div><span>MOQ</span><b>${s.moq}</b></div>
      </div>
      <span class="verified">${s.status}</span>
    </article>
  `).join("");

  results.hidden = false;
  results.scrollIntoView({behavior:"smooth", block:"start"});
});

function inferProduct(text) {
  const t = text.toLowerCase();
  if (t.includes("leather")) return "Leather / Footwear Upper";
  if (t.includes("sneaker")) return "Sneaker";
  if (t.includes("outsole") || t.includes("sole")) return "Shoe Sole";
  if (t.includes("mesh")) return "Footwear Mesh";
  return "Footwear Sourcing";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

function submitContact(event) {
  event.preventDefault();
  document.getElementById("contactMessage").hidden = false;
  event.target.reset();
}

function toggleMenu() {
  const links = document.querySelector(".nav-links");
  links.style.display = links.style.display === "flex" ? "none" : "flex";
  if (links.style.display === "flex") {
    links.style.position = "absolute";
    links.style.top = "76px";
    links.style.left = "0";
    links.style.right = "0";
    links.style.padding = "20px";
    links.style.background = "var(--paper)";
    links.style.flexDirection = "column";
    links.style.borderBottom = "1px solid var(--line)";
    links.style.zIndex = "20";
  }
}
