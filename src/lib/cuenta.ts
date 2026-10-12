import { createContext, useContext } from 'react';
import { apiUrl } from './api';

// ==========================================
// CUENTAS DE CLIENTE: tipos, contexto y helpers
// ==========================================
// Espejo en el front de lo que devuelve `auth.js` (rutas /api/auth/*,
// /api/direcciones, /api/favoritos) y de la tabla `pedidos`.
//
// La sesión vive en una cookie httpOnly: no hay token que guardar ni que leer
// desde JS. Por eso el estado de "logueado" siempre se consulta contra
// GET /api/auth/yo y TODAS las peticiones van con credentials: 'include'.

// --- Tipos ---

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  telefono: string | null;
  avatar_url: string | null;
}

export interface Direccion {
  id: number;
  apodo: string;
  direccion: string;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  // MySQL devuelve TINYINT (0/1), no boolean.
  es_default: number;
  // La columna es `creado_en` (db/migrations/2026-09-26_auth.sql:132), no
  // `created_at`. Va opcional porque GET /api/direcciones (auth.js:621) lista las
  // columnas a mano y no la trae: solo aparece en el POST y en el PUT, que
  // hacen SELECT *.
  creado_en?: string;
}

export interface Favorito {
  id: number;
  vinilo_id: number;
  creado_en: string;
  // Vienen del LEFT JOIN con inventario_vinilos: si el vinilo se borro, son null.
  codigo: string | null;
  titulo: string | null;
  artista: string | null;
  // DECIMAL(10,2): mysql2 lo devuelve como STRING ("25.00"). Mismo cuidado que
  // `ViniloCatalogo.precio_venta` en src/types/database.ts.
  precio_venta: string | null;
  imagen_url: string | null;
  stock_actual: number | null;
}

export interface ItemPedido {
  id?: number;
  cantidad?: number;
  titulo?: string;
  precio_unitario?: number | string | null;
  subtotal?: number | string | null;
}

export interface PedidoCliente {
  id_pedido: number;
  numero_orden: string | null;
  fecha: string;
  nombre_cliente: string | null;
  whatsapp_cliente: string | null;
  // OJO con los DECIMAL: `total_pago` es DECIMAL y mysql2 los devuelve como
  // STRING ("45.00"), asi que el tipo los declara como number|string y hay que
  // pasarlos por Number() antes de comparar o formatear. Sin eso, "45.00"
  // renderizado crudo se ve como `$45.00` y no como `USD 45.00`.
  total_pago: number | string | null;
  divisa_preferida: string | null;
  estado: string;
  /** OJO: la columna es TEXT, viene como string JSON. Usar itemsDePedido(). */
  items: ItemPedido[] | string | null;
  // GET /api/mis-pedidos hace SELECT *, asi que con la migracion 2026-09-29
  // llegan tambien las columnas del cupon. Opcionales: contra una base sin
  // migrar esas columnas no existen y llegan `undefined`.
  cupon_codigo?: string | null;
  descuento_aplicado?: number | string | null;
  recompensas_ganadas?: number | string | null;
  recompensas_usadas?: number | string | null;
  descuento_recompensas_usd?: number | string | null;
}

export interface SaldoRecompensas {
  unidades: number;
  valor_usd?: number | string | null;
}

export interface CotizacionRecompensas {
  unidades: number;
  descuento_usd: number | string;
  unidades_disponibles?: number;
  max_unidades?: number;
  recompensas_unidades?: number;
  descuento_recompensas_usd?: number | string;
}

export interface DatosLogin {
  email: string;
  password: string;
}

export interface DatosRegistro {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
}

export interface ResultadoAccion {
  ok: boolean;
  error: string;
}

// --- Contexto ---

