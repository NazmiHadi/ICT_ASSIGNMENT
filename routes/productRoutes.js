  const express = require("express");
  const path    = require("path");
  const fs      = require("fs");
  const multer  = require("multer");
  const router  = express.Router();
  const { getConnection, oracledb } = require("../config/db");

  // ─────────────────────────────────────────────────────────────
  // Image upload setup
  // Requires: npm install multer
  //
  // Files are saved to <project root>/uploads/products/ on disk.
  // You need to serve that folder statically in your main server
  // file (app.js / server.js) — it's not done automatically here:
  //
  //   const path = require("path");
  //   app.use("/uploads/products", express.static(path.join(__dirname, "uploads/products")));
  //
  // Add that line once, near your other app.use(express.static(...)) calls.
  // ─────────────────────────────────────────────────────────────
  const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "products");
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueName = `prod-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
      cb(null, uniqueName);
    }
  });

  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
      if (!ALLOWED_TYPES.has(file.mimetype)) {
        return cb(new Error("Only JPG, PNG, WEBP, or GIF images are allowed."));
      }
      cb(null, true);
    }
  });

  // Turns a stored filename into the URL the browser can load.
  function imageUrl(fileName) {
    return fileName ? `/uploads/products/${fileName}` : null;
  }

  // ── GET /api/products ────────────────────────────────────────
  // PRODUCTS no longer has a ContID — a product isn't tied to a single
  // container anymore. "Where is this product stored?" is now answered
  // entirely by INVENTORY (a product can sit across several containers,
  // in however many batches came from Receive Purchase / manual
  // adjustments). `stock` below is just the product's total qty summed
  // across every container it happens to be in.
  router.get("/products", async (req, res) => {
    let conn;

    try {
      conn = await getConnection();

      const result = await conn.execute(
        `SELECT p.ProdID, p.ProdName, p.ProdDesc, p.Price, p.SalesPrice, p.ProdType,
                p.ImageFileName,
                NVL(SUM(i.Qty), 0) AS Qty
        FROM PRODUCTS p
        LEFT JOIN INVENTORY i ON i.ProdID = p.ProdID
        GROUP BY p.ProdID, p.ProdName, p.ProdDesc, p.Price, p.SalesPrice, p.ProdType,
                  p.ImageFileName
        ORDER BY p.ProdID`
      );

      const products = result.rows.map(row => ({
        product_id:  row.PRODID,
        name:        row.PRODNAME,
        description: row.PRODDESC,
        price:       row.SALESPRICE,
        list_price:  row.PRICE,
        sales_price: row.SALESPRICE,
        type:        row.PRODTYPE,
        stock:       row.QTY ?? 0,
        // Real uploaded image, or null if none was ever added — the front
        // end should show a placeholder graphic in that case rather than
        // request a file that doesn't exist.
        image:       row.IMAGEFILENAME,
        image_url:   imageUrl(row.IMAGEFILENAME)
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
  // Now multipart/form-data (so it can carry a file), not JSON.
  // Fields: name, type, price, sales_price, description
  // File field name: "image" (optional — product can be added without one
  // and the picture added later via PUT /api/products/:id/image)
  //
  // container_id is no longer accepted here — a product isn't assigned to
  // a container at creation time anymore. That assignment happens later,
  // either via Receive Purchase (POST /api/purchases/:purchId/receive) or
  // a manual Inventory adjustment (POST /api/inventory).
  router.post("/products", upload.single("image"), async (req, res) => {
    const { name, type, price, sales_price, description } = req.body;

    if (!name || price === undefined || price === null || price === "") {
      // Clean up the uploaded file if validation fails after upload
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: "Product name and price are required." });
    }

    const imageFileName = req.file ? req.file.filename : null;

    let conn;
    try {
      conn = await getConnection();

      const result = await conn.execute(
        `INSERT INTO PRODUCTS (ProdName, Price, ProdType, SalesPrice, ProdDesc, ImageFileName)
        VALUES (:name, :price, :type, :sales_price, :description, :imageFileName)
        RETURNING ProdID INTO :newId`,
        {
          name,
          price,
          type:         type || null,
          sales_price:  sales_price || null,
          description:  description || null,
          imageFileName,
          newId:        { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        },
        { autoCommit: true }
      );

      return res.status(201).json({
        success: true,
        message: "Product added successfully.",
        product_id: result.outBinds.newId[0],
        image_url: imageUrl(imageFileName)
      });

    } catch (err) {
      console.error("[PRODUCTS POST ERROR]", err);
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(500).json({ success: false, message: "Could not add product." });
    } finally {
      if (conn) await conn.close();
    }
  });

  // ── PUT /api/products/:id/image ──────────────────────────────
  // Lets a worker add or replace a product's picture after the fact,
  // without having to re-enter all the other fields.
  router.put("/products/:id/image", upload.single("image"), async (req, res) => {
    const prodId = Number(req.params.id);

    if (!prodId) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file was uploaded." });
    }

    let conn;
    try {
      conn = await getConnection();

      // Look up the old file so we can delete it after a successful swap
      const existing = await conn.execute(
        `SELECT ImageFileName FROM PRODUCTS WHERE ProdID = :prodId`,
        { prodId }
      );

      if (existing.rows.length === 0) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ success: false, message: "Product not found." });
      }

      const oldFileName = existing.rows[0].IMAGEFILENAME;

      await conn.execute(
        `UPDATE PRODUCTS SET ImageFileName = :imageFileName WHERE ProdID = :prodId`,
        { imageFileName: req.file.filename, prodId },
        { autoCommit: true }
      );

      if (oldFileName) {
        fs.unlink(path.join(UPLOAD_DIR, oldFileName), () => {});
      }

      return res.json({ success: true, message: "Image updated.", image_url: imageUrl(req.file.filename) });

    } catch (err) {
      console.error("[PRODUCT IMAGE UPDATE ERROR]", err);
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(500).json({ success: false, message: "Could not update image." });
    } finally {
      if (conn) await conn.close();
    }
  });

  // Multer errors (bad file type, too large) land here instead of the
  // generic Express error handler, so we can send a clean JSON message.
  router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || err.message.includes("images are allowed")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  });

  // ── DELETE /api/products/:id ─────────────────────────────────
  // Blocked if the product still has INVENTORY assigned anywhere (mirrors
  // the container rule — clear/move stock first) or if it's referenced by
  // any past order (deleting it would corrupt that order's line items/
  // history). If neither applies, the row is removed and its uploaded
  // image file (if any) is deleted from disk.
  router.delete("/products/:id", async (req, res) => {
    const prodId = Number(req.params.id);

    if (!prodId) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }

    let conn;
    try {
      conn = await getConnection();

      const inInventory = await conn.execute(
        `SELECT COUNT(*) AS CNT FROM INVENTORY WHERE ProdID = :prodId`,
        { prodId }
      );
      if (inInventory.rows[0].CNT > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete this product — it still has inventory assigned to it. Remove its stock first."
        });
      }

      const inOrders = await conn.execute(
        `SELECT COUNT(*) AS CNT FROM ORDER_PRODUCTS WHERE ProdID = :prodId`,
        { prodId }
      );
      if (inOrders.rows[0].CNT > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete this product — it appears in existing orders."
        });
      }

      // Grab the image filename first so we can clean it up after a
      // successful delete.
      const existing = await conn.execute(
        `SELECT ImageFileName FROM PRODUCTS WHERE ProdID = :prodId`,
        { prodId }
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Product not found." });
      }

      const oldFileName = existing.rows[0].IMAGEFILENAME;

      const result = await conn.execute(
        `DELETE FROM PRODUCTS WHERE ProdID = :prodId`,
        { prodId },
        { autoCommit: true }
      );

      if (result.rowsAffected === 0) {
        return res.status(404).json({ success: false, message: "Product not found." });
      }

      if (oldFileName) {
        fs.unlink(path.join(UPLOAD_DIR, oldFileName), () => {});
      }

      return res.json({ success: true, message: "Product deleted successfully." });

    } catch (err) {
      console.error("[PRODUCT DELETE ERROR]", err);
      return res.status(500).json({ success: false, message: "Could not delete product." });
    } finally {
      if (conn) await conn.close();
    }
  });

  module.exports = router;