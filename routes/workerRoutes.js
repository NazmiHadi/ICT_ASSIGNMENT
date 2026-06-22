// routes/workerRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection, oracledb } = require("../config/db");

// ── GET /api/workers ─────────────────────────────────────────
// Returns all workers with their manager name (self-join).
router.get("/workers", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT w.WorkID,
              w.WorkName,
              w.WorkPhoneNum,
              w.username,
              w.ManagerID,
              m.WorkName AS ManagerName
         FROM WORKERS w
         LEFT JOIN WORKERS m ON w.ManagerID = m.WorkID
        ORDER BY w.WorkID`
    );

    const workers = result.rows.map(row => ({
      worker_id:    row.WORKID,
      name:         row.WORKNAME,
      phone:        row.WORKPHONENUM,
      username:     row.USERNAME,
      manager_id:   row.MANAGERID,
      manager_name: row.MANAGERNAME
    }));

    return res.json({ success: true, workers });

  } catch (err) {
    console.error("[WORKERS GET ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load workers." });

  } finally {
    if (conn) await conn.close();
  }
});

// ── POST /api/workers ─────────────────────────────────────────
// Insert a new worker.
// Body: { name, phone, username, password, manager_id }
router.post("/workers", async (req, res) => {
  const { name, phone, username, password, manager_id } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({
      success: false,
      message: "Name, username, and password are required."
    });
  }

  let conn;
  try {
    conn = await getConnection();

    // Check username not already taken
    const check = await conn.execute(
      `SELECT WorkID FROM WORKERS WHERE username = :username`,
      { username }
    );
    if (check.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Username already taken." });
    }

    const result = await conn.execute(
      `INSERT INTO WORKERS (WorkName, WorkPhoneNum, username, password, ManagerID)
       VALUES (:name, :phone, :username, :password, :manager_id)
       RETURNING WorkID INTO :newId`,
      {
        name,
        phone:      phone      || null,
        username,
        password,
        manager_id: manager_id || null,
        newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: true }
    );

    return res.status(201).json({
      success:   true,
      message:   "Worker added successfully.",
      worker_id: result.outBinds.newId[0]
    });

  } catch (err) {
    if (err.errorNum === 1) {
      return res.status(409).json({ success: false, message: "Username already exists." });
    }
    console.error("[WORKERS POST ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not add worker." });

  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;
