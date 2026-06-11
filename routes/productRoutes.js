const express = require("express");
const router = express.Router();
const { getConnection } = require("../config/db");

// ── GET /api/products ────────────────────────────────────────
router.get("/products", async (req, res) => {
  let conn;

  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT p.ProdID, p.ProdName, p.ProdDesc, p.SalesPrice, p.ProdType,
              c.ContID, c.ContName,
              i.Qty
       FROM PRODUCTS p
       LEFT JOIN CONTAINERS c ON p.ContID = c.ContID
       LEFT JOIN INVENTORY i ON i.ProdID = p.ProdID AND i.ContID = c.ContID
       ORDER BY p.ProdID`
    );

    const products = result.rows.map(row => ({
      product_id:    row.PRODID,
      name:          row.PRODNAME,
      description:   row.PRODDESC,
      price:         row.SALESPRICE,
      type:          row.PRODTYPE,
      container_id:  row.CONTID,
      container:     row.CONTNAME,
      stock:         row.QTY ?? 0,
      image:         `product_${String(row.PRODID).padStart(2, '0')}.jpg`
    }));

    return res.json({ success: true, products });

  } catch (err) {
    console.error("[PRODUCTS ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load products." });

  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;