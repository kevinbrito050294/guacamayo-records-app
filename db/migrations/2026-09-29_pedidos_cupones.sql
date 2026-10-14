-- =============================================================================
-- 2026-09-29_pedidos_cupones.sql
-- Tabla `pedidos` reproducible + las 3 columnas del cupón - Guacamayo Records
-- Motor: MySQL 8.0+ (Railway) / InnoDB / utf8mb4
-- -----------------------------------------------------------------------------
-- QUE HACE
--   1. CREATE TABLE IF NOT EXISTS `pedidos` con el esquema que USA server.js.
--   2. Las 3 columnas del cupón en `pedidos` (cupon_id, cupon_codigo,
--      descuento_aplicado), con guard de information_schema.
--   3. `estado`: si la columna es un ENUM heredado, le suma los TRES valores
--      que escribe server.js (pendiente, cancelado, finalizado). Si es VARCHAR,
--      no hace nada: en un VARCHAR de 20 caracteres entran todos.
--   4. Índices de usuario_id, fecha y cupon_id (cada uno con su propio guard),
--      y el UNIQUE de `numero_orden`: se agrega SOLO si no hay números de orden
--      repetidos. Si los hay, la migración NO se aborta y deja la lista exacta
--      de los repetidos (sección 4.4).
--   5. FK `pedidos.cupon_id` -> `cupones.id` SOLO si la tabla `cupones` ya
--      existe y ambos lados son InnoDB. Si no, se degrada sin FK.
--   6. Bloque de verificación que se ejecuta con la migración. El bloque del
--      FINAL del archivo es el que hay que copiar y pegar a mano (el runner
--      tira la salida de los SELECT, ver "COMO CORRERLO").
--
-- -----------------------------------------------------------------------------
-- POR QUE ESTE ARCHIVO
--   La tabla `pedidos` es la ÚNICA que el backend necesita y que ninguna
--   migración creaba. Hay tres juegos de nombres para la misma tabla:
--
--     a) El que usa server.js (el que está en producción y funciona):
--        id_pedido, numero_orden, nombre_cliente, whatsapp_cliente, total_pago,
--        divisa_preferida, estado, fecha, items (JSON), usuario_id.
--     b) El de SCRIPT_MYSQL_BACKUP.sql y
--        supabase/migrations/20260228193834_create_guacamayo_schema.sql
--        (PostgreSQL, herenado de la versión con Supabase):
--        id, numero_pedido, cliente_id, precio_total_usd/ars/usdt, fecha_pedido.
--     c) 2026-09-26_auth.sql:264, que lo admite en un comentario y deja
--        "adaptar el nombre de la PK" como tarea manual.
--
--   Resultado: el checkout andaba contra producción, pero una base nueva no
--   tenía con qué crearla (2026-09-26 hace ALTER TABLE pedidos sin crearla, así
--   que en una base limpia se detiene en su sección 6). Este archivo es la
--   definición canónica: la que se lee y la que se corre.
--
--   OJO CON EL ORDEN EN UNA BASE NUEVA
--     `npm run migrar` recorre los archivos por nombre y se detiene en el
--     primero que falla. En una base vacía, 2026-09-26_auth.sql se cae en su
--     sección 6 (ALTER sobre `pedidos`, que todavía no existe) y nunca llega
--     acá. La forma limpia de arrancar de cero es:
--       1) node scripts/migrar.mjs --archivo 2026-09-29_pedidos_cupones.sql
--       2) npm run migrar
--     En producción no hace falta: `pedidos` ya existe, así que la 6 de
--     2026-09-26 fue un no-op y este archivo solo agrega lo que faltaba.
--
--     Y NO hay que "arreglar" 2026-09-26_auth.sql para que funcione el arranque
--     en frío: los archivos ya aplicados se registran en `migraciones` con el
--     hash del contenido (scripts/migrar.mjs:127-157), así que tocar uno hace
--     que cada deploy futuro reimprima "el archivo cambio despues de aplicarse"
--     sin volver a correrlo. Este archivo es el que resuelve el arranque de cero.
--
-- IDEMPOTENCIA
--   - El CREATE TABLE usa IF NOT EXISTS: si la tabla ya existe (producción), no
--     la toca. Los índices van DENTRO del CREATE, como en 2026-09-27_cupones.sql,
--     y ADEMÁS con un guard propio por índice en la sección 4: los del CREATE
--     solo existen en bases nuevas, y los guards son los que los crean donde la
--     tabla ya estaba.
--   - Cada ALTER va con guard de information_schema + PREPARE/EXECUTE, porque
--     MySQL 8.0 NO tiene "ADD COLUMN IF NOT EXISTS" (eso es una extensión de
--     MariaDB). "DO 0" es el no-op.
--   - Se puede correr el archivo las veces que haga falta.
--
-- QUE NO HACE (a propósito)
--   - No renombra columnas. Si una base tuviera los nombres del esquema (b), el
--     arreglo es un ALTER TABLE ... CHANGE manual y una decisión de negocio, no
--     algo que se pueda decidir con un guard. El bloque de verificación de abajo
--     reporta las columnas que sobran para que se vean.
--   - No renumera ni borra pedidos para poder poner el UNIQUE de `numero_orden`.
--     Si ya hay números de orden repetidos, el índice NO se agrega, pero la
--     migración termina bien y deja la lista exacta de los repetidos y qué
--     hacer con ellos (sección 4.4). Renumerar ventas ya cobradas es una
--     decisión de negocio, va con backup y no corresponde a un archivo que se
--     corre en cada deploy.
--
-- COMO CORRERLO
--   npm run migrar
--   node scripts/migrar.mjs --archivo 2026-09-29_pedidos_cupones.sql   (solo este)
--   (o: mysql -h HOST -P PUERTO -u USER -p railway < 2026-09-29_pedidos_cupones.sql)
--   IMPORTANTE: la sesión debe tener seleccionada la base (los guards usan
--   DATABASE()). No depende del nombre de la base.
--
--   OJO: `npm run migrar` NO imprime la salida de los SELECT de verificación
--   (scripts/migrar.mjs ignora el resultado de db.query). Para ver el estado
--   final hay que correr esos SELECT a mano, con el cliente de MySQL de Railway
--   o el editor de queries. Para saber si la migración está aplicada alcanza con
--   `node scripts/migrar.mjs --estado`.
--
--   OJO CON EL UNIQUE DE `numero_orden` (sección 4.4): si ya hay números de
--   orden repetidos, el índice NO se agrega pero la migración termina IGUAL, así
--   que `npm run migrar` imprime "+ ... ok" y no dice nada. Por eso el
--   diagnóstico hay que buscarlo a mano (punto 2 del bloque del final). No es un
--   ruido: sin índice el checkout sigue funcionando y no falla nada, que es
--   justo lo que hace el problema invisible hasta que aparecen dos pedidos con
--   la misma referencia.
--
-- ORDEN: después de 2026-09-26_auth.sql, 2026-09-27_cupones.sql y
-- 2026-09-28_cupones_schema.sql. La FK contra `cupones` NO está en ninguna de
-- esas: vive acá, en la sección 5 (2026-09-28 dice explícitamente que no
-- agrega FKs).
-- =============================================================================


