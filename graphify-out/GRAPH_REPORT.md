# Graph Report - project  (2026-10-12)

## Corpus Check
- 87 files · ~112,622 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 25 file(s) not represented in the graph (top: .xml 10, (none) 6, .properties 2)

## Summary
- 725 nodes · 1180 edges · 65 communities (38 shown, 27 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 87 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `53930de8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AdminPanel.tsx
- Conjunto de documentacion (9 guias)
- Row Level Security (RLS) + validaciones
- auth.js
- package.json
- server.js
- PLAN DE CONTINUIDAD — estado real del proyecto
- 🎟️ Cupones de Descuento - GuacamayoRecords
- compilerOptions
- MainActivity
- devDependencies
- compilerOptions
- Plumas: ledger y operación administrativa
- migrar.mjs
- App.tsx
- dependencies
- Music Marketing Promotion Content
- Performance: indices, cache 1 min, lazy loading
- crear-admin.mjs
- PLAN USUARIO 1 - cuenta mejorada y sistema de Plumas
- AndroidBiometricBridge
- Extensiones futuras (edicion, ordenes, auth, reportes)
- Decision: Tailwind CSS (rapido, responsive, bundle pequeno)
- Decision: Vite (build 10x, HMR instantaneo)
- 12 fases de verificacion
- Errores comunes y como evitarlos
- Tecnologia utilizada (React, Supabase, Vite, Tailwind, Lucide)
- Stack tecnologico y hosting (Vercel/Netlify)
- Override
- Project Context - Graphify Knowledge Graph
- App Android de administración
- Q: Por que BulkImporter() puentea Admin Currency & CSV Import con App Shell & Catalog y Panel Admin & Vinilos?
- Q: Trazar flujo de compra (Carrito a Divisas a WhatsApp)
- ref_child_process
- gradlew
- Guia para developers (generos, colores, columnas)
- GuacamayoMessagingService.java
- cuenta.ts
- opencode.json
- vite-env.d.ts
- tsconfig.json
- MainActivity.java
- ErrorPedido
- CuentaPanel.tsx
- Recuperacion de cuenta por email
- Acceso.tsx
- Pedidos.tsx
- .readCredentialsArray
- cookiemanager
- Cart.tsx
- pedir
- notificarNuevoPedido
- sincronizarBinance
- react
- handler
- sharedpreferences

## God Nodes (most connected - your core abstractions)
1. `MainActivity` - 30 edges
2. `crearAuthRouter()` - 28 edges
3. `react` - 22 edges
4. `lucide-react` - 20 edges
5. `apiUrl()` - 18 edges
6. `Cart()` - 17 edges
7. `compilerOptions` - 16 edges
8. `pedir()` - 14 edges
9. `compilerOptions` - 14 edges
10. `ConfiguracionDivisa` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Archivos y rutas importantes` --references--> `convertirPrecio()`  [INFERRED]
  INICIO_AQUI.txt → src/lib/currency.ts
- `🛠️ Las 5 rutas` --references--> `requiereAdmin()`  [INFERRED]
  docs/COUPONS.md → auth.js
- `Verificacion: carrito y checkout WhatsApp` --references--> `Cart()`  [EXTRACTED]
  CHECKLIST_VERIFICACION.md → src/components/Cart.tsx
- `Archivos y rutas importantes` --references--> `Cart()`  [EXTRACTED]
  INICIO_AQUI.txt → src/components/Cart.tsx
- `DATOS_EJEMPLO.csv - 10 vinilos de prueba` --semantically_similar_to--> `DATOS_EJEMPLO.csv - datos de prueba`  [INFERRED] [semantically similar]
  ARCHIVOS_CREADOS.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Esquema de base de datos Supabase (5 tablas)** — arquitectura_tecnica_inventario_vinilos, arquitectura_tecnica_configuracion_divisas, arquitectura_tecnica_clientes, arquitectura_tecnica_pedidos, arquitectura_tecnica_detalles_pedido [EXTRACTED 1.00]
- **Flujo de compra por WhatsApp** — configurar_whatsapp_numero_whatsapp, configurar_whatsapp_mensaje_orden, arquitectura_tecnica_whatsapp_integration, checklist_verificacion_whatsapp_checkout, resumen_implementacion_flujo_datos [INFERRED 0.85]
- **Sistema multidivisa (ARS/USD/USDT)** — arquitectura_tecnica_configuracion_divisas, arquitectura_tecnica_conversion_divisas, arquitectura_tecnica_gestor_tasas, guia_rapida_tasas, manual_operaciones_gestion_precios [INFERRED 0.85]

## Communities (65 total, 27 thin omitted)

### Community 0 - "AdminPanel.tsx"
Cohesion: 0.05
Nodes (59): 📎 Archivos relacionados, Panel de administracion (4 herramientas), Archivos y rutas importantes, Panel de administracion (4 secciones), Interfaz de usuario (catalogo, tarjeta, carrito, admin), BulkImporter(), handleImport(), CSVRow (+51 more)

### Community 1 - "Conjunto de documentacion (9 guias)"
Cohesion: 0.16
Nodes (26): DATOS_EJEMPLO.csv - 10 vinilos de prueba, Conjunto de documentacion (9 guias), GuacamayoRecords - e-commerce de vinilos (inventario), Estado: PRODUCTION READY v1.0, Componentes React + utilidades TypeScript (12), GuacamayoRecords - arquitectura tecnica, Frontend: React 18 + TypeScript, GuacamayoRecords - checklist de verificacion (+18 more)

### Community 2 - "Row Level Security (RLS) + validaciones"
Cohesion: 0.06
Nodes (48): SCRIPT_MYSQL_BACKUP.sql - backup en formato MySQL, Esquema de base de datos Supabase (5 tablas + RLS), Tabla clientes, Tabla configuracion_divisas (tasas DOLAR_BLUE/USDT), Conversion de divisas (USD a ARS/USDT), Tabla detalles_pedido (items de orden), Variables de entorno VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, Sistema de filtros (genero, calidad, busqueda) (+40 more)

### Community 3 - "auth.js"
Cohesion: 0.11
Nodes (42): activoDe(), borrarCookie(), borrarSesion(), claveIntento(), configuracionCorreo(), crearAuthRouter(), actualizarAdministrador(), crearSesion() (+34 more)

### Community 4 - "package.json"
Cohesion: 0.05
Nodes (41): app, db, config, name, private, scripts, build, crear-admin (+33 more)

### Community 5 - "server.js"
Cohesion: 0.07
Nodes (23): limpiarSesionesVencidas(), app, BINANCE_API_URLS, BINANCE_SYNC_HOURS_CONFIGURADAS, CAMPOS_CUPON_LISTADO, crearRateLimitPorIP(), db, __dirname (+15 more)

### Community 6 - "PLAN DE CONTINUIDAD — estado real del proyecto"
Cohesion: 0.10
Nodes (19): 10. Orden recomendado para la próxima sesión, 1. Regla de trabajo, 2. Arquitectura vigente, 3. Implementado en el código local, 4. Pendiente de verificar, no necesariamente pendiente de implementar, 5. Pendientes funcionales reales, 6. Documentación que debe alinearse, 7. Seguridad y repositorio (+11 more)

### Community 7 - "🎟️ Cupones de Descuento - GuacamayoRecords"
Cohesion: 0.10
Nodes (20): 🖥️ Administración desde el panel, Aparece agotado sin serlo, 🎟️ Cupones de Descuento - GuacamayoRecords, Cuándo un cupón deja de servir, Cómo correrla, El cupón no aplica, El total del carrito no coincide con el del pedido, Error 429 al validar (+12 more)

### Community 8 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+9 more)

### Community 9 - "MainActivity"
Cohesion: 0.20
Nodes (3): MainActivity, android.os.Handler, com.getcapacitor.BridgeActivity

### Community 10 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, autoprefixer, @capacitor/cli, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+8 more)

### Community 11 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+7 more)

### Community 12 - "Plumas: ledger y operación administrativa"
Cohesion: 0.22
Nodes (8): Cancelación e idempotencia, Endpoints, Estado de la integración, Incompatibilidad conocida, Límites y validaciones, Pedidos y columnas opcionales, Plumas: ledger y operación administrativa, Reglas de negocio

### Community 13 - "migrar.mjs"
Cohesion: 0.20
Nodes (6): ref_crypto, ref_url, args, CARPETA, __dirname, MYSQL_URL

### Community 14 - "App.tsx"
Cohesion: 0.13
Nodes (14): react-dom, AdminCredentialMetadata, App(), Divisa, Page, src_assets_logo, AdminLogin(), AdminLoginProps (+6 more)

### Community 15 - "dependencies"
Cohesion: 0.17
Nodes (12): dependencies, @capacitor/android, @capacitor/core, cors, dotenv, express, lucide-react, multer (+4 more)

### Community 17 - "Performance: indices, cache 1 min, lazy loading"
Cohesion: 0.67
Nodes (3): Performance: indices, cache 1 min, lazy loading, Verificacion de performance (build <100KB, carga <2s), Performance: bundle 89.91KB, Lighthouse 95+, <2s

### Community 18 - "crear-admin.mjs"
Cohesion: 0.14
Nodes (10): IMPORTANT: keep the reminder string free of backticks and $(...) constructs., ref_fs, ref_path, args, __dirname, email, hash, MYSQL_URL (+2 more)

### Community 19 - "PLAN USUARIO 1 - cuenta mejorada y sistema de Plumas"
Cohesion: 0.22
Nodes (8): Decisiones iniciales pendientes de confirmar, Endpoints previstos, Modelo técnico, Objetivo, Panel de cuenta propuesto, PLAN USUARIO 1 - cuenta mejorada y sistema de Plumas, Sistema de Plumas, Trabajo paralelo futuro

### Community 29 - "Project Context - Graphify Knowledge Graph"
Cohesion: 0.33
Nodes (5): After modifying code, At session start (context loading), Commands available, Project Context - Graphify Knowledge Graph, Regla de publicación

### Community 30 - "App Android de administración"
Cohesion: 0.29
Nodes (6): Actualizaciones, App Android de administración, Desarrollo, Desbloqueo biométrico, Notificaciones de pedidos, Sesión

### Community 31 - "Q: Por que BulkImporter() puentea Admin Currency & CSV Import con App Shell & Catalog y Panel Admin & Vinilos?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Por que BulkImporter() puentea Admin Currency & CSV Import con App Shell & Catalog y Panel Admin & Vinilos?, Source Nodes

### Community 32 - "Q: Trazar flujo de compra (Carrito a Divisas a WhatsApp)"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Trazar flujo de compra (Carrito a Divisas a WhatsApp), Source Nodes

### Community 34 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 36 - "GuacamayoMessagingService.java"
Cohesion: 0.10
Nodes (20): ExampleInstrumentedTest, GuacamayoMessagingService, Override, ExampleUnitTest, androidx.test.ext.junit.runners.AndroidJUnit4, assert, build, com.google.firebase.messaging.FirebaseMessagingService (+12 more)

### Community 37 - "cuenta.ts"
Cohesion: 0.21
Nodes (13): CuentaProvider(), CotizacionRecompensas, CuentaContext, DatosLogin, DatosRegistro, Favorito, obtenerSaldoRecompensas(), OpcionesPeticion (+5 more)

### Community 41 - "MainActivity.java"
Cohesion: 0.06
Nodes (33): alertdialog, base64, biometricmanager, biometricprompt, bytearrayoutputstream, cipher, contextcompat, executor (+25 more)

### Community 42 - "ErrorPedido"
Cohesion: 0.40
Nodes (4): cuentaRecompensas(), ErrorPedido, movimientoRecompensas(), unidadesSolicitadas()

### Community 46 - "CuentaPanel.tsx"
Cohesion: 0.25
Nodes (9): AppShell(), Acceso(), CuentaPanel(), Pestana, Favoritos(), PestanaBoton(), Direccion, imgUrl() (+1 more)

### Community 53 - "Recuperacion de cuenta por email"
Cohesion: 0.29
Nodes (6): Anti-enumeracion, Dominio y remitente en Resend, Flujo, Recuperacion de cuenta por email, Variables de entorno, Verificacion operativa

### Community 54 - "Acceso.tsx"
Cohesion: 0.27
Nodes (8): AccesoProps, Modo, BotonGoogle(), BotonGoogleProps, cargarScriptGoogle(), googleDe(), GoogleIdentity, RespuestaCredencial

### Community 55 - "Pedidos.tsx"
Cohesion: 0.31
Nodes (8): claseEstado(), CLASES_ESTADO, etiquetaEstado(), ETIQUETAS_ESTADO, Pedidos(), PedidosProps, formatearFechaHora(), PedidoCliente

### Community 56 - ".readCredentialsArray"
Cohesion: 0.22
Nodes (3): android.content.SharedPreferences, javax.crypto.SecretKey, org.json.JSONArray

### Community 58 - "Cart.tsx"
Cohesion: 0.14
Nodes (26): avisoDeRateLimit(), Cart(), CartProps, RespuestaPedido, TonoAviso, CatalogProps, CuentaPanelProps, FavoritosProps (+18 more)

### Community 59 - "pedir"
Cohesion: 0.36
Nodes (6): NuevaPassword(), RecuperacionProps, SolicitudRecuperacion(), pedir(), restablecerPassword(), solicitarRecuperacion()

### Community 60 - "notificarNuevoPedido"
Cohesion: 0.67
Nodes (3): firebaseAccessToken(), firebaseServiceAccount(), notificarNuevoPedido()

### Community 62 - "sincronizarBinance"
Cohesion: 0.29
Nodes (7): guardarTasaBinance(), horaLocalBinance(), marcarErrorBinance(), obtenerTasaBinance(), reclamarSlotBinance(), revisarSincronizacionBinance(), sincronizarBinance()

### Community 64 - "react"
Cohesion: 0.19
Nodes (13): lucide-react, react, CurrencyManagerProps, Direcciones(), esPrincipal(), FORM_VACIO, FormDireccion, Divisa (+5 more)

## Ambiguous Edges - Review These
- `Promotional Image (WhatsApp)` → `Music Marketing Promotion Content`  [AMBIGUOUS]
  uploads/1773155250875-IMG-20250806-WA0001.jpg · relation: references

## Knowledge Gaps
- **269 isolated node(s):** `VinylFormProps`, `AdminAccount`, `AdminPanelProps`, `AdminRole`, `PedidoApi` (+264 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 360 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Promotional Image (WhatsApp)` and `Music Marketing Promotion Content`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `react` connect `react` to `AdminPanel.tsx`, `package.json`, `cuenta.ts`, `App.tsx`, `CuentaPanel.tsx`, `Acceso.tsx`, `Pedidos.tsx`, `Cart.tsx`, `pedir`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `react` to `AdminPanel.tsx`, `package.json`, `App.tsx`, `CuentaPanel.tsx`, `Acceso.tsx`, `Pedidos.tsx`, `Cart.tsx`, `pedir`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `express` connect `package.json` to `auth.js`, `server.js`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `VinylFormProps`, `AdminAccount`, `AdminPanelProps` to the rest of the system?**
  _269 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AdminPanel.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05472837022132797 - nodes in this community are weakly interconnected._
- **Should `Row Level Security (RLS) + validaciones` be split into smaller, more focused modules?**
  _Cohesion score 0.05851063829787234 - nodes in this community are weakly interconnected._