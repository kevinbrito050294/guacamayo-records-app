-- =============================================================================
-- 2026-10-07_recuperacion_password.sql
-- Tokens de recuperacion de password para usuarios clientes.
-- Motor: MySQL 8.0+ / InnoDB / utf8mb4
-- =============================================================================
--
-- `token_hash` recibe el SHA-256 hexadecimal del token enviado al usuario; el
-- token en claro nunca se persiste. `usado_en` conserva el historial y permite
-- invalidar tokens anteriores sin borrar sus filas.
--
-- Para consumir un token de forma unica, la aplicacion debe actualizar
-- `usado_en` condicionando por `usado_en IS NULL` y `expira_en > NOW()` dentro
-- de una operacion atomica. Para invalidar los anteriores de un usuario:
--   UPDATE `recuperacion_password`
--      SET `usado_en` = CURRENT_TIMESTAMP
--    WHERE `usuario_id` = ? AND `usado_en` IS NULL;
--
-- La migracion es segura al repetirse: CREATE TABLE IF NOT EXISTS no duplica
-- la tabla, indices ni foreign key. El nombre ordena este archivo despues de
-- 2026-09-26_auth.sql, que crea `usuarios`.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `recuperacion_password` (
  `id`          INT      NOT NULL AUTO_INCREMENT,
  `usuario_id`  INT      NOT NULL,
  `token_hash`  CHAR(64) NOT NULL,
  `expira_en`   DATETIME NOT NULL,
  `usado_en`    DATETIME NULL DEFAULT NULL,
  `creado_en`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_recuperacion_password_token_hash` (`token_hash`),
  KEY `idx_recuperacion_password_usuario_expira` (`usuario_id`, `expira_en`),
  KEY `idx_recuperacion_password_usuario_estado` (`usuario_id`, `usado_en`, `expira_en`),
  CONSTRAINT `fk_recuperacion_password_usuario` FOREIGN KEY (`usuario_id`)
    REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Tokens de recuperacion de password (solo hashes)';
