-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS iot_backend DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE iot_backend;

-- 操作日志表
CREATE TABLE `operation_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `method` VARCHAR(10) NOT NULL COMMENT 'HTTP方法 (GET, POST, PUT, DELETE等)',
    `path` VARCHAR(500) NOT NULL COMMENT '请求路径',
    `target_url` VARCHAR(1000) NOT NULL COMMENT '目标URL',
    `status_code` INT NOT NULL COMMENT 'HTTP状态码',
    `client_ip` VARCHAR(45) NULL COMMENT '客户端IP地址',
    `error_message` TEXT NULL COMMENT '错误信息',
    `request_body` TEXT NULL COMMENT '请求体内容（可选）',
    `response_body` TEXT NULL COMMENT '响应体内容（可选）',
    `request_headers` JSON NULL COMMENT '请求头信息',
    `response_time` INT NULL COMMENT '响应时间（毫秒）',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    INDEX `idx_method` (`method`),
    INDEX `idx_path` (`path`(100)),
    INDEX `idx_status_code` (`status_code`),
    INDEX `idx_client_ip` (`client_ip`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_method_path` (`method`, `path`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='API代理操作日志表';

-- token管理表（可选，用于持久化token信息）
CREATE TABLE `token_cache` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `token_key` VARCHAR(50) NOT NULL COMMENT 'token标识键',
    `access_token` TEXT NOT NULL COMMENT '访问令牌',
    `refresh_token` TEXT NULL COMMENT '刷新令牌',
    `expires_at` TIMESTAMP NOT NULL COMMENT '过期时间',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_token_key` (`token_key`),
    INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Token缓存表';

-- API统计表（用于监控和分析）
CREATE TABLE `api_statistics` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `date` DATE NOT NULL COMMENT '统计日期',
    `path` VARCHAR(500) NOT NULL COMMENT 'API路径',
    `method` VARCHAR(10) NOT NULL COMMENT 'HTTP方法',
    `total_requests` INT UNSIGNED DEFAULT 0 COMMENT '总请求数',
    `success_requests` INT UNSIGNED DEFAULT 0 COMMENT '成功请求数',
    `error_requests` INT UNSIGNED DEFAULT 0 COMMENT '错误请求数',
    `avg_response_time` DECIMAL(8,2) DEFAULT 0.00 COMMENT '平均响应时间（毫秒）',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_date_path_method` (`date`, `path`(100), `method`),
    INDEX `idx_date` (`date`),
    INDEX `idx_path` (`path`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='API统计表';

-- 系统配置表
CREATE TABLE `system_config` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `config_key` VARCHAR(100) NOT NULL COMMENT '配置键',
    `config_value` TEXT NOT NULL COMMENT '配置值',
    `config_type` ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string' COMMENT '配置类型',
    `description` VARCHAR(500) NULL COMMENT '配置描述',
    `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_config_key` (`config_key`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- 插入一些默认配置
INSERT INTO `system_config` (`config_key`, `config_value`, `config_type`, `description`) VALUES
('token_cache_enabled', 'true', 'boolean', '是否启用token持久化缓存'),
('max_retry_count', '2', 'number', 'API请求最大重试次数'),
('request_timeout', '20', 'number', 'HTTP请求超时时间（秒）'),
('log_request_body', 'false', 'boolean', '是否记录请求体到日志'),
('log_response_body', 'false', 'boolean', '是否记录响应体到日志');

-- 创建用于清理旧日志的存储过程
DELIMITER //
CREATE PROCEDURE CleanOldLogs(IN days_to_keep INT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION 
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- 删除超过指定天数的操作日志
    DELETE FROM operation_logs 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL days_to_keep DAY);
    
    -- 删除超过指定天数的统计数据（保留更长时间，比如1年）
    DELETE FROM api_statistics 
    WHERE date < DATE_SUB(CURDATE(), INTERVAL 365 DAY);
    
    COMMIT;
    
    SELECT CONCAT('Cleaned logs older than ', days_to_keep, ' days') as result;
END //
DELIMITER ;

-- 创建视图：今日API调用统计
CREATE VIEW `today_api_stats` AS
SELECT 
    path,
    method,
    COUNT(*) as total_requests,
    SUM(CASE WHEN status_code < 400 THEN 1 ELSE 0 END) as success_requests,
    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_requests,
    ROUND(AVG(response_time), 2) as avg_response_time,
    MIN(created_at) as first_request,
    MAX(created_at) as last_request
FROM operation_logs 
WHERE DATE(created_at) = CURDATE()
GROUP BY path, method
ORDER BY total_requests DESC;

-- 创建视图：错误日志汇总
CREATE VIEW `error_logs_summary` AS
SELECT 
    path,
    method,
    status_code,
    error_message,
    COUNT(*) as error_count,
    MAX(created_at) as last_error_time
FROM operation_logs 
WHERE status_code >= 400 OR error_message IS NOT NULL
GROUP BY path, method, status_code, error_message
ORDER BY error_count DESC, last_error_time DESC;