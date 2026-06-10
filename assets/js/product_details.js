// ─────────────────────────────────────────────────────────────────────────────
// product_details.js
// Reads the product_id from the URL, fetches all products from /api/products,
// filters down to the one we want, then populates the detail page.
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", loadProductDetails);

async function loadProductDetails() {

  // ── 1. Read product_id from the URL query string ─────────────────────────
  // When the user clicks a product card they land on:
  //   /product_details?product_id=3
  // URLSearchParams lets us read the value after the "?"
  const params     = new URLSearchParams(window.location.search);
  const product_id = params.get("product_id");

  // Helper references to the two main areas we toggle
  const stateMsg     = document.getElementById("stateMessage");
  const detailDiv    = document.getElementById("productDetail");

  // ── 2. Guard: no product_id in URL → show error ───────────────────────────
  if (!product_id) {
    showError(stateMsg, "No product selected. Please go back and choose a product.");
    return;
  }

  // ── 3. Fetch the full product list from the API ───────────────────────────
  // We reuse /api/products (which already exists) instead of a separate route.
  // The API returns: { success: true, products: [ {...}, {...}, ... ] }
  let data;

  try {
    const response = await fetch("/api/products");

    // If the server returned a non-200 status, throw so we hit the catch block
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    data = await response.json();

  } catch (err) {
    showError(stateMsg, "Could not reach the server. Is it running?");
    console.error("[PRODUCT DETAILS] Fetch error:", err);
    return;
  }

  // ── 4. Guard: API reported failure ───────────────────────────────────────
  if (!data.success) {
    showError(stateMsg, data.message || "Failed to load products.");
    return;
  }

  // ── 5. Find the one product we need ──────────────────────────────────────
  // data.products is the full array; .find() stops at the first match.
  // We use == (not ===) because product_id from the URL is a string ("3")
  // while row.product_id from Oracle is a number (3).
  const product = data.products.find(p => p.product_id == product_id);

  // ── 6. Guard: product_id not found in the list ────────────────────────────
  if (!product) {
    showError(stateMsg, `Product #${product_id} was not found.`);
    return;
  }

  // ── 7. Populate the HTML elements with the product data ──────────────────
  // Each getElementById matches an element in product_details.html

  // Small meta line above the title  e.g. "Product #3"
  document.getElementById("detail-meta").textContent =
    `Product #${product.product_id}`;

  // Product name  →  <h2 id="detail-name">
  document.getElementById("detail-name").textContent = product.name;

  // Price  →  <p id="detail-price">   formatted as  $20.45
  document.getElementById("detail-price").textContent =
    "$" + Number(product.price).toFixed(2);

  // Description  →  <p id="detail-description">
  document.getElementById("detail-description").textContent = product.description;

  // Image  →  <img id="detail-image">
  const imgEl  = document.getElementById("detail-image");
  imgEl.src    = `/assets/images/${product.image}`;
  imgEl.alt    = product.name;

  // ── 8. Stock badge ───────────────────────────────────────────────────────
  // Colour-coded depending on how many units remain
  const stockBadge = document.getElementById("detail-stock-badge");
  const stock      = Number(product.stock);

  if (stock <= 0) {
    stockBadge.textContent  = "Out of Stock";
    stockBadge.className    = "stock-badge out-of-stock";

    // Disable the Add to Cart button if nothing is in stock
    document.getElementById("addToCartBtn").disabled = true;

  } else if (stock <= 5) {
    stockBadge.textContent  = `Only ${stock} left!`;
    stockBadge.className    = "stock-badge low-stock";

  } else {
    stockBadge.textContent  = `In Stock (${stock} units)`;
    stockBadge.className    = "stock-badge in-stock";
  }

  // ── 9. Show the detail panel, hide the loading message ───────────────────
  stateMsg.style.display  = "none";
  detailDiv.style.display = "flex";    // Bootstrap row uses flex internally

  // ── 10. Add to Cart button handler ───────────────────────────────────────
  // For now this just logs to the console.
  // Later you can POST to /api/cart or store in localStorage.
  document.getElementById("addToCartBtn").addEventListener("click", () => {
    console.log("[CART] Added product:", product);
    alert(`"${product.name}" has been added to your cart!`);
    // Future: send to /api/cart with customer_id + product_id + quantity
  });
}


// ── Helper: display an error message in the state area ───────────────────────
function showError(element, message) {
  element.textContent  = message;
  element.className    = "state-message error";
}