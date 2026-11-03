import { query } from '../../config/database';

async function addColumn(table: string, definition: string) {
  try {
    await query(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  } catch (error: any) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }
}

export async function runV5Migration() {
  console.log('Running V5 per-event package migration...');

  await addColumn('subscription_plans', 'max_attendees INT NOT NULL DEFAULT 500');
  await addColumn('subscription_plans', 'max_employees INT NOT NULL DEFAULT 10');
  await addColumn('subscription_plans', 'max_referrers INT NOT NULL DEFAULT 10');
  await addColumn('subscription_plans', 'max_scanners INT NOT NULL DEFAULT 10');
  await addColumn('subscription_plans', 'is_trial TINYINT(1) NOT NULL DEFAULT 0');

  await addColumn('subscription_requests', 'max_attendees INT NOT NULL DEFAULT 500');
  await addColumn('subscription_requests', 'max_employees INT NOT NULL DEFAULT 10');
  await addColumn('subscription_requests', 'max_referrers INT NOT NULL DEFAULT 10');
  await addColumn('subscription_requests', 'max_scanners INT NOT NULL DEFAULT 10');
  await addColumn('subscription_requests', 'event_id INT NULL');
  await addColumn('subscription_requests', 'package_name VARCHAR(150) NULL');

  await query(`
    UPDATE subscription_requests sr
    JOIN subscription_plans p ON p.id = sr.plan_id
    SET sr.max_attendees = p.max_attendees,
        sr.max_employees = p.max_employees,
        sr.max_referrers = p.max_referrers,
        sr.max_scanners = p.max_scanners,
        sr.package_name = p.name
    WHERE sr.package_name IS NULL
  `);

  await addColumn('events', 'package_request_id INT NULL');
  await addColumn('events', 'package_name VARCHAR(150) NULL');
  await addColumn('events', 'max_employees INT NOT NULL DEFAULT 10');
  await addColumn('events', 'max_referrers INT NOT NULL DEFAULT 10');
  await addColumn('events', 'max_scanners INT NOT NULL DEFAULT 10');
  await addColumn('events', 'package_price_vnd BIGINT UNSIGNED NOT NULL DEFAULT 0');
  await addColumn('events', 'is_trial TINYINT(1) NOT NULL DEFAULT 0');

  await addColumn('staff_event_quotas', 'is_enabled TINYINT(1) NOT NULL DEFAULT 1');
  await addColumn('staff_event_quotas', 'can_invite TINYINT(1) NOT NULL DEFAULT 1');
  await addColumn('staff_event_quotas', 'can_approve TINYINT(1) NOT NULL DEFAULT 1');
  await addColumn('staff_event_quotas', 'can_scan TINYINT(1) NOT NULL DEFAULT 1');
  await addColumn('staff_event_quotas', 'can_view_report TINYINT(1) NOT NULL DEFAULT 1');

  try {
    await query('ALTER TABLE subscription_requests ADD CONSTRAINT fk_sr_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE RESTRICT');
  } catch (error: any) {
    if (error.code !== 'ER_FK_DUP_NAME') throw error;
  }
  try {
    await query('CREATE UNIQUE INDEX uq_subscription_request_event ON subscription_requests (event_id)');
  } catch (error: any) {
    if (error.code !== 'ER_DUP_KEYNAME') throw error;
  }

  // Old credit/expiry packages cannot be mapped to a one-event tier safely.
  await query("UPDATE subscription_plans SET status = 'INACTIVE' WHERE event_credits > 1 OR validity_days > 1");
  console.log('V5 per-event package migration complete. Mark one zero-price package as the trial tier in admin.');
}

runV5Migration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('V5 per-event package migration failed:', error);
    process.exit(1);
  });
