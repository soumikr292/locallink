-- LocalLink Admin Enhancements Migration: Taxes and Platform Notifications

CREATE TABLE IF NOT EXISTS `tax_rates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `cgst_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `sgst_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `igst_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `hsn_code` varchar(50) DEFAULT '0000',
  `category_name` varchar(100) DEFAULT 'General',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tax_rates_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `platform_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `target_audience` enum('all','sellers','customers','riders','staff') NOT NULL DEFAULT 'all',
  `channel` enum('in_app','email','sms','push') NOT NULL DEFAULT 'in_app',
  `type` varchar(50) NOT NULL DEFAULT 'broadcast',
  `status` enum('sent','queued','failed') NOT NULL DEFAULT 'sent',
  `recipients_count` int(11) NOT NULL DEFAULT 0,
  `created_by` varchar(100) DEFAULT 'Super Admin',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_plat_notif_audience` (`target_audience`),
  KEY `idx_plat_notif_channel` (`channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
