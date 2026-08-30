const form = document.getElementById("sourcingForm");
const results = document.getElementById("results");
const brief = document.getElementById("brief");
const supplierGrid = document.getElementById("supplierGrid");
const resultTitle = document.getElementById("resultTitle");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function detectProduct(text) {
  const t = text.toLowerCase();

  if (
    t.includes("sneaker") ||
    t.includes("shoe") ||
    t.includes("footwear")
  ) {
    return "Footwear / Sneakers";
  }

  if (
    t.includes("leather") ||
    t.includes("cow leather") ||
    t.includes("calf leather")
  ) {
    return "Leather / Footwear Upper";
  }

  if (
    t.includes("bag") ||
    t.includes("handbag") ||
    t.includes("backpack")
  ) {
    return "Bags / Accessories";
  }

  if (
    t.includes("fabric") ||
    t.includes("textile") ||
    t.includes("mesh")
  ) {
    return "Textile / Fabric";
  }

  if (
    t.includes("sole") ||
    t.includes("outsole") ||
    t.includes("midsole")
  ) {
    return "Footwear Sole / Component";
  }

  return "Product / Manufacturing Requirement";
}

function detectMaterial(text) {
  const t = text.toLowerCase();

  if (t.includes("full-grain")) {
    return "Full-Grain Cow Leather";
  }

  if (t.includes("cow leather")) {
    return "Cow Leather";
  }

  if (t.includes("calf leather")) {
    return "Calf Leather";
  }

  if (t.includes("leather")) {
    return "Leather";
  }

  if (t.includes("mesh")) {
    return "Mesh / Textile";
  }

  if (t.includes("pu leather") || t.includes("synthetic leather")) {
    return "Synthetic / PU Leather";
  }

  if (t.includes("rubber")) {
    return "Rubber";
  }

  return "To be confirmed";
}

function detectQuantity(text) {
  const patterns = [
    /([\d,]+)\s*(pairs|pair)/i,
    /([\d,]+)\s*(pcs|pieces|units)/i,
    /quantity\s*[:\-]?\s*([\d,]+)/i,
    /([\d,]+)\s*(sqft|sq ft|square feet)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      if (match[2]) {
        return `${match[1]} ${match[2]}`;
      }

      return match[1];
    }
  }

  return "Not specified";
}

function detectPrice(text) {
  const patterns = [
    /target price\s*[:\-]?\s*(?:around\s*)?\$?\s*([\d.]+)\s*(?:\/\s*)?([a-zA-Z ]+)?/i,
    /price\s*[:\-]?\s*(?:around\s*)?\$?\s*([\d.]+)\s*(?:\/\s*)?([a-zA-Z ]+)?/i,
    /\$\s*([\d.]+)\s*(?:\/\s*)?(sqft|sq\s*ft|pair|piece|unit)?/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      const unit = match[2] ? ` / ${match[2].trim()}` : "";
      return `$${match[1]}${unit}`;
    }
  }

  return "Not specified";
}

function detectDestination(text) {
  const countries = [
    "USA",
    "United States",
    "UK",
    "United Kingdom",
    "Canada",
    "Australia",
    "Germany",
    "France",
    "Italy",
    "Spain",
    "Japan",
    "South Korea",
    "Korea",
    "Singapore",
    "United Arab Emirates",
    "UAE"
  ];

  for (const country of countries) {
    if (text.toLowerCase().includes(country.toLowerCase())) {
      return country;
    }
  }

  const match = text.match(/destination\s*[:\-]?\s*([^\n,.]+)/i);

  if (match) {
    return match[1].trim();
  }

  return "Not specified";
}

function detectColor(text) {
  const colors = [
    "black",
    "white",
    "brown",
    "red",
    "blue",
    "green",
    "grey",
    "gray",
    "beige",
    "tan",
    "navy"
  ];

  const found = colors.find(color =>
    text.toLowerCase().includes(color)
  );

  if (!found) return "Not specified";

  return found.charAt(0).toUpperCase() + found.slice(1);
}

function detectThickness(text) {
  const match = text.match(
    /([\d.]+)\s*mm/i
  );

  return match ? `${match[1]}mm` : "Not specified";
}

