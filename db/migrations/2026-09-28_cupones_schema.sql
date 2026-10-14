-- =============================================================================
-- 2026-09-28_cupones_schema.sql
-- Correccion del schema de `cupones` - Guacamayo Records
-- Motor: MySQL 8.0+ (Railway) / InnoDB / utf8mb4
-- -----------------------------------------------------------------------------
-- POR QUE HACE FALTA
--   2026-09-27_cupones.sql decia "CREATE TABLE IF NOT EXISTS". Resultado: en la
--   base de PRODUCCION la tabla `cupones` ya existia desde marzo (creada a mano,
--   con otro schema), asi que el CREATE fue un no-op y la migracion quedo
--   registrada como aplicada igual. En la base de desarrollo, en cambio, la crea
--   desde cero. O sea: la tabla nunca quedo como dice 2026-09-27_cupones.sql.
--
--   Diferencias que arregla este archivo (medidas en produccion):
--     1. `activo`        era NULLABLE  ->  ahora NOT NULL DEFAULT 1
--     2. `usos_actuales` era NULLABLE  ->  ahora NOT NULL DEFAULT 0
--     3. `creado_en`      no existia    ->  se agrega
--     4. `idx_cupones_activo_fecha` (activo, fecha_expiracion) no existia
--     5. `fecha_expiracion` era DATETIME ->  pasa a DATE
--
-- POR QUE 1 y 2 SON UN RIESGO REAL (no cosmetico)
--   server.js POST /api/pedidos hace, dentro de la transaccion del pedido:
--       UPDATE `cupones` SET `usos_actuales` = `usos_actuales` + 1 WHERE id = ?
--   Con la columna nullable, un NULL en esa fila hace que NULL + 1 = NULL: el
--   contador queda clavado para siempre y el cupon NUNCA se agota (la validacion
--   compara usos_actuales >= uso_maximo). Antes de este archivo, un NULL anyone's
--   turning into un cupon sin limite de usos, en silencio. El backfill de abajo
--   deja 0 en los NULL que ya hubiera.
--
-- IDEMPOTENCIA
--   - Los UPDATE de backfill son idempotentes por definicion.
--   - Cada ALTER va con guard de information_schema + PREPARE/EXECUTE (MySQL 8.0/9
--     no tiene "ADD COLUMN IF NOT EXISTS": eso es una extension de MariaDB).
--   - Se puede correr este archivo las veces que haga falta.
--
-- COMO CORRERLO
--   npm run migrar
--   (o: mysql -h HOST -P PUERTO -u USER -p railway < 2026-09-28_cupones_schema.sql)
--   IMPORTANTE: la sesion debe tener seleccionada la base (los guards usan
--   DATABASE()). No depende del nombre de la base.
--
-- ORDEN: despues de 2026-09-26_auth.sql y 2026-09-27_cupones.sql.
-- =============================================================================


-- =============================================================================
-- 0) Backfill: que no queden NULLs sueltos antes de poner los NOT NULL.
--    (orden importante: el MODIFY de la seccion 2 exige que no haya NULLs)
-- =============================================================================
UPDATE `cupones` SET `activo` = 1 WHERE `activo` IS NULL;
UPDATE `cupones` SET `usos_actuales` = 0 WHERE `usos_actuales` IS NULL;
-- La tabla tendria que existir: si no, esto ya fallo antes.
-- (No se agrega un CREATE TABLE IF NOT EXISTS a proposito: si la tabla no esta,
--  este archivo no debe "inventarla" con el schema viejo.)


-- =============================================================================
-- 1) cupones.activo -> TINYINT(1) NOT NULL DEFAULT 1
-- =============================================================================
SET @sql := (
  SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME   = 'cupones'
               AND COLUMN_NAME  = 'activo'
               AND IS_NULLABLE  = 'YES'),
    'ALTER TABLE `cupones` MODIFY COLUMN `activo` TINYINT(1) NOT NULL DEFAULT 1',
    'DO 0')
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- =============================================================================
-- 2) cupones.usos_actuales -> INT NOT NULL DEFAULT 0
-- =============================================================================
SET @sql := (
  SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME   = 'cupones'
               AND COLUMN_NAME  = 'usos_actuales'
               AND IS_NULLABLE  = 'YES'),
    'ALTER TABLE `cupones` MODIFY COLUMN `usos_actuales` INT NOT NULL DEFAULT 0',
    'DO 0')
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- =============================================================================
-- 3) cupones.creado_en (la que faltaba; la usa el listado del panel)
-- =============================================================================
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `cupones` ADD COLUMN `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'cupones'
    AND COLUMN_NAME  = 'creado_en'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- =============================================================================
-- 4) indice (activo, fecha_expiracion): el acceso caliente del listado del panel
--    (ordena por activo y por vencimiento) y de la busqueda de cupones vivos.
-- =============================================================================
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `cupones` ADD INDEX `idx_cupones_activo_fecha` (`activo`, `fecha_expiracion`)',
    'DO 0')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'cupones'
    AND INDEX_NAME   = 'idx_cupones_activo_fecha'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- =============================================================================
-- 5) fecha_expiracion DATETIME -> DATE
--    En la base real era DATETIME (siempre con hora 00:00:00). El codigo la
--    compara contra CURDATE() y la formatea con DATE_FORMAT a YYYY-MM-DD, asi
--    que la hora sobrante noSERVia para nada. El MODIFY trunca la parte de hora:
--    si algun dia se cargo una con hora real, se pierde (hoy no hay ninguna: la
--    unica fila tiene 00:00:00).
-- =============================================================================
SET @sql := (
  SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME   = 'cupones'
               AND COLUMN_NAME  = 'fecha_expiracion'
               AND DATA_TYPE    = 'datetime'),
    'ALTER TABLE `cupones` MODIFY COLUMN `fecha_expiracion` DATE NULL DEFAULT NULL',
    'DO 0')
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- =============================================================================
-- VERIFICACION (opcional, descomentar)
-- =============================================================================
-- SHOW CREATE TABLE `cupones`;
-- SELECT `id`, `codigo`, `tipo`, `valor`, `fecha_expiracion`, `activo`,
--        `uso_maximo`, `usos_actuales`, `creado_en`
--   FROM `cupones` ORDER BY `id` DESC;


-- =============================================================================
-- NOTAS
--   - NO se renombra el indice unico que ya existia (`codigo`): el nombre no
--     importa, la unicidad si, y renombrar indices en produccion a mano es justo
--     el tipo de cosa que sale mal.
--   - NO se agregan FKs: `cupones` es autonoma y borrar un cupon desde el panel
--     tiene que poder seguir funcionando aunque se use en pedidos viejos.
--   - La busqueda del carrito sigue usando UPPER(`codigo`) = ? a proposito: no
--     depende de que la collation de la columna sea insensible a mayusculas
--     (funciona igual si alguien cambia la collation de la base).
-- =============================================================================
