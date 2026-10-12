-- =============================================================================
-- 2026-10-06_configuracion_divisas_binance.sql
-- Modo manual/Binance y estado de sincronizacion de `configuracion_divisas`.
-- Motor: MySQL 8.0+ / MariaDB / InnoDB
-- =============================================================================
--
-- La tabla historica conserva `tipo` (ENUM('DOLAR_BLUE','USDT')) y `tasa`
-- (DECIMAL). No se modifican esos tipos: una sincronizacion Binance puede
-- escribir el mismo valor USDTARS en ambas filas y marcar la fuente como
-- `Binance` sin alterar el contrato historico.
--
-- IDEMPOTENCIA
--   Cada columna tiene su propio guard de information_schema porque MySQL 8 no
--   soporta ADD COLUMN IF NOT EXISTS. Si la tabla todavia no existe, cada guard
--   queda en no-op y una base posterior puede completar la migracion sin romper.
--
-- VALORES INICIALES
--   Las filas existentes quedan en modo manual. `fuente` queda NULL para no
--   atribuir a Binance una tasa que no fue sincronizada por ese origen.
-- =============================================================================

-- 1) Modo de actualizacion: manual o binance.
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `configuracion_divisas` ADD COLUMN `modo` VARCHAR(20) NOT NULL DEFAULT ''manual''',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'configuracion_divisas'
    AND COLUMN_NAME = 'modo'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Fuente efectiva de la ultima tasa (por ejemplo, Binance).
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `configuracion_divisas` ADD COLUMN `fuente` VARCHAR(50) NULL DEFAULT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'configuracion_divisas'
    AND COLUMN_NAME = 'fuente'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Momento de la ultima sincronizacion automatica exitosa.
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `configuracion_divisas` ADD COLUMN `ultima_sincronizacion` DATETIME NULL DEFAULT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'configuracion_divisas'
    AND COLUMN_NAME = 'ultima_sincronizacion'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) Ultimo error de sincronizacion, sin bloquear la tasa vigente.
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `configuracion_divisas` ADD COLUMN `error_sincronizacion` VARCHAR(500) NULL DEFAULT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'configuracion_divisas'
    AND COLUMN_NAME = 'error_sincronizacion'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5) Estado operativo visible para el panel y marca de slot procesado.
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `configuracion_divisas` ADD COLUMN `estado` VARCHAR(20) NOT NULL DEFAULT ''activo''',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'configuracion_divisas'
    AND COLUMN_NAME = 'estado'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `configuracion_divisas` ADD COLUMN `sync_slot` VARCHAR(32) NULL DEFAULT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'configuracion_divisas'
    AND COLUMN_NAME = 'sync_slot'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- No se agrega simbolo_binance: el flujo requerido usa siempre el simbolo
-- publico USDTARS y no necesita persistir una configuracion por fila.
-- Tampoco se agregan indices: estas columnas describen dos filas de
-- configuracion y no participan en busquedas masivas.
