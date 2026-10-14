-- =============================================================================
-- 2026-09-30_pedidos_direccion.sql
-- Dirección seleccionada y snapshot histórico en `pedidos`.
-- Compatible con MySQL 8 / MariaDB y con scripts/migrar.mjs.
-- =============================================================================

-- Permite aplicar esta migración de forma aislada en una base nueva. En el flujo
-- normal la tabla ya existe y este CREATE es un no-op.
CREATE TABLE IF NOT EXISTS `pedidos` (
  `id_pedido` INT NOT NULL AUTO_INCREMENT,
  `numero_orden` VARCHAR(20) NOT NULL,
  `nombre_cliente` VARCHAR(120) NULL DEFAULT NULL,
  `whatsapp_cliente` VARCHAR(32) NULL DEFAULT NULL,
  `total_pago` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `divisa_preferida` VARCHAR(10) NULL DEFAULT NULL,
  `estado` VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `items` LONGTEXT NULL DEFAULT NULL,
  `usuario_id` INT NULL DEFAULT NULL,
  `cupon_id` INT NULL DEFAULT NULL,
  `cupon_codigo` VARCHAR(50) NULL DEFAULT NULL,
  `descuento_aplicado` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `direccion_id` INT NULL DEFAULT NULL,
  `direccion_apodo` VARCHAR(60) NULL DEFAULT NULL,
  `direccion` VARCHAR(255) NULL DEFAULT NULL,
  `direccion_ciudad` VARCHAR(120) NULL DEFAULT NULL,
  `direccion_provincia` VARCHAR(120) NULL DEFAULT NULL,
  `direccion_codigo_postal` VARCHAR(20) NULL DEFAULT NULL,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `version` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_pedido`),
  UNIQUE KEY `uq_pedidos_numero_orden` (`numero_orden`),
  KEY `idx_pedidos_usuario_id` (`usuario_id`),
  KEY `idx_pedidos_fecha` (`fecha`),
  KEY `idx_pedidos_cupon_id` (`cupon_id`),
  KEY `idx_pedidos_direccion_id` (`direccion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- MySQL 8 no soporta ADD COLUMN IF NOT EXISTS; cada columna tiene su propio
-- guard para que una corrida parcial pueda continuar sin duplicar cambios.
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD COLUMN `direccion_id` INT NULL DEFAULT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
    AND COLUMN_NAME = 'direccion_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD COLUMN `direccion_apodo` VARCHAR(60) NULL DEFAULT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
    AND COLUMN_NAME = 'direccion_apodo'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD COLUMN `direccion` VARCHAR(255) NULL DEFAULT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
    AND COLUMN_NAME = 'direccion'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD COLUMN `direccion_ciudad` VARCHAR(120) NULL DEFAULT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
    AND COLUMN_NAME = 'direccion_ciudad'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD COLUMN `direccion_provincia` VARCHAR(120) NULL DEFAULT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
    AND COLUMN_NAME = 'direccion_provincia'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD COLUMN `direccion_codigo_postal` VARCHAR(20) NULL DEFAULT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
    AND COLUMN_NAME = 'direccion_codigo_postal'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- El índice es útil para trazabilidad, pero no es requisito para la foto. Se
-- agrega solo si la tabla existente todavía no lo tiene.
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD INDEX `idx_pedidos_direccion_id` (`direccion_id`)',
    'DO 0')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
    AND INDEX_NAME = 'idx_pedidos_direccion_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- La FK no es necesaria para reconstruir el snapshot y se omite si `direcciones`
-- aún no existe. SET NULL permite borrar una dirección sin alterar pedidos.
SET @sql := (
  SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'direcciones'
              AND COLUMN_NAME = 'id' AND DATA_TYPE = 'int')
    AND EXISTS (SELECT 1 FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'direcciones'
                  AND ENGINE = 'InnoDB')
    AND EXISTS (SELECT 1 FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
                  AND ENGINE = 'InnoDB')
    AND NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
                      AND CONSTRAINT_NAME = 'fk_pedidos_direccion'
                      AND CONSTRAINT_TYPE = 'FOREIGN KEY'),
    'ALTER TABLE `pedidos` ADD CONSTRAINT `fk_pedidos_direccion` FOREIGN KEY (`direccion_id`) REFERENCES `direcciones` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    'DO 0')
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
