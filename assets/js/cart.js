// =====================================
// /assets/js/cart.js
// Cart is stored in localStorage as an array of {product_id, name, price, image, qty}
// =====================================

const CART_KEY = "cart";

// ── Get cart from localStorage ──────────────────────────────
function getCart() {
  const raw = localStorage.getItem(CART_KEY);
  return raw ? JSON.parse(raw) : [];
}

// ── Save cart back to localStorage ──────────────────────────
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

// ── Add a product to the cart (or increment qty if already in cart) ──
//
// Throws an Error if:
//   - the product has 0 (or less) stock available, OR
//   - adding `qty` would push the cart quantity for this item past
//     the available stock.
//
// product.stock must be present on the product object passed in
// (it already is, since loadProducts() includes it on every card,
// and product_details.js fetches the full product record).
function addToCart(product, qty = 1) {

  // ── Stock guard ────────────────────────────────────────────
  // Reject outright if there's no stock at all.
  const stock = Number(product.stock) || 0;
  if (stock <= 0) {
    throw new Error(`"${product.name}" is out of stock.`);
  }

  const cart = getCart();
  const existing = cart.find(item => item.product_id === product.product_id);

  // How many of this item would be in the cart AFTER this add?
  const currentQty = existing ? existing.qty : 0;
  const newQty = currentQty + qty;

  // Don't let the cart hold more than what's actually in stock.
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
  localStorage.removeItem(CART_KEY);
  updateCartBadge();
}

// ── Calculate cart total ───────────────────────────────────────
function getCartTotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.qty, 0);
}

// ── Update the little number badge on the cart icon in the navbar ──
// Looks for an element with id="cartBadge" - add this to your nav HTML
function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (!badge) return;
  const count = getCart().reduce((sum, item) => sum + item.qty, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-block" : "none";
}

document.addEventListener("DOMContentLoaded", updateCartBadge);