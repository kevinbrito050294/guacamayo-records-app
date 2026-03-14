import { useState, useEffect, useCallback } from 'react';
import { Catalog } from './components/Catalog';
import { Cart } from './components/Cart';
import { AdminPanel } from './components/AdminPanel';
import { CurrencySelector } from './components/CurrencySelector';
import { CarritoItem, ViniloCatalogo } from './types/database';
import { ShoppingCart, Settings, Disc, Moon, Sun, LogOut } from 'lucide-react';
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
  const [lastActivity, setLastActivity] = useState(Date.now());

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

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${getApiUrl()}/api/admin/logout`, { method: 'POST' });
    } catch (error) {
      console.error("Error al liberar panel:", error);
    }
    setIsAdminAuthenticated(false);
    setCurrentPage('catalog');
    setLoginError('');
  }, [getApiUrl]);

  useEffect(() => {
    if (!isAdminAuthenticated || currentPage !== 'admin') return;

    const interval = setInterval(() => {
      const minutosInactivo = (Date.now() - lastActivity) / 1000 / 60;
      
      if (minutosInactivo >= 15) {
        handleLogout();
        alert("Sesión cerrada por inactividad (15 min). Panel liberado.");
      } else {
        fetch(`${getApiUrl()}/api/admin/heartbeat`, { method: 'POST' });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isAdminAuthenticated, currentPage, lastActivity, handleLogout, getApiUrl]);

  const registrarActividad = () => {
    if (isAdminAuthenticated && currentPage === 'admin') {
      setLastActivity(Date.now());
    }
  };

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
    if (isAdminAuthenticated) {
      handleLogout();
    }
    setCurrentPage('catalog');
    cargarVinilos();
  };

  const handleAdminLogin = async (pass: string) => {
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/login-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
      });

      if (res.ok) {
        setIsAdminAuthenticated(true);
        setLoginError('');
        setLastActivity(Date.now());
      } else {
        const data = await res.json();
        setLoginError(data.error || 'Error de acceso');
      }
    } catch (err) {
      setLoginError('Servidor no disponible');
    }
  };

  const handleAddToCart = (vinilo: ViniloCatalogo) => {
    setCarrito(prev => {
      const existe = prev.find(item => item.vinilo.id === vinilo.id);
      const cantidadActual = existe ? existe.cantidad : 0;

      // Validación de Stock (Blindaje QA)
      if (cantidadActual >= vinilo.stock_actual) return prev;

      if (existe) {
        return prev.map(item => 
          item.vinilo.id === vinilo.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...prev, { vinilo, cantidad: 1 }];
    });
  };

  const handleUpdateCantidad = (id: string, cant: number) => {
    const viniloRef = vinilos.find(v => v.id === id);
    if (!viniloRef || cant < 1 || cant > viniloRef.stock_actual) return;
    
    setCarrito(prev => prev.map(item => 
      item.vinilo.id === id ? { ...item, cantidad: cant } : item
    ));
  };

  return (
    <div 
      onMouseMove={registrarActividad} 
      onPointerDown={registrarActividad}
      onScroll={registrarActividad}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 font-sans overflow-x-hidden selection:bg-amber-500/30"
    >
      
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm w-full">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 h-16 flex items-center justify-between gap-1">
          
          <div 
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group active:scale-95 transition-all flex-shrink" 
            onClick={handleLogoClick}
          >
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 overflow-hidden rounded-full border-2 border-slate-100 dark:border-slate-700 shadow-sm group-hover:border-amber-500 transition-colors">
              <img src={logoImg} alt="Logo Guacamayo" className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" />
            </div>
            
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] xs:text-[15px] sm:text-xl font-black leading-none tracking-tighter text-slate-900 dark:text-white uppercase truncate">GUACAMAYO</span>
              <span className="text-[7px] sm:text-[9px] font-bold text-amber-500 tracking-[0.1em] sm:tracking-widest uppercase">Records</span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-3 flex-shrink-0">
            <div className="w-[85px] xs:w-[110px] sm:w-[160px]">
              <CurrencySelector divisaActual={divisa} onDivisaChange={setDivisa} />
            </div>

            <div className="flex items-center">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1 sm:p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-amber-400 transition-all">
                {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 h-5" /> : <Moon className="w-4 h-4 sm:w-5 h-5" />}
              </button>

              <button onClick={() => setCurrentPage('cart')} className="relative p-1 sm:p-2 text-slate-500 dark:text-slate-300 hover:text-amber-500 transition-colors">
                <ShoppingCart className="w-5 h-5 sm:w-6 h-6" />
                {carrito.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-amber-500 text-slate-950 text-[8px] font-black w-3.5 h-3.5 flex items-center justify-center rounded-full border border-white dark:border-slate-900 animate-in zoom-in">
                    {carrito.length}
                  </span>
                )}
              </button>

              <button onClick={() => setCurrentPage('admin')} className="p-1 sm:p-2 text-slate-500 dark:text-slate-300 hover:text-amber-500 transition-colors">
                <Settings className="w-5 h-5 sm:w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

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
                carrito={carrito} 
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
              <div className="space-y-4">
                {isAdminAuthenticated && (
                  <div className="flex justify-between items-center bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl mb-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase">Sesión Protegida</span>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400">Expira en 15m de inactividad</span>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md active:scale-95"
                    >
                      <LogOut className="w-4 h-4" />
                      FINALIZAR EDICIÓN
                    </button>
                  </div>
                )}
                
                {isAdminAuthenticated ? (
                  <AdminPanel onBack={handleLogout} />
                ) : (
                  <AdminLogin onLogin={handleAdminLogin} error={loginError} />
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-8 text-center border-t border-slate-200 dark:border-slate-900 mt-20">
        <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">Guacamayo Records &copy; 2026 | Vinilos y Cultura</p>
      </footer>
    </div>
  );
}

export default App;