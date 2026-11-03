import { query } from '../../config/database';

async function addColumn(table: string, definition: string) {
  try {
    await query(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  } catch (error: any) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }
}

export async function runV6Migration() {
  console.log('Running V6 Payment and Tenant Assignment migration...');

  await addColumn('events', "payment_status ENUM('PAID', 'PENDING_PAYMENT') NOT NULL DEFAULT 'PAID'");
  await addColumn('events', 'payment_note VARCHAR(255) NULL');
  await addColumn('events', 'paid_at DATETIME NULL');

  // Insert default bank settings if missing
  await query(`
    INSERT IGNORE INTO system_settings (\`key\`, \`value\`) VALUES
    ('bank_code', 'MB'),
    ('bank_name', 'MBBank'),
    ('bank_account', '0386771868'),
    ('bank_account_name', 'KTS QR EVENT'),
    ('bank_qr_template', 'compact2')
  `);

  console.log('V6 Migration completed successfully.');
}

runV6Migration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('V6 Migration failed:', err);
    process.exit(1);
  });

