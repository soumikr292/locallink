-- LocalLink Admin Enhancements Migration: Taxes and Platform Notifications

CREATE TABLE IF NOT EXISTS `tax_rates` (
  `rate_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `slab_name` varchar(150) NOT NULL,
  `rate_percentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `hsn_code` varchar(50) DEFAULT NULL,
  `cgst_percentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `sgst_percentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `igst_percentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `category_name` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rate_id`),
  KEY `idx_tax_rates_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `platform_notifications` (
  `notification_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `target_audience` enum('all', 'sellers', 'riders', 'customers', 'staff') NOT NULL DEFAULT 'all',
  `channel` enum('in_app', 'sms', 'email', 'push') NOT NULL DEFAULT 'in_app',
  `notification_type` varchar(50) NOT NULL DEFAULT 'announcement',
  `status` enum('sent', 'delivered', 'pending', 'failed') NOT NULL DEFAULT 'sent',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `idx_plat_notif_audience` (`target_audience`),
  KEY `idx_plat_notif_channel` (`channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
