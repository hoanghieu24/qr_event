/**
 * Dọn sạch toàn bộ dữ liệu sự kiện, GIỮ NGUYÊN tài khoản, tenant, gói dịch vụ, phân quyền, cài đặt hệ thống.
 *
 * Chạy thử (không xoá):   node scripts/cleanup-events.js --dry-run
 * Chạy thật:              node scripts/cleanup-events.js --confirm
 * Chạy trên DB online:    $env:DATABASE_URL="mysql://..."; node scripts/cleanup-events.js --confirm
 *
 * Yêu cầu: đã `npm run build` (script dùng dist/src/config/database).
 */
const { pool } = require('../dist/src/config/database');

const DRY_RUN = process.argv.includes('--dry-run');
const CONFIRM = process.argv.includes('--confirm');

// Thứ tự xoá: bảng con trước, bảng cha sau
const EVENT_TABLES = [
  'disputes',
  'scan_logs',
  'tickets',
  'registrations',
  'invite_links',
  'staff_event_quotas',
  'subscription_requests', // yêu cầu mua gói gắn theo từng sự kiện (FK RESTRICT -> events)
  'audit_logs',
  'events',
];

const KEEP_TABLES = ['users', 'tenants', 'tenant_users', 'user_permissions', 'permissions', 'subscription_plans', 'plan_tenants', 'tenant_subscriptions', 'system_settings'];

async function tableExists(conn, name) {
  const [rows] = await conn.query('SHOW TABLES LIKE ?', [name]);
  return rows.length > 0;
}

async function counts(conn, tables) {
  const out = {};
  for (const t of tables) {
    if (!(await tableExists(conn, t))) continue;
    const [rows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t}\``);
    out[t] = Number(rows[0].c);
  }
  return out;
}

(async () => {
  if (!DRY_RUN && !CONFIRM) {
    console.error('Thêm --dry-run để chạy thử hoặc --confirm để xoá thật.');
    process.exit(1);
  }

  const conn = await pool.getConnection();
  try {
    const [[dbInfo]] = await conn.query('SELECT DATABASE() AS db, @@hostname AS host');
    console.log(`DB: ${dbInfo.db} @ ${dbInfo.host}`);
    console.log('TRƯỚC  - Dữ liệu sự kiện:', JSON.stringify(await counts(conn, EVENT_TABLES)));
    console.log('TRƯỚC  - Dữ liệu giữ lại:', JSON.stringify(await counts(conn, KEEP_TABLES)));

    if (DRY_RUN) {
      console.log('DRY RUN: không xoá gì.');
      return;
    }

    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of EVENT_TABLES) {
      if (!(await tableExists(conn, t))) continue;
      await conn.query(`DELETE FROM \`${t}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Reset lượt dùng của tenant & gói, xoá OTP cũ còn sót
    await conn.query('UPDATE tenants SET free_events_used = 0');
    if (await tableExists(conn, 'tenant_subscriptions')) {
      await conn.query('UPDATE tenant_subscriptions SET events_used = 0');
    }
    await conn.query('UPDATE users SET otp_code = NULL, otp_expires_at = NULL');
    await conn.commit();

    // Reset AUTO_INCREMENT để ID sự kiện / vé bắt đầu lại từ 1
    for (const t of EVENT_TABLES) {
      if (!(await tableExists(conn, t))) continue;
      await conn.query(`ALTER TABLE \`${t}\` AUTO_INCREMENT = 1`);
    }

    console.log('SAU    - Dữ liệu sự kiện:', JSON.stringify(await counts(conn, EVENT_TABLES)));
    console.log('SAU    - Dữ liệu giữ lại:', JSON.stringify(await counts(conn, KEEP_TABLES)));
    console.log('✅ Đã dọn sạch dữ liệu sự kiện.');
  } catch (e) {
    try { await conn.query('SET FOREIGN_KEY_CHECKS = 1'); await conn.rollback(); } catch (_) {}
    console.error('❌ Lỗi, đã rollback:', e.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
})();
