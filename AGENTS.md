# Project Context - Graphify Knowledge Graph

This project maintains a persistent knowledge graph of its code, docs, and images in `graphify-out/`. It is the canonical map of the codebase. Use it before answering codebase questions and after making changes.

## At session start (context loading)

0. **Primero comprobá lo publicado, antes de inspeccionar o modificar lo local:** ejecutá `powershell -File scripts/verificar-estado-publicado.ps1`. El control compara `HEAD` local contra `main` de GitHub, hashes de archivos críticos, working tree, versión Android y bundle público.
1. Si el control muestra diferencias, **detenete y compará**. No uses `git reset`, `git checkout`, `git restore`, `git clean` ni sobrescribas archivos para “igualar” una copia. Guardá el diagnóstico y decidí explícitamente si se conserva lo local, lo publicado o se hace una integración.
2. **Si hay trabajo pendiente de una sesión anterior, leé `PLAN_SIGUIENTE_SESION.md` primero.** No commitees sin leerlo.
3. Read `graphify-out/GRAPH_REPORT.md` for broad architecture context (communities, god nodes, surprising connections).
4. Read `graphify-out/reflections/LESSONS.md` for prior session learnings (preferred sources, dead ends, corrections).
5. If the user asks a focused question about code, architecture, or how things connect, run `graphify query "<question>"` (or a subgraph traversal) instead of grepping raw files — the scoped subgraph is smaller and answers directly.

### Control obligatorio antes de editar o publicar

- El `HEAD` local y el SHA de GitHub pueden ser distintos aunque el contenido crítico coincida, porque el repositorio se publica ocasionalmente mediante GitHub Contents API. Por eso se comparan también hashes de `server.js`, `auth.js`, `src/App.tsx`, `AdminPanel.tsx`, `Catalog.tsx`, `Cart.tsx`, `src/lib/contacto.ts`, `android-update.json` y `package.json`.
- `git status --short` debe revisarse antes de editar. Si hay cambios ajenos, no se descartan: se documentan y se asigna un dueño por archivo.
- Antes de un commit: revisar `git diff`, `git diff --cached`, `git diff --check` y `git log --oneline -10`.
- Antes de un deploy: volver a ejecutar `powershell -File scripts/verificar-estado-publicado.ps1 -Strict`; si falla, no publicar hasta resolver la divergencia.
- El control también descarga el APK indicado por `android-update.json`, comprueba HTTP 200, HTTPS, tamaño, MIME, SHA-256 contra `downloads/guacamayo-admin.apk` si existe y la firma con `apksigner` si está disponible.
- Después de publicar, comprobar nuevamente el bundle público, `android-update.json`, APK/hash/firma y el estado de Railway. La publicación no se considera terminada solo porque un comando haya finalizado sin error.

The reminder string "knowledge graph at graphify-out/" is injected before bash commands by the opencode plugin `.opencode/plugins/graphify.js`.

## After modifying code

Run `/graphify --update` (or the CLI) to re-extract changed files and rebuild `graph.json` + `GRAPH_REPORT.md`. The post-commit git hook also triggers this automatically after every `git commit`, so keeping changes committed keeps the graph fresh. Doc/image changes are NOT auto-rebuilt — run `/graphify --update` manually for those.

## Regla de publicación

Después de cada cambio funcional, no alcanza con dejar el código local: hay que ejecutar las verificaciones, generar el build y publicar la actualización correspondiente antes de cerrar la sesión.

- Cambios web/API: `npm run typecheck`, `npm run build`, `node --check server.js` y deploy al repositorio/servicio de Railway.
- Cambios Android o del flujo que se distribuye en el APK: ejecutar `scripts/publicar-android.ps1`. El script incrementa `versionCode` y `versionName`, ejecuta `npm run build`, `npm run mobile:sync`, genera `assembleRelease` con `GUACAMAYO_KEYSTORE_FILE`, `GUACAMAYO_KEYSTORE_PASSWORD` y `GUACAMAYO_KEY_ALIAS`, sube `downloads/guacamayo-admin.apk`, publica el manifiesto y compara el hash descargado por HTTPS.
- Nunca publicar un APK release sin la clave de firma vigente, ni afirmar que algo quedó publicado si el upload o la verificación HTTP no se completaron.
- Si la sesión no tiene acceso al destino de publicación o faltan las variables privadas, detenerse después del build y pedirlas explícitamente; no reemplazar la firma ni subir secretos.

## Commands available

- `graphify query "<question>"` - BFS traversal, broad context
- `graphify query "<question>" --dfs` - DFS, trace a path
- `graphify path "<a>" "<b>"` - shortest path between two concepts
- `graphify explain "<node>"` - plain-language explanation of a node
- `graphify reflect --if-stale` - refresh session lessons (start of graph work)
