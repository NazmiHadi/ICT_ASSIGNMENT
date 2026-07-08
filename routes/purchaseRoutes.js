// routes/purchaseRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection, oracledb } = require("../config/db");

// ── GET /api/purchases/form-data ─────────────────────────────
// Returns vendors, workers and products for the New Purchase form.
router.get("/purchases/form-data", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const [vendResult, workResult, prodResult] = await Promise.all([
      conn.execute(`SELECT VendID, VendName FROM VENDORS ORDER BY VendName`),
      conn.execute(`SELECT WorkID, WorkName FROM WORKERS ORDER BY WorkName`),
      conn.execute(`SELECT ProdID, ProdName, Price FROM PRODUCTS ORDER BY ProdName`)
    ]);

    return res.json({
      success:  true,
      vendors:  vendResult.rows.map(r => ({ vendor_id: r.VENDID,   name: r.VENDNAME })),
      workers:  workResult.rows.map(r => ({ worker_id: r.WORKID,   name: r.WORKNAME })),
      products: prodResult.rows.map(r => ({ product_id: r.PRODID,  name: r.PRODNAME, price: r.PRICE }))
    });

  } catch (err) {
    console.error("[PURCHASE FORM-DATA ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load form data." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/purchases ────────────────────────────────────────
// Returns purchases with worker, vendor and product details.
// Optional ?vendor_id=... restricts results to that vendor only — used
// by the vendor-role Purchase History tab so a vendor only ever sees
// their own transactions with us, never other vendors' purchases.
router.get("/purchases", async (req, res) => {
  const vendorId = req.query.vendor_id ? Number(req.query.vendor_id) : null;

  let conn;
  try {
    conn = await getConnection();

    const purchResult = await conn.execute(
      `SELECT p.PurchID,
              p.PurchDate,
              p.WorkID,
              w.WorkName,
              p.VendID,
              v.VendName
         FROM PURCHASE p
         LEFT JOIN WORKERS w ON p.WorkID = w.WorkID
         LEFT JOIN VENDORS v ON p.VendID = v.VendID
        ${vendorId ? "WHERE p.VendID = :vendorId" : ""}
        ORDER BY p.PurchID DESC`,
      vendorId ? { vendorId } : {}
    );

    const prodResult = await conn.execute(
      `SELECT pp.PurchID,
              pp.ProdID,
              pr.ProdName,
              pp.Qty,
              pp.QtyReceived
         FROM PURCHASE_PRODUCT pp
         LEFT JOIN PRODUCTS pr ON pp.ProdID = pr.ProdID
        ORDER BY pp.PurchID`
    );

    const productsByPurch = {};
    prodResult.rows.forEach(row => {
      if (!productsByPurch[row.PURCHID]) productsByPurch[row.PURCHID] = [];
      productsByPurch[row.PURCHID].push({
        product_id:    row.PRODID,
        product_name:  row.PRODNAME,
        qty:           row.QTY,
        qty_received:  row.QTYRECEIVED,
        qty_remaining: row.QTY - row.QTYRECEIVED
      });
    });

    const purchases = purchResult.rows.map(row => ({
      purchase_id:   row.PURCHID,
      purchase_date: row.PURCHDATE,
      worker_id:     row.WORKID,
      worker_name:   row.WORKNAME,
      vendor_id:     row.VENDID,
      vendor_name:   row.VENDNAME,
      products:      productsByPurch[row.PURCHID] || []
    }));

    return res.json({ success: true, purchases });

  } catch (err) {
    console.error("[PURCHASES GET ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load purchases." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── POST /api/purchases ───────────────────────────────────────
// Create a new purchase order with one or more products.
// Body: { worker_id, vendor_id, products: [{ product_id, qty }] }
// worker_id is the currently logged-in worker (sent by the frontend from
// localStorage's userId) — the form no longer asks the user to pick a
// worker from a dropdown.
router.post("/purchases", async (req, res) => {
  const { worker_id, vendor_id, products } = req.body;

  if (!worker_id || !vendor_id) {
    return res.status(400).json({ success: false, message: "Worker and vendor are required." });
  }
  if (!products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ success: false, message: "At least one product is required." });
  }
  for (const p of products) {
    if (!p.product_id || !p.qty || p.qty <= 0) {
      return res.status(400).json({ success: false, message: "Each product must have a valid product_id and qty > 0." });
    }
  }

  let conn;
  try {
    conn = await getConnection();

    const purchResult = await conn.execute(
      `INSERT INTO PURCHASE (WorkID, VendID)
       VALUES (:worker_id, :vendor_id)
       RETURNING PurchID INTO :newId`,
      {
        worker_id, vendor_id,
        newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );

    const purchId = purchResult.outBinds.newId[0];

    for (const p of products) {
      await conn.execute(
        `INSERT INTO PURCHASE_PRODUCT (PurchID, ProdID, Qty)
         VALUES (:purchId, :product_id, :qty)`,
        { purchId, product_id: p.product_id, qty: p.qty }
      );
    }

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Purchase created successfully.",
      purchase_id: purchId
    });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error("[PURCHASE POST ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not create purchase." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/purchases/:purchId/products ─────────────────────
// Returns products in a specific purchase (for the receive form).
router.get("/purchases/:purchId/products", async (req, res) => {
  const purchId = Number(req.params.purchId);
  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT pp.ProdID,
              pr.ProdName,
              pp.Qty,
              pp.QtyReceived
         FROM PURCHASE_PRODUCT pp
         LEFT JOIN PRODUCTS pr ON pp.ProdID = pr.ProdID
        WHERE pp.PurchID = :purchId`,
      { purchId }
    );

    const products = result.rows.map(row => ({
      product_id:    row.PRODID,
      product_name:  row.PRODNAME,
      qty:           row.QTY,
      qty_received:  row.QTYRECEIVED,
      qty_remaining: row.QTY - row.QTYRECEIVED
    }));

    return res.json({ success: true, products });

  } catch (err) {
    console.error("[PURCHASE PRODUCTS ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load purchase products." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/purchases/containers ────────────────────────────
// Returns all containers for the receive form dropdown.
router.get("/purchases/containers", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT ContID, ContName FROM CONTAINERS ORDER BY ContName`
    );

    const containers = result.rows.map(row => ({
      container_id:   row.CONTID,
      container_name: row.CONTNAME
    }));

    return res.json({ success: true, containers });

  } catch (err) {
    console.error("[CONTAINERS ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load containers." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── POST /api/purchases/:purchId/receive ─────────────────────
// Assign purchased products into their respective containers (INVENTORY),
// recording WHICH purchase each batch of stock came from.
//
// Body: { items: [{ product_id, container_id, qty }] }
//
// A purchase line can be received across multiple separate calls (e.g.
// different days) — each call can only assign up to what's still
// remaining on that line (Qty - QtyReceived), so the same purchased
// stock can never be assigned into inventory twice. If EVERY line on
// the purchase has already been fully received, the whole request is
// rejected up front — this is the server-side backstop for the
// frontend hiding fully-received purchases from the receive dropdown.
router.post("/purchases/:purchId/receive", async (req, res) => {
  const purchId = Number(req.params.purchId);
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "No items provided." });
  }
  for (const item of items) {
    if (!item.product_id || !item.container_id || !item.qty || item.qty <= 0) {
      return res.status(400).json({ success: false, message: "Each item needs product_id, container_id, and qty > 0." });
    }
  }

  let conn;
  try {
    conn = await getConnection();

    // Verify purchase exists
    const check = await conn.execute(
      `SELECT PurchID FROM PURCHASE WHERE PurchID = :purchId`,
      { purchId }
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Purchase not found." });
    }

    // Reject outright if every line on this purchase has already been
    // fully received.
    const remainingCheck = await conn.execute(
      `SELECT COUNT(*) AS REMAINING_LINES
         FROM PURCHASE_PRODUCT
        WHERE PurchID = :purchId AND Qty > QtyReceived`,
      { purchId }
    );
    if (remainingCheck.rows[0].REMAINING_LINES === 0) {
      return res.status(400).json({
        success: false,
        message: `Purchase #${purchId} has already been fully received.`
      });
    }

    for (const item of items) {
      // Lock the purchase line and check how much is actually left to
      // receive, so two people (or the same person twice) can't
      // over-assign more than was actually purchased.
      const lineResult = await conn.execute(
        `SELECT Qty, QtyReceived
           FROM PURCHASE_PRODUCT
          WHERE PurchID = :purchId AND ProdID = :product_id
          FOR UPDATE`,
        { purchId, product_id: item.product_id }
      );

      if (lineResult.rows.length === 0) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Product ${item.product_id} is not part of purchase #${purchId}.`
        });
      }

      const { QTY: lineQty, QTYRECEIVED: lineReceived } = lineResult.rows[0];
      const remaining = lineQty - lineReceived;

      if (item.qty > remaining) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Only ${remaining} unit(s) of product ${item.product_id} are still left to receive from purchase #${purchId}.`
        });
      }

      // Assign this batch into INVENTORY, tagged with the purchase it
      // came from. If some of this same purchase was already assigned
      // into this exact container before (e.g. yesterday), top up that
      // row's Qty instead of creating a duplicate.
      await conn.execute(
        `MERGE INTO INVENTORY inv
         USING (SELECT :product_id AS ProdID, :container_id AS ContID, :purch_id AS PurchID FROM DUAL) src
            ON (inv.ProdID = src.ProdID AND inv.ContID = src.ContID AND inv.PurchID = src.PurchID)
          WHEN MATCHED THEN
               UPDATE SET inv.Qty = inv.Qty + :qty, inv.DateAssigned = SYSDATE
          WHEN NOT MATCHED THEN
               INSERT (ProdID, ContID, PurchID, Qty, DateAssigned)
               VALUES (src.ProdID, src.ContID, src.PurchID, :qty, SYSDATE)`,
        {
          product_id:   item.product_id,
          container_id: item.container_id,
          purch_id:     purchId,
          qty:          item.qty
        }
      );

      // Record how much of this purchase line has now been received in total.
      await conn.execute(
        `UPDATE PURCHASE_PRODUCT
            SET QtyReceived = QtyReceived + :qty
          WHERE PurchID = :purchId AND ProdID = :product_id`,
        { qty: item.qty, purchId, product_id: item.product_id }
      );
    }

    await conn.commit();

    return res.json({ success: true, message: "Products added to inventory successfully." });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error("[RECEIVE ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not update inventory." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;