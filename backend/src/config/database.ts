import mysql from 'mysql2/promise';
import { ENV } from './env';

export const pool = mysql.createPool(
  ENV.DATABASE_URL
    ? {
        uri: ENV.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        multipleStatements: true,
        timezone: '+07:00',
      }
    : {
        host: ENV.DB_HOST,
        port: ENV.DB_PORT,
        user: ENV.DB_USER,
        password: ENV.DB_PASSWORD,
        database: ENV.DB_NAME,
        ssl: ENV.DB_SSL ? { rejectUnauthorized: false } : undefined,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        multipleStatements: true,
        timezone: '+07:00',
      }
);

// Helper for database queries
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await pool.query(sql, params);
  return rows as T;
}

// Helper to run transaction
export async function withTransaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
