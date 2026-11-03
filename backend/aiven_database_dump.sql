-- ========================================================
-- KTSQR PRODUCTION DATABASE DUMP FOR AIVEN MYSQL
-- Date: 2026-11-03T03:05:42.181Z
-- ========================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int DEFAULT NULL,
  `details` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_al_user` (`user_id`),
  KEY `idx_al_action` (`action`),
  KEY `idx_al_created_at` (`created_at`),
  CONSTRAINT `fk_al_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `audit_logs` (`id`, `user_id`, `action`, `entity`, `entity_id`, `details`, `ip_address`, `created_at`) VALUES (1, 6, 'DISPUTE_ALLOW', 'disputes', 1, '{"note":"Đã đối chiếu CMND và email xác nhận, khách hàng là chính chủ hợp lệ.","decision":"ALLOW","ticket_id":1}', NULL, '2026-10-03 02:53:28');
INSERT INTO `audit_logs` (`id`, `user_id`, `action`, `entity`, `entity_id`, `details`, `ip_address`, `created_at`) VALUES (2, 28, 'DISPUTE_ALLOW', 'disputes', 2, '{"note":"Đã đối chiếu CCCD và email gốc trùng khớp.","decision":"ALLOW","ticket_id":11}', NULL, '2026-10-27 02:40:41');
INSERT INTO `audit_logs` (`id`, `user_id`, `action`, `entity`, `entity_id`, `details`, `ip_address`, `created_at`) VALUES (3, 28, 'DISPUTE_ALLOW', 'disputes', 3, '{"note":"Đã đối chiếu CCCD và email gốc trùng khớp.","decision":"ALLOW","ticket_id":12}', NULL, '2026-10-27 02:41:15');

