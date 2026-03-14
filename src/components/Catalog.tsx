import { useState, useEffect, useRef } from 'react';
import { ViniloCatalogo, PreciosConvertidos, CarritoItem } from '../types/database';
import { VinylCard } from './VinylCard';
import { convertirPrecio } from '../lib/currency';
import { Search, SlidersHorizontal, Loader2, Disc } from 'lucide-react'; 

import logoImg from '../assets/logo.png'; 

interface CatalogProps {
  vinilos: ViniloCatalogo[];
  onAddToCart: (vinilo: ViniloCatalogo) => void;
  divisaActiva: 'USD' | 'ARS' | 'USDT';
  carrito: CarritoItem[];
}

export function Catalog({ vinilos, onAddToCart, divisaActiva, carrito }: CatalogProps) {
  const [preciosMap, setPreciosMap] = useState<{ [key: string]: PreciosConvertidos }>({});
  const [busqueda, setBusqueda] = useState('');
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [cargandoPrecios, setCargandoPrecios] = useState(true);

  const discosRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    async function cargarPrecios() {
      if (vinilos.length === 0) {
        setCargandoPrecios(false);
        return;
      }
      try {
        setCargandoPrecios(true);
        const nuevosPrecios: { [key: string]: PreciosConvertidos } = {};
        await Promise.all(
          vinilos.map(async (v) => {
            try {
              const conversion = await convertirPrecio(v.precio_venta);
              nuevosPrecios[v.id] = conversion;
            } catch (err) {
              nuevosPrecios[v.id] = { usd: v.precio_venta, ars: 0, usdt: 0 };
            }
          })
        );
        setPreciosMap(nuevosPrecios);
      } catch (error) {
        console.error("Error al convertir precios:", error);
      } finally {
        setCargandoPrecios(false);
      }
    }
    cargarPrecios();
  }, [vinilos, divisaActiva]);

  const vinilosFiltrados = vinilos.filter(v => 
    v.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.artista.toLowerCase().includes(busqueda.toLowerCase())
  );

  const sugerencias = vinilos
    .filter(v => 
      v.titulo.toLowerCase().includes(busqueda.toLowerCase()) || 
      v.artista.toLowerCase().includes(busqueda.toLowerCase())
    )
    .slice(0, 5);

  const hacerScrollAlDisco = (id: string) => {
    const elemento = discosRefs.current[id];
    if (elemento) {
      setMostrarSugerencias(false);
      setBusqueda('');
      elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elemento.classList.add('ring-4', 'ring-amber-500', 'rounded-[2rem]', 'z-10');
      setTimeout(() => {
        elemento.classList.remove('ring-4', 'ring-amber-500');
      }, 2000);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 md:py-12 transition-colors duration-500 overflow-x-hidden">
      
      {/* HEADER: LOGO Y TÍTULO */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 md:mb-16">
        <div className="flex flex-col md:flex-row items-center md:items-center gap-4 md:gap-6 text-center md:text-left">
          <div className="relative w-20 h-20 md:w-24 md:h-24 shadow-2xl rounded-2xl overflow-hidden border-4 border-white dark:border-slate-800 rotate-[-3deg] ring-2 ring-amber-400/20 flex-shrink-0">
            <img src={logoImg} alt="Logo Guacamayo" className="w-full h-full object-cover" />
          </div>
          
          <div className="min-w-0">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none italic">
              <span className="text-slate-900 dark:text-white transition-colors">GUACAMAYO</span>
              <span className="text-amber-500 block md:inline md:ml-3">RECORDS</span>
            </h1>
            <p className="text-slate-700 dark:text-slate-400 mt-2 text-lg md:text-xl font-medium tracking-tight">
              Los mejores <span className="text-amber-600/80 dark:text-amber-400 font-bold">vinilos</span> con la mejor cotización
            </p>
          </div>
        </div>

        {/* BUSCADOR CON SUGERENCIAS EN PESOS/DIVISA */}
        <div className="relative w-full md:w-96 mt-4 md:mt-0 z-50">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar artista o álbum..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setMostrarSugerencias(e.target.value.length > 0);
              }}
              onFocus={() => busqueda.length > 0 && setMostrarSugerencias(true)}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-none shadow-lg dark:shadow-none dark:border dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all text-base font-medium"
            />
          </div>

          {mostrarSugerencias && busqueda.length > 0 && (
            <>
              <div className="fixed inset-0 z-[-1]" onClick={() => setMostrarSugerencias(false)} />
              
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {sugerencias.length > 0 ? (
                  <div className="p-2">
                    {sugerencias.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => hacerScrollAlDisco(v.id)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-amber-500/10 rounded-xl transition-colors text-left group"
                      >
                        <img 
                          src={v.imagen_url?.split(',')[0]} 
                          className="w-10 h-10 rounded-lg object-cover shadow-sm group-hover:scale-110 transition-transform"
                          alt={v.titulo}
                        />
                        <div className="flex-grow min-w-0">
                          <p className="font-black text-[11px] text-slate-900 dark:text-white truncate uppercase italic leading-tight">
                            {v.titulo}
                          </p>
                          <p className="text-[9px] text-slate-500 font-bold truncate uppercase tracking-tighter">
                            {v.artista}
                          </p>
                        </div>
                        
                        {/* PRECIO CONVERTIDO EN LA MINIATURA */}
                        <div className="text-[10px] font-black text-amber-500 font-mono whitespace-nowrap">
                          {divisaActiva} {
                            divisaActiva === 'ARS' 
                              ? (preciosMap[v.id]?.ars ? Math.round(preciosMap[v.id].ars).toLocaleString('es-AR') : '...') 
                              : (divisaActiva === 'USDT' ? preciosMap[v.id]?.usdt : v.precio_venta)
                          }
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    No encontramos ese surco...
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* GRILLA DE PRODUCTOS */}
      <div className="w-full">
        {vinilosFiltrados.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {vinilosFiltrados.map((vinilo) => (
              <div 
                key={vinilo.id} 
                ref={(el) => (discosRefs.current[vinilo.id] = el)}
                className="transition-all duration-500"
              >
                <VinylCard
                  vinilo={vinilo}
                  precios={preciosMap[vinilo.id]}
                  onAdd={() => onAddToCart(vinilo)}
                  divisaActiva={divisaActiva}
                  carrito={carrito}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 md:py-32 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
            <Disc className="w-12 h-12 text-slate-200 dark:text-slate-800 mb-4 animate-spin-slow" />
            <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-sm">No encontramos ese surco...</p>
          </div>
        )}
      </div>

      {/* FOOTER DE COTIZACIÓN */}
      <div className="mt-12 md:mt-20 p-6 md:p-8 bg-slate-900 dark:bg-amber-500 rounded-[2rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-500">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className="bg-amber-400/20 dark:bg-slate-900/20 p-3 rounded-xl hidden sm:block">
            <SlidersHorizontal className="text-amber-400 dark:text-slate-900 w-6 h-6" />
          </div>
          <div>
            <p className="text-white dark:text-slate-950 font-bold text-lg leading-none uppercase tracking-tight">
              Precios en {divisaActiva === 'ARS' ? 'Pesos' : divisaActiva}
            </p>
            <p className="text-amber-200/60 dark:text-slate-900/60 text-[10px] font-black uppercase tracking-widest mt-1">
              Sincronizado con base de datos MySQL
            </p>
          </div>
        </div>
        
        {cargandoPrecios ? (
          <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-full">
             <Loader2 className="w-4 h-4 text-amber-400 dark:text-slate-900 animate-spin" />
             <span className="text-[10px] font-black text-white dark:text-slate-900 uppercase tracking-widest">Sincronizando...</span>
          </div>
        ) : (
          <div className="text-[10px] font-black text-emerald-400 dark:text-slate-900 border border-emerald-500/40 dark:border-slate-900/40 px-6 py-3 rounded-full uppercase tracking-widest bg-emerald-500/5">
            ● Cotización Actualizada
          </div>
        )}
      </div>
    </main>
  );
}