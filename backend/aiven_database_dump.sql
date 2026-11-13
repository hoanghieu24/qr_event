SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int DEFAULT NULL,
  `details` json DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_al_user` (`user_id`),
  KEY `idx_al_action` (`action`),
  KEY `idx_al_created_at` (`created_at`),
  CONSTRAINT `fk_al_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `disputes`;
CREATE TABLE `disputes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `scan_log_id` int NOT NULL,
  `ticket_id` int NOT NULL,
  `claimant_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `claimant_phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `explanation` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `recorded_by` int NOT NULL,
  `decided_by` int DEFAULT NULL,
  `decision` enum('PENDING','ALLOW','DENY') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `decision_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `decided_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_dsp_scanlog` (`scan_log_id`),
  KEY `fk_dsp_ticket` (`ticket_id`),
  KEY `fk_dsp_recorder` (`recorded_by`),
  KEY `fk_dsp_decider` (`decided_by`),
  KEY `idx_dsp_decision` (`decision`),
  CONSTRAINT `fk_dsp_decider` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_dsp_recorder` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dsp_scanlog` FOREIGN KEY (`scan_log_id`) REFERENCES `scan_logs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dsp_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `events`;
CREATE TABLE `events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `info_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `map_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `poster_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `start_at` datetime NOT NULL,
  `end_at` datetime NOT NULL,
  `registration_deadline` datetime DEFAULT NULL,
  `capacity` int NOT NULL DEFAULT '500',
  `session_mode` enum('FULL_DAY','SPLIT_SESSIONS') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FULL_DAY',
  `morning_capacity` int DEFAULT NULL,
  `afternoon_capacity` int DEFAULT NULL,
  `status` enum('DRAFT','PUBLISHED','CLOSED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PUBLISHED',
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `approval_mode` enum('REFERRER_ONLY','TWO_TIER','AUTO') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'REFERRER_ONLY',
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `geofence_radius_meters` int NOT NULL DEFAULT '500',
  `geofence_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `tenant_id` int DEFAULT NULL,
  `package_request_id` int DEFAULT NULL,
  `package_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_employees` int NOT NULL DEFAULT '10',
  `max_referrers` int NOT NULL DEFAULT '10',
  `max_scanners` int NOT NULL DEFAULT '10',
  `package_price_vnd` bigint unsigned NOT NULL DEFAULT '0',
  `is_trial` tinyint(1) NOT NULL DEFAULT '0',
  `payment_status` enum('PAID','PENDING_PAYMENT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PAID',
  `payment_note` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_events_creator` (`created_by`),
  KEY `idx_events_tenant_start` (`tenant_id`,`start_at`),
  CONSTRAINT `fk_events_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_events_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `invite_links`;
CREATE TABLE `invite_links` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `referrer_id` int NOT NULL,
  `token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `legacy_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `signature` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `max_registrations` int NOT NULL DEFAULT '100',
  `current_registrations` int NOT NULL DEFAULT '0',
  `session_type` enum('FULL_DAY','MORNING','AFTERNOON') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FULL_DAY',
  `status` enum('ACTIVE','REVOKED','EXPIRED','CLOSED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `fk_il_referrer` (`referrer_id`),
  KEY `idx_il_event_referrer` (`event_id`,`referrer_id`),
  KEY `idx_il_token` (`token`),
  CONSTRAINT `fk_il_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_il_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `permissions` (`id`, `code`, `name`, `description`, `created_at`) VALUES (1, 'events:create', 'Tạo sự kiện', 'Tạo sự kiện mới trong hệ thống', '2026-10-03 02:44:21');
INSERT INTO `permissions` (`id`, `code`, `name`, `description`, `created_at`) VALUES (2, 'events:manage', 'Quản lý sự kiện', 'Chỉnh sửa, cập nhật trạng thái sự kiện', '2026-10-03 02:44:21');
INSERT INTO `permissions` (`id`, `code`, `name`, `description`, `created_at`) VALUES (3, 'staff:manage', 'Quản lý nhân viên', 'Tạo tài khoản và gán permission cho nhân viên', '2026-10-03 02:44:21');
INSERT INTO `permissions` (`id`, `code`, `name`, `description`, `created_at`) VALUES (4, 'invite:create', 'Tạo link mời', 'Tạo link mời khách cho sự kiện kèm chữ ký', '2026-10-03 02:44:21');
INSERT INTO `permissions` (`id`, `code`, `name`, `description`, `created_at`) VALUES (5, 'registrations:view_own', 'Xem khách của mình', 'Xem danh sách khách đăng ký qua link cá nhân', '2026-10-03 02:44:21');
INSERT INTO `permissions` (`id`, `code`, `name`, `description`, `created_at`) VALUES (6, 'registrations:approve', 'Duyệt khách', 'Duyệt hoặc từ chối khách và cấp mã QR', '2026-10-03 02:44:21');
INSERT INTO `permissions` (`id`, `code`, `name`, `description`, `created_at`) VALUES (7, 'tickets:scan', 'Quét QR Check-in', 'Quét mã QR tại cổng và xem thông tin vé', '2026-10-03 02:44:21');
INSERT INTO `permissions` (`id`, `code`, `name`, `description`, `created_at`) VALUES (8, 'customer:dispute_manage', 'Quản lý khách hàng', 'Xử lý các ca QR đã dùng (cho vào thủ công / từ chối)', '2026-10-03 02:44:21');
INSERT INTO `permissions` (`id`, `code`, `name`, `description`, `created_at`) VALUES (9, 'reports:view', 'Xem báo cáo', 'Xem dashboard tổng hợp và thống kê', '2026-10-03 02:44:21');
DROP TABLE IF EXISTS `plan_tenants`;
CREATE TABLE `plan_tenants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plan_tenant` (`plan_id`,`tenant_id`),
  KEY `fk_pt_tenant` (`tenant_id`),
  CONSTRAINT `fk_pt_plan` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pt_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `registrations`;
CREATE TABLE `registrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `invite_link_id` int NOT NULL,
  `referrer_id` int NOT NULL,
  `full_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_type` enum('FULL_DAY','MORNING','AFTERNOON') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FULL_DAY',
  `status` enum('PENDING','PENDING_ADMIN','APPROVED','REJECTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `rejection_reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_customer` (`event_id`,`customer_id`),
  KEY `fk_reg_customer` (`customer_id`),
  KEY `fk_reg_invite` (`invite_link_id`),
  KEY `fk_reg_approver` (`approved_by`),
  KEY `idx_reg_referrer_status` (`referrer_id`,`status`),
  KEY `idx_reg_phone` (`phone`),
  CONSTRAINT `fk_reg_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reg_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reg_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reg_invite` FOREIGN KEY (`invite_link_id`) REFERENCES `invite_links` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reg_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `scan_logs`;
CREATE TABLE `scan_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int DEFAULT NULL,
  `event_id` int NOT NULL,
  `scanned_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `scanned_by` int NOT NULL,
  `result` enum('SUCCESS','INVALID','ALREADY_USED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_info` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scanned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_sl_event` (`event_id`),
  KEY `fk_sl_scanner` (`scanned_by`),
  KEY `idx_sl_ticket` (`ticket_id`),
  KEY `idx_sl_scanned_at` (`scanned_at`),
  CONSTRAINT `fk_sl_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sl_scanner` FOREIGN KEY (`scanned_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sl_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `staff_event_quotas`;
CREATE TABLE `staff_event_quotas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `staff_id` int NOT NULL,
  `max_invites` int NOT NULL DEFAULT '50',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `can_invite` tinyint(1) NOT NULL DEFAULT '1',
  `can_approve` tinyint(1) NOT NULL DEFAULT '1',
  `can_scan` tinyint(1) NOT NULL DEFAULT '1',
  `can_view_report` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_staff` (`event_id`,`staff_id`),
  KEY `fk_seq_staff` (`staff_id`),
  CONSTRAINT `fk_seq_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_seq_staff` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `subscription_plans`;
CREATE TABLE `subscription_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `event_credits` int NOT NULL,
  `validity_days` int NOT NULL,
  `price_vnd` bigint unsigned NOT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `max_attendees` int NOT NULL DEFAULT '500',
  `max_employees` int NOT NULL DEFAULT '10',
  `max_referrers` int NOT NULL DEFAULT '10',
  `max_scanners` int NOT NULL DEFAULT '10',
  `is_trial` tinyint(1) NOT NULL DEFAULT '0',
  `for_all_tenants` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `subscription_plans` (`id`, `code`, `name`, `description`, `event_credits`, `validity_days`, `price_vnd`, `status`, `created_at`, `updated_at`, `max_attendees`, `max_employees`, `max_referrers`, `max_scanners`, `is_trial`, `for_all_tenants`) VALUES (1, 'ktstesst-1792664557353', 'ktstesst', NULL, 1, 1, 0, 'INACTIVE', '2026-10-22 10:22:37', '2026-10-24 09:25:45', 200, 13, 10, 3, 1, 1);
INSERT INTO `subscription_plans` (`id`, `code`, `name`, `description`, `event_credits`, `validity_days`, `price_vnd`, `status`, `created_at`, `updated_at`, `max_attendees`, `max_employees`, `max_referrers`, `max_scanners`, `is_trial`, `for_all_tenants`) VALUES (2, 'goi-thu-nghiem-1792833945932', 'gói thử nghiệm', NULL, 1, 1, 0, 'ACTIVE', '2026-10-24 09:25:45', '2026-11-13 02:53:55', 50, 5, 2, 1, 1, 1);
INSERT INTO `subscription_plans` (`id`, `code`, `name`, `description`, `event_credits`, `validity_days`, `price_vnd`, `status`, `created_at`, `updated_at`, `max_attendees`, `max_employees`, `max_referrers`, `max_scanners`, `is_trial`, `for_all_tenants`) VALUES (3, 'test-goi-co-tien-1792990158899', 'test gói có tiền', NULL, 1, 1, 2000000, 'ACTIVE', '2026-10-26 04:49:18', '2026-10-26 04:49:18', 1000, 20, 15, 7, 0, 1);
DROP TABLE IF EXISTS `subscription_requests`;
CREATE TABLE `subscription_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `event_credits` int NOT NULL,
  `validity_days` int NOT NULL,
  `price_vnd` bigint unsigned NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `requested_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `review_note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_attendees` int NOT NULL DEFAULT '500',
  `max_employees` int NOT NULL DEFAULT '10',
  `max_referrers` int NOT NULL DEFAULT '10',
  `max_scanners` int NOT NULL DEFAULT '10',
  `event_id` int DEFAULT NULL,
  `package_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subscription_request_event` (`event_id`),
  KEY `idx_subscription_requests_status` (`status`,`requested_at`),
  KEY `fk_sr_tenant` (`tenant_id`),
  KEY `fk_sr_plan` (`plan_id`),
  KEY `fk_sr_reviewer` (`reviewed_by`),
  CONSTRAINT `fk_sr_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sr_plan` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`),
  CONSTRAINT `fk_sr_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sr_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('bank_account', '0386771868', '2026-10-22 10:29:57');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('bank_account_name', 'KTS QR EVENT', '2026-10-22 10:29:57');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('bank_code', 'MB', '2026-10-22 10:29:57');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('bank_name', 'MBBank', '2026-10-22 10:29:57');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('bank_qr_template', 'compact2', '2026-10-22 10:29:57');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('email_on_approved', '1', '2026-11-12 07:51:51');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('geofence_default_radius', '1.111111111111111e+29', '2026-10-13 10:54:54');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('notify_hours_before', '24', '2026-10-13 09:48:12');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('smtp_from_email', 'info@aioglobal.org', '2026-11-12 09:17:20');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('smtp_from_name', 'EventGo', '2026-11-13 02:10:18');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('smtp_host', 'smtp.zoho.com', '2026-11-12 07:51:51');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('smtp_pass', 'L3yN3O4jbP@123', '2026-11-12 07:51:51');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('smtp_port', '465', '2026-11-12 09:17:20');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('smtp_sender_name', 'Ban Tổ Chức EventGo', '2026-11-13 02:10:18');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('smtp_user', 'info@aioglobal.org', '2026-11-12 07:51:51');
DROP TABLE IF EXISTS `tenant_subscriptions`;
CREATE TABLE `tenant_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `event_credits` int NOT NULL,
  `events_used` int NOT NULL DEFAULT '0',
  `status` enum('ACTIVE','EXPIRED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_subscription_active` (`tenant_id`,`status`,`ends_at`),
  KEY `fk_ts_plan` (`plan_id`),
  KEY `fk_ts_creator` (`created_by`),
  CONSTRAINT `fk_ts_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ts_plan` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`),
  CONSTRAINT `fk_ts_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `tenant_users`;
CREATE TABLE `tenant_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('OWNER','TEAM') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OWNER',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_user` (`tenant_id`,`user_id`),
  KEY `idx_tenant_users_tenant` (`tenant_id`),
  KEY `idx_tu_user` (`user_id`),
  CONSTRAINT `fk_tu_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tu_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (8, 7, 42, 'TEAM', '2026-10-22 10:31:10');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (11, 8, 46, 'OWNER', '2026-10-23 10:18:22');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (19, 11, 50, 'TEAM', '2026-10-24 09:32:21');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (20, 9, 26, 'TEAM', '2026-10-26 04:57:02');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (21, 11, 54, 'TEAM', '2026-10-26 09:21:54');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (22, 11, 58, 'OWNER', '2026-10-27 02:54:02');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (24, 11, 42, 'TEAM', '2026-10-27 02:54:02');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (26, 12, 51, 'OWNER', '2026-11-03 07:32:56');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (27, 13, 26, 'OWNER', '2026-11-03 07:45:26');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (28, 12, 59, 'TEAM', '2026-11-03 08:13:07');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (29, 12, 60, 'TEAM', '2026-11-03 08:13:33');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (30, 12, 61, 'TEAM', '2026-11-03 08:13:56');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (31, 12, 62, 'TEAM', '2026-11-03 08:14:49');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (32, 12, 63, 'TEAM', '2026-11-03 08:15:14');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (33, 14, 68, 'OWNER', '2026-11-03 11:27:38');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (34, 15, 72, 'OWNER', '2026-11-03 14:56:46');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (35, 16, 76, 'OWNER', '2026-11-13 02:54:36');
DROP TABLE IF EXISTS `tenants`;
CREATE TABLE `tenants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','BLOCKED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `free_events_used` int NOT NULL DEFAULT '0',
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_tenants_creator` (`created_by`),
  KEY `idx_tenants_status` (`status`),
  CONSTRAINT `fk_tenants_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (1, 'Disposable Smoke Tenant', 'Smoke Test', 'smoke_1792572336914@example.invalid', NULL, 'ACTIVE', 0, 1, '2026-10-21 08:45:36', '2026-10-21 08:45:36');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (2, 'Temporary QA Tenant', 'QA', 'full_1792572510548@example.invalid', NULL, 'ACTIVE', 0, 1, '2026-10-21 08:48:30', '2026-10-21 08:48:30');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (3, 'Temporary QA Tenant', 'QA', 'full_1792572577609@example.invalid', NULL, 'ACTIVE', 0, 1, '2026-10-21 08:49:37', '2026-10-21 08:49:37');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (4, 'Temporary QA Tenant', 'QA', 'full_1792572641073@example.invalid', NULL, 'ACTIVE', 0, 1, '2026-10-21 08:50:41', '2026-10-21 08:50:41');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (5, 'Temporary QA Tenant', 'QA', 'full_1792572730786@example.invalid', NULL, 'ACTIVE', 0, 1, '2026-10-21 08:52:10', '2026-10-21 08:52:10');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (7, 'Kts', 'tétttt', 'test@gmail.com', '0867198642', 'ACTIVE', 0, 28, '2026-10-21 10:12:12', '2026-11-12 09:16:40');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (8, 'Cong Ty Su Kien VinaTest', 'Nguyen Van Chu', 'chutenant_test123@gmail.com', '0912345678', 'ACTIVE', 0, 46, '2026-10-23 10:18:22', '2026-10-23 10:18:22');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (9, 'hoanghieutesst Event Org', 'hoanghieutesst', 'hvan8615@gmail.com', NULL, 'ACTIVE', 0, 28, '2026-10-23 10:38:10', '2026-11-13 02:52:10');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (11, 'test', 'hieu test', 'hvan8677@gmail.com', '0867198647', 'ACTIVE', 0, 28, '2026-10-24 08:28:49', '2026-11-13 02:51:09');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (12, 'CÔNG Ty test', 'Hoàng Văn Hiếu', 'hieuhoang@gmail.com', '0867293123', 'ACTIVE', 0, 51, '2026-11-03 07:32:56', '2026-11-12 09:16:40');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (13, 'KTS', 'Quỳnh', 'haquynhktsvn@gmail.com', '0385636199', 'ACTIVE', 0, 26, '2026-11-03 07:45:26', '2026-11-12 09:16:40');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (14, 'Kho hàng KTSmall Hà Tĩnh', 'Dương thị Thu Hà', 'duonghaht1989@gmail.com', '0328649688', 'ACTIVE', 0, 68, '2026-11-03 11:27:38', '2026-11-12 09:16:40');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (15, 'Hieu', 'Hsjshssh', 'hehsjs@gmail.com', '0183738382', 'ACTIVE', 0, 72, '2026-11-03 14:56:46', '2026-11-03 14:56:46');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (16, 'Hieusktest', 'HoàngVanHieu', 'hoanghieucv26@gmail.com', '0867198684', 'ACTIVE', 0, 76, '2026-11-13 02:54:36', '2026-11-13 02:54:36');
DROP TABLE IF EXISTS `tickets`;
CREATE TABLE `tickets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `registration_id` int NOT NULL,
  `event_id` int NOT NULL,
  `code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ISSUED','USED','VOID') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ISSUED',
  `used_at` datetime DEFAULT NULL,
  `used_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `registration_id` (`registration_id`),
  UNIQUE KEY `code` (`code`),
  KEY `fk_tkt_event` (`event_id`),
  KEY `fk_tkt_used_by` (`used_by`),
  KEY `idx_tkt_code_event` (`code`,`event_id`,`status`),
  CONSTRAINT `fk_tkt_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tkt_reg` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tkt_used_by` FOREIGN KEY (`used_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
DROP TABLE IF EXISTS `user_permissions`;
CREATE TABLE `user_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_permission` (`user_id`,`permission_id`),
  KEY `fk_up_perm` (`permission_id`),
  CONSTRAINT `fk_up_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=235 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (51, 28, 8, '2026-10-15 04:04:38');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (52, 28, 1, '2026-10-15 04:04:38');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (53, 28, 2, '2026-10-15 04:04:38');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (54, 28, 4, '2026-10-15 04:04:38');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (55, 28, 6, '2026-10-15 04:04:38');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (56, 28, 5, '2026-10-15 04:04:38');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (57, 28, 9, '2026-10-15 04:04:38');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (58, 28, 3, '2026-10-15 04:04:38');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (59, 28, 7, '2026-10-15 04:04:38');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (78, 50, 5, '2026-10-24 09:32:40');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (79, 50, 4, '2026-10-24 09:32:40');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (80, 26, 5, '2026-10-26 04:57:14');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (81, 26, 9, '2026-10-26 04:57:14');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (82, 54, 5, '2026-10-26 09:22:05');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (83, 54, 7, '2026-10-26 09:22:05');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (96, 42, 5, '2026-10-27 02:41:15');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (97, 42, 4, '2026-10-27 02:41:15');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (98, 42, 6, '2026-10-27 02:41:15');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (99, 42, 7, '2026-10-27 02:41:15');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (100, 42, 9, '2026-10-27 02:41:15');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (103, 59, 5, '2026-11-03 08:15:28');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (104, 59, 4, '2026-11-03 08:15:28');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (105, 59, 6, '2026-11-03 08:15:28');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (106, 59, 7, '2026-11-03 08:15:28');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (107, 59, 9, '2026-11-03 08:15:28');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (110, 60, 5, '2026-11-03 08:16:21');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (111, 60, 4, '2026-11-03 08:16:21');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (112, 63, 5, '2026-11-03 08:29:57');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (113, 63, 6, '2026-11-03 08:29:57');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (114, 61, 5, '2026-11-03 08:30:20');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (115, 61, 4, '2026-11-03 08:30:20');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (116, 62, 5, '2026-11-03 08:30:36');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (117, 62, 7, '2026-11-03 08:30:36');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (132, 60, 6, '2026-11-04 03:09:26');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (135, 61, 6, '2026-11-04 03:09:26');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (140, 50, 6, '2026-11-04 03:09:41');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (168, 63, 4, '2026-11-12 08:06:29');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (171, 63, 7, '2026-11-12 08:06:29');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (172, 63, 9, '2026-11-12 08:06:29');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (176, 60, 7, '2026-11-12 08:06:29');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (177, 60, 9, '2026-11-12 08:06:29');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (181, 61, 7, '2026-11-12 08:06:29');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (182, 61, 9, '2026-11-12 08:06:29');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (183, 62, 4, '2026-11-12 08:06:29');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (185, 62, 6, '2026-11-12 08:06:29');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (187, 62, 9, '2026-11-12 08:06:29');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (192, 77, 7, '2026-11-13 03:13:25');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (226, 1, 1, '2026-11-13 04:00:14');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (227, 1, 2, '2026-11-13 04:00:14');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (228, 1, 3, '2026-11-13 04:00:14');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (229, 1, 4, '2026-11-13 04:00:14');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (230, 1, 5, '2026-11-13 04:00:14');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (231, 1, 6, '2026-11-13 04:00:14');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (232, 1, 7, '2026-11-13 04:00:14');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (233, 1, 9, '2026-11-13 04:00:14');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (234, 1, 8, '2026-11-13 04:00:14');
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` enum('ADMIN','STAFF','CUSTOMER','TENANT_ADMIN') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp_expires_at` datetime DEFAULT NULL,
  `status` enum('ACTIVE','BLOCKED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone` (`phone`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_type_status` (`type`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (1, 'ADMIN', 'Tổng Quản Trị Viên', '0900000001', 'admin@eventqr.com', '$2b$10$GN1W9pRGxN5iUlhuzqxkP.ZBeT1ryvzfoTmoXK157h.YQ6NroBaE2', NULL, NULL, 'ACTIVE', '2026-10-03 02:44:21', '2026-11-13 03:01:19');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (25, 'CUSTOMER', 'Hoàng Văn Hiếu', '0867198644', 'hvan33584@gmail.com', NULL, NULL, NULL, 'ACTIVE', '2026-10-09 08:15:50', '2026-11-12 15:50:22');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (26, 'TENANT_ADMIN', 'Quỳnh', '0385636199', 'haquynhktsvn@gmail.com', '$2b$10$oR.4ESawY4AzSNcqWlrAsO6wWxi9eSleaTjYc6b3yH9WHoXGliS8q', NULL, NULL, 'ACTIVE', '2026-10-13 10:40:58', '2026-11-03 07:45:26');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (28, 'ADMIN', 'Hoàng Văn Hiếu', '0867198643', 'hvan86771@gmail.com', '$2b$10$naV6ftAS3yOCOJpstmDRKOGfOOz.NNJDeMPjHj7DDtPlh/ZD/0TIa', NULL, NULL, 'ACTIVE', '2026-10-15 03:47:17', '2026-10-27 02:54:02');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (42, 'STAFF', 'HoàngHieu', '0867108748', 'hvan8612@gmail.com', '$2b$10$Cf5hRV10oGdPiGCn5XAfWuWtl.2Ufb09CNOL2Djh6E5c4zheKZm9K', NULL, NULL, 'ACTIVE', '2026-10-22 10:31:10', '2026-10-27 02:54:02');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (46, 'TENANT_ADMIN', 'Nguyen Van Chu', '0912345678', 'chutenant_test123@gmail.com', '$2b$10$.7SKjTygvrvnVr131jDcFe/4ko8OdItm5PBCHXVaivpSg9pWvLbsu', NULL, NULL, 'ACTIVE', '2026-10-23 10:18:22', '2026-10-23 10:18:22');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (50, 'STAFF', 'hieutestkhachmoi', '0867918231', 'testkhachmoi@gmail.com', '$2b$10$SFkFFEYWsoy5nqzvWjxCJu4WYERn4CIM5dg1fBjscgNISKpMBYjc6', NULL, NULL, 'ACTIVE', '2026-10-24 09:32:21', '2026-10-24 09:32:21');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (51, 'TENANT_ADMIN', 'Hoàng Văn Hiếu', '0867293123', 'hieuhoang@gmail.com', '$2b$10$xT3.eulHzXh0rM6anLvA8eGEah3TwrpR1/MgZyGKF9BcFUxUnLafq', NULL, NULL, 'ACTIVE', '2026-10-24 09:42:46', '2026-11-03 07:32:56');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (54, 'STAFF', 'hieuquetpr', '0867198640', 'hieuqr@gmail.com', '$2b$10$Rx.fmyqyN78LMiVZ64TsRezLLDgo9o1GS.y.YnNVV6DeViGhKQU.6', NULL, NULL, 'ACTIVE', '2026-10-26 09:21:54', '2026-10-26 09:21:54');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (58, 'TENANT_ADMIN', 'Hoàng Hiếu (Chủ Sự Kiện)', '0901112233', 'hoanghieufc25@gmail.com', '$2b$10$Cf5hRV10oGdPiGCn5XAfWuWtl.2Ufb09CNOL2Djh6E5c4zheKZm9K', NULL, NULL, 'ACTIVE', '2026-10-27 02:53:29', '2026-10-27 02:54:02');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (59, 'STAFF', 'Hà Thị Quỳnh', '0823412421', 'hathiquynh@gmail.com', '$2b$10$zeFSkbO68hjd23w3uX3Z/u7hGADpW53ZKJK5Uieby6CL1l2b.tLwO', NULL, NULL, 'ACTIVE', '2026-11-03 08:13:07', '2026-11-03 08:13:07');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (60, 'STAFF', 'NVmoikhach1', '0923412342', 'moikhach1@gmail.com', '$2b$10$bvwJbWqbpUfqJ8973KpAeOzaJiRNftsRjROmC2kdXzfBFQ.bzojyK', NULL, NULL, 'ACTIVE', '2026-11-03 08:13:33', '2026-11-03 08:13:33');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (61, 'STAFF', 'NVmoikhach2', '0823412449', 'nvmoikhach2@gmail.com', '$2b$10$C8IeVIB0XKVtl2ZdUsrYJ.L9rr76DpSy8RUMrxqqwlDsFGUNW7FFG', NULL, NULL, 'ACTIVE', '2026-11-03 08:13:56', '2026-11-03 08:13:56');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (62, 'STAFF', 'Nvquetqr', '092831239', 'nvquetqr@gmail.com', '$2b$10$iyGylE8CZ2YCNg0Z.667oea4TzoGlRhho0ITkFJQn7A.iaQa1E0se', NULL, NULL, 'ACTIVE', '2026-11-03 08:14:49', '2026-11-03 08:14:49');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (63, 'STAFF', 'nvduyetkhach', '0234412412', 'duyetkhach@gmail.com', '$2b$10$xt3dOZ02WbsIehenwOu6p.MxUhyGglibW7rFjqTGTTwWmMszdnctK', NULL, NULL, 'ACTIVE', '2026-11-03 08:15:14', '2026-11-03 08:15:14');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (64, 'CUSTOMER', 'hieuhoang37fc', NULL, 'hieuhoang37fc@gmail.com', NULL, NULL, NULL, 'ACTIVE', '2026-11-03 08:36:36', '2026-11-03 08:41:29');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (65, 'CUSTOMER', 'testquynh', NULL, 'testquynh@gmaul.com', NULL, NULL, NULL, 'ACTIVE', '2026-11-03 08:39:49', '2026-11-03 08:39:54');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (66, 'CUSTOMER', 'toancau168.na', NULL, 'toancau168.na@gmail.com', NULL, NULL, NULL, 'ACTIVE', '2026-11-03 11:23:14', '2026-11-12 09:16:41');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (67, 'CUSTOMER', 'ktsdiamond89', NULL, 'ktsdiamond89@gmail.com', NULL, NULL, NULL, 'ACTIVE', '2026-11-03 11:25:18', '2026-11-03 11:25:22');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (68, 'TENANT_ADMIN', 'Dương thị Thu Hà', '0328649688', 'duonghaht1989@gmail.com', '$2b$10$fEYIn.w8WGv45zxuE/YgvOqL4QUIK/HrD1QlUi2LglbdGoT2H5kVO', NULL, NULL, 'ACTIVE', '2026-11-03 11:27:38', '2026-11-03 11:27:38');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (69, 'CUSTOMER', 'Lê Thị Tâm', '0911320608', 'thanhtam878787@gmail.com', NULL, NULL, NULL, 'ACTIVE', '2026-11-03 12:13:42', '2026-11-03 12:13:42');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (70, 'CUSTOMER', 'Thuỷ Trịnh Thị', '0866686577', 'ktsmaxpro@gmail.com', NULL, NULL, NULL, 'ACTIVE', '2026-11-03 12:24:45', '2026-11-03 12:24:45');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (71, 'CUSTOMER', 'Tạ thị bích thuỷ', '0387353196', 'bichthuychinh@gmail.com', NULL, NULL, NULL, 'ACTIVE', '2026-11-03 12:37:53', '2026-11-03 12:37:53');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (72, 'TENANT_ADMIN', 'Hsjshssh', '0183738382', 'hehsjs@gmail.com', '$2b$10$QY/QnOipxMyuMjeIuCM5/elGJ2q4jWN/QKn7CpUfCA3r.B0.Yd/BS', NULL, NULL, 'ACTIVE', '2026-11-03 14:56:46', '2026-11-03 14:56:46');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (73, 'CUSTOMER', 'testquynh', NULL, 'test1@gmail.com', NULL, NULL, NULL, 'ACTIVE', '2026-11-04 02:37:35', '2026-11-04 02:37:46');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (74, 'CUSTOMER', 'haquynh.sam', NULL, 'haquynh.sam@gmail.com', NULL, NULL, NULL, 'ACTIVE', '2026-11-12 08:05:32', '2026-11-12 08:06:26');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (75, 'CUSTOMER', 'hvan8667', NULL, 'hvan8667@gmail.com', NULL, NULL, NULL, 'ACTIVE', '2026-11-12 08:07:31', '2026-11-12 09:16:41');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (76, 'TENANT_ADMIN', 'HoàngVanHieu', '0867198684', 'hoanghieucv26@gmail.com', '$2b$10$bm47FzQr6BlVKd2J96gH2eFMGfLMbBqYn4GMD2ocZh.erWGPNeeaG', NULL, NULL, 'ACTIVE', '2026-11-13 02:54:36', '2026-11-13 02:54:36');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (77, 'STAFF', 'Hoàng Hiếu Quét ', '0867123142', 'hoanghieuquet@gmail.com', '$2b$10$PgyEiDx1jNR.TwPYuXoomOPNlL/EqsbIPrm4SsXiU8LxMnqSwHEva', NULL, NULL, 'ACTIVE', '2026-11-13 03:13:14', '2026-11-13 03:13:14');
SET FOREIGN_KEY_CHECKS = 1;
