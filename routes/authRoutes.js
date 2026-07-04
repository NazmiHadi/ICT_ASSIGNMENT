const express = require("express");
const router = express.Router();
const { getConnection } = require("../config/db");

// ── POST /api/register ──────────────────────────────────────
router.post("/register", async (req, res) => {
  const { name, email, address, phone, username, password, confirmPassword } = req.body;

  if (!name || !email || !username || !password || !confirmPassword) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: "Passwords do not match." });
  }

  let conn;
  try {
    conn = await getConnection();

    const checkUser = await conn.execute(
      `SELECT custid FROM customers WHERE username = :username`,
      { username }
    );
    if (checkUser.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Username already taken." });
    }

    const checkEmail = await conn.execute(
      `SELECT custid FROM customers WHERE custemail = :email`,
      { email }
    );
    if (checkEmail.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Email already registered." });
    }

    await conn.execute(
      `INSERT INTO customers (custname, custemail, custaddress, custphonenum, username, password)
       VALUES (:name, :email, :address, :phone, :username, :password)`,
      { name, email, address: address || null, phone: phone || null, username, password },
      { autoCommit: true }
    );

    console.log(`[REGISTER] New customer saved to Oracle: ${username}`);
    return res.status(201).json({ success: true, message: "Account created! Please log in." });

  } catch (err) {
    if (err.errorNum === 1) {
      return res.status(409).json({ success: false, message: "Username or email already exists." });
    }
    console.error("[REGISTER ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });

  } finally {
    if (conn) await conn.close();
  }
});

// ── POST /api/login ─────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required." });
  }

  // ╔═══════════════════════════════════════════════════════════════════╗
  // ║  DEBUG / LOCAL HARDCODED CREDENTIALS                              ║
  // ║  Delete or comment out this whole block before going to staging  ║
  // ║  or production — these bypass the database entirely.             ║
  // ║  NOTE: work_id/vendor_id values below are placeholders (1) so    ║
  // ║  that /api/profile and /api/orders/mine have something to query  ║
  // ║  against locally. They will only resolve to real rows if a       ║
  // ║  WORKID=1 / VENDID=1 record actually exists in your dev DB.      ║
  // ╚═══════════════════════════════════════════════════════════════════╝
  // -- DEBUG BLOCK START --
  if (username === "admin" && password === "admin123") {
    return res.json({ success: true, role: "admin", work_id: 1, redirect: "/admin/dashboard" });
  }
  if (username === "fulltime" && password === "full123") {
    return res.json({ success: true, role: "fulltime", work_id: 1, redirect: "/admin/dashboard" });
  }
  if (username === "parttime" && password === "part123") {
    return res.json({ success: true, role: "parttime", work_id: 1, redirect: "/admin/dashboard" });
  }
  if (username === "vendor" && password === "vendor123") {
    return res.json({ success: true, role: "vendor", vendor_id: 1, redirect: "/admin/dashboard" });
  }
  if (username === "cust" && password === "cust123") {
    return res.json({
      success: true,
      role: "customer",
      redirect: "/customer/home",
      customer: {
        customer_id: 1,
        name: "cust",
        email: "cust@example.com",
        username: "cust"
      }
    });
  }
  // -- DEBUG BLOCK END --

  let conn;
  try {
    conn = await getConnection();

    // ── 1. Try WORKERS first (covers manager / full-time / part-time) ──
    const workerResult = await conn.execute(
      `SELECT w.WorkID, w.WorkName, w.username, w.IsManager,
              ft.WorkID AS FT_ID,
              pt.WorkID AS PT_ID
       FROM WORKERS w
       LEFT JOIN FULL_TIME_WORKERS ft ON ft.WorkID = w.WorkID
       LEFT JOIN PART_TIME_WORKERS pt ON pt.WorkID = w.WorkID
       WHERE w.username = :username AND w.password = :password`,
      { username, password }
    );

    if (workerResult.rows.length > 0) {
      const worker = workerResult.rows[0];

      let role;
      if (worker.ISMANAGER === 1) {
        role = "admin";
      } else if (worker.FT_ID !== null && worker.FT_ID !== undefined) {
        role = "fulltime";
      } else if (worker.PT_ID !== null && worker.PT_ID !== undefined) {
        role = "parttime";
      } else {
        // Worker exists but isn't flagged as manager and has no
        // full-time/part-time pay row. Misconfigured record — block login
        // rather than guessing a role.
        console.error(`[LOGIN] Worker ${username} has no role mapping (not manager, not in FT/PT tables).`);
        return res.status(403).json({
          success: false,
          message: "Your account is missing an employment type. Contact an admin."
        });
      }

      console.log(`[LOGIN] Worker logged in from Oracle: ${worker.USERNAME} (${role})`);
      return res.json({
        success: true,
        role,
        work_id: worker.WORKID,
        name: worker.WORKNAME,
        username: worker.USERNAME,
        redirect: "/admin/dashboard"
      });
    }

    // ── 2. Try VENDORS ──────────────────────────────────────────────────
    const vendorResult = await conn.execute(
      `SELECT VendID, VendName, username
       FROM VENDORS
       WHERE username = :username AND password = :password`,
      { username, password }
    );

    if (vendorResult.rows.length > 0) {
      const vendor = vendorResult.rows[0];
      console.log(`[LOGIN] Vendor logged in from Oracle: ${vendor.USERNAME}`);
      return res.json({
        success: true,
        role: "vendor",
        vendor_id: vendor.VENDID,
        redirect: "/admin/dashboard",
        vendor: {
          vendor_id: vendor.VENDID,
          name: vendor.VENDNAME,
          username: vendor.USERNAME
        }
      });
    }

    // ── 3. Try CUSTOMERS ────────────────────────────────────────────────
    const customerResult = await conn.execute(
      `SELECT custid, custname, custemail, username
       FROM customers
       WHERE username = :username AND password = :password`,
      { username, password }
    );

    if (customerResult.rows.length > 0) {
      const customer = customerResult.rows[0];
      console.log(`[LOGIN] Customer logged in from Oracle: ${customer.USERNAME}`);
      return res.json({
        success: true,
        role: "customer",
        customer_id: customer.CUSTID,
        redirect: "/customer/home",
        customer: {
          customer_id: customer.CUSTID,
          name:        customer.CUSTNAME,
          email:       customer.CUSTEMAIL,
          username:    customer.USERNAME
        }
      });
    }

    // ── 4. Nothing matched ───────────────────────────────────────────────
    return res.status(401).json({ success: false, message: "Invalid username or password." });

  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;