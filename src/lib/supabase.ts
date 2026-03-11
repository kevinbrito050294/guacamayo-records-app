// Este archivo ahora actúa como el puente a tu MySQL local en lugar de Supabase
const API_URL = 'http://localhost:3001/api';

export const api = {
  // Obtener todos los vinilos
  async getVinilos() {
    const response = await fetch(`${API_URL}/vinilos`);
    if (!response.ok) throw new Error('Error al conectar con el servidor MySQL');
    return await response.json();
  },

  // Obtener vinilos con filtros (por género o calidad)
  async buscarVinilos(genero?: string, calidad?: string) {
    const params = new URLSearchParams();
    if (genero) params.append('genero', genero);
    if (calidad) params.append('calidad', calidad);
    
    const response = await fetch(`${API_URL}/vinilos/buscar?${params.toString()}`);
    return await response.json();
  },

  // Guardar un nuevo pedido
  async crearPedido(datosPedido: any) {
    const response = await fetch(`${API_URL}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosPedido),
    });
    return await response.json();
  }
};

// Mantenemos una exportación vacía de 'supabase' por si otros archivos la llaman, 
// para que no den error inmediato, pero ya no la usaremos.
export const supabase = {} as any;