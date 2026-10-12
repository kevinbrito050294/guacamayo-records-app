-- =============================================================================
-- 2026-10-07_configuracion_divisas_unicas.sql
-- Normaliza configuracion_divisas a una fila por tipo antes del modo Binance.
-- =============================================================================

-- Conserva la fila mas antigua de cada tipo y elimina duplicados historicos.
DELETE duplicada
  FROM `configuracion_divisas` AS duplicada
  JOIN `configuracion_divisas` AS original
    ON original.`tipo` = duplicada.`tipo`
   AND original.`id` < duplicada.`id`;

-- Evita que futuras cargas/importaciones vuelvan a crear dos tasas del mismo tipo.
SET @existe_indice := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'configuracion_divisas'
    AND INDEX_NAME = 'uq_configuracion_divisas_tipo'
);
SET @sql := IF(@existe_indice = 0,
  'ALTER TABLE `configuracion_divisas` ADD UNIQUE KEY `uq_configuracion_divisas_tipo` (`tipo`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
