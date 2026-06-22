// routes/purchaseRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection, oracledb } = require("../config/db");

// ── GET /api/purchases/form-data ─────────────────────────────
// Returns vendors, workers and products needed to populate
// the "New Purchase" form dropdowns.
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
      vendors:  vendResult.rows.map(r => ({ vendor_id: r.VENDID,  name: r.VENDNAME })),
      workers:  workResult.rows.map(r => ({ worker_id: r.WORKID,  name: r.WORKNAME })),
      products: prodResult.rows.map(r => ({ product_id: r.PRODID, name: r.PRODNAME, price: r.PRICE }))
    });

  } catch (err) {
    console.error("[PURCHASE FORM-DATA ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load form data." });

  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/purchases ────────────────────────────────────────
// Returns all purchases joined with worker and vendor name,
// plus a summary of products purchased in each purchase.
router.get("/purchases", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    // Main purchase list
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

    // Products per purchase
    const prodResult = await conn.execute(
      `SELECT pp.PurchID,
              pp.ProdID,
              pr.ProdName,
              pp.Qty
         FROM PURCHASE_PRODUCT pp
         LEFT JOIN PRODUCTS pr ON pp.ProdID = pr.ProdID
        ORDER BY pp.PurchID`
    );

    // Group products by PurchID
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
      purchase_id:  row.PURCHID,
      purchase_date: row.PURCHDATE,
      worker_id:    row.WORKID,
      worker_name:  row.WORKNAME,
      vendor_id:    row.VENDID,
      vendor_name:  row.VENDNAME,
      products:     productsByPurch[row.PURCHID] || []
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

  // Validation
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

    // 1. Insert into PURCHASE, get new PurchID
    const purchResult = await conn.execute(
      `INSERT INTO PURCHASE (WorkID, VendID)
       VALUES (:worker_id, :vendor_id)
       RETURNING PurchID INTO :newId`,
      {
        worker_id,
        vendor_id,
        newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );

    const purchId = purchResult.outBinds.newId[0];

    // 2. Insert each product into PURCHASE_PRODUCT
    for (const p of products) {
      await conn.execute(
        `INSERT INTO PURCHASE_PRODUCT (PurchID, ProdID, Qty)
         VALUES (:purchId, :product_id, :qty)`,
        { purchId, product_id: p.product_id, qty: p.qty }
      );
    }

    // 3. Commit everything together
    await conn.commit();

    return res.status(201).json({
      success:     true,
      message:     "Purchase created successfully.",
      purchase_id: purchId
    });

  } catch (err) {
    // Rollback on any error
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error("[PURCHASE POST ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not create purchase." });

  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;