function detectRequirements(text) {
  const requirements = [];

  const t = text.toLowerCase();

  if (
    t.includes("export") ||
    t.includes("export capability") ||
    t.includes("export experience")
  ) {
    requirements.push("Export capability");
  }

  if (
    t.includes("footwear experience") ||
    t.includes("shoe experience")
  ) {
    requirements.push("Footwear experience");
  }

  if (
    t.includes("manufacturer") ||
    t.includes("factory")
  ) {
    requirements.push("Direct manufacturer preferred");
  }

  if (
    t.includes("moq")
  ) {
    requirements.push("MOQ to verify");
  }

  return requirements.length
    ? requirements
    : ["Supplier capability to verify"];
}

function createSupplierCards(product, material) {
  const supplierType =
    product.includes("Footwear")
      ? "Footwear / Materials"
      : material.includes("Leather")
      ? "Leather / Components"
      : "Manufacturing Supplier";

  return [
    {
      name: "Supplier Match A",
      location: "Dongguan, Guangdong",
      score: 92,
      match: "High",
      capability: supplierType,
      moq: "To verify"
    },
    {
      name: "Supplier Match B",
      location: "Guangdong, China",
      score: 87,
      match: "High",
      capability: supplierType,
      moq: "To verify"
    },
    {
      name: "Supplier Match C",
      location: "China",
      score: 79,
      match: "Medium",
      capability: "China supply chain",
      moq: "To verify"
    }
  ];
}

form.addEventListener("submit", function(event) {
  event.preventDefault();

  const request =
    document.getElementById("request").value.trim();

  const productInput =
    document.getElementById("product").value.trim();

  const quantityInput =
    document.getElementById("quantity").value.trim();

  const priceInput =
    document.getElementById("price").value.trim();

  const destinationInput =
    document.getElementById("destination").value.trim();

  if (!request) {
    alert("Please describe what you need to source.");
    return;
  }

  const product =
    productInput || detectProduct(request);

  const material =
    detectMaterial(request);

  const quantity =
    quantityInput || detectQuantity(request);

  const price =
    priceInput || detectPrice(request);

  const destination =
    destinationInput || detectDestination(request);

  const color =
    detectColor(request);

  const thickness =
    detectThickness(request);

  const requirements =
    detectRequirements(request);

  resultTitle.textContent =
    `AI sourcing brief for ${product}`;

  brief.innerHTML = `
    <div class="brief-grid">
      <div>
        <span>Product</span>
        <strong>${escapeHtml(product)}</strong>
      </div>

      <div>
        <span>Material</span>
        <strong>${escapeHtml(material)}</strong>
      </div>

      <div>
        <span>Quantity</span>
        <strong>${escapeHtml(quantity)}</strong>
      </div>

      <div>
        <span>Target Price</span>
        <strong>${escapeHtml(price)}</strong>
      </div>

      <div>
        <span>Destination</span>
        <strong>${escapeHtml(destination)}</strong>
      </div>

      <div>
        <span>Color</span>
        <strong>${escapeHtml(color)}</strong>
      </div>

      <div>
        <span>Thickness</span>
        <strong>${escapeHtml(thickness)}</strong>
      </div>

      <div>
        <span>Requirements</span>
        <strong>${escapeHtml(requirements.join(", "))}</strong>
      </div>
    </div>
  `;

  const suppliers =
    createSupplierCards(product, material);

  supplierGrid.innerHTML =
    suppliers.map(supplier => `
      <article class="supplier-card">
        <div class="supplier-top">
          <span class="eyebrow">AI MATCH</span>
          <strong class="supplier-score">
            ${supplier.score}
          </strong>
        </div>

        <h3>${escapeHtml(supplier.name)}</h3>

        <p class="supplier-location">
          ${escapeHtml(supplier.location)}
        </p>

        <div class="supplier-detail">
          <span>Product Match</span>
          <strong>${escapeHtml(supplier.match)}</strong>
        </div>

        <div class="supplier-detail">
          <span>Capability</span>
          <strong>${escapeHtml(supplier.capability)}</strong>
        </div>

        <div class="supplier-detail">
          <span>MOQ</span>
          <strong>${escapeHtml(supplier.moq)}</strong>
        </div>

        <div class="verification">
          Human verification required
        </div>
      </article>
    `).join("");

  results.hidden = false;

  results.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});
