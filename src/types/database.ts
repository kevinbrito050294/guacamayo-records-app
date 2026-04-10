export type CalidadVinilo = 'NM' | 'EX' | 'VG+' | 'VG' | 'G';
export type EstadoPedido = 'pendiente' | 'confirmado' | 'enviado' | 'entregado' | 'cancelado';
export type TipoDivisa = 'DOLAR_BLUE' | 'USDT';

export interface ViniloCatalogo {
  id: string;
  codigo: string;
  titulo: string;
  artista: string;
  genero: string;
  pais_origen: string | null;
  precio_venta: number;
  stock_actual: number;
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

export interface Cliente {
  id: string;
  nombre: string;
  email: string | null;
  whatsapp: string | null;
  created_at: string;
}

export interface Pedido {
  id: string;
  numero_pedido: string;
  cliente_id: string;
  estado: EstadoPedido;
  precio_total_usd: number;
  precio_total_ars: number | null;
  precio_total_usdt: number | null;
  divisa_preferida: string;
  fecha_pedido: string;
  created_at: string;
  updated_at: string;
}

export interface DetallePedido {
  id: string;
  pedido_id: string;
  vinilo_id: string;
  cantidad: number;
  precio_unitario_usd: number;
  subtotal_usd: number;
  created_at: string;
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
