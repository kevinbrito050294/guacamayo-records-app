# Plumas: ledger y operación administrativa

## Estado de la integración

El panel admin ya tiene una vista mínima de movimientos y un formulario de ajustes
auditados. La vista consume el contrato de recompensas, pero el backend y las
migraciones todavía no lo implementan en esta entrega. Un `404` o `405` se muestra
como incompatibilidad de contrato; nunca se interpreta como saldo cero.

## Reglas de negocio

- 1 Pluma equivale a USD 0,01.
- Las Plumas ganadas son el 5% del subtotal neto pagado, en centavos de USD: `floor(subtotal_neto_usd * 100 * 0,05)`.
- El subtotal neto excluye descuentos de cupón y Plumas usadas.
- Solo ganan Plumas usuarios registrados.
- Se acreditan una sola vez cuando el pedido pasa a `finalizado`.
- Los pedidos cancelados no ganan Plumas.
- El canje no puede superar el 50% del subtotal neto del pedido.
- El saldo canónico se expresa en unidades enteras de Plumas; ARS y USDT solo son conversiones visuales.
- Cada movimiento ganado o ajuste positivo caduca a los 12 meses de su acreditación. El canje debe consumir lotes vigentes en orden FIFO.

## Endpoints

| Método | Ruta | Uso administrativo |
|---|---|---|
| `GET` | `/api/recompensas/saldo` | Saldo vigente del usuario autenticado. |
| `GET` | `/api/recompensas/movimientos` | Movimientos propios, con caducidad y pedido asociado. |
| `POST` | `/api/recompensas/cotizar` | Cotiza unidades solicitadas; no reserva ni modifica saldo. |
| `GET` | `/api/admin/recompensas/ledger` | Ledger admin filtrable por `usuario_id` y `pedido_id`. |
| `POST` | `/api/admin/recompensas/ajustes` | Registra un movimiento manual firmado por motivo; no recibe saldo final. |
| `POST` | `/api/admin/pedidos/:id/reembolso` | Reembolso de un pedido, incluyendo reversión de consumos según la política del backend. |

El ajuste admin acepta `usuario_id`, `pedido_id` opcional, `unidades` enteras
con signo, `motivo` obligatorio e `idempotency_key` única. La respuesta debe
devolver el movimiento creado o el movimiento ya existente para la misma clave.
El panel no permite editar un movimiento ni enviar un saldo calculado.

## Pedidos y columnas opcionales

Cuando `GET /api/pedidos` devuelve el contrato de recompensas, el panel muestra
`recompensas_ganadas` y `recompensas_usadas`. Son campos opcionales para que una
base todavía no migrada no rompa el listado. La fuente de verdad es siempre el
servidor, no el estado local del panel.

## Cancelación e idempotencia

La cancelación debe leer el pedido bloqueado dentro de la transacción y revisar
su estado anterior. Un pedido ya cancelado no vuelve a reponer stock ni revierte
recompensas; la operación repetida responde `409` o una respuesta idempotente
documentada por el backend. Si el pedido había ganado Plumas, se registra una
reversión enlazada al movimiento original. Si había consumido Plumas, se
revierten los consumos FIFO que correspondan, sin crear saldo a partir de un
valor enviado por el cliente.

Toda acreditación, consumo, reversión y ajuste debe tener una clave de operación
única. Reintentar con la misma clave devuelve el resultado anterior; una clave
distinta representa una operación nueva y debe quedar en auditoría.

## Límites y validaciones

- `usuario_id` debe ser un entero positivo y corresponder a una cuenta existente.
- `pedido_id`, si existe, debe corresponder al usuario y al pedido permitido por la política.
- Un ajuste manual debe ser distinto de cero, entero y estar entre `-100000` y `100000` Plumas por operación.
- El motivo debe tener entre 10 y 500 caracteres; no se aceptan ajustes sin motivo.
- El backend debe validar saldo disponible, vigencia, rol admin, origen del pedido y límites dentro de una transacción.
- Nunca se debe aceptar `saldo`, `saldo_nuevo`, importe monetario ni fórmula desde el navegador.
- Un invitado no acumula ni canjea Plumas.

## Incompatibilidad conocida

En esta entrega no se tocaron `server.js`, `db/migrations/**`, `src/lib/**`,
`src/components/cuenta/**` ni el carrito. Por eso los endpoints de esta página
pueden responder `404/405` hasta que el dueño de backend y migraciones publique
el contrato. No ejecutar ajustes ni anunciar saldos hasta completar esa parte y
probar transacciones, concurrencia, caducidad y reintentos.
