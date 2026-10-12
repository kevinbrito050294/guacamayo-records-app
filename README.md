# 🎵 GuacamayoRecords - E-commerce de Vinilos

Una plataforma moderna de comercio electrónico especializada en la venta de vinilos, con catálogo dinámico, conversión de divisas en tiempo real, y checkout integrado con WhatsApp.

![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)
![React](https://img.shields.io/badge/React-18.3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![Express](https://img.shields.io/badge/Express-5-black)
![MariaDB](https://img.shields.io/badge/MariaDB-MySQL-003545)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC)

---

## 📸 Características Principales

- **Catálogo Dinámico:** Visualiza todos tus vinilos con imágenes, precios y disponibilidad
- **Búsqueda por texto:** Filtra por artista o título (no hay filtro por género ni por calidad)
- **Multidivisa:** Muestra precios en ARS (Dólar Blue), USD y USDT (cripto)
- **Carrito de Compras:** Selecciona artículos y compra directamente por WhatsApp
- **Cupones:** Códigos de descuento (`porcentaje` y `fijo`), administrados desde el panel
- **Panel Admin:** Gestiona inventario, pedidos, cupones y el ledger de Plumas, importa datos masivos, actualiza precios
- **Cuentas de cliente:** Registro, login por contraseña o Google, direcciones, favoritos e historial de pedidos
- **Importación CSV:** Carga cientos de vinilos en minutos
- **Tasas de Cambio:** Actualiza precios automáticamente cuando cambia el dólar

---

## 🚀 Inicio Rápido

### 1. Clonar/Descargar el Proyecto
```bash
cd proyecto-guacamayo
npm install
```

### 2. Configurar Variables de Entorno
Copiá `.env.example` a `.env` y completá `MYSQL_URL`. La lista completa de variables está
en `.env.example`, y el detalle de cada una en
[🔐 Acceso y Cuentas](#-acceso-y-cuentas).

### 3. Ejecutar en Desarrollo
```bash
npm run dev
```

### 4. Construir para Producción
```bash
npm run build
npm run preview
```

### 5. Activar el Acceso al Panel
```bash
# 1) Correr las migraciones pendientes (una sola vez)
npm run migrar

# 2) Crear el usuario admin del backoffice
$env:ADMIN_PASSWORD='mi-clave'; node scripts/crear-admin.mjs --email admin@guacamayorecords.com --nombre "Guacamayo"
```

Después entrás al panel con **email + contraseña**. Detalle en [🔐 Acceso y Cuentas](#-acceso-y-cuentas).

---

## 📖 Documentación

- **[GUIA_RAPIDA.md](./GUIA_RAPIDA.md)** - Comienza aquí (5 minutos)
- **[MANUAL_OPERACIONES.md](./MANUAL_OPERACIONES.md)** - Guía completa para colaboradores
- **[docs/COUPONS.md](./docs/COUPONS.md)** - Cupones de descuento: reglas, rutas y troubleshooting
- **[docs/PLUMAS.md](./docs/PLUMAS.md)** - Ledger de Plumas, reglas y contrato administrativo
- **[docs/ACCOUNT_RECOVERY.md](./docs/ACCOUNT_RECOVERY.md)** - Recuperación por email con Resend y operación segura
- **[ARQUITECTURA_TECNICA.md](./ARQUITECTURA_TECNICA.md)** - Documentación técnica (developers)

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|-----------|-----------|
| **Frontend** | React 18 + TypeScript |
| **Backend** | Node + Express 5 (`server.js` + `auth.js`) |
| **Styling** | Tailwind CSS |
| **Base de Datos** | MariaDB / MySQL (pool `mysql2`, Railway) |
| **Build** | Vite 5 |
| **Icons** | Lucide React |
| **API Cliente** | `fetch` contra el Express (`src/lib/api.ts`) |

---

## 📁 Estructura del Proyecto

```
.
├── src/
│   ├── components/           # Componentes React
│   │   ├── Catalog.tsx      # Página principal
│   │   ├── VinylCard.tsx    # Tarjeta de vinilo
│   │   ├── Cart.tsx         # Carrito (y el mensaje de WhatsApp)
│   │   ├── AdminPanel.tsx   # Panel de admin
│   │   ├── cuenta/          # Cuenta de cliente
│   │   └── admin/           # Formulario, CSV, Tasas
│   ├── lib/                 # Utilidades
│   │   ├── api.ts           # URL base de la API
│   │   ├── currency.ts      # Tasas y conversión de divisas
│   │   ├── cuenta.ts        # Estado y formato de la cuenta de cliente
│   │   └── cupon.ts         # Estado del cupón del carrito
│   ├── types/               # Tipos TypeScript
│   │   └── database.ts      # Tipos de BD
│   ├── App.tsx              # Componente principal
│   └── index.css             # Estilos globales
├── dist/                    # Build final (lo genera `npm run build`)
├── auth.js                  # Sesiones, scrypt y rutas /api/admin y /api/auth
├── server.js                # API Express: catálogo, pedidos, cupones, backoffice
├── db/migrations/           # Esquema real de la base (fuente de verdad)
├── scripts/                 # migrar.mjs, crear-admin.mjs
├── docs/                    # COUPONS.md, PLUMAS.md
├── GUIA_RAPIDA.md          # Intro rápida
├── MANUAL_OPERACIONES.md   # Manual completo
├── ARQUITECTURA_TECNICA.md # Docs técnicas
├── DATOS_EJEMPLO.csv       # CSV de ejemplo
└── README.md               # Este archivo
```

---

## 💾 Base de Datos

### Tablas Principales

1. **inventario_vinilos:** Catálogo de discos
2. **configuracion_divisas:** Tasas de cambio (DOLAR_BLUE, USDT)
3. **pedidos:** Órdenes de compra (con el cupón aplicado y el descuento)
4. **cupones:** Códigos de descuento del carrito (`db/migrations/2026-09-27_cupones.sql` + `2026-09-28_cupones_schema.sql`)
5. **admin_usuarios, usuarios, sesiones, direcciones, favoritos, auditoria:** Cuentas, sesiones y bitácora (vienen de `db/migrations/2026-09-26_auth.sql`)
6. **migraciones:** Historial de archivos `.sql` aplicados (la crea `scripts/migrar.mjs`)

Las migraciones siguientes completan el modelo de pedidos: `2026-09-29_pedidos_cupones.sql`
crea la tabla canónica `pedidos` y agrega el cupón aplicado; `2026-09-30_pedidos_direccion.sql`
agrega la dirección seleccionada y su snapshot histórico de envío.

El detalle de cada pedido vive en el JSON `pedidos.items`, no en una tabla de líneas: no
hay `detalles_pedido`. Y los datos del comprador están en `pedidos.nombre_cliente` /
`pedidos.whatsapp_cliente` y en `usuarios`: no hay tabla `clientes`.

El esquema lo define `db/migrations/`, que es la fuente de verdad. Los DDL de
`SCRIPT_MYSQL_BACKUP.sql` y de `supabase/migrations/` son históricos y no reproducen
esta base.

> **Ojo si la base está vacía:** `npm run migrar` crea las 9 tablas de cuentas, cupones,
> pedidos y el historial, pero **no** `inventario_vinilos` ni `configuracion_divisas`:
> esas dos ya existían y nadie las escribió como migración. Hay que crearlas a mano.
> Detalle en [ARQUITECTURA_TECNICA.md](./ARQUITECTURA_TECNICA.md) → "Base de Datos".

---

## 🔐 Acceso y Cuentas

El backoffice tiene usuarios propios en la base: ya no hay contraseña única en el código.

**1. Migración** (una sola vez, antes del primer login):

```bash
npm run migrar                    # aplica lo pendiente y anota el historial
node scripts/migrar.mjs --estado  # applied / pending
```

Crea `admin_usuarios`, `usuarios`, `sesiones`, `direcciones`, `favoritos` y `auditoria`, y agrega `usuario_id`, `actualizado_en` y `version` a `pedidos`. Las migraciones de cupones y pedidos completan el esquema canónico, incluida la dirección de envío. En Railway se puede correr desde el shell del servicio MySQL; los archivos son idempotentes.

**2. Crear o resetear la contraseña del admin:**

```bash
$env:ADMIN_PASSWORD='mi-clave'; node scripts/crear-admin.mjs --email admin@guacamayorecords.com --nombre "Guacamayo"
```

Mínimo 8 caracteres. Si el email ya existe, el mismo comando actualiza el hash. Opcionales: `--password 'mi-clave'`, `--rol admin|editor`, `--activo 0`.

**3. Login:** el ícono de engranaje (⚙️) de la barra superior abre el panel; ahí pedí **email + contraseña**. La sesión vive en una cookie `httpOnly` (12 h), el panel manda un latido cada 15 s y se corta sola a los 15 min sin actividad.

**Variables de entorno opcionales:**

| Variable | Para qué |
|----------|----------|
| `ALLOWED_ORIGINS` | Orígenes CORS separados por coma. Por defecto ya incluye `localhost:5173`, `localhost:3000`, `localhost:3001` y los dominios de Railway |
| `GOOGLE_CLIENT_ID` | Solo login de clientes con Google: valida que el token venga de esa app |
| `GOOGLE_DOMINIOS` | Solo login de clientes con Google: limita el login a ciertos dominios |
| `VITE_GOOGLE_CLIENT_ID` | El login con Google, del lado del front. **Tiene que ser el mismo valor exacto que `GOOGLE_CLIENT_ID`** |

Todas las peticiones del panel van con `credentials: 'include'`; por eso el CORS no puede ser `*`.

**🔑 Login con Google: dos variables y un origen**

El botón "Continuar con Google" de la pantalla de acceso depende de
`VITE_GOOGLE_CLIENT_ID`, que está en `.env.example` (y en `.env`, vacía por default).
Tres cosas que hay que tener presentes, porque ninguna falla de forma ruidosa:

1. **Si la variable falta, el botón desaparece y no pasa nada.** No hay error en consola,
   no hay cartel, no queda rastro: `src/components/cuenta/BotonGoogle.tsx:6` lee la
   variable y, si viene vacía, el componente devuelve `null` antes de renderizar. El
   login por email y contraseña sigue funcionando, así que es fácil pasar años sin
   darse cuenta. Si no lo ves, revisá esa variable primero.
2. **Las dos tienen que ser el mismo string.** `GOOGLE_CLIENT_ID` (el server valida el
   `aud` del token, en `auth.js`) y `VITE_GOOGLE_CLIENT_ID` (el front le pide el token a
   Google) van juntos y tienen que ser **exactamente el mismo valor**: no "el mismo
   Client ID de la consola" ni "uno parecido". Si difieren, el botón se dibuja bien y el
   login igual falla, con `Token emitido para otra aplicacion`.
3. **Hay que registrar el origen JS en la consola de Google.** El botón usa Google
   Identity Services, que exige que el origen esté en los *Authorized JavaScript origins*
   del client ID: `http://localhost:5173` en desarrollo (el puerto de Vite), el dominio
   real del sitio en producción. Sin eso, Google es el que no renderiza el botón, y el
   error aparece del lado de Google, no del nuestro.

**Ejemplo de las dos variables en el `.env`** (el mismo Client ID en las dos líneas; el
valor de abajo es un placeholder, no uno real):

```bash
GOOGLE_CLIENT_ID=000000000000-abc123.apps.googleusercontent.com   # del server
VITE_GOOGLE_CLIENT_ID=000000000000-abc123.apps.googleusercontent.com   # del front
```

Un detalle extra: las `VITE_*` se compilan dentro del bundle y son públicas, y solo toman
efecto al hacer `npm run build`. Cambiar la variable y recargar no alcanza: hay que
reconstruir y redesplegar. Y ojo con `GOOGLE_CLIENT_ID` **vacía** en el server: no es un
error, es una validación desactivada en silencio (el server deja de comprobar el `aud` y
acepta el token de cualquier app de Google).

**Cuentas de cliente** (interfaz en `src/components/cuenta/`): registro, login por contraseña, login con Google, `GET /api/auth/yo`, gestión de `/api/direcciones`, `/api/favoritos` y "mis pedidos" desde `GET /api/mis-pedidos`. En el checkout autenticado se puede seleccionar una dirección; el servidor valida que pertenezca al usuario y guarda un snapshot en el pedido.

La recuperación de contraseña por email usa Resend, un token de un solo uso con TTL de 30
minutos y respuestas anti-enumeración. La configuración de `RESEND_API_KEY`, `MAIL_FROM` y
`PUBLIC_APP_URL`, incluida la verificación del dominio remitente, está documentada en
[docs/ACCOUNT_RECOVERY.md](./docs/ACCOUNT_RECOVERY.md).

Más detalle técnico (scrypt, sesiones, tabla `sesiones`) en [ARQUITECTURA_TECNICA.md](./ARQUITECTURA_TECNICA.md).

---

## 🎟️ Cupones de Descuento

Los cupones se crean y editan desde el panel (engranaje ⚙️ → **Cupones**) y se escriben en el carrito. Hay dos tipos: `porcentaje` (descuenta el X% del subtotal) y `fijo` (descuenta X USD). Un cupón deja de servir cuando está inactivo, cuando `fecha_expiracion` es anterior a la fecha del servidor, o cuando se agotaron los usos.

**Las 5 rutas:**

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/cupones/validar` | Pública. Devuelve solo `id`, `codigo`, `tipo` y `valor`; rate limit de 60 fallos por IP cada 10 min (`429`) y un mismo `400` para inexistente/inactivo/vencido/agotado. Es **solo ayuda visual**: no cobra nada. |
| `GET` | `/api/admin/cupones` | Listado del backoffice: activos primero y, dentro de ellos, los que vencen antes. |
| `POST` | `/api/admin/cupones` | Crea uno (`409` si el código ya existe). `usos_actuales` arranca en 0. |
| `PUT` | `/api/admin/cupones/:id` | Edición parcial: código, tipo, valor, expiración, uso máximo, usos actuales y activo. |
| `DELETE` | `/api/admin/cupones/:id` | Lo borra. Los pedidos ya hechos no se tocan. |

**El descuento real lo aplica `POST /api/pedidos`**, no el navegador: el server ignora el `total_pago` que le mandan, lee los precios del catálogo y el cupón contra la base dentro de la misma transacción (con `FOR UPDATE`) y guarda el resultado en `total_pago`, `cupon_id`, `cupon_codigo` y `descuento_aplicado`. El carrito solo pinta el beneficio y, si el server rechaza el cupón, ofrece rehacer el pedido sin él.

Todo el detalle (reglas, administración, qué pasa al cancelar, migración y troubleshooting) en **[docs/COUPONS.md](./docs/COUPONS.md)**.

---

## ⚡ Características Técnicas

### Sistema de Divisas
```
// Conversión automática a 3 divisas (ejemplo con la tasa que hubiera ese día)
USD: $25.00
ARS: $29,625.00  (USD × tasa del Dólar Blue)
USDT: 25.0000    (USD × tasa de USDT)
```
> Las tasas no son constantes: se editan desde el panel y se cachean 1 minuto en el
> navegador. Por eso este ejemplo no lleva un número fijo.

La tasa operativa se sincroniza dos veces por día desde el par **Binance USDTARS**. Por
decisión del usuario, el valor recibido de Binance se usa como referencia operativa para
**las dos tasas**, `DOLAR_BLUE` y `USDT`; no se calcula una tasa independiente para cada
una. El panel también tiene un botón de sincronización manual y permite editar cualquiera
de las tasas manualmente cuando sea necesario.

La frecuencia puede configurarse con `BINANCE_SYNC_HOURS` y la zona horaria con
`BINANCE_SYNC_TIMEZONE`, si esas variables existen en el entorno del servidor. La
respuesta se valida antes de guardar: debe contener un valor numérico finito y positivo.
Si Binance no responde o el valor no pasa la validación, no se sobrescriben las tasas y
se conserva el último valor válido. La última sincronización se comprueba en la pestaña
**Tasas de Cambio**, revisando la fecha y hora mostradas junto a cada tasa.

### Búsqueda
- ✅ Búsqueda por texto (artista, título), dentro de `Catalog.tsx`
- ❌ Filtro por género: no existe
- ❌ Filtro por calidad: no existe

### Admin Features
- ✅ Formulario para nuevo vinilo
- ✅ Importador CSV masivo
- ✅ Gestor de tasas de cambio
- ✅ Gestión de pedidos y cupones
- ✅ Manual integrado

### Integraciones
- 🟢 WhatsApp (checkout directo)
- 🟢 MariaDB/MySQL en Railway (BD)
- 🟢 Cuentas de usuario (login por email y Google)
- 🟢 Pexels (imágenes de stock)

---

## 🎯 Casos de Uso

### Para Coleccionistas/Compradores
```
1. Abre el sitio
2. Busca vinilos por artista o título
3. Selecciona tu divisa preferida
4. Agrega al carrito (si hay un cupón, escribilo antes de confirmar)
5. Confirma por WhatsApp
6. ¡Recibe confirmación del vendedor!
```

### Para Administradores
```
1. Abre el panel (engranaje ⚙️ de la barra superior) e iniciá sesión con tu email y contraseña
2. Agrega vinilos uno a uno O importa CSV
3. Cuando sube el dólar, actualiza tasas
4. Recibe órdenes por WhatsApp
5. Confirma y envía
```

---

## 📊 Datos de Ejemplo

El archivo `DATOS_EJEMPLO.csv` contiene 10 vinilos de prueba:

```csv
codigo,imagen_url,stock_actual
LP001,https://images.pexels.com/...,5
LP002,https://images.pexels.com/...,3
...
```

Para cargar:
1. Panel Admin → Importar CSV
2. Sube `DATOS_EJEMPLO.csv`
3. Haz clic "Importar 10 registros"

---

## 🔐 Seguridad

- ✅ **Control de acceso en la API:** cada ruta declara su middleware (`requiereAdmin`, `requiereCliente`)
- ✅ **Validaciones:** Frontend + Backend
- ✅ **HTTPS:** en Railway (el sitio se sirve por TLS)
- ✅ **Ningún dato sensible:** No guardamos tarjetas; las contraseñas se guardan solo como hash `scrypt`
- ✅ **API segura:** Sesión por cookie `httpOnly` (el token nunca se ve desde el navegador)

---

## 📱 Responsive Design

La plataforma está optimizada para:
- 📱 Móviles (320px+)
- 💻 Tablets (768px+)
- 🖥️ Desktop (1024px+)

Todos los componentes se adaptan automáticamente.

---

## 🚀 Deployment

### Railway (recomendado)
```bash
npm install
npm run build     # genera dist/
npm start         # levanta server.js, que sirve dist/ y /api
```

El servicio corre `server.js` (Express), que además sirve los estáticos de `dist/`: por
eso front y API comparten origen y la cookie de sesión viaja bien. Agregá el plugin MySQL
de Railway, que inyecta `MYSQL_URL`.

### Orden obligatorio: migración antes que deploy
Si el deploy toca el checkout, corré `npm run migrar` **antes** de desplegar, o
`POST /api/pedidos` va a fallar por una columna que no existe. Ver
[docs/COUPONS.md](./docs/COUPONS.md) → [Migración y qué verificar](docs/COUPONS.md#migración-y-qué-verificar).

### Solo el front, en otro servidor
Se puede, pero perdés la API: sin `server.js` no hay catálogo, ni carrito, ni panel, ni
cupones. Si igual lo hacés, `npm run build` y subí `dist/` con el rewrite de `index.html`
para rutas sin archivo.

### Variables de Entorno
No se inyectan solas: copiá `.env.example` a `.env` y completá `MYSQL_URL`. En Railway, el
plugin MySQL lo inyecta solo. El detalle de cada variable en
[🔐 Acceso y Cuentas](#-acceso-y-cuentas).

> El deploy es de **dos piezas**: `npm run build` genera `dist/`, y `npm start` levanta
> `server.js`, que sirve ese `dist/` y las rutas `/api` desde el mismo origen. Publicar
> solo el front en un hosting estático deja la tienda sin API.

---

## 🐛 Troubleshooting

### "No veo los vinilos"
→ Recarga la página (F5)
→ Verifica que haya datos en la BD
→ Mira la consola de navegador (F12)

### "Las imágenes no cargan"
→ Verifica que la URL sea válida (HTTPS)
→ Prueba con una imagen de Pexels
→ Fijate que la URL no tenga espacios (el catálogo corta la imagen por la primera coma)

### "El checkout no guarda el pedido"
→ Falta una migración: `npm run migrar`. El server ya escribe `cupon_id`,
  `cupon_codigo` y `descuento_aplicado`, y sin esas columnas el INSERT se cae
→ Ver [docs/COUPONS.md](./docs/COUPONS.md) → "Migración y qué verificar"

### "El botón de iniciar sesión con Google no aparece"
→ Falta `VITE_GOOGLE_CLIENT_ID`, y eso **no tira ningún error**
→ Tiene que ser el mismo valor exacto que `GOOGLE_CLIENT_ID`, y el origen
  (`http://localhost:5173` en dev) tiene que estar en la consola de Google
→ Después de cambiarla: `npm run build`

### "El CSS se ve mal"
→ Limpia cache: Ctrl+Shift+R
→ Verifica que Tailwind esté compilado

### "CSV no se importa"
→ Asegúrate de guardar como CSV (no XLSX)
→ Verifica columnas: codigo, imagen_url, stock_actual
→ No debe haber filas vacías

---

## 📈 Performance

- **Bundle:** ~83 KB gzipped (277 KB de JS + 39 KB de CSS sin comprimir, medido sobre el
  build más reciente; volvé a medirlo con `npm run build`)
- **Tasas de cambio:** cacheadas 1 minuto en el navegador
- **Imágenes:** **no hay `loading="lazy"` en el código**. El catálogo se trae todas las
  tarjetas y cada `<img>` carga su archivo. Agregar el atributo es un arreglo de una
  línea por `<img>` si el catálogo crece

No hay score de Lighthouse medido: no lo publiques sin correrlo.

---

## 🎓 Para Developers

### Agregar una columna a la base
1. Creá un `.sql` nuevo en `db/migrations/` (con el prefijo de fecha, y con guardas de
   `information_schema` para que sea idempotente)
2. Corré `npm run migrar`
3. Actualizá el tipo en `types/database.ts`
4. Usala en los handlers de `server.js` y en los componentes

### Agregar Nuevo Género
No hay una lista cerrada: `genero` es texto libre y se carga desde el formulario del
panel. El catálogo no filtra por género, así que no hay lista `GENEROS` que actualizar.

### Cambiar Colores
En `tailwind.config.js` o en componentes:
```jsx
className="bg-slate-900"  // Cambia a otro color
```

---

## 📞 Soporte & Contacto

- 🐛 Issues: Abrí un issue en GitHub
- 📧 Email y WhatsApp: completar con los datos reales de la tienda (no van en el repo)

Antes de escribir, revisá la sección de troubleshooting de más abajo: la mayoría de los
"somos el dueño" (no entran, no cargan imágenes, el checkout no guarda) son configuración,
no bugs.

---

## 📄 Licencia

Este proyecto es privado. © GuacamayoRecords 2026

---

## 🎉 ¡Gracias por usar GuacamayoRecords!

Recuerda:
- Actualiza tasas diariamente
- Verifica inventario regularmente
- ¡Mantén hermosas las imágenes!
- Cuéntale a tus amigos sobre tu tienda

**¿Listo para empezar?** → Consulta [GUIA_RAPIDA.md](./GUIA_RAPIDA.md)

---

**v1.1** | 2026-09-29 | GuacamayoRecords
