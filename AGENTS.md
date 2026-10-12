# Project Context - Graphify Knowledge Graph

This project maintains a persistent knowledge graph of its code, docs, and images in `graphify-out/`. It is the canonical map of the codebase. Use it before answering codebase questions and after making changes.

## At session start (context loading)

0. **Si hay trabajo pendiente de una sesión anterior, leé `PLAN_SIGUIENTE_SESION.md` primero.** Contiene el estado de lo hecho sin commitear, el bloqueante de la migración, y el plan de agentes en paralelo con un dueño por archivo. No commitees sin leerlo.
1. Read `graphify-out/GRAPH_REPORT.md` for broad architecture context (communities, god nodes, surprising connections).
2. Read `graphify-out/reflections/LESSONS.md` for prior session learnings (preferred sources, dead ends, corrections).
3. If the user asks a focused question about code, architecture, or how things connect, run `graphify query "<question>"` (or a subgraph traversal) instead of grepping raw files — the scoped subgraph is smaller and answers directly.

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
