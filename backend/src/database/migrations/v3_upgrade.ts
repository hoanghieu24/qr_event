import { query } from '../../config/database';

export async function runV3Migration() {
  console.log('🔄 Running V3 database migration (Geofencing & System Settings)...');

  // 1. Add geofencing columns to events table
  const columnsToAdd = [
    { name: 'latitude', def: 'DECIMAL(10, 8) NULL' },
    { name: 'longitude', def: 'DECIMAL(11, 8) NULL' },
    { name: 'geofence_radius_meters', def: 'INT NOT NULL DEFAULT 500' },
    { name: 'geofence_enabled', def: 'TINYINT(1) NOT NULL DEFAULT 0' },
  ];

  for (const col of columnsToAdd) {
    try {
      await query(`ALTER TABLE events ADD COLUMN ${col.name} ${col.def}`);
      console.log(`✅ Added column ${col.name} to events`);
    } catch (e: any) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log(`ℹ️ Column ${col.name} already exists in events`);
      } else {
        console.error(`Error adding column ${col.name}:`, e.message);
      }
    }
  }

  // 2. Create system_settings table
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        \`key\` VARCHAR(100) PRIMARY KEY,
        \`value\` TEXT NOT NULL,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Created system_settings table');
  } catch (e: any) {
    console.error('Error creating system_settings:', e.message);
  }

  // 3. Seed default system settings
  const defaultSettings = [
    { key: 'smtp_host', value: 'smtp.gmail.com' },
    { key: 'smtp_port', value: '587' },
    { key: 'smtp_user', value: 'noreply@eventqr.com' },
    { key: 'smtp_pass', value: '' },
    { key: 'smtp_sender_name', value: 'Ban Tổ Chức KTSQR' },
    { key: 'email_on_approved', value: 'true' },
    { key: 'notify_hours_before', value: '24' },
    { key: 'geofence_default_radius', value: '500' },
  ];

  for (const s of defaultSettings) {
    try {
      await query(
        'INSERT IGNORE INTO system_settings (`key`, `value`) VALUES (?, ?)',
        [s.key, s.value]
      );
    } catch (e: any) {
      console.error(`Error seeding setting ${s.key}:`, e.message);
    }
  }
  console.log('✅ Seeded default system settings');

  console.log('🎉 V3 Migration complete!');
}

runV3Migration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
