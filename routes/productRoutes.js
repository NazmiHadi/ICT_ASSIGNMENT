const express = require("express");
const router = express.Router();
const { getConnection, oracledb } = require("../config/db");

// ── GET /api/products ────────────────────────────────────────
router.get("/products", async (req, res) => {
  let conn;

  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT p.ProdID, p.ProdName, p.ProdDesc, p.Price, p.SalesPrice, p.ProdType,
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
      // NOTE: "price" is kept as SalesPrice for backward compatibility with
      // any existing storefront/customer-facing code that already reads
      // this field expecting the sell price. New fields below give the
      // admin pages (Manage Products) the original price + clearer names.
      price:         row.SALESPRICE,
      list_price:    row.PRICE,        // original PRODUCTS.Price column
      sales_price:   row.SALESPRICE,   // alias, explicit name for admin UI
      type:          row.PRODTYPE,
      container_id:  row.CONTID,
      container:     row.CONTNAME,
      container_name: row.CONTNAME,    // alias used by Manage Products page
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

// ── POST /api/products ───────────────────────────────────────
// Body: { name, type, price, sales_price, description, container_id }
router.post("/products", async (req, res) => {
  const { name, type, price, sales_price, description, container_id } = req.body;

  if (!name || price === undefined || price === null || price === "") {
    return res.status(400).json({ success: false, message: "Product name and price are required." });
  }

  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc, ContID)
       VALUES (:name, :price, :type, :sales_price, :description, :container_id)
       RETURNING ProdID INTO :newId`,
      {
        name,
        price,
        type:         type || null,
        sales_price:  sales_price || null,
        description:  description || null,
        container_id: container_id || null,
        newId:        { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: true }
    );

    return res.status(201).json({
      success: true,
      message: "Product added successfully.",
      product_id: result.outBinds.newId[0]
    });

  } catch (err) {
    console.error("[PRODUCTS POST ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not add product." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;