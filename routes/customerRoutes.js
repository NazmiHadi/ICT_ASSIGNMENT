const express = require("express");
const router  = express.Router();
const { getConnection } = require("../config/db");

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

module.exports = router;