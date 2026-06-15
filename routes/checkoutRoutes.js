const express = require("express");
const router = express.Router();
const { getConnection, oracledb } = require("../config/db");

// ── GET /api/orders?customer_id=... ────────────────────────────
router.get("/orders", async (req, res) => {
  const { customer_id } = req.query;
  let conn;

  if (!customer_id) {
    return res.status(400).json({ success: false, message: "customer_id is required." });
  }

  try {
    conn = await getConnection();

    const ordersResult = await conn.execute(
      `SELECT OrderID, OrderDate
       FROM ORDERS
       WHERE CustID = :custId
       ORDER BY OrderDate DESC, OrderID DESC`,
      { custId: customer_id }
    );

    const orders = [];

    for (const row of ordersResult.rows) {
      const itemsResult = await conn.execute(
        `SELECT op.ProdID, op.Qty, p.ProdName, p.SalesPrice
         FROM ORDER_PRODUCTS op
         JOIN PRODUCTS p ON p.ProdID = op.ProdID
         WHERE op.OrderID = :orderId`,
        { orderId: row.ORDERID }
      );

      const items = itemsResult.rows.map(item => ({
        product_id: item.PRODID,
        name:       item.PRODNAME,
        price:      item.SALESPRICE,
        qty:        item.QTY,
        line_total: item.SALESPRICE * item.QTY,
        image:      `product_${String(item.PRODID).padStart(2, '0')}.jpg`
      }));

      const total = items.reduce((sum, i) => sum + i.line_total, 0);

      orders.push({
        order_id:   row.ORDERID,
        order_date: row.ORDERDATE,
        total,
        items
      });
    }

    return res.json({ success: true, orders });

  } catch (err) {
    console.error("[ORDERS ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load orders." });

  } finally {
    if (conn) await conn.close();
  }
});


// ── POST /api/checkout ──────────────────────────────────────────
router.post("/checkout", async (req, res) => {
  const { items, customer_id } = req.body;
  let conn;

  if (!customer_id) {
    return res.status(400).json({ success: false, message: "customer_id is required." });
  }
  if (!items || !items.length) {
    return res.status(400).json({ success: false, message: "Cart is empty." });
  }

  try {
    conn = await getConnection();

    const orderResult = await conn.execute(
      `INSERT INTO ORDERS (CustID)
       VALUES (:custId)
       RETURNING OrderID INTO :orderId`,
      {
        custId:  customer_id,
        orderId: { dir: require("oracledb").BIND_OUT, type: require("oracledb").NUMBER }
      }
    );

    const orderId = orderResult.outBinds.orderId[0];

    for (const item of items) {
      await conn.execute(
        `INSERT INTO ORDER_PRODUCTS (OrderID, ProdID, Qty)
         VALUES (:orderId, :prodId, :qty)`,
        { orderId, prodId: item.product_id, qty: item.qty }
      );

      // Decrement inventory (no ContID in payload, so reduce across rows for this ProdID)
      const invResult = await conn.execute(
        `SELECT ContID, Qty FROM INVENTORY WHERE ProdID = :prodId AND Qty > 0 ORDER BY ContID`,
        { prodId: item.product_id }
      );

      let remaining = item.qty;
      for (const invRow of invResult.rows) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, invRow.QTY);

        await conn.execute(
          `UPDATE INVENTORY SET Qty = Qty - :deduct WHERE ProdID = :prodId AND ContID = :contId`,
          { deduct, prodId: item.product_id, contId: invRow.CONTID }
        );

        remaining -= deduct;
      }

      if (remaining > 0) {
        // not enough stock across all containers — rolled back below
        throw new Error(`Insufficient stock for product ${item.product_id}`);
      }
    }

    await conn.commit();

    return res.json({ success: true, orderId });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error("[CHECKOUT ERROR]", err);
    return res.status(500).json({ success: false, message: err.message || "Checkout failed." });

  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;