-- =============================================================================
-- 1) Tabla `pedidos` (esquemática canónica: la que lee y escribe server.js)
--
--    - id_pedido INT AI: la PK. El nombre no es libre: PUT /api/pedidos/:id/
--      finalizar y /cancelar filtran por `id_pedido`, y GET /api/mis-pedidos
--      devuelve la fila tal cual (SELECT *) para la vista de cuenta.
--    - numero_orden VARCHAR(20) UNIQUE: lo genera el servidor (`GR-####`), nunca
--      el cliente. UNIQUE porque es el número que se le pasa al cliente por
--      WhatsApp y por el que se busca en el panel.
--    - total_pago DECIMAL(12,2): siempre en USD (así está guardado el catálogo).
--      El POST /api/pedidos IGNORA el total que manda el navegador y calcula el
--      suyo contra la base, así que el DEFAULT 0 es solo para el esquema.
--    - divisa_preferida: la que eligió el cliente para ver el precio. Se guarda
--      aparte del total; la conversión la muestra el frontend.
--    - estado: VARCHAR(20) y no ENUM a propósito. El servidor solo escribe
--      'pendiente' (POST), 'finalizado' (PUT /finalizar) y 'cancelado'
--      (PUT /cancelar), y un VARCHAR no se rompe nunca si mañana aparece un
--      estado nuevo. La sección 3 igual completa el ENUM de las bases que lo
--      tienen heredado.
--    - fecha DATETIME: la pone el servidor con NOW().
--    - items LONGTEXT: no hay tabla de detalles. Es el snapshot de lo comprado
--      (id, cantidad, titulo y precio_unitario leídos de las filas bloqueadas
--      con FOR UPDATE). Es lo que usa PUT /cancelar para reponer stock, y por
--      eso tiene que seguir siendo un JSON legible, no un texto libre.
--    - usuario_id / actualizado_en / version: las agregó 2026-09-26_auth.sql.
--      Van en el CREATE para que una base nueva no dependa de esa migración,
--      pero los guards de la 6 de ese archivo los ven como "ya existen" y no
--      cambian nada. Por eso el CREATE los declara EXACTAMENTE como esa
--      migración: si acá se escribieran distinto, una base nueva quedaría con
--      un esquema distinto al de producción y este archivo, que se declara
--      canónico, estaría mintiendo en la mitad de la tabla.
--    - Las 3 columnas del cupón van en el CREATE Y con guard en la sección 2:
--      en una base nueva salen de acá, y en producción (donde la tabla ya
--      existía sin ellas) las agrega el guard.
-- =============================================================================
CREATE TABLE IF NOT EXISTS `pedidos` (
  `id_pedido`          INT           NOT NULL AUTO_INCREMENT,
  `numero_orden`       VARCHAR(20)   NOT NULL,
  `nombre_cliente`     VARCHAR(120)  NULL DEFAULT NULL,
  `whatsapp_cliente`   VARCHAR(32)   NULL DEFAULT NULL,
  `total_pago`         DECIMAL(12,2) NOT NULL DEFAULT 0,
  `divisa_preferida`   VARCHAR(10)   NULL DEFAULT NULL,
  `estado`             VARCHAR(20)   NOT NULL DEFAULT 'pendiente',
  `fecha`              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `items`              LONGTEXT      NULL DEFAULT NULL,
  `usuario_id`         INT           NULL DEFAULT NULL,
  `cupon_id`           INT           NULL DEFAULT NULL,
  `cupon_codigo`       VARCHAR(50)   NULL DEFAULT NULL,
  `descuento_aplicado` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `actualizado_en`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `version`            INT           NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_pedido`),
  UNIQUE KEY `uq_pedidos_numero_orden` (`numero_orden`),
  KEY `idx_pedidos_usuario_id` (`usuario_id`),
  KEY `idx_pedidos_fecha` (`fecha`),
  KEY `idx_pedidos_cupon_id` (`cupon_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Pedidos: total en USD, snapshot de items en JSON y cupon aplicado';


-- =============================================================================
-- 2) Las 3 columnas del cupón (con guard: en producción no existen)
--
--    - cupon_id INT NULL: qué cupón se gastó. Es lo que permite que
--      PUT /api/pedidos/:id/cancelar devuelva el uso
--      (`usos_actuales = GREATEST(0, usos_actuales - 1)`).
--    - cupon_codigo VARCHAR(50) NULL: copia del código en el momento de la
--      compra. Es a propósito, y no una redundancia: si el cupón se borra o se
--      renombra, el pedido ya cobrado tiene que seguir diciendo qué se aplicó
--      (es lo que muestra el backoffice en la lista de pedidos).
--    - descuento_aplicado DECIMAL(12,2) NOT NULL DEFAULT 0: cuánto se descontó
--      de verdad, NO el valor teórico del cupón. Un fijo mayor que el subtotal
--      deja el total en 0 (nunca negativo) y el descuento real queda recortado;
--      guardar el teórico mostraría un beneficio que no se cobró. Con
--      NOT NULL DEFAULT 0, los pedidos anteriores a esta migración dan 0 y no
--      hay que preguntar por NULL al pintar el panel.
-- =============================================================================
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD COLUMN `cupon_id` INT NULL DEFAULT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'pedidos'
    AND COLUMN_NAME  = 'cupon_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD COLUMN `cupon_codigo` VARCHAR(50) NULL DEFAULT NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'pedidos'
    AND COLUMN_NAME  = 'cupon_codigo'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD COLUMN `descuento_aplicado` DECIMAL(12,2) NOT NULL DEFAULT 0',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'pedidos'
    AND COLUMN_NAME  = 'descuento_aplicado'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- =============================================================================
