# Arquitectura Técnica - GuacamayoRecords

## Stack Tecnológico

- **Frontend:** React 18 + TypeScript
- **Backend:** Node + Express 5 (`server.js` para catálogo, pedidos, cupones y backoffice; `auth.js` para el acceso)
- **Base de Datos:** MariaDB / MySQL (pool `mysql2`), Railway
- **Styling:** Tailwind CSS
- **Build:** Vite
- **Icons:** Lucide React
- **API Cliente:** `fetch` contra el Express. En producción es el mismo origen (el Express sirve `dist/` y `/api`); en local el front es Vite (5173) y la API 3001, y ahí va con `credentials: 'include'`

---

## Estructura de Directorios

```
src/
├── components/
│   ├── Catalog.tsx           # Página principal de catálogo (y la búsqueda por texto)
│   ├── Cart.tsx              # Carrito de compras (arma el mensaje de WhatsApp)
│   ├── VinylCard.tsx         # Tarjeta de vinilo (con carrusel de fotos)
│   ├── CurrencySelector.tsx  # Selector de divisas
│   ├── AdminLogin.tsx        # Login del panel
│   ├── AdminPanel.tsx        # Panel de administración
│   ├── ImageCarousel.tsx     # Carrusel de imágenes del vinilo
│   ├── cuenta/               # Cuenta de cliente: Acceso, CuentaPanel, Direcciones,
│   │                         #   Favoritos, Pedidos, BotonGoogle, CuentaProvider, ui
│   └── admin/
│       ├── VinylForm.tsx     # Formulario para nuevo vinilo
│       ├── BulkImporter.tsx  # Importador de CSV
│       └── CurrencyManager.tsx # Gestor de tasas
├── lib/
│   ├── api.ts                # URL base de la API (relativa en producción)
│   ├── currency.ts           # Tasas y conversión
│   ├── cuenta.ts             # Estado, tipos y formato de la cuenta de cliente
│   └── cupon.ts              # Estado del cupón del carrito (localStorage + re-validación)
├── types/
│   └── database.ts           # Tipos TypeScript
├── App.tsx                   # Componente principal
├── main.tsx                  # Entrada
└── index.css                 # Estilos globales
```

Raíz del proyecto:
```
.env.example                    # Plantilla de variables (sin valores reales)
auth.js                       # Autenticación: scrypt, sesiones, /api/admin y /api/auth
server.js                     # API Express: catálogo, pedidos, cupones y rutas del backoffice
db/migrations/                # EL ESQUEMA REAL. Fuente de verdad del modelo de datos.
├── 2026-09-26_auth.sql       # Cuentas, sesiones, favoritos y auditoría
├── 2026-09-27_cupones.sql    # Tabla `cupones`
├── 2026-09-28_cupones_schema.sql  # Corrección del esquema de `cupones`
├── 2026-09-29_pedidos_cupones.sql # Tabla `pedidos` + columnas del cupón
└── 2026-09-30_pedidos_direccion.sql # Dirección y snapshot de envío en `pedidos`
docs/
├── COUPONS.md                # Cupones: reglas, rutas, cancelación y troubleshooting
├── PLUMAS.md                 # Ledger, ajustes y contrato de recompensas
└── ACCOUNT_RECOVERY.md       # Recuperación por email con Resend
scripts/
├── crear-admin.mjs           # Alta/edición de usuarios del backoffice
└── migrar.mjs                # Corre los .sql pendientes y anota el historial
```

Y dos archivos que **no** son fuente de verdad, y que están solo por historial:

```
SCRIPT_MYSQL_BACKUP.sql       # ⚠️ HISTÓRICO. DDL viejo: columnas que el server no
                              #   reconoce (id/numero_pedido/cliente_id). NO ejecutar.
supabase/migrations/
└── 20260228193834_create_guacamayo_schema.sql
                              # ⚠️ HISTÓRICO. DDL de PostgreSQL, mismo problema.
```

