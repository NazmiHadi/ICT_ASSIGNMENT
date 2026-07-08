// routes/dashboardRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection } = require("../config/db");

// ── GET /api/dashboard-stats?role=admin&id=123 ────────────────
// Returns only the numbers each role's dashboard actually shows
// (see STAT_ITEMS / ROLE_CONFIG.stats in role-config.js).
//
//   role=admin     -> statWorkers, statCustomers, statOrders,
//                      statProducts, statVendors      (whole system)
//   role=fulltime  -> statCustomers, statOrders, statInventory (whole system)
//   role=parttime  -> statOrders (assigned to THIS worker via id),
//                      statInventory (whole system)
//   role=vendor    -> statPurchase (purchases from THIS vendor via id)
//
// `id` is the logged-in worker_id / vendor_id (localStorage "userId" on
// the frontend) and is only required/used for parttime and vendor.
router.get("/dashboard-stats", async (req, res) => {
  const role = req.query.role;
  const id   = req.query.id ? Number(req.query.id) : null;

  const validRoles = ["admin", "fulltime", "parttime", "vendor"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, message: "Invalid or missing role." });
  }

  let conn;
  try {
    conn = await getConnection();
    const stats = {};

    if (role === "admin") {
      const [workers, customers, orders, products, vendors] = await Promise.all([
        conn.execute(`SELECT COUNT(*) AS CNT FROM WORKERS`),
        conn.execute(`SELECT COUNT(*) AS CNT FROM CUSTOMERS`),
        conn.execute(`SELECT COUNT(*) AS CNT FROM ORDERS`),
        conn.execute(`SELECT COUNT(*) AS CNT FROM PRODUCTS`),
        conn.execute(`SELECT COUNT(*) AS CNT FROM VENDORS`)
      ]);
      stats.statWorkers   = workers.rows[0].CNT;
      stats.statCustomers = customers.rows[0].CNT;
      stats.statOrders    = orders.rows[0].CNT;
      stats.statProducts  = products.rows[0].CNT;
      stats.statVendors   = vendors.rows[0].CNT;

    } else if (role === "fulltime") {
      const [customers, orders, inventory] = await Promise.all([
        conn.execute(`SELECT COUNT(*) AS CNT FROM CUSTOMERS`),
        conn.execute(`SELECT COUNT(*) AS CNT FROM ORDERS`),
        conn.execute(`SELECT NVL(SUM(Qty),0) AS CNT FROM INVENTORY`)
      ]);
      stats.statCustomers = customers.rows[0].CNT;
      stats.statOrders    = orders.rows[0].CNT;
      stats.statInventory = inventory.rows[0].CNT;

    } else if (role === "parttime") {
      const inventory = await conn.execute(`SELECT NVL(SUM(Qty),0) AS CNT FROM INVENTORY`);
      stats.statInventory = inventory.rows[0].CNT;

      if (id) {
        const orders = await conn.execute(
          `SELECT COUNT(*) AS CNT FROM ORDERS WHERE WorkID = :id`,
          { id }
        );
        stats.statOrders = orders.rows[0].CNT;
      } else {
        stats.statOrders = 0;
      }

    } else if (role === "vendor") {
      if (id) {
        const purchases = await conn.execute(
          `SELECT COUNT(*) AS CNT FROM PURCHASE WHERE VendID = :id`,
          { id }
        );
        stats.statPurchase = purchases.rows[0].CNT;
      } else {
        stats.statPurchase = 0;
      }
    }

    return res.json({ success: true, stats });

  } catch (err) {
    console.error("[DASHBOARD STATS ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load dashboard stats." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;