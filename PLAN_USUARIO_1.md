# PLAN USUARIO 1 - cuenta mejorada y sistema de Plumas

Estado: fase inicial implementada y publicada. Reembolso parcial y pruebas E2E
quedan pendientes.

## Objetivo

Mejorar el panel de cuenta reutilizando los módulos existentes de pedidos,
favoritos, direcciones, catálogo, carrito y monedas. Incorporar un sistema de
créditos que premie las compras y permita canjearlos por artículos del catálogo.

## Panel de cuenta propuesto

- Resumen con pedidos totales y pendientes.
- Favoritos disponibles y agotados.
- Dirección principal.
- Saldo de Plumas.
- Últimos pedidos y acción "Comprar de nuevo".
- Detalle expandible del pedido con dirección, cupón, descuento y Plumas.
- Favoritos con acción directa para agregar al carrito.
- Sección de perfil para editar nombre, teléfono y moneda preferida.
- Diseño responsive conservando slate, ámbar, tarjetas redondeadas y Lucide.

## Sistema de Plumas

Valores iniciales recomendados:

- 1 Pluma = USD 0,01.
- Premio del 5% sobre el subtotal neto.
- No premia descuentos, Plumas usadas ni pedidos cancelados.
- Se acredita cuando el pedido pasa a `finalizado`.
- Solo aplica a usuarios registrados.
- Se puede pagar hasta el 50% del subtotal con Plumas.
- Caducidad recomendada: 12 meses.
- ARS/USDT son conversiones visuales; el saldo canónico se calcula en USD.

## Modelo técnico

Crear una cuenta de recompensas por usuario, un ledger inmutable de movimientos
y una tabla de consumos FIFO para poder revertir canjes correctamente.

Agregar a `pedidos`:

- `recompensas_ganadas`.
- `recompensas_usadas`.
- `descuento_recompensas_usd`.
- `recompensas_reversionadas`.

El servidor debe recalcular precios, cupón, saldo y descuento dentro de la
misma transacción. El cliente solo envía unidades solicitadas, nunca valores
monetarios ni saldos confiables.

## Endpoints previstos

```text
GET  /api/recompensas/saldo
GET  /api/recompensas/movimientos
POST /api/recompensas/cotizar
GET  /api/admin/recompensas/ledger
POST /api/admin/recompensas/ajustes
POST /api/admin/pedidos/:id/reembolso
```

Integrar también `POST /api/pedidos`, cancelación y finalización para acreditar,
consumir y revertir Plumas de forma idempotente.

## Trabajo paralelo futuro

- Agente A: migraciones y ledger, dueño de `db/migrations/**`.
- Agente B: backend de recompensas, dueño de `server.js`.
- Agente C: cuenta, carrito y favoritos, dueño de `src/components/cuenta/**`,
  `Cart.tsx` y `src/lib/**`.
- Agente D: panel administrativo, documentación y pruebas.

## Decisiones iniciales pendientes de confirmar

1. Confirmar nombre "Plumas".
2. Confirmar valor, porcentaje, límite y caducidad.
3. Confirmar que la acreditación ocurra en `finalizado`.
4. Confirmar exclusión de pedidos invitados.
5. Definir política de reembolso parcial y vencimiento de créditos revertidos.

Próximo paso: validar el flujo completo con una cuenta de prueba y decidir si se
implementa reembolso parcial antes de ampliar el programa.
