import { useState, useEffect } from 'react';
import { CarritoItem, PreciosConvertidos } from '../types/database';
import { Trash2, ShoppingBag, X, MessageCircle, Minus, Plus } from 'lucide-react';
import { convertirPrecio } from '../lib/currency';

interface CartProps {
  items: CarritoItem[];
  onRemoveItem: (id: string) => void;
  onUpdateCantidad: (id: string, nuevaCantidad: number) => void;
  onBack: () => void;
  onClear: () => void;
  divisaPreferida?: string;
}

export function Cart({ 
  items, 
  onRemoveItem, 
  onUpdateCantidad, 
  onBack, 
  onClear, 
  divisaPreferida = 'ARS' 
}: CartProps) {
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [preciosMap, setPreciosMap] = useState<{ [key: string]: PreciosConvertidos }>({});

  // Sincronización de precios según la tasa actual
  useEffect(() => {
    async function actualizarPrecios() {
      const nuevosPrecios: { [key: string]: PreciosConvertidos } = {};
      for (const item of items) {
        try {
          const precio = await convertirPrecio(item.vinilo.precio_venta);
          nuevosPrecios[item.vinilo.id] = precio;
        } catch (err) {
          nuevosPrecios[item.vinilo.id] = { usd: item.vinilo.precio_venta, ars: 0, usdt: 0 };
        }
      }
      setPreciosMap(nuevosPrecios);
    }
    if (items.length > 0) actualizarPrecios();
  }, [items]);

  const totalUsd = items.reduce((acc, item) => acc + (item.vinilo.precio_venta * item.cantidad), 0);

  const handleConfirmarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. DETERMINAR URL DEL BACKEND (Local vs Túnel)
      const API_BASE_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : `${window.location.protocol}//${window.location.host.replace(':5173', ':3001')}`;

      // 2. ESTRUCTURA DE DATOS PARA RAILWAY (Nombres de columnas exactos)
      const datosPedido = {
        nombre_cliente: nombre,
        whatsapp_cliente: whatsapp,
        total_pago: totalUsd,
        divisa_preferida: divisaPreferida, // Se integra para eliminar el warning de ESLint
        items: items.map(item => ({
          titulo: item.vinilo.titulo,
          artista: item.vinilo.artista,
          cantidad: item.cantidad,
          precio_unitario: item.vinilo.precio_venta
        }))
      };

      const response = await fetch(`${API_BASE_URL}/api/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosPedido)
      });

      if (!response.ok) throw new Error('Error al guardar en Railway');

      // 3. MENSAJE PARA WHATSAPP
      const listaVinilos = items.map(i => `- ${i.cantidad}x ${i.vinilo.titulo}`).join('\n');
      const mensajeWA = `¡Hola Guacamayo!\nPedido de ${nombre}:\n${listaVinilos}\nTotal: USD ${totalUsd.toFixed(2)}\nPreferencia: ${divisaPreferida}`;
      
      // Número de contacto de la tienda
      window.open(`https://wa.me/5491164475028?text=${encodeURIComponent(mensajeWA)}`, '_blank');

      onClear();
      onBack();
    } catch (error) {
      console.error("❌ Error en el proceso de pedido:", error);
      alert("No se pudo conectar con el servidor de Guacamayo Records.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row overflow-hidden my-4 transition-colors">
      
      {/* Columna de Productos */}
      <div className="flex-grow p-8 border-r border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-amber-500" />
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Mi Carrito</h2>
          </div>
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {items.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-medium">El carrito está vacío.</div>
          ) : (
            items.map((item) => (
              <div key={item.vinilo.id} className="flex gap-4 items-center bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-transparent dark:border-slate-800">
                <img src={item.vinilo.imagen_url || ''} className="h-16 w-16 object-cover rounded-lg shadow-sm" alt={item.vinilo.titulo} />
                <div className="flex-grow">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{item.vinilo.titulo}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.vinilo.artista}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">
                    ARS {Math.round((preciosMap[item.vinilo.id]?.ars || 0) * item.cantidad).toLocaleString('es-AR')}
                  </p>
                </div>
                
                <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg p-1 shadow-sm">
                  <button type="button" onClick={() => onUpdateCantidad(item.vinilo.id, item.cantidad - 1)} disabled={item.cantidad <= 1} className="p-1 hover:text-amber-500 dark:text-slate-400 disabled:opacity-30">
                    <Minus size={14}/>
                  </button>
                  <span className="font-bold text-sm w-4 text-center dark:text-white">{item.cantidad}</span>
                  <button type="button" onClick={() => onUpdateCantidad(item.vinilo.id, item.cantidad + 1)} className="p-1 hover:text-amber-500 dark:text-slate-400">
                    <Plus size={14}/>
                  </button>
                </div>

                <button onClick={() => onRemoveItem(item.vinilo.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Columna de Checkout */}
      {items.length > 0 && (
        <div className="w-full md:w-80 bg-slate-950 text-white p-8 flex flex-col">
          <h3 className="text-xl font-bold mb-6 text-amber-500">Checkout</h3>
          <form onSubmit={handleConfirmarPedido} className="space-y-4 flex-grow">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Nombre Completo</label>
              <input 
                required placeholder="Ej: Kevin Brito" value={nombre} onChange={e => setNombre(e.target.value)}
                className="w-full bg-slate-800 border-none rounded-lg py-3 px-4 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all" 
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">WhatsApp</label>
              <input 
                required placeholder="Ej: 1122334455" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                className="w-full bg-slate-800 border-none rounded-lg py-3 px-4 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all" 
              />
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800">
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-400 text-xs">Preferencia</span>
                <span className="text-slate-200 text-xs font-bold">{divisaPreferida}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Total a pagar</span>
                <span className="text-2xl font-black text-white">USD ${totalUsd.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full mt-6 bg-green-500 hover:bg-green-600 text-slate-950 py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <MessageCircle className="w-5 h-5" /> {loading ? "GUARDANDO..." : "CONFIRMAR PEDIDO"}
            </button>
          </form>
          
          <p className="text-[9px] text-slate-500 text-center mt-6 uppercase tracking-widest">
            Guacamayo Records &copy; 2026
          </p>
        </div>
      )}
    </div>
  );
}