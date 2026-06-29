// routes/workerRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection, oracledb } = require("../config/db");

// ── GET /api/workers ──────────────────────────────────────────
router.get("/workers", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT w.WorkID, w.WorkName, w.WorkPhoneNum, w.username, w.ManagerID,
              m.WorkName AS ManagerName,
              CASE WHEN ft.WorkID IS NOT NULL THEN 'Full Time'
                   WHEN pt.WorkID IS NOT NULL THEN 'Part Time'
                   ELSE 'Unassigned' END AS WorkType,
              ft.Salary, ft.Bonus_Salary,
              pt.SalaryPerHr
         FROM WORKERS w
         LEFT JOIN WORKERS m            ON w.ManagerID  = m.WorkID
         LEFT JOIN FULL_TIME_WORKERS ft ON w.WorkID     = ft.WorkID
         LEFT JOIN PART_TIME_WORKERS pt ON w.WorkID     = pt.WorkID
        ORDER BY w.WorkID`
    );

    const workers = result.rows.map(row => ({
      worker_id:    row.WORKID,
      name:         row.WORKNAME,
      phone:        row.WORKPHONENUM,
      username:     row.USERNAME,
      manager_id:   row.MANAGERID,
      manager_name: row.MANAGERNAME,
      work_type:    row.WORKTYPE,
      salary:       row.SALARY,
      bonus_salary: row.BONUS_SALARY,
      salary_per_hr: row.SALARYPERHR
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
// Body: { name, phone, username, password, manager_id,
//         work_type, salary, bonus_salary, salary_per_hr }
router.post("/workers", async (req, res) => {
  const { name, phone, username, password, manager_id,
          work_type, salary, bonus_salary, salary_per_hr } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ success: false, message: "Name, username, and password are required." });
  }
  if (!work_type || !["Full Time", "Part Time"].includes(work_type)) {
    return res.status(400).json({ success: false, message: "Worker type must be Full Time or Part Time." });
  }
  if (work_type === "Full Time" && !salary) {
    return res.status(400).json({ success: false, message: "Salary is required for Full Time workers." });
  }
  if (work_type === "Part Time" && !salary_per_hr) {
    return res.status(400).json({ success: false, message: "Salary per hour is required for Part Time workers." });
  }

  let conn;
  try {
    conn = await getConnection();

    const check = await conn.execute(
      `SELECT WorkID FROM WORKERS WHERE username = :username`, { username }
    );
    if (check.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Username already taken." });
    }

    // Insert into WORKERS
    const result = await conn.execute(
      `INSERT INTO WORKERS (WorkName, WorkPhoneNum, username, password, ManagerID)
       VALUES (:name, :phone, :username, :password, :manager_id)
       RETURNING WorkID INTO :newId`,
      {
        name, phone: phone || null, username, password,
        manager_id: manager_id || null,
        newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );

    const workId = result.outBinds.newId[0];

    // Insert into FULL_TIME or PART_TIME
    if (work_type === "Full Time") {
      await conn.execute(
        `INSERT INTO FULL_TIME_WORKERS (WorkID, Salary, Bonus_Salary)
         VALUES (:workId, :salary, :bonus_salary)`,
        { workId, salary: salary || null, bonus_salary: bonus_salary || null }
      );
    } else {
      await conn.execute(
        `INSERT INTO PART_TIME_WORKERS (WorkID, SalaryPerHr)
         VALUES (:workId, :salary_per_hr)`,
        { workId, salary_per_hr: salary_per_hr || null }
      );
    }

    await conn.commit();

    return res.status(201).json({ success: true, message: "Worker added successfully.", worker_id: workId });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
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
