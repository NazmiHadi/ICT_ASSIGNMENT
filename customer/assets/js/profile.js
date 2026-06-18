// ─────────────────────────────────────────────────────────────────────────────
// profile.js
// Loads the logged-in customer's profile details via GET /api/customer/profile
// then loads their order history via GET /api/orders.
//
// The /api/customer/profile route is defined in customerRoutes.js and accepts
// ?customer_id=... so it can also be reused by the admin panel to look up any
// customer by ID.
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();

  const customerId = getCustomerId();

  if (!customerId) {
    showProfileError("Please log in to view your profile.");
    return;
  }

  loadProfile(customerId);
  loadOrders(customerId);
});


// ── loadProfile() ─────────────────────────────────────────────────────────────
// Fetches customer details from /api/customer/profile?customer_id=<id>
// and populates the profile card.
async function loadProfile(customerId) {
  try {
    const res  = await fetch(`/api/customer/profile?customer_id=${encodeURIComponent(customerId)}`);
    const data = await res.json();

    if (!data.success || !data.customer) {
      showProfileError(data.message || "Could not load profile.");
      return;
    }

    renderProfile(data.customer);

  } catch (err) {
    showProfileError("Could not reach the server. Is it running?");
    console.error("[PROFILE] Fetch error:", err);
  }
}


// ── renderProfile() ───────────────────────────────────────────────────────────
// Fills in the profile card DOM elements with the customer object.
function renderProfile(c) {
  // Avatar initials — first letter of name
  const initials = (c.name || c.username || "?").charAt(0).toUpperCase();
  document.getElementById("profileAvatar").textContent          = initials;
  document.getElementById("profileName").textContent            = c.name        || "—";
  document.getElementById("profileUsernameDisplay").textContent = "@" + (c.username || "—");
  document.getElementById("profileUsername").textContent        = c.username    || "—";

  setField("profileEmail",   c.email);
  setField("profilePhone",   c.phone);
  setField("profileAddress", c.address);

  document.getElementById("profileStateMessage").style.display = "none";
  document.getElementById("profileCard").style.display         = "block";
  document.getElementById("ordersSection").style.display       = "block";
}


// ── loadOrders() ──────────────────────────────────────────────────────────────
// Reuses the existing GET /api/orders?customer_id=... endpoint.
// The same endpoint works for the admin page — just pass any customer_id.
async function loadOrders(customerId) {
  const stateMsg  = document.getElementById("stateMessage");
  const container = document.getElementById("ordersContainer");

  stateMsg.style.display = "block";
  stateMsg.innerHTML     = "<p>Loading your orders...</p>";

  let data;

  try {
    const res = await fetch(`/api/orders?customer_id=${encodeURIComponent(customerId)}`);

    if (!res.ok) throw new Error(`Server responded with status ${res.status}`);

    data = await res.json();

  } catch (err) {
    showOrdersState(stateMsg, "Could not reach the server. Is it running?", true);
    console.error("[ORDERS] Fetch error:", err);
    return;
  }

  if (!data.success) {
    showOrdersState(stateMsg, data.message || "Failed to load orders.", true);
    return;
  }

  const orders = data.orders || [];

  // Update the badge count
  const badge = document.getElementById("ordersCountBadge");
  badge.textContent = orders.length === 1 ? "1 order" : `${orders.length} orders`;

  if (!orders.length) {
    showOrdersState(stateMsg, 'You have no orders yet. <a href="/customer/products">Browse products</a>');
    return;
  }

  // Render each order card
  const orderTemplate = document.getElementById("orderTemplate");
  const itemTemplate  = document.getElementById("orderItemTemplate");

  orders.forEach(order => {
    const node = orderTemplate.content.cloneNode(true);

    node.querySelector(".order-id").textContent   = `Order #${order.order_id}`;
    node.querySelector(".order-date").textContent = formatDate(order.order_date);

    const itemsContainer = node.querySelector(".order-items");

    (order.items || []).forEach(item => {
      const itemNode = itemTemplate.content.cloneNode(true);

      const img = itemNode.querySelector(".order-item-img");
      img.src = `/customer/assets/images/${item.image}`;
      img.alt = item.name;

      itemNode.querySelector(".order-item-name").textContent = item.name;
      itemNode.querySelector(".order-item-meta").textContent =
        `Qty: ${item.qty} × $${Number(item.price).toFixed(2)}`;
      itemNode.querySelector(".order-item-line-total").textContent =
        `$${Number(item.line_total).toFixed(2)}`;

      itemsContainer.appendChild(itemNode);
    });

    node.querySelector(".order-total").textContent = `$${Number(order.total).toFixed(2)}`;

    container.appendChild(node);
  });

  stateMsg.style.display = "none";
}


// ── Helpers ───────────────────────────────────────────────────────────────────

// Get the logged-in customer's ID from localStorage.
// The login response stores the customer object under the "customer" key.
function getCustomerId() {
  const raw = localStorage.getItem("customer");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Support all the key names used across the codebase
    return parsed.customer_id ?? parsed.CustID ?? parsed.cust_id ?? parsed.id ?? null;
  } catch {
    return raw;
  }
}


// Set a profile field value; adds .empty class if blank.
function setField(elementId, value) {
  const el = document.getElementById(elementId);
  if (value) {
    el.textContent  = value;
    el.className    = "";
  } else {
    el.textContent  = "Not provided";
    el.className    = "empty";
  }
}


// Show an error in the profile state message area.
function showProfileError(message) {
  const el = document.getElementById("profileStateMessage");
  el.innerHTML  = `<p>${message}</p>`;
  el.className  = "state-message error";
}


// Show a message inside the orders state element.
function showOrdersState(element, html, isError = false) {
  element.innerHTML = `<p>${html}</p>`;
  element.className = isError ? "state-message error" : "state-message";
  element.style.display = "block";
}


// Format an ISO date string for display.
function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}