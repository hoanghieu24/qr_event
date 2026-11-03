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

  const [usersWithOtp] = await conn.query('SELECT id, name, email, phone, otp_code, otp_expires_at FROM users WHERE otp_code IS NOT NULL ORDER BY id DESC');
  console.log('=== USERS WITH OTP ===');
  console.log(JSON.stringify(usersWithOtp, null, 2));

  const [recentUsers] = await conn.query('SELECT id, name, email, phone, type, otp_code, otp_expires_at, created_at, updated_at FROM users ORDER BY id DESC LIMIT 5');
  console.log('=== RECENT USERS ===');
  console.log(JSON.stringify(recentUsers, null, 2));

  const [recentRegs] = await conn.query('SELECT id, full_name, phone, email, status, ticket_id, created_at FROM registrations ORDER BY id DESC LIMIT 5');
  console.log('=== RECENT REGISTRATIONS ===');
  console.log(JSON.stringify(recentRegs, null, 2));

  const [recentTickets] = await conn.query('SELECT id, code, status, created_at FROM tickets ORDER BY id DESC LIMIT 5');
  console.log('=== RECENT TICKETS ===');
  console.log(JSON.stringify(recentTickets, null, 2));

  await conn.end();
}

main().catch(console.error);
