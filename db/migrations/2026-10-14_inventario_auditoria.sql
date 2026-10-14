-- Trazabilidad de altas y modificaciones del inventario.
-- Se guarda un snapshot del responsable para que el historial no dependa de
-- cambios posteriores en admin_usuarios.

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `inventario_vinilos` ADD COLUMN `ultima_modificacion_en` DATETIME NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventario_vinilos'
    AND COLUMN_NAME = 'ultima_modificacion_en'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `inventario_vinilos` ADD COLUMN `ultima_modificacion_admin_id` INT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventario_vinilos'
    AND COLUMN_NAME = 'ultima_modificacion_admin_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `inventario_vinilos` ADD COLUMN `ultima_modificacion_admin_email` VARCHAR(191) NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventario_vinilos'
    AND COLUMN_NAME = 'ultima_modificacion_admin_email'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `inventario_vinilos` ADD COLUMN `ultima_modificacion_admin_nombre` VARCHAR(120) NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventario_vinilos'
    AND COLUMN_NAME = 'ultima_modificacion_admin_nombre'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
