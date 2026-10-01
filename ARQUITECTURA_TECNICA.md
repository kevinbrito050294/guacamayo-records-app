# Arquitectura T??cnica - GuacamayoRecords

## Stack Tecnol??gico

- **Frontend:** React 18 + TypeScript
- **Backend:** Node + Express 5 (`server.js` para cat??logo, pedidos, cupones y backoffice; `auth.js` para el acceso)
- **Base de Datos:** MariaDB / MySQL (pool `mysql2`), Railway
- **Styling:** Tailwind CSS
- **Build:** Vite
- **Icons:** Lucide React
- **API Cliente:** `fetch` contra el Express. En producci??n es el mismo origen (el Express sirve `dist/` y `/api`); en local el front es Vite (5173) y la API 3001, y ah?? va con `credentials: 'include'`

---

## Estructura de Directorios

```
src/
????????? components/
???   ????????? Catalog.tsx           # P??gina principal de cat??logo (y la b??squeda por texto)
???   ????????? Cart.tsx              # Carrito de compras (arma el mensaje de WhatsApp)
???   ????????? VinylCard.tsx         # Tarjeta de vinilo (con carrusel de fotos)
???   ????????? CurrencySelector.tsx  # Selector de divisas
???   ????????? AdminLogin.tsx        # Login del panel
???   ????????? AdminPanel.tsx        # Panel de administraci??n
???   ????????? ImageCarousel.tsx     # Carrusel de im??genes del vinilo
???   ????????? cuenta/               # Cuenta de cliente: Acceso, CuentaPanel, Direcciones,
???   ???                         #   Favoritos, Pedidos, BotonGoogle, CuentaProvider, ui
???   ????????? admin/
???       ????????? VinylForm.tsx     # Formulario para nuevo vinilo
???       ????????? BulkImporter.tsx  # Importador de CSV
???       ????????? CurrencyManager.tsx # Gestor de tasas
????????? lib/
???   ????????? api.ts                # URL base de la API (relativa en producci??n)
???   ????????? currency.ts           # Tasas y conversi??n
???   ????????? cuenta.ts             # Estado, tipos y formato de la cuenta de cliente
???   ????????? cupon.ts              # Estado del cup??n del carrito (localStorage + re-validaci??n)
????????? types/
???   ????????? database.ts           # Tipos TypeScript
????????? App.tsx                   # Componente principal
????????? main.tsx                  # Entrada
????????? index.css                 # Estilos globales
```

Ra??z del proyecto:
```
.env.example                    # Plantilla de variables (sin valores reales)
auth.js                       # Autenticaci??n: scrypt, sesiones, /api/admin y /api/auth
server.js                     # API Express: cat??logo, pedidos, cupones y rutas del backoffice
db/migrations/                # EL ESQUEMA REAL. Fuente de verdad del modelo de datos.
????????? 2026-09-26_auth.sql       # Cuentas, sesiones, favoritos y auditor??a
????????? 2026-09-27_cupones.sql    # Tabla `cupones`
????????? 2026-09-28_cupones_schema.sql  # Correcci??n del esquema de `cupones`
????????? 2026-09-29_pedidos_cupones.sql # Tabla `pedidos` + columnas del cup??n
docs/
????????? COUPONS.md                # Cupones: reglas, rutas, cancelaci??n y troubleshooting
scripts/
????????? crear-admin.mjs           # Alta/edici??n de usuarios del backoffice
????????? migrar.mjs                # Corre los .sql pendientes y anota el historial
```

Y dos archivos que **no** son fuente de verdad, y que est??n solo por historial:

```
SCRIPT_MYSQL_BACKUP.sql       # ?????? HIST??RICO. DDL viejo: columnas que el server no
                              #   reconoce (id/numero_pedido/cliente_id). NO ejecutar.
supabase/migrations/
????????? 20260228193834_create_guacamayo_schema.sql
                              # ?????? HIST??RICO. DDL de PostgreSQL, mismo problema.
```

