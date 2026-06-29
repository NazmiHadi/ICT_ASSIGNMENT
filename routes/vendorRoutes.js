// routes/vendorRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection, oracledb } = require("../config/db");

// ── GET /api/vendors ──────────────────────────────────────────
router.get("/vendors", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT VendID, VendName, VendAddress, VendPhoneNum FROM VENDORS ORDER BY VendID`
    );
    const vendors = result.rows.map(row => ({
      vendor_id:   row.VENDID,
      name:        row.VENDNAME,
      address:     row.VENDADDRESS,
      phone:       row.VENDPHONENUM
    }));
    return res.json({ success: true, vendors });
  } catch (err) {
    console.error("[VENDORS GET ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load vendors." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── POST /api/vendors ─────────────────────────────────────────
// Body: { name, address, phone }
router.post("/vendors", async (req, res) => {
  const { name, address, phone } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: "Vendor name is required." });
  }
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `INSERT INTO VENDORS (VendName, VendAddress, VendPhoneNum)
       VALUES (:name, :address, :phone)
       RETURNING VendID INTO :newId`,
      {
        name, address: address || null, phone: phone || null,
        newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: true }
    );
    return res.status(201).json({
      success: true,
      message: "Vendor added successfully.",
      vendor_id: result.outBinds.newId[0]
    });
  } catch (err) {
    console.error("[VENDORS POST ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not add vendor." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;
