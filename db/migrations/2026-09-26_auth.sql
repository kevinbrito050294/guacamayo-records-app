-- =============================================================================
-- 2026-09-26_auth.sql
-- Migracion de autenticacion y cuentas de usuario - Guacamayo Records
-- Motor: MySQL 8.0+ (Railway) / InnoDB / utf8mb4
-- -----------------------------------------------------------------------------
-- QUE HACE
--   1. Crea admin_usuarios      (backoffice, acceso con email + password)
--   2. Crea usuarios            (clientes; email o Google)
--   3. Crea sesiones            (tokens: solo SHA-256 del token, nunca en claro)
--   4. Crea direcciones         (envios del cliente)
--   5. Crea favoritos           (wishlist por vinilo)
--   6. Altera pedidos           (usuario_id, actualizado_en, version)
--   7. Altera inventario_vinilos(version)
--   8. Crea auditoria           (bitacora de acciones de admin)
--
-- IDEMPOTENCIA
--   - Todo CREATE TABLE usa IF NOT EXISTS.
--   - Todo ALTER va envuelto en un guard de information_schema + PREPARE/EXECUTE,
--     porque MySQL 8.0 NO soporta "ADD COLUMN IF NOT EXISTS" (eso es MariaDB).
--   - Se puede correr el archivo N veces sin romper nada ni duplicar objetos.
--
-- COMO CORRERLO
--   mysql -h HOST -P PUERTO -u USER -p railway < 2026-09-26_auth.sql
--   (Railway: usar el shell del servicio MySQL o el editor de queries)
--   IMPORTANTE: la sesion debe tener seleccionada la base "railway", porque los
--   guards consultan information_schema con DATABASE().
--   Si tu base no se llama exactamente "railway", descomentar y ajustar:
--     USE `railway`;
--
-- SIN DATOS DE EJEMPLO: este archivo no inserta nada. Los usuarios y sus
-- password_hash se cargan aparte.
-- =============================================================================


