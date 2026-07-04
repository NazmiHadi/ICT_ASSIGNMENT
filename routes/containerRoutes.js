// routes/containerRoutes.js
const express = require("express");
const router = express.Router();
const { getConnection, oracledb } = require("../config/db");


// ===============================
// GET ALL CONTAINERS
// ===============================
router.get("/containers", async (req, res) => {
    let conn;

    try {
        conn = await getConnection();

        const result = await conn.execute(
            `SELECT ContID,
                    ContName,
                    ContDate,
                    ContColour
             FROM CONTAINERS
             ORDER BY ContID`,
            [],
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );

        res.json({
            success: true,
            containers: result.rows.map(row => ({
                container_id: row.CONTID,
                name: row.CONTNAME,
                date: row.CONTDATE,
                colour: row.CONTCOLOUR
            }))
        });

    } catch (err) {
    console.error(err);

    return res.status(500).json({
        success: false,
        message: err.message
    });
} finally {
        if (conn) await conn.close();
    }
});


// ===============================
// ADD CONTAINER
// ===============================
router.post("/containers", async (req, res) => {

    const { name, date, colour } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            message: "Container name is required."
        });
    }

    let conn;

    try {

        conn = await getConnection();

        const result = await conn.execute(
            `INSERT INTO CONTAINERS
                (ContName, ContDate, ContColour)
            VALUES
                (:name, :contDate, :colour)
            RETURNING ContID INTO :newId`,
            {
                name: name,
                contDate: date ? new Date(date) : null,
                colour: colour || null,
                newId: {
                    dir: oracledb.BIND_OUT,
                    type: oracledb.NUMBER
                }
            },
            { autoCommit: true }
        );

        // Fixed: the bind variable above is named "newId", so it must be
        // read back as result.outBinds.newId (there is no ".id" key —
        // that mismatch was throwing "Cannot read properties of
        // undefined (reading '0')" right after the insert had already
        // committed successfully).
        res.status(201).json({
            success: true,
            message: "Container added successfully.",
            container_id: result.outBinds.newId[0]
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }finally {
        if (conn) await conn.close();
    }

});

module.exports = router;