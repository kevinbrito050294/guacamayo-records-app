import { useState, useRef, useMemo, useEffect } from 'react';
import { ViniloCatalogo, PreciosConvertidos, CarritoItem, ConfiguracionDivisa } from '../types/database';
import { VinylCard } from './VinylCard';
import { Search, SlidersHorizontal, Disc, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

import logoImg from '../assets/logo.webp'; 

interface CatalogProps {
  vinilos: ViniloCatalogo[];
  onAddToCart: (vinilo: ViniloCatalogo) => void;
  divisaActiva: 'USD' | 'ARS' | 'USDT';
  carrito: CarritoItem[];
  tasas: ConfiguracionDivisa[]; // <-- AÑADIDO
  // Favoritos: opcionales para no romper los usos de Catalog sin cuenta.
  idsFavoritos?: Set<number>;
  onToggleFavorito?: (id: string) => void;
}

export function Catalog({ vinilos, onAddToCart, divisaActiva, carrito, tasas, idsFavoritos, onToggleFavorito }: CatalogProps) {
  const [busqueda, setBusqueda] = useState('');
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [viniloDetalleId, setViniloDetalleId] = useState<string | null>(null);
  
  const discosRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // LÓGICA DE CONVERSIÓN LOCAL (Más rápido y sin errores de API individual)
  const preciosMap = useMemo(() => {
    const mapa: { [key: string]: PreciosConvertidos } = {};
    
    // Buscamos los valores en el array de tasas
    const tasaBlue = tasas.find(t => t.tipo === 'DOLAR_BLUE')?.tasa || 1;
    const tasaUsdt = tasas.find(t => t.tipo === 'USDT')?.tasa || 1;

    vinilos.forEach(v => {
      // `precio_venta` es DECIMAL y llega como string: la aritmética de abajo lo
      // convertiría sola, pero `usd` se queda con el valor crudo y después se
      // formatea con toFixed(). Sin el Number() explícito, cambiar a pesos o
      // USDT andaría de milagro y ver el precio en USD rompería la card.
      const precioUsd = Number(v.precio_venta);
      mapa[v.id] = {
        usd: precioUsd,
        ars: precioUsd * tasaBlue,
        usdt: (precioUsd * tasaBlue) / tasaUsdt
      };
    });
    return mapa;
  }, [vinilos, tasas]);

  const vinilosFiltrados = vinilos
  .filter(v => 
    v.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.artista.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.genero?.toLowerCase().includes(busqueda.toLowerCase())
  )
  .sort((a, b) => (b.destacado || 0) - (a.destacado || 0));

  const sugerencias = vinilosFiltrados.slice(0, 5);

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

  const vinilosDisponibles = useMemo(() => vinilos
    .filter(v => Number(v.stock_actual) > 0 && Boolean(v.imagen_url?.split(',').find(Boolean)))
    .slice(0, 12), [vinilos]);

  // Función auxiliar para formatear precios según divisa
  const formatearPrecio = (id: string) => {
    const p = preciosMap[id];
    if (!p) return '...';

    if (divisaActiva === 'ARS') {
      return `ARS ${Math.round(p.ars).toLocaleString('es-AR')}`;
    }
    if (divisaActiva === 'USDT') {
      return `USDT ${p.usdt.toFixed(2)}`;
    }
    return `USD ${p.usd.toFixed(2)}`;
  };

  return (
    <main className="max-w-7xl mx-auto px-3 py-5 sm:px-4 sm:py-6 md:py-12 transition-colors duration-500 overflow-x-hidden">
      
      {/* HEADER: LOGO Y TÍTULO */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6 mb-8 sm:mb-10 md:mb-16">
        <div className="flex items-center gap-3 sm:gap-4 md:gap-6 text-left">
          <div className="relative w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 shadow-2xl rounded-2xl overflow-hidden border-4 border-white dark:border-slate-800 rotate-[-3deg] ring-2 ring-amber-400/20 flex-shrink-0">
            <img src={logoImg} alt="Logo Guacamayo" className="w-full h-full object-cover" />
          </div>
          
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-4xl md:text-6xl font-black tracking-tighter uppercase leading-none italic">
              <span className="text-slate-900 dark:text-white">GUACAMAYO</span>
              <span className="text-amber-500 block sm:inline sm:ml-2 md:ml-3">RECORDS</span>
            </h1>
            <p className="text-slate-700 dark:text-slate-400 mt-1 sm:mt-2 text-xs sm:text-lg md:text-xl font-medium tracking-tight">
              Los mejores <span className="text-amber-600/80 dark:text-amber-400 font-bold">vinilos</span> con la mejor cotización
            </p>
          </div>
        </div>

        {/* BUSCADOR */}
        <div className="relative w-full md:w-96 md:mt-0 z-50">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar artista, álbum o género..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setMostrarSugerencias(e.target.value.length > 0);
              }}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-none shadow-lg dark:border dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
            />
          </div>

          {mostrarSugerencias && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
              {sugerencias.map((v) => (
                <button
                  key={v.id}
                  onClick={() => hacerScrollAlDisco(v.id)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-amber-500/10 transition-colors text-left group"
                >
                  <img src={v.imagen_url?.split(',')[0]} className="w-10 h-10 rounded-lg object-cover" alt={v.titulo} />
                  <div className="flex-grow min-w-0">
                    <p className="font-black text-[11px] text-slate-900 dark:text-white truncate uppercase italic">{v.titulo}</p>
                    <p className="text-[9px] text-slate-500 font-bold truncate uppercase">{v.artista}</p>
                  </div>
                  <div className="text-[10px] font-black text-amber-500 font-mono">
                    {formatearPrecio(v.id)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

        <VinylSpotlight
        vinilos={vinilosDisponibles}
        formatearPrecio={formatearPrecio}
        onVerVinilo={(id) => { setViniloDetalleId(id); hacerScrollAlDisco(id); }}
      />

      {/* GRILLA DE PRODUCTOS */}
      <div className="w-full">
        {vinilosFiltrados.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 md:gap-8">
            {vinilosFiltrados.map((vinilo) => (
              <div key={vinilo.id} ref={(el) => (discosRefs.current[vinilo.id] = el)}>
                <VinylCard
                  vinilo={vinilo}
                  precios={preciosMap[vinilo.id]}
                  onAdd={() => onAddToCart(vinilo)}
                  abrirDetalle={viniloDetalleId === vinilo.id}
                  onCerrarDetalle={() => setViniloDetalleId(null)}
                  divisaActiva={divisaActiva}
                  carrito={carrito}
                  favorito={idsFavoritos ? idsFavoritos.has(Number(vinilo.id)) : false}
                  onToggleFavorito={onToggleFavorito}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800">
            <Disc className="w-12 h-12 text-slate-200 mx-auto mb-4 animate-spin-slow" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No encontramos ese surco...</p>
          </div>
        )}
      </div>

      {/* FOOTER DE COTIZACIÓN */}
      <div className="mt-12 md:mt-20 p-6 md:p-8 bg-slate-900 dark:bg-amber-500 rounded-[2rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 transition-all">
        <div className="flex items-center gap-4">
          <div className="bg-amber-400/20 dark:bg-slate-900/20 p-3 rounded-xl">
            <SlidersHorizontal className="text-amber-400 dark:text-slate-900 w-6 h-6" />
          </div>
          <div>
            <p className="text-white dark:text-slate-950 font-bold text-lg uppercase tracking-tight">
              Precios en {divisaActiva}
            </p>
            <p className="text-amber-200/60 dark:text-slate-900/60 text-[10px] font-black uppercase tracking-widest mt-1">
              Ajustado a la tasa del dia
            </p>
          </div>
        </div>
        
        <div className="text-[10px] font-black text-emerald-400 dark:text-slate-900 border border-emerald-500/40 dark:border-slate-900/40 px-6 py-3 rounded-full uppercase tracking-widest bg-emerald-500/5">
          ● Cotización Actualizada
        </div>
      </div>
    </main>
  );
}

function VinylSpotlight({
  vinilos,
  formatearPrecio,
  onVerVinilo,
}: {
  vinilos: ViniloCatalogo[];
  formatearPrecio: (id: string) => string;
  onVerVinilo: (id: string) => void;
}) {
  const [actual, setActual] = useState(0);
  const cantidad = vinilos.length;

  useEffect(() => {
    if (actual >= cantidad && cantidad > 0) setActual(0);
  }, [actual, cantidad]);

  useEffect(() => {
    if (cantidad < 2) return;
    const intervalo = window.setInterval(() => {
      setActual(anterior => (anterior + 1) % cantidad);
    }, 5000);
    return () => window.clearInterval(intervalo);
  }, [cantidad]);

  if (cantidad === 0) return null;

  const vinilo = vinilos[actual] || vinilos[0];
  const imagen = vinilo.imagen_url?.split(',').find(Boolean);
  const cambiar = (direccion: number) => {
    setActual(anterior => (anterior + direccion + cantidad) % cantidad);
  };

  return (
    <section
      aria-label="Vinilos destacados disponibles"
      className="relative mb-8 sm:mb-10 md:mb-16 overflow-hidden rounded-[1.75rem] sm:rounded-[2.5rem] bg-slate-950 shadow-2xl"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(245,158,11,0.35),transparent_38%)]" />
      <div className="relative grid h-[330px] grid-cols-[1.08fr_0.92fr] md:h-[410px] md:grid-cols-[1.05fr_0.95fr]">
        <div className="order-1 flex min-w-0 flex-col justify-center p-4 sm:p-8 md:order-1 md:p-14">
          <p className="mb-2 text-[8px] font-black uppercase tracking-[0.2em] text-amber-400 sm:mb-4 sm:text-[10px] sm:tracking-[0.3em]">Disponible ahora</p>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 sm:mb-2 sm:text-xs">{vinilo.artista}</p>
          <h2 className="line-clamp-3 min-h-[4.2rem] max-w-xl overflow-hidden text-2xl font-black uppercase italic leading-[0.95] tracking-tighter text-white sm:text-4xl md:min-h-[5.4rem] md:text-5xl">
            {vinilo.titulo}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-6 sm:gap-4">
            <span className="text-sm font-black text-amber-400 sm:text-lg">{formatearPrecio(vinilo.id)}</span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-300 sm:px-3 sm:text-[10px]">
              En stock
            </span>
          </div>
          <button
            type="button"
            onClick={() => onVerVinilo(vinilo.id)}
            className="mt-4 flex w-fit items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-950 transition-colors hover:bg-amber-400 sm:mt-7 sm:gap-2 sm:rounded-xl sm:px-5 sm:py-3 sm:text-xs"
          >
            Ver vinilo <ArrowRight size={13} className="sm:h-4 sm:w-4" />
          </button>
        </div>

        <div className="relative order-2 h-full cursor-pointer overflow-hidden md:order-2" onClick={() => onVerVinilo(vinilo.id)}>
          <img
            key={vinilo.id}
            src={imagen}
            alt={`${vinilo.titulo} de ${vinilo.artista}`}
            className="h-full w-full object-cover transition-opacity duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent md:bg-gradient-to-r md:from-slate-950/60 md:via-transparent" />
          {cantidad > 1 && (
           <div className="absolute bottom-3 right-3 flex gap-1.5 sm:bottom-5 sm:right-5 sm:gap-2">
               <button type="button" onClick={event => { event.stopPropagation(); cambiar(-1); }} aria-label="Vinilo anterior" className="rounded-full bg-white/90 p-1.5 text-slate-950 shadow-lg transition-colors hover:bg-amber-500 sm:p-2">
                 <ChevronLeft size={15} className="sm:h-[18px] sm:w-[18px]" />
               </button>
               <button type="button" onClick={event => { event.stopPropagation(); cambiar(1); }} aria-label="Vinilo siguiente" className="rounded-full bg-white/90 p-1.5 text-slate-950 shadow-lg transition-colors hover:bg-amber-500 sm:p-2">
                 <ChevronRight size={15} className="sm:h-[18px] sm:w-[18px]" />
              </button>
            </div>
          )}
        </div>
      </div>
      {cantidad > 1 && (
        <div className="absolute bottom-5 left-7 flex gap-1.5 md:left-14">
          {vinilos.map((item, indice) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Mostrar ${item.titulo}`}
              onClick={() => setActual(indice)}
              className={`h-1.5 rounded-full transition-all ${indice === actual ? 'w-8 bg-amber-400' : 'w-2 bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
