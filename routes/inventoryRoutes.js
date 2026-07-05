// routes/inventoryRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection } = require("../config/db");

// ── GET /api/inventory ───────────────────────────────────────────
// Returns all inventory rows with product, container, and — where
// applicable — the purchase (and vendor) that batch of stock came from.
// Rows with no PurchID were added as a manual stock adjustment rather
// than through the Receive Purchase flow.
router.get("/inventory", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT i.InvID, i.ProdID, p.ProdName, i.ContID, c.ContName, i.Qty,
              i.PurchID, i.DateAssigned,
              v.VendName
         FROM INVENTORY i
         LEFT JOIN PRODUCTS   p ON i.ProdID   = p.ProdID
         LEFT JOIN CONTAINERS c ON i.ContID   = c.ContID
         LEFT JOIN PURCHASE   pu ON i.PurchID = pu.PurchID
         LEFT JOIN VENDORS    v ON pu.VendID  = v.VendID
        ORDER BY p.ProdName, c.ContName, i.DateAssigned`
    );

    const inventory = result.rows.map(row => ({
      inv_id:         row.INVID,
      product_id:     row.PRODID,
      product_name:   row.PRODNAME,
      container_id:   row.CONTID,
      container_name: row.CONTNAME,
      qty:            row.QTY,
      purchase_id:    row.PURCHID,
      vendor_name:    row.VENDNAME,
      date_assigned:  row.DATEASSIGNED,
      source:         row.PURCHID ? `Purchase #${row.PURCHID}` : "Manual adjustment"
    }));

    return res.json({ success: true, inventory });
  } catch (err) {
    console.error("[INVENTORY GET ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load inventory." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── POST /api/inventory ──────────────────────────────────────────
// Body: { product_id, container_id, qty }
// Manual stock adjustment — NOT tied to any purchase (PurchID stays
// NULL). To assign stock that came from a purchase, use
// POST /api/purchases/:purchId/receive instead, which links the
// resulting INVENTORY row back to that purchase.
router.post("/inventory", async (req, res) => {
  const { product_id, container_id, qty } = req.body;

  if (!product_id || !container_id || qty === undefined || qty === null || qty < 0) {
    return res.status(400).json({
      success: false,
      message: "product_id, container_id, and a valid qty (>= 0) are required."
    });
  }

  let conn;
  try {
    conn = await getConnection();

    // PurchID is NULL for manual rows, and Oracle's "=" doesn't match
    // NULL to NULL, so the ON clause uses an explicit NULL check
    // alongside the product/container match.
    await conn.execute(
      `MERGE INTO INVENTORY inv
       USING DUAL
          ON (inv.ProdID = :product_id AND inv.ContID = :container_id AND inv.PurchID IS NULL)
        WHEN MATCHED THEN
             UPDATE SET inv.Qty = :qty, inv.DateAssigned = SYSDATE
        WHEN NOT MATCHED THEN
             INSERT (ProdID, ContID, PurchID, Qty, DateAssigned)
             VALUES (:product_id, :container_id, NULL, :qty, SYSDATE)`,
      { product_id, container_id, qty },
      { autoCommit: true }
    );

    return res.status(201).json({ success: true, message: "Inventory saved successfully." });

  } catch (err) {
    console.error("[INVENTORY POST ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not save inventory." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;