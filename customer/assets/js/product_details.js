// ─────────────────────────────────────────────────────────────────────────────
// product_details.js
// Reads the product_id from the URL, fetches all products from /api/products,
// filters down to the one we want, then populates the detail page.
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", loadProductDetails);

async function loadProductDetails() {

  const params     = new URLSearchParams(window.location.search);
  const product_id = params.get("product_id");

  const stateMsg  = document.getElementById("stateMessage");
  const detailDiv = document.getElementById("productDetail");

  if (!product_id) {
    showError(stateMsg, "No product selected. Please go back and choose a product.");
    return;
  }

  let data;

  try {
    const response = await fetch("/api/products");

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    data = await response.json();

  } catch (err) {
    showError(stateMsg, "Could not reach the server. Is it running?");
    console.error("[PRODUCT DETAILS] Fetch error:", err);
    return;
  }

  if (!data.success) {
    showError(stateMsg, data.message || "Failed to load products.");
    return;
  }

  const product = data.products.find(p => p.product_id == product_id);

  if (!product) {
    showError(stateMsg, `Product #${product_id} was not found.`);
    return;
  }

  document.getElementById("detail-meta").textContent =
    `Product #${product.product_id}`;

  document.getElementById("detail-name").textContent = product.name;

  document.getElementById("detail-price").textContent =
    "$" + Number(product.price).toFixed(2);

  document.getElementById("detail-description").textContent = product.description;

  // Image — use the real uploaded path (image_url) from the API. If a
  // product was added before a picture was uploaded, image_url will be
  // null, so fall back to a placeholder graphic instead of requesting a
  // file that doesn't exist.
  const imgEl = document.getElementById("detail-image");
  imgEl.src   = product.image_url || "/assets/images/product-placeholder.png";
  imgEl.alt   = product.name;

  const stockBadge = document.getElementById("detail-stock-badge");
  const stock      = Number(product.stock);

  if (stock <= 0) {
    stockBadge.textContent  = "Out of Stock";
    stockBadge.className    = "stock-badge out-of-stock";
    document.getElementById("addToCartBtn").disabled = true;

  } else if (stock <= 5) {
    stockBadge.textContent  = `Only ${stock} left!`;
    stockBadge.className    = "stock-badge low-stock";

  } else {
    stockBadge.textContent  = `In Stock (${stock} units)`;
    stockBadge.className    = "stock-badge in-stock";
  }

  stateMsg.style.display  = "none";
  detailDiv.style.display = "flex";

  document.getElementById("addToCartBtn").addEventListener("click", () => {
    try {
      addToCart(product, 1);
      alert(`"${product.name}" has been added to your cart!`);
    } catch (err) {
      alert(err.message);
    }
  });
}


function showError(element, message) {
  element.textContent  = message;
  element.className    = "state-message error";
}