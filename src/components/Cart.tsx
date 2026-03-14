import { useState, useEffect } from 'react';
import { CarritoItem, PreciosConvertidos } from '../types/database';
import { Trash2, ShoppingBag, X, MessageCircle, Minus, Plus, Disc } from 'lucide-react';
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
      const API_BASE_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : 'https://guacamayorecords.up.railway.app';

      // NOTA: Enviamos 'items' como string JSON para que el server lo guarde y podamos 
      // recuperarlo al cancelar para devolver el stock.
      const datosPedido = {
        nombre_cliente: nombre,
        whatsapp_cliente: whatsapp,
        total_pago: totalUsd,
        divisa_preferida: divisaPreferida,
        items: items.map(item => ({
          id: item.vinilo.id,
          cantidad: item.cantidad,
          titulo: item.vinilo.titulo
        }))
      };

      const response = await fetch(`${API_BASE_URL}/api/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosPedido)
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Error al procesar');

      const listaVinilos = items.map(i => `- ${i.cantidad}x *${i.vinilo.titulo}*`).join('\n');
      const mensajeWA = `¡Hola Guacamayo Records! 🦜\n\n` +
        `📦 *PEDIDO: #${data.numero_orden}*\n` +
        `👤 Cliente: ${nombre}\n` +
        `🎸 Discos:\n${listaVinilos}\n\n` +
        `💰 *TOTAL: USD ${totalUsd.toFixed(2)}*\n` +
        `¿Me confirman para coordinar el pago?`;
      
      const telTienda = "5491164475028";
      window.open(`https://wa.me/${telTienda}?text=${encodeURIComponent(mensajeWA)}`, '_blank');

      onClear();
      onBack();
      alert(`✅ Pedido #${data.numero_orden} registrado con éxito.`);

    } catch (error: any) {
      alert("❌ Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row overflow-hidden my-4 transition-all">
      
      <div className="flex-grow p-6 md:p-10 border-r border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20">
              <ShoppingBag className="w-6 h-6 text-slate-950" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Tu Selección</h2>
          </div>
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {items.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center opacity-30">
              <Disc size={48} className="animate-spin-slow mb-4" />
              <p className="font-bold uppercase tracking-widest text-xs">El carrito está vacío</p>
            </div>
          ) : (
            items.map((item) => {
              // Validamos si hay stock disponible para subir
              const tieneStockDisponible = item.cantidad < item.vinilo.stock_actual;

              return (
                <div key={item.vinilo.id} className="flex gap-4 items-center bg-slate-50 dark:bg-slate-800/40 p-4 rounded-3xl border border-transparent dark:border-slate-800 group hover:border-amber-500/30 transition-all">
                  <img 
                    src={item.vinilo.imagen_url?.split(',')[0] || ''} 
                    className="h-20 w-20 object-cover rounded-2xl shadow-md group-hover:rotate-3 transition-transform" 
                    alt={item.vinilo.titulo} 
                  />
                  
                  <div className="flex-grow min-w-0">
                    <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase truncate mb-1">{item.vinilo.titulo}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{item.vinilo.artista}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-[10px] text-amber-600 dark:text-amber-500 font-black uppercase">
                        Subtotal: ARS {Math.round((preciosMap[item.vinilo.id]?.ars || 0) * item.cantidad).toLocaleString('es-AR')}
                      </p>
                      <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">
                        Stock: {item.vinilo.stock_actual}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-1.5 shadow-sm">
                    <button type="button" onClick={() => onUpdateCantidad(item.vinilo.id, item.cantidad - 1)} disabled={item.cantidad <= 1} className="p-1 hover:text-amber-500 dark:text-slate-400 disabled:opacity-20">
                      <Minus size={14}/>
                    </button>
                    <span className="font-black text-xs w-4 text-center dark:text-white">{item.cantidad}</span>
                    <button 
                      type="button" 
                      onClick={() => onUpdateCantidad(item.vinilo.id, item.cantidad + 1)} 
                      disabled={!tieneStockDisponible}
                      className={`p-1 transition-colors ${tieneStockDisponible ? 'hover:text-amber-500 dark:text-slate-400' : 'text-slate-200 dark:text-slate-800 cursor-not-allowed'}`}
                      title={!tieneStockDisponible ? "No hay más stock disponible" : ""}
                    >
                      <Plus size={14}/>
                    </button>
                  </div>

                  <button onClick={() => onRemoveItem(item.vinilo.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="w-full md:w-96 bg-slate-950 text-white p-8 md:p-10 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-black mb-8 text-amber-500 uppercase italic tracking-tighter">Finalizar Compra</h3>
            <form onSubmit={handleConfirmarPedido} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 ml-1 tracking-widest">Tu Nombre</label>
                <input 
                  required placeholder="Kevin Brito" value={nombre} onChange={e => setNombre(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 px-5 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-700" 
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 ml-1 tracking-widest">WhatsApp de contacto</label>
                <input 
                  required placeholder="11 6447 5028" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 px-5 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-700" 
                />
              </div>

              <div className="mt-10 pt-8 border-t border-white/5 space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Final</span>
                  <span className="text-3xl font-black text-white italic tracking-tighter">USD ${totalUsd.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full mt-8 bg-amber-500 hover:bg-white text-slate-950 py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-amber-500/10"
              >
                {loading ? <Disc size={20} className="animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                {loading ? "PROCESANDO..." : "ENVIAR PEDIDO"}
              </button>
            </form>
          </div>
          
          <div className="mt-8 text-center opacity-20">
            <p className="text-[8px] uppercase font-black tracking-[0.2em]">Guacamayo Records &copy; 2026</p>
          </div>
        </div>
      )}
    </div>
  );
}