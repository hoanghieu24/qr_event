// Backup các bảng sự kiện ra JSON trước khi dọn. Usage: node scripts/backup-event-tables.js <output.json>
const fs = require('fs');
const { pool } = require('../dist/src/config/database');
const TABLES = ['disputes', 'scan_logs', 'tickets', 'registrations', 'invite_links', 'staff_event_quotas', 'subscription_requests', 'audit_logs', 'events', 'tenants', 'tenant_subscriptions'];
(async () => {
  const out = process.argv[2] || `backup_events_${Date.now()}.json`;
  const data = {};
  for (const t of TABLES) {
    const [exists] = await pool.query('SHOW TABLES LIKE ?', [t]);
    if (!exists.length) continue;
    const [rows] = await pool.query(`SELECT * FROM \`${t}\``);
    data[t] = rows;
  }
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  console.log('BACKUP OK ->', out, Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])));
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
