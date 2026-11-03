const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '1234567',
    database: process.env.DB_NAME || 'event_qr_db'
  });
  
  // 1. Update hvan86771@gmail.com to ADMIN
  await conn.query("UPDATE users SET type = 'ADMIN' WHERE email = 'hvan86771@gmail.com'");
  console.log('Updated hvan86771@gmail.com to ADMIN!');

  // 2. Extend end_at for published events so they stay active for testing
  await conn.query("UPDATE events SET end_at = '2026-12-31 23:59:59' WHERE status = 'PUBLISHED'");
  console.log('Extended end_at for all published events to end of 2026!');

  // 3. Ensure all staff & user 28 have quotas in events 2, 3, 4, 5
  const staffIds = [1, 2, 3, 4, 5, 6, 28];
  const eventIds = [2, 3, 4, 5];
  for (const eid of eventIds) {
    for (const sid of staffIds) {
      await conn.query(`
        INSERT INTO staff_event_quotas (event_id, staff_id, max_invites, is_enabled, can_invite, can_approve, can_scan, can_view_report)
        VALUES (?, ?, 100, 1, 1, 1, 1, 1)
        ON DUPLICATE KEY UPDATE is_enabled = 1, can_invite = 1, can_approve = 1, can_scan = 1, can_view_report = 1
      `, [eid, sid]);
    }
  }
  console.log('Quotas configured for all staff across active events!');

  const [evs] = await conn.query("SELECT id, name, status, end_at FROM events");
  console.table(evs);

  await conn.end();
}

run().catch(console.error);
