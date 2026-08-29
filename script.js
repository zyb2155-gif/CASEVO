let cartCount=0;

function renderProducts(){
  const grid=document.getElementById("productGrid");
  grid.innerHTML=PRODUCTS.map(p=>`
    <article class="product">
      <div class="product-image"><img src="assets/${p.id}.jpg" alt="${p.name} CASEVO phone case" loading="lazy"></div>
      <div class="product-body">
        <h3>${p.name}</h3>
        <div class="product-sub">${p.subtitle}</div>
        <div class="product-bottom">
          <span class="price">$${p.price.toFixed(2)}</span>
          <button class="buy" onclick="openBuy('${p.id}')">Buy now →</button>
        </div>
      </div>
    </article>`).join("");
}

function openBuy(id){
  const p=PRODUCTS.find(x=>x.id===id);
  document.getElementById("modalTitle").textContent=p.name;
  document.getElementById("modalPrice").textContent=`$${p.price.toFixed(2)}`;
  const s=document.getElementById("stripeBtn"), sh=document.getElementById("shopifyBtn");
  s.href=p.stripe.startsWith("http")?p.stripe:"#";
  sh.href=p.shopify.startsWith("http")?p.shopify:"#";
  s.onclick=(e)=>{if(!p.stripe.startsWith("http")){e.preventDefault();alert("Add your Stripe Payment Link in script.js first.");}};
  sh.onclick=(e)=>{if(!p.shopify.startsWith("http")){e.preventDefault();alert("Add your Shopify checkout URL in script.js first.");}};
  document.getElementById("buyModal").classList.add("open");
  document.getElementById("buyModal").setAttribute("aria-hidden","false");
}
function closeBuy(){document.getElementById("buyModal").classList.remove("open");document.getElementById("buyModal").setAttribute("aria-hidden","true")}
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeBuy()});
document.getElementById("buyModal").addEventListener("click",e=>{if(e.target.id==="buyModal")closeBuy()});
function focusSearch(){window.location.hash="collection";document.querySelector(".product").scrollIntoView({behavior:"smooth"})}
function subscribe(e){e.preventDefault();alert("Thank you — you're on the CASEVO list.");e.target.reset()}
renderProducts();
