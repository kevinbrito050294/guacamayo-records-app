import { ConfiguracionDivisa, PreciosConvertidos } from '../types/database';

let tasasCache: { [key: string]: number } = {};
let lastFetch = 0;

// Consultamos a nuestro propio servidor Node.js (MySQL)
async function obtenerTasas() {
  const ahora = Date.now();
  
  // Si pedimos tasas hace menos de 1 minuto, usamos la memoria (caché)
  if (Object.keys(tasasCache).length > 0 && ahora - lastFetch < 60000) {
    return tasasCache;
  }

  try {
    const response = await fetch('http://localhost:3001/api/configuracion_divisas');
    if (!response.ok) throw new Error('No se pudo conectar con el servidor de tasas');
    
    const data: ConfiguracionDivisa[] = await response.json();

    const nuevasTasas: { [key: string]: number } = {};
    data.forEach((config) => {
      nuevasTasas[config.tipo] = config.tasa;
    });

    tasasCache = nuevasTasas;
    lastFetch = ahora;
    return tasasCache;
  } catch (error) {
    console.error('Error fetching exchange rates from MySQL:', error);
    // Si falla la red, devolvemos valores por defecto para que la app no rompa
    return { 'DOLAR_BLUE': tasasCache['DOLAR_BLUE'] || 1200, 'USDT': tasasCache['USDT'] || 1150 };
  }
}

export async function convertirPrecio(precioUSD: number): Promise<PreciosConvertidos> {
  const tasas = await obtenerTasas();
  
  // Obtenemos los valores de las tasas (asegurándonos de que existan)
  const blue = tasas['DOLAR_BLUE'] || 1200;
  const usdt = tasas['USDT'] || 1150;

  return {
    usd: Math.round(precioUSD * 100) / 100,
    ars: Math.round(precioUSD * blue * 100) / 100,
    usdt: Math.round((precioUSD * blue / usdt) * 10000) / 10000,
  };
}

// Esta función ahora también usa FETCH para actualizar MySQL
export async function actualizarTasa(tipo: 'DOLAR_BLUE' | 'USDT', nuevaTasa: number) {
  const response = await fetch(`http://localhost:3001/api/configuracion_divisas/${tipo}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasa: nuevaTasa })
  });

  if (!response.ok) {
    throw new Error('Error al actualizar la tasa en MySQL');
  }

  // Limpiamos la caché para que la próxima consulta traiga el valor nuevo
  lastFetch = 0;
  tasasCache = {}; 
  return obtenerTasas();
}

export function formatearPrecio(precio: number, divisa: 'USD' | 'ARS' | 'USDT' = 'ARS'): string {
  const config = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: divisa === 'ARS' ? 'ARS' : 'USD',
    minimumFractionDigits: divisa === 'USDT' ? 4 : 2,
  });

  return config.format(precio);
}