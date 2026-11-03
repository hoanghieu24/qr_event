import { query } from '../../config/database';

export async function runV2Migration() {
  console.log('🔄 Running V2 database migration...');

  try {
    await query(`
      ALTER TABLE events 
      ADD COLUMN approval_mode ENUM('REFERRER_ONLY', 'TWO_TIER', 'AUTO') NOT NULL DEFAULT 'REFERRER_ONLY'
    `);
    console.log('✅ Added approval_mode column to events');
  } catch (e: any) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ Column approval_mode already exists in events');
    } else {
      console.error('Error adding approval_mode:', e.message);
    }
  }

  try {
    await query(`
      ALTER TABLE registrations 
      MODIFY COLUMN status ENUM('PENDING', 'PENDING_ADMIN', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING'
    `);
    console.log('✅ Updated registrations status enum to include PENDING_ADMIN');
  } catch (e: any) {
    console.error('Error modifying registrations status:', e.message);
  }

  try {
    await query(`
      ALTER TABLE invite_links 
      MODIFY COLUMN status ENUM('ACTIVE', 'REVOKED', 'EXPIRED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE'
    `);
    console.log('✅ Updated invite_links status enum to include CLOSED');
  } catch (e: any) {
    console.error('Error modifying invite_links status:', e.message);
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS staff_event_quotas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id INT NOT NULL,
        staff_id INT NOT NULL,
        max_invites INT NOT NULL DEFAULT 50,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_event_staff (event_id, staff_id),
        CONSTRAINT fk_seq_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
        CONSTRAINT fk_seq_staff FOREIGN KEY (staff_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Created staff_event_quotas table');
  } catch (e: any) {
    console.error('Error creating staff_event_quotas:', e.message);
  }

  console.log('🎉 V2 Migration complete!');
}

runV2Migration().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
