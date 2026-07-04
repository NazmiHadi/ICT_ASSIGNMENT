// routes/orderRoutes.js
const express = require("express");
const crypto  = require("crypto");
const router  = express.Router();
const { getConnection } = require("../config/db");

// ── Helper: generate a tracking number ────────────────────────
// Format: KA-YYYYMMDD-<OrderID padded>-<4 random alphanumerics>
// e.g. KA-20260704-008123-4F7A
function generateTrackingNo(orderId) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const orderPart = String(orderId).padStart(6, "0");
  const randomPart = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `KA-${datePart}-${orderPart}-${randomPart}`;
}

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
// Returns orders with customer, worker, tracking/status, and ordered products.
// Used by the Manage Orders page (admin/fulltime — can (re)assign workers).
//
// Optional ?customer_id=... filters down to one customer's orders — this lets
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
// The assigned worker presses "Ship": generates a tracking number and
// flips the order to "In Delivery". Only allowed once a worker is
// assigned and the order hasn't already been shipped.
router.put("/orders/:orderId/ship", async (req, res) => {
  const orderId  = Number(req.params.orderId);
  const workerId = req.body.worker_id ? Number(req.body.worker_id) : null;

  if (!orderId) {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
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

    const trackingNo = generateTrackingNo(orderId);

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
      return res.status(400).json({ success: false, message: "Order must be shipped (tracking number generated) before its status can be changed." });
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

module.exports = router;

// =====================================================================
// NOTE FOR THE WORKER-SIDE FILES YOU'LL SEND NEXT:
//
// 1. Staff dashboard "unassigned orders" view: just call GET /api/orders
//    and filter client-side for worker_id === null (or add a
//    ?unassigned=true param here if you'd rather do it server-side —
//    easy to add once I see how that page is structured).
//
// 2. "Ship" button: call PUT /api/orders/:orderId/ship with
//    { worker_id }. Only enabled for an order once it's assigned to
//    the logged-in worker and status is "Processing".
//
// 3. Manual status edit (In Delivery <-> Delivered): call
//    PUT /api/orders/:orderId/status with { status, worker_id }.
//    Only enabled once TrackingNo exists.
//
// I've assumed "Processing" is the initial state your DB calls
// "in process" — rename in the CHECK constraint + code if you'd
// rather it read literally "In Process".
// =====================================================================