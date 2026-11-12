const { query, pool } = require('../dist/src/config/database');

(async () => {
  await query("UPDATE system_settings SET value = 'EventGo.vn' WHERE `key` = 'smtp_from_name'");
  await query("UPDATE system_settings SET value = 'Ban Tổ Chức EventGo.vn' WHERE `key` = 'smtp_sender_name'");
  const rows = await query("SELECT * FROM system_settings WHERE `key` IN ('smtp_from_name', 'smtp_sender_name')");
  console.log('UPDATED:', JSON.stringify(rows));
  await pool.end();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
