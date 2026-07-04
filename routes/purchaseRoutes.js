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
// Returns all purchases with worker, vendor and product details.
router.get("/purchases", async (req, res) => {
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
        ORDER BY p.PurchID DESC`
    );

    const prodResult = await conn.execute(
      `SELECT pp.PurchID,
              pp.ProdID,
              pr.ProdName,
              pp.Qty
         FROM PURCHASE_PRODUCT pp
         LEFT JOIN PRODUCTS pr ON pp.ProdID = pr.ProdID
        ORDER BY pp.PurchID`
    );

    const productsByPurch = {};
    prodResult.rows.forEach(row => {
      if (!productsByPurch[row.PURCHID]) productsByPurch[row.PURCHID] = [];
      productsByPurch[row.PURCHID].push({
        product_id:   row.PRODID,
        product_name: row.PRODNAME,
        qty:          row.QTY
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
              pp.Qty
         FROM PURCHASE_PRODUCT pp
         LEFT JOIN PRODUCTS pr ON pp.ProdID = pr.ProdID
        WHERE pp.PurchID = :purchId`,
      { purchId }
    );

    const products = result.rows.map(row => ({
      product_id:   row.PRODID,
      product_name: row.PRODNAME,
      qty:          row.QTY
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
// Add purchased products into their respective containers (INVENTORY).
// Body: { items: [{ product_id, container_id, qty }] }
// Uses MERGE so existing inventory rows are updated, new ones inserted.
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

    // MERGE each item into INVENTORY
    // If (ProdID, ContID) exists → add qty. If not → insert new row.
    for (const item of items) {
      await conn.execute(
        `MERGE INTO INVENTORY inv
         USING DUAL
            ON (inv.ProdID = :product_id AND inv.ContID = :container_id)
          WHEN MATCHED THEN
               UPDATE SET inv.Qty = inv.Qty + :qty
          WHEN NOT MATCHED THEN
               INSERT (ProdID, ContID, Qty)
               VALUES (:product_id, :container_id, :qty)`,
        {
          product_id:   item.product_id,
          container_id: item.container_id,
          qty:          item.qty
        }
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
