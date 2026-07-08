// routes/inventoryRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection } = require("../config/db");

// ── GET /api/inventory ───────────────────────────────────────────
// Returns inventory TOTALED per product+container. The same product can
// end up in the same container from several different sources (multiple
// purchases received over time, plus a manual adjustment), so this groups
// all of those INVENTORY rows together and sums their Qty into one
// total_qty per product+container, while still listing each underlying
// "batch" (source + its own qty) for display.
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

    // Group individual batch rows (one row per InvID — a specific
    // purchase batch, or the single manual-adjustment row) into one
    // entry per product+container.
    const grouped = {};
    result.rows.forEach(row => {
      const key = `${row.PRODID}-${row.CONTID}`;
      if (!grouped[key]) {
        grouped[key] = {
          product_id:     row.PRODID,
          product_name:   row.PRODNAME,
          container_id:   row.CONTID,
          container_name: row.CONTNAME,
          total_qty:      0,
          last_updated:   row.DATEASSIGNED,
          batches:        []
        };
      }

      const entry = grouped[key];
      entry.total_qty += row.QTY;
      if (new Date(row.DATEASSIGNED) > new Date(entry.last_updated)) {
        entry.last_updated = row.DATEASSIGNED;
      }
      entry.batches.push({
        inv_id:        row.INVID,
        qty:           row.QTY,
        purchase_id:   row.PURCHID,
        vendor_name:   row.VENDNAME,
        date_assigned: row.DATEASSIGNED,
        source:        row.PURCHID ? `Purchase #${row.PURCHID}` : "Manual"
      });
    });

    return res.json({ success: true, inventory: Object.values(grouped) });
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
// NULL). Setting this OVERRIDES the existing manual row's qty rather
// than adding to it (Qty = :qty, not Qty = Qty + :qty) — this row only
// ever represents "the current manual adjustment," separate from
// whatever purchase-linked batches also exist for this product+container.
// To assign stock that came from a purchase, use
// POST /api/purchases/:purchId/receive instead, which links the
// resulting INVENTORY row back to that purchase and adds onto it.
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

// ── POST /api/inventory/remove ────────────────────────────────────
// Body: { product_id, container_id, qty }
// Deducts qty from a product's stock in a container — e.g. spoiled or
// damaged product being written off. Since the total for a product+
// container can be made up of several INVENTORY rows (different
// purchase batches, plus a manual row), this pulls from the OLDEST
// batch(es) first (FIFO by DateAssigned) until qty is fully removed,
// deleting any batch row that gets used down to 0. Fails with a clear
// message if there isn't enough total stock on hand to remove that much.
router.post("/inventory/remove", async (req, res) => {
  const { product_id, container_id, qty } = req.body;
  const removeQty = Number(qty);

  if (!product_id || !container_id || !removeQty || removeQty <= 0) {
    return res.status(400).json({
      success: false,
      message: "product_id, container_id, and a valid qty (> 0) are required."
    });
  }

  let conn;
  try {
    conn = await getConnection();

    // Lock every batch row for this product+container, oldest first, so
    // two simultaneous removals can't both deduct from the same units.
    const batches = await conn.execute(
      `SELECT InvID, Qty
         FROM INVENTORY
        WHERE ProdID = :product_id AND ContID = :container_id
        ORDER BY DateAssigned
        FOR UPDATE`,
      { product_id, container_id }
    );

    const totalAvailable = batches.rows.reduce((sum, r) => sum + r.QTY, 0);

    if (removeQty > totalAvailable) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `Only ${totalAvailable} unit(s) of this product are on hand in that container.`
      });
    }

    let remaining = removeQty;
    for (const row of batches.rows) {
      if (remaining <= 0) break;
      const take   = Math.min(remaining, row.QTY);
      const newQty = row.QTY - take;

      if (newQty === 0) {
        await conn.execute(`DELETE FROM INVENTORY WHERE InvID = :invId`, { invId: row.INVID });
      } else {
        await conn.execute(
          `UPDATE INVENTORY SET Qty = :newQty WHERE InvID = :invId`,
          { newQty, invId: row.INVID }
        );
      }
      remaining -= take;
    }

    await conn.commit();

    return res.json({ success: true, message: `Removed ${removeQty} unit(s) from stock.` });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error("[INVENTORY REMOVE ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not remove stock." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;