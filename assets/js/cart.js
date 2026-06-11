// =====================================
// /assets/js/cart.js
// Cart is stored in localStorage as an array of {product_id, name, price, image, qty}
// Cart is now scoped PER USER via a dynamic key, so different accounts
// on the same browser don't see each other's carts.
// =====================================

// ── Get the localStorage key for the CURRENT user's cart ─────────────
// "customer" is set on login (and removed on logout - see logout()
// in products.html etc). We read its customer_id (or email/username,
// whichever your login stores) and build a unique key per user.
//
// If no one is logged in, fall back to "cart_guest" so the page
// doesn't crash - though in practice this page should only be
// reachable while logged in.
function getCartKey() {
  const raw = localStorage.getItem("customer");

  if (!raw) {
    return "cart_guest";
  }

  try {
    const customer = JSON.parse(raw);
    // Adjust this to whatever unique field your "customer" object
    // actually has - customer_id, email, username, etc.
    const id = customer.customer_id ?? customer.email ?? customer.username;
    return `cart_${id}`;
  } catch (err) {
    // "customer" wasn't valid JSON for some reason
    console.error("[CART] Could not parse customer from localStorage:", err);
    return "cart_guest";
  }
}

// ── Get cart from localStorage ──────────────────────────────
function getCart() {
  const raw = localStorage.getItem(getCartKey());
  return raw ? JSON.parse(raw) : [];
}

// ── Save cart back to localStorage ──────────────────────────
function saveCart(cart) {
  localStorage.setItem(getCartKey(), JSON.stringify(cart));
  updateCartBadge();
}

// ── Add a product to the cart (or increment qty if already in cart) ──
function addToCart(product, qty = 1) {

  const stock = Number(product.stock) || 0;
  if (stock <= 0) {
    throw new Error(`"${product.name}" is out of stock.`);
  }

  const cart = getCart();
  const existing = cart.find(item => item.product_id === product.product_id);

  const currentQty = existing ? existing.qty : 0;
  const newQty = currentQty + qty;

  if (newQty > stock) {
    throw new Error(
      `Only ${stock} unit(s) of "${product.name}" available ` +
      `(you already have ${currentQty} in your cart).`
    );
  }

  if (existing) {
    existing.qty = newQty;
  } else {
    cart.push({
      product_id: product.product_id,
      name:       product.name,
      price:      product.price,
      image:      product.image,
      qty:        qty
    });
  }

  saveCart(cart);
}

// ── Remove a product entirely from the cart ──────────────────
function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter(item => item.product_id !== productId);
  saveCart(cart);
}

// ── Update quantity for a product (used by +/- buttons on cart page) ──
function updateQty(productId, qty) {
  const cart = getCart();
  const item = cart.find(i => i.product_id === productId);
  if (!item) return;

  item.qty = qty;
  if (item.qty <= 0) {
    removeFromCart(productId);
    return;
  }
  saveCart(cart);
}

// ── Clear the entire cart (after successful checkout) ─────────
function clearCart() {
  localStorage.removeItem(getCartKey());
  updateCartBadge();
}

// ── Calculate cart total ───────────────────────────────────────
function getCartTotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.qty, 0);
}

// ── Update the little number badge on the cart icon in the navbar ──
function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (!badge) return;
  const count = getCart().reduce((sum, item) => sum + item.qty, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-block" : "none";
}

document.addEventListener("DOMContentLoaded", updateCartBadge);