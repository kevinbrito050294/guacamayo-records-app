---
type: "query"
date: "2026-09-24T00:32:13.048452+00:00"
question: "Por que BulkImporter() puentea Admin Currency & CSV Import con App Shell & Catalog y Panel Admin & Vinilos?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["BulkImporter()", "Importador CSV (BulkImporter)", "AdminPanel()"]
---

# Q: Por que BulkImporter() puentea Admin Currency & CSV Import con App Shell & Catalog y Panel Admin & Vinilos?

## Answer

Expanded from original query via vocab: [bulk, importer, admin, csv, currency, import]. Traversed BFS desde BulkImporter()/Importador CSV/Importacion masiva. BulkImporter() (src/components/admin/BulkImporter.tsx L11) importa AdminPanel.tsx (comm 0/6) y contiene handleFileUpload() y handleImport(). Su nodo documental Importador CSV (BulkImporter) en ARQUITECTURA_TECNICA.md (comm 2) puentea a las guias GUIA_RAPIDA y MANUAL_OPERACIONES y shares_data_with DATOS_EJEMPLO.csv (comm 1). react/lucide-react importados desde App, Catalog, Cart, AdminPanel, FilterPanel conectan comm 0/4/6/12. outcome: useful

## Outcome

- Signal: useful

## Source Nodes

- BulkImporter()
- Importador CSV (BulkImporter)
- AdminPanel()