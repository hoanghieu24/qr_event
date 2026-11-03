import bcrypt from 'bcrypt';
import { pool, query } from '../config/database';

async function seed() {
  console.log('🌱 Đang nạp dữ liệu mẫu (Seeding)...');

  try {
    // 1. Seed Permissions
    const permissions = [
      { code: 'events:create', name: 'Tạo sự kiện', description: 'Tạo sự kiện mới trong hệ thống' },
      { code: 'events:manage', name: 'Quản lý sự kiện', description: 'Chỉnh sửa, cập nhật trạng thái sự kiện' },
      { code: 'staff:manage', name: 'Quản lý nhân viên', description: 'Tạo tài khoản và gán permission cho nhân viên' },
      { code: 'invite:create', name: 'Tạo link mời', description: 'Tạo link mời khách cho sự kiện kèm chữ ký' },
      { code: 'registrations:view_own', name: 'Xem khách của mình', description: 'Xem danh sách khách đăng ký qua link cá nhân' },
      { code: 'registrations:approve', name: 'Duyệt khách', description: 'Duyệt hoặc từ chối khách và cấp mã QR' },
      { code: 'tickets:scan', name: 'Quét QR Check-in', description: 'Quét mã QR tại cổng và xem thông tin vé' },
      { code: 'customer:dispute_manage', name: 'Quản lý khách hàng', description: 'Xử lý các ca QR đã dùng (cho vào thủ công / từ chối)' },
      { code: 'reports:view', name: 'Xem báo cáo', description: 'Xem dashboard tổng hợp và thống kê' },
    ];

    for (const p of permissions) {
      await query(
        `INSERT INTO permissions (code, name, description) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
        [p.code, p.name, p.description]
      );
    }
    console.log('✅ Đã nạp danh mục Permissions.');

    // Helper map of permissions
    const permRows = await query<any[]>('SELECT id, code FROM permissions');
    const permMap: Record<string, number> = {};
    permRows.forEach((r) => {
      permMap[r.code] = r.id;
    });

    // 2. Seed Users
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    const staffPasswordHash = await bcrypt.hash('Staff@123', 10);

    // Admin
    await query(
      `INSERT INTO users (type, name, phone, email, password_hash, status)
       VALUES ('ADMIN', 'Tổng Quản Trị Viên', '0900000001', 'admin@eventqr.com', ?, 'ACTIVE')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [passwordHash]
    );

    // Staff A, B, C (Referrers)
    const staffReferrers = [
      { name: 'Nguyễn Văn A (Giới thiệu 1)', email: 'staff_a@eventqr.com', phone: '0900000002' },
      { name: 'Trần Thị B (Giới thiệu 2)', email: 'staff_b@eventqr.com', phone: '0900000003' },
      { name: 'Lê Văn C (Giới thiệu 3)', email: 'staff_c@eventqr.com', phone: '0900000004' },
    ];

    for (const s of staffReferrers) {
      await query(
        `INSERT INTO users (type, name, phone, email, password_hash, status)
         VALUES ('STAFF', ?, ?, ?, ?, 'ACTIVE')
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [s.name, s.phone, s.email, staffPasswordHash]
      );

      // Assign invite & approve permissions
      const [u] = await query<any[]>('SELECT id FROM users WHERE email = ?', [s.email]);
      if (u) {
        const assigned = ['invite:create', 'registrations:view_own', 'registrations:approve'];
        for (const code of assigned) {
          await query(
            `INSERT IGNORE INTO user_permissions (user_id, permission_id) VALUES (?, ?)`,
            [u.id, permMap[code]]
          );
        }
      }
    }

    // Staff D (Check-in Scanner)
    await query(
      `INSERT INTO users (type, name, phone, email, password_hash, status)
       VALUES ('STAFF', 'Phạm Văn D (Soát vé Check-in)', '0900000005', 'staff_d@eventqr.com', ?, 'ACTIVE')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [staffPasswordHash]
    );
    const [userD] = await query<any[]>('SELECT id FROM users WHERE email = ?', ['staff_d@eventqr.com']);
    if (userD) {
      await query(
        `INSERT IGNORE INTO user_permissions (user_id, permission_id) VALUES (?, ?)`,
        [userD.id, permMap['tickets:scan']]
      );
    }

    // Staff E (Quản lý khách hàng - Customer Dispute Manager)
    await query(
      `INSERT INTO users (type, name, phone, email, password_hash, status)
       VALUES ('STAFF', 'Hoàng Thị E (Quản lý khách hàng)', '0900000006', 'staff_e@eventqr.com', ?, 'ACTIVE')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [staffPasswordHash]
    );
    const [userE] = await query<any[]>('SELECT id FROM users WHERE email = ?', ['staff_e@eventqr.com']);
    if (userE) {
      await query(
        `INSERT IGNORE INTO user_permissions (user_id, permission_id) VALUES (?, ?), (?, ?)`,
        [userE.id, permMap['customer:dispute_manage'], userE.id, permMap['tickets:scan']]
      );
    }

    // 3. Seed Sample Event
    const [adminUser] = await query<any[]>('SELECT id FROM users WHERE email = ?', ['admin@eventqr.com']);
    await query(
      `INSERT INTO events (id, name, description, location, poster_url, start_at, end_at, capacity, status, created_by)
       VALUES (1, 'Hội nghị Công nghệ & Chuyển đổi số TechSummit 2026', 
               'Sự kiện thường niên kết nối hơn 500 nhà lãnh đạo công nghệ, kiến trúc sư phần mềm và chuyên gia AI.',
               'Trung tâm Hội nghị Quốc gia, Đại lộ Thăng Long, Mễ Trì, Nam Từ Liêm, Hà Nội',
               'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
               '2026-10-15 08:30:00', '2026-10-15 17:30:00', 500, 'PUBLISHED', ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [adminUser.id]
    );
    console.log('✅ Đã nạp sự kiện mẫu.');

    const [sampleEvent] = await query<any[]>('SELECT id FROM events WHERE id = 1 LIMIT 1');
    if (sampleEvent) {
      const sampleTeam = [
        { email: 'staff_a@eventqr.com', can_invite: 1, can_approve: 1, can_scan: 0 },
        { email: 'staff_b@eventqr.com', can_invite: 1, can_approve: 1, can_scan: 0 },
        { email: 'staff_d@eventqr.com', can_invite: 0, can_approve: 0, can_scan: 1 },
      ];
      for (const member of sampleTeam) {
        const [user] = await query<any[]>('SELECT id FROM users WHERE email = ?', [member.email]);
        if (!user) continue;
        await query(
          `INSERT INTO staff_event_quotas
            (event_id, staff_id, max_invites, is_enabled, can_invite, can_approve, can_scan, can_view_report)
           VALUES (?, ?, 100, 1, ?, ?, ?, 0)
           ON DUPLICATE KEY UPDATE is_enabled = 1, can_invite = VALUES(can_invite),
             can_approve = VALUES(can_approve), can_scan = VALUES(can_scan), can_view_report = 0`,
          [sampleEvent.id, user.id, member.can_invite, member.can_approve, member.can_scan]
        );
      }
      console.log('✅ Đã phân quyền mẫu cho nhân viên mời, duyệt và quét vé.');
    }

    console.log('🎉 Seed dữ liệu hoàn tất!');
    console.log('----------------------------------------------------');
    console.log('Tài khoản mẫu:');
    console.log('1. Admin: admin@eventqr.com / Admin@123 (Toàn quyền)');
    console.log('2. NV Giới thiệu A: staff_a@eventqr.com / Staff@123');
    console.log('3. NV Soát vé D: staff_d@eventqr.com / Staff@123 (Quét QR)');
    console.log('4. NV Quản lý KH E: staff_e@eventqr.com / Staff@123 (Xử lý Dispute)');
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('❌ Lỗi khi nạp dữ liệu:', error);
  } finally {
    await pool.end();
  }
}

seed();
