const express = require("express");
const path    = require("path");

const authRoutes      = require("./routes/authRoutes");
const productRoutes   = require("./routes/productRoutes");
const checkoutRoutes  = require("./routes/checkoutRoutes");
const workerRoutes    = require("./routes/workerRoutes");
const orderRoutes     = require("./routes/orderRoutes");
const purchaseRoutes  = require("./routes/purchaseRoutes");
const vendorRoutes    = require("./routes/vendorRoutes");
const customerRoutes  = require("./routes/customerRoutes");
const containerRoutes = require("./routes/containerRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const profileRoutes   = require("./routes/profileRoutes");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "assets")));
app.use("/assets",          express.static(path.join(__dirname, "assets")));
app.use("/vendor",          express.static(path.join(__dirname, "vendor")));
app.use("/css",             express.static(path.join(__dirname, "css")));
app.use("/customer/assets", express.static(path.join(__dirname, "customer", "assets")));
app.use("/customer/vendor", express.static(path.join(__dirname, "customer", "vendor")));
app.use("/admin/assets",    express.static(path.join(__dirname, "admin", "assets")));
app.use("/admin/vendor",    express.static(path.join(__dirname, "admin", "vendor")));
app.use("/uploads/products", express.static(path.join(__dirname, "uploads/products")));

// ── API routes ───────────────────────────────────────────────
app.use("/api", authRoutes);
app.use("/api", productRoutes);
app.use("/api", checkoutRoutes);
app.use("/api", workerRoutes);
app.use("/api", orderRoutes);
app.use("/api", purchaseRoutes);
app.use("/api", vendorRoutes);
app.use("/api", customerRoutes);
app.use("/api", containerRoutes);
app.use("/api", inventoryRoutes);
app.use("/api", profileRoutes);

// ── Page routes ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/customer/:page", (req, res) => {
  const filePath = path.join(__dirname, "customer", `${req.params.page}.html`);
  res.sendFile(filePath, err => { if (err) res.status(404).send("Page not found"); });
});

app.get("/admin/:page", (req, res) => {
  const filePath = path.join(__dirname, "admin", `${req.params.page}.html`);
  res.sendFile(filePath, err => { if (err) res.status(404).send("Page not found"); });
});

app.listen(3000, () => {
  console.log("✅  Server running → http://localhost:3000");
});