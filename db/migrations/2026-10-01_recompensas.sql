-- =============================================================================
-- 2026-10-01_recompensas.sql
-- Base de recompensas (Plumas) para Plan Usuario 1.
-- Motor: MySQL 8.0+ / MySQL 9.7 / InnoDB / utf8mb4
-- =============================================================================
--
-- Las unidades son enteras: 100 Plumas equivalen a USD 1,00. El saldo de
-- `recompensas_cuentas` es una proyeccion para lecturas rapidas; el ledger es
-- la fuente auditable y solo debe recibir INSERT. `referencia_id` hace que una
-- acreditacion, consumo, ajuste o reversion sea idempotente.
--
-- No se agregan FKs a usuarios/pedidos: las bases historicas pueden haber sido
-- creadas con esos objetos en distinto orden, pero los nombres y tipos usados
-- aqui coinciden con las migraciones vigentes (`usuarios.id INT` y
-- `pedidos.id_pedido INT`).
--
-- Los ALTER usan guards de information_schema porque MySQL no soporta
-- ADD COLUMN IF NOT EXISTS. `DO 0` mantiene el archivo ejecutable con
-- multipleStatements=true, como lo requiere scripts/migrar.mjs.
-- =============================================================================

-- =============================================================================
-- 1) Una cuenta por usuario
-- =============================================================================
CREATE TABLE IF NOT EXISTS `recompensas_cuentas` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `usuario_id`  INT          NOT NULL,
  `saldo`       INT          NOT NULL DEFAULT 0,
  `creado_en`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_recompensas_cuentas_usuario` (`usuario_id`),
  KEY `idx_recompensas_cuentas_saldo` (`saldo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Saldo proyectado de recompensas por usuario';

-- =============================================================================
-- 2) Ledger append-only. No contiene columnas de actualizacion: los ajustes
--    posteriores se representan como nuevos movimientos, nunca sobrescribiendo
--    el movimiento original.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `recompensas_ledger` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT,
  `usuario_id`     INT          NOT NULL,
  `tipo`           VARCHAR(30)  NOT NULL,
  `unidades`       INT          NOT NULL,
  `referencia_id`  VARCHAR(191) NOT NULL,
  `referencia_tipo` VARCHAR(40) NULL DEFAULT NULL,
  `pedido_id`      INT          NULL DEFAULT NULL,
  `expira_en`      DATETIME     NULL DEFAULT NULL,
  `creado_en`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_recompensas_ledger_referencia` (`referencia_id`),
  KEY `idx_recompensas_ledger_usuario_fecha` (`usuario_id`, `creado_en`, `id`),
  KEY `idx_recompensas_ledger_pedido` (`pedido_id`),
  KEY `idx_recompensas_ledger_fifo` (`usuario_id`, `tipo`, `expira_en`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Ledger inmutable de movimientos de recompensas';

-- =============================================================================
-- 3) Asignaciones FIFO: cada fila indica cuanto de un lote ganado se aplico a
--    un consumo. La reversion se acumula en la misma fila y nunca cambia la
--    historia del ledger. El UNIQUE evita duplicar una asignacion al reintentar.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `recompensas_consumos` (
  `id`                    BIGINT NOT NULL AUTO_INCREMENT,
  `usuario_id`            INT    NOT NULL,
  `consumo_ledger_id`     BIGINT NOT NULL,
  `origen_ledger_id`      BIGINT NOT NULL,
  `unidades`              INT    NOT NULL,
  `unidades_reversionadas` INT   NOT NULL DEFAULT 0,
  `creado_en`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_recompensas_consumos_asignacion` (`consumo_ledger_id`, `origen_ledger_id`),
  KEY `idx_recompensas_consumos_fifo` (`usuario_id`, `origen_ledger_id`, `id`),
  KEY `idx_recompensas_consumos_consumo` (`consumo_ledger_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Asignaciones FIFO de consumos de recompensas';

-- =============================================================================
-- 4) Snapshot de recompensas en pedidos. Se omite el ALTER si pedidos aun no
--    existe, permitiendo que el archivo sea ejecutado de forma aislada.
-- =============================================================================
SET @sql := (
  SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos')
    AND NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
                      AND COLUMN_NAME = 'recompensas_ganadas'),
    'ALTER TABLE `pedidos` ADD COLUMN `recompensas_ganadas` INT NOT NULL DEFAULT 0',
    'DO 0')
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos')
    AND NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
                      AND COLUMN_NAME = 'recompensas_usadas'),
    'ALTER TABLE `pedidos` ADD COLUMN `recompensas_usadas` INT NOT NULL DEFAULT 0',
    'DO 0')
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos')
    AND NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
                      AND COLUMN_NAME = 'descuento_recompensas_usd'),
    'ALTER TABLE `pedidos` ADD COLUMN `descuento_recompensas_usd` DECIMAL(12,2) NOT NULL DEFAULT 0',
    'DO 0')
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos')
    AND NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
                      AND COLUMN_NAME = 'recompensas_reversionadas'),
    'ALTER TABLE `pedidos` ADD COLUMN `recompensas_reversionadas` INT NOT NULL DEFAULT 0',
    'DO 0')
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
