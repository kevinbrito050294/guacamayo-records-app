-- =============================================================================
-- 2026-09-27_cupones.sql
-- Migracion de cupones de descuento - Guacamayo Records
-- Motor: MySQL 8.0+ (Railway) / InnoDB / utf8mb4
-- -----------------------------------------------------------------------------
-- QUE HACE
--   Crea la tabla `cupones` (codigos de descuento del carrito).
--   No altera ninguna tabla existente.
--
-- IDEMPOTENCIA
--   - El CREATE TABLE usa IF NOT EXISTS, asi que se puede correr el archivo N
--     veces sin duplicar la tabla ni sus indices.
--   - Los indices van DENTRO del CREATE TABLE: si la tabla ya existe, MySQL no
--     los vuelve a crear. Por eso el archivo no necesita guards
--     information_schema + PREPARE/EXECUTE, que si hacen falta para ALTER
--     (ver "2026-09-26_auth.sql": MySQL 8.0 no tiene "ADD COLUMN IF NOT EXISTS",
--     eso es una extension de MariaDB).
--   - Si la tabla quedo creada a medias en una corrida anterior, lo que hay que
--     hacer es borrarla a mano y volver a correr este archivo entero.
--
-- COMO CORRERLO
--   mysql -h HOST -P PUERTO -u USER -p railway < 2026-09-27_cupones.sql
--   (Railway: usar el shell del servicio MySQL o el editor de queries)
--   IMPORTANTE: la sesion debe tener seleccionada la base, porque no hay
--   ningun guard que use DATABASE(). Este archivo no depende del nombre de la
--   base, se puede correr en cualquiera.
--
-- SIN DATOS DE EJEMPLO: este archivo no inserta nada. Los cupones se crean
-- desde el panel (POST /api/admin/cupones).
-- =============================================================================


-- =============================================================================
-- 1) cupones
--    - codigo VARCHAR(50) UNIQUE: es la clave de negocio (el cliente lo
--      escribe a mano). El backend lo normaliza a MAYUSCULAS y sin espacios
--      antes de guardarlo, y las consultas comparan con UPPER() para que el
--      matching sea insensible a mayusculas.
--    - tipo ENUM('porcentaje','fijo'): porcentaje descuenta valor% del
--      subtotal (0-100), fijo descuenta valor USD. El ENUM hace que un tipo
--      inventado ni siquiera entre a la base.
--    - valor DECIMAL(10,2): si tipo = 'porcentaje' va de 0 a 100; si es
--      'fijo' es un monto en USD (la app guarda los precios en USD y convierte
--      a la divisa de pantalla).
--    - fecha_expiracion DATE NULL: NULL = no vence. Vencido cuando
--      fecha_expiracion < CURDATE() (validado en el servidor, no en el cliente).
--    - activo TINYINT(1): apagado = el panel lo muestra pero el carrito lo
--      rechaza. Es la baja logica; borrar el cupon es DELETE.
--    - uso_maximo INT NULL: NULL = ilimitado. Agotado cuando
--      uso_maximo IS NOT NULL AND usos_actuales >= uso_maximo.
--    - usos_actuales: lo incrementa POST /api/pedidos DENTRO de la
--      transaccion, en el mismo SELECT ... FOR UPDATE que valida el cupon, para
--      que dos pedidos concurrentes no puedan gastarse el mismo uso.
--      Si despues el pedido falla, el rollback tambien deshace el incremento.
--    - indice compuesto (activo, fecha_expiracion): es el acceso caliente del
--      POST /api/pedidos (filtrar los vivos) y del listado del panel.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `cupones` (
  `id`                 INT           NOT NULL AUTO_INCREMENT,
  `codigo`             VARCHAR(50)   NOT NULL,
  `tipo`               ENUM('porcentaje','fijo') NOT NULL DEFAULT 'porcentaje',
  `valor`              DECIMAL(10,2) NOT NULL,
  `fecha_expiracion`   DATE          NULL DEFAULT NULL,
  `activo`             TINYINT(1)    NOT NULL DEFAULT 1,
  `uso_maximo`         INT           NULL DEFAULT NULL,
  `usos_actuales`      INT           NOT NULL DEFAULT 0,
  `creado_en`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cupones_codigo` (`codigo`),
  KEY `idx_cupones_activo_fecha` (`activo`, `fecha_expiracion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Cupones de descuento del carrito';


-- =============================================================================
-- VERIFICACION (opcional, descomentar)
-- =============================================================================
-- SHOW CREATE TABLE `cupones`;
-- SELECT `id`, `codigo`, `tipo`, `valor`, `fecha_expiracion`, `activo`,
--        `uso_maximo`, `usos_actuales`
--   FROM `cupones` ORDER BY `id` DESC;


-- =============================================================================
-- ORDEN DE EJECUCION
--   2026-09-26_auth.sql  (después: si los pedidos van a guardar el cupón usado)
--   2026-09-27_cupones.sql (este archivo)
--   No depende de la migracion de auth ni al reves: `cupones` es autonoma.
--
-- NOTAS Y DECISIONES
--   - Sin COLLATE explicito: se hereda el default de la base (mismo criterio que
--     2026-09-26_auth.sql) para no generar "Illegal mix of collations" al hacer
--     JOIN contra inventario_vinilos / pedidos.
--   - No hay FK desde pedidos hacia cupones a proposito: el cupon se puede
--     borrar desde el panel sin romper el historial de pedidos ya cobrados.
--     Si mas adelante se quiere saber que cupon se uso en cada pedido, lo
--     correcto es agregar `cupon_id INT NULL` a `pedidos` (con el mismo guard
--     information_schema + PREPARE/EXECUTE de la migracion de auth) y dejar que
--     el ON DELETE SET NULL lo desvincula.
--   - usos_actuales NO tiene trigger ni FK que lo proteja: lo incrementa
--     exclusivamente el backend, ya que el descuento se aplica y se descuenta
--     el uso en la misma transaccion del pedido (ver server.js seccion 3).
--   - Si se carga la tabla a mano, respetar el formato: codigo en MAYUSCULAS,
--     sin espacios, valor > 0 y <= 100 cuando tipo = 'porcentaje'.
--   - Si algo falla a mitad de camino, no hace falta volver atras: se puede
--     corregir y volver a correr el archivo completo.
-- =============================================================================