-- 3) `estado`: que el tipo acepte los TRES estados que escribe server.js
--
--    server.js escribe exactamente tres valores:
--      'pendiente'  -> INSERT de POST /api/pedidos (server.js:393)
--      'finalizado' -> PUT /api/pedidos/:id/finalizar (server.js:520)
--      'cancelado'  -> PUT /api/pedidos/:id/cancelar  (server.js:505)
--    El ENUM heredado (VARCHAR con CHECK en el schema de Supabase, ENUM en
--    MySQL) tiene pendiente/confirmado/enviado/entregado/cancelado pero NO
--    'finalizado': con esa definición el PUT /finalizar revienta con 1265
--    ("Data truncated for column 'estado'") y el pedido no se puede cerrar.
--
--    Se corrigen LOS TRES, no solo el que se recuerda. 'pendiente' es tan
--    obligatorio como 'finalizado' (lo escribe el INSERT del checkout) y
--    'cancelado' lo escribe la cancelación: si una base se reconstruyó desde
--    el CHECK del schema viejo, el que falta puede ser cualquiera de los tres.
--    Con los tres garantizado, el backend no puede romper por un 1265.
--
--    Se resuelve dinámicamente, sin escribir la lista de valores a mano:
--    information_schema devuelve COLUMN_TYPE tal cual (`enum('a','b')`) y el
--    ALTER se arma con esa lista + el valor que falta. Escribirla fija tiraría
--    abajo los estados que ya tuviera la base y que acá no se conocen.
--    Se preservan NOT NULL, DEFAULT, charset y collation de la columna.
--
--    El guard es `COLUMN_TYPE NOT LIKE '%<valor>%'` y no una comparación exacta
--    del tipo entero: alcanza con que el valor esté en cualquier posición de la
--    lista (en un ENUM el orden no importa para validar), y además impide que
--    un valor ya presente se agregue otra vez en una corrida repetida.
--
--    Si `estado` es VARCHAR (como la crea este mismo archivo), el SELECT no
--    encuentra nada, IFNULL devuelve 'DO 0' y no se toca nada: en un VARCHAR
--    de 20 caracteres los tres estados entran bien.
-- =============================================================================

