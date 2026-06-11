const express = require("express");
const router = express.Router();
const { getConnection, oracledb } = require("../config/db");

// ── POST /api/checkout ───────────────────────────────────────
router.post("/checkout", async (req, res) => {
  let conn;
  const { items } = req.body;

  if (!items || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ success: false, message: "Cart is empty." });
  }

  const custId = req.session?.custId || 1;

  try {
    conn = await getConnection();

    const orderResult = await conn.execute(
      `INSERT INTO ORDERS (CustID)
       VALUES (:custId)
       RETURNING OrderID INTO :orderId`,
      {
        custId,
        orderId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: false }
    );

    const orderId = orderResult.outBinds.orderId[0];

    for (const item of items) {
      await conn.execute(
        `INSERT INTO ORDER_PRODUCTS (OrderID, ProdID, Qty)
         VALUES (:orderId, :prodId, :qty)`,
        { orderId, prodId: item.product_id, qty: item.qty },
        { autoCommit: false }
      );

      const updateResult = await conn.execute(
        `UPDATE INVENTORY
         SET Qty = Qty - :qty
         WHERE ProdID = :prodId
           AND Qty >= :qty`,
        { qty: item.qty, prodId: item.product_id },
        { autoCommit: false }
      );

      if (updateResult.rowsAffected === 0) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Not enough stock for product ID ${item.product_id}.`
        });
      }
    }

    await conn.commit();
    return res.json({ success: true, orderId });

  } catch (err) {
    console.error("[CHECKOUT ERROR]", err);
    if (conn) await conn.rollback();
    return res.status(500).json({ success: false, message: "Checkout failed." });

  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;