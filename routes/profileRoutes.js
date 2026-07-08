// routes/profileRoutes.js
//
// Generic profile GET/PUT for the admin-panel "My Profile" page
// (admin/profile.html), which is used by staff (admin / fulltime /
// parttime workers, all stored in WORKERS) and vendors (VENDORS).
//
// NOTE: this file previously contained a mistaken duplicate copy of
// workerRoutes.js's GET/POST /workers handlers instead of this. That
// meant /api/profile — the endpoint admin/profile.html actually calls —
// never existed, so the "My Profile" page in the admin panel was broken
// for every staff/vendor role.
//
// Customer profile editing has its own dedicated endpoint
// (GET/PUT /api/customer/profile in customerRoutes.js) since the
// customer-facing profile page is a separate UI with its own field set.

const express = require("express");
const router  = express.Router();
const { getConnection } = require("../config/db");

const STAFF_ROLES = ["admin", "fulltime", "parttime"];

// ── GET /api/profile?role=...&id=... ────────────────────────────────────────
router.get("/profile", async (req, res) => {
  const { role, id } = req.query;

  if (!role || !id) {
    return res.status(400).json({ success: false, message: "role and id are required." });
  }

  let conn;
  try {
    conn = await getConnection();

    // ── Staff (admin / full-time / part-time) — all live in WORKERS ────
    if (STAFF_ROLES.includes(role)) {
      const result = await conn.execute(
        `SELECT w.WorkName, w.WorkPhoneNum, w.username, w.IsManager,
                ft.Salary, ft.Bonus_Salary, pt.SalaryPerHr
           FROM WORKERS w
           LEFT JOIN FULL_TIME_WORKERS ft ON w.WorkID = ft.WorkID
           LEFT JOIN PART_TIME_WORKERS pt ON w.WorkID = pt.WorkID
          WHERE w.WorkID = :id`,
        { id }
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Worker not found." });
      }

      const row = result.rows[0];
      return res.json({
        success: true,
        profile: {
          name:        row.WORKNAME,
          username:    row.USERNAME,
          phone:       row.WORKPHONENUM,
          isManager:   row.ISMANAGER === 1,
          salary:      row.SALARY,
          bonusSalary: row.BONUS_SALARY,
          salaryPerHr: row.SALARYPERHR
        }
      });
    }

    // ── Vendor ───────────────────────────────────────────────────────────
    if (role === "vendor") {
      const result = await conn.execute(
        `SELECT VendName, VendPhoneNum, VendAddress, username
           FROM VENDORS
          WHERE VendID = :id`,
        { id }
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Vendor not found." });
      }

      const row = result.rows[0];
      return res.json({
        success: true,
        profile: {
          name:     row.VENDNAME,
          username: row.USERNAME,
          phone:    row.VENDPHONENUM,
          address:  row.VENDADDRESS
        }
      });
    }

    return res.status(400).json({ success: false, message: `Unsupported role: ${role}` });

  } catch (err) {
    console.error("[PROFILE GET ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load profile." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── PUT /api/profile ─────────────────────────────────────────────────────────
// Body: { role, id, name, username, phone?, address?, password?, confirmPassword? }
router.put("/profile", async (req, res) => {
  const { role, id, name, username, phone, address, password, confirmPassword } = req.body;

  if (!role || !id) {
    return res.status(400).json({ success: false, message: "role and id are required." });
  }
  if (!name || !username) {
    return res.status(400).json({ success: false, message: "Name and username are required." });
  }
  if (password || confirmPassword) {
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }
  }

  let conn;
  try {
    conn = await getConnection();

    // ── Staff (admin / full-time / part-time) ───────────────────────────
    if (STAFF_ROLES.includes(role)) {
      const conflict = await conn.execute(
        `SELECT WorkID FROM WORKERS WHERE username = :username AND WorkID != :id`,
        { username, id }
      );
      if (conflict.rows.length > 0) {
        return res.status(409).json({ success: false, message: "That username is already taken." });
      }

      const sql = password
        ? `UPDATE WORKERS SET WorkName = :name, WorkPhoneNum = :phone, username = :username, password = :password WHERE WorkID = :id`
        : `UPDATE WORKERS SET WorkName = :name, WorkPhoneNum = :phone, username = :username WHERE WorkID = :id`;

      const binds = password
        ? { name, phone: phone || null, username, password, id }
        : { name, phone: phone || null, username, id };

      const result = await conn.execute(sql, binds, { autoCommit: true });

      if (result.rowsAffected === 0) {
        return res.status(404).json({ success: false, message: "Worker not found." });
      }

      return res.json({ success: true, message: "Profile updated successfully." });
    }

    // ── Vendor ───────────────────────────────────────────────────────────
    if (role === "vendor") {
      const conflict = await conn.execute(
        `SELECT VendID FROM VENDORS WHERE username = :username AND VendID != :id`,
        { username, id }
      );
      if (conflict.rows.length > 0) {
        return res.status(409).json({ success: false, message: "That username is already taken." });
      }

      const sql = password
        ? `UPDATE VENDORS SET VendName = :name, VendPhoneNum = :phone, VendAddress = :address, username = :username, password = :password WHERE VendID = :id`
        : `UPDATE VENDORS SET VendName = :name, VendPhoneNum = :phone, VendAddress = :address, username = :username WHERE VendID = :id`;

      const binds = password
        ? { name, phone: phone || null, address: address || null, username, password, id }
        : { name, phone: phone || null, address: address || null, username, id };

      const result = await conn.execute(sql, binds, { autoCommit: true });

      if (result.rowsAffected === 0) {
        return res.status(404).json({ success: false, message: "Vendor not found." });
      }

      return res.json({ success: true, message: "Profile updated successfully." });
    }

    return res.status(400).json({ success: false, message: `Unsupported role: ${role}` });

  } catch (err) {
    if (err.errorNum === 1) {
      return res.status(409).json({ success: false, message: "That username is already taken." });
    }
    console.error("[PROFILE PUT ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not update profile." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;