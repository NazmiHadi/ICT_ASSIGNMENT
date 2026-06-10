// ─────────────────────────────────────────────────────────────────────────────
// server.js  –  Kurma Ajwa Enterprise (Oracle DB version)
// Run with:  node server.js
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const path    = require("path");
const oracledb = require("oracledb");   // Oracle database driver (npm install oracledb)

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static file serving ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "assets")));
app.use("/vendor",       express.static(path.join(__dirname, "vendor")));
app.use("/css",          express.static(path.join(__dirname, "css")));
app.use("/assets",       express.static(path.join(__dirname, "assets")));
app.use("/admin/vendor", express.static(path.join(__dirname, "admin", "vendor")));
app.use("/admin/assets", express.static(path.join(__dirname, "admin", "assets")));


// ── Oracle DB connection config ────────────────────────────────────────────
// Change these three values to match YOUR Oracle SQL Developer connection.
// You can find them in SQL Developer under:
//   View → Connections → right-click your connection → Properties
const DB_CONFIG = {
  user:          "node_test",           // the Oracle user we created earlier
  password:      "node_test123",        // password for that user
  connectString: "localhost:1521/FREEPDB1"    // host:port/service_name
  //                                    ↑ change XE to your service name if different
  //                                      (common ones: XE, ORCL, XEPDB1, FREEPDB1)
};

// oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT makes every query return
// rows as plain objects ({ COLUMN: value }) instead of arrays ([value, value])
// This makes it much easier to work with in JavaScript
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// ── Helper: get a database connection ─────────────────────────────────────
// We call this inside every API route instead of keeping one connection open.
// Each request opens a connection, does its work, then closes it.
// In a bigger project you would use a connection pool instead.
async function getConnection() {
  return await oracledb.getConnection(DB_CONFIG);
}


// ════════════════════════════════════════════════════════════════════════════
// API ROUTES
// ════════════════════════════════════════════════════════════════════════════

// ── POST /api/register ─────────────────────────────────────────────────────
app.post("/api/register", async (req, res) => {

  const { name, email, phone, username, password, confirmPassword } = req.body;

  // Basic validation
  if (!name || !email || !username || !password || !confirmPassword) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: "Passwords do not match." });
  }

  let conn;   // declare connection variable outside try so we can close it in finally

  try {
    conn = await getConnection();   // open a connection to Oracle

    // ── Check if username already exists ──────────────────────────────────
    // :username is a "bind variable" — Oracle safely substitutes the value
    // without risk of SQL injection (never use string concatenation for this!)
    const checkUser = await conn.execute(
      `SELECT customer_id FROM customers WHERE username = :username`,
      { username }
    );

    // checkUser.rows is an array; if it has any rows the username is taken
    if (checkUser.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Username already taken." });
    }

    // ── Check if email already exists ─────────────────────────────────────
    const checkEmail = await conn.execute(
      `SELECT customer_id FROM customers WHERE email = :email`,
      { email }
    );
    if (checkEmail.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Email already registered." });
    }

    // ── Insert the new customer into Oracle ───────────────────────────────
    // customer_id uses GENERATED ALWAYS AS IDENTITY so we don't provide it.
    // :autoCommit true saves the change immediately (like typing COMMIT; in SQL Developer)
    await conn.execute(
      `INSERT INTO customers (name, email, phone, username, password)
       VALUES (:name, :email, :phone, :username, :password)`,
      { name, email, phone: phone || null, username, password },
      { autoCommit: true }   // commit the transaction so the row is permanently saved
    );

    console.log(`[REGISTER] New customer saved to Oracle: ${username}`);
    return res.status(201).json({ success: true, message: "Account created! Please log in." });

  } catch (err) {
    // ORA-00001 = unique constraint violated (duplicate key)
    // This is a backup check in case two registrations happen at the same time
    if (err.errorNum === 1) {
      return res.status(409).json({ success: false, message: "Username or email already exists." });
    }
    console.error("[REGISTER ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });

  } finally {
    // ALWAYS close the connection, even if an error occurred.
    // 'finally' runs whether or not the try/catch succeeded.
    if (conn) await conn.close();
  }
});


// ── POST /api/login ────────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required." });
  }

  // Admin: still hardcoded (not stored in Oracle)
  if (username === "admin" && password === "admin123") {
    return res.json({ success: true, role: "admin", redirect: "/admin/dashboard" });
  }

  let conn;

  try {
    conn = await getConnection();

    // ── Look up the customer in Oracle ────────────────────────────────────
    // SELECT the row where both username AND password match
    // In production you would store hashed passwords and use bcrypt.compare()
    const result = await conn.execute(
      `SELECT customer_id, name, email, username
       FROM customers
       WHERE username = :username AND password = :password`,
      { username, password }
    );

    if (result.rows.length === 0) {
      // No matching row found → wrong credentials
      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }

    // result.rows[0] is the first (and only) matching row as an object
    const customer = result.rows[0];

    console.log(`[LOGIN] Customer logged in from Oracle: ${customer.USERNAME}`);
    return res.json({
      success: true,
      role: "customer",
      redirect: "/home",
      customer: {
        customer_id: customer.CUSTOMER_ID,  // Oracle returns column names in UPPERCASE
        name:        customer.NAME,
        email:       customer.EMAIL,
        username:    customer.USERNAME
      }
    });

  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error." });

  } finally {
    if (conn) await conn.close();
  }
});


// ── GET /api/products ──────────────────────────────────────────────────────
app.get("/api/products", async (req, res) => {

  let conn;

  try {
    conn = await getConnection();

    // Fetch all products from Oracle
    // ORDER BY product_id keeps the display order consistent
    const result = await conn.execute(
      `SELECT product_id, name, description, price, stock
       FROM products
       ORDER BY product_id`
    );

    // Map each Oracle row to a friendlier camelCase object for the frontend.
    // Oracle returns column names in ALL CAPS, so we rename them here.
    const products = result.rows.map(row => ({
      product_id:  row.PRODUCT_ID,
      name:        row.NAME,
      description: row.DESCRIPTION,
      price:       row.PRICE,
      stock:       row.STOCK,
      // Image filename is derived from the product_id (product_01.jpg, etc.)
      image:       `product_0${row.PRODUCT_ID}.jpg`
    }));

    return res.json({ success: true, products });

  } catch (err) {
    console.error("[PRODUCTS ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load products." });

  } finally {
    if (conn) await conn.close();
  }
});


// ── GET /api/customers  (admin view) ──────────────────────────────────────
app.get("/api/customers", async (req, res) => {

  let conn;

  try {
    conn = await getConnection();

    // Fetch all customers — deliberately exclude the password column
    const result = await conn.execute(
      `SELECT customer_id, name, email, phone, created_at
       FROM customers
       ORDER BY customer_id`
    );

    const customers = result.rows.map(row => ({
      customer_id: row.CUSTOMER_ID,
      name:        row.NAME,
      email:       row.EMAIL,
      phone:       row.PHONE,
      created_at:  row.CREATED_AT
    }));

    return res.json({ success: true, customers });

  } catch (err) {
    console.error("[CUSTOMERS ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load customers." });

  } finally {
    if (conn) await conn.close();
  }
});


// ════════════════════════════════════════════════════════════════════════════
// PAGE ROUTES
// ════════════════════════════════════════════════════════════════════════════

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


// ── Start server ───────────────────────────────────────────────────────────
app.listen(3000, () => {
  console.log("✅  Server running → http://localhost:3000");
  console.log("🔌  Connecting to Oracle at:", DB_CONFIG.connectString);
});