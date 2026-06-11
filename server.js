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
  user:          "KurmaAjwa",           // the Oracle user we created earlier
  password:      "oracle",        // password for that user
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

  const { name, email, address, phone, username, password, confirmPassword } = req.body;

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
      `SELECT custid FROM customers WHERE username = :username`,
      { username }
    );

    // checkUser.rows is an array; if it has any rows the username is taken
    if (checkUser.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Username already taken." });
    }

    // ── Check if email already exists ─────────────────────────────────────
    const checkEmail = await conn.execute(
      `SELECT custid FROM customers WHERE custemail = :email`,
      { email }
    );
    if (checkEmail.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Email already registered." });
    }

    // ── Insert the new customer into Oracle ───────────────────────────────
    // customer_id uses GENERATED ALWAYS AS IDENTITY so we don't provide it.
    // :autoCommit true saves the change immediately (like typing COMMIT; in SQL Developer)
    await conn.execute(
      `INSERT INTO customers (custname, custemail, custaddress, custphonenum, username, password)
       VALUES (:name, :email, :address, :phone, :username, :password)`,
      { name, email, address: address || null, phone: phone || null, username, password },
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

  // Admin: hardcoded
  if (username === "admin" && password === "admin123") {
    return res.json({ success: true, role: "admin", redirect: "/admin/dashboard" });
  }

  /*
  // Customer: hardcoded mock data
  if (username === "cust" && password === "cust123") {
    return res.json({ 
      success: true, 
      role: "customer", 
      redirect: "/home",
      customer: {
        customer_id: 999,
        name: "Test Customer",
        email: "customer@test.com",
        username: "cust"
      }
    });
  }
  */
    let conn;
    try {
      conn = await getConnection();
      const result = await conn.execute(
        `SELECT custid, custname, custemail, username
         FROM customers
         WHERE username = :username AND password = :password`,
        { username, password }
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, message: "Invalid username or password." });
      }

      const customer = result.rows[0];
      console.log(`[LOGIN] Customer logged in from Oracle: ${customer.USERNAME}`);
      return res.json({
        success: true,
        role: "customer",
        redirect: "/home",
        customer: {
          customer_id: customer.CUSTID,
          name:        customer.CUSTNAME,
          email:       customer.CUSTEMAIL,
          username:    customer.USERNAME
        }
      });
    } catch (err) {
      console.error("[LOGIN ERROR]", err);
      return res.status(500).json({ success: false, message: "Server error." });
    } finally {
      if (conn) await conn.close();
    }
  

  // Fallback if credentials don't match either hardcoded profile
  return res.status(401).json({ success: false, message: "Invalid username or password." });
});


// ── GET /api/products ──────────────────────────────────────────────────────
app.get("/api/products", async (req, res) => {

  let conn;

  try {
    conn = await getConnection();

    // Get each product joined with its container (via PRODUCTS.ContID)
    // and the stock quantity for that specific product+container pair from INVENTORY.
    // LEFT JOINs are used so products without a container or inventory row still show up.
    const result = await conn.execute(
      `SELECT p.ProdID, p.ProdName, p.ProdDesc, p.SalesPrice, p.ProdType,
              c.ContID, c.ContName,
              i.Qty
       FROM PRODUCTS p
       LEFT JOIN CONTAINERS c ON p.ContID = c.ContID
       LEFT JOIN INVENTORY i ON i.ProdID = p.ProdID AND i.ContID = c.ContID
       ORDER BY p.ProdID`
    );

    // Map each Oracle row to a friendlier camelCase object for the frontend.
    // Oracle returns column names in ALL CAPS, so we rename them here.
    const products = result.rows.map(row => ({
      product_id:    row.PRODID,
      name:          row.PRODNAME,
      description:   row.PRODDESC,
      price:         row.SALESPRICE,
      type:          row.PRODTYPE,

      // Container this product belongs to (from PRODUCTS.ContID)
      container_id:  row.CONTID,
      container:     row.CONTNAME,

      // Stock available in that container; if no INVENTORY row exists, default to 0
      stock:         row.QTY ?? 0,

      // Image filename is derived from the product_id, padded to 2 digits
      // e.g. ProdID 1 -> product_01.jpg, ProdID 12 -> product_12.jpg
      image:         `product_${String(row.PRODID).padStart(2, '0')}.jpg`
    }));

    return res.json({ success: true, products });

  } catch (err) {
    // Log full error server-side for debugging, but don't leak details to the client
    console.error("[PRODUCTS ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load products." });

  } finally {
    // Always release the connection back to the pool, even if an error occurred
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