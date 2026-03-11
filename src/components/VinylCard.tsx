import { ViniloCatalogo, PreciosConvertidos } from '../types/database';
import { Plus, ShoppingCart } from 'lucide-react';

interface VinylCardProps {
  vinilo: ViniloCatalogo;
  precios?: PreciosConvertidos;
  onAdd: () => void;
  divisaActiva: 'USD' | 'ARS' | 'USDT'; // Agregamos la prop de divisa activa
}

export function VinylCard({ vinilo, precios, onAdd, divisaActiva }: VinylCardProps) {
  const sinStock = vinilo.stock_actual === 0;

  // Función para renderizar el precio principal según la divisa seleccionada
  const renderPrecioPrincipal = () => {
    if (!precios) return `USD ${Number(vinilo.precio_venta).toFixed(2)}`;

    switch (divisaActiva) {
      case 'ARS':
        return precios.ars > 0 
          ? `$${Math.round(precios.ars).toLocaleString('es-AR')}` 
          : 'Consultar';
      case 'USDT':
        return `${precios.usdt.toFixed(2)} USDT`;
      default:
        return `USD ${Number(vinilo.precio_venta).toFixed(2)}`;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-2xl dark:hover:border-amber-500/30 transition-all duration-300 group">
      
      {/* IMAGEN DEL VINILO */}
      <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
        <img 
          src={vinilo.imagen_url || 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=500'} 
          alt={vinilo.titulo}
          className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ${sinStock ? 'grayscale opacity-50' : ''}`}
        />
        
        {/* BADGE DE CALIDAD */}
        <div className={`absolute top-4 right-4 ${sinStock ? 'bg-red-500' : 'bg-slate-900/90 dark:bg-amber-500'} text-white dark:text-slate-950 text-[10px] px-3 py-1 rounded-full font-black backdrop-blur-sm uppercase tracking-wider shadow-lg`}>
          {sinStock ? 'Agotado' : vinilo.calidad || 'Nuevo'}
        </div>
      </div>
      
      {/* CONTENIDO */}
      <div className="p-6">
        <h3 className="font-black text-2xl text-slate-900 dark:text-white truncate leading-none transition-colors italic uppercase tracking-tighter">
          {vinilo.titulo}
        </h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-5 tracking-tight">
          {vinilo.artista}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
              {divisaActiva === 'ARS' ? 'Precio en Pesos' : 'Precio Final'}
            </span>
            
            {sinStock ? (
              <p className="text-xl font-bold text-slate-400 dark:text-slate-600 line-through tracking-tighter">
                {renderPrecioPrincipal()}
              </p>
            ) : (
              <>
                {/* PRECIO PRINCIPAL (GRANDE) */}
                <p className="text-2xl font-black text-slate-900 dark:text-amber-500 leading-none transition-colors tracking-tighter">
                  {renderPrecioPrincipal()}
                </p>

                {/* REFERENCIA EN DÓLARES (PEQUEÑA) */}
                {divisaActiva !== 'USD' && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold mt-1.5 flex items-center gap-1 uppercase tracking-tighter">
                    <span className="opacity-50">Ref:</span> USD {Number(vinilo.precio_venta).toFixed(2)}
                  </p>
                )}
              </>
            )}
          </div>
          
          {/* BOTÓN DE ACCIÓN */}
          <button 
            onClick={onAdd}
            disabled={sinStock}
            className={`p-4 rounded-2xl transition-all shadow-lg active:scale-90 flex items-center justify-center
              ${sinStock 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none' 
                : 'bg-amber-500 hover:bg-slate-900 dark:hover:bg-white text-slate-950 dark:hover:text-slate-900 shadow-amber-500/20'
              }`}
          >
            {sinStock ? <ShoppingCart className="w-6 h-6 opacity-20" /> : <Plus className="w-6 h-6 stroke-[3px]" />}
          </button>
        </div>
      </div>
    </div>
  );
}