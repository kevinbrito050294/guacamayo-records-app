import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ViniloCatalogo, PreciosConvertidos, CarritoItem } from '../types/database';
import { Plus, ShoppingCart, X, ChevronLeft, ChevronRight, AlertCircle, Heart } from 'lucide-react';
// `precio_venta` es DECIMAL y llega como string: el formateo del precio en USD
// pasa por el helper que ya usan el catálogo, los favoritos y "mis pedidos", así
// que la card no inventa su propio `Number(...).toFixed(2)`.
import { importeUsd } from '../lib/cuenta';

interface VinylCardProps {
  vinilo: ViniloCatalogo;
  precios?: PreciosConvertidos;
  onAdd: () => void;
  divisaActiva: 'USD' | 'ARS' | 'USDT';
  carrito: CarritoItem[]; // <-- Agregamos el carrito para validar stock en tiempo real
  // Favoritos: opcionales para que la card siga sirviendo sin sesión.
  favorito?: boolean;
  onToggleFavorito?: (id: string) => void;
  abrirDetalle?: boolean;
  onCerrarDetalle?: () => void;
}

export function VinylCard({ vinilo, precios, onAdd, divisaActiva, carrito, favorito = false, onToggleFavorito, abrirDetalle = false, onCerrarDetalle }: VinylCardProps) {
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
  const cerrarDetalle = useCallback(() => {
    setModalAbierto(false);
    onCerrarDetalle?.();
  }, [onCerrarDetalle]);

  useEffect(() => {
    if (abrirDetalle) setModalAbierto(true);
  }, [abrirDetalle]);

  useEffect(() => {
    if (!modalAbierto) return;
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cerrarDetalle();
    };
    document.addEventListener('keydown', cerrarConEscape);
    return () => document.removeEventListener('keydown', cerrarConEscape);
  }, [cerrarDetalle, modalAbierto]);

  const renderPrecioPrincipal = () => {
    if (!precios) return importeUsd(vinilo.precio_venta);
    switch (divisaActiva) {
      case 'ARS': return precios.ars > 0 ? `$${Math.round(precios.ars).toLocaleString('es-AR')}` : 'Consultar';
      case 'USDT': return `${precios.usdt.toFixed(2)} USDT`;
      default: return importeUsd(vinilo.precio_venta);
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
      <div className={`bg-white dark:bg-slate-900 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-2xl transition-all duration-300 group ${limiteAlcanzado && !sinStockReal ? 'ring-2 ring-amber-500/30' : ''}`}>
        
        {/* IMAGEN DEL VINILO CON NAVEGACIÓN INTERNA */}
        <div 
          className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-zoom-in"
            onClick={() => imagenes.length > 0 && setModalAbierto(true)}
        >
          <img 
            src={imagenes[fotoActual] || 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=500'} 
            alt={vinilo.titulo}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ${sinStockReal ? 'grayscale opacity-50' : ''}`}
          />
          
          {/* FLECHAS EN LA CARD */}
          {!sinStockReal && hayVariasFotos && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-1.5 opacity-100 sm:px-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 z-10">
              <button onClick={fotoAnterior} className="p-1.5 sm:p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full text-slate-900 dark:text-white shadow-lg hover:bg-amber-500 hover:text-white transition-all">
                <ChevronLeft size={16} className="sm:h-5 sm:w-5" />
              </button>
              <button onClick={proximaFoto} className="p-1.5 sm:p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full text-slate-900 dark:text-white shadow-lg hover:bg-amber-500 hover:text-white transition-all">
                <ChevronRight size={16} className="sm:h-5 sm:w-5" />
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

          {/* CORAZÓN DE FAVORITO */}
          {onToggleFavorito && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFavorito(vinilo.id); }}
              aria-pressed={favorito}
              aria-label={favorito ? `Quitar ${vinilo.titulo} de favoritos` : `Agregar ${vinilo.titulo} a favoritos`}
              className={`absolute top-4 left-4 z-20 p-2 rounded-full shadow-lg backdrop-blur-md transition-all active:scale-90 ${
                favorito
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-white/90 dark:bg-slate-900/90 text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400'
              }`}
            >
              <Heart size={18} className={favorito ? 'fill-current' : ''} />
            </button>
          )}

          {/* BADGE DE ESTADO DINÁMICO */}
          <div className={`absolute top-4 right-4 ${sinStockReal ? 'bg-red-500' : limiteAlcanzado ? 'bg-orange-600' : 'bg-slate-900/90 dark:bg-amber-500'} text-white dark:text-slate-950 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider shadow-lg z-20`}>
            {sinStockReal ? 'Agotado' : limiteAlcanzado ? 'Límite alcanzado' : vinilo.calidad || 'Nuevo'}
          </div>
        </div>
        
        {/* CONTENIDO DE LA CARD */}
          <div className="p-3 sm:p-6">
           <h3 className="line-clamp-2 h-[2.35rem] text-[15px] font-black uppercase italic leading-[1.08] tracking-tighter text-slate-900 dark:text-white sm:h-[3.4rem] sm:text-2xl">{vinilo.titulo}</h3>
           <p className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-sm font-medium mb-2 sm:mb-3 truncate">{vinilo.artista}</p>
           <div className="flex gap-1 sm:gap-2 flex-wrap mb-3 sm:mb-4">
           {vinilo.pais_origen && (
             <span className="text-[8px] sm:text-[10px] font-black px-1.5 sm:px-2 py-1 rounded-lg bg-blue-500/10 text-blue-500 uppercase tracking-wider truncate max-w-full">
            {vinilo.pais_origen}
            </span>
            )}
          {vinilo.genero && (
             <span className="text-[8px] sm:text-[10px] font-black px-1.5 sm:px-2 py-1 rounded-lg bg-amber-500/10 text-amber-500 uppercase tracking-wider truncate max-w-full">
            {vinilo.genero}
            </span>
            )}
</div>
          
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
               <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                {limiteAlcanzado && !sinStockReal ? 'Sin más stock' : (divisaActiva === 'ARS' ? 'Precio ARS' : 'Precio Final')}
              </span>
              {!sinStockReal ? (
                <>
                   <p className={`text-lg sm:text-2xl font-black tracking-tighter transition-colors ${limiteAlcanzado ? 'text-orange-500' : 'text-slate-900 dark:text-amber-500'}`}>
                    {renderPrecioPrincipal()}
                  </p>
                   {divisaActiva !== 'USD' && <p className="text-[9px] sm:text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Ref: {importeUsd(vinilo.precio_venta)}</p>}
                </>
              ) : <p className="text-xl font-bold text-slate-400 line-through tracking-tighter">{renderPrecioPrincipal()}</p>}
            </div>
            
            <button 
              onClick={onAdd} 
              disabled={botonBloqueado} 
               className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl transition-all shadow-lg active:scale-90 ${
                botonBloqueado 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-700 shadow-none' 
                : 'bg-amber-500 hover:bg-slate-900 dark:hover:bg-white text-slate-950 dark:hover:text-slate-900 shadow-amber-500/20'
              }`}
            >
              {sinStockReal ? (
                 <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 opacity-20" />
              ) : limiteAlcanzado ? (
                 <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                 <Plus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3px]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE GALERÍA */}
      {modalAbierto && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle de ${vinilo.titulo}`}
          onMouseDown={cerrarDetalle}
          className="fixed inset-0 z-[9999] isolate flex items-end justify-center bg-black/95 p-0 backdrop-blur-sm transition-all sm:items-center sm:p-4 md:p-10"
        >
          <button
            type="button"
            onClick={cerrarDetalle}
            aria-label="Cerrar detalle del vinilo"
            className="absolute right-3 top-3 z-[10000] flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black uppercase text-slate-950 shadow-xl transition-colors hover:bg-amber-500 sm:right-6 sm:top-6 sm:px-4 md:right-8 md:top-8"
          >
            <X size={20} /> <span className="hidden sm:inline">Cerrar</span>
          </button>
          
          <div
            onMouseDown={event => event.stopPropagation()}
            className="relative max-h-[100dvh] w-full max-w-6xl grid grid-cols-1 items-center gap-3 overflow-y-auto overscroll-contain rounded-t-[2rem] bg-slate-950/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:max-h-full sm:gap-6 sm:rounded-[2rem] sm:p-4 md:grid-cols-[1.1fr_0.9fr] md:p-8"
          >
            {hayVariasFotos && (
              <>
                <button onClick={fotoAnterior} aria-label="Foto anterior" className="absolute left-2 top-[30%] z-50 rounded-full bg-black/45 p-2 text-white backdrop-blur-sm transition-all hover:bg-white/20 sm:left-3 sm:p-3 md:left-0 md:top-1/2"><ChevronLeft size={24} className="sm:h-8 sm:w-8 md:h-10 md:w-10" /></button>
                <button onClick={proximaFoto} aria-label="Foto siguiente" className="absolute right-2 top-[30%] z-50 rounded-full bg-black/45 p-2 text-white backdrop-blur-sm transition-all hover:bg-white/20 sm:right-3 sm:p-3 md:right-0 md:top-1/2"><ChevronRight size={24} className="sm:h-8 sm:w-8 md:h-10 md:w-10" /></button>
              </>
            )}
            
            <div className="flex h-[42dvh] min-h-[250px] max-h-[430px] w-full items-center justify-center sm:h-[52vh] sm:min-h-[280px] md:h-auto md:min-h-[520px]">
              <img 
                src={imagenes[fotoActual]} 
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl animate-in zoom-in-95 duration-300"
                alt={`${vinilo.titulo} - vista ampliada`}
              />
            </div>
            <div className="rounded-2xl bg-white p-4 text-left dark:bg-slate-900 sm:p-6">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-500 sm:text-[10px]">Ficha del vinilo</p>
              <h2 className="mt-2 line-clamp-2 text-xl font-black uppercase italic leading-tight tracking-tight text-slate-900 dark:text-white sm:text-2xl">{vinilo.titulo}</h2>
              <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{vinilo.artista}</p>
              <p className="mt-4 text-2xl font-black text-amber-500 sm:mt-5">{renderPrecioPrincipal()}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[9px] font-black uppercase sm:mt-5 sm:text-[10px]">
                {vinilo.genero && <span className="rounded-lg bg-amber-500/10 p-2 text-amber-600">Género: {vinilo.genero}</span>}
                {vinilo.calidad && <span className="rounded-lg bg-blue-500/10 p-2 text-blue-600">Calidad: {vinilo.calidad}</span>}
                {vinilo.pais_origen && <span className="rounded-lg bg-violet-500/10 p-2 text-violet-600">Origen: {vinilo.pais_origen}</span>}
                <span className={`rounded-lg p-2 ${sinStockReal ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}`}>Stock: {vinilo.stock_actual}</span>
              </div>
              <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700 sm:mt-6 sm:pt-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descripción</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{vinilo.descripcion?.trim() || 'Sin descripción disponible.'}</p>
              </div>
              {!sinStockReal && !limiteAlcanzado && (
              <button type="button" onClick={() => { cerrarDetalle(); onAdd(); }} className="mt-5 w-full rounded-xl bg-amber-500 py-3.5 text-xs font-black uppercase text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 sm:mt-6 sm:py-3">
                  Agregar al carrito
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
