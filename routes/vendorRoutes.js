// routes/vendorRoutes.js
const express = require("express");
const router  = express.Router();
const { getConnection, oracledb } = require("../config/db");

// ── GET /api/vendors ──────────────────────────────────────────
router.get("/vendors", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT VendID, VendName, VendAddress, VendPhoneNum, username FROM VENDORS ORDER BY VendID`
    );
    const vendors = result.rows.map(row => ({
      vendor_id:   row.VENDID,
      name:        row.VENDNAME,
      address:     row.VENDADDRESS,
      phone:       row.VENDPHONENUM,
      username:    row.USERNAME,
      has_login:   !!row.USERNAME
    }));
    return res.json({ success: true, vendors });
  } catch (err) {
    console.error("[VENDORS GET ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not load vendors." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── POST /api/vendors ─────────────────────────────────────────
// Body: { name, address, phone, username, password }
// username/password are optional — when provided, the manager is
// creating a login for this vendor so they can access their own
// purchase-transaction portal (see /api/login's VENDORS check).
router.post("/vendors", async (req, res) => {
  const { name, address, phone, username, password } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: "Vendor name is required." });
  }

  const trimmedUsername = username ? String(username).trim() : "";
  const hasUsername = trimmedUsername.length > 0;
  const hasPassword = !!password;

  // If either credential field is filled in, both are required —
  // a vendor login needs both a username and a password to work.
  if (hasUsername !== hasPassword) {
    return res.status(400).json({
      success: false,
      message: "To create a vendor login, both username and password are required."
    });
  }

  let conn;
  try {
    conn = await getConnection();

    if (hasUsername) {
      const check = await conn.execute(
        `SELECT VendID FROM VENDORS WHERE username = :username`,
        { username: trimmedUsername }
      );
      if (check.rows.length > 0) {
        return res.status(409).json({ success: false, message: "Username already taken." });
      }
    }

    const result = await conn.execute(
      `INSERT INTO VENDORS (VendName, VendAddress, VendPhoneNum, username, password)
       VALUES (:name, :address, :phone, :username, :password)
       RETURNING VendID INTO :newId`,
      {
        name, address: address || null, phone: phone || null,
        username: hasUsername ? trimmedUsername : null,
        password: hasUsername ? password : null,
        newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: true }
    );
    return res.status(201).json({
      success: true,
      message: hasUsername
        ? "Vendor added successfully with login access."
        : "Vendor added successfully.",
      vendor_id: result.outBinds.newId[0]
    });
  } catch (err) {
    if (err.errorNum === 1) {
      return res.status(409).json({ success: false, message: "Username already exists." });
    }
    console.error("[VENDORS POST ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not add vendor." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── PUT /api/vendors/:id ──────────────────────────────────────
// Body: { name, address, phone, username, password }
// Edits a vendor's core details and (optionally) their login.
//
// Password handling, since this is an edit rather than a fresh create:
//   - username filled + password filled  -> set/replace the login with
//     this username and password.
//   - username filled + password blank   -> keep the login's existing
//     password (lets a manager fix a typo'd username or re-save the
//     form without being forced to re-enter a password every time).
//     Only allowed if the vendor already had a login; a brand-new login
//     still needs a password up front.
//   - username blank + password filled   -> rejected, a password with no
//     username makes no sense.
//   - both blank                         -> login is removed entirely.
router.put("/vendors/:id", async (req, res) => {
  const vendId = Number(req.params.id);
  const { name, address, phone, username, password } = req.body;

  if (!vendId) {
    return res.status(400).json({ success: false, message: "Invalid vendor ID." });
  }
  if (!name) {
    return res.status(400).json({ success: false, message: "Vendor name is required." });
  }

  const trimmedUsername = username ? String(username).trim() : "";
  const hasUsername = trimmedUsername.length > 0;
  const hasPassword = !!password;

  if (!hasUsername && hasPassword) {
    return res.status(400).json({
      success: false,
      message: "A username is required to set a password."
    });
  }

  let conn;
  try {
    conn = await getConnection();

    const existing = await conn.execute(
      `SELECT VendID, username, password FROM VENDORS WHERE VendID = :vendId`,
      { vendId }
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Vendor not found." });
    }

    const existingUsername = existing.rows[0].USERNAME;
    const existingPassword = existing.rows[0].PASSWORD;

    let finalUsername = null;
    let finalPassword = null;

    if (hasUsername) {
      if (hasPassword) {
        finalPassword = password;
      } else if (existingUsername) {
        // Keeping the existing login's password unchanged.
        finalPassword = existingPassword;
      } else {
        return res.status(400).json({
          success: false,
          message: "A password is required to set up a login for this vendor."
        });
      }
      finalUsername = trimmedUsername;

      if (finalUsername !== existingUsername) {
        const check = await conn.execute(
          `SELECT VendID FROM VENDORS WHERE username = :username AND VendID != :vendId`,
          { username: finalUsername, vendId }
        );
        if (check.rows.length > 0) {
          return res.status(409).json({ success: false, message: "Username already taken." });
        }
      }
    }
    // else: username left blank -> finalUsername/finalPassword stay null,
    // which clears the login if one existed.

    await conn.execute(
      `UPDATE VENDORS
          SET VendName      = :name,
              VendAddress   = :address,
              VendPhoneNum  = :phone,
              username      = :username,
              password      = :password
        WHERE VendID = :vendId`,
      {
        name,
        address:  address || null,
        phone:    phone || null,
        username: finalUsername,
        password: finalPassword,
        vendId
      },
      { autoCommit: true }
    );

    return res.json({
      success: true,
      message: hasUsername ? "Vendor updated successfully." : "Vendor updated (login removed)."
    });

  } catch (err) {
    if (err.errorNum === 1) {
      return res.status(409).json({ success: false, message: "Username already exists." });
    }
    console.error("[VENDOR PUT ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not update vendor." });
  } finally {
    if (conn) await conn.close();
  }
});

// ── DELETE /api/vendors/:id ──────────────────────────────────
// Blocked if this vendor has any PURCHASE records — deleting them
// would corrupt purchase history. Move/clear those first.
router.delete("/vendors/:id", async (req, res) => {
  const vendId = Number(req.params.id);

  if (!vendId) {
    return res.status(400).json({ success: false, message: "Invalid vendor ID." });
  }

  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `DELETE FROM VENDORS WHERE VendID = :vendId`,
      { vendId },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ success: false, message: "Vendor not found." });
    }

    return res.json({ success: true, message: "Vendor deleted successfully." });

  } catch (err) {
    console.error("[VENDOR DELETE ERROR]", err);
    return res.status(500).json({ success: false, message: "Could not delete vendor." });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;