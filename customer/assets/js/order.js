// ─────────────────────────────────────────────────────────────────────────────
// orders.js
// Fetches the logged-in customer's order history from /api/orders and renders
// each order via #orderTemplate / #orderItemTemplate.
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  loadOrders();
});

async function loadOrders() {

  const stateMsg  = document.getElementById("stateMessage");
  const container = document.getElementById("ordersContainer");

  const customerId = getCustomerId();

  if (!customerId) {
    showState(stateMsg, "Please log in to view your orders.", true);
    return;
  }

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

  if (!data.orders || !data.orders.length) {
    showState(stateMsg, 'You have no orders yet. <a href="/customer/products">Browse products</a>');
    return;
  }

  const orderTemplate = document.getElementById("orderTemplate");
  const itemTemplate  = document.getElementById("orderItemTemplate");

  data.orders.forEach(order => {
    const node = orderTemplate.content.cloneNode(true);

    node.querySelector(".order-id").textContent   = `Order #${order.order_id}`;
    node.querySelector(".order-date").textContent = formatDate(order.order_date);

    const statusEl = node.querySelector(".order-status-badge");
    statusEl.textContent = order.status || "Processing";
    statusEl.className   = "order-status-badge " + statusClass(order.status);

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

    node.querySelector(".order-total").textContent =
      `$${Number(order.total || 0).toFixed(2)}`;

    container.appendChild(node);
  });

  stateMsg.style.display  = "none";
  container.style.display = "block";
}


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
    return parsed.CustID ?? parsed.cust_id ?? parsed.id ?? parsed.customer_id ?? null;
  } catch {
    return raw;
  }
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

function showState(element, html, isError = false) {
  element.innerHTML = `<p>${html}</p>`;
  element.className = isError ? "state-message error" : "state-message";
}