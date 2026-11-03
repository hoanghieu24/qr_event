import { query } from '../src/config/database';

async function main() {
  const users = await query('SELECT u.id, u.name, u.email, u.type, u.status, tu.tenant_id, tu.role as tenant_role FROM users u LEFT JOIN tenant_users tu ON tu.user_id = u.id WHERE u.email LIKE ?', ['%hvan%']);
  console.log(JSON.stringify(users, null, 2));
  process.exit(0);
}

main().catch(console.error);

