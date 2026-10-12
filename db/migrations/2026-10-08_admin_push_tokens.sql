-- Tokens FCM de los dispositivos autorizados del backoffice.
CREATE TABLE IF NOT EXISTS `admin_push_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_usuario_id` INT NOT NULL,
  `token` VARCHAR(512) NOT NULL,
  `plataforma` VARCHAR(20) NOT NULL DEFAULT 'android',
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `ultimo_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_push_token` (`token`),
  KEY `idx_admin_push_tokens_admin` (`admin_usuario_id`, `activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
