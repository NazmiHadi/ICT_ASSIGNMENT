const oracledb = require("oracledb");

const DB_CONFIG = {
  user:          "KurmaAjwa",
  password:      "oracle",
  connectString: "localhost:1521/FREEPDB1"
};

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function getConnection() {
  return await oracledb.getConnection(DB_CONFIG);
}

module.exports = { getConnection, oracledb };