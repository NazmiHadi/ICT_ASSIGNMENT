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
      `SELECT ContID, ContName, ContDate, ContColour FROM CONTAINERS ORDER BY ContID`
    );
    const containers = result.rows.map(row => ({
      container_id: row.CONTID,
      name:         row.CONTNAME,
      date:         row.CONTDATE,
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
// Body: { name, date, colour }
// NOTE 1: the bind variable is named :contDate (not :date) — "date" is an
// Oracle SQL reserved word, and using it as a bind variable name causes
// ORA-01745: invalid host/bind variable name.
// NOTE 2: :contDate is bound as a plain VARCHAR2 string (e.g. "2026-07-08"
// from <input type="date">). Letting Oracle implicitly convert that
// string into ContDate's DATE column relies on the session's default
// date format (usually DD-MON-RR), which doesn't match "YYYY-MM-DD" and
// throws ORA-01861. TO_DATE(:contDate, 'YYYY-MM-DD') tells Oracle exactly
// how to parse it instead of guessing.
router.post("/containers", async (req, res) => {
  const { name, date, colour } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: "Container name is required." });
  }

  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `INSERT INTO CONTAINERS (ContName, ContDate, ContColour)
       VALUES (:name, TO_DATE(:contDate, 'YYYY-MM-DD'), :colour)
       RETURNING ContID INTO :newId`,
      {
        name,
        contDate: date || null,
        colour:   colour || null,
        newId:    { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
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