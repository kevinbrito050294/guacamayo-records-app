import { useState, useEffect, useCallback } from 'react';
import { Catalog } from './components/Catalog';
import { Cart } from './components/Cart';
import { AdminPanel } from './components/AdminPanel';
import { CurrencySelector } from './components/CurrencySelector';
import { CarritoItem, ViniloCatalogo } from './types/database';
import { ShoppingCart, Settings, Disc, Moon, Sun } from 'lucide-react';
import { AdminLogin } from './components/AdminLogin';

import logoImg from './assets/logo.png';

type Page = 'catalog' | 'cart' | 'admin';
type Divisa = 'USD' | 'ARS' | 'USDT';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('catalog');
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [vinilos, setVinilos] = useState<ViniloCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [divisa, setDivisa] = useState<Divisa>('ARS');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const getApiUrl = useCallback(() => {
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:3001' 
      : 'https://guacamayorecords.up.railway.app';
  }, []);

  const cargarVinilos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl()}/api/vinilos`);
      if (!response.ok) throw new Error('Error en servidor');
      const data = await response.json();
      setVinilos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("❌ Error de conexión:", error);
      setVinilos([]); 
    } finally {
      setLoading(false);
    }
  }, [getApiUrl]);

  useEffect(() => {
    cargarVinilos();
  }, [cargarVinilos]);

  const handleLogoClick = () => {
    setCurrentPage('catalog');
    cargarVinilos();
  };

  const handleAdminLogin = (pass: string) => {
    if (pass === 'CONCHILIS2026') {
      setIsAdminAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Contraseña incorrecta');
    }
  };

  const handleAddToCart = (vinilo: ViniloCatalogo) => {
    setCarrito(prev => {
      const existe = prev.find(item => item.vinilo.id === vinilo.id);
      if (existe) {
        return prev.map(item => 
          item.vinilo.id === vinilo.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...prev, { vinilo, cantidad: 1 }];
    });
  };

  const handleUpdateCantidad = (id: string, cant: number) => {
    if (cant < 1) return;
    setCarrito(prev => prev.map(item => 
      item.vinilo.id === id ? { ...item, cantidad: cant } : item
    ));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 font-sans overflow-x-hidden selection:bg-amber-500/30">
      
      {/* NAVBAR OPTIMIZADA: LOGO + NOMBRE + SELECTOR */}
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm w-full">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 h-16 flex items-center justify-between gap-1">
          
          {/* LOGO Y MARCA */}
          <div 
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group active:scale-95 transition-all flex-shrink" 
            onClick={handleLogoClick}
          >
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 overflow-hidden rounded-full border-2 border-slate-100 dark:border-slate-700 shadow-sm group-hover:border-amber-500 transition-colors">
              <img 
                src={logoImg} 
                alt="Logo Guacamayo" 
                className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] xs:text-[15px] sm:text-xl font-black leading-none tracking-tighter text-slate-900 dark:text-white uppercase truncate">
                GUACAMAYO
              </span>
              <span className="text-[7px] sm:text-[9px] font-bold text-amber-500 tracking-[0.1em] sm:tracking-widest uppercase">
                Records
              </span>
            </div>
          </div>

          {/* ACCIONES: SELECTOR Y BOTONES */}
          <div className="flex items-center gap-0.5 sm:gap-3 flex-shrink-0">
            
            {/* Contenedor del selector con ancho controlado para no pisar el logo */}
            <div className="w-[85px] xs:w-[110px] sm:w-[160px]">
              <CurrencySelector 
                divisaActual={divisa} 
                onDivisaChange={setDivisa} 
              />
            </div>

            <div className="flex items-center">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-1 sm:p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-amber-400 transition-all"
                title="Cambiar tema"
              >
                {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 h-5" /> : <Moon className="w-4 h-4 sm:w-5 h-5" />}
              </button>

              <button 
                onClick={() => setCurrentPage('cart')} 
                className="relative p-1 sm:p-2 text-slate-500 dark:text-slate-300 hover:text-amber-500 transition-colors"
              >
                <ShoppingCart className="w-5 h-5 sm:w-6 h-6" />
                {carrito.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-amber-500 text-slate-950 text-[8px] font-black w-3.5 h-3.5 flex items-center justify-center rounded-full border border-white dark:border-slate-900 animate-in zoom-in">
                    {carrito.length}
                  </span>
                )}
              </button>

              <button 
                onClick={() => setCurrentPage('admin')} 
                className="p-1 sm:p-2 text-slate-500 dark:text-slate-300 hover:text-amber-500 transition-colors"
              >
                <Settings className="w-5 h-5 sm:w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto p-4 w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Disc className="w-12 h-12 text-amber-500 animate-spin mb-4 opacity-20" />
            <p className="text-slate-400 font-mono text-xs tracking-widest uppercase">Cargando surco...</p>
          </div>
        ) : (
          <div className="w-full">
            {currentPage === 'catalog' && (
              <Catalog 
                vinilos={vinilos} 
                onAddToCart={handleAddToCart} 
                divisaActiva={divisa} 
              />
            )}
            
            {currentPage === 'cart' && (
              <Cart 
                items={carrito} 
                onRemoveItem={(id) => setCarrito(prev => prev.filter(i => i.vinilo.id !== id))}
                onUpdateCantidad={handleUpdateCantidad}
                onBack={() => setCurrentPage('catalog')}
                onClear={() => setCarrito([])}
                divisaPreferida={divisa}
              />
            )}

            {currentPage === 'admin' && (
              isAdminAuthenticated ? (
                <AdminPanel onBack={() => {
                  setIsAdminAuthenticated(false);
                  setCurrentPage('catalog');
                  cargarVinilos();
                }} />
              ) : (
                <AdminLogin onLogin={handleAdminLogin} error={loginError} />
              )
            )}
          </div>
        )}
      </main>

      <footer className="py-8 text-center border-t border-slate-200 dark:border-slate-900 mt-20">
        <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
          Guacamayo Records &copy; 2026 | Vinilos y Cultura
        </p>
      </footer>
    </div>
  );
}

export default App;