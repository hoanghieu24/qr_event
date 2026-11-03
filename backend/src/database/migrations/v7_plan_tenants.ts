import { query } from '../../config/database';

async function addColumn(table: string, definition: string) {
  try {
    await query(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  } catch (error: any) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }
}

export async function runV7Migration() {
  console.log('Running V7 Plan Tenants Migration...');

  await addColumn('subscription_plans', 'for_all_tenants TINYINT(1) NOT NULL DEFAULT 1');

  await query(`
    CREATE TABLE IF NOT EXISTS \`plan_tenants\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`plan_id\` INT NOT NULL,
      \`tenant_id\` INT NOT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY \`uq_plan_tenant\` (\`plan_id\`, \`tenant_id\`),
      CONSTRAINT \`fk_pt_plan\` FOREIGN KEY (\`plan_id\`) REFERENCES \`subscription_plans\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_pt_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('V7 Migration completed successfully.');
}

runV7Migration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('V7 Migration failed:', err);
    process.exit(1);
  });

