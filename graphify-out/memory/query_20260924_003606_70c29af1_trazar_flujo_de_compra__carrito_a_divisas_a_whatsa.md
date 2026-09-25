---
type: "query"
date: "2026-09-24T00:36:06.959489+00:00"
question: "Trazar flujo de compra (Carrito a Divisas a WhatsApp)"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Cart()", "convertirPrecio()", "abrirWhatsApp()", "Pedido"]
---

# Q: Trazar flujo de compra (Carrito a Divisas a WhatsApp)

## Answer

Expanded via vocab [cart, carrito, whatsapp, divisa, tasas, precio, pedido]. Cart() (src/components/Cart.tsx L15) en comm 9 importa App; convertirPrecio() (currency.ts L47) calls obtenerTasas() (L12). Pedido/DetallePedido/PreciosConvertidos/ViniloCatalogo (database.ts) importan whatsapp.ts donde vive abrirWhatsApp() (L37) y generarMensajeWhatsApp(). doc RESUMEN_IMPLEMENTACION 'Flujo de datos de compra' conecta divisa a tasas a WhatsApp. outcome: useful

## Outcome

- Signal: useful

## Source Nodes

- Cart()
- convertirPrecio()
- abrirWhatsApp()
- Pedido