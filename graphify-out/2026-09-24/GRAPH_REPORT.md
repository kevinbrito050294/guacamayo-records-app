# Graph Report - project  (2026-09-23)

## Corpus Check
- 48 files · ~89,378 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .csv 1, .exe 1)

## Summary
- 298 nodes · 427 edges · 31 communities (18 shown, 13 thin omitted)
- Extraction: 81% EXTRACTED · 19% INFERRED · 1% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- App Shell & Catalog
- Proyecto Overview Docs
- Admin Currency & CSV Import
- Supabase & Seguridad
- Build Tooling (eslint)
- tsconfig App
- Panel Admin & Vinilos
- tsconfig Node
- Dev Dependencies
- Carrito & Divisa
- Express Server
- Runtime Dependencies
- Filtros Catalog
- Package Scripts
- Backend Backup
- graphify Plugin
- Brand & Imagenes
- Performance Docs
- opencode Plugin
- Vite Config
- tsconfig Root
- Extensiones Futuras
- Tailwind Docs
- Vite Docs
- Checklists QA
- Solucion Problemas
- Tech Stack Docs
- Deployment & Stack

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `lucide-react` - 14 edges
3. `compilerOptions` - 14 edges
4. `react` - 13 edges
5. `ViniloCatalogo` - 10 edges
6. `Row Level Security (RLS) + validaciones` - 10 edges
7. `Conjunto de documentacion (9 guias)` - 9 edges
8. `GuacamayoRecords - arquitectura tecnica` - 9 edges
9. `ConfiguracionDivisa` - 8 edges
10. `CarritoItem` - 8 edges

## Surprising Connections (you probably didn't know these)
- `DATOS_EJEMPLO.csv - 10 vinilos de prueba` --semantically_similar_to--> `DATOS_EJEMPLO.csv - datos de prueba`  [INFERRED] [semantically similar]
  ARCHIVOS_CREADOS.md → README.md
- `Verificacion: carrito y checkout WhatsApp` --references--> `Cart()`  [EXTRACTED]
  CHECKLIST_VERIFICACION.md → src/components/Cart.tsx
- `Archivos y rutas importantes` --references--> `Cart()`  [EXTRACTED]
  INICIO_AQUI.txt → src/components/Cart.tsx
- `Conversion de divisas (USD a ARS/USDT)` --references--> `convertirPrecio()`  [EXTRACTED]
  ARQUITECTURA_TECNICA.md → src/lib/currency.ts
- `Archivos y rutas importantes` --references--> `convertirPrecio()`  [INFERRED]
  INICIO_AQUI.txt → src/lib/currency.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Esquema de base de datos Supabase (5 tablas)** — arquitectura_tecnica_inventario_vinilos, arquitectura_tecnica_configuracion_divisas, arquitectura_tecnica_clientes, arquitectura_tecnica_pedidos, arquitectura_tecnica_detalles_pedido [EXTRACTED 1.00]
- **Sistema multidivisa (ARS/USD/USDT)** — arquitectura_tecnica_configuracion_divisas, arquitectura_tecnica_conversion_divisas, arquitectura_tecnica_gestor_tasas, guia_rapida_tasas, manual_operaciones_gestion_precios [INFERRED 0.85]
- **Flujo de compra por WhatsApp** — configurar_whatsapp_numero_whatsapp, configurar_whatsapp_mensaje_orden, arquitectura_tecnica_whatsapp_integration, checklist_verificacion_whatsapp_checkout, resumen_implementacion_flujo_datos [INFERRED 0.85]

## Communities (31 total, 13 thin omitted)

### Community 0 - "App Shell & Catalog"
Cohesion: 0.09
Nodes (29): lucide-react, react, react-dom, App(), Divisa, Page, src_assets_logo, CSVRow (+21 more)

### Community 1 - "Proyecto Overview Docs"
Cohesion: 0.15
Nodes (27): DATOS_EJEMPLO.csv - 10 vinilos de prueba, Conjunto de documentacion (9 guias), GuacamayoRecords - e-commerce de vinilos (inventario), Estado: PRODUCTION READY v1.0, Componentes React + utilidades TypeScript (12), Esquema de base de datos Supabase (5 tablas + RLS), GuacamayoRecords - arquitectura tecnica, Frontend: React 18 + TypeScript (+19 more)

### Community 2 - "Admin Currency & CSV Import"
Cohesion: 0.11
Nodes (21): Tabla configuracion_divisas (tasas DOLAR_BLUE/USDT), Conversion de divisas (USD a ARS/USDT), Flujos de usuario (compra, carga de vinilos, actualizar tasas), Gestor de tasas (CurrencyManager), Importador CSV (BulkImporter), Integracion WhatsApp (wa.me con mensaje pre-llenado), Estructura del mensaje de pedido por WhatsApp, Herramienta: Importar CSV (+13 more)