-- 3.1 'finalizado' (falta en el ENUM heredado: rompe el PUT /finalizar)
SET @sql := IFNULL((
  SELECT IF(
    COLUMN_TYPE = CONCAT(LEFT(COLUMN_TYPE, CHAR_LENGTH(COLUMN_TYPE) - 1), ',''finalizado'')'),
    'DO 0',
    CONCAT(
      'ALTER TABLE `pedidos` MODIFY COLUMN `estado` ',
      CONCAT(LEFT(COLUMN_TYPE, CHAR_LENGTH(COLUMN_TYPE) - 1), ',''finalizado'')'),
      IF(IS_NULLABLE = 'NO', ' NOT NULL', ' NULL'),
      IF(COLUMN_DEFAULT IS NULL, '', CONCAT(' DEFAULT ''', COLUMN_DEFAULT, '''')),
      IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME)),
      IF(COLLATION_NAME IS NULL, '', CONCAT(' COLLATE ', COLLATION_NAME)))
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'pedidos'
    AND COLUMN_NAME  = 'estado'
    AND DATA_TYPE    = 'enum'
    AND COLUMN_TYPE NOT LIKE '%finalizado%'
), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3.2 'cancelado' (se relee COLUMN_TYPE porque 3.1 ya pudo cambiarlo)
SET @sql := IFNULL((
  SELECT IF(
    COLUMN_TYPE = CONCAT(LEFT(COLUMN_TYPE, CHAR_LENGTH(COLUMN_TYPE) - 1), ',''cancelado'')'),
    'DO 0',
    CONCAT(
      'ALTER TABLE `pedidos` MODIFY COLUMN `estado` ',
      CONCAT(LEFT(COLUMN_TYPE, CHAR_LENGTH(COLUMN_TYPE) - 1), ',''cancelado'')'),
      IF(IS_NULLABLE = 'NO', ' NOT NULL', ' NULL'),
      IF(COLUMN_DEFAULT IS NULL, '', CONCAT(' DEFAULT ''', COLUMN_DEFAULT, '''')),
      IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME)),
      IF(COLLATION_NAME IS NULL, '', CONCAT(' COLLATE ', COLLATION_NAME)))
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'pedidos'
    AND COLUMN_NAME  = 'estado'
    AND DATA_TYPE    = 'enum'
    AND COLUMN_TYPE NOT LIKE '%cancelado%'
), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3.3 'pendiente' (lo escribe el INSERT del checkout; sin él no se compra)
SET @sql := IFNULL((
  SELECT IF(
    COLUMN_TYPE = CONCAT(LEFT(COLUMN_TYPE, CHAR_LENGTH(COLUMN_TYPE) - 1), ',''pendiente'')'),
    'DO 0',
    CONCAT(
      'ALTER TABLE `pedidos` MODIFY COLUMN `estado` ',
      CONCAT(LEFT(COLUMN_TYPE, CHAR_LENGTH(COLUMN_TYPE) - 1), ',''pendiente'')'),
      IF(IS_NULLABLE = 'NO', ' NOT NULL', ' NULL'),
      IF(COLUMN_DEFAULT IS NULL, '', CONCAT(' DEFAULT ''', COLUMN_DEFAULT, '''')),
      IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME)),
      IF(COLLATION_NAME IS NULL, '', CONCAT(' COLLATE ', COLLATION_NAME)))
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'pedidos'
    AND COLUMN_NAME  = 'estado'
    AND DATA_TYPE    = 'enum'
    AND COLUMN_TYPE NOT LIKE '%pendiente%'
), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- =============================================================================
-- 4) Índices
--    Guard propio por índice (no uno solo para la tabla): si el archivo se cortó
--    a mitad de camino, cada guard se completa solo en la corrida siguiente.
--      - idx_pedidos_usuario_id: GET /api/mis-pedidos filtra por usuario_id.
--      - idx_pedidos_fecha: GET /api/pedidos ordena por fecha DESC.
--      - idx_pedidos_cupon_id: el JOIN/consulta de "pedidos que usaron este
--        cupón" y el borrado en cascada lógica del panel.
--    El UNIQUE de `numero_orden` va aparte, en 4.4: es el único que puede no ser
--    seguro de agregar y por eso necesita su propio diagnóstico en vez de un
--    guard más.
--    La FK de la 6 de 2026-09-26_auth.sql (fk_pedidos_usuario) ya crea su
--    propio índice en InnoDB si falta: por eso acá no se la replica.
-- =============================================================================
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD INDEX `idx_pedidos_usuario_id` (`usuario_id`)',
    'DO 0')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'pedidos'
    AND INDEX_NAME   = 'idx_pedidos_usuario_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD INDEX `idx_pedidos_fecha` (`fecha`)',
    'DO 0')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'pedidos'
    AND INDEX_NAME   = 'idx_pedidos_fecha'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `pedidos` ADD INDEX `idx_pedidos_cupon_id` (`cupon_id`)',
    'DO 0')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'pedidos'
    AND INDEX_NAME   = 'idx_pedidos_cupon_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- =============================================================================
-- 4.4) UNIQUE de `numero_orden`: el único índice que NO se puede agregar a ciegas
--
--    POR QUÉ NO BASTA CON DEJARLO EN EL CREATE (estaba solo ahí y no funcionaba)
--      El `CREATE TABLE` de la sección 1 declara `uq_pedidos_numero_orden`, pero
--      es un no-op donde `pedidos` ya existe, que es exactamente producción: el
--      índice nunca llegaba a crearse. Y sin índice el `INSERT` de
--      POST /api/pedidos NO falla cuando el número se repite: el `numero_orden`
--      se genera al azar (`GR-` + 4 dígitos = 10.000 valores, server.js:427) y
--      con 50 pedidos la chance de al menos una colisión ya es ~13% (con 100,
--      ~42%). El resultado son dos pedidos distintos con la misma referencia, el
--      panel muestra dos filas iguales y el admin recibe dos WhatsApp con el
--      mismo número sin poder saber cuál confirmar.
--
--    POR QUÉ NO SE RESUELVE DENTRO DE ESTE ARCHIVO
--      Agregar el índice con duplicados falla con 1062 y ABORTA el archivo
--      entero, con lo cual se pierden las columnas del cupón y la FK, que es lo
--      que de verdad bloquea el checkout. Renumerar los pedidos repetidos, en
--      cambio, es destructivo sobre ventas ya cobradas: es decisión de Kevin,
--      con backup y fuera de un archivo que se corre en cada deploy.
--      Entonces: se cuenta primero, y según lo que dé se agrega el índice o se
--      deja el diagnóstico. La migración termina bien en los dos casos.
--
--    - @dups = 0   -> no hay repetidos, se agrega el UNIQUE.
--    - @dups > 0   -> hay repetidos: NO se agrega, se listan y se avisa.
--    - @dups = -1  -> la columna `numero_orden` no existe (base con el esquema
--      heredado (b), donde se llama `numero_pedido`): ni se cuenta ni se avisa
--      como duplicado, se informa que el archivo no pudo hacer nada ahí.
--    - Si `numero_orden` admitiera NULL, el índice los toleraría (UNIQUE no
--      considera dos NULLs iguales) y se podría agregar igual. Se cuenta igual
--      y se es conservador: quedarse sin índice nunca rompe nada, un índice a
--      medio agregar sí.
--    - Si el server toma un pedido mientras corre la migración, el conteo puede
--      quedar desactualizado por una fracción de segundo. Esa carrera la
--      absorbs el reintento del INSERT (server.js:426-458, 5 intentos ante un
--      1062), no el índice.
-- =============================================================================

-- 4.4.1) Cuántos `numero_orden` hay repetidos ANTES de decidir nada.
--        El conteo va también por PREPARE, y no solo el ALTER, porque MySQL
--        resuelve los nombres de columna al ARMAR la sentencia, no al
--        ejecutarla: con la columna `numero_orden` ausente (esquema heredado (b),
--        donde se llama `numero_pedido`) un SELECT normal que la mencione aborta
--        el archivo entero con 1054, y abortar por una consulta que solo informa
--        sería justo lo contrario de lo que hace esta sección. Preparada, la
--        consulta ni se arma si el guard dice que no hay columna que contar.
SET @dups := -1;
SET @sql := IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME   = 'pedidos'
             AND COLUMN_NAME  = 'numero_orden'),
  'SELECT COUNT(*) INTO @dups FROM (
     SELECT `numero_orden` FROM `pedidos`
      GROUP BY `numero_orden` HAVING COUNT(*) > 1) AS `repetidos`',
  'SET @dups := -1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4.4.2) El índice: dos condiciones en el mismo guard. La de information_schema
--        es la idempotencia (que no exista ya, o el ALTER tiraría 1091). La de
--        @dups = 0 es la seguridad: es la que evita el 1062.
SET @sql := (
  SELECT IF(
    @dups = 0
    AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
                     WHERE TABLE_SCHEMA = DATABASE()
                       AND TABLE_NAME   = 'pedidos'
                       AND INDEX_NAME   = 'uq_pedidos_numero_orden'),
    'ALTER TABLE `pedidos` ADD UNIQUE KEY `uq_pedidos_numero_orden` (`numero_orden`)',
    'DO 0')
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4.4.3) Si hay repetidos, la lista exacta: cada número y cuántos pedidos lo
--        usan. Sale de un SELECT, no de un SIGNAL, así que no corta nada.
--        Solo usa `numero_orden` (la única columna que ya sabemos que existe,
--        porque si no @dups sería -1): el diagnóstico tiene que ser la parte
--        del archivo con menos chances de fallar, no la que más.
SET @sql := IF(@dups > 0,
  'SELECT `numero_orden`, COUNT(*) AS `pedidos_con_este_numero`
     FROM `pedidos`
    GROUP BY `numero_orden`
   HAVING COUNT(*) > 1
    ORDER BY `pedidos_con_este_numero` DESC, `numero_orden`',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4.4.4) El aviso, con el mismo criterio: SELECT y no SIGNAL SQLSTATE.
--        SIGNAL aborta la sentencia (justo lo que no se quiere acá) y además no
--        es una de las sentencias que MySQL acepta preparar. El texto va
--        enseguida de la lista para que se lea en el mismo golpe.
SET @sql := IF(@dups > 0, CONCAT(
    'SELECT ''AVISO: NO se agregó el índice UNIQUE de numero_orden.'' AS `que_hacer`',
    ' UNION ALL SELECT CONCAT(''1) Hay '', @dups, '' número(s) de orden con 2 o más pedidos. La lista exacta salió en la consulta anterior.'')',
    ' UNION ALL SELECT ''2) Mientras falte el índice, una colisión NO hace fallar el INSERT: quedan dos pedidos con la misma referencia y el admin recibe dos WhatsApp con el mismo número.''',
    ' UNION ALL SELECT ''3) NO borres ni renumeres sin backup: son ventas cobradas. Este archivo no lo hace a propósito.''',
    ' UNION ALL SELECT ''4) Con backup, renumerá UN pedido de cada grupo (dejá el número en el más viejo) y después corré:''',
    ' UNION ALL SELECT ''      ALTER TABLE `pedidos` ADD UNIQUE KEY `uq_pedidos_numero_orden` (`numero_orden`);''',
    ' UNION ALL SELECT ''5) La migración terminó bien y quedó registrada en `migraciones`: se puede seguir, pero esto hay que hacerlo antes de que caiga otra colisión.'''
  ), IF(@dups < 0,
    'SELECT ''AVISO: `pedidos` no tiene la columna `numero_orden`, así que no se intentó ningún índice único. Es el esquema heredado (b) del archivo: la columna se llama `numero_pedido` y renombrarla es una migración a mano.'' AS `que_hacer`',
    'DO 0'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- =============================================================================
-- 5) FK `pedidos.cupon_id` -> `cupones.id`
--
--    CON CUATRO GUARDES, porque cada uno es una forma real de que esto falle:
--      1) que la tabla `cupones` exista (este archivo no la crea: su migración
--         es la 2026-09-27, y el orden de archivos no obliga a nadie);
--      2) que `cupones.id` exista y sea INT (mismo tipo que cupon_id, si no
--         MySQL dice "incompatible types");
--      3) que `pedidos` sea InnoDB (una tabla MyISAM no admite FK: el ALTER
--         fallaría y abortaría toda la migración);
--      4) que la FK no exista ya.
--
--    Si falta cualquiera de las cuatro, no se agrega la FK y la migración sigue.
--    ESO ESTÁ BIEN: la FK es una comodidad, no la fuente de verdad. El backend
--    nunca lee `pedidos.cupon_id` para validar nada (el cupón se valida contra
--    `cupones` en la transacción del pedido), así que un pedido sin FK se
--    comporta exactamente igual.
--
--    ON DELETE SET NULL y no CASCADE: borrar un cupón desde el panel tiene que
--    poder seguir funcionando aunque se haya usado en pedidos ya cobrados. Con
--    SET NULL el pedido sobrevive (y conserva `cupon_codigo` y
--    `descuento_aplicado`, que son la foto histórica del beneficio) y solo se
--    desvincula.
--
--    SI QUEDÓ SIN FK (base sin `cupones`, motor MyISAM, tipos distintos...), la
--    forma de agregarla a mano, una vez normalizado el motor, es:
--      ALTER TABLE `pedidos`
--        ADD CONSTRAINT `fk_pedidos_cupon` FOREIGN KEY (`cupon_id`)
--        REFERENCES `cupones` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- =============================================================================
SET @sql := (
  SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cupones'
               AND COLUMN_NAME = 'id' AND DATA_TYPE = 'int')
    AND EXISTS (SELECT 1 FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cupones'
                  AND ENGINE = 'InnoDB')
    AND EXISTS (SELECT 1 FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
                  AND ENGINE = 'InnoDB')
    AND NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                    WHERE CONSTRAINT_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'pedidos'
                      AND CONSTRAINT_NAME = 'fk_pedidos_cupon'
                      AND CONSTRAINT_TYPE = 'FOREIGN KEY'),
    'ALTER TABLE `pedidos` ADD CONSTRAINT `fk_pedidos_cupon` FOREIGN KEY (`cupon_id`) REFERENCES `cupones` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    'DO 0')
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- =============================================================================
-- 6) VERIFICACIÓN
--    Lo que hay que mirar, en orden:
--      a) "1 = TRUE" en la primera fila: la tabla existe.
--      b) Las 15 columnas del esquema canónico, todas "OK". "SOBRA" es una
--         columna del esquema heredado que este archivo no borra (ver g).
--      c) 'finalizado', 'cancelado' y 'pendiente' dentro de COLUMN_TYPE si
--         `estado` es ENUM. Si es varchar(20), los tres entran y listo.
--      d) El motor: InnoDB. Si dice MyISAM, la FK de la sección 5 no se agregó
--         (es el degrade esperado, no un error).
--      e) fk = 0 sin cupones = OK. fk = 0 CON la tabla cupones = mirar el
--         ENGINE y los tipos.
--      f) veredicto_unico_orden. Las dos mitades de la 4.4 en una fila: si el
--         índice existe y no hay repetidos, está OK; si no existe y hay
--         repetidos, el veredicto dice cuántos son y que hay que arreglarlos a
--         mano (los lista la consulta de abajo).
--      g) columnas_heredadas > 0: sobran columnas del esquema viejo de Supabase
--         (id, numero_pedido, precio_total_usd...). Este archivo no las borra
--         ni las renombra: eso es una decisión a mano, con backup.
--      h) el esquema de `cupones`: es la otra mitad del checkout y este archivo
--         no la crea (la 2026-09-27 y la 2026-09-28).
-- =============================================================================

