// routes/inventoryRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection } = require("../config/db");

// ── GET /api/inventory ───────────────────────────────────────────
// Returns all inventory rows with product and container names joined in.
router.get("/inventory", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT i.ProdID, p.ProdName, i.ContID, c.ContName, i.Qty
         FROM INVENTORY i
         LEFT JOIN PRODUCTS   p ON i.ProdID = p.ProdID
         LEFT JOIN CONTAINERS c ON i.ContID = c.ContID
        ORDER BY p.ProdName, c.ContName`
    );

    const inventory = result.rows.map(row => ({
      product_id:     row.PRODID,
      product_name:   row.PRODNAME,
      container_id:   row.CONTID,
      container_name: row.CONTNAME,
      qty:            row.QTY
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
// INVENTORY has a composite primary key (ProdID, ContID), so this is
// an upsert: if the combo already exists, overwrite Qty; otherwise insert.
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

    await conn.execute(
      `MERGE INTO INVENTORY inv
       USING DUAL
          ON (inv.ProdID = :product_id AND inv.ContID = :container_id)
        WHEN MATCHED THEN
             UPDATE SET inv.Qty = :qty
        WHEN NOT MATCHED THEN
             INSERT (ProdID, ContID, Qty)
             VALUES (:product_id, :container_id, :qty)`,
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
