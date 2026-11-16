const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function dump() {
  const connectionConfig = process.env.DATABASE_URL
    ? { uri: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'event_qr_db',
      };
  const conn = await mysql.createConnection(connectionConfig);
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