DROP TABLE IF EXISTS `disputes`;
CREATE TABLE `disputes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `scan_log_id` int NOT NULL,
  `ticket_id` int NOT NULL,
  `claimant_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `claimant_phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `explanation` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `recorded_by` int NOT NULL,
  `decided_by` int DEFAULT NULL,
  `decision` enum('PENDING','ALLOW','DENY') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `decision_note` text COLLATE utf8mb4_unicode_ci,
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `disputes` (`id`, `scan_log_id`, `ticket_id`, `claimant_name`, `claimant_phone`, `explanation`, `recorded_by`, `decided_by`, `decision`, `decision_note`, `decided_at`, `created_at`) VALUES (1, 12, 1, 'Khách hàng Bị Trùng Vé', '0988888888', 'Tôi cầm vé chính chủ do NV A gửi, người quét trước là kẻ gian.', 5, 6, 'ALLOW', 'Đã đối chiếu CMND và email xác nhận, khách hàng là chính chủ hợp lệ.', '2026-10-03 02:53:28', '2026-10-03 02:53:28');
INSERT INTO `disputes` (`id`, `scan_log_id`, `ticket_id`, `claimant_name`, `claimant_phone`, `explanation`, `recorded_by`, `decided_by`, `decision`, `decision_note`, `decided_at`, `created_at`) VALUES (2, 51, 11, 'Nguyễn Minh Khách VIP (Khiếu nại)', '0998781436', 'Khách xuất trình email gốc chính chủ tại bàn trọng tài.', 43, 28, 'ALLOW', 'Đã đối chiếu CCCD và email gốc trùng khớp.', '2026-10-27 02:40:41', '2026-10-27 02:40:41');
INSERT INTO `disputes` (`id`, `scan_log_id`, `ticket_id`, `claimant_name`, `claimant_phone`, `explanation`, `recorded_by`, `decided_by`, `decision`, `decision_note`, `decided_at`, `created_at`) VALUES (3, 54, 12, 'Nguyễn Minh Khách VIP (Khiếu nại)', '0929896532', 'Khách xuất trình email gốc chính chủ tại bàn trọng tài.', 43, 28, 'ALLOW', 'Đã đối chiếu CCCD và email gốc trùng khớp.', '2026-10-27 02:41:15', '2026-10-27 02:41:15');

DROP TABLE IF EXISTS `events`;
CREATE TABLE `events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `poster_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `start_at` datetime NOT NULL,
  `end_at` datetime NOT NULL,
  `capacity` int NOT NULL DEFAULT '500',
  `status` enum('DRAFT','PUBLISHED','CLOSED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PUBLISHED',
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `approval_mode` enum('REFERRER_ONLY','TWO_TIER','AUTO') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'REFERRER_ONLY',
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `geofence_radius_meters` int NOT NULL DEFAULT '500',
  `geofence_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `tenant_id` int DEFAULT NULL,
  `package_request_id` int DEFAULT NULL,
  `package_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_employees` int NOT NULL DEFAULT '10',
  `max_referrers` int NOT NULL DEFAULT '10',
  `max_scanners` int NOT NULL DEFAULT '10',
  `package_price_vnd` bigint unsigned NOT NULL DEFAULT '0',
  `is_trial` tinyint(1) NOT NULL DEFAULT '0',
  `payment_status` enum('PAID','PENDING_PAYMENT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PAID',
  `payment_note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_events_creator` (`created_by`),
  KEY `idx_events_tenant_start` (`tenant_id`,`start_at`),
  CONSTRAINT `fk_events_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_events_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `events` (`id`, `name`, `description`, `location`, `poster_url`, `start_at`, `end_at`, `capacity`, `status`, `created_by`, `created_at`, `updated_at`, `approval_mode`, `latitude`, `longitude`, `geofence_radius_meters`, `geofence_enabled`, `tenant_id`, `package_request_id`, `package_name`, `max_employees`, `max_referrers`, `max_scanners`, `package_price_vnd`, `is_trial`, `payment_status`, `payment_note`, `paid_at`) VALUES (1, 'Hội nghị Công nghệ & Chuyển đổi số TechSummit 2026', 'Sự kiện thường niên kết nối hơn 500 nhà lãnh đạo công nghệ, kiến trúc sư phần mềm và chuyên gia AI.', 'Trung tâm Hội nghị Quốc gia, Đại lộ Thăng Long, Mễ Trì, Nam Từ Liêm, Hà Nội', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80', '2026-10-15 01:30:00', '2026-10-15 10:30:00', 500, 'CLOSED', 1, '2026-10-03 02:44:21', '2026-10-24 08:50:41', 'REFERRER_ONLY', '21.00640000', '105.78340000', 1500, 0, NULL, NULL, NULL, 10, 10, 10, 0, 0, 'PAID', NULL, NULL);
INSERT INTO `events` (`id`, `name`, `description`, `location`, `poster_url`, `start_at`, `end_at`, `capacity`, `status`, `created_by`, `created_at`, `updated_at`, `approval_mode`, `latitude`, `longitude`, `geofence_radius_meters`, `geofence_enabled`, `tenant_id`, `package_request_id`, `package_name`, `max_employees`, `max_referrers`, `max_scanners`, `package_price_vnd`, `is_trial`, `payment_status`, `payment_note`, `paid_at`) VALUES (2, 'Hội thảo Khởi nghiệp Đổi mới Sáng tạo 2026', NULL, 'Khách sạn Melia Hà Nội, 44 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội', NULL, '2026-10-15 01:30:00', '2026-12-31 16:59:59', 500, 'PUBLISHED', 1, '2026-10-03 03:44:27', '2026-10-19 03:14:26', 'REFERRER_ONLY', NULL, NULL, 500, 0, NULL, NULL, NULL, 10, 10, 10, 0, 0, 'PAID', NULL, NULL);
INSERT INTO `events` (`id`, `name`, `description`, `location`, `poster_url`, `start_at`, `end_at`, `capacity`, `status`, `created_by`, `created_at`, `updated_at`, `approval_mode`, `latitude`, `longitude`, `geofence_radius_meters`, `geofence_enabled`, `tenant_id`, `package_request_id`, `package_name`, `max_employees`, `max_referrers`, `max_scanners`, `package_price_vnd`, `is_trial`, `payment_status`, `payment_note`, `paid_at`) VALUES (3, 'Diễn đàn Chuyển đổi số Doanh nghiệp 2026', 'ádasd', 'Trung tâm Triển lãm SECC, Quận 7, TP.HCM', NULL, '2026-10-15 01:30:00', '2026-12-31 16:59:59', 500, 'PUBLISHED', 1, '2026-10-09 08:31:48', '2026-10-19 03:14:26', 'REFERRER_ONLY', NULL, NULL, 500, 0, NULL, NULL, NULL, 10, 10, 10, 0, 0, 'PAID', NULL, NULL);
INSERT INTO `events` (`id`, `name`, `description`, `location`, `poster_url`, `start_at`, `end_at`, `capacity`, `status`, `created_by`, `created_at`, `updated_at`, `approval_mode`, `latitude`, `longitude`, `geofence_radius_meters`, `geofence_enabled`, `tenant_id`, `package_request_id`, `package_name`, `max_employees`, `max_referrers`, `max_scanners`, `package_price_vnd`, `is_trial`, `payment_status`, `payment_note`, `paid_at`) VALUES (4, 'Lễ Ra mắt Nền tảng Công nghệ KTSQR 2026', NULL, 'Tòa nhà Keangnam Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội', NULL, '2026-10-15 01:30:00', '2026-12-31 16:59:59', 400, 'PUBLISHED', 1, '2026-10-09 09:38:53', '2026-10-19 03:14:26', 'TWO_TIER', NULL, NULL, 500, 0, NULL, NULL, NULL, 10, 10, 10, 0, 0, 'PAID', NULL, NULL);
INSERT INTO `events` (`id`, `name`, `description`, `location`, `poster_url`, `start_at`, `end_at`, `capacity`, `status`, `created_by`, `created_at`, `updated_at`, `approval_mode`, `latitude`, `longitude`, `geofence_radius_meters`, `geofence_enabled`, `tenant_id`, `package_request_id`, `package_name`, `max_employees`, `max_referrers`, `max_scanners`, `package_price_vnd`, `is_trial`, `payment_status`, `payment_note`, `paid_at`) VALUES (5, 'Test Event Permissions Verification', NULL, 'Hà Nội', NULL, '2026-10-20 01:00:00', '2026-12-31 16:59:59', 300, 'PUBLISHED', 1, '2026-10-14 03:15:25', '2026-10-19 03:14:26', 'REFERRER_ONLY', NULL, NULL, 500, 0, NULL, NULL, NULL, 10, 10, 10, 0, 0, 'PAID', NULL, NULL);
INSERT INTO `events` (`id`, `name`, `description`, `location`, `poster_url`, `start_at`, `end_at`, `capacity`, `status`, `created_by`, `created_at`, `updated_at`, `approval_mode`, `latitude`, `longitude`, `geofence_radius_meters`, `geofence_enabled`, `tenant_id`, `package_request_id`, `package_name`, `max_employees`, `max_referrers`, `max_scanners`, `package_price_vnd`, `is_trial`, `payment_status`, `payment_note`, `paid_at`) VALUES (7, 'Lễ ra mắt', NULL, 'Trụ sở chính', NULL, '2026-10-22 10:42:00', '2026-10-24 10:42:00', 500, 'PUBLISHED', 41, '2026-10-22 10:42:57', '2026-10-22 10:42:57', 'REFERRER_ONLY', NULL, NULL, 500, 0, 7, NULL, 'ktstesst', 13, 10, 3, 0, 1, 'PAID', NULL, '2026-10-22 10:42:58');
INSERT INTO `events` (`id`, `name`, `description`, `location`, `poster_url`, `start_at`, `end_at`, `capacity`, `status`, `created_by`, `created_at`, `updated_at`, `approval_mode`, `latitude`, `longitude`, `geofence_radius_meters`, `geofence_enabled`, `tenant_id`, `package_request_id`, `package_name`, `max_employees`, `max_referrers`, `max_scanners`, `package_price_vnd`, `is_trial`, `payment_status`, `payment_note`, `paid_at`) VALUES (8, 'lễ test', NULL, 'hội nghị test', NULL, '2026-10-24 09:26:00', '2026-10-26 09:26:00', 50, 'PUBLISHED', 17, '2026-10-24 09:27:00', '2026-10-24 09:27:00', 'AUTO', NULL, NULL, 500, 0, 11, NULL, 'gói thử nghiệm', 5, 2, 1, 0, 1, 'PAID', NULL, '2026-10-24 09:27:01');
INSERT INTO `events` (`id`, `name`, `description`, `location`, `poster_url`, `start_at`, `end_at`, `capacity`, `status`, `created_by`, `created_at`, `updated_at`, `approval_mode`, `latitude`, `longitude`, `geofence_radius_meters`, `geofence_enabled`, `tenant_id`, `package_request_id`, `package_name`, `max_employees`, `max_referrers`, `max_scanners`, `package_price_vnd`, `is_trial`, `payment_status`, `payment_note`, `paid_at`) VALUES (9, 'hsadasd', NULL, 'ádasdasd', NULL, '2026-10-26 04:49:00', '2026-10-29 04:50:00', 1000, 'PUBLISHED', 45, '2026-10-26 04:50:10', '2026-10-26 04:55:29', 'AUTO', NULL, NULL, 500, 0, 9, 1, 'test gói có tiền', 20, 15, 7, 2000000, 0, 'PAID', NULL, '2026-10-26 04:55:29');

DROP TABLE IF EXISTS `invite_links`;
CREATE TABLE `invite_links` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `referrer_id` int NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `signature` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `max_registrations` int NOT NULL DEFAULT '100',
  `current_registrations` int NOT NULL DEFAULT '0',
  `status` enum('ACTIVE','REVOKED','EXPIRED','CLOSED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `fk_il_referrer` (`referrer_id`),
  KEY `idx_il_event_referrer` (`event_id`,`referrer_id`),
  KEY `idx_il_token` (`token`),
  CONSTRAINT `fk_il_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_il_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (1, 1, 2, 'inv_7cf60f7f0879498295583d4232e8591f', 'bde0fe772e49877ff5c3c81dda8fa66916a53a5a796c1b27d25c7a79ad1d92fd', '2026-11-02 02:47:09', 100, 0, 'ACTIVE', '2026-10-03 02:47:09');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (2, 1, 2, 'inv_038ea6514b8e4c5dba4b160255f11ddc', 'a57bd3691865850006a4832a2f05d1565a17909aec0ae5b462b24ac4bcd9db52', '2026-11-02 02:47:12', 100, 0, 'ACTIVE', '2026-10-03 02:47:12');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (3, 1, 2, 'inv_test_1790996008138', 'sig_test', '2026-10-04 02:53:28', 100, 0, 'ACTIVE', '2026-10-03 02:53:28');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (4, 1, 2, 'inv_1b466cca2e16466481dc78029158f47f', '2da8143fe083f69aa234a8e2b9716f602ee1e6d6a199c855c66dc86df032e458', '2026-11-02 02:55:32', 100, 0, 'ACTIVE', '2026-10-03 02:55:31');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (5, 1, 2, 'inv_1aa7751e1dd2430bb7e7a20841b9a331', '50c1a6ccc8879892a798edb775f5b442379bcfd8f8baa6ccbc90e1e43b8cb2b9', '2026-11-02 03:02:37', 100, 1, 'ACTIVE', '2026-10-03 03:02:37');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (6, 2, 2, 'inv_cd06f514bf55492aa2d552986f70daeb', '570a7ba82fd61aaa3e646a9d95a5af27c620223187d0b80b2d0992e4fe87dd7c', '2026-11-02 03:44:57', 100, 0, 'ACTIVE', '2026-10-03 03:44:56');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (7, 1, 2, 'inv_f0a9831f0b224d39bc7548c04c216b4e', 'eb61c48bddbc6debd7d7b8ec457826861d081f70d0046b7b355e0147a6fd05fc', '2026-11-08 08:18:17', 100, 1, 'ACTIVE', '2026-10-09 08:18:17');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (8, 1, 2, 'inv_db49efc0742647e2a3188c6125f89a8b', 'c01e6cab69713b6bd6c1a26d1dee93cc380fe3d220b01eda06b57bf4305f0703', '2026-11-08 08:29:50', 100, 0, 'ACTIVE', '2026-10-09 08:29:49');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (9, 1, 2, 'inv_266d3396995d47b79f3b0f86c5fabcb3', 'f82883c1674aee2f1fba07294a84a3b7e07e1f0cffdd252e051e7d05d117e539', '2026-11-08 08:30:24', 100, 0, 'ACTIVE', '2026-10-09 08:30:23');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (10, 3, 2, 'inv_a4272ca1e4ec4456b20aa0a2aa40eede', 'dc29eda459279c2c8ee3f493262f38d2d50d51603b6a5210c800c6c9825524b7', '2026-11-08 08:31:59', 63, 1, 'ACTIVE', '2026-10-09 08:31:58');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (11, 3, 2, 'inv_31219e856eb74e8cb070eed45c10beb2', 'a3fc6ecec48acbe160260a8cb54835cf4b2d16772eb580f6c7efd7d2723604d8', '2026-11-08 08:32:25', 63, 0, 'ACTIVE', '2026-10-09 08:32:24');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (12, 3, 2, 'inv_08cb30f77670402e8b144c88b26a62c0', '4e76faaf4416b70eee728ad59bdf3202b92f7f7fcecd83ede03b74eba4c3ccf2', '2026-11-08 08:33:01', 63, 0, 'ACTIVE', '2026-10-09 08:33:01');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (13, 4, 2, 'inv_f1ff232d36ec4ad1bafa911f2b012b25', '41b93d07cd6f3ece7a0c3bc64b07d2694154d1982dc13ea96ce385f9a416c816', '2026-11-08 09:39:19', 34, 1, 'ACTIVE', '2026-10-09 09:39:18');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (14, 4, 2, 'inv_1d66442e0f7e4544ac28ac1589c32774', 'f6e20ea9f474c125af786df81b8ab7f92777e5ad8e43dc3a2ee6f3d1b3d58435', '2026-11-12 10:39:02', 34, 2, 'ACTIVE', '2026-10-13 10:39:01');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (15, 5, 2, 'inv_247a537716cf4b6e93139e60189652a2', '89b2e6cd51ee6cea9ca9ea3f510c9593ed2164be2041d85ff693f039f3e604ef', '2026-11-14 03:40:55', 40, 1, 'ACTIVE', '2026-10-15 03:40:55');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (16, 7, 42, 'inv_ca56af44f5ac476b9f6d1e7dc9ffe97a', 'fb095c111ee8bfb424a6274ec19aa1c0a433b595bd54548cfb7bead1ba7637b2', '2026-11-22 02:24:56', 50, 1, 'ACTIVE', '2026-10-23 02:24:56');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (17, 8, 50, 'inv_b20d2efd41ea43a8b1e26d0b666bf33d', '812f35470df026cca2f096c4b7848cf651b0f3b35ef61482755290bfb51f18bb', '2026-11-23 09:33:02', 50, 1, 'ACTIVE', '2026-10-24 09:33:01');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (18, 7, 42, 'inv_03b53344c65441bd93bcaa6aa1b1e689', '29aa729b8d85742071cd008ed583d8c915a4f265f6de0af2f47dce3ba5a700e3', '2026-11-26 02:40:41', 50, 1, 'ACTIVE', '2026-10-27 02:40:40');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (19, 7, 42, 'inv_26f78526852c4390b4f55b535a44ecd2', '01d44d26be7f92eab58dac7b60d1159f1907aec2da3f9031bebf7aac94d5bf84', '2026-11-26 02:41:16', 50, 1, 'ACTIVE', '2026-10-27 02:41:15');
INSERT INTO `invite_links` (`id`, `event_id`, `referrer_id`, `token`, `signature`, `expires_at`, `max_registrations`, `current_registrations`, `status`, `created_at`) VALUES (20, 8, 41, 'inv_c09848a433424ad3b7d54728de455067', '19b67065b2b5db1a21eef5dfffba8141170b31b7b43e70c6c44aa6b55349ffb8', '2026-11-26 02:54:03', 50, 0, 'ACTIVE', '2026-10-27 02:54:03');

DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
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
  `full_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('PENDING','PENDING_ADMIN','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
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
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (1, 1, 15, 3, 2, 'Khách Thử Nghiệm Concurrency', '0999999999', 'test_concurrent_1790996008130@example.com', NULL, 'APPROVED', NULL, NULL, NULL, '2026-10-03 02:53:28', '2026-10-03 02:53:28');
INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (2, 1, 16, 3, 2, 'Khách của NV A', '0911111111', 'guest_of_a@example.com', NULL, 'APPROVED', NULL, 2, '2026-10-12 10:45:46', '2026-10-03 02:53:28', '2026-10-12 10:45:46');
INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (3, 1, 17, 5, 2, 'Hoàng Văn Hiếu', '0867198647', 'hvan8677@gmail.com', 'vinh', 'APPROVED', NULL, 2, '2026-10-03 03:05:17', '2026-10-03 03:02:53', '2026-10-03 03:05:17');
INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (4, 1, 25, 7, 2, 'Hoàng Văn Hiếu', '0867198644', 'hvan33584@gmail.com', NULL, 'APPROVED', NULL, 2, '2026-10-09 08:21:27', '2026-10-09 08:21:05', '2026-10-09 08:21:27');
INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (5, 3, 25, 10, 2, 'Hoàng Văn Hiếu', '0867198644', 'hvan33584@gmail.com', NULL, 'APPROVED', NULL, 2, '2026-10-09 08:33:26', '2026-10-09 08:32:30', '2026-10-09 08:33:26');
INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (6, 4, 25, 13, 2, 'Hoàng Văn Hiếu', '0867198644', 'hvan33584@gmail.com', NULL, 'APPROVED', NULL, 1, '2026-10-09 09:41:38', '2026-10-09 09:39:38', '2026-10-09 09:41:38');
INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (7, 4, 17, 14, 2, 'Hoàng Văn Hiếu', '0867198647', 'hvan8677@gmail.com', NULL, 'PENDING', NULL, NULL, NULL, '2026-10-13 10:39:35', '2026-10-13 10:39:35');
INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (8, 4, 26, 14, 2, 'Ha quynh', '0385636199', 'haquynhktsvn@gmail.com', 'Ha noi', 'APPROVED', NULL, 1, '2026-10-13 10:46:19', '2026-10-13 10:44:52', '2026-10-13 10:46:19');
INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (9, 5, 17, 15, 2, 'Hoàng Văn Hiếu', '0867198647', 'hvan8677@gmail.com', NULL, 'APPROVED', NULL, 2, '2026-10-15 03:42:47', '2026-10-15 03:42:19', '2026-10-15 03:42:47');
INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (10, 7, 26, 16, 42, 'Quỳnh KTSVN', '0123456789', 'haquynhktsvn@gmail.com', 'Hà Nội', 'APPROVED', NULL, 43, '2026-10-23 09:47:10', '2026-10-23 09:25:41', '2026-10-23 09:47:10');
INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (11, 8, 51, 17, 50, 'hieuhoang', '0867198521', 'hieuhoang@gmail.com', NULL, 'APPROVED', NULL, NULL, '2026-10-24 09:43:16', '2026-10-24 09:43:16', '2026-10-24 09:43:16');
INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (12, 7, 56, 18, 42, 'Nguyễn Minh Khách VIP', '0998781436', 'khachvip_1793068840737@eventqr.vn', 'Quận 1, TP. Hồ Chí Minh', 'APPROVED', NULL, 42, '2026-10-27 02:40:40', '2026-10-27 02:40:40', '2026-10-27 02:40:40');
INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (13, 7, 57, 19, 42, 'Nguyễn Minh Khách VIP', '0929896532', 'khachvip_1793068875661@eventqr.vn', 'Quận 1, TP. Hồ Chí Minh', 'APPROVED', NULL, 42, '2026-10-27 02:41:15', '2026-10-27 02:41:15', '2026-10-27 02:41:15');
INSERT INTO `registrations` (`id`, `event_id`, `customer_id`, `invite_link_id`, `referrer_id`, `full_name`, `phone`, `email`, `address`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `created_at`, `updated_at`) VALUES (15, 8, 25, 17, 50, 'Nguyễn Văn Khách Mới', '0912345678', 'khachmoi@gmail.com', NULL, 'APPROVED', NULL, NULL, '2026-10-27 09:53:22', '2026-10-27 09:53:22', '2026-10-27 09:53:22');

DROP TABLE IF EXISTS `scan_logs`;
CREATE TABLE `scan_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int DEFAULT NULL,
  `event_id` int NOT NULL,
  `scanned_code` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scanned_by` int NOT NULL,
  `result` enum('SUCCESS','INVALID','ALREADY_USED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scanned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_sl_event` (`event_id`),
  KEY `fk_sl_scanner` (`scanned_by`),
  KEY `idx_sl_ticket` (`ticket_id`),
  KEY `idx_sl_scanned_at` (`scanned_at`),
  CONSTRAINT `fk_sl_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sl_scanner` FOREIGN KEY (`scanned_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sl_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (1, 1, 1, 'TKT-TEST-1790996008149', 5, 'SUCCESS', 'Device #2', '127.0.0.1', '2026-10-03 02:53:28');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (2, 1, 1, 'TKT-TEST-1790996008149', 5, 'ALREADY_USED', 'Device #1', '127.0.0.1', '2026-10-03 02:53:28');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (3, 1, 1, 'TKT-TEST-1790996008149', 5, 'ALREADY_USED', 'Device #3', '127.0.0.1', '2026-10-03 02:53:28');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (4, 1, 1, 'TKT-TEST-1790996008149', 5, 'ALREADY_USED', 'Device #7', '127.0.0.1', '2026-10-03 02:53:28');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (5, 1, 1, 'TKT-TEST-1790996008149', 5, 'ALREADY_USED', 'Device #6', '127.0.0.1', '2026-10-03 02:53:28');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (6, 1, 1, 'TKT-TEST-1790996008149', 5, 'ALREADY_USED', 'Device #4', '127.0.0.1', '2026-10-03 02:53:28');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (7, 1, 1, 'TKT-TEST-1790996008149', 5, 'ALREADY_USED', 'Device #5', '127.0.0.1', '2026-10-03 02:53:28');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (8, 1, 1, 'TKT-TEST-1790996008149', 5, 'ALREADY_USED', 'Device #9', '127.0.0.1', '2026-10-03 02:53:28');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (9, 1, 1, 'TKT-TEST-1790996008149', 5, 'ALREADY_USED', 'Device #10', '127.0.0.1', '2026-10-03 02:53:28');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (10, 1, 1, 'TKT-TEST-1790996008149', 5, 'ALREADY_USED', 'Device #8', '127.0.0.1', '2026-10-03 02:53:28');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (11, NULL, 1, 'TKT-NON-EXISTENT-FAKE-999', 5, 'INVALID', 'Camera Scanner', '127.0.0.1', '2026-10-03 02:53:28');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (12, 1, 1, 'TKT-TEST-1790996008149', 5, 'ALREADY_USED', 'Device Scanner #2', '127.0.0.1', '2026-10-03 02:53:28');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (13, 2, 1, 'TKT-1-C75F9E95-83B5509678C86B00', 1, 'SUCCESS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '::1', '2026-10-03 03:43:05');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (14, 2, 1, 'TKT-1-C75F9E95-83B5509678C86B00', 1, 'ALREADY_USED', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '::1', '2026-10-03 03:43:09');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (15, 2, 1, 'TKT-1-C75F9E95-83B5509678C86B00', 1, 'ALREADY_USED', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '::1', '2026-10-03 03:52:14');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (16, 3, 1, 'TKT-1-EA89064C-44098E7D4A01A6C3', 1, 'SUCCESS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '::1', '2026-10-09 08:23:54');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (17, 3, 1, 'TKT-1-EA89064C-44098E7D4A01A6C3', 1, 'ALREADY_USED', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '::1', '2026-10-09 08:24:04');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (18, 3, 1, 'TKT-1-EA89064C-44098E7D4A01A6C3', 1, 'ALREADY_USED', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '::1', '2026-10-09 08:29:11');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (19, NULL, 1, 'TKT-3-AE308AB6-BB26D550C856F936', 1, 'INVALID', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36', '::1', '2026-10-09 08:37:55');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (20, 3, 1, 'TKT-1-EA89064C-44098E7D4A01A6C3', 1, 'ALREADY_USED', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36', '::1', '2026-10-09 08:38:02');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (21, NULL, 1, 'TKT-3-AE308AB6-BB26D550C856F936', 1, 'INVALID', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36', '::1', '2026-10-09 08:38:13');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (22, NULL, 1, 'TKT-3-AE308AB6-BB26D550C856F936', 1, 'INVALID', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36', '::1', '2026-10-09 08:38:15');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (23, NULL, 1, 'TKT-3-AE308AB6-BB26D550C856F936', 1, 'INVALID', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36', '::1', '2026-10-09 08:38:16');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (24, NULL, 1, 'TKT-4-8A2A10CA-146A96E31B010689', 1, 'INVALID', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '::1', '2026-10-09 10:29:07');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (25, NULL, 1, 'TKT-4-8A2A10CA-146A96E31B010689', 1, 'INVALID', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '::1', '2026-10-09 10:29:36');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (26, NULL, 1, 'TKT-4-8A2A10CA-146A96E31B010689', 1, 'INVALID', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '::1', '2026-10-09 10:29:51');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (27, NULL, 1, 'TKT-4-8A2A10CA-146A96E31B010689', 1, 'INVALID', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '::1', '2026-10-09 10:29:56');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (28, 5, 4, 'TKT-4-8A2A10CA-146A96E31B010689', 1, 'SUCCESS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '::1', '2026-10-09 10:29:59');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (29, 5, 4, 'TKT-4-8A2A10CA-146A96E31B010689', 1, 'ALREADY_USED', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '::1', '2026-10-09 10:30:07');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (30, 4, 3, 'TKT-3-AE308AB6-BB26D550C856F936', 1, 'SUCCESS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '::1', '2026-10-09 10:37:48');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (31, 4, 3, 'TKT-3-AE308AB6-BB26D550C856F936', 1, 'SUCCESS', 'Camera Scanner', '::1', '2026-10-09 10:51:33');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (32, 4, 3, 'TKT-3-AE308AB6-BB26D550C856F936', 1, 'SUCCESS', 'Camera Scanner', '::1', '2026-10-09 10:53:29');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (33, 4, 3, 'TKT-3-AE308AB6-BB26D550C856F936', 1, 'SUCCESS', 'Camera Scanner', '::1', '2026-10-09 10:53:41');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (34, NULL, 4, 'đâsdasd', 5, 'INVALID', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '::1', '2026-10-12 10:53:13');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (35, NULL, 1, 'NONEXISTENT-TICKET-CODE', 1, 'INVALID', 'Offline Auto-Sync', '::1', '2026-10-13 10:17:49');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (36, NULL, 1, 'TKT-4-706DF4DF-66DDA3F7164AAA3A', 1, 'INVALID', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36', '::1', '2026-10-13 10:53:35');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (37, NULL, 1, 'TKT-4-706DF4DF-66DDA3F7164AAA3A', 1, 'INVALID', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36 (Geofence: 5194m > 1500m)', '::1', '2026-10-13 10:54:07');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (38, 7, 4, 'TKT-4-706DF4DF-66DDA3F7164AAA3A', 1, 'SUCCESS', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36', '::1', '2026-10-13 10:55:09');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (39, 7, 4, 'TKT-4-706DF4DF-66DDA3F7164AAA3A', 1, 'ALREADY_USED', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36', '::1', '2026-10-13 10:55:12');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (40, 7, 4, 'TKT-4-706DF4DF-66DDA3F7164AAA3A', 1, 'ALREADY_USED', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36', '::1', '2026-10-13 10:55:48');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (41, 8, 5, 'TKT-5-0A7E80C2-678D21022FBFEBF1', 5, 'SUCCESS', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '::1', '2026-10-15 03:43:52');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (42, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 54, 'SUCCESS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/261002802 ZaloTheme/light ZaloLanguage/vn', '14.248.85.221', '2026-10-26 09:23:13');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (43, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 54, 'ALREADY_USED', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/261002802 ZaloTheme/light ZaloLanguage/vn', '14.248.85.221', '2026-10-26 09:23:15');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (44, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 54, 'ALREADY_USED', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/261002802 ZaloTheme/light ZaloLanguage/vn', '14.248.85.221', '2026-10-26 09:23:42');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (45, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 54, 'ALREADY_USED', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/261002802 ZaloTheme/light ZaloLanguage/vn', '14.248.85.221', '2026-10-26 09:23:43');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (46, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 54, 'ALREADY_USED', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/261002802 ZaloTheme/light ZaloLanguage/vn', '14.248.85.221', '2026-10-26 09:23:46');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (47, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 17, 'ALREADY_USED', 'Node Test', '::1', '2026-10-26 09:40:49');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (48, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 17, 'ALREADY_USED', 'NodeTest', '::1', '2026-10-26 10:00:54');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (49, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 54, 'ALREADY_USED', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1', '14.248.85.221', '2026-10-26 10:10:52');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (50, 11, 7, 'TKT-7-B05509BF-141A60592E92A194', 43, 'SUCCESS', 'Automated E2E Scanner Test', '::1', '2026-10-27 02:40:41');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (51, 11, 7, 'TKT-7-B05509BF-141A60592E92A194', 43, 'ALREADY_USED', 'Automated E2E Scanner Test (2nd Scan)', '::1', '2026-10-27 02:40:41');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (52, NULL, 7, 'TKT-999-FAKECODE-0000000000000000', 43, 'INVALID', 'Automated E2E Scanner Test (Invalid)', '::1', '2026-10-27 02:40:41');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (53, 12, 7, 'TKT-7-BB0CCCCD-14CF41BE6193DEAD', 43, 'SUCCESS', 'Automated E2E Scanner Test', '::1', '2026-10-27 02:41:15');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (54, 12, 7, 'TKT-7-BB0CCCCD-14CF41BE6193DEAD', 43, 'ALREADY_USED', 'Automated E2E Scanner Test (2nd Scan)', '::1', '2026-10-27 02:41:15');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (55, NULL, 7, 'TKT-999-FAKECODE-0000000000000000', 43, 'INVALID', 'Automated E2E Scanner Test (Invalid)', '::1', '2026-10-27 02:41:15');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (56, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 43, 'SUCCESS', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '::1', '2026-10-27 02:54:46');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (57, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 43, 'SUCCESS', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '::1', '2026-10-27 02:59:24');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (58, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 43, 'ALREADY_USED', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '::1', '2026-10-27 02:59:34');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (59, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 43, 'SUCCESS', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '::1', '2026-10-27 03:02:08');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (60, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 43, 'ALREADY_USED', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '::1', '2026-10-27 03:02:13');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (61, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 43, 'SUCCESS', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '::1', '2026-10-27 03:25:42');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (62, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 43, 'SUCCESS', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '::1', '2026-10-27 03:27:05');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (63, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 43, 'SUCCESS', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '::1', '2026-10-27 04:04:36');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (64, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 54, 'SUCCESS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/261002802 ZaloTheme/light ZaloLanguage/vn', '14.248.85.221', '2026-10-27 04:20:19');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (65, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 54, 'ALREADY_USED', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/261002802 ZaloTheme/light ZaloLanguage/vn', '14.248.85.221', '2026-10-27 04:20:26');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (66, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 54, 'ALREADY_USED', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/261002802 ZaloTheme/light ZaloLanguage/vn', '14.248.85.221', '2026-10-27 04:20:32');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (67, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 54, 'ALREADY_USED', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/261002802 ZaloTheme/light ZaloLanguage/vn', '14.248.85.221', '2026-10-27 04:20:35');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (68, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 43, 'SUCCESS', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '::1', '2026-10-27 04:34:41');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (69, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 43, 'SUCCESS', 'Mobile Scanner 1st Scan', '::1', '2026-10-27 04:40:46');
INSERT INTO `scan_logs` (`id`, `ticket_id`, `event_id`, `scanned_code`, `scanned_by`, `result`, `device_info`, `ip_address`, `scanned_at`) VALUES (70, 10, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 43, 'ALREADY_USED', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0', '::1', '2026-10-27 04:40:52');

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
) ENGINE=InnoDB AUTO_INCREMENT=91 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (1, 3, 6, 34, '2026-10-09 09:37:43', '2026-10-09 09:37:43', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (2, 3, 4, 25, '2026-10-09 09:37:43', '2026-10-09 09:37:43', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (3, 3, 2, 63, '2026-10-09 09:37:47', '2026-10-09 09:37:47', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (4, 3, 5, 12, '2026-10-09 09:37:49', '2026-10-09 09:37:49', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (5, 3, 3, 65, '2026-10-09 09:37:50', '2026-10-09 09:37:50', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (6, 4, 6, 34, '2026-10-09 09:38:53', '2026-10-09 09:38:53', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (7, 4, 5, 34, '2026-10-09 09:38:53', '2026-10-09 09:38:53', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (8, 4, 4, 34, '2026-10-09 09:38:53', '2026-10-09 09:38:53', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (9, 4, 3, 34, '2026-10-09 09:38:53', '2026-10-09 09:38:53', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (10, 4, 2, 34, '2026-10-09 09:38:53', '2026-10-09 09:38:53', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (11, 1, 6, 30, '2026-10-14 03:15:15', '2026-10-14 03:15:15', 1, 1, 0, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (12, 5, 2, 40, '2026-10-14 03:15:25', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (13, 5, 3, 0, '2026-10-14 03:15:25', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (20, 2, 1, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (21, 2, 2, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (22, 2, 3, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (23, 2, 4, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (24, 2, 5, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (25, 2, 6, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (26, 2, 28, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (27, 3, 1, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (33, 3, 28, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (34, 4, 1, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (40, 4, 28, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (41, 5, 1, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (44, 5, 4, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (45, 5, 5, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (46, 5, 6, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (47, 5, 28, 100, '2026-10-15 04:52:07', '2026-10-15 04:52:07', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (78, 7, 42, 50, '2026-10-22 11:02:12', '2026-10-27 02:38:58', 1, 1, 1, 1, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (79, 7, 43, 50, '2026-10-23 09:34:57', '2026-10-27 02:40:40', 1, 0, 0, 1, 0);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (80, 8, 50, 50, '2026-10-24 09:32:40', '2026-10-26 09:31:03', 1, 1, 0, 1, 0);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (81, 9, 26, 50, '2026-10-26 04:57:14', '2026-10-26 04:57:14', 1, 0, 0, 0, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (82, 8, 54, 50, '2026-10-26 09:22:05', '2026-10-26 09:22:05', 1, 0, 0, 1, 0);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (88, 8, 41, 50, '2026-10-27 02:54:02', '2026-10-27 02:54:02', 1, 1, 0, 0, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (89, 8, 42, 50, '2026-10-27 02:54:02', '2026-10-27 02:54:02', 1, 0, 1, 0, 1);
INSERT INTO `staff_event_quotas` (`id`, `event_id`, `staff_id`, `max_invites`, `created_at`, `updated_at`, `is_enabled`, `can_invite`, `can_approve`, `can_scan`, `can_view_report`) VALUES (90, 8, 43, 50, '2026-10-27 02:54:02', '2026-10-27 02:54:02', 1, 0, 0, 1, 1);

DROP TABLE IF EXISTS `subscription_plans`;
CREATE TABLE `subscription_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `event_credits` int NOT NULL,
  `validity_days` int NOT NULL,
  `price_vnd` bigint unsigned NOT NULL,
  `status` enum('ACTIVE','INACTIVE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
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
INSERT INTO `subscription_plans` (`id`, `code`, `name`, `description`, `event_credits`, `validity_days`, `price_vnd`, `status`, `created_at`, `updated_at`, `max_attendees`, `max_employees`, `max_referrers`, `max_scanners`, `is_trial`, `for_all_tenants`) VALUES (2, 'goi-thu-nghiem-1792833945932', 'gói thử nghiệm', NULL, 1, 1, 0, 'ACTIVE', '2026-10-24 09:25:45', '2026-10-24 09:25:45', 50, 5, 2, 1, 1, 1);
INSERT INTO `subscription_plans` (`id`, `code`, `name`, `description`, `event_credits`, `validity_days`, `price_vnd`, `status`, `created_at`, `updated_at`, `max_attendees`, `max_employees`, `max_referrers`, `max_scanners`, `is_trial`, `for_all_tenants`) VALUES (3, 'test-goi-co-tien-1792990158899', 'test gói có tiền', NULL, 1, 1, 2000000, 'ACTIVE', '2026-10-26 04:49:18', '2026-10-26 04:49:18', 1000, 20, 15, 7, 0, 1);

DROP TABLE IF EXISTS `subscription_requests`;
CREATE TABLE `subscription_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `event_credits` int NOT NULL,
  `validity_days` int NOT NULL,
  `price_vnd` bigint unsigned NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `requested_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `review_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_attendees` int NOT NULL DEFAULT '500',
  `max_employees` int NOT NULL DEFAULT '10',
  `max_referrers` int NOT NULL DEFAULT '10',
  `max_scanners` int NOT NULL DEFAULT '10',
  `event_id` int DEFAULT NULL,
  `package_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `subscription_requests` (`id`, `tenant_id`, `plan_id`, `event_credits`, `validity_days`, `price_vnd`, `status`, `requested_at`, `reviewed_at`, `reviewed_by`, `review_note`, `max_attendees`, `max_employees`, `max_referrers`, `max_scanners`, `event_id`, `package_name`) VALUES (1, 9, 3, 1, 1, 2000000, 'APPROVED', '2026-10-26 04:50:10', '2026-10-26 04:55:29', NULL, NULL, 1000, 20, 15, 7, 9, 'test gói có tiền');

DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('bank_account', '0386771868', '2026-10-22 10:29:57');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('bank_account_name', 'KTS QR EVENT', '2026-10-22 10:29:57');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('bank_code', 'MB', '2026-10-22 10:29:57');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('bank_name', 'MBBank', '2026-10-22 10:29:57');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('bank_qr_template', 'compact2', '2026-10-22 10:29:57');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('email_on_approved', 'true', '2026-10-13 09:48:12');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('geofence_default_radius', '1.111111111111111e+29', '2026-10-13 10:54:54');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('notify_hours_before', '24', '2026-10-13 09:48:12');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('smtp_from_name', 'KTSQR Event System', '2026-10-13 10:54:54');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('smtp_host', 'smtp.gmail.com', '2026-10-13 09:48:12');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('smtp_pass', '', '2026-10-13 09:48:12');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('smtp_port', '587', '2026-10-13 09:48:12');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('smtp_sender_name', 'Ban Tổ Chức KTSQR', '2026-10-13 09:48:12');
INSERT INTO `system_settings` (`key`, `value`, `updated_at`) VALUES ('smtp_user', 'noreply@eventqr.com', '2026-10-13 09:48:12');

DROP TABLE IF EXISTS `tenant_subscriptions`;
CREATE TABLE `tenant_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `event_credits` int NOT NULL,
  `events_used` int NOT NULL DEFAULT '0',
  `status` enum('ACTIVE','EXPIRED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
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
  `role` enum('OWNER','TEAM') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OWNER',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_user` (`tenant_id`,`user_id`),
  KEY `idx_tenant_users_tenant` (`tenant_id`),
  KEY `idx_tu_user` (`user_id`),
  CONSTRAINT `fk_tu_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tu_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (1, 1, 35, 'OWNER', '2026-10-21 08:45:36');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (2, 2, 36, 'OWNER', '2026-10-21 08:48:30');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (3, 3, 37, 'OWNER', '2026-10-21 08:49:37');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (4, 4, 38, 'OWNER', '2026-10-21 08:50:41');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (5, 5, 39, 'OWNER', '2026-10-21 08:52:10');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (7, 7, 41, 'OWNER', '2026-10-21 10:12:12');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (8, 7, 42, 'TEAM', '2026-10-22 10:31:10');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (9, 7, 43, 'TEAM', '2026-10-23 09:34:48');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (10, 7, 44, 'TEAM', '2026-10-23 10:02:53');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (11, 8, 46, 'OWNER', '2026-10-23 10:18:22');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (12, 9, 45, 'OWNER', '2026-10-23 10:38:10');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (14, 9, 41, 'TEAM', '2026-10-23 10:51:45');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (18, 11, 17, 'OWNER', '2026-10-24 08:28:49');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (19, 11, 50, 'TEAM', '2026-10-24 09:32:21');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (20, 9, 26, 'TEAM', '2026-10-26 04:57:02');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (21, 11, 54, 'TEAM', '2026-10-26 09:21:54');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (22, 11, 58, 'OWNER', '2026-10-27 02:54:02');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (23, 11, 41, 'TEAM', '2026-10-27 02:54:02');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (24, 11, 42, 'TEAM', '2026-10-27 02:54:02');
INSERT INTO `tenant_users` (`id`, `tenant_id`, `user_id`, `role`, `created_at`) VALUES (25, 11, 43, 'TEAM', '2026-10-27 02:54:02');

DROP TABLE IF EXISTS `tenants`;
CREATE TABLE `tenants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','BLOCKED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `free_events_used` int NOT NULL DEFAULT '0',
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_tenants_creator` (`created_by`),
  KEY `idx_tenants_status` (`status`),
  CONSTRAINT `fk_tenants_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (1, 'Disposable Smoke Tenant', 'Smoke Test', 'smoke_1792572336914@example.invalid', NULL, 'ACTIVE', 0, 1, '2026-10-21 08:45:36', '2026-10-21 08:45:36');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (2, 'Temporary QA Tenant', 'QA', 'full_1792572510548@example.invalid', NULL, 'ACTIVE', 0, 1, '2026-10-21 08:48:30', '2026-10-21 08:48:30');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (3, 'Temporary QA Tenant', 'QA', 'full_1792572577609@example.invalid', NULL, 'ACTIVE', 0, 1, '2026-10-21 08:49:37', '2026-10-21 08:49:37');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (4, 'Temporary QA Tenant', 'QA', 'full_1792572641073@example.invalid', NULL, 'ACTIVE', 0, 1, '2026-10-21 08:50:41', '2026-10-21 08:50:41');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (5, 'Temporary QA Tenant', 'QA', 'full_1792572730786@example.invalid', NULL, 'ACTIVE', 0, 1, '2026-10-21 08:52:10', '2026-10-21 08:52:10');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (7, 'Kts', 'tétttt', 'test@gmail.com', '0867198642', 'ACTIVE', 1, 28, '2026-10-21 10:12:12', '2026-10-22 10:42:57');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (8, 'Cong Ty Su Kien VinaTest', 'Nguyen Van Chu', 'chutenant_test123@gmail.com', '0912345678', 'ACTIVE', 0, 46, '2026-10-23 10:18:22', '2026-10-23 10:18:22');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (9, 'hoanghieutesst Event Org', 'hoanghieutesst', 'hvan8615@gmail.com', NULL, 'ACTIVE', 0, 45, '2026-10-23 10:38:10', '2026-10-23 10:38:10');
INSERT INTO `tenants` (`id`, `name`, `contact_name`, `contact_email`, `phone`, `status`, `free_events_used`, `created_by`, `created_at`, `updated_at`) VALUES (11, 'test', 'hieu test', 'hvan8677@gmail.com', '0867198647', 'ACTIVE', 1, 17, '2026-10-24 08:28:49', '2026-10-24 09:27:00');

DROP TABLE IF EXISTS `tickets`;
CREATE TABLE `tickets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `registration_id` int NOT NULL,
  `event_id` int NOT NULL,
  `code` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ISSUED','USED','VOID') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ISSUED',
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
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `tickets` (`id`, `registration_id`, `event_id`, `code`, `status`, `used_at`, `used_by`, `created_at`, `updated_at`) VALUES (1, 1, 1, 'TKT-TEST-1790996008149', 'USED', '2026-10-03 02:53:28', 5, '2026-10-03 02:53:28', '2026-10-03 02:53:28');
INSERT INTO `tickets` (`id`, `registration_id`, `event_id`, `code`, `status`, `used_at`, `used_by`, `created_at`, `updated_at`) VALUES (2, 3, 1, 'TKT-1-C75F9E95-83B5509678C86B00', 'USED', '2026-10-03 03:43:05', 1, '2026-10-03 03:05:17', '2026-10-03 03:43:05');
INSERT INTO `tickets` (`id`, `registration_id`, `event_id`, `code`, `status`, `used_at`, `used_by`, `created_at`, `updated_at`) VALUES (3, 4, 1, 'TKT-1-EA89064C-44098E7D4A01A6C3', 'USED', '2026-10-09 08:23:54', 1, '2026-10-09 08:21:27', '2026-10-09 08:23:54');
INSERT INTO `tickets` (`id`, `registration_id`, `event_id`, `code`, `status`, `used_at`, `used_by`, `created_at`, `updated_at`) VALUES (4, 5, 3, 'TKT-3-AE308AB6-BB26D550C856F936', 'ISSUED', NULL, NULL, '2026-10-09 08:33:26', '2026-10-09 10:53:42');
INSERT INTO `tickets` (`id`, `registration_id`, `event_id`, `code`, `status`, `used_at`, `used_by`, `created_at`, `updated_at`) VALUES (5, 6, 4, 'TKT-4-8A2A10CA-146A96E31B010689', 'USED', '2026-10-09 10:29:59', 1, '2026-10-09 09:41:38', '2026-10-09 10:29:59');
INSERT INTO `tickets` (`id`, `registration_id`, `event_id`, `code`, `status`, `used_at`, `used_by`, `created_at`, `updated_at`) VALUES (6, 2, 1, 'TKT-1-66F09257-FEF87D0D14627800', 'ISSUED', NULL, NULL, '2026-10-12 10:45:46', '2026-10-12 10:45:46');
INSERT INTO `tickets` (`id`, `registration_id`, `event_id`, `code`, `status`, `used_at`, `used_by`, `created_at`, `updated_at`) VALUES (7, 8, 4, 'TKT-4-706DF4DF-66DDA3F7164AAA3A', 'USED', '2026-10-13 10:55:09', 1, '2026-10-13 10:46:19', '2026-10-13 10:55:09');
INSERT INTO `tickets` (`id`, `registration_id`, `event_id`, `code`, `status`, `used_at`, `used_by`, `created_at`, `updated_at`) VALUES (8, 9, 5, 'TKT-5-0A7E80C2-678D21022FBFEBF1', 'USED', '2026-10-15 03:43:52', 5, '2026-10-15 03:42:47', '2026-10-15 03:43:52');
INSERT INTO `tickets` (`id`, `registration_id`, `event_id`, `code`, `status`, `used_at`, `used_by`, `created_at`, `updated_at`) VALUES (9, 10, 7, 'TKT-7-18133918-873E3B36A900A9A1', 'ISSUED', NULL, NULL, '2026-10-23 09:47:10', '2026-10-23 09:47:10');
INSERT INTO `tickets` (`id`, `registration_id`, `event_id`, `code`, `status`, `used_at`, `used_by`, `created_at`, `updated_at`) VALUES (10, 11, 8, 'TKT-8-AA7B6D6A-99990732C7423E37', 'USED', '2026-10-27 04:40:46', 43, '2026-10-24 09:43:16', '2026-10-27 04:40:46');
INSERT INTO `tickets` (`id`, `registration_id`, `event_id`, `code`, `status`, `used_at`, `used_by`, `created_at`, `updated_at`) VALUES (11, 12, 7, 'TKT-7-B05509BF-141A60592E92A194', 'USED', '2026-10-27 02:40:41', 43, '2026-10-27 02:40:40', '2026-10-27 02:40:41');
INSERT INTO `tickets` (`id`, `registration_id`, `event_id`, `code`, `status`, `used_at`, `used_by`, `created_at`, `updated_at`) VALUES (12, 13, 7, 'TKT-7-BB0CCCCD-14CF41BE6193DEAD', 'USED', '2026-10-27 02:41:15', 43, '2026-10-27 02:41:15', '2026-10-27 02:41:15');
INSERT INTO `tickets` (`id`, `registration_id`, `event_id`, `code`, `status`, `used_at`, `used_by`, `created_at`, `updated_at`) VALUES (13, 15, 8, 'TKT-8-DEMO-CHUA-CHECKIN', 'ISSUED', NULL, NULL, '2026-10-27 09:53:23', '2026-10-27 09:53:23');

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
) ENGINE=InnoDB AUTO_INCREMENT=103 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (4, 3, 4, '2026-10-03 02:44:21');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (5, 3, 5, '2026-10-03 02:44:21');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (6, 3, 6, '2026-10-03 02:44:21');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (7, 4, 4, '2026-10-03 02:44:21');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (8, 4, 5, '2026-10-03 02:44:21');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (9, 4, 6, '2026-10-03 02:44:21');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (10, 5, 7, '2026-10-03 02:44:21');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (11, 6, 8, '2026-10-03 02:44:21');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (12, 6, 7, '2026-10-03 02:44:21');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (37, 3, 7, '2026-10-09 09:45:22');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (38, 4, 7, '2026-10-09 09:45:22');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (48, 2, 4, '2026-10-09 09:53:08');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (49, 2, 5, '2026-10-09 09:53:08');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (50, 2, 6, '2026-10-09 09:53:08');
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
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (101, 43, 5, '2026-10-27 02:41:15');
INSERT INTO `user_permissions` (`id`, `user_id`, `permission_id`, `created_at`) VALUES (102, 43, 7, '2026-10-27 02:41:15');

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` enum('ADMIN','STAFF','CUSTOMER','TENANT_ADMIN') COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp_expires_at` datetime DEFAULT NULL,
  `status` enum('ACTIVE','BLOCKED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone` (`phone`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_type_status` (`type`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=59 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (1, 'ADMIN', 'Tổng Quản Trị Viên', '0900000001', 'admin@eventqr.com', '$2b$10$FKrcb.bbATE3paqXd0FUrObI/aIBpdrl3C3xzTFtlevit1YlsXAFW', NULL, NULL, 'ACTIVE', '2026-10-03 02:44:21', '2026-10-03 02:44:21');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (2, 'STAFF', 'Nguyễn Văn A (Giới thiệu 1)', '0900000002', 'staff_a@eventqr.com', '$2b$10$4a8n9io/43OBWBL0NWBfjeZo2DFy7mO3n.OB7XMHj/X2/WK98owAq', NULL, NULL, 'ACTIVE', '2026-10-03 02:44:21', '2026-10-03 02:44:21');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (3, 'STAFF', 'Trần Thị B (Giới thiệu 2)', '0900000003', 'staff_b@eventqr.com', '$2b$10$4a8n9io/43OBWBL0NWBfjeZo2DFy7mO3n.OB7XMHj/X2/WK98owAq', NULL, NULL, 'ACTIVE', '2026-10-03 02:44:21', '2026-10-03 02:44:21');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (4, 'STAFF', 'Lê Văn C (Giới thiệu 3)', '0900000004', 'staff_c@eventqr.com', '$2b$10$4a8n9io/43OBWBL0NWBfjeZo2DFy7mO3n.OB7XMHj/X2/WK98owAq', NULL, NULL, 'ACTIVE', '2026-10-03 02:44:21', '2026-10-03 02:44:21');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (5, 'STAFF', 'Phạm Văn D (Soát vé Check-in)', '0900000005', 'staff_d@eventqr.com', '$2b$10$4a8n9io/43OBWBL0NWBfjeZo2DFy7mO3n.OB7XMHj/X2/WK98owAq', NULL, NULL, 'ACTIVE', '2026-10-03 02:44:21', '2026-10-03 02:44:21');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (6, 'STAFF', 'Hoàng Thị E (Quản lý khách hàng)', '0900000006', 'staff_e@eventqr.com', '$2b$10$4a8n9io/43OBWBL0NWBfjeZo2DFy7mO3n.OB7XMHj/X2/WK98owAq', NULL, NULL, 'ACTIVE', '2026-10-03 02:44:21', '2026-10-03 02:44:21');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (7, 'CUSTOMER', 'Khách Thử Nghiệm Concurrency', '0999999999', 'test_concurrent_1790995468621@example.com', NULL, NULL, NULL, 'ACTIVE', '2026-10-03 02:44:28', '2026-10-03 02:44:28');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (15, 'CUSTOMER', 'Khách Thử Nghiệm Concurrency', '0978481799', 'test_concurrent_1790996008130@example.com', NULL, NULL, NULL, 'ACTIVE', '2026-10-03 02:53:28', '2026-10-03 02:53:28');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (16, 'CUSTOMER', 'Khách của NV A', '0914167265', 'guest_a_1790996008240@example.com', NULL, NULL, NULL, 'ACTIVE', '2026-10-03 02:53:28', '2026-10-03 02:53:28');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (17, 'TENANT_ADMIN', 'hieu test', '0867198647', 'hvan8677@gmail.com', '$2b$10$rO2IBJM8q4V.C0Sfpk.W3.5o8Kodu7XmUK7HjXdBD8ZGgp.DzcI/q', NULL, NULL, 'ACTIVE', '2026-10-03 03:00:16', '2026-10-24 08:43:17');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (18, 'CUSTOMER', 'hvan7677', NULL, 'hvan7677@gmail.com', NULL, '200813', '2026-10-03 03:19:46', 'ACTIVE', '2026-10-03 03:14:45', '2026-10-03 03:14:45');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (25, 'CUSTOMER', 'Hoàng Văn Hiếu', '0867198644', 'hvan33584@gmail.com', NULL, NULL, NULL, 'ACTIVE', '2026-10-09 08:15:50', '2026-10-09 08:17:57');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (26, 'STAFF', 'haquynhktsvn', NULL, 'haquynhktsvn@gmail.com', NULL, NULL, NULL, 'ACTIVE', '2026-10-13 10:40:58', '2026-10-26 04:57:02');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (28, 'ADMIN', 'Hoàng Văn Hiếu', '0867198643', 'hvan86771@gmail.com', '$2b$10$naV6ftAS3yOCOJpstmDRKOGfOOz.NNJDeMPjHj7DDtPlh/ZD/0TIa', NULL, NULL, 'ACTIVE', '2026-10-15 03:47:17', '2026-10-27 02:54:02');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (35, 'TENANT_ADMIN', 'Smoke Owner', NULL, 'smoke_1792572336914@example.invalid', '$2b$10$4.mcwxajq6BUeqU75JjpSu2dmyg6swwORiv2tHqrmK/R.DCYF2VbS', NULL, NULL, 'ACTIVE', '2026-10-21 08:45:36', '2026-10-21 08:45:36');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (36, 'TENANT_ADMIN', 'QA Owner', NULL, 'full_1792572510548@example.invalid', '$2b$10$m0QYJYRxXnVGQCl47WmlU.9WGWoFv/cYFUw4KHnyunt8T37qK6J8u', NULL, NULL, 'ACTIVE', '2026-10-21 08:48:30', '2026-10-21 08:48:30');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (37, 'TENANT_ADMIN', 'QA Owner', NULL, 'full_1792572577609@example.invalid', '$2b$10$qXdchC7jENJekaSJn98ZIeddpy8AifbRlNIWiF9dwO/soBqb6nNVi', NULL, NULL, 'ACTIVE', '2026-10-21 08:49:37', '2026-10-21 08:49:37');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (38, 'TENANT_ADMIN', 'QA Owner', NULL, 'full_1792572641073@example.invalid', '$2b$10$0O7QYkChhp5I.q109/bHEuhKFtAeJBFSNIVWXCGskebDyna87PfG2', NULL, NULL, 'ACTIVE', '2026-10-21 08:50:41', '2026-10-21 08:50:41');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (39, 'TENANT_ADMIN', 'QA Owner', NULL, 'full_1792572730786@example.invalid', '$2b$10$OCseEEr//.acccoNkBMX5eQ1k0XbRef0pqtrHR/ff8uT.O87qFRXa', NULL, NULL, 'ACTIVE', '2026-10-21 08:52:10', '2026-10-21 08:52:10');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (41, 'STAFF', 'háidasdjasd', '0867198642', 'hvan8611@gmail.com', '$2b$10$Cf5hRV10oGdPiGCn5XAfWuWtl.2Ufb09CNOL2Djh6E5c4zheKZm9K', NULL, NULL, 'ACTIVE', '2026-10-21 10:12:12', '2026-10-27 02:54:02');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (42, 'STAFF', 'HoàngHieu', '0867108748', 'hvan8612@gmail.com', '$2b$10$Cf5hRV10oGdPiGCn5XAfWuWtl.2Ufb09CNOL2Djh6E5c4zheKZm9K', NULL, NULL, 'ACTIVE', '2026-10-22 10:31:10', '2026-10-27 02:54:02');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (43, 'STAFF', 'NvDuyetve', '0867198623', 'hvan8613@gmail.com', '$2b$10$Cf5hRV10oGdPiGCn5XAfWuWtl.2Ufb09CNOL2Djh6E5c4zheKZm9K', NULL, NULL, 'ACTIVE', '2026-10-23 09:34:48', '2026-10-27 02:54:02');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (44, 'STAFF', 'Nhan Vien Test', '0987654321', 'nhanvien_test99@gmail.com', '$2b$10$51JgOeZ5E4dorBP8wS9rDe0kj47yQEE6YEZLfGdrZWCIvs7hGX6sC', NULL, NULL, 'ACTIVE', '2026-10-23 10:02:30', '2026-10-23 10:10:15');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (45, 'TENANT_ADMIN', 'hoanghieutesst', '0898945628', 'hvan8615@gmail.com', '$2b$10$Ip.agmvGW0troJtZD1JU2eqElT8PI5IF4tGnbZ2SfIUDkw/.u1NFm', NULL, NULL, 'ACTIVE', '2026-10-23 10:04:51', '2026-10-23 10:38:10');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (46, 'TENANT_ADMIN', 'Nguyen Van Chu', '0912345678', 'chutenant_test123@gmail.com', '$2b$10$.7SKjTygvrvnVr131jDcFe/4ko8OdItm5PBCHXVaivpSg9pWvLbsu', NULL, NULL, 'ACTIVE', '2026-10-23 10:18:22', '2026-10-23 10:18:22');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (50, 'STAFF', 'hieutestkhachmoi', '0867918231', 'testkhachmoi@gmail.com', '$2b$10$SFkFFEYWsoy5nqzvWjxCJu4WYERn4CIM5dg1fBjscgNISKpMBYjc6', NULL, NULL, 'ACTIVE', '2026-10-24 09:32:21', '2026-10-24 09:32:21');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (51, 'CUSTOMER', 'hieuhoang', NULL, 'hieuhoang@gmail.com', NULL, NULL, NULL, 'ACTIVE', '2026-10-24 09:42:46', '2026-10-27 02:54:03');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (54, 'STAFF', 'hieuquetpr', '0867198640', 'hieuqr@gmail.com', '$2b$10$Rx.fmyqyN78LMiVZ64TsRezLLDgo9o1GS.y.YnNVV6DeViGhKQU.6', NULL, NULL, 'ACTIVE', '2026-10-26 09:21:54', '2026-10-26 09:21:54');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (55, 'CUSTOMER', 'Nguyễn Minh Khách VIP', '0943631279', 'khachvip_1793068739604@eventqr.vn', NULL, NULL, NULL, 'ACTIVE', '2026-10-27 02:38:59', '2026-10-27 02:38:59');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (56, 'CUSTOMER', 'Nguyễn Minh Khách VIP', '0998781436', 'khachvip_1793068840737@eventqr.vn', NULL, NULL, NULL, 'ACTIVE', '2026-10-27 02:40:40', '2026-10-27 02:40:40');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (57, 'CUSTOMER', 'Nguyễn Minh Khách VIP', '0929896532', 'khachvip_1793068875661@eventqr.vn', NULL, NULL, NULL, 'ACTIVE', '2026-10-27 02:41:15', '2026-10-27 02:41:15');
INSERT INTO `users` (`id`, `type`, `name`, `phone`, `email`, `password_hash`, `otp_code`, `otp_expires_at`, `status`, `created_at`, `updated_at`) VALUES (58, 'TENANT_ADMIN', 'Hoàng Hiếu (Chủ Sự Kiện)', '0901112233', 'hoanghieufc25@gmail.com', '$2b$10$Cf5hRV10oGdPiGCn5XAfWuWtl.2Ufb09CNOL2Djh6E5c4zheKZm9K', NULL, NULL, 'ACTIVE', '2026-10-27 02:53:29', '2026-10-27 02:54:02');

SET FOREIGN_KEY_CHECKS = 1;
