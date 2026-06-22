// routes/orderRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection } = require("../config/db");

// ── GET /api/orders/workers ───────────────────────────────────
// Returns workers list for the assign-worker dropdown.
// Must be declared BEFORE /api/orders/:orderId to avoid route conflict.
router.get("/orders/workers", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT WorkID, WorkName FROM WORKERS ORDER BY WorkName`
    );

    const workers = result.rows.map(row => ({
      worker_id: row.WORKID,
      name:      row.WORKNAME
    }));

    return res.json({ success: true, workers });

  } catch (err) {
    console.error("[ORDER WORKERS ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load workers." });

  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/orders ───────────────────────────────────────────
// Returns all orders joined with customer name and assigned worker name.
router.get("/orders", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT o.OrderID,
              o.OrderDate,
              o.CustID,
              c.CustName,
              o.WorkID,
              w.WorkName
         FROM ORDERS o
         LEFT JOIN CUSTOMERS c ON o.CustID  = c.CustID
         LEFT JOIN WORKERS   w ON o.WorkID  = w.WorkID
        ORDER BY o.OrderID DESC`
    );

    const orders = result.rows.map(row => ({
      order_id:      row.ORDERID,
      order_date:    row.ORDERDATE,
      customer_id:   row.CUSTID,
      customer_name: row.CUSTNAME,
      worker_id:     row.WORKID,
      worker_name:   row.WORKNAME
    }));

    return res.json({ success: true, orders });

  } catch (err) {
    console.error("[ORDERS GET ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load orders." });

  } finally {
    if (conn) await conn.close();
  }
});

// ── PUT /api/orders/:orderId/assign ──────────────────────────
// Assign (or unassign) a single worker to an order.
// Body: { worker_id }  -- pass null/empty string to unassign
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