-- a) ¿Existe `pedidos`?
SELECT COUNT(*) AS `tabla_pedidos_existe`
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'pedidos';

-- b) Las columnas que tienen que existir, y si están como deben.
--    El veredicto distingue tres cosas que antes salían todas como "REVISAR":
--    una columna del esquema canónico con la nullability que espera server.js
--    (OK), una columna de más del esquema heredado (SOBRA, ver punto g) y una
--    columna del canónico con la nullability equivocada (REVISAR: eso sí es
--    un problema, porque el INSERT y los WHERE del server la usan).
SELECT
  `c`.`COLUMN_NAME`  AS `columna`,
  `c`.`COLUMN_TYPE`  AS `tipo`,
  `c`.`IS_NULLABLE`  AS `nullable`,
  `c`.`COLUMN_DEFAULT` AS `default`,
  CASE
    WHEN `c`.`COLUMN_NAME` NOT IN (
           'id_pedido', 'numero_orden', 'nombre_cliente', 'whatsapp_cliente',
           'total_pago', 'divisa_preferida', 'estado', 'fecha', 'items',
           'usuario_id', 'cupon_id', 'cupon_codigo', 'descuento_aplicado',
           'actualizado_en', 'version')
      THEN 'SOBRA (ver g)'
    WHEN `c`.`IS_NULLABLE` = 'NO' THEN 'OK'
    WHEN `c`.`COLUMN_NAME` IN ('nombre_cliente', 'whatsapp_cliente', 'divisa_preferida',
                               'items', 'usuario_id', 'cupon_id', 'cupon_codigo')
      THEN 'OK'
    ELSE 'REVISAR'
  END AS `estado`
  FROM information_schema.COLUMNS `c`
 WHERE `c`.`TABLE_SCHEMA` = DATABASE()
   AND `c`.`TABLE_NAME`   = 'pedidos'
 ORDER BY `c`.`ORDINAL_POSITION`;

