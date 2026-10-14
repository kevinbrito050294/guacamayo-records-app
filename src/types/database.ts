export type CalidadVinilo = 'NM' | 'EX' | 'VG+' | 'VG' | 'G';
export type EstadoPedido = 'pendiente' | 'confirmado' | 'enviado' | 'entregado' | 'finalizado' | 'cancelado';

export type TipoDivisa = 'DOLAR_BLUE' | 'USDT';
export type MonedaPrecio = 'USD' | 'ARS' | 'USDT';
export type TipoCupon = 'porcentaje' | 'fijo';
export type DecimalValue = string | number;

// POR QUÉ ESTE ARCHIVO NO DEFINE NI `Pedido`, NI `DetallePedido`, NI `Cliente`,
// aunque sí conserva `EstadoPedido` como unión reutilizable:
//   - `Pedido` era el espejo del esquema viejo de Supabase (`id`, `numero_pedido`,
//     `cliente_id`, `precio_total_usd`, `created_at`...), que no existe en la base
//     real. Ningún archivo lo importaba: quedó huérfano la sesión 2026-09-27 con
//     `src/lib/whatsapp.ts`, su único consumidor.
//   - `DetallePedido` describía la tabla de líneas normalizada que tampoco existe:
//     el detalle de cada pedido vive como JSON en `pedidos.items`.
//   - `Cliente` no tenía consumidores.
//   - `EstadoPedido` existía solo para tipear `Pedido.estado`; se conserva porque
//     sigue siendo un contrato útil para los estados del flujo de pedidos.
//   La forma que SÍ se usa la describe `PedidoCliente` en src/lib/cuenta.ts, que
//   es el espejo de la columna real (canónico en
//   db/migrations/2026-09-29_pedidos_cupones.sql). La columna `estado` de la tabla
//   real es VARCHAR(20), y el server escribe exactamente 'pendiente' | 'finalizado'
//   | 'cancelado'; la unión conserva también los estados históricos del tipo.

export interface Cupon {
  id: number;
  codigo: string;
  tipo: TipoCupon;
  // OJO: `valor` es DECIMAL(10,2) y mysql2 devuelve los DECIMAL como STRING
  // ("20.00"), no como number. Hay que envolverlo en Number() antes de comparar
  // o formatear, o un cupón que está bien se toma por inválido (mismo cuidado
  // con `pedidos.total_pago` y `pedidos.descuento_aplicado`).
  valor: string;
  // 'YYYY-MM-DD' (el listado del backoffice lo formatea con DATE_FORMAT para no
  // correr con el off-by-one de UTC), o null = no vence.
  fecha_expiracion: string | null;
  // TINYINT(1) NOT NULL DEFAULT 1 (migración 2026-09-28): 1 = activo,
  // 0 = inactivo. No es nullable: el backfill de esa migración dejó 1 en los
  // NULL que hubiera, porque con la columna nullable un NULL hacía que
  // `usos_actuales + 1` quedara en NULL y el cupón nunca se agotaba en silencio.
  activo: number;
  uso_maximo: number | null;
  // INT NOT NULL DEFAULT 0: POST /api/pedidos lo incrementa dentro de la
  // transacción y con FOR UPDATE cuando hay uso_maximo; cancelar lo decrementa
  // con GREATEST(0, usos_actuales - 1). El panel puede corregirlo manualmente.
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
  // se crea sin `decimalNumbers`. El tipo decía number y por eso los 9
  // consumidores del repo terminaban escribiendo Number(...) a mano: lo que
  // compila hoy y se rompe en producción el día que alguien escriba
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
  ultima_modificacion_en?: string | null;
  ultima_modificacion_admin_id?: number | null;
  ultima_modificacion_admin_email?: string | null;
  ultima_modificacion_admin_nombre?: string | null;
}

export interface ConfiguracionDivisa {
  id: string;
  tipo: TipoDivisa;
  // La API puede entregar DECIMAL como string; los consumidores reciben la
  // tasa normalizada a number después de parsear la respuesta.
  tasa: number;
  ultima_actualizacion: string | null;
  updated_by: string | null;
  modo?: 'manual' | 'binance';
  fuente?: string | null;
  ultima_sincronizacion?: string | null;
  estado?: 'activo' | 'error' | 'sincronizando' | 'pendiente' | string | null;
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

export interface TasasCambio {
  DOLAR_BLUE: number;
  USDT: number;
}

export interface RecompensasPedido {
  recompensas_ganadas?: DecimalValue | null;
  recompensas_usadas?: DecimalValue | null;
  descuento_recompensas_usd?: DecimalValue | null;
}

export interface ItemPedido {
  id?: number;
  cantidad?: number;
  titulo?: string;
  precio_unitario?: DecimalValue | null;
  subtotal?: DecimalValue | null;
}
