-- ========================================================
-- DATABASE SCHEMA: EVENT MANAGEMENT & QR TICKET CHECK-IN
-- Target: MySQL 8.0 (InnoDB, utf8mb4)
-- ========================================================

CREATE DATABASE IF NOT EXISTS `event_qr_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `event_qr_db`;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `type` ENUM('ADMIN', 'STAFF', 'CUSTOMER', 'TENANT_ADMIN') NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(20) NULL UNIQUE,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NULL,
  `otp_code` VARCHAR(10) NULL,
  `otp_expires_at` DATETIME NULL,
  `status` ENUM('ACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_type_status` (`type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.1 TENANTS (Organizations that rent the platform)
CREATE TABLE IF NOT EXISTS `tenants` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `contact_name` VARCHAR(150) NOT NULL,
  `contact_email` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `status` ENUM('ACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
  `free_events_used` INT NOT NULL DEFAULT 0,
  `created_by` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tenants_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  INDEX `idx_tenants_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Each tenant account is scoped to one organization.
CREATE TABLE IF NOT EXISTS `tenant_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `role` ENUM('OWNER', 'TEAM') NOT NULL DEFAULT 'OWNER',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_tenant_user` (`tenant_id`, `user_id`),
  INDEX `idx_tenant_users_tenant` (`tenant_id`),
  CONSTRAINT `fk_tu_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tu_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.2 ONE-EVENT PACKAGE CATALOG (legacy credit columns are kept for upgrades)
CREATE TABLE IF NOT EXISTS `subscription_plans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(60) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `event_credits` INT NOT NULL,
  `validity_days` INT NOT NULL,
  `max_attendees` INT NOT NULL DEFAULT 500,
  `max_employees` INT NOT NULL DEFAULT 10,
  `max_referrers` INT NOT NULL DEFAULT 10,
  `max_scanners` INT NOT NULL DEFAULT 10,
  `is_trial` TINYINT(1) NOT NULL DEFAULT 0,
  `price_vnd` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_subscriptions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT NOT NULL,
  `plan_id` INT NOT NULL,
  `event_credits` INT NOT NULL,
  `events_used` INT NOT NULL DEFAULT 0,
  `status` ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `starts_at` DATETIME NOT NULL,
  `ends_at` DATETIME NOT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_tenant_subscription_active` (`tenant_id`, `status`, `ends_at`),
  CONSTRAINT `fk_ts_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ts_plan` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`),
  CONSTRAINT `fk_ts_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subscription_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT NOT NULL,
  `plan_id` INT NOT NULL,
  `event_credits` INT NOT NULL,
  `validity_days` INT NOT NULL,
  `package_name` VARCHAR(150) NULL,
  `max_attendees` INT NOT NULL DEFAULT 500,
  `max_employees` INT NOT NULL DEFAULT 10,
  `max_referrers` INT NOT NULL DEFAULT 10,
  `max_scanners` INT NOT NULL DEFAULT 10,
  `event_id` INT NULL,
  `price_vnd` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` DATETIME NULL,
  `reviewed_by` INT NULL,
  `review_note` VARCHAR(500) NULL,
  UNIQUE KEY `uq_subscription_request_event` (`event_id`),
  INDEX `idx_subscription_requests_status` (`status`, `requested_at`),
  CONSTRAINT `fk_sr_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sr_plan` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`),
  CONSTRAINT `fk_sr_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. PERMISSIONS TABLE (Granular RBAC)
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(100) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. USER_PERMISSIONS TABLE (Many-to-Many Dynamic Assignment)
CREATE TABLE IF NOT EXISTS `user_permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `permission_id` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_user_permission` (`user_id`, `permission_id`),
  CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_up_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. EVENTS TABLE