export interface ValorCuenta {
  usuario: Usuario | null;
  cargando: boolean;
  login: (datos: DatosLogin) => Promise<ResultadoAccion>;
  registro: (datos: DatosRegistro) => Promise<ResultadoAccion>;
  loginConGoogle: (idToken: string) => Promise<ResultadoAccion>;
  logout: () => Promise<void>;
  refresh: () => Promise<Usuario | null>;

  // Favoritos: `idsFavoritos` es la fuente de verdad para los corazones del
  // catálogo (Set para no recorrer un array en cada card) y `favoritos` la lista
  // completa que muestra la pestaña Favoritos de la cuenta.
  //
  // NO hay un `favoritosCargando` acá a propósito: la pestaña Favoritos lleva su
  // propio estado de carga (que cubre la llamada entera) y el catálogo pinta los
  // corazones al instante. Un booleano que nadie lee obliga a todos los que
  // escriban en el contexto a mantenerlo al día sin necesidad.
  favoritos: Favorito[];
  idsFavoritos: Set<number>;
  alternarFavorito: (viniloId: number) => Promise<ResultadoAccion>;
  refrescarFavoritos: () => Promise<ResultadoAccion>;
  vaciarFavoritos: () => Promise<ResultadoAccion>;
  saldoRecompensas: SaldoRecompensas | null;
  refrescarSaldoRecompensas: () => Promise<ResultadoAccion>;
}

export const CuentaContext = createContext<ValorCuenta | null>(null);

export function useCuenta(): ValorCuenta {
  const valor = useContext(CuentaContext);
  if (!valor) throw new Error('useCuenta() se usa solo dentro de <CuentaProvider>');
  return valor;
}

// --- Peticiones ---

interface OpcionesPeticion {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  cuerpo?: unknown;
}

export interface RespuestaApi<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string;
}

/**
 * Fetch común de la API: siempre con credentials (cookie httpOnly) y siempre
 * devolviendo el `error` del server tal cual, para poder mostrarlo sin reescribir.
 */
export async function pedir<T = unknown>(ruta: string, opciones: OpcionesPeticion = {}): Promise<RespuestaApi<T>> {
  try {
    const res = await fetch(`${apiUrl()}${ruta}`, {
      method: opciones.method || 'GET',
      credentials: 'include',
      headers: opciones.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
    });

    // Some endpoints no devuelven JSON (ni siquiera en error): se lee como texto.
    const texto = await res.text();
    let cuerpo: unknown = null;
    if (texto) {
      try {
        cuerpo = JSON.parse(texto);
      } catch {
        cuerpo = null;
      }
    }

    const data = cuerpo as T | null;
    if (!res.ok) {
      const mensaje = (cuerpo as { error?: string } | null)?.error;
      return { ok: false, status: res.status, data, error: mensaje || 'No se pudo completar la operacion' };
    }
    return { ok: true, status: res.status, data, error: '' };
  } catch {
    return { ok: false, status: 0, data: null, error: 'Servidor no disponible' };
  }
}

export function solicitarRecuperacion(email: string): Promise<RespuestaApi<unknown>> {
  return pedir('/api/auth/recuperar', { method: 'POST', cuerpo: { email } });
}

export function restablecerPassword(token: string, password: string): Promise<RespuestaApi<unknown>> {
  return pedir('/api/auth/restablecer', { method: 'POST', cuerpo: { token, password } });
}

// --- Helpers de presentacion ---

/** Las imagenes guardadas pueden ser relativas ("/uploads/x.jpg"): hay que prefixarlas. */
export function imgUrl(url: string | null | undefined): string {
  if (!url) return '';
  const primera = url.split(',')[0].trim();
  if (!primera) return '';
  if (primera.startsWith('http')) return primera;
  return `${apiUrl()}${primera.startsWith('/') ? '' : '/'}${primera}`;
}

/** MySQL no trae zona horaria: se muestran sus componentes tal cual, sin correr el día. */
export function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return '';
  const texto = String(valor);
  const mysql = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (mysql) return `${mysql[3]}/${mysql[2]}/${mysql[1]}`;
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return texto;
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric' }).format(fecha);
}

