// routes/containerRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection, oracledb } = require("../config/db");

// ── GET /api/containers ────────────────────────────────────────
router.get("/containers", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT ContID, ContName, ContColour FROM CONTAINERS ORDER BY ContID`
    );
    const containers = result.rows.map(row => ({
      container_id: row.CONTID,
      name:         row.CONTNAME,
      colour:       row.CONTCOLOUR
    }));
    return res.json({ success: true, containers });
  } catch (err) {
    console.error("[CONTAINERS GET ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load containers." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── POST /api/containers ───────────────────────────────────────
// Body: { name, colour }
// A container's date is no longer set here — it's implied by when
// stock actually gets assigned into it (via Receive Purchase or a
// manual Inventory adjustment), so there's no date input at creation
// time anymore.
router.post("/containers", async (req, res) => {
  const { name, colour } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: "Container name is required." });
  }

  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `INSERT INTO CONTAINERS (ContName, ContColour)
       VALUES (:name, :colour)
       RETURNING ContID INTO :newId`,
      {
        name,
        colour: colour || null,
        newId:  { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: true }
    );

    return res.status(201).json({
      success: true,
      message: "Container added successfully.",
      container_id: result.outBinds.newId[0]
    });
  } catch (err) {
    console.error("[CONTAINERS POST ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not add container." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;