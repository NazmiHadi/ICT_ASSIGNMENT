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
              w.IsManager,
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
      is_manager:   row.ISMANAGER === 1,
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
// Body: { name, phone, username, password, manager_id, is_manager,
//         work_type, salary, bonus_salary, salary_per_hr }
//
// is_manager: true/false (or 1/0) — when true, the worker is created as
// a Manager/Admin (WORKERS.IsManager = 1), which is what /api/login
// checks to grant the "admin" role. Managers don't require a Full
// Time / Part Time pay record, since their role comes from IsManager,
// not from FULL_TIME_WORKERS / PART_TIME_WORKERS — but a work_type can
// still be supplied for a manager if you also want their salary tracked.
router.post("/workers", async (req, res) => {
  const { name, phone, username, password, manager_id, is_manager,
          work_type, salary, bonus_salary, salary_per_hr } = req.body;

  const isManagerFlag = (is_manager === true || is_manager === "true" || is_manager === 1 || is_manager === "1") ? 1 : 0;

  if (!name || !username || !password) {
    return res.status(400).json({ success: false, message: "Name, username, and password are required." });
  }

  // Full Time / Part Time is only mandatory for non-manager workers.
  // A manager/admin can be created without a pay-type record.
  const hasWorkType = work_type && ["Full Time", "Part Time"].includes(work_type);
  if (!isManagerFlag && !hasWorkType) {
    return res.status(400).json({ success: false, message: "Worker type must be Full Time or Part Time." });
  }
  if (hasWorkType && work_type === "Full Time" && !salary) {
    return res.status(400).json({ success: false, message: "Salary is required for Full Time workers." });
  }
  if (hasWorkType && work_type === "Part Time" && !salary_per_hr) {
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
      `INSERT INTO WORKERS (WorkName, WorkPhoneNum, username, password, ManagerID, IsManager)
       VALUES (:name, :phone, :username, :password, :manager_id, :is_manager)
       RETURNING WorkID INTO :newId`,
      {
        name, phone: phone || null, username, password,
        manager_id: manager_id || null,
        is_manager: isManagerFlag,
        newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );

    const workId = result.outBinds.newId[0];

    // Insert into FULL_TIME or PART_TIME (optional for managers)
    if (hasWorkType) {
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

// ── DELETE /api/workers/:id ──────────────────────────────────
// Blocked if:
//   - this worker manages other workers (ManagerID points here) —
//     reassign those workers to a different manager first
//   - this worker has any ORDERS assigned to them
//   - this worker has any PURCHASE records tied to them
// Otherwise removes their FULL_TIME_WORKERS/PART_TIME_WORKERS pay
// record (if any) and then the WORKERS row itself.
router.delete("/workers/:id", async (req, res) => {
  const workId = Number(req.params.id);

  if (!workId) {
    return res.status(400).json({ success: false, message: "Invalid worker ID." });
  }

  let conn;
  try {
    conn = await getConnection();

    const managesOthers = await conn.execute(
      `SELECT COUNT(*) AS CNT FROM WORKERS WHERE ManagerID = :workId`,
      { workId }
    );
    if (managesOthers.rows[0].CNT > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete this worker — other workers report to them. Reassign those workers first."
      });
    }

    const hasOrders = await conn.execute(
      `SELECT COUNT(*) AS CNT FROM ORDERS WHERE WorkID = :workId`,
      { workId }
    );
    if (hasOrders.rows[0].CNT > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete this worker — they have orders assigned to them. Reassign those orders first."
      });
    }

    const hasPurchases = await conn.execute(
      `SELECT COUNT(*) AS CNT FROM PURCHASE WHERE WorkID = :workId`,
      { workId }
    );
    if (hasPurchases.rows[0].CNT > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete this worker — they have purchase records tied to them."
      });
    }

    const existing = await conn.execute(
      `SELECT WorkID FROM WORKERS WHERE WorkID = :workId`,
      { workId }
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Worker not found." });
    }

    // Clear their pay-type record, whichever one exists, then the
    // WORKERS row itself.
    await conn.execute(`DELETE FROM FULL_TIME_WORKERS WHERE WorkID = :workId`, { workId });
    await conn.execute(`DELETE FROM PART_TIME_WORKERS WHERE WorkID = :workId`, { workId });

    const result = await conn.execute(
      `DELETE FROM WORKERS WHERE WorkID = :workId`,
      { workId }
    );

    if (result.rowsAffected === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Worker not found." });
    }

    await conn.commit();
    return res.json({ success: true, message: "Worker deleted successfully." });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error("[WORKER DELETE ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not delete worker." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;