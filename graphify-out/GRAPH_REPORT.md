# Graph Report - project  (2026-09-24)

## Corpus Check
- 46 files · ~89,851 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .csv 1, .exe 1)

## Summary
- 312 nodes · 438 edges · 33 communities (20 shown, 13 thin omitted)
- Extraction: 81% EXTRACTED · 18% INFERRED · 1% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `283ee03d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- Conjunto de documentacion (9 guias)
- Row Level Security (RLS) + validaciones
- Importador CSV (BulkImporter)
- package.json
- compilerOptions
- Project Context - Graphify Knowledge Graph
- compilerOptions
- devDependencies
- currency.ts
- server.js
- dependencies
- VinylForm.tsx
- scripts
- backup app guacamayo/server.js
- graphify.js
- Guacamayo Records Brand
- Performance: indices, cache 1 min, lazy loading
- opencode.json
- vite
- tsconfig.json
- Extensiones futuras (edicion, ordenes, auth, reportes)
- Decision: Tailwind CSS (rapido, responsive, bundle pequeno)
- Decision: Vite (build 10x, HMR instantaneo)
- 12 fases de verificacion
- Errores comunes y como evitarlos
- Tecnologia utilizada (React, Supabase, Vite, Tailwind, Lucide)
- Stack tecnologico y hosting (Vercel/Netlify)
- Q: Por que BulkImporter() puentea Admin Currency & CSV Import con App Shell & Catalog y Panel Admin & Vinilos?
- Q: Trazar flujo de compra (Carrito a Divisas a WhatsApp)

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `lucide-react` - 14 edges
3. `compilerOptions` - 14 edges
4. `react` - 13 edges
5. `ViniloCatalogo` - 10 edges
6. `Row Level Security (RLS) + validaciones` - 10 edges
7. `GuacamayoRecords - arquitectura tecnica` - 9 edges
8. `Conjunto de documentacion (9 guias)` - 9 edges
9. `CarritoItem` - 8 edges
10. `ConfiguracionDivisa` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Verificacion: carrito y checkout WhatsApp` --references--> `Cart()`  [EXTRACTED]
  CHECKLIST_VERIFICACION.md → src/components/Cart.tsx
- `DATOS_EJEMPLO.csv - 10 vinilos de prueba` --semantically_similar_to--> `DATOS_EJEMPLO.csv - datos de prueba`  [INFERRED] [semantically similar]
  ARCHIVOS_CREADOS.md → README.md
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
- **Flujo de compra por WhatsApp** — configurar_whatsapp_numero_whatsapp, configurar_whatsapp_mensaje_orden, arquitectura_tecnica_whatsapp_integration, checklist_verificacion_whatsapp_checkout, resumen_implementacion_flujo_datos [INFERRED 0.85]
- **Sistema multidivisa (ARS/USD/USDT)** — arquitectura_tecnica_configuracion_divisas, arquitectura_tecnica_conversion_divisas, arquitectura_tecnica_gestor_tasas, guia_rapida_tasas, manual_operaciones_gestion_precios [INFERRED 0.85]

## Communities (33 total, 13 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.07
Nodes (35): Panel de administracion (4 herramientas), Panel de administracion (4 secciones), lucide-react, react, react-dom, Interfaz de usuario (catalogo, tarjeta, carrito, admin), App(), Divisa (+27 more)

### Community 1 - "Conjunto de documentacion (9 guias)"
Cohesion: 0.11
Nodes (33): DATOS_EJEMPLO.csv - 10 vinilos de prueba, Conjunto de documentacion (9 guias), GuacamayoRecords - e-commerce de vinilos (inventario), SCRIPT_MYSQL_BACKUP.sql - backup en formato MySQL, Estado: PRODUCTION READY v1.0, Componentes React + utilidades TypeScript (12), Esquema de base de datos Supabase (5 tablas + RLS), GuacamayoRecords - arquitectura tecnica (+25 more)

### Community 2 - "Row Level Security (RLS) + validaciones"
Cohesion: 0.10
Nodes (31): Tabla clientes, Tabla configuracion_divisas (tasas DOLAR_BLUE/USDT), Conversion de divisas (USD a ARS/USDT), Tabla detalles_pedido (items de orden), Flujos de usuario (compra, carga de vinilos, actualizar tasas), Gestor de tasas (CurrencyManager), Tabla inventario_vinilos (catalogo/SKU/album/artista), Tabla pedidos (ordenes de compra) (+23 more)

