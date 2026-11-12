-- LocalLink Seller Module Migrations

-- 1. Seller Profiles
CREATE TABLE IF NOT EXISTS `seller_profiles` (
  `profile_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `seller_id` bigint(20) unsigned NOT NULL,
  `shop_name` varchar(200) NOT NULL,
  `shop_slug` varchar(220) DEFAULT NULL,
  `shop_description` text DEFAULT NULL,
  `shop_logo` varchar(500) DEFAULT NULL,
  `shop_banner` varchar(500) DEFAULT NULL,
  `business_email` varchar(255) DEFAULT NULL,
  `business_phone` varchar(30) DEFAULT NULL,
  `shop_address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT 'Kolkata',
  `pincode` varchar(20) DEFAULT NULL,
  `business_category` varchar(100) DEFAULT 'General Store',
  `opening_time` varchar(20) DEFAULT '08:00 AM',
  `closing_time` varchar(20) DEFAULT '10:00 PM',
  `is_vacation_mode` tinyint(1) NOT NULL DEFAULT 0,
  `vacation_message` varchar(500) DEFAULT NULL,
  `bank_name` varchar(150) DEFAULT NULL,
  `account_holder_name` varchar(150) DEFAULT NULL,
  `account_number` varchar(50) DEFAULT NULL,
  `ifsc_code` varchar(30) DEFAULT NULL,
  `upi_id` varchar(100) DEFAULT NULL,
  `commission_rate` decimal(5,2) NOT NULL DEFAULT 5.00,
  `verification_status` enum('pending', 'verified', 'rejected') NOT NULL DEFAULT 'verified',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`profile_id`),
  UNIQUE KEY `uq_seller_profile_seller` (`seller_id`),
  CONSTRAINT `fk_seller_profile_user` FOREIGN KEY (`seller_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Seller Payouts
CREATE TABLE IF NOT EXISTS `seller_payouts` (
  `payout_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `seller_id` bigint(20) unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payout_method` enum('bank_transfer', 'upi') NOT NULL DEFAULT 'upi',
  `payout_details` varchar(255) NOT NULL,
  `status` enum('pending', 'processing', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
  `transaction_reference` varchar(150) DEFAULT NULL,
  `admin_notes` text DEFAULT NULL,
  `requested_at` datetime NOT NULL DEFAULT current_timestamp(),
  `processed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`payout_id`),
  KEY `idx_seller_payout_seller` (`seller_id`),
  KEY `idx_seller_payout_status` (`status`),
  CONSTRAINT `fk_seller_payout_user` FOREIGN KEY (`seller_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Seller Notifications
CREATE TABLE IF NOT EXISTS `seller_notifications` (
  `notification_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `seller_id` bigint(20) unsigned NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `type` enum('order', 'inventory', 'review', 'payout', 'system') NOT NULL DEFAULT 'system',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`notification_id`),
  KEY `idx_seller_notif_seller` (`seller_id`),
  KEY `idx_seller_notif_read` (`is_read`),
  CONSTRAINT `fk_seller_notif_user` FOREIGN KEY (`seller_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Seller Support Tickets
CREATE TABLE IF NOT EXISTS `seller_support_tickets` (
  `ticket_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `seller_id` bigint(20) unsigned NOT NULL,
  `ticket_number` varchar(50) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL DEFAULT 'general',
  `priority` enum('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  `status` enum('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`ticket_id`),
  UNIQUE KEY `uq_seller_ticket_number` (`ticket_number`),
  KEY `idx_seller_ticket_seller` (`seller_id`),
  KEY `idx_seller_ticket_status` (`status`),
  CONSTRAINT `fk_seller_ticket_user` FOREIGN KEY (`seller_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. Seller Support Messages
CREATE TABLE IF NOT EXISTS `seller_support_messages` (
  `message_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ticket_id` bigint(20) unsigned NOT NULL,
  `sender_id` bigint(20) unsigned NOT NULL,
  `sender_role` enum('seller', 'admin', 'staff') NOT NULL,
  `message` text NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`message_id`),
  KEY `idx_ticket_msg_ticket` (`ticket_id`),
  CONSTRAINT `fk_ticket_msg_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `seller_support_tickets` (`ticket_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ticket_msg_user` FOREIGN KEY (`sender_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
