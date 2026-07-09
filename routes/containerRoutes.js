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

// ── DELETE /api/containers/:id ─────────────────────────────────
// Blocks deletion if this container still has any INVENTORY rows
// (i.e. some product's stock is currently assigned to it) — the
// manager needs to remove/reassign that stock first, otherwise the
// delete would silently orphan those inventory records.
router.delete("/containers/:id", async (req, res) => {
  const contId = Number(req.params.id);
  if (!contId) {
    return res.status(400).json({ success: false, message: "Invalid container ID." });
  }

  let conn;
  try {
    conn = await getConnection();

    const inUse = await conn.execute(
      `SELECT COUNT(*) AS CNT FROM INVENTORY WHERE ContID = :contId`,
      { contId }
    );
    if (inUse.rows[0].CNT > 0) {
      return res.status(409).json({
        success: false,
        message: "This container still has stock assigned to it. Remove or reassign that inventory before deleting."
      });
    }

    const result = await conn.execute(
      `DELETE FROM CONTAINERS WHERE ContID = :contId`,
      { contId },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ success: false, message: "Container not found." });
    }

    return res.json({ success: true, message: "Container deleted successfully." });
  } catch (err) {
    console.error("[CONTAINERS DELETE ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not delete container." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;