-- c) Los valores de `estado` (si es ENUM, tienen que estar los tres).
SELECT `COLUMN_TYPE` AS `estado_definicion`, `IS_NULLABLE` AS `nullable`,
       `COLUMN_DEFAULT` AS `default`
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'pedidos'
   AND COLUMN_NAME  = 'estado';

-- d) Motor de las dos tablas (InnoDB = hay FK; MyISAM = no, y es el degrade OK).
SELECT `TABLE_NAME` AS `tabla`, `ENGINE` AS `motor`, `TABLE_ROWS` AS `filas_aprox`
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('pedidos', 'cupones');

-- Índices de `pedidos`.
SELECT `INDEX_NAME` AS `indice`, `NON_UNIQUE` AS `no_unico`, `SEQ_IN_INDEX` AS `orden`,
       `COLUMN_NAME` AS `columna`
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'pedidos'
 ORDER BY `INDEX_NAME`, `SEQ_IN_INDEX`;

-- e) Claves foráneas de `pedidos` (fk_pedidos_cupon sale de la sección 5).
SELECT `CONSTRAINT_NAME` AS `fk`, `COLUMN_NAME` AS `columna`,
       `REFERENCED_TABLE_NAME` AS `referencia`, `REFERENCED_COLUMN_NAME` AS `referencia_columna`
  FROM information_schema.KEY_COLUMN_USAGE
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'pedidos'
   AND REFERENCED_TABLE_NAME IS NOT NULL
 ORDER BY `CONSTRAINT_NAME`;

-- f) El UNIQUE de `numero_orden`: ¿existe el índice y hay números repetidos?
--    Están juntos porque son las dos caras de la 4.4: el índice se agregó si y
--    solo si el conteo dio 0, así que "no existe" y "hay repetidos" se explican
--    el uno al otro y no hace falta leer dos consultas para entender el estado.
--    Va por PREPARE con el mismo criterio que la 4.4: si la columna
--    `numero_orden` no existe, mencionarla abortaría el archivo con 1054 y en
--    una base así este archivo no puede hacer nada (la 4.4 ya lo dijo).
SET @sql := IF(@dups >= 0,
  'SELECT
     (SELECT COUNT(*) FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = ''pedidos''
         AND INDEX_NAME   = ''uq_pedidos_numero_orden'')  AS `indice_unico_creado`,
     (SELECT COUNT(*) FROM (
        SELECT `numero_orden` FROM `pedidos`
         GROUP BY `numero_orden` HAVING COUNT(*) > 1) AS `r`) AS `numeros_repetidos`,
     CASE
       WHEN EXISTS (SELECT 1 FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = ''pedidos''
                      AND INDEX_NAME   = ''uq_pedidos_numero_orden'')
         THEN ''OK: el numero de orden no se puede repetir''
       WHEN EXISTS (SELECT 1 FROM (
                       SELECT `numero_orden` FROM `pedidos`
                        GROUP BY `numero_orden` HAVING COUNT(*) > 1) AS `r`)
         THEN ''SIN INDICE: hay numeros repetidos (ver la lista de abajo). La 4.4 no los puede arreglar sola''
       ELSE ''SIN INDICE y sin repetidos: correr de nuevo la seccion 4.4''
     END AS `veredicto_unico_orden`',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Los repetidos, si los hay. Mismo criterio y mismo motivo que arriba: 0 filas
-- es una respuesta válida, pero la columna tiene que existir para poder
-- mencionarla.
SET @sql := IF(@dups >= 0,
  'SELECT `numero_orden`, COUNT(*) AS `pedidos_con_este_numero`
     FROM `pedidos`
    GROUP BY `numero_orden`
   HAVING COUNT(*) > 1
    ORDER BY `pedidos_con_este_numero` DESC, `numero_orden`',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- g) Columnas que sobran del esquema heredado de Supabase (id, numero_pedido,
--    precio_total_*, cliente_id, fecha_pedido...). No se tocan: se informan.
SELECT `COLUMN_NAME` AS `columna_heredada`
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'pedidos'
   AND `COLUMN_NAME` IN ('id', 'numero_pedido', 'cliente_id', 'precio_total_usd',
                         'precio_total_ars', 'precio_total_usdt', 'fecha_pedido',
                         'created_at', 'updated_at')
 ORDER BY `COLUMN_NAME`;

-- h) Esquema de `cupones`. No lo crea este archivo (lo crean la 2026-09-27 y la
--    2026-09-28), pero es la otra mitad del checkout: `CAMPOS_CUPON` de
--    server.js pide las nueve columnas que salen acá, y `usos_actuales` tiene
--    que ser NOT NULL (con NULL, el `usos_actuales + 1` del POST /api/pedidos
--    deja el contador clavado y el cupón nunca se agota).
SELECT `COLUMN_NAME` AS `columna`, `COLUMN_TYPE` AS `tipo`,
       `IS_NULLABLE` AS `nullable`, `COLUMN_DEFAULT` AS `default`
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'cupones'
 ORDER BY `ORDINAL_POSITION`;

