import http from 'http';
import fs from 'fs';
import path from 'path';
import app from './app';
import { ENV } from './config/env';
import { pool } from './config/database';
import { initSocketServer } from './realtime/socket';
import { InvitesService } from './modules/invites/invites.service';

async function autoInitDatabaseIfEmpty() {
  let connection: any = null;
  try {
    connection = await pool.getConnection();
    const [tables]: any = await connection.query("SHOW TABLES LIKE 'users'");
    const exists = Array.isArray(tables) && tables.length > 0;
    if (!exists) {
      console.log('⚡ Chưa tìm thấy bảng users trên database. Đang tự động nạp aiven_database_dump.sql...');
      const candidatePaths = [
        path.resolve(process.cwd(), 'aiven_database_dump.sql'),
        path.resolve(process.cwd(), 'backend', 'aiven_database_dump.sql'),
        path.resolve(__dirname, '../aiven_database_dump.sql'),
        path.resolve(__dirname, '../../aiven_database_dump.sql'),
      ];
      const dumpPath = candidatePaths.find((p) => fs.existsSync(p));
      if (dumpPath) {
        const dumpSql = fs.readFileSync(dumpPath, 'utf-8');
        const statements = dumpSql
          .split(/;\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));

        console.log(`📌 Bắt đầu nạp ${statements.length} câu lệnh SQL từ file ${dumpPath}...`);
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
        for (const sql of statements) {
          try {
            await connection.query(sql);
          } catch (e: any) {
            // Ignore minor errors or warnings during bulk load
          }
        }
        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('✅ Đã nạp thành công toàn bộ cơ sở dữ liệu và tài khoản mẫu vào MySQL!');
      } else {
        console.warn('⚠️ Không tìm thấy file aiven_database_dump.sql');
      }
    } else {
      console.log('✅ Cơ sở dữ liệu đã có sẵn các bảng.');
    }
  } catch (err: any) {
    console.error('⚠️ Không thể tự động khởi tạo database:', err.message);
  } finally {
    if (connection) connection.release();
  }
}

async function bootstrap() {
  try {
    // Test database connection
    const connection = await pool.getConnection();
    console.log(`✅ Kết nối cơ sở dữ liệu MySQL thành công (${ENV.DB_HOST}:${ENV.DB_PORT}/${ENV.DB_NAME})`);
    connection.release();

    // Auto-check and initialize tables if empty (e.g. freshly created Aiven DB)
    await autoInitDatabaseIfEmpty();

    // Nâng hạn mức nhân sự và soát vé cho các sự kiện thử nghiệm để thuận tiện test
    try {
      const conn = await pool.getConnection();
      await conn.query(`
        UPDATE events 
        SET max_scanners = GREATEST(max_scanners, 10), 
            max_referrers = GREATEST(max_referrers, 10), 
            max_employees = GREATEST(max_employees, 20)
        WHERE is_trial = 1 OR max_scanners < 10
      `);

      // Tự động đảm bảo cột legacy_token và rút ngắn toàn bộ link mời cũ
      try {
        await conn.query(`ALTER TABLE invite_links ADD COLUMN legacy_token VARCHAR(255) NULL AFTER token`);
      } catch (colErr: any) {
        // Cột đã tồn tại
      }

      const [longLinks]: any = await conn.query(`
        SELECT id, event_id, referrer_id, token 
        FROM invite_links 
        WHERE (LENGTH(token) > 12 OR token LIKE 'inv_%') AND status = 'ACTIVE'
      `);

      if (Array.isArray(longLinks) && longLinks.length > 0) {
        for (const l of longLinks) {
          const shortToken = await InvitesService.generateUniqueShortToken();
          const newSig = InvitesService.generateSignature(l.event_id, l.referrer_id, shortToken);
          await conn.query(
            `UPDATE invite_links SET legacy_token = COALESCE(legacy_token, token), token = ?, signature = ? WHERE id = ?`,
            [shortToken, newSig, l.id]
          );
        }
        console.log(`✅ Đã tự động rút gọn ${longLinks.length} link mời cũ sang dạng ngắn (8 ký tự).`);
      }

      // Đảm bảo mọi sự kiện PUBLISHED đều có ít nhất 1 link mời ACTIVE
      const [eventsWithoutInvites]: any = await conn.query(`
        SELECT e.id, e.created_by 
        FROM events e 
        WHERE e.status = 'PUBLISHED' 
          AND NOT EXISTS (SELECT 1 FROM invite_links il WHERE il.event_id = e.id AND il.status = 'ACTIVE')
      `);
      if (Array.isArray(eventsWithoutInvites) && eventsWithoutInvites.length > 0) {
        for (const ev of eventsWithoutInvites) {
          const shortToken = await InvitesService.generateUniqueShortToken();
          const refId = ev.created_by || 1;
          const newSig = InvitesService.generateSignature(ev.id, refId, shortToken);
          const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
          await conn.query(`
            INSERT INTO invite_links (event_id, referrer_id, token, signature, expires_at, max_registrations, status)
            VALUES (?, ?, ?, ?, ?, 1000, 'ACTIVE')
          `, [ev.id, refId, shortToken, newSig, expiresAt]);
        }
        console.log(`✅ Đã tự động tạo link mời chính thức cho ${eventsWithoutInvites.length} sự kiện đang hoạt động.`);
      }

      conn.release();
      console.log('✅ Đã cập nhật hạn mức nhân sự/soát vé tối thiểu 10 cho các sự kiện.');
    } catch (e: any) {
      console.warn('⚠️ Cập nhật hạn mức hoặc rút ngắn link thất bại:', e.message);
    }

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

