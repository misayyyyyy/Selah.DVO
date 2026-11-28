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
  location VARCHAR(120) NULL,
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
  user_id BIGINT UNSIGNED NULL,
  event_type ENUM('product_view', 'add_to_cart', 'order_request') NOT NULL,
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
  KEY analytics_events_product_created (product_id, created_at),
  KEY analytics_events_user_created (user_id, created_at)
) ENGINE=InnoDB;

-- Idempotent upgrades for existing local databases.
SET @customer_location_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'location'
);
SET @customer_location_sql = IF(@customer_location_exists = 0,
  'ALTER TABLE users ADD COLUMN location VARCHAR(120) NULL AFTER sex', 'SELECT 1');
PREPARE customer_location_stmt FROM @customer_location_sql;
EXECUTE customer_location_stmt;
DEALLOCATE PREPARE customer_location_stmt;

SET @analytics_user_id_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'analytics_events' AND COLUMN_NAME = 'user_id'
);
SET @analytics_user_id_sql = IF(@analytics_user_id_exists = 0,
  'ALTER TABLE analytics_events ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER id', 'SELECT 1');
PREPARE analytics_user_id_stmt FROM @analytics_user_id_sql;
EXECUTE analytics_user_id_stmt;
DEALLOCATE PREPARE analytics_user_id_stmt;

SET @analytics_user_index_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'analytics_events' AND INDEX_NAME = 'analytics_events_user_created'
);
SET @analytics_user_index_sql = IF(@analytics_user_index_exists = 0,
  'ALTER TABLE analytics_events ADD KEY analytics_events_user_created (user_id, created_at)', 'SELECT 1');
PREPARE analytics_user_index_stmt FROM @analytics_user_index_sql;
EXECUTE analytics_user_index_stmt;
DEALLOCATE PREPARE analytics_user_index_stmt;

-- Upgrade databases created before add-to-cart tracking was added.
ALTER TABLE analytics_events
  MODIFY event_type ENUM('product_view', 'add_to_cart', 'order_request') NOT NULL;

-- Rate-limit public analytics writes by signed-in account and client IP.
-- IP bucket keys are one-way hashes; account buckets use the account ID.
CREATE TABLE IF NOT EXISTS analytics_rate_limits (
  bucket_key CHAR(67) NOT NULL,
  window_started_at DATETIME NOT NULL,
  request_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket_key),
  KEY analytics_rate_limits_window (window_started_at)
) ENGINE=InnoDB;

-- Short-lived customer session heartbeats used for the dashboard's online count.
-- The presence key is a hash of a random per-session token, never a PHP session ID.
CREATE TABLE IF NOT EXISTS customer_presence (
  presence_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (presence_key),
  KEY customer_presence_seen_user (last_seen_at, user_id),
  CONSTRAINT customer_presence_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