Para una base nueva, el único camino es `npm run migrar` sobre `db/migrations/`, con el
orden y las salvedades que están en [Migraciones](#migraciones). Ninguno de los dos
archivos de arriba reproduce el esquema que usa el código.

---

## Base de Datos - Schema

### Tabla: `inventario_vinilos`
Almacena el catálogo completo.

> **Ninguna migración de `db/migrations/` la crea.** Esta tabla y `configuracion_divisas`
> ya existían cuando el backend pasó a Express, así que el esquema que se ve acá **no es
> reproducible desde cero**: hay que crearlas a mano en una base nueva. Es la parte del
> modelo de datos que las migraciones todavía no cubren.

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
pais_origen (VARCHAR) NULL         -- etiqueta de país en la tarjeta (UK, USA, ARG)
destacado (INT)                   -- 1 = sube arriba; PUT /api/vinilos/:id/destacado
version (INT) NOT NULL DEFAULT 1  -- lo agrega 2026-09-26_auth.sql (concurrencia)
created_at, updated_at
```

`pais_origen` y `destacado` los usa el código (`VinylCard.tsx`, `Cart.tsx`,
`AdminPanel.tsx`, `PUT /api/vinilos/:id/destacado`) pero **no están en ninguna
migración**: son columnas heredadas de la tabla original. Si se reconstruye la base desde
cero, hay que crearlas también, o el catálogo y el carrito se rompen.

### Tabla: `configuracion_divisas`
Tasas de cambio actualizables.

```sql
id (CHAR(36) o INT) PRIMARY KEY
tipo (VARCHAR) UNIQUE            -- DOLAR_BLUE, USDT
tasa (DECIMAL)                   -- Valor de la tasa
ultima_actualizacion (TIMESTAMP) -- Cuándo cambió
updated_by (VARCHAR) NULL        -- Quién la cambió
```

La fuente automática es el par **Binance USDTARS**. El valor validado de esa cotización
se guarda deliberadamente en `DOLAR_BLUE` y en `USDT` con el mismo importe: el valor de
Binance USDTARS es la referencia operativa para ambas tasas por decisión del usuario.
No se intenta inferir una cotización separada para cada tipo.

### Tabla: `clientes` — no existe
No hay una tabla de compradores. El nombre viene del DDL histórico
(`SCRIPT_MYSQL_BACKUP.sql` y `supabase/migrations/`); ninguna migración de
`db/migrations/` la crea y ningún handler la lee.

Los datos del comprador viven repartidos:

| Dónde | Qué guarda |
|-------|-----------|
| `pedidos.nombre_cliente` | Nombre que escribe en el checkout |
| `pedidos.whatsapp_cliente` | Su número, si lo completó |
| `usuarios` | Cuenta, solo si se registró (email, Google, etc.) |

Los que no se registran quedan solo en el pedido: no hay forma de volver a contactarlos
ni de ver "todos los que me compraron X".

### Tabla: `pedidos`
Órdenes de compra. El esquema canónico es el de `db/migrations/2026-09-29_pedidos_cupones.sql` (el que lee y escribe `server.js`); los nombres del esquema heredado (`id`, `numero_pedido`, `cliente_id`, `precio_total_*`) **no existen** en la base real.

```sql
id_pedido (INT) PRIMARY KEY    -- el :id de /api/pedidos/:id/cancelar y /finalizar
numero_orden (VARCHAR) UNIQUE  -- 'GR-####', lo genera el servidor
nombre_cliente (VARCHAR) NULL
whatsapp_cliente (VARCHAR) NULL
total_pago (DECIMAL)           -- SIEMPRE en USD, y lo calcula el server
divisa_preferida (VARCHAR) NULL -- la conversión la muestra el frontend
estado (VARCHAR)               -- 'pendiente' | 'finalizado' | 'cancelado'
fecha (DATETIME)               -- la pone NOW()
items (LONGTEXT)               -- snapshot en JSON: id, cantidad, titulo, precio_unitario
usuario_id (INT) NULL          -- el cliente logueado que compró, si hubo
cupon_id (INT) NULL            -- qué cupón se gastó (lo usa /cancelar)
cupon_codigo (VARCHAR) NULL    -- copia del código al momento de la compra
descuento_aplicado (DECIMAL)   -- cuánto se descontó DE VERDAD (subtotal - total)
direccion_id (INT) NULL         -- dirección elegida por la cuenta, si hubo
direccion_apodo (VARCHAR) NULL  -- snapshot de la dirección al comprar
direccion (VARCHAR) NULL
direccion_ciudad (VARCHAR) NULL
direccion_provincia (VARCHAR) NULL
direccion_codigo_postal (VARCHAR) NULL
```

`items` es un snapshot a propósito: si después se renombra el vinilo o se le cambia el
precio, el pedido ya cobrado no se toca. Es también de donde `PUT
/api/pedidos/:id/cancelar` lee los ids y las cantidades para reponer el stock, y por
eso tiene que seguir siendo un JSON legible. **No hay tabla de líneas de pedido**: todo
el detalle vive en ese JSON.

### Tabla: `cupones`
Códigos de descuento del carrito (`db/migrations/2026-09-27_cupones.sql`, corregida por
`2026-09-28_cupones_schema.sql`).

```sql
id (INT) PRIMARY KEY
codigo (VARCHAR) UNIQUE        -- MAYÚSCULAS, sin espacios, solo [A-Z0-9_-]
tipo (ENUM)                    -- 'porcentaje' | 'fijo'
valor (DECIMAL)                -- % del subtotal, o USD si es 'fijo'
fecha_expiracion (DATE) NULL   -- NULL = no vence
activo (TINYINT) NOT NULL      -- 0 = el panel lo muestra, el carrito lo rechaza
uso_maximo (INT) NULL          -- NULL = ilimitado
usos_actuales (INT) NOT NULL   -- lo mueve POST /api/pedidos; admin puede editarlo/resetearlo
creado_en (DATETIME)
```

`valor` es DECIMAL: **mysql2 lo devuelve como string** (`"20.00"`), no como número.

### Recompensas Plumas

Plumas usa un ledger inmutable por usuario, con consumos FIFO para poder revertir
canjes. El valor canónico es `1 Pluma = USD 0,01`; la acreditación es el 5% del
subtotal neto en unidades enteras (`floor(subtotal_neto_usd * 100 * 0,05)`), solo
para usuarios registrados cuando el pedido pasa a `finalizado`. No se premian
cupones, Plumas usadas ni pedidos cancelados. El canje tiene un límite del 50%
del subtotal neto y los movimientos positivos caducan a los 12 meses.

El contrato previsto es `GET /api/admin/recompensas/ledger` y
`POST /api/admin/recompensas/ajustes`, además de los endpoints de cuenta,
cotización y reembolso descritos en [docs/PLUMAS.md](./docs/PLUMAS.md). Un ajuste
recibe unidades con signo, usuario, pedido opcional, motivo obligatorio y una
clave de idempotencia; nunca recibe un saldo final. El backend debe bloquear las
filas, validar saldo/vigencia/límites y escribir la auditoría dentro de la misma
transacción. La cancelación enlaza y revierte los movimientos una sola vez.

`GET /api/pedidos` puede incluir `recompensas_ganadas` y
`recompensas_usadas`; el panel los muestra solo si vienen en la respuesta. La
vista admin de esta entrega es compatible con el estado actual y muestra `404` o
`405` si el backend aún no implementó el contrato. No hay migración ni endpoint
de Plumas publicado en este cambio.


### Tabla: `detalles_pedido` — no existe
No hay líneas de pedido normalizadas. Cada item va dentro del JSON `pedidos.items`
(ver `pedidos` arriba), así que no se puede reportar por vinilo: no hay forma de
saber "cuántos se vendieron de este disco" sin recorrer los pedidos en la aplicación.

El nombre viene del DDL histórico (`SCRIPT_MYSQL_BACKUP.sql` y
`supabase/migrations/`), que sí declaraba esa tabla junto con `clientes`. Ninguna
migración de `db/migrations/` las crea y ningún handler las lee.

---

## 🔐 Autenticación y Cuentas

Toda la lógica de acceso vive en `auth.js` (Express + `node:crypto`, sin dependencias extra). Se monta desde `server.js` con `app.use('/api', crearAuthRouter(db))`.

**Cómo funciona:**
- **Contraseñas:** hash `scrypt` (N=16384, r=8, p=1) con formato `scrypt$N$r$p$salt$hash`; la verificación usa `timingSafeEqual`.
- **Sesiones:** token opaco de 32 bytes en cookie `httpOnly` + `SameSite=Lax` (+ `Secure` en producción). En la tabla `sesiones` queda **solo el SHA-256** del token: si filtran la base, no se pueden suplantar sesiones.
- **Cookies:** `gr_admin` (backoffice, 12 h) y `gr_cliente` (clientes, 30 días).
- **Sesión única (backoffice):** si el mismo admin tuvo actividad en los últimos 60 s, el login responde `423`. El panel llama `POST /api/admin/heartbeat` cada 15 s para renovar esa actividad.
- **Rate limit:** 5 intentos fallidos por `email|ip` → bloqueo de 15 minutos (`429`).
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
`pedidos`. Las cuatro siguientes crean o corrigen `cupones`, `pedidos` y la dirección de
envío. Ninguna inserta datos.

**2. Crear el usuario del backoffice** (la contraseña no se escribe en ningún archivo):

```bash
$env:ADMIN_PASSWORD='mi-clave'; node scripts/crear-admin.mjs --email admin@guacamayorecords.com --nombre "Guacamayo"
```

También acepta `--password 'mi-clave'`, y los opcionales `--rol admin|editor` y `--activo 0`. Mínimo 8 caracteres. Lee `MYSQL_URL` del entorno o del `.env`.

**Resetear la contraseña** es el mismo comando: si el email ya existe, el script actualiza el hash e imprime `Actualizado: ...`.

**3. Entrar al panel** con **email + contraseña** (ya no hay una contraseña única en el código).

### Variables de entorno

| Variable | Obligatoria | Para qué |
|----------|-------------|----------|
| `MYSQL_URL` | Sí | Conexión a MySQL (la usan el server y el script) |
| `ALLOWED_ORIGINS` | No | Orígenes CORS separados por coma. Por defecto ya incluye `localhost:5173`, `localhost:3000`, `localhost:3001`, `guacamayorecords.up.railway.app`, `guacamayorecords.com` y `www.guacamayorecords.com` |
| `GOOGLE_CLIENT_ID` | No | Solo login con Google: valida que el `id_token` venga de esa app |
| `GOOGLE_DOMINIOS` | No | Solo login con Google: restringe el login a ciertos dominios (ej: `midominio.com,otro.com`) |
| `VITE_GOOGLE_CLIENT_ID` | No | **El mismo valor** que `GOOGLE_CLIENT_ID`, del lado del front. Sin él no se renderiza el botón de Google |
| `ADMIN_PASSWORD` | No | Solo la usa `scripts/crear-admin.mjs` |
| `RESEND_API_KEY` | No | Credencial privada del backend para enviar recuperación por email |
| `MAIL_FROM` | No | Remitente de recuperación; debe pertenecer a un dominio verificado en Resend |
| `PUBLIC_APP_URL` | No | URL HTTPS pública usada para construir el enlace de recuperación |

La plantilla con todas las claves es `.env.example` (el `.env` real no se commitea).

### Recuperación de contraseña por email

El flujo de recuperación usa Resend únicamente desde el backend. La solicitud no confirma
si un email existe: responde igual para evitar enumeración de cuentas. Para una cuenta
válida se genera un token aleatorio, se guarda solo su hash y se envía un enlace basado en
`PUBLIC_APP_URL`. El token vence a los **30 minutos** y se invalida al consumirse, por lo
que es de un solo uso. No se debe escribir el token completo en logs.

`RESEND_API_KEY` es secreto server-side y nunca puede llegar al bundle `VITE_*`.
`MAIL_FROM` debe usar una dirección de un dominio verificado en Resend, con SPF/DKIM
configurados y DMARC según la política del dominio. `PUBLIC_APP_URL` debe ser el origen
HTTPS real de la aplicación, no una URL de preview. El procedimiento completo está en
[docs/ACCOUNT_RECOVERY.md](./docs/ACCOUNT_RECOVERY.md).

Como las cookies son `httpOnly`, **todo fetch del panel tiene que ir con `credentials: 'include'`**, y el CORS no puede ser `*` (el navegador bloquea `Access-Control-Allow-Origin: *` con credenciales). Por eso existe `ALLOWED_ORIGINS`.

#### El login con Google tiene dos variables, no una

`VITE_GOOGLE_CLIENT_ID` es la que más confunde, porque **si falta no rompe nada: el botón
simplemente no aparece** (`BotonGoogle.tsx:6` lee la variable y, si viene vacía, el
componente devuelve `null` antes de renderizar). No hay error en consola, no hay
advertencia, no hay nada en el panel: el login por email y contraseña sigue andando
igual. Por eso es fácil pasarla años sin verla.

Las tres cosas que tienen que coincidir:

1. **El mismo valor en los dos lados.** `GOOGLE_CLIENT_ID` (backend) y
   `VITE_GOOGLE_CLIENT_ID` (frontend) tienen que ser **exactamente el mismo string**. No
   "el mismo Client ID de la consola" ni "uno parecido": el mismo. El front le pide un
   token a Google para esa app y el backend compara el `aud` del token contra su valor
   (`auth.js`); si difieren, el token se rechaza con `Token emitido para otra aplicacion`
   y el login con Google falla aunque el botón se vea bien.
2. **El origen JS registrado en la consola de Google.** El botón usa Google Identity
   Services, que exige que el origen desde el que se ejecuta esté en la lista de
   *Authorized JavaScript origins* del client ID. En desarrollo ese origen es
   `http://localhost:5173`; en producción, el dominio real del sitio. Si no está, Google
   no renderiza el botón y el error aparece del lado de Google, no del nuestro.
3. **El prefijo `VITE_` implica build.** Las `VITE_*` se compilan dentro del bundle y son
   públicas. No hay forma de ponerla "en caliente": si la cambiás, hay que rehacer
   `npm run build` y redesplegar. Editar `.env` sin reconstruir no cambia nada: el botón
   sigue igual hasta el próximo build.

Y el detalle que hace ruido: **`GOOGLE_CLIENT_ID` vacío no es un error, es una
desactivación silenciosa del lado del servidor.** Si está vacía, `auth.js` no compara el
`aud` y acepta cualquier token de Google bien formado. Nadie ve un cartel rojo en ningún
lado. Si dejaste la variable sin setear, el backend está aceptando sesiones de Google de
cualquier aplicación: no publiques esto en un entorno real.

### Endpoints del backoffice (cookie `gr_admin`)

| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/api/admin/login` | `{ email, password }` → cookie de sesión |
| POST | `/api/admin/logout` | Borra la sesión y la cookie |
| GET | `/api/admin/yo` | Datos del admin logueado (`401` si no hay sesión) |
| POST | `/api/admin/heartbeat` | Renueva la actividad (lo llama el panel cada 15 s) |

### Endpoints de cuenta de cliente (cookie `gr_cliente`)

| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/api/auth/registro` | Crea la cuenta (`nombre`, `email`, `password` de 8+ caracteres, `telefono` opcional) |
| POST | `/api/auth/login` | Login por email y contraseña |
| POST | `/api/auth/google` | Login con Google (`id_token`): crea la cuenta o vincula la existente por email |
| POST | `/api/auth/logout` | Cierra la sesión del cliente |
| GET | `/api/auth/yo` | Datos del cliente logueado |
| GET / POST | `/api/direcciones` | Listar / crear direcciones de envío |
| PUT / DELETE | `/api/direcciones/:id` | Editar / borrar una dirección propia |
| GET | `/api/favoritos` | Wishlist del cliente, con los datos de cada vinilo |
| GET | `/api/favoritos/:viniloId` | ¿Este vinilo está en favoritos? |
| POST / DELETE | `/api/favoritos/:viniloId` | Agregar / quitar de favoritos |
| GET | `/api/mis-pedidos` | Historial de pedidos del cliente |

Todas las de cliente exigen sesión; sin cookie válida devuelven `401`.

La interfaz de la cuenta de cliente **ya está conectada**: vive en
`src/components/cuenta/` (`Acceso.tsx` con login y Google, `CuentaPanel.tsx` con las
pestañas, `Direcciones.tsx`, `Favoritos.tsx` y `Pedidos.tsx`) y el estado compartido en
`src/lib/cuenta.ts`.

El checkout autenticado también permite seleccionar una dirección. `server.js` verifica que
la dirección pertenezca al usuario, la bloquea dentro de la transacción y copia sus campos a
`pedidos`; por eso editar o borrar luego la dirección no altera la trazabilidad del pedido.

### Endpoints de pedidos

| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/api/pedidos` | Todos los pedidos (`requiereAdmin`) |
| POST | `/api/pedidos` | Crea el pedido. Calcula el total **contra la base** y valida/aplica el cupón dentro de la transacción |
| PUT | `/api/pedidos/:id/cancelar` | Repone stock desde el snapshot de la fila y devuelve el uso del cupón |
| PUT | `/api/pedidos/:id/finalizar` | `estado = 'finalizado'` |

### Endpoints de cupones (sección 4 de `server.js`)

| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/api/cupones/validar` | **Pública.** Devuelve solo `id`, `codigo`, `tipo` y `valor`. Rate limit de 60 fallos por IP cada 10 min (`429`; los éxitos no consumen cuota) y un mismo `400` para inexistente / inactivo / vencido / agotado |
| GET | `/api/admin/cupones` | Listado del backoffice: activos primero y, dentro de ellos, los que vencen antes |
| POST | `/api/admin/cupones` | Crea un cupón (`409` si el código ya existe, `201` con la fila) |
| PUT | `/api/admin/cupones/:id` | **Edición parcial**: solo toca los campos que vienen, incluido `usos_actuales` |
| DELETE | `/api/admin/cupones/:id` | Lo borra (`404` si no existe) |

**El descuento nunca se calcula desde el navegador.** `POST /api/cupones/validar` es
solo la ayuda visual del carrito (además no expone `uso_maximo` / `usos_actuales`, que
permitirían sondear el catálogo de cupones). El descuento real lo aplica
`POST /api/pedidos`: ignora el `total_pago` que manda el body, lee los precios y el
cupón con `SELECT ... FOR UPDATE` dentro de la misma transacción que descuenta el stock
e incrementa `usos_actuales`, y solo eso guarda en `pedidos.total_pago`. Vencido y
agotado se resuelven con `CURDATE()` (fecha de MySQL), nunca con la del navegador.

La cancelación es la contraparte: `PUT /api/pedidos/:id/cancelar` lee `estado`, `items`
y `cupon_id` de la fila con `FOR UPDATE`, **ignora los `items` del body** (si los usara
sería manipulable), devuelve el uso con `GREATEST(0, usos_actuales - 1)` y responde
`409` si el pedido ya estaba cancelado o si el estado no es `pendiente`.

Detalle completo en [docs/COUPONS.md](./docs/COUPONS.md).

---

## 🗄️ Migraciones

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

| Archivo | Qué hace |
|---------|----------|
| `2026-09-26_auth.sql` | `admin_usuarios`, `usuarios`, `sesiones`, `direcciones`, `favoritos`, `auditoria`; le agrega `usuario_id`, `actualizado_en` y `version` a `pedidos` |
| `2026-09-27_cupones.sql` | Crea la tabla `cupones` |
| `2026-09-28_cupones_schema.sql` | Corrige `cupones`: `activo` y `usos_actuales` a NOT NULL, suma `creado_en`, pasa `fecha_expiracion` de DATETIME a DATE |
| `2026-09-29_pedidos_cupones.sql` | Crea `pedidos` (si no existe), garantiza los tres estados del flujo y suma `cupon_id`, `cupon_codigo` y `descuento_aplicado` |
| `2026-09-30_pedidos_direccion.sql` | Agrega `direccion_id`, snapshot de envío, índice y FK opcional |

**Orden obligatorio: migración antes que deploy.** `server.js` ya escribe esas columnas
y ya pide `creado_en`; sin la migración el checkout se rompe.

**Base nueva desde cero:** `2026-09-26_auth.sql` hace `ALTER TABLE pedidos` sobre una
tabla que todavía no existe y `npm run migrar` se detiene ahí. El orden limpio es
correr primero `node scripts/migrar.mjs --archivo 2026-09-29_pedidos_cupones.sql` y
después `npm run migrar`.

### Los DDL viejos: no los ejecutes

En la raíz y en `supabase/migrations/` hay dos archivos que **parecen** el esquema del
proyecto pero no lo son:

| Archivo | Por qué no sirve |
|---|---|
| `SCRIPT_MYSQL_BACKUP.sql` | Declara `pedidos` con `id`, `numero_pedido` y `cliente_id`, y una tabla `detalles_pedido`. El server usa `id_pedido`, `numero_orden`, `nombre_cliente` y guarda el detalle en un JSON |
| `supabase/migrations/20260228193834_create_guacamayo_schema.sql` | Lo mismo, y además es PostgreSQL (`uuid`, `gen_random_uuid()`, políticas RLS) contra una base que es MySQL |

Si los corrés contra una base nueva, creás un esquema que el código no reconoce: el
server falla con `ER_BAD_FIELD_ERROR` en el primer `SELECT`. Los dos archivos ahora lo
dicen en su encabezado, así que no es fácil confundirse. Borrarlos del repo es decisión
de Kevin; mientras tanto siguen ahí como registro.

---

## Funcionalidades Clave

### 1. Búsqueda del catálogo
**Ubicación:** `components/Catalog.tsx`

El filtrado vive dentro de `Catalog.tsx`, en un `useState` de texto. Hoy es **solo
búsqueda por texto**, sobre `titulo` y `artista` (más un orden por `destacado`):

```typescript
const vinilosFiltrados = vinilos
  .filter(v =>
    v.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.artista.toLowerCase().includes(busqueda.toLowerCase())
  )
  .sort((a, b) => (b.destacado || 0) - (a.destacado || 0));
```

> ⚠️ **No hay filtro por género ni por calidad.** `genero` y `calidad` se cargan y se
> muestran (en la tarjeta y en el panel) pero no se usan para filtrar. El panel de
> filtros con una lista cerrada de géneros y de calidades que describía la documentación
> vieja nunca estuvo conectado: era código muerto y se borró.

### 2. Conversión de Divisas
**Ubicación:** `lib/currency.ts` (tasas y conversión) y `lib/cuenta.ts` (`importeUsd`)

Flujo:
1. Obtiene tasas de `configuracion_divisas`
2. Multiplica precio USD × tasa
3. Redondea a 2 decimales (ARS) o 4 (USDT)
4. Cachea por 1 minuto (`currency.ts` compara contra `60000` ms)

> Ojo: `currency.ts` tiene un fallback hardcodeado (DOLAR_BLUE 1250 / USDT 1200) que se
> usa **si la API todavía no respondió**, no si la tasa no existe. Si ves precios que no
> cambian, el problema casi siempre es la caché de 1 minuto, no el fallback.

Para **mostrar** un importe que viene de la base hay que usar `importeUsd()` de
`lib/cuenta.ts`: los `DECIMAL` los devuelve `mysql2` como texto (`"45.00"`), y sin esa
conversión se renderizan crudos.

### 3. Integración WhatsApp
**Ubicación:** `components/Cart.tsx` (el mensaje se arma inline, sin módulo aparte)

Cuando el cliente confirma, `Cart.tsx` arma el texto y abre la conversación. El número de
la tienda es la constante `telTienda`, en esa misma función.

El mensaje lleva:
- Número de orden (`numero_orden` que devolvió `POST /api/pedidos`)
- Cliente, lista de discos, cupón y descuento (si hubo)
- Total en ARS y la referencia en USD
- Link de WhatsApp con el mensaje pre-llenado

> El total del mensaje es **el que calculó el server**, no el que estaba en pantalla: el
> navegador puede mentir. Por eso se manda el que volvió del `POST /api/pedidos`.

```
URL: https://wa.me/<telTienda>?text=<mensaje codificado con encodeURIComponent>
```

### 4. Importador CSV
**Ubicación:** `components/admin/BulkImporter.tsx`

Pasos:
1. Lee archivo CSV
2. Parsea líneas
3. Valida columnas (requiere "codigo")
4. Genera vista previa
5. Actualiza registros en BD

**Seguridad:**
- Solo actualiza campos especificados
- No borra datos existentes
- Valida tipos de datos

### 5. Gestor de Tasas
**Ubicación:** `components/admin/CurrencyManager.tsx`

- Obtiene tasas actuales
- Permite editar valores
- Guarda en BD
- Invalida cache

Además del guardado manual, el backend sincroniza Binance USDTARS dos veces por día. El
horario y la zona horaria pueden parametrizarse mediante `BINANCE_SYNC_HOURS` y
`BINANCE_SYNC_TIMEZONE` cuando esas variables están definidas; si no existen, se usa la
configuración predeterminada del servicio. El botón de sincronización manual del panel
ejecuta el mismo flujo sin esperar al próximo horario.

Antes de persistir, el resultado de Binance se valida como número finito y positivo. Una
respuesta ausente, malformada o fuera de rango no pisa la base: se conserva el último valor
válido y se informa el fallo. Una sincronización exitosa actualiza ambas filas con el
mismo valor. La columna `configuracion_divisas.ultima_actualizacion`, visible en la
pestaña **Tasas de Cambio**, permite comprobar cuándo se actualizó cada fila y detectar
si la última ejecución fue automática o manual junto con el registro operativo del
servicio.

---

## Flujos de Usuario

### Flujo 1: Cliente compra un vinilo

```
1. Cliente ve catálogo
   ↓
2. Selecciona divisa (ARS/USD/USDT)
   ↓
3. Busca por artista o título
   ↓
4. Hace clic "Agregar al Carrito"
   ↓
5. Ve carrito
   ↓
6. Haz clic "Confirmar por WhatsApp"
   ↓
7. Se abre WhatsApp con mensaje pre-llenado
   ↓
8. Admin ve mensaje y confirma disponibilidad
```

### Flujo 2: Admin carga un vinilo

```
Opción A: Individual
1. Admin → Panel → "Nuevo Vinilo"
2. Completa formulario
3. Haz clic "Agregar Vinilo"
4. Aparece en catálogo

Opción B: Masivo
1. Admin → Panel → "Importar CSV"
2. Prepara archivo CSV
3. Sube archivo
4. Verifica vista previa
5. Haz clic "Importar"
6. Se actualizan registros
```

### Flujo 3: Admin actualiza precios

```
1. La sincronización programada o manual consulta Binance USDTARS
2. El sistema valida el valor recibido
3. Guarda el mismo valor en DOLAR_BLUE y USDT
4. Sistema invalida cache
5. Clientes ven precios nuevos al recargar
```

Si la cotización falla la validación o Binance no está disponible, el flujo conserva las
tasas anteriores. El admin puede corregirlas desde **Tasas de Cambio** editando el valor
y guardándolo manualmente.

---

## Seguridad

### No hay RLS: el control de acceso está en la API

MySQL no tiene Row Level Security (era una función de PostgreSQL/Supabase). **Todo lo que
se expone al navegador pasa por un handler de `server.js` o de `auth.js`**, y cada grupo
de rutas tiene su middleware:

| Grupo | Middleware | Qué logra |
|---|---|---|
| Catálogo (`GET /api/vinilos`, `/api/configuracion_divisas`) | ninguno | Lectura pública, a propósito: es la tienda |
| Backoffice (`/api/admin/**`, escritura de catálogo y tasas) | `requiereAdmin` | Sesión de backoffice (`gr_admin`) o `401` |
| Cuenta de cliente (`/api/auth/**`, `/api/direcciones`, `/api/favoritos`, `/api/mis-pedidos`) | `requiereCliente` | Sesión de cliente (`gr_cliente`) o `401` |
| `POST /api/pedidos` | `sesionClienteOpcional` | Acepta anónimos, pero si hay sesión la usa |
| `POST /api/cupones/validar` | rate limit por IP | 60 fallos / 10 min; los éxitos no consumen cuota |

Además, los POST/PUT/DELETE del backoffice pasan por un gate CSRF que compara el `Origin`
con la lista de orígenes permitidos: una request de otra web se corta con `403`.

> Ojo con esto al tocar rutas nuevas: `GET` no pasa por el gate, `POST` sí. El patrón
> siempre es el mismo — `app.post('/api/admin/x', requiereAdmin, gate, handler)`.

### Validaciones

- **Frontend:** Validación básica en formularios
- **Backend:** Constraints SQL (UNIQUE, CHECK, FK) y validación de tipos en cada handler
- **Auth:** Cookie de sesión `httpOnly` + hash `scrypt`; hace falta una sesión de backoffice para editar

---

## Performance

### Optimizaciones

1. **Indexación:** las migraciones indexan `sesiones` (por token, tipo y expiración),
   `usuarios` y `pedidos` (por `usuario_id`, `fecha`, `cupon_id`) y `cupones`
   (`activo`, `fecha_expiracion`). Sobre `inventario_vinilos` y `configuracion_divisas`
   no hay migraciones: esas tablas ya existían y el importador CSV resuelve los
   duplicados por `codigo` en la aplicación, no con un índice.

2. **Caching:**
   - Tasas de cambio cacheadas 1 minuto
   - Reduce queries redundantes

3. **Lazy Loading:**
   - **No está.** Ningún `<img>` del proyecto tiene `loading="lazy"`: el catálogo trae
     todas las tarjetas y cada imagen carga su archivo. Es lo primero que se rompe si el
     catálogo crece, y el arreglo es agregar el atributo en `VinylCard.tsx` y
     `ImageCarousel.tsx`

4. **Queries:**
   - `SELECT` con las columnas que se usan (no `*`) en los handlers nuevos
   - Los `DECIMAL` llegan como string: hay que pasarlos por `Number()` antes de operar,
     y por `importeUsd()` antes de mostrarlos

---

## Variables de Entorno

La lista completa está en **`.env.example`**, que es la plantilla sin valores reales. El
`.env` real no se commitea. En resumen:

```
MYSQL_URL=mysql://USUARIO:CLAVE@HOST:PUERTO/BASE   # la única obligatoria
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
GOOGLE_CLIENT_ID=                                  # del servidor
GOOGLE_DOMINIOS=                                   # opcional
VITE_GOOGLE_CLIENT_ID=                             # del front: el MISMO valor
ADMIN_PASSWORD=                                    # solo scripts/crear-admin.mjs
```

Ojo con las `VITE_*`: se compilan dentro del bundle y son públicas, y solo toman efecto
al hacer build. Ver [El login con Google tiene dos variables, no una](#el-login-con-google-tiene-dos-variables-no-una).

El backend (Express) además necesita `MYSQL_URL` y, opcionalmente, `ALLOWED_ORIGINS`, `GOOGLE_CLIENT_ID` y `GOOGLE_DOMINIOS` — ver la sección [Autenticación y Cuentas](#-autenticación-y-cuentas).

---

## Extensiones Futuras

Ideas para mejorar:

1. **Edición de vinilos:**
   - ~~Permitir admin editar registros existentes~~ (hecho: `PUT /api/vinilos/:id`)
   - Historial de cambios (la tabla `auditoria` existe y nadie escribe en ella)

2. **Gestión de órdenes:**
   - Dashboard de pedidos
   - Estados de envío
   - Emails de confirmación

3. **Autenticación:**
   - ~~Login para admin~~ (hecho: email + contraseña contra la BD)
   - Roles granulares
   - 2FA

4. **Reportes:**
   - Ventas por mes
   - Vinilos más populares
   - Análisis de género

5. **Integraciones:**
   - Sincronización con Instagram
   - MercadoLibre API
   - Pagaré/Stripe para pagos

---

## Notas Técnicas

### Por qué Express y MariaDB

El backend pasó de Supabase a Express + MariaDB. Lo que se ganó y lo que se perdió:

- ✅ **Una sola API.** `server.js` (catálogo, pedidos, cupones, backoffice) y `auth.js`
  (acceso) son el mismo Express, y en producción sirve también los estáticos de `dist/`.
  La cookie de sesión viaja same-origin y no hay ni CORS ni `SameSite` que pelear.
- ✅ **Transacciones de verdad.** El checkout necesita `SELECT ... FOR UPDATE` sobre el
  cupón y el stock en la misma transacción: eso es trabajo de base relacional, no de una
  API REST autogenerada.
- ✅ **Una sola fuente de verdad para el precio.** El server calcula el total contra la
  base, dentro de la transacción. Ver [docs/COUPONS.md](./docs/COUPONS.md).
- ⚠️ **A cambio, el control de acceso es código, no configuración.** No hay RLS: cada
  handler tiene que declarar su middleware. Un `GET` nuevo sin `requiereAdmin` expone
  datos. Vale la pena revisarlo en cada review.
- ⚠️ **Y hay que configurar el entorno a mano.** La plantilla es `.env.example`; nada se
  inyecta solo (salvo `MYSQL_URL` en Railway, si el plugin está instalado).

### Por qué Tailwind CSS?

- ✅ Rápido de desarrollar
- ✅ Responsive por defecto
- ✅ Temas personalizables
- ✅ Bundle pequeño
- ✅ Sin overhead de componentes

### Por qué Vite?

- ✅ Build 10x más rápido que Webpack
- ✅ HMR instantáneo
- ✅ Menos configuración
- ✅ Mejor DX (developer experience)

---

## Troubleshooting Técnico

**El server no arranca / `mysql.createPool(undefined)`**
- Falta `MYSQL_URL` en el `.env`. Es la única variable obligatoria.

**`ER_NO_SUCH_TABLE` o `ER_BAD_FIELD_ERROR` en pedidos o cupones**
- Faltó correr una migración. `npm run migrar` y revisá
  `node scripts/migrar.mjs --estado`. El detalle por migración está en
  [docs/COUPONS.md](./docs/COUPONS.md).

**El login del panel falla pero la contraseña es correcta**
- La sesión es única: si el mismo admin tuvo actividad en los últimos 60 s, el login
  devuelve `423`. Esperá un minuto.
- 5 intentos fallidos bloquean 15 minutos (`429`).

**El botón de Google no aparece**
- Falta `VITE_GOOGLE_CLIENT_ID`, y su ausencia **no tira ningún error**: el componente
  devuelve `null`. Ver [El login con Google tiene dos variables, no una](#el-login-con-google-tiene-dos-variables-no-una).

**`Token emitido para otra aplicacion`**
- `GOOGLE_CLIENT_ID` y `VITE_GOOGLE_CLIENT_ID` no coinciden.

**El login con Google se rechaza del lado de Google**
- El origen JS (`http://localhost:5173` en dev) no está en los *Authorized JavaScript
  origins* del client ID.

**Se ve `$45.00` en vez de `$ 45,00`**
- Son los `DECIMAL`: `mysql2` los devuelve como texto. Usá `importeUsd()` de
  `lib/cuenta.ts`.

**Imágenes no cargan:**
- Verifica que URL sea HTTPS
- Verifica CORS del servidor de imágenes

---

**Versión:** 1.0
**Última actualización:** 2026-02-28
**Mantenedor:** Desarrollo
