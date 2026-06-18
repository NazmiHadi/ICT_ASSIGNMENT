const express = require("express");
const path    = require("path");

const authRoutes     = require("./routes/authRoutes");
const productRoutes  = require("./routes/productRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files ─────────────────────────────────────────────
// Root assets still needed for index.html (login page)
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/vendor",          express.static(path.join(__dirname, "vendor")));

// ADDED: customer static mounts (mirrors admin pattern)
app.use("/customer/assets", express.static(path.join(__dirname, "customer", "assets")));
app.use("/customer/vendor", express.static(path.join(__dirname, "customer", "vendor")));

// Admin static mounts (unchanged)
app.use("/admin/assets", express.static(path.join(__dirname, "admin", "assets")));
app.use("/admin/vendor", express.static(path.join(__dirname, "admin", "vendor")));

// ── API routes ───────────────────────────────────────────────
app.use("/api", authRoutes);
app.use("/api", productRoutes);
app.use("/api", checkoutRoutes);

// ── Page routes ──────────────────────────────────────────────
// Login page — stays at root (unchanged)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ADDED: customer pages route
app.get("/customer/:page", (req, res) => {
  const filePath = path.join(__dirname, "customer", `${req.params.page}.html`);
  res.sendFile(filePath, err => { if (err) res.status(404).send("Page not found"); });
});

// Admin pages route (unchanged)
app.get("/admin/:page", (req, res) => {
  const filePath = path.join(__dirname, "admin", `${req.params.page}.html`);
  res.sendFile(filePath, err => { if (err) res.status(404).send("Page not found"); });
});

// REMOVED: the old root catch-all /:page route — no longer needed.
// All customer pages now live under /customer/:page above.

app.listen(3000, () => {
  console.log("✅  Server running → http://localhost:3000");
});