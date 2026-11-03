import { query } from '../../config/database';

export async function runV4Migration() {
  console.log('Running V4 tenant portal migration...');

  await query(`
    ALTER TABLE users
    MODIFY COLUMN type ENUM('ADMIN', 'STAFF', 'CUSTOMER', 'TENANT_ADMIN') NOT NULL
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      contact_name VARCHAR(150) NOT NULL,
      contact_email VARCHAR(150) NOT NULL,
      phone VARCHAR(20) NULL,
      status ENUM('ACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
      free_events_used INT NOT NULL DEFAULT 0,
      created_by INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_tenants_creator FOREIGN KEY (created_by) REFERENCES users (id),
      INDEX idx_tenants_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await query('ALTER TABLE tenants ADD COLUMN free_events_used INT NOT NULL DEFAULT 0');
  } catch (error: any) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS tenant_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      user_id INT NOT NULL,
      role ENUM('OWNER', 'TEAM') NOT NULL DEFAULT 'OWNER',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tenant_user (tenant_id, user_id),
      INDEX idx_tenant_users_tenant (tenant_id),
      CONSTRAINT fk_tu_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
      CONSTRAINT fk_tu_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(60) NOT NULL UNIQUE,
      name VARCHAR(150) NOT NULL,
      description TEXT NULL,
      event_credits INT NOT NULL,
      validity_days INT NOT NULL,
      price_vnd BIGINT UNSIGNED NOT NULL,
      status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tenant_subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      plan_id INT NOT NULL,
      event_credits INT NOT NULL,
      events_used INT NOT NULL DEFAULT 0,
      status ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
      starts_at DATETIME NOT NULL,
      ends_at DATETIME NOT NULL,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tenant_subscription_active (tenant_id, status, ends_at),
      CONSTRAINT fk_ts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
      CONSTRAINT fk_ts_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans (id),
      CONSTRAINT fk_ts_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS subscription_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      plan_id INT NOT NULL,
      event_credits INT NOT NULL,
      validity_days INT NOT NULL,
      price_vnd BIGINT UNSIGNED NOT NULL,
      status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME NULL,
      reviewed_by INT NULL,
      review_note VARCHAR(500) NULL,
      INDEX idx_subscription_requests_status (status, requested_at),
      CONSTRAINT fk_sr_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
      CONSTRAINT fk_sr_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans (id),
      CONSTRAINT fk_sr_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  for (const statement of [
    'ALTER TABLE subscription_requests ADD COLUMN event_credits INT NOT NULL DEFAULT 0',
    'ALTER TABLE subscription_requests ADD COLUMN validity_days INT NOT NULL DEFAULT 0',
    'ALTER TABLE subscription_requests ADD COLUMN price_vnd BIGINT UNSIGNED NOT NULL DEFAULT 0',
  ]) {
    try {
      await query(statement);
    } catch (error: any) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
  await query(`
    UPDATE subscription_requests sr
    JOIN subscription_plans p ON p.id = sr.plan_id
    SET sr.event_credits = p.event_credits, sr.validity_days = p.validity_days, sr.price_vnd = p.price_vnd
    WHERE sr.event_credits = 0 OR sr.validity_days = 0
  `);

  try {
    await query('ALTER TABLE events ADD COLUMN tenant_id INT NULL');
  } catch (error: any) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }

  try {
    await query(`
      ALTER TABLE events
      ADD CONSTRAINT fk_events_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE SET NULL
    `);
  } catch (error: any) {
    if (error.code !== 'ER_FK_DUP_NAME') throw error;
  }

  try {
    await query('CREATE INDEX idx_events_tenant_start ON events (tenant_id, start_at)');
  } catch (error: any) {
    if (error.code !== 'ER_DUP_KEYNAME') throw error;
  }

  console.log('V4 tenant portal migration complete.');
}

runV4Migration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('V4 tenant portal migration failed:', error);
    process.exit(1);
  });
