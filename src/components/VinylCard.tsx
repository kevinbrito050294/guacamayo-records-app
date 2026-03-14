import { useState } from 'react';
import { ViniloCatalogo, PreciosConvertidos } from '../types/database';
import { Plus, ShoppingCart, Layers, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface VinylCardProps {
  vinilo: ViniloCatalogo;
  precios?: PreciosConvertidos;
  onAdd: () => void;
  divisaActiva: 'USD' | 'ARS' | 'USDT';
}

export function VinylCard({ vinilo, precios, onAdd, divisaActiva }: VinylCardProps) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [fotoActual, setFotoActual] = useState(0);
  const sinStock = vinilo.stock_actual === 0;

  const imagenes = vinilo.imagen_url ? vinilo.imagen_url.split(',') : [];
  const imagenPrincipal = imagenes.length > 0 
    ? imagenes[0] 
    : 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=500';

  const renderPrecioPrincipal = () => {
    if (!precios) return `USD ${Number(vinilo.precio_venta).toFixed(2)}`;
    switch (divisaActiva) {
      case 'ARS': return precios.ars > 0 ? `$${Math.round(precios.ars).toLocaleString('es-AR')}` : 'Consultar';
      case 'USDT': return `${precios.usdt.toFixed(2)} USDT`;
      default: return `USD ${Number(vinilo.precio_venta).toFixed(2)}`;
    }
  };

  const proximaFoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFotoActual((prev) => (prev + 1) % imagenes.length);
  };

  const fotoAnterior = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFotoActual((prev) => (prev - 1 + imagenes.length) % imagenes.length);
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-2xl transition-all duration-300 group">
        
        {/* IMAGEN CON CLICK PARA ABRIR MODAL */}
        <div 
          className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-zoom-in"
          onClick={() => imagenes.length > 0 && setModalAbierto(true)}
        >
          <img 
            src={imagenPrincipal} 
            alt={vinilo.titulo}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ${sinStock ? 'grayscale opacity-50' : ''}`}
          />
          
          {!sinStock && imagenes.length > 1 && (
            <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Layers size={14} className="text-amber-500" />
              <span className="text-[10px] font-black dark:text-white uppercase tracking-tighter">{imagenes.length} Fotos</span>
            </div>
          )}

          <div className={`absolute top-4 right-4 ${sinStock ? 'bg-red-500' : 'bg-slate-900/90 dark:bg-amber-500'} text-white dark:text-slate-950 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider shadow-lg`}>
            {sinStock ? 'Agotado' : vinilo.calidad || 'Nuevo'}
          </div>
        </div>
        
        {/* CONTENIDO DE LA CARD */}
        <div className="p-6">
          <h3 className="font-black text-2xl text-slate-900 dark:text-white truncate italic uppercase tracking-tighter">{vinilo.titulo}</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-5">{vinilo.artista}</p>
          
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{divisaActiva === 'ARS' ? 'Precio ARS' : 'Precio Final'}</span>
              {!sinStock ? (
                <>
                  <p className="text-2xl font-black text-slate-900 dark:text-amber-500 tracking-tighter">{renderPrecioPrincipal()}</p>
                  {divisaActiva !== 'USD' && <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Ref: USD {Number(vinilo.precio_venta).toFixed(2)}</p>}
                </>
              ) : <p className="text-xl font-bold text-slate-400 line-through tracking-tighter">{renderPrecioPrincipal()}</p>}
            </div>
            
            <button onClick={onAdd} disabled={sinStock} className={`p-4 rounded-2xl transition-all shadow-lg active:scale-90 ${sinStock ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 shadow-none' : 'bg-amber-500 hover:bg-slate-900 dark:hover:bg-white text-slate-950 dark:hover:text-slate-900'}`}>
              {sinStock ? <ShoppingCart className="w-6 h-6 opacity-20" /> : <Plus className="w-6 h-6 stroke-[3px]" />}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE GALERÍA (Solo si hay fotos) */}
      {modalAbierto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 md:p-10 transition-all">
          <button onClick={() => setModalAbierto(false)} className="absolute top-6 right-6 text-white/50 hover:text-white z-50 p-2 bg-white/10 rounded-full"><X size={32}/></button>
          
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
            {imagenes.length > 1 && (
              <>
                <button onClick={fotoAnterior} className="absolute left-0 z-50 p-3 bg-white/5 hover:bg-white/20 text-white rounded-full transition-all"><ChevronLeft size={40}/></button>
                <button onClick={proximaFoto} className="absolute right-0 z-50 p-3 bg-white/5 hover:bg-white/20 text-white rounded-full transition-all"><ChevronRight size={40}/></button>
              </>
            )}
            
            <div className="w-full h-full flex items-center justify-center">
              <img 
                src={imagenes[fotoActual]} 
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-300" 
                alt="Vista ampliada"
              />
            </div>

            {/* MINIATURAS E INFO */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-center">
              <h2 className="text-white font-black text-xl uppercase tracking-tighter italic">{vinilo.titulo}</h2>
              <p className="text-white/60 text-sm mb-4">{vinilo.artista}</p>
              <div className="flex justify-center gap-2">
                {imagenes.map((_, idx) => (
                  <div key={idx} className={`h-1.5 rounded-full transition-all ${idx === fotoActual ? 'w-8 bg-amber-500' : 'w-2 bg-white/20'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}