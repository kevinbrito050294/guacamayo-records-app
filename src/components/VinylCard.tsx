import { useState } from 'react';
import { ViniloCatalogo, PreciosConvertidos, CarritoItem } from '../types/database';
import { Plus, ShoppingCart, X, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface VinylCardProps {
  vinilo: ViniloCatalogo;
  precios?: PreciosConvertidos;
  onAdd: () => void;
  divisaActiva: 'USD' | 'ARS' | 'USDT';
  carrito: CarritoItem[]; // <-- Agregamos el carrito para validar stock en tiempo real
}

export function VinylCard({ vinilo, precios, onAdd, divisaActiva, carrito }: VinylCardProps) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [fotoActual, setFotoActual] = useState(0);

  // LOGICA DE STOCK DINÁMICO
  const itemEnCarrito = carrito.find(item => item.vinilo.id === vinilo.id);
  const cantidadEnCarrito = itemEnCarrito ? itemEnCarrito.cantidad : 0;
  
  const sinStockReal = vinilo.stock_actual === 0;
  const limiteAlcanzado = cantidadEnCarrito >= vinilo.stock_actual;
  const botonBloqueado = sinStockReal || limiteAlcanzado;

  const imagenes = vinilo.imagen_url ? vinilo.imagen_url.split(',') : [];
  const hayVariasFotos = imagenes.length > 1;

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
      <div className={`bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-2xl transition-all duration-300 group ${limiteAlcanzado && !sinStockReal ? 'ring-2 ring-amber-500/30' : ''}`}>
        
        {/* IMAGEN DEL VINILO CON NAVEGACIÓN INTERNA */}
        <div 
          className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-zoom-in"
          onClick={() => !sinStockReal && imagenes.length > 0 && setModalAbierto(true)}
        >
          <img 
            src={imagenes[fotoActual] || 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=500'} 
            alt={vinilo.titulo}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ${sinStockReal ? 'grayscale opacity-50' : ''}`}
          />
          
          {/* FLECHAS EN LA CARD */}
          {!sinStockReal && hayVariasFotos && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
              <button onClick={fotoAnterior} className="p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full text-slate-900 dark:text-white shadow-lg hover:bg-amber-500 hover:text-white transition-all">
                <ChevronLeft size={20} />
              </button>
              <button onClick={proximaFoto} className="p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full text-slate-900 dark:text-white shadow-lg hover:bg-amber-500 hover:text-white transition-all">
                <ChevronRight size={20} />
              </button>
            </div>
          )}

          {/* INDICADOR DE POSICIÓN */}
          {!sinStockReal && hayVariasFotos && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {imagenes.map((_, idx) => (
                <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${idx === fotoActual ? 'w-4 bg-amber-500' : 'w-1.5 bg-white/50'}`} />
              ))}
            </div>
          )}

          {/* BADGE DE ESTADO DINÁMICO */}
          <div className={`absolute top-4 right-4 ${sinStockReal ? 'bg-red-500' : limiteAlcanzado ? 'bg-orange-600' : 'bg-slate-900/90 dark:bg-amber-500'} text-white dark:text-slate-950 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider shadow-lg z-20`}>
            {sinStockReal ? 'Agotado' : limiteAlcanzado ? 'Límite alcanzado' : vinilo.calidad || 'Nuevo'}
          </div>
        </div>
        
        {/* CONTENIDO DE LA CARD */}
        <div className="p-6">
          <h3 className="font-black text-2xl text-slate-900 dark:text-white truncate italic uppercase tracking-tighter leading-none mb-1">{vinilo.titulo}</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-5">{vinilo.artista}</p>
          
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                {limiteAlcanzado && !sinStockReal ? 'Sin más stock' : (divisaActiva === 'ARS' ? 'Precio ARS' : 'Precio Final')}
              </span>
              {!sinStockReal ? (
                <>
                  <p className={`text-2xl font-black tracking-tighter transition-colors ${limiteAlcanzado ? 'text-orange-500' : 'text-slate-900 dark:text-amber-500'}`}>
                    {renderPrecioPrincipal()}
                  </p>
                  {divisaActiva !== 'USD' && <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Ref: USD {Number(vinilo.precio_venta).toFixed(2)}</p>}
                </>
              ) : <p className="text-xl font-bold text-slate-400 line-through tracking-tighter">{renderPrecioPrincipal()}</p>}
            </div>
            
            <button 
              onClick={onAdd} 
              disabled={botonBloqueado} 
              className={`p-4 rounded-2xl transition-all shadow-lg active:scale-90 ${
                botonBloqueado 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-700 shadow-none' 
                : 'bg-amber-500 hover:bg-slate-900 dark:hover:bg-white text-slate-950 dark:hover:text-slate-900 shadow-amber-500/20'
              }`}
            >
              {sinStockReal ? (
                <ShoppingCart className="w-6 h-6 opacity-20" />
              ) : limiteAlcanzado ? (
                <AlertCircle className="w-6 h-6" />
              ) : (
                <Plus className="w-6 h-6 stroke-[3px]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE GALERÍA */}
      {modalAbierto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 md:p-10 transition-all">
          <button onClick={() => setModalAbierto(false)} className="absolute top-6 right-6 text-white/50 hover:text-white z-50 p-2 bg-white/10 rounded-full transition-colors"><X size={32}/></button>
          
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
            {hayVariasFotos && (
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
          </div>
        </div>
      )}
    </>
  );
}