-- Cómo queda el historial: los 4 archivos, con la marca de aplicada.
-- Va con guard porque `migraciones` la crea scripts/migrar.mjs: si el archivo se
-- corre a mano con el cliente de MySQL y todavia no se corrio ningun migrar.mjs,
-- la tabla no existe y un SELECT normal abortaria la corrida.
SET @sql := IF(
  EXISTS (SELECT 1 FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'migraciones'),
  'SELECT `nombre`, `hash`, `aplicada_en` FROM `migraciones` ORDER BY `nombre`',
  'DO 0'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- =============================================================================
-- NOTAS Y DECISIONES
--   - `total_pago` y `descuento_aplicado` son DECIMAL, no FLOAT: son plata.
--     Ojo con esto al leerlos desde el front: mysql2 devuelve los DECIMAL como
--     string (tipo `Cupon.valor` en src/types/database.ts lo refleja), y el
--     backend los envuelve con Number() donde hace falta.
--   - `items` es LONGTEXT y no JSON: MySQL 5.7 y anteriores no tienen el tipo
--     JSON, y el backend lo lee con JSON.parse sin cast (la cancelación depende
--     de eso). Un JSON mal guardado no rompe la fila: se cancela igual, sin
--     stock que devolver.
--   - Sin COLLATE explícito en el CREATE: se hereda el default de la base, el
--     mismo criterio que 2026-09-26_auth.sql y 2026-09-27_cupones.sql, para no
--     generar "Illegal mix of collations" al hacer JOIN contra
--     inventario_vinilos / cupones.
--   - No se borra ni renombra nada de una base existente. Este archivo solo
--     agrega lo que falta; la limpieza del esquema heredado es manual y con
--     backup.
--   - Con el UNIQUE de `numero_orden` puesto, el POST /api/pedidos que choca con
--     un número ya usado falla con 1062 y server.js reintenta hasta 5 veces con
--     otro número (server.js:426-458, dentro de la misma transacción: el stock y
--     el uso del cupón ya descontados siguen valiendo para el mismo pedido). El
--     1062 solo puede venir de este índice, porque las demás columnas no
--     tienen constraint. Con 10.000 números posibles, 5 intentos son de sobra
--     para el volumen real de la tienda.
--   - Si la 4.4 no agregó el índice por duplicados previos, el checkout sigue
--     funcionando pero SIN la red de seguridad: es el estado peor para
--     diagnosticar (nada falla, aparecen dos pedidos con el mismo número). Por
--     eso el archivo insiste con la lista y con el veredicto de la 6 en vez de
--     resolverlo solo.
--   - Si algo falla a mitad de camino, no hace falta volver atrás: se puede
--     corregir y volver a correr el archivo completo (cada guard es
--     independiente). Ojo: si falla, `npm run migrar` NO lo registra en
--     `migraciones` y se detiene, así que las siguientes tampoco se aplican.
-- =============================================================================


-- =============================================================================
-- VERIFICACIÓN PARA COPIAR Y PEGAR (bloque comentado a propósito)
--
--   POR QUÉ ESTA SECCIÓN ESTÁ COMENTADA Y LA 6 NO
--     `npm run migrar` manda el archivo entero como UNA consulta (multipleStatements)
--     y tira la respuesta: scripts/migrar.mjs:165 solo mira que no explote. Los
--     SELECT de la 6 no llegan a verse nunca, entonces el bloque de abajo es el
--     que sirve de verdad, y va comentado para que se pueda pegar de a parte.
--
--   CÓMO CORRERLO
--     Editor de queries de Railway, o:
--       mysql -h HOST -P PUERTO -u USER -p BASE   (con la base ya seleccionada:
--       los queries usan DATABASE(), no hace falta pasar el nombre)
--     Después: `node scripts/migrar.mjs --estado` para ver si quedó registrada.
--
--   QUÉ TIENE QUE SALIR
--     1) Las 15 columnas de `pedidos` con el tipo, la nullability y el default.
--        Las 3 del cupón tienen que estar: sin `cupon_id` / `cupon_codigo` /
--        `descuento_aplicado` el POST /api/pedidos revienta con 1054 y el
--        checkout no cierra ni una venta.
--     2) `veredicto_unico_orden` = 'OK: el numero de orden no se puede repetir'.
--        Es la fila que decide si el checkout puede volver a chocar dos veces con
--        la misma referencia. Si dice otra cosa, mirá el punto siguiente.
--     3) `estado` como varchar(20) -> los tres estados entran. Como
--        enum(...) -> tiene que listar pendiente, cancelado y finalizado; las
--        tres filas del veredicto tienen que decir OK.
--     4) Los cupones. Puede no haber ninguno (se crean desde el panel, y este
--        archivo no inserta datos): 0 filas es una respuesta válida.
-- =============================================================================

-- 1) Esquema final de `pedidos`
-- SELECT `ORDINAL_POSITION` AS `#`,
--        `COLUMN_NAME`      AS `columna`,
--        `COLUMN_TYPE`      AS `tipo`,
--        `IS_NULLABLE`      AS `nullable`,
--        `COLUMN_DEFAULT`   AS `default`,
--        `EXTRA`            AS `extra`
--   FROM information_schema.COLUMNS
--  WHERE `TABLE_SCHEMA` = DATABASE()
--    AND `TABLE_NAME`   = 'pedidos'
--  ORDER BY `ORDINAL_POSITION`;
--
-- Lo mismo, en crudo (incluye el COMMENT de la tabla y el orden de las FK):
-- SHOW CREATE TABLE `pedidos`;

