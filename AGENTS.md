# Project Context - Graphify Knowledge Graph

This project maintains a persistent knowledge graph of its code, docs, and images in `graphify-out/`. It is the canonical map of the codebase. Use it before answering codebase questions and after making changes.

## At session start (context loading)

1. Read `graphify-out/GRAPH_REPORT.md` for broad architecture context (communities, god nodes, surprising connections).
2. Read `graphify-out/reflections/LESSONS.md` for prior session learnings (preferred sources, dead ends, corrections).
3. If the user asks a focused question about code, architecture, or how things connect, run `graphify query "<question>"` (or a subgraph traversal) instead of grepping raw files — the scoped subgraph is smaller and answers directly.

The reminder string "knowledge graph at graphify-out/" is injected before bash commands by the opencode plugin `.opencode/plugins/graphify.js`.

## After modifying code

Run `/graphify --update` (or the CLI) to re-extract changed files and rebuild `graph.json` + `GRAPH_REPORT.md`. The post-commit git hook also triggers this automatically after every `git commit`, so keeping changes committed keeps the graph fresh. Doc/image changes are NOT auto-rebuilt — run `/graphify --update` manually for those.

## Commands available

- `graphify query "<question>"` - BFS traversal, broad context
- `graphify query "<question>" --dfs` - DFS, trace a path
- `graphify path "<a>" "<b>"` - shortest path between two concepts
- `graphify explain "<node>"` - plain-language explanation of a node
- `graphify reflect --if-stale` - refresh session lessons (start of graph work)