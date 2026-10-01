// ==========================================
// CUPON DEL CARRITO: persistencia y re-validacion
// ==========================================
// POR QUE VIVE ACA Y NO DENTRO DE Cart.tsx
//   App.tsx solo monta <Cart> en la vista del carrito (App.tsx:256), asi que
//   cada vez que el cliente sale a mirar el catalogo el componente se desmonta
//   y se pierde todo lo que estuviera en useState. El carrito en si sobrevive
//   (vive en App), pero el cupon no: volvia el total completo sin avisar.
//   Por eso el cupon aplicado se guarda en localStorage y, ademas, se
//   RE-VALIDA contra el server al montar.
//
// POR QUE HAY QUE RE-VALIDAR Y NO ALCANZA CON LEER DEL ALMACENAMIENTO
//   Lo que quedo guardado en el navegador es una foto de hace un rato. La
//   unica fuente de verdad de si un cupon sigue sirviendo es
//   POST /api/cupones/validar (que mira activo, fecha_expiracion y
//   usos_actuales contra la base). Un codigo que ayer hacia 20% hoy puede
//   estar vencido o agotado, y POST /api/pedidos aborta el pedido ENTERO con
//   400 si el cupon ya no sirve.

import { apiUrl } from './api';
import type { TipoCupon } from '../types/database';

// Clave del cupon en localStorage. Vive en una sola constante para no repetir
// el string en los tres puntos que la tocan (leer, guardar, borrar).
const CLAVE_CUPON = 'guacamayo:cupon-carrito:v1';

// Lo que devuelve POST /api/cupones/validar. A proposito NO es el tipo `Cupon`
// de la base: la ruta publica manda solo estos cuatro campos (la fecha y los
// usos se los lleva el server y no los necesita el carrito).
export interface CuponValidado {
  id: number;
  codigo: string;
  tipo: TipoCupon;
  valor: number;
}

// Como termino la validacion. Cada estado dice QUE HAY QUE HACER con el cupon
// guardado, que es lo que evita mostrar un descuento que el server no va a
// cobrar.
export type ResultadoValidacion =
  /** 200: el cupon sigue vigente, se puede volver a mostrar. */
  | { estado: 'vigente'; cupon: CuponValidado }
  /** 400: no existe, esta desactivado, vencio o agoto los usos. Este es el UNICO
   *  resultado que autoriza a borrar el cupon guardado. */
  | { estado: 'invalido'; mensaje: string }
  /** 429: rate limit de la ruta. No dice NADA del cupon (puede ser perfectamente
   *  valido: solo que no se pudo comprobar), asi que el que llama lo conserva y
   *  bloquea el pedido en vez de cobrar sin descuento. */
  | { estado: 'muchos_intentos'; mensaje: string }
  /** El fetch revento: no se pudo comprobar nada. */
  | { estado: 'sin_conexion'; mensaje: string };

/**
 * Valida y NORMALIZA lo que llega del servidor o del almacenamiento.
 *
 * OJO con `valor`: la columna `cupones.valor` es DECIMAL y mysql2 devuelve los
 * DECIMAL como STRING ("20.00"), as?? que el tipo del front lo declara `number`
 * pero en runtime llega texto. Por eso ac?? se pasa todo por Number(): si no,
 * un cup??n que est?? perfecto se tomar??a por inv??lido.
 *
 * Devuelve null si el shape no es el esperado (JSON corrupto, versi??n vieja del
 * contrato): el que llama lo trata como "no hay cup??n".
 */
function aCuponValido(bruto: unknown): CuponValidado | null {
  if (typeof bruto !== 'object' || bruto === null) return null;
  const v = bruto as Record<string, unknown>;
  if (typeof v.codigo !== 'string' || !v.codigo) return null;
  if (v.tipo !== 'porcentaje' && v.tipo !== 'fijo') return null;
  const id = Number(v.id);
  const valor = Number(v.valor);
  if (!Number.isFinite(id) || !Number.isFinite(valor)) return null;
  return { id, codigo: v.codigo, tipo: v.tipo, valor };
}

