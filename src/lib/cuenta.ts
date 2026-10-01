import { createContext, useContext } from 'react';
import { apiUrl } from './api';

// ==========================================
// CUENTAS DE CLIENTE: tipos, contexto y helpers
// ==========================================
// Espejo en el front de lo que devuelve `auth.js` (rutas /api/auth/*,
// /api/direcciones, /api/favoritos) y de la tabla `pedidos`.
//
// La sesi??n vive en una cookie httpOnly: no hay token que guardar ni que leer
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
  // cat??logo (Set para no recorrer un array en cada card) y `favoritos` la lista
  // completa que muestra la pesta??a Favoritos de la cuenta.
  //
  // NO hay un `favoritosCargando` ac?? a prop??sito: la pesta??a Favoritos lleva su
  // propio estado de carga (que cubre la llamada entera) y el cat??logo pinta los
  // corazones al instante. Un booleano que nadie lee obliga a todos los que
  // escriban en el contexto a mantenerlo al d??a sin necesidad.
  favoritos: Favorito[];
  idsFavoritos: Set<number>;
  alternarFavorito: (viniloId: number) => Promise<ResultadoAccion>;
  refrescarFavoritos: () => Promise<ResultadoAccion>;
  vaciarFavoritos: () => Promise<ResultadoAccion>;
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
 * Fetch com??n de la API: siempre con credentials (cookie httpOnly) y siempre
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

// --- Helpers de presentacion ---

/** Las imagenes guardadas pueden ser relativas ("/uploads/x.jpg"): hay que prefixarlas. */
export function imgUrl(url: string | null | undefined): string {
  if (!url) return '';
  const primera = url.split(',')[0].trim();
  if (!primera) return '';
  if (primera.startsWith('http')) return primera;
  return `${apiUrl()}${primera.startsWith('/') ? '' : '/'}${primera}`;
}

/** MySQL devuelve 'YYYY-MM-DD HH:mm:ss' o un ISO de JSON.stringify: se normaliza. */
export function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return '';
  const fecha = new Date(valor.includes('T') ? valor : valor.replace(' ', 'T'));
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** La columna `items` es TEXT: si un dia guardaron algo roto, el pedido igual se muestra. */
export function itemsDePedido(pedido: PedidoCliente): ItemPedido[] {
  if (Array.isArray(pedido.items)) return pedido.items;
  if (typeof pedido.items !== 'string') return [];
  try {
    const parseado: unknown = JSON.parse(pedido.items);
    return Array.isArray(parseado) ? (parseado as ItemPedido[]) : [];
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
