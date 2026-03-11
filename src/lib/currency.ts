import { ConfiguracionDivisa, PreciosConvertidos } from '../types/database';

let tasasCache: { [key: string]: number } = {};
let lastFetch = 0;

// Determinamos la URL base dinámicamente
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001' 
  : 'https://guacamayorecords.up.railway.app';

// Consultamos a nuestro propio servidor Node.js (MySQL)
async function obtenerTasas() {
  const ahora = Date.now();
  
  // Si pedimos tasas hace menos de 1 minuto, usamos la memoria (caché)
  if (Object.keys(tasasCache).length > 0 && ahora - lastFetch < 60000) {
    return tasasCache;
  }

  try {
    // Usamos la URL dinámica aquí
    const response = await fetch(`${API_BASE_URL}/api/configuracion_divisas`);
    
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
    console.error('⚠️ Error fetching exchange rates:', error);
    
    // Fallback inteligente: si falla, intenta usar la caché vieja o valores seguros
    return { 
      'DOLAR_BLUE': tasasCache['DOLAR_BLUE'] || 1250, 
      'USDT': tasasCache['USDT'] || 1200 
    };
  }
}

export async function convertirPrecio(precioUSD: number): Promise<PreciosConvertidos> {
  const tasas = await obtenerTasas();
  
  const blue = tasas['DOLAR_BLUE'] || 1250;
  const usdt = tasas['USDT'] || 1200;

  return {
    usd: Math.round(precioUSD * 100) / 100,
    ars: Math.round(precioUSD * blue * 100) / 100,
    // Cálculo de USDT: Precio USD original ajustado a la tasa USDT
    usdt: Math.round((precioUSD * (blue / usdt)) * 10000) / 10000,
  };
}

export async function actualizarTasa(tipo: 'DOLAR_BLUE' | 'USDT', nuevaTasa: number) {
  const response = await fetch(`${API_BASE_URL}/api/configuracion_divisas/${tipo}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasa: nuevaTasa })
  });

  if (!response.ok) {
    throw new Error('Error al actualizar la tasa en MySQL');
  }

  lastFetch = 0;
  tasasCache = {}; 
  return obtenerTasas();
}

export function formatearPrecio(precio: number, divisa: 'USD' | 'ARS' | 'USDT' = 'ARS'): string {
  // Configuración especial para que el peso argentino se vea natural
  if (divisa === 'ARS') {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0, // Los pesos solemos verlos sin centavos hoy en día
      maximumFractionDigits: 0,
    }).format(precio);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: divisa === 'USDT' ? 4 : 2,
  }).format(precio).replace('$', divisa === 'USDT' ? '₮ ' : '$ ');
}