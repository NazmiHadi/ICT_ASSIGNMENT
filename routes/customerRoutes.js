const express = require("express");
const router  = express.Router();
const { getConnection } = require("../config/db");

// ── GET /api/customers ──────────────────────────────────────────────────────
//
// Returns ALL customers (read-only directory for the admin "Manage Customers"
// page). Password is intentionally NEVER selected/returned here — customers
// manage their own credentials via sign-up/login, admin should never see it.
//
router.get("/customers", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT CustID, CustName, CustEmail, CustPhoneNum, CustAddress, username
       FROM   CUSTOMERS
       ORDER  BY CustID`
    );

    const customers = result.rows.map(row => ({
      customer_id: row.CUSTID,
      name:        row.CUSTNAME,
      email:       row.CUSTEMAIL,
      phone:       row.CUSTPHONENUM,
      address:     row.CUSTADDRESS,
      username:    row.USERNAME
    }));

    return res.json({ success: true, customers });

  } catch (err) {
    console.error("[CUSTOMERS LIST ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load customers." });

  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/customer/profile?customer_id=... ─────────────────────────────────
//
// Returns the full customer record for the given customer_id.
//
// REUSABLE: this endpoint is intentionally generic — it accepts any customer_id
// as a query parameter, so both the customer-facing profile page and the admin
// orders page can call it to look up customer details without duplicating code.
//
//   Customer profile page  → passes the logged-in customer's own ID
//   Admin orders page      → passes any customer's ID to display their info
//                            when an admin clicks on an order
//
// Response shape:
//   { success: true,  customer: { id, name, email, phone, address, username } }
//   { success: false, message: "..." }
//
router.get("/customer/profile", async (req, res) => {
  const { customer_id } = req.query;

  if (!customer_id) {
    return res.status(400).json({ success: false, message: "customer_id is required." });
  }

  let conn;

  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT CustID,
              CustName,
              CustEmail,
              CustPhoneNum,
              CustAddress,
              username
       FROM   CUSTOMERS
       WHERE  CustID = :custId`,
      { custId: customer_id }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Customer not found." });
    }

    const row = result.rows[0];

    return res.json({
      success:  true,
      customer: {
        id:       row.CUSTID,
        name:     row.CUSTNAME,
        email:    row.CUSTEMAIL,
        phone:    row.CUSTPHONENUM,
        address:  row.CUSTADDRESS,
        username: row.USERNAME
      }
    });

  } catch (err) {
    console.error("[CUSTOMER PROFILE ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });

  } finally {
    if (conn) await conn.close();
  }
});

// ── PUT /api/customer/profile ──────────────────────────────────────────────
//
// Lets a logged-in customer update their own details.
// Body: { customer_id, name, email, phone, address, username, password?, confirmPassword? }
//
// Password fields are optional — only checked/updated if the customer typed
// something into the "New Password" field on the profile form.
//
router.put("/customer/profile", async (req, res) => {
  const { customer_id, name, email, phone, address, username, password, confirmPassword } = req.body;

  if (!customer_id) {
    return res.status(400).json({ success: false, message: "customer_id is required." });
  }
  if (!name || !email || !username) {
    return res.status(400).json({ success: false, message: "Name, email, and username are required." });
  }
  if (password || confirmPassword) {
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }
  }

  let conn;

  try {
    conn = await getConnection();

    // Make sure the new username/email isn't already taken by someone else
    const conflict = await conn.execute(
      `SELECT CustID FROM CUSTOMERS
        WHERE (username = :username OR CustEmail = :email)
          AND CustID != :custId`,
      { username, email, custId: customer_id }
    );
    if (conflict.rows.length > 0) {
      return res.status(409).json({ success: false, message: "That username or email is already in use." });
    }

    if (password) {
      await conn.execute(
        `UPDATE CUSTOMERS
            SET CustName = :name, CustEmail = :email, CustPhoneNum = :phone,
                CustAddress = :address, username = :username, password = :password
          WHERE CustID = :custId`,
        { name, email, phone: phone || null, address: address || null, username, password, custId: customer_id },
        { autoCommit: true }
      );
    } else {
      await conn.execute(
        `UPDATE CUSTOMERS
            SET CustName = :name, CustEmail = :email, CustPhoneNum = :phone,
                CustAddress = :address, username = :username
          WHERE CustID = :custId`,
        { name, email, phone: phone || null, address: address || null, username, custId: customer_id },
        { autoCommit: true }
      );
    }

    return res.json({
      success: true,
      message: "Profile updated successfully.",
      customer: { customer_id: Number(customer_id), name, email, phone, address, username }
    });

  } catch (err) {
    if (err.errorNum === 1) {
      return res.status(409).json({ success: false, message: "That username or email is already in use." });
    }
    console.error("[CUSTOMER PROFILE UPDATE ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });

  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;