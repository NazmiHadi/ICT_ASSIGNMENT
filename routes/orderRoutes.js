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

// ── GET /api/orders/unassigned-count ──────────────────────────
// Count of orders with no worker assigned yet. Powers the notification
// badge on the "Manage Orders" nav item (admin/fulltime).
router.get("/orders/unassigned-count", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT COUNT(*) AS CNT FROM ORDERS WHERE WorkID IS NULL`
    );
    return res.json({ success: true, count: result.rows[0].CNT });
  } catch (err) {
    console.error("[ORDERS UNASSIGNED COUNT ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load count." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/orders/pending-count?worker_id=123 ───────────────
// Returns two counts for this worker's assigned orders, used to power the
// two-color notification badge on "My Assigned Orders":
//   not_shipped_count   -> OrderStatus = 'Processing'  (needs Ship)   -> RED
//   not_delivered_count -> OrderStatus = 'In Delivery' (needs Deliver)-> YELLOW
// `count` is kept for backward compatibility and mirrors not_shipped_count.
router.get("/orders/pending-count", async (req, res) => {
  const workerId = Number(req.query.worker_id);

  if (!workerId) {
    return res.status(400).json({ success: false, message: "worker_id is required." });
  }

  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT
         SUM(CASE WHEN OrderStatus = 'Processing'  THEN 1 ELSE 0 END) AS NOT_SHIPPED,
         SUM(CASE WHEN OrderStatus = 'In Delivery' THEN 1 ELSE 0 END) AS NOT_DELIVERED
         FROM ORDERS
        WHERE WorkID = :workerId`,
      { workerId }
    );

    const row = result.rows[0] || {};
    const notShipped   = Number(row.NOT_SHIPPED)   || 0;
    const notDelivered = Number(row.NOT_DELIVERED) || 0;

    return res.json({
      success: true,
      count: notShipped, // legacy field
      not_shipped_count: notShipped,
      not_delivered_count: notDelivered
    });
  } catch (err) {
    console.error("[ORDERS PENDING COUNT ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load count." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/orders ───────────────────────────────────────────
// Returns orders with customer, worker, tracking/status, and ordered products.
// Used by the Manage Orders page (admin/fulltime — can (re)assign workers).
//
// Optional ?customer_id=... restricts down to one customer's orders — this lets
// the same endpoint serve the customer-facing profile/orders pages, which
// were calling /api/orders?customer_id=... but this route previously ignored
// that param and returned every order in the system. See note at the bottom
// of this file about that.
router.get("/orders", async (req, res) => {
  const customerId = req.query.customer_id ? Number(req.query.customer_id) : null;

  let conn;
  try {
    conn = await getConnection();

    const orderResult = await conn.execute(
      `SELECT o.OrderID, o.OrderDate, o.TrackingNo, o.OrderStatus,
              o.CustID, c.CustName, o.WorkID, w.WorkName
         FROM ORDERS o
         LEFT JOIN CUSTOMERS c ON o.CustID = c.CustID
         LEFT JOIN WORKERS   w ON o.WorkID = w.WorkID
        ${customerId ? "WHERE o.CustID = :customerId" : ""}
        ORDER BY o.OrderID DESC`,
      customerId ? { customerId } : {}
    );

    // Get products for these orders (joined with PRODUCTS for name + price,
    // so line totals can be computed — there's no image column in PRODUCTS
    // in the current schema, see note at the bottom of this file)
    const orderIds = orderResult.rows.map(r => r.ORDERID);
    let productsByOrder = {};

    if (orderIds.length) {
      const binds = {};
      const placeholders = orderIds.map((id, i) => {
        binds[`id${i}`] = id;
        return `:id${i}`;
      }).join(",");

      const prodResult = await conn.execute(
        `SELECT op.OrderID, op.ProdID, p.ProdName, p.SalesPrice, p.Price, p.ImageFileName, op.Qty
           FROM ORDER_PRODUCTS op
           LEFT JOIN PRODUCTS p ON op.ProdID = p.ProdID
          WHERE op.OrderID IN (${placeholders})
          ORDER BY op.OrderID`,
        binds
      );

      prodResult.rows.forEach(row => {
        const unitPrice = row.SALESPRICE ?? row.PRICE ?? 0;
        if (!productsByOrder[row.ORDERID]) productsByOrder[row.ORDERID] = [];
        productsByOrder[row.ORDERID].push({
          product_id:   row.PRODID,
          product_name: row.PRODNAME,
          qty:          row.QTY,
          price:        unitPrice,
          line_total:   unitPrice * row.QTY,
          // Real uploaded image path, or null — see productRoutes.js
          image_url:    row.IMAGEFILENAME ? `/uploads/products/${row.IMAGEFILENAME}` : null
        });
      });
    }

    const orders = orderResult.rows.map(row => ({
      order_id:      row.ORDERID,
      order_date:    row.ORDERDATE,
      tracking_no:   row.TRACKINGNO,
      status:        row.ORDERSTATUS,
      customer_id:   row.CUSTID,
      customer_name: row.CUSTNAME,
      worker_id:     row.WORKID,
      worker_name:   row.WORKNAME,
      products:      productsByOrder[row.ORDERID] || [],
      total: (productsByOrder[row.ORDERID] || []).reduce((sum, p) => sum + p.line_total, 0)
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
// Used by the Order Assignment page (fulltime/parttime — view-only, but can
// use the ship/status endpoints below once assigned).
router.get("/orders/mine", async (req, res) => {
  const workerId = Number(req.query.worker_id);

  if (!workerId) {
    return res.status(400).json({ success: false, message: "worker_id is required." });
  }

  let conn;
  try {
    conn = await getConnection();

    const orderResult = await conn.execute(
      `SELECT o.OrderID, o.OrderDate, o.TrackingNo, o.OrderStatus, o.CustID, c.CustName
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
      tracking_no:   row.TRACKINGNO,
      status:        row.ORDERSTATUS,
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
// Manager assigns (or reassigns) a worker to an unassigned order.
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

// ── PUT /api/orders/:orderId/ship ────────────────────────────
// The assigned worker presses "Ship" and types in the tracking number
// the delivery company gave them (couriers issue their own tracking
// numbers — we can't generate one on our end that would actually
// resolve on the courier's tracking page). Body: { worker_id, tracking_no }.
// Only allowed once a worker is assigned and the order hasn't already
// been shipped.
router.put("/orders/:orderId/ship", async (req, res) => {
  const orderId    = Number(req.params.orderId);
  const workerId   = req.body.worker_id ? Number(req.body.worker_id) : null;
  const trackingNo = req.body.tracking_no ? String(req.body.tracking_no).trim() : "";

  if (!orderId) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }

  if (!trackingNo) {
    return res.status(400).json({ success: false, message: "A tracking number from the delivery company is required to ship this order." });
  }

  let conn;
  try {
    conn = await getConnection();

    const check = await conn.execute(
      `SELECT WorkID, OrderStatus FROM ORDERS WHERE OrderID = :orderId`,
      { orderId }
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const current = check.rows[0];

    if (!current.WORKID) {
      return res.status(400).json({ success: false, message: "This order has no worker assigned yet." });
    }

    if (workerId && current.WORKID !== workerId) {
      return res.status(403).json({ success: false, message: "This order is assigned to a different worker." });
    }

    if (current.ORDERSTATUS !== "Processing") {
      return res.status(400).json({ success: false, message: "This order has already been shipped." });
    }

    await conn.execute(
      `UPDATE ORDERS
          SET TrackingNo = :trackingNo, OrderStatus = 'In Delivery'
        WHERE OrderID = :orderId`,
      { trackingNo, orderId },
      { autoCommit: true }
    );

    return res.json({ success: true, message: "Order shipped.", tracking_no: trackingNo, status: "In Delivery" });
  } catch (err) {
    console.error("[ORDER SHIP ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not ship order." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── PUT /api/orders/:orderId/status ──────────────────────────
// The assigned worker manually updates status once it's been shipped
// (e.g. "In Delivery" -> "Delivered"). Can't set status back to
// "Processing" or set a status before a tracking number exists — use
// /ship for that transition instead.
router.put("/orders/:orderId/status", async (req, res) => {
  const orderId = Number(req.params.orderId);
  const { status, worker_id } = req.body;
  const workerId = worker_id ? Number(worker_id) : null;

  const allowedStatuses = ["In Delivery", "Delivered"];

  if (!orderId) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Status must be one of: ${allowedStatuses.join(", ")}.` });
  }

  let conn;
  try {
    conn = await getConnection();

    const check = await conn.execute(
      `SELECT WorkID, TrackingNo FROM ORDERS WHERE OrderID = :orderId`,
      { orderId }
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const current = check.rows[0];

    if (!current.TRACKINGNO) {
      return res.status(400).json({ success: false, message: "Order must be shipped (tracking number entered) before its status can be changed." });
    }

    if (workerId && current.WORKID !== workerId) {
      return res.status(403).json({ success: false, message: "This order is assigned to a different worker." });
    }

    await conn.execute(
      `UPDATE ORDERS SET OrderStatus = :status WHERE OrderID = :orderId`,
      { status, orderId },
      { autoCommit: true }
    );

    return res.json({ success: true, message: "Status updated.", status });
  } catch (err) {
    console.error("[ORDER STATUS ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not update status." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── DELETE /api/orders/:orderId ───────────────────────────────
// Removes a wrongly-placed/duplicate order entirely — deletes its
// ORDER_PRODUCTS lines first (FK), then the ORDERS row itself, both in
// one transaction so a failure partway through doesn't leave orphaned
// line items behind. No status restriction: an admin correcting a
// mistake may need to remove an order at any stage, not just
// unshipped ones — the frontend should confirm before calling this.
router.delete("/orders/:orderId", async (req, res) => {
  const orderId = Number(req.params.orderId);

  if (!orderId) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }

  let conn;
  try {
    conn = await getConnection();

    await conn.execute(
      `DELETE FROM ORDER_PRODUCTS WHERE OrderID = :orderId`,
      { orderId }
    );

    const result = await conn.execute(
      `DELETE FROM ORDERS WHERE OrderID = :orderId`,
      { orderId }
    );

    if (result.rowsAffected === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    await conn.commit();
    return res.json({ success: true, message: `Order #${orderId} deleted successfully.` });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error("[ORDER DELETE ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not delete order." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;