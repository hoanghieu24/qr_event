import http from 'http';
import app from './app';
import { ENV } from './config/env';
import { pool } from './config/database';
import { initSocketServer } from './realtime/socket';

async function bootstrap() {
  try {
    // Test database connection
    const connection = await pool.getConnection();
    console.log(`✅ Kết nối cơ sở dữ liệu MySQL thành công (${ENV.DB_HOST}:${ENV.DB_PORT}/${ENV.DB_NAME})`);
    connection.release();

    const httpServer = http.createServer(app);
    initSocketServer(httpServer);

    httpServer.listen(ENV.PORT, '0.0.0.0', () => {
      console.log(`🚀 Máy chủ Backend Event-QR đang chạy tại: http://localhost:${ENV.PORT}`);
      console.log(`📡 Chế độ môi trường: ${ENV.NODE_ENV}`);
      console.log(`📧 Cấu hình SMTP: ${ENV.SMTP_HOST}:${ENV.SMTP_PORT}`);
      console.log(`⚡ WebSocket / Socket.IO Realtime Server đã khởi động thành công!`);
    });
  } catch (error) {
    console.error('❌ Không thể khởi động máy chủ:', error);
    process.exit(1);
  }
}

bootstrap();