-- 2) El UNIQUE de `numero_orden`: ¿quedó puesto? (sección 4.4)
--    Los dos números que importan: `indice_unico_creado` tiene que ser 1 y
--    `numeros_repetidos` tiene que ser 0. Son las dos mitades de la misma
--    decisión: el índice se agregó solo si el conteo de repetidos daba 0.
--    OJO: esta consulta menciona `pedidos`.`numero_orden` a secas, así que es la
--    versión con el esquema canónico. Contra una base con el esquema heredado (b)
--    del encabezado (donde la columna se llama `numero_pedido`) tira 1054: no es
--    que el índice falte, es que la columna tiene otro nombre.
-- SELECT
--   (SELECT COUNT(*) FROM information_schema.STATISTICS
--     WHERE TABLE_SCHEMA = DATABASE()
--       AND TABLE_NAME   = 'pedidos'
--       AND INDEX_NAME   = 'uq_pedidos_numero_orden') AS `indice_unico_creado`,
--   (SELECT COUNT(*) FROM (
--      SELECT `numero_orden` FROM `pedidos`
--       GROUP BY `numero_orden` HAVING COUNT(*) > 1) AS `r`) AS `numeros_repetidos`,
--   CASE
--     WHEN EXISTS (SELECT 1 FROM information_schema.STATISTICS
--                   WHERE TABLE_SCHEMA = DATABASE()
--                     AND TABLE_NAME   = 'pedidos'
--                     AND INDEX_NAME   = 'uq_pedidos_numero_orden')
--       THEN 'OK: el numero de orden no se puede repetir'
--     WHEN EXISTS (SELECT 1 FROM (
--                     SELECT `numero_orden` FROM `pedidos`
--                      GROUP BY `numero_orden` HAVING COUNT(*) > 1) AS `r`)
--       THEN 'SIN INDICE: hay numeros repetidos -> arreglar a mano (ver la lista de abajo)'
--     ELSE 'SIN INDICE y sin repetidos: correr de nuevo la seccion 4.4'
--   END AS `veredicto_unico_orden`;
--
-- La lista de los repetidos, para arreglar a mano. 0 filas = no hay, o ya
-- quedaron arreglados. Esta es la consulta que hay que pegar cuando el
-- veredicto de arriba NO dice OK: cada fila es un número que hoy comparten dos
-- o más pedidos (y `pedidos_con_este_numero` es cuántos).
-- SELECT `numero_orden`, COUNT(*) AS `pedidos_con_este_numero`
--   FROM `pedidos`
--  GROUP BY `numero_orden`
-- HAVING COUNT(*) > 1
--  ORDER BY `pedidos_con_este_numero` DESC, `numero_orden`;
--
-- Con el número en la mano, qué se corrige (a mano, con backup: el archivo no
-- borra ni renumera ventas). Se deja el número en el pedido MÁS VIEJO de cada
-- grupo y se le asigna un `GR-####` libre a los demás; después, el ALTER:
-- ALTER TABLE `pedidos` ADD UNIQUE KEY `uq_pedidos_numero_orden` (`numero_orden`);
--
-- Los pedidos de cada número repetido, para ver a quién hay que avisarle:
-- SELECT `numero_orden`, `id_pedido`, `fecha`, `estado`, `nombre_cliente`, `whatsapp_cliente`
--   FROM `pedidos`
--  WHERE `numero_orden` IN (
--        SELECT `numero_orden` FROM `pedidos`
--         GROUP BY `numero_orden` HAVING COUNT(*) > 1)
--  ORDER BY `numero_orden`, `fecha`;
--
-- Qué índices quedaron, para confirmar de un golpe que están los cuatro:
-- SELECT `INDEX_NAME`, `NON_UNIQUE`, `SEQ_IN_INDEX`, `COLUMN_NAME`
--   FROM information_schema.STATISTICS
--  WHERE TABLE_SCHEMA = DATABASE()
--    AND TABLE_NAME   = 'pedidos'
--  ORDER BY `INDEX_NAME`, `SEQ_IN_INDEX`;

-- 3) Tipo de `estado` y valores permitidos
-- SELECT `COLUMN_TYPE`    AS `tipo_de_estado`,
--        `IS_NULLABLE`    AS `nullable`,
--        `COLUMN_DEFAULT` AS `default`
--   FROM information_schema.COLUMNS
--  WHERE `TABLE_SCHEMA` = DATABASE()
--    AND `TABLE_NAME`   = 'pedidos'
--    AND `COLUMN_NAME`  = 'estado';
--
-- Un veredicto por estado: son los tres valores que escribe server.js
-- (server.js:393 pendiente, :520 finalizado, :505 cancelado). Si alguno dice
-- FALTA, la sección 3 de la migración no se aplicó o la base tiene un `estado`
-- que este archivo no pudo corregir: NO deploying hasta arreglarlo.
-- SELECT `e`.`estado`,
--        CASE
--          WHEN `c`.`COLUMN_NAME` IS NULL THEN 'FALTA LA TABLA pedidos'
--          WHEN `c`.`DATA_TYPE` <> 'enum' THEN 'OK (VARCHAR: entra cualquiera)'
--          WHEN LOCATE(CONCAT('''', `e`.`estado`, ''''), `c`.`COLUMN_TYPE`) > 0 THEN 'OK'
--          ELSE 'FALTA en el ENUM -> correr la seccion 3 de nuevo'
--        END AS `veredicto`
--   FROM (
--          SELECT 'pendiente'  AS `estado`
--          UNION ALL SELECT 'finalizado'
--          UNION ALL SELECT 'cancelado'
--        ) `e`
--   LEFT JOIN information_schema.COLUMNS `c`
--          ON `c`.`TABLE_SCHEMA` = DATABASE()
--         AND `c`.`TABLE_NAME`   = 'pedidos'
--         AND `c`.`COLUMN_NAME`  = 'estado';

-- 4) Contenido de `cupones`
-- SELECT `id`, `codigo`, `tipo`, `valor`,
--        `fecha_expiracion`, `activo`, `uso_maximo`, `usos_actuales`, `creado_en`
--   FROM `cupones`
--  ORDER BY `id`;
--
-- Los mismos datos formateados para leerlos de un vistazo (mysql2 devuelve los
-- DECIMAL como string, y en la consola es más fácil leerlos así):
-- SELECT `id`, `codigo`, `tipo`, `valor`,
--        `uso_maximo`, `usos_actuales`, `activo`, `creado_en`,
--        CASE
--          WHEN `activo` = 0 THEN 'apagado'
--          WHEN `fecha_expiracion` IS NOT NULL
--               AND `fecha_expiracion` < CURDATE() THEN 'vencido'
--          WHEN `uso_maximo` IS NOT NULL
--               AND `usos_actuales` >= `uso_maximo` THEN 'agotado'
--          ELSE 'vivo'
--        END AS `situacion`
--   FROM `cupones`
--  ORDER BY `id`;
--
-- El historial de migraciones, para ver que este archivo quedó registrado:
-- SELECT `nombre`, `hash`, `aplicada_en` FROM `migraciones` ORDER BY `nombre`;
-- =============================================================================
