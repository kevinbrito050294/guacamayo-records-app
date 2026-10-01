export type CalidadVinilo = 'NM' | 'EX' | 'VG+' | 'VG' | 'G';
export type EstadoPedido = 'pendiente' | 'confirmado' | 'enviado' | 'entregado' | 'finalizado' | 'cancelado';

export type TipoDivisa = 'DOLAR_BLUE' | 'USDT';
export type TipoCupon = 'porcentaje' | 'fijo';

// POR QU?? ESTE ARCHIVO NO DEFINE NI `Pedido`, NI `DetallePedido`, NI `Cliente`,
// aunque s?? conserva `EstadoPedido` como uni??n reutilizable:
//   - `Pedido` era el espejo del esquema viejo de Supabase (`id`, `numero_pedido`,
//     `cliente_id`, `precio_total_usd`, `created_at`...), que no existe en la base
//     real. Ning??n archivo lo importaba: qued?? hu??rfano la sesi??n 2026-09-27 con
//     `src/lib/whatsapp.ts`, su ??nico consumidor.
//   - `DetallePedido` describ??a la tabla de l??neas normalizada que tampoco existe:
//     el detalle de cada pedido vive como JSON en `pedidos.items`.
//   - `Cliente` no ten??a consumidores.
//   - `EstadoPedido` exist??a solo para tipear `Pedido.estado`; se conserva porque
//     sigue siendo un contrato ??til para los estados del flujo de pedidos.
//   La forma que S?? se usa la describe `PedidoCliente` en src/lib/cuenta.ts, que
//   es el espejo de la columna real (can??nico en
//   db/migrations/2026-09-29_pedidos_cupones.sql). La columna `estado` de la tabla
//   real es VARCHAR(20), y el server escribe exactamente 'pendiente' | 'finalizado'
//   | 'cancelado'; la uni??n conserva tambi??n los estados hist??ricos del tipo.

export interface Cupon {
  id: number;
  codigo: string;
  tipo: TipoCupon;
  // OJO: `valor` es DECIMAL(10,2) y mysql2 devuelve los DECIMAL como STRING
  // ("20.00"), no como number. Hay que envolverlo en Number() antes de comparar
  // o formatear, o un cup??n que est?? bien se toma por inv??lido (mismo cuidado
  // con `pedidos.total_pago` y `pedidos.descuento_aplicado`).
  valor: string;
  // 'YYYY-MM-DD' (el listado del backoffice lo formatea con DATE_FORMAT para no
  // correr con el off-by-one de UTC), o null = no vence.
  fecha_expiracion: string | null;
  // TINYINT(1) NOT NULL DEFAULT 1 (migraci??n 2026-09-28): 1 = activo,
  // 0 = inactivo. No es nullable: el backfill de esa migraci??n dej?? 1 en los
  // NULL que hubiera, porque con la columna nullable un NULL hac??a que
  // `usos_actuales + 1` quedara en NULL y el cup??n nunca se agotaba en silencio.
  activo: number;
  uso_maximo: number | null;
  // INT NOT NULL DEFAULT 0: lo mueve POST /api/pedidos (dentro de la
  // transacci??n, con FOR UPDATE) y lo devuelve a cero o menos
  // PUT /api/pedidos/:id/cancelar con GREATEST(0, usos_actuales - 1).
  usos_actuales: number;
  creado_en: string;
}

export interface ViniloCatalogo {
  id: string;
  codigo: string;
  titulo: string;
  artista: string;
  genero: string;
  pais_origen: string | null;
  // OJO: `precio_venta` es DECIMAL(10,2) y mysql2 devuelve los DECIMAL como
  // STRING ("25.00"), no como number: GET /api/vinilos hace SELECT * y el pool
  // se crea sin `decimalNumbers`. El tipo dec??a number y por eso los 9
  // consumidores del repo terminaban escribiendo Number(...) a mano: lo que
  // compila hoy y se rompe en producci??n el d??a que alguien escriba
  // `v.precio_venta.toFixed(2)`. Passalo por Number() (o por `importeUsd()` de
  // src/lib/cuenta.ts) antes de calcular o formatear.
  precio_venta: string;
  stock_actual: number;
  destacado: number;
  calidad: CalidadVinilo;
  imagen_url: string | null;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfiguracionDivisa {
  id: string;
  tipo: TipoDivisa;
  tasa: number;
  ultima_actualizacion: string;
  updated_by: string | null;
}

export interface CarritoItem {
  vinilo: ViniloCatalogo;
  cantidad: number;
}

export interface PreciosConvertidos {
  usd: number;
  ars: number;
  usdt: number;
}
