import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { ENV } from '../config/env';

async function migrate() {
  console.log('🔄 Đang bắt đầu Database Migration...');
  
  // Connect without DB first to ensure database exists
  const connection = await mysql.createConnection({
    host: ENV.DB_HOST,
    port: ENV.DB_PORT,
    user: ENV.DB_USER,
    password: ENV.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    const schemaSql = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf-8'
    );

    console.log(`📌 Đang thực thi schema.sql trên ${ENV.DB_HOST}:${ENV.DB_PORT}...`);
    await connection.query(schemaSql);
    console.log('✅ Migration cơ sở dữ liệu thành công!');
  } catch (error) {
    console.error('❌ Lỗi trong quá trình migration:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