### Community 3 - "Supabase & Seguridad"
Cohesion: 0.14
Nodes (19): SCRIPT_MYSQL_BACKUP.sql - backup en formato MySQL, Tabla clientes, Tabla detalles_pedido (items de orden), Tabla inventario_vinilos (catalogo/SKU/album/artista), Tabla pedidos (ordenes de compra), Decision: Supabase en lugar de MySQL local (nube, RLS, backups), Row Level Security (RLS) + validaciones, Seguridad: RLS, validaciones, auth admin (+11 more)

### Community 4 - "Build Tooling (eslint)"
Cohesion: 0.13
Nodes (17): name, private, type, version, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks (+9 more)

### Community 5 - "tsconfig App"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+9 more)

### Community 6 - "Panel Admin & Vinilos"
Cohesion: 0.12
Nodes (10): Panel de administracion (4 herramientas), Panel de administracion (4 secciones), Interfaz de usuario (catalogo, tarjeta, carrito, admin), CALIDADES, GENEROS, VinylForm(), VinylFormProps, AdminPanel() (+2 more)

### Community 7 - "tsconfig Node"
Cohesion: 0.12
Nodes (15): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+7 more)

### Community 8 - "Dev Dependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+7 more)

### Community 9 - "Carrito & Divisa"
Cohesion: 0.16
Nodes (12): Variables de entorno VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, Verificacion: carrito y checkout WhatsApp, Casos avanzados (multiples numeros, mensaje personalizado), Numero de WhatsApp en Cart.tsx (linea 43), Privacidad: el numero es publico en el codigo, Troubleshooting de WhatsApp, Archivos y rutas importantes, Cart() (+4 more)

### Community 10 - "Express Server"
Cohesion: 0.17
Nodes (11): dotenv, multer, ref_url, adminSession, app, db, __dirname, __filename (+3 more)

### Community 11 - "Runtime Dependencies"
Cohesion: 0.20
Nodes (10): dependencies, cors, dotenv, express, lucide-react, multer, mysql2, react (+2 more)

### Community 12 - "Filtros Catalog"
Cohesion: 0.25
Nodes (8): Sistema de filtros (genero, calidad, busqueda), Estadisticas (3 divisas, 5 calidades, 13 generos), Codigos de calidad NM/EX/VG+/VG/G, Guia para developers (generos, colores, columnas), CALIDADES, FilterPanel(), FilterPanelProps, CalidadVinilo

### Community 13 - "Package Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, start, typecheck

### Community 14 - "Backend Backup"
Cohesion: 0.33
Nodes (5): app, db, cors, express, mysql2

### Community 15 - "graphify Plugin"
Cohesion: 0.40
Nodes (3): IMPORTANT: keep the reminder string free of backticks and $(...) constructs., ref_fs, ref_path

### Community 16 - "Brand & Imagenes"
Cohesion: 0.67
Nodes (4): Guacamayo Records Brand, Brand Logo, Music Marketing Promotion Content, Promotional Image (WhatsApp)

### Community 17 - "Performance Docs"
Cohesion: 0.67
Nodes (3): Performance: indices, cache 1 min, lazy loading, Verificacion de performance (build <100KB, carga <2s), Performance: bundle 89.91KB, Lighthouse 95+, <2s

## Ambiguous Edges - Review These
- `Brand Logo` → `Guacamayo Records Brand`  [AMBIGUOUS]
  src/assets/logo.png · relation: references
- `Guacamayo Records Brand` → `Music Marketing Promotion Content`  [AMBIGUOUS]
  uploads/1773155250875-IMG-20250806-WA0001.jpg · relation: conceptually_related_to
- `Guacamayo Records Brand` → `Promotional Image (WhatsApp)`  [AMBIGUOUS]
  uploads/1773155250875-IMG-20250806-WA0001.jpg · relation: conceptually_related_to
- `Promotional Image (WhatsApp)` → `Music Marketing Promotion Content`  [AMBIGUOUS]
  uploads/1773155250875-IMG-20250806-WA0001.jpg · relation: references

## Knowledge Gaps
- **136 isolated node(s):** `$schema`, `plugin`, `app`, `db`, `name` (+131 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 158 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Brand Logo` and `Guacamayo Records Brand`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Guacamayo Records Brand` and `Music Marketing Promotion Content`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Guacamayo Records Brand` and `Promotional Image (WhatsApp)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Promotional Image (WhatsApp)` and `Music Marketing Promotion Content`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `lucide-react` connect `App Shell & Catalog` to `Build Tooling (eslint)`, `Filtros Catalog`, `Panel Admin & Vinilos`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Why does `react` connect `App Shell & Catalog` to `Build Tooling (eslint)`, `Filtros Catalog`, `Panel Admin & Vinilos`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `BulkImporter()` connect `Admin Currency & CSV Import` to `App Shell & Catalog`, `Panel Admin & Vinilos`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._