/** Fecha y hora explícitas; los datetime MySQL se interpretan como hora local argentina. */
export function formatearFechaHora(valor: string | null | undefined): string {
  if (!valor) return '';
  const texto = String(valor);
  const mysql = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(texto);
  if (mysql) return `${mysql[3]}/${mysql[2]}/${mysql[1]} ${mysql[4]}:${mysql[5]}`;
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return texto;
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(fecha);
}

/** La columna `items` es TEXT: tolera JSON, arrays y filas parcialmente antiguas. */
export function itemsDePedido(pedido: { items: ItemPedido[] | string | null }): ItemPedido[] {
  if (Array.isArray(pedido.items)) return pedido.items.filter(item => item && typeof item === 'object');
  if (typeof pedido.items !== 'string' || !pedido.items.trim()) return [];
  try {
    const parseado: unknown = JSON.parse(pedido.items);
    if (!Array.isArray(parseado)) return [];
    return parseado.filter(item => item && typeof item === 'object').map(item => {
      const fila = item as Record<string, unknown>;
      const vinilo = fila.vinilo && typeof fila.vinilo === 'object' ? fila.vinilo as Record<string, unknown> : null;
      return {
        id: Number(fila.id ?? fila.id_vinilo ?? vinilo?.id) || undefined,
        cantidad: Number(fila.cantidad ?? fila.qty ?? fila.quantity ?? 1) || 1,
        titulo: String(fila.titulo ?? fila.nombre ?? fila.name ?? vinilo?.titulo ?? 'Vinilo'),
        precio_unitario: (fila.precio_unitario ?? fila.precio ?? fila.price) as number | string | null | undefined,
        subtotal: (fila.subtotal ?? fila.total) as number | string | null | undefined,
      };
    });
  } catch {
    return [];
  }
}

/**
 * "USD 45.00".
 *
 * El `Number()` no es cosmetico: `total_pago` y `descuento_aplicado` son DECIMAL
 * y mysql2 los devuelve como STRING ("45.00"), asi que sin la conversion se
 * cuela el string crudo a pantalla (y TypeScript no avisa, porque el tipo dice
 * number|string despues de este arreglo).
 *
 * Es el formato que ya usaban VinylCard.tsx, Catalog.tsx y Favoritos.tsx; solo
 * se junta en una funcion para que el total, el descuento y el beneficio del
 * cupon no vuelvan a divergir entre el panel y "mis pedidos".
 */
export function importeUsd(valor: number | string | null | undefined): string {
  return `USD ${Number(valor ?? 0).toFixed(2)}`;
}

export async function obtenerSaldoRecompensas(): Promise<RespuestaApi<SaldoRecompensas>> {
  const respuesta = await pedir<SaldoRecompensas | { saldo?: number | string; unidades?: number | string; saldo_unidades?: number | string }>('/api/recompensas/saldo');
  if (!respuesta.ok || !respuesta.data) return respuesta as RespuestaApi<SaldoRecompensas>;
  const datos = respuesta.data;
  const unidades = 'unidades' in datos
    ? Number(datos.unidades)
    : 'saldo_unidades' in datos
      ? Number(datos.saldo_unidades)
      : Number(datos.saldo);
  return { ...respuesta, data: { unidades: Number.isFinite(unidades) ? Math.max(0, unidades) : 0 } };
}

export function normalizarUnidadesRecompensas(valor: number): number {
  return Math.max(0, Math.floor(Number.isFinite(valor) ? valor : 0));
}

export async function cotizarRecompensas(unidades: number, items: Array<{ id: string | number; cantidad: number }>): Promise<RespuestaApi<CotizacionRecompensas>> {
  return pedir<CotizacionRecompensas>('/api/recompensas/cotizar', {
    method: 'POST',
    cuerpo: { items, recompensas_unidades: normalizarUnidadesRecompensas(unidades) },
  });
}