export function leerCuponGuardado(): CuponValidado | null {
  try {
    const crudo = localStorage.getItem(CLAVE_CUPON);
    if (!crudo) return null;
    return aCuponValido(JSON.parse(crudo) as unknown);
  } catch {
    // Almacenamiento bloqueado (modo privado) o JSON roto: se arranca sin cupon.
    return null;
  }
}

export function guardarCupon(cupon: CuponValidado): void {
  try {
    localStorage.setItem(CLAVE_CUPON, JSON.stringify(cupon));
  } catch {
    // Sin almacenamiento no hay persistencia, pero el carrito sigue funcionando.
  }
}

export function borrarCuponGuardado(): void {
  try {
    localStorage.removeItem(CLAVE_CUPON);
  } catch {
    // Ver guardarCupon().
  }
}

/**
 * El server termina sus mensajes con punto en unos casos y en otros no
 * ("Cup??n inv??lido o vencido" vs "...en unos minutos."). La UI siempre mete el
 * motivo en medio de una frase y cierra con su propio punto, as?? que el final se
 * normaliza ac?? para no terminar con "minutos..".
 */
function sinPuntoFinal(mensaje: string): string {
  return mensaje.trim().replace(/[.\s]+$/, '');
}

/**
 * Consulta POST /api/cupones/validar y traduce el status HTTP al estado que la
 * UI sabe pintar. Nunca tira: los errores de red tambien son un resultado.
 */
export async function validarCupon(codigo: string): Promise<ResultadoValidacion> {
  const limpio = codigo.trim().toUpperCase();
  if (!limpio) return { estado: 'invalido', mensaje: 'no se ingres?? ning??n c??digo' };

  let res: Response;
  try {
    res = await fetch(`${apiUrl()}/api/cupones/validar`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: limpio })
    });
  } catch {
    return { estado: 'sin_conexion', mensaje: 'no hay conexi??n con el servidor' };
  }

  const cuerpo: unknown = await res.json().catch(() => null);
  const error = (cuerpo as { error?: unknown } | null)?.error;
  const delServer = typeof error === 'string' && error ? sinPuntoFinal(error) : '';

  if (res.status === 429) {
    // El 429 dice "esper?? unos minutos" (server.js:718) y el 400 dice "cup??n
    // inv??lido" (server.js:730). Son dos motivos distintos para el cliente, asi
    // que se muestra el texto del server en los dos casos en vez de inventar uno
    // propio: si el server cambia la ventana del rate limit, el texto cambia con
    // ??l.
    return {
      estado: 'muchos_intentos',
      mensaje: delServer || 'hiciste demasiadas consultas de cupones en muy poco tiempo'
    };
  }
  if (!res.ok) {
    return { estado: 'invalido', mensaje: delServer || 'cup??n inv??lido o vencido' };
  }
  const cupon = aCuponValido(cuerpo);
  if (!cupon) {
    return { estado: 'invalido', mensaje: 'el servidor no devolvi?? un cup??n v??lido' };
  }
  return { estado: 'vigente', cupon };
}

/**
 * "20%" o "USD 5.00" para los textos de la UI y del mensaje de WhatsApp.
 *
 * El fijo sale con dos decimales siempre (aunque el cup??n valga 5 exacto) para
 * que el beneficio se lea igual al descuento que calcula el server y al que
 * muestra el panel: mezclar "USD 5" con "-USD 5.00" en la misma pantalla obliga
 * a traducci??n mental.
 */
export function textoBeneficio(cupon: Pick<CuponValidado, 'tipo' | 'valor'>): string {
  return cupon.tipo === 'porcentaje' ? `${cupon.valor}%` : `USD ${cupon.valor.toFixed(2)}`;
}
