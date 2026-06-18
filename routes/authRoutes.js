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

  if (username === "admin" && password === "admin123") {
    return res.json({ success: true, role: "admin", redirect: "/admin/dashboard" });
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
      redirect: "/customer/home",
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
});

module.exports = router;