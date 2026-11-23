-- Local XAMPP setup: create and select the app database before making tables.
CREATE DATABASE IF NOT EXISTS pookieeater
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE pookieeater;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(24) NOT NULL,
  first_name VARCHAR(60) NOT NULL,
  middle_name VARCHAR(60) NULL,
  last_name VARCHAR(60) NOT NULL,
  age TINYINT UNSIGNED NULL,
  sex ENUM('female', 'male', 'prefer-not-to-say') NOT NULL DEFAULT 'prefer-not-to-say',
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_username_unique (username)
) ENGINE=InnoDB;

-- The admin password is stored as a PHP password_hash() bcrypt hash.
-- Username matching uses the table's case-insensitive collation.
INSERT INTO users (username, first_name, last_name, sex, password_hash, role)
VALUES (
  'Marianne Dionisio',
  'Marianne',
  'Dionisio',
  'prefer-not-to-say',
  '$2y$10$q5KGPsp3BLD9mz8v8O8ok..cDMvmJmVDM5c9mkFhruXo11GLU5HiK',
  'admin'
)
ON DUPLICATE KEY UPDATE role = 'admin';

CREATE TABLE IF NOT EXISTS cart_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(120) NOT NULL,
  product_data LONGTEXT NOT NULL,
  quantity TINYINT UNSIGNED NOT NULL DEFAULT 1,
  selected TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY cart_user_product_unique (user_id, product_id),
  CONSTRAINT cart_items_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Lightweight storefront analytics. An order_request is recorded when a customer
-- confirms opening Instagram or Facebook with their order message.
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type ENUM('product_view', 'order_request') NOT NULL,
  product_id VARCHAR(120) NOT NULL,
  product_name VARCHAR(160) NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  order_id CHAR(36) NULL,
  platform ENUM('facebook', 'instagram') NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY analytics_events_created_at (created_at),
  KEY analytics_events_type_created (event_type, created_at),
  KEY analytics_events_product_created (product_id, created_at)
) ENGINE=InnoDB;

-- Rate-limit public analytics writes by signed-in account and client IP.
-- IP bucket keys are one-way hashes; account buckets use the account ID.
CREATE TABLE IF NOT EXISTS analytics_rate_limits (
  bucket_key CHAR(67) NOT NULL,
  window_started_at DATETIME NOT NULL,
  request_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket_key),
  KEY analytics_rate_limits_window (window_started_at)
) ENGINE=InnoDB;
