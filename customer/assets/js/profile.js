// ─────────────────────────────────────────────────────────────────────────────
// profile.js
// Loads the logged-in customer's profile details via GET /api/customer/profile
// then loads their order history via GET /api/orders?customer_id=...
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
function renderProfile(c) {
  const initials = (c.name || c.username || "?").charAt(0).toUpperCase();
  document.getElementById("profileAvatar").textContent          = initials;
  document.getElementById("profileName").textContent            = c.name        || "—";
  document.getElementById("profileUsernameDisplay").textContent = "@" + (c.username || "—");

  document.getElementById("profileNameInput").value     = c.name     || "";
  document.getElementById("profileEmailInput").value    = c.email    || "";
  document.getElementById("profilePhoneInput").value    = c.phone    || "";
  document.getElementById("profileAddressInput").value  = c.address || "";
  document.getElementById("profileUsernameInput").value = c.username || "";

  document.getElementById("profileStateMessage").style.display = "none";
  document.getElementById("profileCard").style.display         = "block";
  document.getElementById("ordersSection").style.display       = "block";
}


// ── Save profile changes ────────────────────────────────────────────────────
document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const customerId = getCustomerId();
  const alertBox    = document.getElementById("profileAlert");
  const submitBtn   = e.target.querySelector("button[type=submit]");

  const password        = document.getElementById("profilePasswordInput").value;
  const confirmPassword = document.getElementById("profileConfirmPasswordInput").value;

  const payload = {
    customer_id: customerId,
    name:        document.getElementById("profileNameInput").value.trim(),
    email:       document.getElementById("profileEmailInput").value.trim(),
    phone:       document.getElementById("profilePhoneInput").value.trim(),
    address:     document.getElementById("profileAddressInput").value.trim(),
    username:    document.getElementById("profileUsernameInput").value.trim()
  };

  if (password || confirmPassword) {
    payload.password        = password;
    payload.confirmPassword = confirmPassword;
  }

  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled    = true;
  submitBtn.textContent = "Saving...";

  try {
    const res  = await fetch("/api/customer/profile", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showProfileAlert(data.message || "Failed to update profile.", "error");
      return;
    }

    // Keep localStorage's "customer" object in sync (name/username feed
    // the navbar avatar/initials and the cart key, so this matters).
    localStorage.setItem("customer", JSON.stringify(data.customer));

    document.getElementById("profilePasswordInput").value        = "";
    document.getElementById("profileConfirmPasswordInput").value = "";

    renderProfile(data.customer);
    showProfileAlert("Profile updated successfully.", "success");

  } catch (err) {
    console.error("[PROFILE] Update error:", err);
    showProfileAlert("Could not reach the server. Please try again.", "error");
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = originalBtnText;
  }
});

function showProfileAlert(message, type) {
  const box = document.getElementById("profileAlert");
  box.textContent = message;
  box.className   = type;
  box.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => { box.style.display = "none"; }, 4500);
}


// ── loadOrders() ──────────────────────────────────────────────────────────────
// Uses GET /api/orders?customer_id=... which now actually filters by
// customer (previously this route ignored customer_id and returned every
// order in the system — fixed in the updated orderRoutes.js).
async function loadOrders(customerId) {
  const stateMsg  = document.getElementById("stateMessage");
  const container = document.getElementById("ordersContainer");

  stateMsg.style.display = "block";
  stateMsg.innerHTML     = "<p>Loading your orders...</p>";
  container.innerHTML    = "";

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

  const badge = document.getElementById("ordersCountBadge");
  badge.textContent = orders.length === 1 ? "1 order" : `${orders.length} orders`;

  if (!orders.length) {
    showOrdersState(stateMsg, 'You have no orders yet. <a href="/customer/products">Browse products</a>');
    return;
  }

  const orderTemplate = document.getElementById("orderTemplate");
  const itemTemplate  = document.getElementById("orderItemTemplate");

  orders.forEach(order => {
    const node = orderTemplate.content.cloneNode(true);

    // Make the whole card clickable through to the order detail page.
    const cardEl = node.querySelector(".order-card");
    cardEl.style.cursor = "pointer";
    cardEl.setAttribute("role", "button");
    cardEl.setAttribute("tabindex", "0");
    cardEl.setAttribute("title", "View order details");
    const goToDetail = () => {
      window.location.href = `/customer/order-details.html?order_id=${encodeURIComponent(order.order_id)}`;
    };
    cardEl.addEventListener("click", goToDetail);
    cardEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        goToDetail();
      }
    });

    node.querySelector(".order-id").textContent   = `Order #${order.order_id}`;
    node.querySelector(".order-date").textContent = formatDate(order.order_date);

    // Status badge
    const statusEl = node.querySelector(".order-status-badge");
    statusEl.textContent = order.status || "Processing";
    statusEl.className   = "order-status-badge " + statusClass(order.status);

    // Tracking number (only shown once it exists)
    const trackingEl = node.querySelector(".order-tracking");
    if (order.tracking_no) {
      trackingEl.textContent = `Tracking No: ${order.tracking_no}`;
      trackingEl.style.display = "block";
    } else {
      trackingEl.style.display = "none";
    }

    const itemsContainer = node.querySelector(".order-items");

    (order.products || []).forEach(item => {
      const itemNode = itemTemplate.content.cloneNode(true);

      const img = itemNode.querySelector(".order-item-img");
      if (item.image_url) {
        img.src = item.image_url;
        img.alt = item.product_name;
        img.style.display = "block";
      } else {
        img.style.display = "none"; // product was added without a picture
      }

      itemNode.querySelector(".order-item-name").textContent = item.product_name;
      itemNode.querySelector(".order-item-meta").textContent =
        `Qty: ${item.qty} × $${Number(item.price || 0).toFixed(2)}`;
      itemNode.querySelector(".order-item-line-total").textContent =
        `$${Number(item.line_total || 0).toFixed(2)}`;

      itemsContainer.appendChild(itemNode);
    });

    node.querySelector(".order-total").textContent = `$${Number(order.total || 0).toFixed(2)}`;

    container.appendChild(node);
  });

  stateMsg.style.display = "none";
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function statusClass(status) {
  switch (status) {
    case "Delivered":   return "status-delivered";
    case "In Delivery": return "status-in-delivery";
    default:            return "status-processing";
  }
}

function getCustomerId() {
  const raw = localStorage.getItem("customer");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.customer_id ?? parsed.CustID ?? parsed.cust_id ?? parsed.id ?? null;
  } catch {
    return raw;
  }
}

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

function showProfileError(message) {
  const el = document.getElementById("profileStateMessage");
  el.innerHTML  = `<p>${message}</p>`;
  el.className  = "state-message error";
}

function showOrdersState(element, html, isError = false) {
  element.innerHTML = `<p>${html}</p>`;
  element.className = isError ? "state-message error" : "state-message";
  element.style.display = "block";
}

function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}