### Community 3 - "Importador CSV (BulkImporter)"
Cohesion: 0.33
Nodes (4): Importador CSV (BulkImporter), Herramienta: Importar CSV, Importacion masiva por CSV, BulkImporter()

### Community 4 - "package.json"
Cohesion: 0.13
Nodes (17): name, private, type, version, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks (+9 more)

### Community 5 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+9 more)

### Community 6 - "Project Context - Graphify Knowledge Graph"
Cohesion: 0.40
Nodes (4): After modifying code, At session start (context loading), Commands available, Project Context - Graphify Knowledge Graph

### Community 7 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+7 more)

### Community 8 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+7 more)

### Community 9 - "currency.ts"
Cohesion: 0.18
Nodes (11): Variables de entorno VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, Casos avanzados (multiples numeros, mensaje personalizado), Numero de WhatsApp en Cart.tsx (linea 43), Privacidad: el numero es publico en el codigo, Troubleshooting de WhatsApp, Archivos y rutas importantes, Cart(), actualizarTasa() (+3 more)

### Community 10 - "server.js"
Cohesion: 0.17
Nodes (11): dotenv, multer, ref_url, adminSession, app, db, __dirname, __filename (+3 more)

### Community 11 - "dependencies"
Cohesion: 0.20
Nodes (10): dependencies, cors, dotenv, express, lucide-react, multer, mysql2, react (+2 more)

### Community 12 - "VinylForm.tsx"
Cohesion: 0.14
Nodes (12): Sistema de filtros (genero, calidad, busqueda), Estadisticas (3 divisas, 5 calidades, 13 generos), Codigos de calidad NM/EX/VG+/VG/G, Guia para developers (generos, colores, columnas), CALIDADES, GENEROS, VinylForm(), VinylFormProps (+4 more)

### Community 13 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, start, typecheck

### Community 14 - "backup app guacamayo/server.js"
Cohesion: 0.33
Nodes (5): app, db, cors, express, mysql2

### Community 15 - "graphify.js"
Cohesion: 0.40
Nodes (3): IMPORTANT: keep the reminder string free of backticks and $(...) constructs., ref_fs, ref_path

### Community 16 - "Guacamayo Records Brand"
Cohesion: 0.67
Nodes (4): Guacamayo Records Brand, Brand Logo, Music Marketing Promotion Content, Promotional Image (WhatsApp)

### Community 17 - "Performance: indices, cache 1 min, lazy loading"
Cohesion: 0.67
Nodes (3): Performance: indices, cache 1 min, lazy loading, Verificacion de performance (build <100KB, carga <2s), Performance: bundle 89.91KB, Lighthouse 95+, <2s

### Community 31 - "Q: Por que BulkImporter() puentea Admin Currency & CSV Import con App Shell & Catalog y Panel Admin & Vinilos?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Por que BulkImporter() puentea Admin Currency & CSV Import con App Shell & Catalog y Panel Admin & Vinilos?, Source Nodes

### Community 32 - "Q: Trazar flujo de compra (Carrito a Divisas a WhatsApp)"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Trazar flujo de compra (Carrito a Divisas a WhatsApp), Source Nodes

## Ambiguous Edges - Review These
- `Promotional Image (WhatsApp)` → `Guacamayo Records Brand`  [AMBIGUOUS]
  uploads/1773155250875-IMG-20250806-WA0001.jpg · relation: conceptually_related_to
- `Promotional Image (WhatsApp)` → `Music Marketing Promotion Content`  [AMBIGUOUS]
  uploads/1773155250875-IMG-20250806-WA0001.jpg · relation: references
- `Guacamayo Records Brand` → `Brand Logo`  [AMBIGUOUS]
  src/assets/logo.png · relation: references
- `Guacamayo Records Brand` → `Music Marketing Promotion Content`  [AMBIGUOUS]
  uploads/1773155250875-IMG-20250806-WA0001.jpg · relation: conceptually_related_to

## Knowledge Gaps
- **145 isolated node(s):** `$schema`, `plugin`, `At session start (context loading)`, `After modifying code`, `Commands available` (+140 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 169 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Promotional Image (WhatsApp)` and `Guacamayo Records Brand`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Promotional Image (WhatsApp)` and `Music Marketing Promotion Content`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Guacamayo Records Brand` and `Brand Logo`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Guacamayo Records Brand` and `Music Marketing Promotion Content`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `lucide-react` connect `App.tsx` to `package.json`, `VinylForm.tsx`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Why does `react` connect `App.tsx` to `package.json`, `VinylForm.tsx`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Why does `BulkImporter()` connect `Importador CSV (BulkImporter)` to `App.tsx`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._