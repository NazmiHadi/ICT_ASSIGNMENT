// =====================================
// CHECKOUT (mock transaction)
// =====================================
// Sends the cart to the server, server creates ORDERS + ORDER_PRODUCTS rows.
// "Mock transaction" = no real payment gateway, we just simulate a delay
// and pretend the payment always succeeds.
async function checkout() {

  const cart = getCart();
  if (!cart.length) {
    alert("Your cart is empty.");
    return;
  }

  // Build the payload the server expects
  const payload = {
    items: cart.map(item => ({
      product_id: item.product_id,
      qty:        item.qty
    }))
  };

  try {
    // ── Mock payment step ──────────────────────────────────────
    // Simulate "processing payment" for 1.5 seconds
    const payBtn = document.getElementById("checkoutBtn");
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = "Processing payment...";
    }
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock payment is always "successful" here.
    // In a real app this is where you'd call Stripe/PayPal/etc.
    const paymentSuccess = true;

    if (!paymentSuccess) {
      alert("Payment failed. Please try again.");
      return;
    }

    // ── Send order to server ────────────────────────────────────
    const response = await fetch("/api/checkout", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.success) {
      alert("Order failed: " + (data.message || "Unknown error"));
      return;
    }

    // Success! Clear cart and show confirmation
    clearCart();
    alert(`Order placed successfully! Order ID: ${data.orderId}`);
    window.location.href = "/customer/orders"; // or wherever your order history page is

  } catch (err) {
    console.error("Checkout error:", err);
    alert("Something went wrong during checkout.");

  } finally {
    const payBtn = document.getElementById("checkoutBtn");
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = "Checkout";
    }
  }
}

document.addEventListener("DOMContentLoaded", updateCartBadge);