-- =============================================================================
-- 1) admin_usuarios  (backoffice)
--    email VARCHAR(191) + UNIQUE: 191 * 4 bytes = 764 <= limite de indice,
--    seguro incluso con el formato de fila antiguo.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `admin_usuarios` (
  `id`            INT          NOT NULL AUTO_INCREMENT,
  `email`         VARCHAR(191) NOT NULL,
  `nombre`        VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `rol`           VARCHAR(20)  NOT NULL DEFAULT 'admin',
  `activo`        TINYINT(1)   NOT NULL DEFAULT 1,
  `ultimo_acceso` DATETIME     NULL DEFAULT NULL,
  `creado_en`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admin_usuarios_email` (`email`),
  KEY `idx_admin_usuarios_activo` (`activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Usuarios del panel de administracion';


-- =============================================================================
-- 2) usuarios  (clientes)
--    - password_hash NULL + google_id NULL: login por email o por Google.
--    - UNIQUE sobre columnas NULLables permite N usuarios con google_id NULL
--      (MySQL no considera iguales los NULL en indices UNIQUE), y en la
--      practica UNIQUE tambien exige el valor si viene informado.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id`             INT          NOT NULL AUTO_INCREMENT,
  `email`          VARCHAR(191) NOT NULL,
  `nombre`         VARCHAR(120) NOT NULL,
  `telefono`       VARCHAR(32)  NULL DEFAULT NULL,
  `password_hash`  VARCHAR(255) NULL DEFAULT NULL,
  `google_id`      VARCHAR(191) NULL DEFAULT NULL,
  `avatar_url`     VARCHAR(500) NULL DEFAULT NULL,
  `activo`         TINYINT(1)   NOT NULL DEFAULT 1,
  `creado_en`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuarios_email` (`email`),
  UNIQUE KEY `uq_usuarios_google_id` (`google_id`),
  KEY `idx_usuarios_activo_creado` (`activo`, `creado_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Clientes de la tienda (login por email y/o Google)';


-- =============================================================================
-- 3) sesiones
--    - token_hash = SHA-256 en hex (64 chars). El token en claro NUNCA se guarda.
--    - tipo + FK: 'admin' -> admin_usuario_id, 'cliente' -> usuario_id.
--    - FK CASCADE: si se borra un usuario se borran sus sesiones.
--    - indice compuesto (tipo, expira_en) para listar y limpiar sesiones vencidas.
--    - ultima_actividad: lo actualiza el heartbeat del panel. El login la mira
--      para aplicar el bloqueo de sesion unica (otra pestana/dispositivo con
--      actividad en los ultimos 60 s -> 423, ver auth.js).
-- =============================================================================
CREATE TABLE IF NOT EXISTS `sesiones` (
  `id`              INT      NOT NULL AUTO_INCREMENT,
  `token_hash`      CHAR(64) NOT NULL,
  `tipo`            ENUM('admin','cliente') NOT NULL,
  `admin_usuario_id` INT     NULL DEFAULT NULL,
  `usuario_id`      INT      NULL DEFAULT NULL,
  `expira_en`       DATETIME NOT NULL,
  `ultima_actividad` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `creado_en`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip`              VARCHAR(45)  NULL DEFAULT NULL,
  `user_agent`      VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sesiones_token_hash` (`token_hash`),
  KEY `idx_sesiones_admin_usuario_id` (`admin_usuario_id`),
  KEY `idx_sesiones_usuario_id` (`usuario_id`),
  KEY `idx_sesiones_expira_en` (`expira_en`),
  KEY `idx_sesiones_tipo_expira` (`tipo`, `expira_en`),
  CONSTRAINT `fk_sesiones_admin_usuario` FOREIGN KEY (`admin_usuario_id`)
    REFERENCES `admin_usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sesiones_usuario` FOREIGN KEY (`usuario_id`)
    REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Tokens de sesion (solo hash SHA-256 del token)';


-- =============================================================================
-- 4) direcciones  (envios del cliente)
--    usuario_id CASCADE: al borrar la cuenta se van sus direcciones.
--    "es_default" se resuelve en la app (una sola por usuario); MySQL no tiene
--    indices unicos parciales para expressarlo en DDL.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `direcciones` (
  `id`            INT          NOT NULL AUTO_INCREMENT,
  `usuario_id`    INT          NOT NULL,
  `apodo`         VARCHAR(60)  NOT NULL,
  `direccion`     VARCHAR(255) NOT NULL,
  `ciudad`        VARCHAR(120) NULL DEFAULT NULL,
  `provincia`     VARCHAR(120) NULL DEFAULT NULL,
  `codigo_postal` VARCHAR(20)  NULL DEFAULT NULL,
  `es_default`    TINYINT(1)   NOT NULL DEFAULT 0,
  `creado_en`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_direcciones_usuario_id` (`usuario_id`),
  KEY `idx_direcciones_usuario_default` (`usuario_id`, `es_default`),
  CONSTRAINT `fk_direcciones_usuario` FOREIGN KEY (`usuario_id`)
    REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Direcciones de envio del cliente';


-- =============================================================================
-- 5) favoritos
--    UNIQUE(usuario_id, vinilo_id) = no duplicados; idx por vinilo_id para
--    consultar "cuantos favoritos tiene este vinilo" sin recorrer la tabla.
--    Sin FK a inventario_vinilos a proposito (ver notas al final).
-- =============================================================================
CREATE TABLE IF NOT EXISTS `favoritos` (
  `id`         INT     NOT NULL AUTO_INCREMENT,
  `usuario_id` INT     NOT NULL,
  `vinilo_id`  INT     NOT NULL,
  `creado_en`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_favoritos_usuario_vinilo` (`usuario_id`, `vinilo_id`),
  KEY `idx_favoritos_vinilo_id` (`vinilo_id`),
  CONSTRAINT `fk_favoritos_usuario` FOREIGN KEY (`usuario_id`)
    REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Wishlist de vinilos por cliente';


-- =============================================================================
-- 6) ALTER TABLE pedidos
--    usuario_id INT NULL + FK ON DELETE SET NULL: al borrar la cuenta el
--    pedido se conserva (es un historico comercial), solo se desvincula.
--    actualizado_en / version: timestamp automatico y control de concurrencia
--    optimista en la app (SELECT ... WHERE version = ?).
--
--    Patron idempotente: information_schema dice si la columna ya existe y, si
--    no, se ejecuta el ALTER via PREPARE. "DO 0" es el no-op.
-- =============================================================================

-- 6.1 pedidos.usuario_id
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD COLUMN `usuario_id` INT NULL DEFAULT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND EXISTS (SELECT 1 FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos')
    AND TABLE_NAME   = 'pedidos'
    AND COLUMN_NAME  = 'usuario_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6.2 pedidos.actualizado_en
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD COLUMN `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND EXISTS (SELECT 1 FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos')
    AND TABLE_NAME   = 'pedidos'
    AND COLUMN_NAME  = 'actualizado_en'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6.3 pedidos.version
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD COLUMN `version` INT NOT NULL DEFAULT 1',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND EXISTS (SELECT 1 FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos')
    AND TABLE_NAME   = 'pedidos'
    AND COLUMN_NAME  = 'version'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6.4 indice de pedidos.usuario_id (guard propio: la columna puede existir
--     y el indice no, si el archivo se corrio parcialmente antes)
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD INDEX `idx_pedidos_usuario_id` (`usuario_id`)',
    'DO 0')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND EXISTS (SELECT 1 FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos')
    AND TABLE_NAME   = 'pedidos'
    AND INDEX_NAME   = 'idx_pedidos_usuario_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6.5 FK pedidos.usuario_id -> usuarios.id
--     Solo se agrega si la columna existe (6.1) y la FK no esta todavia.
SET @sql := (
  SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME  = 'pedidos'
              AND COLUMN_NAME = 'usuario_id')
    AND NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                    WHERE CONSTRAINT_SCHEMA = DATABASE()
                      AND TABLE_NAME      = 'pedidos'
                      AND CONSTRAINT_NAME = 'fk_pedidos_usuario'
                      AND CONSTRAINT_TYPE = 'FOREIGN KEY'),
    'ALTER TABLE `pedidos` ADD CONSTRAINT `fk_pedidos_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    'DO 0')
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- =============================================================================
-- 7) ALTER TABLE inventario_vinilos
--    version INT NOT NULL DEFAULT 1: control de concurrencia optimista para
--    evitar que dos admins sobrescriban stock/precio a la vez.
--    (En tablas con datos, las filas existentes quedan en 1.)
-- =============================================================================
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `inventario_vinilos` ADD COLUMN `version` INT NOT NULL DEFAULT 1',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'inventario_vinilos'
    AND COLUMN_NAME  = 'version'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- =============================================================================
