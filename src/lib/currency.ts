import { ConfiguracionDivisa, DecimalValue, MonedaPrecio, PreciosConvertidos, TasasCambio } from '../types/database';
import { apiUrl } from './api';

let tasasCache: { [key: string]: number } = {};
let lastFetch = 0;

// Determinamos la URL base dinámicamente
const API_BASE_URL = apiUrl();

function decimalToNumber(value: DecimalValue): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Consultamos a nuestro propio servidor Node.js (MySQL)
async function obtenerTasas() {
  const ahora = Date.now();
  
  // Si pedimos tasas hace menos de 1 minuto, usamos la memoria (caché)
  if (Object.keys(tasasCache).length > 0 && ahora - lastFetch < 60000) {
    return tasasCache;
  }

  try {
    // Usamos la URL dinámica aquí
    const response = await fetch(`${API_BASE_URL}/api/configuracion_divisas`, { credentials: 'include' });
    
    if (!response.ok) throw new Error('No se pudo conectar con el servidor de tasas');
    
    const data: ConfiguracionDivisa[] = await response.json();

    const nuevasTasas: { [key: string]: number } = {};
    data.forEach((config) => {
      nuevasTasas[config.tipo] = decimalToNumber(config.tasa);
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

export async function obtenerTasasDisponibles(): Promise<TasasCambio> {
  const tasas = await obtenerTasasSinFallback();
  if (tasas.DOLAR_BLUE <= 0 || tasas.USDT <= 0) {
    throw new Error('Faltan tasas válidas de DOLAR_BLUE y USDT');
  }
  return tasas;
}

async function obtenerTasasSinFallback(): Promise<TasasCambio> {
  const ahora = Date.now();
  if (tasasCache.DOLAR_BLUE > 0 && tasasCache.USDT > 0 && ahora - lastFetch < 60000) {
    return { DOLAR_BLUE: tasasCache.DOLAR_BLUE, USDT: tasasCache.USDT };
  }

  const response = await fetch(`${API_BASE_URL}/api/configuracion_divisas`, { credentials: 'include' });
  if (!response.ok) throw new Error('No se pudo cargar la configuración de tasas');

  const data: ConfiguracionDivisa[] = await response.json();
  const nuevasTasas = {
    DOLAR_BLUE: decimalToNumber(data.find(config => config.tipo === 'DOLAR_BLUE')?.tasa ?? 0),
    USDT: decimalToNumber(data.find(config => config.tipo === 'USDT')?.tasa ?? 0),
  };
  tasasCache = nuevasTasas;
  lastFetch = ahora;
  return nuevasTasas;
}

export function convertirDesdeUsd(precioUSD: number, moneda: MonedaPrecio, tasas: TasasCambio): number {
  if (moneda === 'USD') return Math.round(precioUSD * 100) / 100;
  if (moneda === 'ARS') return Math.round(precioUSD * tasas.DOLAR_BLUE * 100) / 100;
  return Math.round(precioUSD * (tasas.DOLAR_BLUE / tasas.USDT) * 10000) / 10000;
}

export function convertirAUsd(precio: number, moneda: MonedaPrecio, tasas: TasasCambio): number {
  if (moneda === 'USD') return precio;
  if (moneda === 'ARS') return precio / tasas.DOLAR_BLUE;
  return precio * tasas.USDT / tasas.DOLAR_BLUE;
}

export async function convertirPrecio(precioUSD: number): Promise<PreciosConvertidos> {
  const tasas = await obtenerTasas();
  
  const blue = decimalToNumber(tasas['DOLAR_BLUE']) || 1250;
  const usdt = decimalToNumber(tasas['USDT']) || 1200;

  return {
    usd: Math.round(precioUSD * 100) / 100,
    ars: Math.round(precioUSD * blue * 100) / 100,
    // Cálculo de USDT: Precio USD original ajustado a la tasa USDT
    usdt: Math.round((precioUSD * (blue / usdt)) * 10000) / 10000,
  };
}

export async function actualizarTasa(tipo: 'DOLAR_BLUE' | 'USDT', nuevaTasa: DecimalValue) {
  const tasa = decimalToNumber(nuevaTasa);
  if (tasa <= 0) throw new Error('La tasa debe ser mayor a 0');

  const response = await fetch(`${API_BASE_URL}/api/configuracion_divisas/${tipo}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasa })
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
