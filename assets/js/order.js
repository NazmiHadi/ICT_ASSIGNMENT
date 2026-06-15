// ─────────────────────────────────────────────────────────────────────────────
// orders.js
// Fetches the logged-in customer's order history from /api/orders and renders
// each order via #orderTemplate / #orderItemTemplate (clone-based, like cart.html).
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  loadOrders();
});

async function loadOrders() {

  const stateMsg  = document.getElementById("stateMessage");
  const container = document.getElementById("ordersContainer");

  // ── 1. Identify the logged-in customer ─────────────────────────────────
  const customerId = getCustomerId();

  if (!customerId) {
    showState(stateMsg, "Please log in to view your orders.", true);
    return;
  }

  // ── 2. Fetch orders for this customer ───────────────────────────────────
  let data;

  try {
    const response = await fetch(`/api/orders?customer_id=${encodeURIComponent(customerId)}`);

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    data = await response.json();

  } catch (err) {
    showState(stateMsg, "Could not reach the server. Is it running?", true);
    console.error("[ORDERS] Fetch error:", err);
    return;
  }

  if (!data.success) {
    showState(stateMsg, data.message || "Failed to load orders.", true);
    return;
  }

  // ── 3. Empty state ────────────────────────────────────────────────────
  if (!data.orders || !data.orders.length) {
    showState(stateMsg, 'You have no orders yet. <a href="/products">Browse products</a>');
    return;
  }

  // ── 4. Render each order ─────────────────────────────────────────────
  const orderTemplate = document.getElementById("orderTemplate");
  const itemTemplate  = document.getElementById("orderItemTemplate");

  data.orders.forEach(order => {
  const node = orderTemplate.content.cloneNode(true);

  node.querySelector(".order-id").textContent   = `Order #${order.order_id}`;
  node.querySelector(".order-date").textContent = formatDate(order.order_date);

  const itemsContainer = node.querySelector(".order-items");

  (order.items || []).forEach(item => {
    const itemNode = itemTemplate.content.cloneNode(true);

    const img = itemNode.querySelector(".order-item-img");
    img.src = `assets/images/${item.image}`;
    img.alt = item.name;

    itemNode.querySelector(".order-item-name").textContent = item.name;
    itemNode.querySelector(".order-item-meta").textContent =
      `Qty: ${item.qty} × $${Number(item.price).toFixed(2)}`;

    itemNode.querySelector(".order-item-line-total").textContent =
      `$${Number(item.line_total).toFixed(2)}`;

    itemsContainer.appendChild(itemNode);
  });

  node.querySelector(".order-total").textContent =
    `$${Number(order.total).toFixed(2)}`;

  container.appendChild(node);
});

  // ── 5. Reveal the orders, hide the loading message ─────────────────────
  stateMsg.style.display  = "none";
  container.style.display = "block";
}


// ── Helper: get the current customer's id from localStorage ─────────────
function getCustomerId() {
  const raw = localStorage.getItem("customer");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed.CustID ?? parsed.cust_id ?? parsed.id ?? parsed.customer_id ?? null;
  } catch {
    return raw;
  }
}


// ── Helper: format an ISO date string for display ────────────────────────
function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}


// ── Helper: show a message in the state area (red if isError) ────────────
function showState(element, html, isError = false) {
  element.innerHTML = `<p>${html}</p>`;
  element.className = isError ? "state-message error" : "state-message";
}