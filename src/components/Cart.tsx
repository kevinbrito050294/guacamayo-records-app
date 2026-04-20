import { useState, useMemo } from 'react';
import { CarritoItem, ConfiguracionDivisa } from '../types/database';
import { Trash2, ShoppingBag, X, MessageCircle, Minus, Plus, Disc, Ticket } from 'lucide-react';

interface CartProps {
  items: CarritoItem[];
  onRemoveItem: (id: string) => void;
  onUpdateCantidad: (id: string, nuevaCantidad: number) => void;
  onBack: () => void;
  onClear: () => void;
  divisaPreferida?: string;
  tasas: ConfiguracionDivisa[];
}

export function Cart({ 
  items, 
  onRemoveItem, 
  onUpdateCantidad, 
  onBack, 
  onClear, 
  divisaPreferida = 'ARS',
  tasas 
}: CartProps) {
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'https://guacamayorecords.up.railway.app';

  // --- LÓGICA DE CÁLCULO LOCAL ---
  const { subtotalUsd, tasaBlue } = useMemo(() => {
    const blue = tasas.find(t => t.tipo === 'DOLAR_BLUE')?.tasa || 1;
    const usd = items.reduce((acc, item) => acc + (item.vinilo.precio_venta * item.cantidad), 0);
    
    return { subtotalUsd: usd, tasaBlue: blue };
  }, [items, tasas]);

  const calcularDescuento = () => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.tipo === 'porcentaje') {
      return (subtotalUsd * appliedCoupon.valor) / 100;
    }
    return appliedCoupon.valor;
  };

  const descuentoUsd = calcularDescuento();
  const totalUsd = Math.max(0, subtotalUsd - descuentoUsd);
  const totalArs = totalUsd * tasaBlue;

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setCouponLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cupones/validar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: couponCode.toUpperCase() })
      });
      const data = await res.json();
      if (res.ok) {
        setAppliedCoupon(data);
      } else {
        alert("❌ " + (data.error || "Cupón inválido"));
        setAppliedCoupon(null);
      }
    } catch (e) {
      alert("Error al validar cupón");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleConfirmarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const datosPedido = {
        nombre_cliente: nombre,
        whatsapp_cliente: whatsapp,
        total_pago: totalUsd,
        divisa_preferida: divisaPreferida,
        cupon_id: appliedCoupon?.id || null,
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
        (appliedCoupon ? `🎟️ Cupón: ${appliedCoupon.codigo} (-${appliedCoupon.tipo === 'porcentaje' ? appliedCoupon.valor + '%' : 'USD ' + appliedCoupon.valor})\n` : '') +
        `💰 *TOTAL A PAGAR: $${Math.round(totalArs).toLocaleString('es-AR')} ARS*\n` +
        `_(Ref: USD ${totalUsd.toFixed(2)})_\n\n` +
        `¿Me pasan los datos para la transferencia?`;
      
      const telTienda = "5491164475028";
      window.open(`https://wa.me/${telTienda}?text=${encodeURIComponent(mensajeWA)}`, '_blank');

      onClear();
      onBack();
      alert(`✅ Pedido #${data.numero_orden} registrado.`);

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
              const precioItemArs = item.vinilo.precio_venta * tasaBlue;
              return (
                <div key={item.vinilo.id} className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-3xl border border-transparent dark:border-slate-800 group hover:border-amber-500/30 transition-all">
  <div className="flex gap-3 items-center">
    <img 
      src={item.vinilo.imagen_url?.split(',')[0] || ''} 
      className="h-16 w-16 object-cover rounded-2xl shadow-md flex-shrink-0" 
      alt={item.vinilo.titulo} 
    />
    <div className="flex-grow min-w-0">
      <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase leading-tight mb-1 break-words whitespace-normal">{item.vinilo.titulo}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium break-words whitespace-normal">{item.vinilo.artista}</p>
    </div>
    <button onClick={() => onRemoveItem(item.vinilo.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1 flex-shrink-0 self-start">
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
  <div className="flex items-center justify-between pl-1">
            <p className="text-[11px] text-amber-600 dark:text-amber-500 font-black uppercase">
            ARS ${Math.round(precioItemArs * item.cantidad).toLocaleString('es-AR')}
            </p>
            <div className="flex gap-1 flex-wrap">
    {item.vinilo.calidad && (
      <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-500 uppercase tracking-wider">
        {item.vinilo.calidad}
      </span>
    )}
    {item.vinilo.pais_origen && (
      <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-500 uppercase tracking-wider">
        {item.vinilo.pais_origen}
      </span>
    )}
  </div>
              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-1.5 shadow-sm">
              <button type="button" onClick={() => onUpdateCantidad(item.vinilo.id, item.cantidad - 1)} disabled={item.cantidad <= 1} className="p-1 hover:text-amber-500 dark:text-slate-400 disabled:opacity-20">
              <Minus size={14}/>
              </button>
              <span className="font-black text-xs w-4 text-center dark:text-white">{item.cantidad}</span>
              <button 
              type="button" 
              onClick={() => onUpdateCantidad(item.vinilo.id, item.cantidad + 1)} 
              disabled={item.cantidad >= item.vinilo.stock_actual}
              className="p-1 hover:text-amber-500 dark:text-slate-400 disabled:opacity-20"
      >
              <Plus size={14}/>
              </button>
              </div>
              </div>
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
            <div className="mb-6 space-y-2">
              <label className="text-[10px] uppercase font-black text-slate-500 ml-1 tracking-widest">Cupón de Descuento</label>
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    placeholder="Tengo un código" 
                    value={couponCode} 
                    onChange={e => setCouponCode(e.target.value)}
                    disabled={appliedCoupon}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs focus:ring-1 focus:ring-amber-500 outline-none uppercase font-bold"
                  />
                </div>
                {appliedCoupon ? (
                  <button onClick={() => {setAppliedCoupon(null); setCouponCode('');}} className="bg-red-500/20 text-red-500 px-3 rounded-xl hover:bg-red-500/30 transition-all"><X size={16}/></button>
                ) : (
                  <button 
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponCode}
                    className="bg-slate-800 hover:bg-amber-500 hover:text-slate-950 px-4 rounded-xl text-[10px] font-black transition-all disabled:opacity-20"
                  >
                    {couponLoading ? <Disc size={14} className="animate-spin"/> : "APLICAR"}
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleConfirmarPedido} className="space-y-5">
              <input 
                required placeholder="Tu Nombre" value={nombre} onChange={e => setNombre(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 px-5 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all" 
              />
              <input 
                required placeholder="WhatsApp (ej: 1164475028)" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 px-5 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all" 
              />

              <div className="mt-10 pt-8 border-t border-white/5 space-y-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total en Pesos</span>
                  <p className="text-4xl font-black text-white italic tracking-tighter leading-none">
                    ${Math.round(totalArs).toLocaleString('es-AR')}
                  </p>
                </div>
                <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase italic">Referencia:</span>
                  <span className="text-sm font-mono font-black text-amber-500/80">USD ${totalUsd.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full mt-8 bg-amber-500 hover:bg-white text-slate-950 py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? <Disc size={20} className="animate-spin" /> : <MessageCircle size={20} />}
                {loading ? "PROCESANDO..." : "ENVIAR PEDIDO"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}