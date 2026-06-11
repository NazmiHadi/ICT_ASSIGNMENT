const express = require("express");
const path    = require("path");

const authRoutes     = require("./routes/authRoutes");
const productRoutes  = require("./routes/productRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "assets")));
app.use("/vendor",       express.static(path.join(__dirname, "vendor")));
app.use("/css",          express.static(path.join(__dirname, "css")));
app.use("/assets",       express.static(path.join(__dirname, "assets")));
app.use("/admin/vendor", express.static(path.join(__dirname, "admin", "vendor")));
app.use("/admin/assets", express.static(path.join(__dirname, "admin", "assets")));

// ── Mount API routes (all under /api) ───────────────────────
app.use("/api", authRoutes);
app.use("/api", productRoutes);
app.use("/api", checkoutRoutes);

// ── Page routes ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/admin/:page", (req, res) => {
  const filePath = path.join(__dirname, "admin", `${req.params.page}.html`);
  res.sendFile(filePath, err => { if (err) res.status(404).send("Page not found"); });
});

app.get("/:page", (req, res) => {
  const filePath = path.join(__dirname, `${req.params.page}.html`);
  res.sendFile(filePath, err => { if (err) res.status(404).send("Page not found"); });
});

app.listen(3000, () => {
  console.log("✅  Server running → http://localhost:3000");
});