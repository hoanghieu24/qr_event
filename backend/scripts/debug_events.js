const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '1234567',
    database: process.env.DB_NAME || 'event_qr_db'
  });

  const [users] = await conn.query('SELECT id, name, email, type, status FROM users');
  console.log('=== USERS ===');
  console.table(users);

  const [events] = await conn.query('SELECT id, name, status, start_at, end_at FROM events');
  console.log('=== EVENTS ===');
  console.table(events);

  const [quotas] = await conn.query('SELECT * FROM staff_event_quotas');
  console.log('=== STAFF EVENT QUOTAS ===');
  console.table(quotas);

  const [registrations] = await conn.query('SELECT id, event_id, full_name, phone, status, ticket_code, referrer_id FROM registrations');
  console.log('=== REGISTRATIONS ===');
  console.table(registrations);

  await conn.end();
}

main().catch(console.error);
