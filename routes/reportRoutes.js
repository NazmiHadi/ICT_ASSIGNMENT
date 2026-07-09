// routes/reportRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection } = require("../config/db");

// ── GET /api/reports/overview ─────────────────────────────────
// Top-line stat cards for the Reports page: all-time revenue, order
// counts, purchase spend, avg order value, and how many orders are
// still pending fulfilment.
router.get("/reports/overview", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const revenueResult = await conn.execute(
      `SELECT NVL(SUM(op.Qty * NVL(p.SalesPrice, p.Price)), 0) AS TOTAL_REVENUE,
              COUNT(DISTINCT o.OrderID)                        AS TOTAL_ORDERS
         FROM ORDERS o
         LEFT JOIN ORDER_PRODUCTS op ON op.OrderID = o.OrderID
         LEFT JOIN PRODUCTS p        ON p.ProdID   = op.ProdID`
    );

    const purchaseResult = await conn.execute(
      `SELECT NVL(SUM(pp.Qty * NVL(pr.Price, 0)), 0) AS TOTAL_SPEND,
              COUNT(DISTINCT pu.PurchID)              AS TOTAL_PURCHASES
         FROM PURCHASE pu
         LEFT JOIN PURCHASE_PRODUCT pp ON pp.PurchID = pu.PurchID
         LEFT JOIN PRODUCTS pr         ON pr.ProdID  = pp.ProdID`
    );

    const pendingResult = await conn.execute(
      `SELECT
         SUM(CASE WHEN OrderStatus = 'Processing'  THEN 1 ELSE 0 END) AS PROCESSING,
         SUM(CASE WHEN OrderStatus = 'In Delivery' THEN 1 ELSE 0 END) AS IN_DELIVERY,
         SUM(CASE WHEN OrderStatus = 'Delivered'   THEN 1 ELSE 0 END) AS DELIVERED
         FROM ORDERS`
    );

    const rev   = revenueResult.rows[0]  || {};
    const purch = purchaseResult.rows[0] || {};
    const pend  = pendingResult.rows[0]  || {};

    const totalRevenue  = Number(rev.TOTAL_REVENUE)  || 0;
    const totalOrders   = Number(rev.TOTAL_ORDERS)   || 0;
    const totalSpend    = Number(purch.TOTAL_SPEND)  || 0;
    const totalPurchases= Number(purch.TOTAL_PURCHASES) || 0;

    return res.json({
      success: true,
      overview: {
        total_revenue:     totalRevenue,
        total_orders:      totalOrders,
        avg_order_value:   totalOrders ? Number((totalRevenue / totalOrders).toFixed(2)) : 0,
        total_purchases:   totalPurchases,
        total_spend:       totalSpend,
        processing_count:  Number(pend.PROCESSING)  || 0,
        in_delivery_count: Number(pend.IN_DELIVERY) || 0,
        delivered_count:   Number(pend.DELIVERED)   || 0
      }
    });
  } catch (err) {
    console.error("[REPORTS OVERVIEW ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load overview." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/reports/monthly-sales?months=12 ──────────────────
// Revenue + order count per calendar month, oldest -> newest.
router.get("/reports/monthly-sales", async (req, res) => {
  const months = Math.min(Number(req.query.months) || 12, 36);
  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT TO_CHAR(o.OrderDate, 'YYYY-MM')            AS MONTH_KEY,
              COUNT(DISTINCT o.OrderID)                   AS ORDER_COUNT,
              NVL(SUM(op.Qty * NVL(p.SalesPrice, p.Price)), 0) AS REVENUE
         FROM ORDERS o
         LEFT JOIN ORDER_PRODUCTS op ON op.OrderID = o.OrderID
         LEFT JOIN PRODUCTS p        ON p.ProdID   = op.ProdID
        WHERE o.OrderDate >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -:months)
        GROUP BY TO_CHAR(o.OrderDate, 'YYYY-MM')
        ORDER BY MONTH_KEY`,
      { months: months - 1 }
    );

    const monthly = result.rows.map(row => ({
      month:        row.MONTH_KEY,
      order_count:  Number(row.ORDER_COUNT) || 0,
      revenue:      Number(row.REVENUE) || 0
    }));

    return res.json({ success: true, monthly });
  } catch (err) {
    console.error("[REPORTS MONTHLY SALES ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load monthly sales." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/reports/daily-sales?days=30 ──────────────────────
// Revenue per day for a short trailing window (default 30 days).
router.get("/reports/daily-sales", async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT TO_CHAR(o.OrderDate, 'YYYY-MM-DD')          AS DAY_KEY,
              COUNT(DISTINCT o.OrderID)                    AS ORDER_COUNT,
              NVL(SUM(op.Qty * NVL(p.SalesPrice, p.Price)), 0) AS REVENUE
         FROM ORDERS o
         LEFT JOIN ORDER_PRODUCTS op ON op.OrderID = o.OrderID
         LEFT JOIN PRODUCTS p        ON p.ProdID   = op.ProdID
        WHERE o.OrderDate >= TRUNC(SYSDATE) - :days
        GROUP BY TO_CHAR(o.OrderDate, 'YYYY-MM-DD')
        ORDER BY DAY_KEY`,
      { days: days - 1 }
    );

    const daily = result.rows.map(row => ({
      day:          row.DAY_KEY,
      order_count:  Number(row.ORDER_COUNT) || 0,
      revenue:      Number(row.REVENUE) || 0
    }));

    return res.json({ success: true, daily });
  } catch (err) {
    console.error("[REPORTS DAILY SALES ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load daily sales." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/reports/top-products?limit=10 ────────────────────
// Best sellers by quantity, with revenue contributed by each.
router.get("/reports/top-products", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT * FROM (
         SELECT p.ProdID,
                p.ProdName,
                NVL(SUM(op.Qty), 0)                            AS QTY_SOLD,
                NVL(SUM(op.Qty * NVL(p.SalesPrice, p.Price)), 0) AS REVENUE
           FROM ORDER_PRODUCTS op
           JOIN PRODUCTS p ON p.ProdID = op.ProdID
          GROUP BY p.ProdID, p.ProdName
          ORDER BY QTY_SOLD DESC
       ) WHERE ROWNUM <= :limit`,
      { limit }
    );

    const products = result.rows.map(row => ({
      product_id:   row.PRODID,
      product_name: row.PRODNAME,
      qty_sold:     Number(row.QTY_SOLD) || 0,
      revenue:      Number(row.REVENUE) || 0
    }));

    return res.json({ success: true, products });
  } catch (err) {
    console.error("[REPORTS TOP PRODUCTS ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load top products." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/reports/order-status ─────────────────────────────
// Breakdown of every order currently in the system by status, for a
// donut chart (Processing / In Delivery / Delivered).
router.get("/reports/order-status", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT OrderStatus, COUNT(*) AS CNT
         FROM ORDERS
        GROUP BY OrderStatus`
    );

    const breakdown = result.rows.map(row => ({
      status: row.ORDERSTATUS,
      count:  Number(row.CNT) || 0
    }));

    return res.json({ success: true, breakdown });
  } catch (err) {
    console.error("[REPORTS ORDER STATUS ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load order status breakdown." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/reports/purchase-report?months=6 ─────────────────
// Purchase spend grouped by vendor, for a trailing window — powers
// the vendor spend bar chart and a small "top vendors" table.
router.get("/reports/purchase-report", async (req, res) => {
  const months = Math.min(Number(req.query.months) || 6, 36);
  let conn;
  try {
    conn = await getConnection();

    const byVendor = await conn.execute(
      `SELECT v.VendID, v.VendName,
              COUNT(DISTINCT pu.PurchID)              AS PURCHASE_COUNT,
              NVL(SUM(pp.Qty * NVL(pr.Price, 0)), 0)  AS SPEND
         FROM PURCHASE pu
         LEFT JOIN VENDORS v          ON v.VendID  = pu.VendID
         LEFT JOIN PURCHASE_PRODUCT pp ON pp.PurchID = pu.PurchID
         LEFT JOIN PRODUCTS pr         ON pr.ProdID  = pp.ProdID
        WHERE pu.PurchDate >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -:months)
        GROUP BY v.VendID, v.VendName
        ORDER BY SPEND DESC`,
      { months: months - 1 }
    );

    const byMonth = await conn.execute(
      `SELECT TO_CHAR(pu.PurchDate, 'YYYY-MM')         AS MONTH_KEY,
              NVL(SUM(pp.Qty * NVL(pr.Price, 0)), 0)   AS SPEND,
              COUNT(DISTINCT pu.PurchID)                AS PURCHASE_COUNT
         FROM PURCHASE pu
         LEFT JOIN PURCHASE_PRODUCT pp ON pp.PurchID = pu.PurchID
         LEFT JOIN PRODUCTS pr         ON pr.ProdID  = pp.ProdID
        WHERE pu.PurchDate >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -:months)
        GROUP BY TO_CHAR(pu.PurchDate, 'YYYY-MM')
        ORDER BY MONTH_KEY`,
      { months: months - 1 }
    );

    return res.json({
      success: true,
      by_vendor: byVendor.rows.map(row => ({
        vendor_id:       row.VENDID,
        vendor_name:     row.VENDNAME,
        purchase_count:  Number(row.PURCHASE_COUNT) || 0,
        spend:           Number(row.SPEND) || 0
      })),
      by_month: byMonth.rows.map(row => ({
        month:           row.MONTH_KEY,
        spend:           Number(row.SPEND) || 0,
        purchase_count:  Number(row.PURCHASE_COUNT) || 0
      }))
    });
  } catch (err) {
    console.error("[REPORTS PURCHASE REPORT ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load purchase report." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── GET /api/reports/worker-performance ───────────────────────
// Orders shipped/delivered per worker — powers a "team performance"
// bar chart on the Reports page (admin/fulltime only).
router.get("/reports/worker-performance", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT w.WorkID, w.WorkName,
              COUNT(o.OrderID)                                                    AS ASSIGNED_COUNT,
              SUM(CASE WHEN o.OrderStatus = 'Delivered'   THEN 1 ELSE 0 END)       AS DELIVERED_COUNT,
              SUM(CASE WHEN o.OrderStatus = 'In Delivery' THEN 1 ELSE 0 END)       AS IN_DELIVERY_COUNT
         FROM WORKERS w
         LEFT JOIN ORDERS o ON o.WorkID = w.WorkID
        GROUP BY w.WorkID, w.WorkName
        ORDER BY ASSIGNED_COUNT DESC`
    );

    const workers = result.rows.map(row => ({
      worker_id:          row.WORKID,
      worker_name:        row.WORKNAME,
      assigned_count:     Number(row.ASSIGNED_COUNT) || 0,
      delivered_count:    Number(row.DELIVERED_COUNT) || 0,
      in_delivery_count:  Number(row.IN_DELIVERY_COUNT) || 0
    }));

    return res.json({ success: true, workers });
  } catch (err) {
    console.error("[REPORTS WORKER PERFORMANCE ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load worker performance." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;

/* ── Integration note ──────────────────────────────────────────
   In your main app file, mount this the same way as the other routers:

     const reportRoutes = require("./routes/reportRoutes");
     app.use("/api", reportRoutes);
*/