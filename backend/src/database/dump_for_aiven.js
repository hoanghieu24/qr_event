const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function dump() {
  const conn = await mysql.createConnection('mysql://root:1234567@127.0.0.1:3306/event_qr_db');
  const [tables] = await conn.query('SHOW TABLES');

  let fullSql = '-- ========================================================\n' +
    '-- KTSQR PRODUCTION DATABASE DUMP FOR AIVEN MYSQL\n' +
    '-- Date: ' + new Date().toISOString() + '\n' +
    '-- ========================================================\n\n' +
    'SET FOREIGN_KEY_CHECKS = 0;\n\n';

  for (const row of tables) {
    const tableName = Object.values(row)[0];
    const [createRes] = await conn.query('SHOW CREATE TABLE `' + tableName + '`');
    fullSql += 'DROP TABLE IF EXISTS `' + tableName + '`;\n';
    fullSql += createRes[0]['Create Table'] + ';\n\n';

    const [rows] = await conn.query('SELECT * FROM `' + tableName + '`');
    if (rows.length > 0) {
      for (const r of rows) {
        const cols = Object.keys(r).map((c) => '`' + c + '`').join(', ');
        const vals = Object.values(r)
          .map((v) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number') return v;
            if (v instanceof Date) {
              return "'" + v.toISOString().slice(0, 19).replace('T', ' ') + "'";
            }
            if (typeof v === 'object') {
              return "'" + JSON.stringify(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
            }
            return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
          })
          .join(', ');
        fullSql += 'INSERT INTO `' + tableName + '` (' + cols + ') VALUES (' + vals + ');\n';
      }
      fullSql += '\n';
    }
  }

  fullSql += 'SET FOREIGN_KEY_CHECKS = 1;\n';
  const outPath = path.resolve(__dirname, '../../aiven_database_dump.sql');
  fs.writeFileSync(outPath, fullSql);
  console.log('✅ Dump written to:', outPath, 'Bytes:', fullSql.length);
  await conn.end();
}

dump().catch(console.error);