CREATE TABLE IF NOT EXISTS `events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `location` VARCHAR(255) NOT NULL,
  `latitude` DECIMAL(10, 8) NULL,
  `longitude` DECIMAL(11, 8) NULL,
  `geofence_radius_meters` INT NOT NULL DEFAULT 500,
  `geofence_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `poster_url` VARCHAR(500) NULL,
  `start_at` DATETIME NOT NULL,
  `end_at` DATETIME NOT NULL,
  `capacity` INT NOT NULL DEFAULT 500,
  `session_mode` ENUM('FULL_DAY', 'SPLIT_SESSIONS') NOT NULL DEFAULT 'FULL_DAY',
  `morning_capacity` INT NULL,
  `afternoon_capacity` INT NULL,
  `approval_mode` ENUM('REFERRER_ONLY', 'TWO_TIER', 'AUTO') NOT NULL DEFAULT 'REFERRER_ONLY',
  `status` ENUM('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'PUBLISHED',
  `created_by` INT NOT NULL,
  `tenant_id` INT NULL,
  `package_request_id` INT NULL,
  `package_name` VARCHAR(150) NULL,
  `max_employees` INT NOT NULL DEFAULT 10,
  `max_referrers` INT NOT NULL DEFAULT 10,
  `max_scanners` INT NOT NULL DEFAULT 10,
  `package_price_vnd` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `is_trial` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_events_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_events_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE SET NULL,
  INDEX `idx_events_tenant_start` (`tenant_id`, `start_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `system_settings` (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `system_settings` (`key`, `value`) VALUES
  ('smtp_host', 'smtp.gmail.com'),
  ('smtp_port', '587'),
  ('smtp_user', 'noreply@eventqr.com'),
  ('smtp_pass', ''),
  ('smtp_sender_name', 'Ban Tổ Chức KTSQR'),
  ('email_on_approved', 'true'),
  ('notify_hours_before', '24'),
  ('geofence_default_radius', '500');

-- 5. INVITE_LINKS TABLE (Referral links with signed tamper-proof tokens)
CREATE TABLE IF NOT EXISTS `invite_links` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `event_id` INT NOT NULL,
  `referrer_id` INT NOT NULL,
  `token` VARCHAR(255) NOT NULL UNIQUE,
  `signature` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `max_registrations` INT NOT NULL DEFAULT 100,
  `current_registrations` INT NOT NULL DEFAULT 0,
  `session_type` ENUM('FULL_DAY', 'MORNING', 'AFTERNOON') NOT NULL DEFAULT 'FULL_DAY',
  `status` ENUM('ACTIVE', 'REVOKED', 'EXPIRED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_il_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_il_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_il_event_referrer` (`event_id`, `referrer_id`),
  INDEX `idx_il_token` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.1 STAFF_EVENT_QUOTAS TABLE (Admin limits how many guests each staff can invite)
CREATE TABLE IF NOT EXISTS `staff_event_quotas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `event_id` INT NOT NULL,
  `staff_id` INT NOT NULL,
  `max_invites` INT NOT NULL DEFAULT 50,
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `can_invite` TINYINT(1) NOT NULL DEFAULT 1,
  `can_approve` TINYINT(1) NOT NULL DEFAULT 1,
  `can_scan` TINYINT(1) NOT NULL DEFAULT 1,
  `can_view_report` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_event_staff` (`event_id`, `staff_id`),
  CONSTRAINT `fk_seq_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_seq_staff` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS `registrations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `event_id` INT NOT NULL,
  `customer_id` INT NOT NULL,
  `invite_link_id` INT NOT NULL,
  `referrer_id` INT NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `address` VARCHAR(255) NULL,
  `session_type` ENUM('FULL_DAY', 'MORNING', 'AFTERNOON') NOT NULL DEFAULT 'FULL_DAY',
  `status` ENUM('PENDING', 'PENDING_ADMIN', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `rejection_reason` TEXT NULL,
  `approved_by` INT NULL,
  `approved_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_event_customer` (`event_id`, `customer_id`),
  CONSTRAINT `fk_reg_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reg_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reg_invite` FOREIGN KEY (`invite_link_id`) REFERENCES `invite_links` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reg_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reg_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_reg_referrer_status` (`referrer_id`, `status`),
  INDEX `idx_reg_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. TICKETS TABLE (One-time QR Ticket with Atomic State Engine)
CREATE TABLE IF NOT EXISTS `tickets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `registration_id` INT NOT NULL UNIQUE,
  `event_id` INT NOT NULL,
  `code` VARCHAR(255) NOT NULL UNIQUE,
  `status` ENUM('ISSUED', 'USED', 'VOID') NOT NULL DEFAULT 'ISSUED',
  `used_at` DATETIME NULL,
  `used_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tkt_reg` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tkt_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tkt_used_by` FOREIGN KEY (`used_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_tkt_code_event` (`code`, `event_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. SCAN_LOGS TABLE (Full audit of every QR scan attempt)
CREATE TABLE IF NOT EXISTS `scan_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_id` INT NULL,
  `event_id` INT NOT NULL,
  `scanned_code` VARCHAR(255) NOT NULL,
  `scanned_by` INT NOT NULL,
  `result` ENUM('SUCCESS', 'INVALID', 'ALREADY_USED') NOT NULL,
  `device_info` VARCHAR(255) NULL,
  `ip_address` VARCHAR(45) NULL,
  `scanned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sl_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sl_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sl_scanner` FOREIGN KEY (`scanned_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_sl_ticket` (`ticket_id`),
  INDEX `idx_sl_scanned_at` (`scanned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. DISPUTES TABLE (Ca giải trình khi QR đã được sử dụng)
CREATE TABLE IF NOT EXISTS `disputes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `scan_log_id` INT NOT NULL,
  `ticket_id` INT NOT NULL,
  `claimant_name` VARCHAR(150) NOT NULL,
  `claimant_phone` VARCHAR(20) NOT NULL,
  `explanation` TEXT NOT NULL,
  `recorded_by` INT NOT NULL,
  `decided_by` INT NULL,
  `decision` ENUM('PENDING', 'ALLOW', 'DENY') NOT NULL DEFAULT 'PENDING',
  `decision_note` TEXT NULL,
  `decided_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_dsp_scanlog` FOREIGN KEY (`scan_log_id`) REFERENCES `scan_logs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dsp_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dsp_recorder` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dsp_decider` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_dsp_decision` (`decision`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. AUDIT_LOGS TABLE (Sensitive Action Tracking)
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity` VARCHAR(50) NOT NULL,
  `entity_id` INT NULL,
  `details` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_al_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_al_action` (`action`),
  INDEX `idx_al_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
