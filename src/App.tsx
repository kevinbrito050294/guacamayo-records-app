import { useState, useEffect, useCallback } from 'react';
import { Catalog } from './components/Catalog';
import { Cart } from './components/Cart';
import { AdminPanel } from './components/AdminPanel';
import { CurrencySelector } from './components/CurrencySelector';
import { CarritoItem, ViniloCatalogo, ConfiguracionDivisa } from './types/database';
import { ShoppingCart, Settings, Disc, Moon, Sun, LogOut } from 'lucide-react';
import { AdminLogin } from './components/AdminLogin';

import logoImg from './assets/logo.png';

type Page = 'catalog' | 'cart' | 'admin';
type Divisa = 'USD' | 'ARS' | 'USDT';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('catalog');
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [vinilos, setVinilos] = useState<ViniloCatalogo[]>([]);
  const [tasas, setTasas] = useState<ConfiguracionDivisa[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [divisa, setDivisa] = useState<Divisa>('ARS');
  

  const getApiUrl = useCallback(() => {
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:3001' 
      : 'https://guacamayorecords.up.railway.app';
  }, []);

  const cargarDatosIniciales = useCallback(async () => {
    try {
      setLoading(true);
      const [resVinilos, resTasas] = await Promise.all([
        fetch(`${getApiUrl()}/api/vinilos`),
        fetch(`${getApiUrl()}/api/configuracion_divisas`)
      ]);

      if (!resVinilos.ok || !resTasas.ok) throw new Error('Error en la conexión');

      const dataVinilos = await resVinilos.json();
      const dataTasas = await resTasas.json();

      setVinilos(Array.isArray(dataVinilos) ? dataVinilos : []);
      setTasas(Array.isArray(dataTasas) ? dataTasas : (dataTasas.tasas || []));

    } catch (error) {
      console.error("❌ Error:", error);
    } finally {
      setLoading(false);
    }
  }, [getApiUrl]);

  useEffect(() => {
    cargarDatosIniciales();
  }, [cargarDatosIniciales]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${getApiUrl()}/api/admin/logout`, { method: 'POST' });
    } catch (err) { console.error(err); }
    setIsAdminAuthenticated(false);
    setCurrentPage('catalog');
    setLoginError('');
  }, [getApiUrl]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

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
      if (existe && existe.cantidad >= vinilo.stock_actual) return prev;
      if (existe) {
        return prev.map(item => item.vinilo.id === vinilo.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { vinilo, cantidad: 1 }];
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 font-sans">
      {/* NAVBAR OPTIMIZADA PARA MÓVILES */}
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between">
          
          {/* LOGO: Más pequeño en móvil para ganar espacio */}
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => { setCurrentPage('catalog'); cargarDatosIniciales(); }}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 overflow-hidden rounded-full border border-slate-100 dark:border-slate-700">
              <img src={logoImg} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">GUACAMAYO</span>
              <span className="text-[7px] sm:text-[9px] font-bold text-amber-500 uppercase tracking-widest">Records</span>
            </div>
          </div>

          {/* ACCIONES: Uso de gap-1 en móvil para evitar desbordamiento */}
          <div className="flex items-center gap-1 sm:gap-3">
            {/* SELECTOR: Ancho flexible */}
            <div className="w-[85px] sm:w-[140px]">
              <CurrencySelector divisaActual={divisa} onDivisaChange={setDivisa} />
            </div>
            
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 sm:p-2 text-slate-500 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              {isDarkMode ? <Sun size={18} className="sm:w-5 sm:h-5" /> : <Moon size={18} className="sm:w-5 sm:h-5" />}
            </button>

            <button onClick={() => setCurrentPage('cart')} className="relative p-1.5 sm:p-2 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <ShoppingCart size={20} className="sm:w-6 sm:h-6" />
              {carrito.length > 0 && (
                <span className="absolute top-0 right-0 bg-amber-500 text-[8px] font-black w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded-full border border-white dark:border-slate-900 animate-in zoom-in">
                  {carrito.length}
                </span>
              )}
            </button>

            <button onClick={() => setCurrentPage('admin')} className="p-1.5 sm:p-2 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <Settings size={20} className="sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Disc className="w-12 h-12 text-amber-500 animate-spin mb-4 opacity-20" />
            <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">Cargando...</p>
          </div>
        ) : (
          <div className="w-full">
            {currentPage === 'catalog' && (
              <Catalog vinilos={vinilos} onAddToCart={handleAddToCart} divisaActiva={divisa} carrito={carrito} tasas={tasas} />
            )}
            
            {currentPage === 'cart' && (
              <Cart items={carrito} onRemoveItem={(id) => setCarrito(prev => prev.filter(i => i.vinilo.id !== id))} onUpdateCantidad={(id, cant) => setCarrito(prev => prev.map(i => i.vinilo.id === id ? {...i, cantidad: cant} : i))} onBack={() => setCurrentPage('catalog')} onClear={() => setCarrito([])} divisaPreferida={divisa} tasas={tasas} />
            )}

            {currentPage === 'admin' && (
              <div className="space-y-4">
                {isAdminAuthenticated ? (
                  <>
                    <div className="flex justify-between items-center bg-amber-500/10 p-3 rounded-2xl mb-6">
                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Panel Administrativo</span>
                      <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-transform active:scale-95">
                        <LogOut size={16} />
                      </button>
                    </div>
                    <AdminPanel onBack={handleLogout} />
                  </>
                ) : (
                  <AdminLogin onLogin={handleAdminLogin} error={loginError} />
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;