-- 8) auditoria
--    admin_usuario_id ON DELETE SET NULL: el registro de auditoria sobrevive
--    al borrado del admin; admin_email queda como copia historica.
--    entidad_id VARCHAR(64) porque la PK depende de la entidad
--    (id_pedido / id_detalle / id INT...).
-- =============================================================================
CREATE TABLE IF NOT EXISTS `auditoria` (
  `id`              INT          NOT NULL AUTO_INCREMENT,
  `admin_usuario_id` INT         NULL DEFAULT NULL,
  `admin_email`     VARCHAR(191) NULL DEFAULT NULL,
  `entidad`         VARCHAR(50)  NOT NULL,
  `entidad_id`      VARCHAR(64)  NULL DEFAULT NULL,
  `accion`          VARCHAR(50)  NOT NULL,
  `datos_antes`     JSON         NULL DEFAULT NULL,
  `datos_despues`   JSON         NULL DEFAULT NULL,
  `creado_en`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_auditoria_entidad` (`entidad`, `entidad_id`),
  KEY `idx_auditoria_creado_en` (`creado_en`),
  KEY `idx_auditoria_admin_usuario_id` (`admin_usuario_id`),
  CONSTRAINT `fk_auditoria_admin_usuario` FOREIGN KEY (`admin_usuario_id`)
    REFERENCES `admin_usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Bitacora de acciones del backoffice';


-- =============================================================================
-- VERIFICACION (opcional, descomentar)
-- =============================================================================
-- SELECT TABLE_NAME FROM information_schema.TABLES
--   WHERE TABLE_SCHEMA = DATABASE()
--     AND TABLE_NAME IN ('admin_usuarios','usuarios','sesiones','direcciones',
--                        'favoritos','auditoria');
-- SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
--   FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA = DATABASE()
--     AND ((TABLE_NAME = 'pedidos' AND COLUMN_NAME IN ('usuario_id','actualizado_en','version'))
--       OR (TABLE_NAME = 'inventario_vinilos' AND COLUMN_NAME = 'version'));
-- SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME, DELETE_RULE
--   FROM information_schema.REFERENTIAL_CONSTRAINTS
--   WHERE CONSTRAINT_SCHEMA = DATABASE();
-- SHOW INDEX FROM `sesiones`;
-- SHOW INDEX FROM `pedidos`;


-- =============================================================================
-- ORDEN DE EJECUCION
--   1) admin_usuarios          (sin dependencias)
--   2) usuarios                (sin dependencias)
--   3) sesiones                (depende de 1 y 2)
--   4) direcciones             (depende de 2)
--   5) favoritos               (depende de 2)
--   6) ALTER pedidos           (depende de 2 -> por eso va DESPUES de crear
--                               usuarios; si la FK se agrega antes, falla)
--   7) ALTER inventario_vinilos(independiente)
--   8) auditoria               (depende de 1)
--   El archivo ya viene en ese orden: correrlo entero de una vez.
--
-- NOTAS Y DECISIONES
--   - Why no "ADD COLUMN IF NOT EXISTS": no existe en MySQL 8.0 (1064); es una
--     extension de MariaDB. Por eso cada ALTER usa el guard
--     information_schema + PREPARE/EXECUTE, que si funciona en MySQL 8.0.x.
--     No hace falta DELIMITER ni Stored Procedure, asi que el archivo se puede
--     pegar y ejecutar statement por statement en cualquier cliente.
--   - Cada guard es independiente (columna / indice / FK por separado), asi una
--     corrida parcial se puede completar sin romper nada.
--   - Sin COLLATE explicito en los CREATE TABLE: se hereda el default de la
--     base, para no generar "Illegal mix of collations" al hacer JOIN con
--     inventario_vinilos / pedidos.
--   - ON UPDATE CASCADE en todas las FK: por si un id se realinea, no hay que
--     tocar la FK. En pedidos la regla de borrado es SET NULL a proposito.
--   - ENUM('admin','cliente') en sesiones.tipo: el backend deberia validar que
--     'admin' venga con admin_usuario_id y 'cliente' con usuario_id.
--   - token_hash CHAR(64) = SHA-256 en hexadecimal. El token en claro solo
--     existe en el cookie/response; si se filtra la BD no se pueden suplantar
--     sesiones. La app debe hashear con SHA-256 y comparar por el indice UNIQUE.
--   - Limpieza periodica sugerida:
--       DELETE FROM `sesiones` WHERE `expira_en` < NOW();
--   - "version" en pedidos e inventario: usarla para locking optimista
--     (UPDATE ... SET version = version + 1 WHERE id = ? AND version = ?).
--     Las filas preexistentes quedan en 1.
--   - favoritos.vinilo_id NO lleva FK a inventario_vinilos (asi pedido): evita
--     acoplar esta migracion y permite borrar un vinilo sin romper la wishlist.
--     Si mas adelante se quiere integridad, agregar la FK con ON DELETE CASCADE.
--   - No hay INSERTs en este archivo: los admins/clientes y sus hashes se cargan
--     por separado. Nunca guardar passwords en texto plano.
--   - Si algo falla a mitad de camino, no hace falta volver atras: se puede
--     corregir y volver a correr el archivo completo.
-- =============================================================================