Para una base nueva, el ??nico camino es `npm run migrar` sobre `db/migrations/`, con el
orden y las salvedades que est??n en [Migraciones](#migraciones). Ninguno de los dos
archivos de arriba reproduce el esquema que usa el c??digo.

---

## Base de Datos - Schema

### Tabla: `inventario_vinilos`
Almacena el cat??logo completo.

> **Ninguna migraci??n de `db/migrations/` la crea.** Esta tabla y `configuracion_divisas`
> ya exist??an cuando el backend pas?? a Express, as?? que el esquema que se ve ac?? **no es
> reproducible desde cero**: hay que crearlas a mano en una base nueva. Es la parte del
> modelo de datos que las migraciones todav??a no cubren.

```sql
id (CHAR(36) o INT) PRIMARY KEY   -- el server ordena por id y actualiza por id
codigo (VARCHAR) UNIQUE            -- SKU del vinilo
titulo (VARCHAR)
artista (VARCHAR)
genero (VARCHAR)                   -- texto libre, sin lista cerrada
precio_venta (DECIMAL)             -- Precio en USD
stock_actual (INTEGER)
calidad (VARCHAR)                 -- NM, EX, VG+, VG, G
imagen_url (VARCHAR)              -- admite varias URLs separadas por coma
descripcion (TEXT)
pais_origen (VARCHAR) NULL         -- etiqueta de pa??s en la tarjeta (UK, USA, ARG)
destacado (INT)                   -- 1 = sube arriba; PUT /api/vinilos/:id/destacado
version (INT) NOT NULL DEFAULT 1  -- lo agrega 2026-09-26_auth.sql (concurrencia)
created_at, updated_at
```

`pais_origen` y `destacado` los usa el c??digo (`VinylCard.tsx`, `Cart.tsx`,
`AdminPanel.tsx`, `PUT /api/vinilos/:id/destacado`) pero **no est??n en ninguna
migraci??n**: son columnas heredadas de la tabla original. Si se reconstruye la base desde
cero, hay que crearlas tambi??n, o el cat??logo y el carrito se rompen.

### Tabla: `configuracion_divisas`
Tasas de cambio actualizables.

```sql
id (CHAR(36) o INT) PRIMARY KEY
tipo (VARCHAR) UNIQUE            -- DOLAR_BLUE, USDT
tasa (DECIMAL)                   -- Valor de la tasa
ultima_actualizacion (TIMESTAMP) -- Cu??ndo cambi??
updated_by (VARCHAR) NULL        -- Qui??n la cambi??
```

### Tabla: `clientes` ??? no existe
No hay una tabla de compradores. El nombre viene del DDL hist??rico
(`SCRIPT_MYSQL_BACKUP.sql` y `supabase/migrations/`); ninguna migraci??n de
`db/migrations/` la crea y ning??n handler la lee.

Los datos del comprador viven repartidos:

| D??nde | Qu?? guarda |
|-------|-----------|
| `pedidos.nombre_cliente` | Nombre que escribe en el checkout |
| `pedidos.whatsapp_cliente` | Su n??mero, si lo complet?? |
| `usuarios` | Cuenta, solo si se registr?? (email, Google, etc.) |

Los que no se registran quedan solo en el pedido: no hay forma de volver a contactarlos
ni de ver "todos los que me compraron X".

### Tabla: `pedidos`
??rdenes de compra. El esquema can??nico es el de `db/migrations/2026-09-29_pedidos_cupones.sql` (el que lee y escribe `server.js`); los nombres del esquema heredado (`id`, `numero_pedido`, `cliente_id`, `precio_total_*`) **no existen** en la base real.

```sql
id_pedido (INT) PRIMARY KEY    -- el :id de /api/pedidos/:id/cancelar y /finalizar
numero_orden (VARCHAR) UNIQUE  -- 'GR-####', lo genera el servidor
nombre_cliente (VARCHAR) NULL
whatsapp_cliente (VARCHAR) NULL
total_pago (DECIMAL)           -- SIEMPRE en USD, y lo calcula el server
divisa_preferida (VARCHAR) NULL -- la conversi??n la muestra el frontend
estado (VARCHAR)               -- 'pendiente' | 'finalizado' | 'cancelado'
fecha (DATETIME)               -- la pone NOW()
items (LONGTEXT)               -- snapshot en JSON: id, cantidad, titulo, precio_unitario
usuario_id (INT) NULL          -- el cliente logueado que compr??, si hubo
cupon_id (INT) NULL            -- qu?? cup??n se gast?? (lo usa /cancelar)
cupon_codigo (VARCHAR) NULL    -- copia del c??digo al momento de la compra
descuento_aplicado (DECIMAL)   -- cu??nto se descont?? DE VERDAD (subtotal - total)
```

`items` es un snapshot a prop??sito: si despu??s se renombra el vinilo o se le cambia el
precio, el pedido ya cobrado no se toca. Es tambi??n de donde `PUT
/api/pedidos/:id/cancelar` lee los ids y las cantidades para reponer el stock, y por
eso tiene que seguir siendo un JSON legible. **No hay tabla de l??neas de pedido**: todo
el detalle vive en ese JSON.

### Tabla: `cupones`
C??digos de descuento del carrito (`db/migrations/2026-09-27_cupones.sql`, corregida por
`2026-09-28_cupones_schema.sql`).

```sql
id (INT) PRIMARY KEY
codigo (VARCHAR) UNIQUE        -- MAY??SCULAS, sin espacios, solo [A-Z0-9_-]
tipo (ENUM)                    -- 'porcentaje' | 'fijo'
valor (DECIMAL)                -- % del subtotal, o USD si es 'fijo'
fecha_expiracion (DATE) NULL   -- NULL = no vence
activo (TINYINT) NOT NULL      -- 0 = el panel lo muestra, el carrito lo rechaza
uso_maximo (INT) NULL          -- NULL = ilimitado
usos_actuales (INT) NOT NULL   -- lo mueve POST /api/pedidos y lo devuelve /cancelar
creado_en (DATETIME)
```

`valor` es DECIMAL: **mysql2 lo devuelve como string** (`"20.00"`), no como n??mero.


### Tabla: `detalles_pedido` ??? no existe
No hay l??neas de pedido normalizadas. Cada item va dentro del JSON `pedidos.items`
(ver `pedidos` arriba), as?? que no se puede reportar por vinilo: no hay forma de
saber "cu??ntos se vendieron de este disco" sin recorrer los pedidos en la aplicaci??n.

El nombre viene del DDL hist??rico (`SCRIPT_MYSQL_BACKUP.sql` y
`supabase/migrations/`), que s?? declaraba esa tabla junto con `clientes`. Ninguna
migraci??n de `db/migrations/` las crea y ning??n handler las lee.

---

## ???? Autenticaci??n y Cuentas

Toda la l??gica de acceso vive en `auth.js` (Express + `node:crypto`, sin dependencias extra). Se monta desde `server.js` con `app.use('/api', crearAuthRouter(db))`.

**C??mo funciona:**
- **Contrase??as:** hash `scrypt` (N=16384, r=8, p=1) con formato `scrypt$N$r$p$salt$hash`; la verificaci??n usa `timingSafeEqual`.
- **Sesiones:** token opaco de 32 bytes en cookie `httpOnly` + `SameSite=Lax` (+ `Secure` en producci??n). En la tabla `sesiones` queda **solo el SHA-256** del token: si filtran la base, no se pueden suplantar sesiones.
- **Cookies:** `gr_admin` (backoffice, 12 h) y `gr_cliente` (clientes, 30 d??as).
- **Sesi??n ??nica (backoffice):** si el mismo admin tuvo actividad en los ??ltimos 60 s, el login responde `423`. El panel llama `POST /api/admin/heartbeat` cada 15 s para renovar esa actividad.
- **Rate limit:** 5 intentos fallidos por `email|ip` ??? bloqueo de 15 minutos (`429`).
- **Limpieza:** el servidor borra las sesiones vencidas cada hora.

### Puesta en marcha (una sola vez)

**1. Correr las migraciones** (ver [Migraciones](#migraciones) para el detalle y el
orden):

```bash
npm run migrar
```

En Railway: el shell del servicio MySQL o el editor de queries, con la base `railway`
seleccionada (los guards de `information_schema` usan `DATABASE()`). Los archivos son
idempotentes, se pueden correr las veces que haga falta.

La de `2026-09-26` crea `admin_usuarios`, `usuarios`, `sesiones`, `direcciones`,
`favoritos` y `auditoria`, y agrega `usuario_id`, `actualizado_en` y `version` a
`pedidos`. Las tres siguientes crean `cupones` y le agregan al `pedidos` las columnas
del cup??n. Ninguna inserta datos.

**2. Crear el usuario del backoffice** (la contrase??a no se escribe en ning??n archivo):

```bash
$env:ADMIN_PASSWORD='mi-clave'; node scripts/crear-admin.mjs --email admin@guacamayorecords.com --nombre "Guacamayo"
```

Tambi??n acepta `--password 'mi-clave'`, y los opcionales `--rol admin|editor` y `--activo 0`. M??nimo 8 caracteres. Lee `MYSQL_URL` del entorno o del `.env`.

**Resetear la contrase??a** es el mismo comando: si el email ya existe, el script actualiza el hash e imprime `Actualizado: ...`.

**3. Entrar al panel** con **email + contrase??a** (ya no hay una contrase??a ??nica en el c??digo).

### Variables de entorno

| Variable | Obligatoria | Para qu?? |
|----------|-------------|----------|
| `MYSQL_URL` | S?? | Conexi??n a MySQL (la usan el server y el script) |
| `ALLOWED_ORIGINS` | No | Or??genes CORS separados por coma. Por defecto ya incluye `localhost:5173`, `localhost:3000`, `localhost:3001`, `guacamayorecords.up.railway.app`, `guacamayorecords.com` y `www.guacamayorecords.com` |
| `GOOGLE_CLIENT_ID` | No | Solo login con Google: valida que el `id_token` venga de esa app |
| `GOOGLE_DOMINIOS` | No | Solo login con Google: restringe el login a ciertos dominios (ej: `midominio.com,otro.com`) |
| `VITE_GOOGLE_CLIENT_ID` | No | **El mismo valor** que `GOOGLE_CLIENT_ID`, del lado del front. Sin ??l no se renderiza el bot??n de Google |
| `ADMIN_PASSWORD` | No | Solo la usa `scripts/crear-admin.mjs` |

La plantilla con todas las claves es `.env.example` (el `.env` real no se commitea).

Como las cookies son `httpOnly`, **todo fetch del panel tiene que ir con `credentials: 'include'`**, y el CORS no puede ser `*` (el navegador bloquea `Access-Control-Allow-Origin: *` con credenciales). Por eso existe `ALLOWED_ORIGINS`.

#### El login con Google tiene dos variables, no una

`VITE_GOOGLE_CLIENT_ID` es la que m??s confunde, porque **si falta no rompe nada: el bot??n
simplemente no aparece** (`BotonGoogle.tsx:6` lee la variable y, si viene vac??a, el
componente devuelve `null` antes de renderizar). No hay error en consola, no hay
advertencia, no hay nada en el panel: el login por email y contrase??a sigue andando
igual. Por eso es f??cil pasarla a??os sin verla.

Las tres cosas que tienen que coincidir:

1. **El mismo valor en los dos lados.** `GOOGLE_CLIENT_ID` (backend) y
   `VITE_GOOGLE_CLIENT_ID` (frontend) tienen que ser **exactamente el mismo string**. No
   "el mismo Client ID de la consola" ni "uno parecido": el mismo. El front le pide un
   token a Google para esa app y el backend compara el `aud` del token contra su valor
   (`auth.js`); si difieren, el token se rechaza con `Token emitido para otra aplicacion`
   y el login con Google falla aunque el bot??n se vea bien.
2. **El origen JS registrado en la consola de Google.** El bot??n usa Google Identity
   Services, que exige que el origen desde el que se ejecuta est?? en la lista de
   *Authorized JavaScript origins* del client ID. En desarrollo ese origen es
   `http://localhost:5173`; en producci??n, el dominio real del sitio. Si no est??, Google
   no renderiza el bot??n y el error aparece del lado de Google, no del nuestro.
3. **El prefijo `VITE_` implica build.** Las `VITE_*` se compilan dentro del bundle y son
   p??blicas. No hay forma de ponerla "en caliente": si la cambi??s, hay que rehacer
   `npm run build` y redesplegar. Editar `.env` sin reconstruir no cambia nada: el bot??n
   sigue igual hasta el pr??ximo build.

Y el detalle que hace ruido: **`GOOGLE_CLIENT_ID` vac??o no es un error, es una
desactivaci??n silenciosa del lado del servidor.** Si est?? vac??a, `auth.js` no compara el
`aud` y acepta cualquier token de Google bien formado. Nadie ve un cartel rojo en ning??n
lado. Si dejaste la variable sin setear, el backend est?? aceptando sesiones de Google de
cualquier aplicaci??n: no publiques esto en un entorno real.

### Endpoints del backoffice (cookie `gr_admin`)

| M??todo | Ruta | Qu?? hace |
|--------|------|----------|
| POST | `/api/admin/login` | `{ email, password }` ??? cookie de sesi??n |
| POST | `/api/admin/logout` | Borra la sesi??n y la cookie |
| GET | `/api/admin/yo` | Datos del admin logueado (`401` si no hay sesi??n) |
| POST | `/api/admin/heartbeat` | Renueva la actividad (lo llama el panel cada 15 s) |

### Endpoints de cuenta de cliente (cookie `gr_cliente`)

| M??todo | Ruta | Qu?? hace |
|--------|------|----------|
| POST | `/api/auth/registro` | Crea la cuenta (`nombre`, `email`, `password` de 8+ caracteres, `telefono` opcional) |
| POST | `/api/auth/login` | Login por email y contrase??a |
| POST | `/api/auth/google` | Login con Google (`id_token`): crea la cuenta o vincula la existente por email |
| POST | `/api/auth/logout` | Cierra la sesi??n del cliente |
| GET | `/api/auth/yo` | Datos del cliente logueado |
| GET / POST | `/api/direcciones` | Listar / crear direcciones de env??o |
| PUT / DELETE | `/api/direcciones/:id` | Editar / borrar una direcci??n propia |
| GET | `/api/favoritos` | Wishlist del cliente, con los datos de cada vinilo |
| GET | `/api/favoritos/:viniloId` | ??Este vinilo est?? en favoritos? |
| POST / DELETE | `/api/favoritos/:viniloId` | Agregar / quitar de favoritos |
| GET | `/api/mis-pedidos` | Historial de pedidos del cliente |

Todas las de cliente exigen sesi??n; sin cookie v??lida devuelven `401`.

La interfaz de la cuenta de cliente **ya est?? conectada**: vive en
`src/components/cuenta/` (`Acceso.tsx` con login y Google, `CuentaPanel.tsx` con las
pesta??as, `Direcciones.tsx`, `Favoritos.tsx` y `Pedidos.tsx`) y el estado compartido en
`src/lib/cuenta.ts`.

> ?????? **Lo que todav??a falta:** `direccion_id` no viaja al pedido y el pedido no guarda
> snapshot de env??o. `Direcciones.tsx` invita a tener una direcci??n cargada, pero hoy el
> pedido queda sin trazabilidad de a d??nde se manda.

### Endpoints de pedidos

| M??todo | Ruta | Qu?? hace |
|--------|------|----------|
| GET | `/api/pedidos` | Todos los pedidos (`requiereAdmin`) |
| POST | `/api/pedidos` | Crea el pedido. Calcula el total **contra la base** y valida/aplica el cup??n dentro de la transacci??n |
| PUT | `/api/pedidos/:id/cancelar` | Repone stock desde el snapshot de la fila y devuelve el uso del cup??n |
| PUT | `/api/pedidos/:id/finalizar` | `estado = 'finalizado'` |

### Endpoints de cupones (secci??n 4 de `server.js`)

| M??todo | Ruta | Qu?? hace |
|--------|------|----------|
| POST | `/api/cupones/validar` | **P??blica.** Devuelve solo `id`, `codigo`, `tipo` y `valor`. Rate limit de 60 fallos por IP cada 10 min (`429`; los ??xitos no consumen cuota) y un mismo `400` para inexistente / inactivo / vencido / agotado |
| GET | `/api/admin/cupones` | Listado del backoffice: activos primero y, dentro de ellos, los que vencen antes |
| POST | `/api/admin/cupones` | Crea un cup??n (`409` si el c??digo ya existe, `201` con la fila) |
| PUT | `/api/admin/cupones/:id` | **Edici??n parcial**: solo toca los campos que vienen, incluido `usos_actuales` |
| DELETE | `/api/admin/cupones/:id` | Lo borra (`404` si no existe) |

**El descuento nunca se calcula desde el navegador.** `POST /api/cupones/validar` es
solo la ayuda visual del carrito (adem??s no expone `uso_maximo` / `usos_actuales`, que
permitir??an sondear el cat??logo de cupones). El descuento real lo aplica
`POST /api/pedidos`: ignora el `total_pago` que manda el body, lee los precios y el
cup??n con `SELECT ... FOR UPDATE` dentro de la misma transacci??n que descuenta el stock
e incrementa `usos_actuales`, y solo eso guarda en `pedidos.total_pago`. Vencido y
agotado se resuelven con `CURDATE()` (fecha de MySQL), nunca con la del navegador.

La cancelaci??n es la contraparte: `PUT /api/pedidos/:id/cancelar` lee `estado`, `items`
y `cupon_id` de la fila con `FOR UPDATE`, **ignora los `items` del body** (si los usara
ser??a manipulable), devuelve el uso con `GREATEST(0, usos_actuales - 1)` y responde
`409` si el pedido ya estaba cancelado o si el estado no es `pendiente`.

Detalle completo en [docs/COUPONS.md](./docs/COUPONS.md).

---

## ??????? Migraciones

`npm run migrar` corre los archivos de `db/migrations/*.sql` en orden, los anota en la
tabla `migraciones` y no repite los ya aplicados. Todos son idempotentes (guards de
`information_schema` + `PREPARE`/`EXECUTE`, porque MySQL 8.0 no tiene
`ADD COLUMN IF NOT EXISTS`).

```bash
npm run migrar                    # aplica lo pendiente
node scripts/migrar.mjs --estado  # applied / pending
node scripts/migrar.mjs --dry-run # el plan, sin conectarse
node scripts/migrar.mjs --archivo 2026-09-29_pedidos_cupones.sql   # solo uno
```

Desde la PC, `mysql.railway.internal` no resuelve: `railway connect MySQL --ssh
--tunnel-only -P 33306` y apuntar `MYSQL_URL` a `127.0.0.1:33306`.

| Archivo | Qu?? hace |
|---------|----------|
| `2026-09-26_auth.sql` | `admin_usuarios`, `usuarios`, `sesiones`, `direcciones`, `favoritos`, `auditoria`; le agrega `usuario_id`, `actualizado_en` y `version` a `pedidos` |
| `2026-09-27_cupones.sql` | Crea la tabla `cupones` |
| `2026-09-28_cupones_schema.sql` | Corrige `cupones`: `activo` y `usos_actuales` a NOT NULL, suma `creado_en`, pasa `fecha_expiracion` de DATETIME a DATE |
| `2026-09-29_pedidos_cupones.sql` | Crea `pedidos` (si no existe) y le suma `cupon_id`, `cupon_codigo` y `descuento_aplicado` |

**Orden obligatorio: migraci??n antes que deploy.** `server.js` ya escribe esas columnas
y ya pide `creado_en`; sin la migraci??n el checkout se rompe.

**Base nueva desde cero:** `2026-09-26_auth.sql` hace `ALTER TABLE pedidos` sobre una
tabla que todav??a no existe y `npm run migrar` se detiene ah??. El orden limpio es
correr primero `node scripts/migrar.mjs --archivo 2026-09-29_pedidos_cupones.sql` y
despu??s `npm run migrar`.

### Los DDL viejos: no los ejecutes

En la ra??z y en `supabase/migrations/` hay dos archivos que **parecen** el esquema del
proyecto pero no lo son:

| Archivo | Por qu?? no sirve |
|---|---|
| `SCRIPT_MYSQL_BACKUP.sql` | Declara `pedidos` con `id`, `numero_pedido` y `cliente_id`, y una tabla `detalles_pedido`. El server usa `id_pedido`, `numero_orden`, `nombre_cliente` y guarda el detalle en un JSON |
| `supabase/migrations/20260228193834_create_guacamayo_schema.sql` | Lo mismo, y adem??s es PostgreSQL (`uuid`, `gen_random_uuid()`, pol??ticas RLS) contra una base que es MySQL |

Si los corr??s contra una base nueva, cre??s un esquema que el c??digo no reconoce: el
server falla con `ER_BAD_FIELD_ERROR` en el primer `SELECT`. Los dos archivos ahora lo
dicen en su encabezado, as?? que no es f??cil confundirse. Borrarlos del repo es decisi??n
de Kevin; mientras tanto siguen ah?? como registro.

---

## Funcionalidades Clave

### 1. B??squeda del cat??logo
**Ubicaci??n:** `components/Catalog.tsx`

El filtrado vive dentro de `Catalog.tsx`, en un `useState` de texto. Hoy es **solo
b??squeda por texto**, sobre `titulo` y `artista` (m??s un orden por `destacado`):

```typescript
const vinilosFiltrados = vinilos
  .filter(v =>
    v.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.artista.toLowerCase().includes(busqueda.toLowerCase())
  )
  .sort((a, b) => (b.destacado || 0) - (a.destacado || 0));
```

> ?????? **No hay filtro por g??nero ni por calidad.** `genero` y `calidad` se cargan y se
> muestran (en la tarjeta y en el panel) pero no se usan para filtrar. El panel de
> filtros con una lista cerrada de g??neros y de calidades que describ??a la documentaci??n
> vieja nunca estuvo conectado: era c??digo muerto y se borr??.

### 2. Conversi??n de Divisas
**Ubicaci??n:** `lib/currency.ts` (tasas y conversi??n) y `lib/cuenta.ts` (`importeUsd`)

Flujo:
1. Obtiene tasas de `configuracion_divisas`
2. Multiplica precio USD ?? tasa
3. Redondea a 2 decimales (ARS) o 4 (USDT)
4. Cachea por 1 minuto (`currency.ts` compara contra `60000` ms)

> Ojo: `currency.ts` tiene un fallback hardcodeado (DOLAR_BLUE 1250 / USDT 1200) que se
> usa **si la API todav??a no respondi??**, no si la tasa no existe. Si ves precios que no
> cambian, el problema casi siempre es la cach?? de 1 minuto, no el fallback.

Para **mostrar** un importe que viene de la base hay que usar `importeUsd()` de
`lib/cuenta.ts`: los `DECIMAL` los devuelve `mysql2` como texto (`"45.00"`), y sin esa
conversi??n se renderizan crudos.

### 3. Integraci??n WhatsApp
**Ubicaci??n:** `components/Cart.tsx` (el mensaje se arma inline, sin m??dulo aparte)

Cuando el cliente confirma, `Cart.tsx` arma el texto y abre la conversaci??n. El n??mero de
la tienda es la constante `telTienda`, en esa misma funci??n.

El mensaje lleva:
- N??mero de orden (`numero_orden` que devolvi?? `POST /api/pedidos`)
- Cliente, lista de discos, cup??n y descuento (si hubo)
- Total en ARS y la referencia en USD
- Link de WhatsApp con el mensaje pre-llenado

> El total del mensaje es **el que calcul?? el server**, no el que estaba en pantalla: el
> navegador puede mentir. Por eso se manda el que volvi?? del `POST /api/pedidos`.

```
URL: https://wa.me/<telTienda>?text=<mensaje codificado con encodeURIComponent>
```

### 4. Importador CSV
**Ubicaci??n:** `components/admin/BulkImporter.tsx`

Pasos:
1. Lee archivo CSV
2. Parsea l??neas
3. Valida columnas (requiere "codigo")
4. Genera vista previa
5. Actualiza registros en BD

**Seguridad:**
- Solo actualiza campos especificados
- No borra datos existentes
- Valida tipos de datos

### 5. Gestor de Tasas
**Ubicaci??n:** `components/admin/CurrencyManager.tsx`

- Obtiene tasas actuales
- Permite editar valores
- Guarda en BD
- Invalida cache

---

## Flujos de Usuario

### Flujo 1: Cliente compra un vinilo

```
1. Cliente ve cat??logo
   ???
2. Selecciona divisa (ARS/USD/USDT)
   ???
3. Busca por artista o t??tulo
   ???
4. Hace clic "Agregar al Carrito"
   ???
5. Ve carrito
   ???
6. Haz clic "Confirmar por WhatsApp"
   ???
7. Se abre WhatsApp con mensaje pre-llenado
   ???
8. Admin ve mensaje y confirma disponibilidad
```

### Flujo 2: Admin carga un vinilo

```
Opci??n A: Individual
1. Admin ??? Panel ??? "Nuevo Vinilo"
2. Completa formulario
3. Haz clic "Agregar Vinilo"
4. Aparece en cat??logo

Opci??n B: Masivo
1. Admin ??? Panel ??? "Importar CSV"
2. Prepara archivo CSV
3. Sube archivo
4. Verifica vista previa
5. Haz clic "Importar"
6. Se actualizan registros
```

### Flujo 3: Admin actualiza precios

```
1. D??lar blue sube a 1250
2. Admin ??? Panel ??? "Tasas de Cambio"
3. Edita "D??lar Blue" a 1250
4. Haz clic "Guardar"
5. Sistema invalida cache
6. Clientes ven precios nuevos al recargar
```

---

## Seguridad

### No hay RLS: el control de acceso est?? en la API

MySQL no tiene Row Level Security (era una funci??n de PostgreSQL/Supabase). **Todo lo que
se expone al navegador pasa por un handler de `server.js` o de `auth.js`**, y cada grupo
de rutas tiene su middleware:

| Grupo | Middleware | Qu?? logra |
|---|---|---|
| Cat??logo (`GET /api/vinilos`, `/api/configuracion_divisas`) | ninguno | Lectura p??blica, a prop??sito: es la tienda |
| Backoffice (`/api/admin/**`, escritura de cat??logo y tasas) | `requiereAdmin` | Sesi??n de backoffice (`gr_admin`) o `401` |
| Cuenta de cliente (`/api/auth/**`, `/api/direcciones`, `/api/favoritos`, `/api/mis-pedidos`) | `requiereCliente` | Sesi??n de cliente (`gr_cliente`) o `401` |
| `POST /api/pedidos` | `sesionClienteOpcional` | Acepta an??nimos, pero si hay sesi??n la usa |
| `POST /api/cupones/validar` | rate limit por IP | 60 fallos / 10 min; los ??xitos no consumen cuota |

Adem??s, los POST/PUT/DELETE del backoffice pasan por un gate CSRF que compara el `Origin`
con la lista de or??genes permitidos: una request de otra web se corta con `403`.

> Ojo con esto al tocar rutas nuevas: `GET` no pasa por el gate, `POST` s??. El patr??n
> siempre es el mismo ??? `app.post('/api/admin/x', requiereAdmin, gate, handler)`.

### Validaciones

- **Frontend:** Validaci??n b??sica en formularios
- **Backend:** Constraints SQL (UNIQUE, CHECK, FK) y validaci??n de tipos en cada handler
- **Auth:** Cookie de sesi??n `httpOnly` + hash `scrypt`; hace falta una sesi??n de backoffice para editar

---

## Performance

### Optimizaciones

1. **Indexaci??n:** las migraciones indexan `sesiones` (por token, tipo y expiraci??n),
   `usuarios` y `pedidos` (por `usuario_id`, `fecha`, `cupon_id`) y `cupones`
   (`activo`, `fecha_expiracion`). Sobre `inventario_vinilos` y `configuracion_divisas`
   no hay migraciones: esas tablas ya exist??an y el importador CSV resuelve los
   duplicados por `codigo` en la aplicaci??n, no con un ??ndice.

2. **Caching:**
   - Tasas de cambio cacheadas 1 minuto
   - Reduce queries redundantes

3. **Lazy Loading:**
   - **No est??.** Ning??n `<img>` del proyecto tiene `loading="lazy"`: el cat??logo trae
     todas las tarjetas y cada imagen carga su archivo. Es lo primero que se rompe si el
     cat??logo crece, y el arreglo es agregar el atributo en `VinylCard.tsx` y
     `ImageCarousel.tsx`

4. **Queries:**
   - `SELECT` con las columnas que se usan (no `*`) en los handlers nuevos
   - Los `DECIMAL` llegan como string: hay que pasarlos por `Number()` antes de operar,
     y por `importeUsd()` antes de mostrarlos

---

## Variables de Entorno

La lista completa est?? en **`.env.example`**, que es la plantilla sin valores reales. El
`.env` real no se commitea. En resumen:

```
MYSQL_URL=mysql://USUARIO:CLAVE@HOST:PUERTO/BASE   # la ??nica obligatoria
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
GOOGLE_CLIENT_ID=                                  # del servidor
GOOGLE_DOMINIOS=                                   # opcional
VITE_GOOGLE_CLIENT_ID=                             # del front: el MISMO valor
ADMIN_PASSWORD=                                    # solo scripts/crear-admin.mjs
```

Ojo con las `VITE_*`: se compilan dentro del bundle y son p??blicas, y solo toman efecto
al hacer build. Ver [El login con Google tiene dos variables, no una](#el-login-con-google-tiene-dos-variables-no-una).

El backend (Express) adem??s necesita `MYSQL_URL` y, opcionalmente, `ALLOWED_ORIGINS`, `GOOGLE_CLIENT_ID` y `GOOGLE_DOMINIOS` ??? ver la secci??n [Autenticaci??n y Cuentas](#-autenticaci??n-y-cuentas).

---

## Extensiones Futuras

Ideas para mejorar:

1. **Edici??n de vinilos:**
   - ~~Permitir admin editar registros existentes~~ (hecho: `PUT /api/vinilos/:id`)
   - Historial de cambios (la tabla `auditoria` existe y nadie escribe en ella)

2. **Gesti??n de ??rdenes:**
   - Dashboard de pedidos
   - Estados de env??o
   - Emails de confirmaci??n

3. **Autenticaci??n:**
   - ~~Login para admin~~ (hecho: email + contrase??a contra la BD)
   - Roles granulares
   - 2FA

4. **Reportes:**
   - Ventas por mes
   - Vinilos m??s populares
   - An??lisis de g??nero

5. **Integraciones:**
   - Sincronizaci??n con Instagram
   - MercadoLibre API
   - Pagar??/Stripe para pagos

---

## Notas T??cnicas

### Por qu?? Express y MariaDB

El backend pas?? de Supabase a Express + MariaDB. Lo que se gan?? y lo que se perdi??:

- ??? **Una sola API.** `server.js` (cat??logo, pedidos, cupones, backoffice) y `auth.js`
  (acceso) son el mismo Express, y en producci??n sirve tambi??n los est??ticos de `dist/`.
  La cookie de sesi??n viaja same-origin y no hay ni CORS ni `SameSite` que pelear.
- ??? **Transacciones de verdad.** El checkout necesita `SELECT ... FOR UPDATE` sobre el
  cup??n y el stock en la misma transacci??n: eso es trabajo de base relacional, no de una
  API REST autogenerada.
- ??? **Una sola fuente de verdad para el precio.** El server calcula el total contra la
  base, dentro de la transacci??n. Ver [docs/COUPONS.md](./docs/COUPONS.md).
- ?????? **A cambio, el control de acceso es c??digo, no configuraci??n.** No hay RLS: cada
  handler tiene que declarar su middleware. Un `GET` nuevo sin `requiereAdmin` expone
  datos. Vale la pena revisarlo en cada review.
- ?????? **Y hay que configurar el entorno a mano.** La plantilla es `.env.example`; nada se
  inyecta solo (salvo `MYSQL_URL` en Railway, si el plugin est?? instalado).

### Por qu?? Tailwind CSS?

- ??? R??pido de desarrollar
- ??? Responsive por defecto
- ??? Temas personalizables
- ??? Bundle peque??o
- ??? Sin overhead de componentes

### Por qu?? Vite?

- ??? Build 10x m??s r??pido que Webpack
- ??? HMR instant??neo
- ??? Menos configuraci??n
- ??? Mejor DX (developer experience)

---

## Troubleshooting T??cnico

**El server no arranca / `mysql.createPool(undefined)`**
- Falta `MYSQL_URL` en el `.env`. Es la ??nica variable obligatoria.

**`ER_NO_SUCH_TABLE` o `ER_BAD_FIELD_ERROR` en pedidos o cupones**
- Falt?? correr una migraci??n. `npm run migrar` y revis??
  `node scripts/migrar.mjs --estado`. El detalle por migraci??n est?? en
  [docs/COUPONS.md](./docs/COUPONS.md).

**El login del panel falla pero la contrase??a es correcta**
- La sesi??n es ??nica: si el mismo admin tuvo actividad en los ??ltimos 60 s, el login
  devuelve `423`. Esper?? un minuto.
- 5 intentos fallidos bloquean 15 minutos (`429`).

**El bot??n de Google no aparece**
- Falta `VITE_GOOGLE_CLIENT_ID`, y su ausencia **no tira ning??n error**: el componente
  devuelve `null`. Ver [El login con Google tiene dos variables, no una](#el-login-con-google-tiene-dos-variables-no-una).

**`Token emitido para otra aplicacion`**
- `GOOGLE_CLIENT_ID` y `VITE_GOOGLE_CLIENT_ID` no coinciden.

**El login con Google se rechaza del lado de Google**
- El origen JS (`http://localhost:5173` en dev) no est?? en los *Authorized JavaScript
  origins* del client ID.

**Se ve `$45.00` en vez de `$ 45,00`**
- Son los `DECIMAL`: `mysql2` los devuelve como texto. Us?? `importeUsd()` de
  `lib/cuenta.ts`.

**Im??genes no cargan:**
- Verifica que URL sea HTTPS
- Verifica CORS del servidor de im??genes

---

**Versi??n:** 1.0
**??ltima actualizaci??n:** 2026-02-28
**Mantenedor:** Desarrollo
