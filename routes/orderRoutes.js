// routes/orderRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection } = require("../config/db");

// ── GET /api/orders/workers ───────────────────────────────────
router.get("/orders/workers", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(`SELECT WorkID, WorkName FROM WORKERS ORDER BY WorkName`);
    const workers = result.rows.map(row => ({ worker_id: row.WORKID, name: row.WORKNAME }));
    return res.json({ success: true, workers });
  } catch (err) {
    console.error("[ORDER WORKERS ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load workers." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/orders ───────────────────────────────────────────
// Returns all orders with customer, worker, and ordered products.
// Used by the Manage Orders page (admin/fulltime — can (re)assign workers).
router.get("/orders", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const orderResult = await conn.execute(
      `SELECT o.OrderID, o.OrderDate, o.CustID, c.CustName, o.WorkID, w.WorkName
         FROM ORDERS o
         LEFT JOIN CUSTOMERS c ON o.CustID = c.CustID
         LEFT JOIN WORKERS   w ON o.WorkID = w.WorkID
        ORDER BY o.OrderID DESC`
    );

    // Get all order products
    const prodResult = await conn.execute(
      `SELECT op.OrderID, op.ProdID, p.ProdName, op.Qty
         FROM ORDER_PRODUCTS op
         LEFT JOIN PRODUCTS p ON op.ProdID = p.ProdID
        ORDER BY op.OrderID`
    );

    // Group products by OrderID
    const productsByOrder = {};
    prodResult.rows.forEach(row => {
      if (!productsByOrder[row.ORDERID]) productsByOrder[row.ORDERID] = [];
      productsByOrder[row.ORDERID].push({
        product_id:   row.PRODID,
        product_name: row.PRODNAME,
        qty:          row.QTY
      });
    });

    const orders = orderResult.rows.map(row => ({
      order_id:      row.ORDERID,
      order_date:    row.ORDERDATE,
      customer_id:   row.CUSTID,
      customer_name: row.CUSTNAME,
      worker_id:     row.WORKID,
      worker_name:   row.WORKNAME,
      products:      productsByOrder[row.ORDERID] || []
    }));

    return res.json({ success: true, orders });
  } catch (err) {
    console.error("[ORDERS GET ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load orders." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/orders/mine?worker_id=123 ────────────────────────
// Returns only the orders assigned to a specific worker.
// Used by the Order Assignment page (fulltime/parttime — view-only).
router.get("/orders/mine", async (req, res) => {
  const workerId = Number(req.query.worker_id);

  if (!workerId) {
    return res.status(400).json({ success: false, message: "worker_id is required." });
  }

  let conn;
  try {
    conn = await getConnection();

    const orderResult = await conn.execute(
      `SELECT o.OrderID, o.OrderDate, o.CustID, c.CustName
         FROM ORDERS o
         LEFT JOIN CUSTOMERS c ON o.CustID = c.CustID
        WHERE o.WorkID = :workerId
        ORDER BY o.OrderID DESC`,
      { workerId }
    );

    if (orderResult.rows.length === 0) {
      return res.json({ success: true, orders: [] });
    }

    const orderIds = orderResult.rows.map(r => r.ORDERID);

    // Build a dynamic bind list for the IN clause
    const binds = {};
    const placeholders = orderIds.map((id, i) => {
      binds[`id${i}`] = id;
      return `:id${i}`;
    }).join(",");

    const prodResult = await conn.execute(
      `SELECT op.OrderID, op.ProdID, p.ProdName, op.Qty
         FROM ORDER_PRODUCTS op
         LEFT JOIN PRODUCTS p ON op.ProdID = p.ProdID
        WHERE op.OrderID IN (${placeholders})
        ORDER BY op.OrderID`,
      binds
    );

    const productsByOrder = {};
    prodResult.rows.forEach(row => {
      if (!productsByOrder[row.ORDERID]) productsByOrder[row.ORDERID] = [];
      productsByOrder[row.ORDERID].push({
        product_id:   row.PRODID,
        product_name: row.PRODNAME,
        qty:          row.QTY
      });
    });

    const orders = orderResult.rows.map(row => ({
      order_id:      row.ORDERID,
      order_date:    row.ORDERDATE,
      customer_id:   row.CUSTID,
      customer_name: row.CUSTNAME,
      products:      productsByOrder[row.ORDERID] || []
    }));

    return res.json({ success: true, orders });
  } catch (err) {
    console.error("[ORDERS MINE ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load your orders." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── PUT /api/orders/:orderId/assign ──────────────────────────
router.put("/orders/:orderId/assign", async (req, res) => {
  const orderId  = Number(req.params.orderId);
  const workerId = req.body.worker_id || null;

  if (!orderId) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }

  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `UPDATE ORDERS SET WorkID = :workerId WHERE OrderID = :orderId`,
      { workerId, orderId },
      { autoCommit: true }
    );
    if (result.rowsAffected === 0) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    return res.json({ success: true, message: "Worker assigned successfully." });
  } catch (err) {
    console.error("[ORDER ASSIGN ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not assign worker." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;