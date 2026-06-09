// ─────────────────────────────────────────────────────────────────────────────
// auth.js  –  Handles the LOGIN form on index.html
//
// How it works:
//   1. User fills in username + password and clicks "Sign In"
//   2. This script intercepts the form submit (prevents page refresh)
//   3. Sends the credentials to the server at POST /api/login using fetch()
//   4. The server checks the credentials and replies with JSON
//   5. We read the reply and either redirect or show an error
// ─────────────────────────────────────────────────────────────────────────────

// Wait for the page to fully load before running any code.
// This ensures the form element exists in the DOM before we try to find it.
document.addEventListener("DOMContentLoaded", function () {

  // Get the login form element using its id="loginForm" (set in index.html)
  const loginForm = document.getElementById("loginForm");

  // Safety check: only run if the form actually exists on this page
  if (!loginForm) return;

  // ── Listen for the form submit event ─────────────────────────────────────
  loginForm.addEventListener("submit", async function (e) {

    // e.preventDefault() stops the default browser behaviour of refreshing
    // the page when a form is submitted. We want to handle it with JavaScript.
    e.preventDefault();

    // Read the values the user typed into the two input fields
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    // Simple client-side check: make sure neither field is empty
    if (!username || !password) {
      alert("Please enter both username and password.");
      return;
    }

    // ── Send credentials to the server ─────────────────────────────────────
    // fetch() is a modern browser API that sends HTTP requests without
    // refreshing the page (called an "AJAX" or "API" request).
    //
    // We use 'await' so the code pauses here until the server responds,
    // instead of continuing immediately (which would give us empty data).
    try {
      const response = await fetch("/api/login", {
        method: "POST",                                   // HTTP POST (sending data)
        headers: { "Content-Type": "application/json" }, // tell server we're sending JSON
        body: JSON.stringify({ username, password })      // convert object to JSON string
      });

      // Parse the JSON text that the server sent back into a JavaScript object
      const data = await response.json();

      // ── Handle the server's response ──────────────────────────────────────
      if (data.success) {

        // ── Login succeeded ──
        // Save the user's role ("admin" or "customer") in localStorage.
        // localStorage persists across page refreshes, so other pages can
        // read it to know who is logged in.
        localStorage.setItem("role", data.role);

        // If the server sent back customer details, save them too
        if (data.customer) {
          // JSON.stringify converts the object to a string for storage
          localStorage.setItem("customer", JSON.stringify(data.customer));
        }

        // Show the success message div (defined in index.html)
        const successMsg = document.getElementById("successMessage");
        if (successMsg) successMsg.style.display = "block";

        // After a short delay, navigate to the page the server told us to go to
        // (either /admin/dashboard or /home)
        setTimeout(() => {
          window.location.href = data.redirect;
        }, 1000);

      } else {

        // ── Login failed ──
        // Show the error message the server sent (e.g. "Invalid username or password.")
        alert(data.message || "Login failed. Please try again.");

      }

    } catch (err) {
      // This runs if the network is down or the server crashed
      alert("Cannot connect to server. Is it running?");
      console.error("Login fetch error:", err);
    }

  });

});