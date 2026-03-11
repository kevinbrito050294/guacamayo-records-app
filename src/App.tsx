import { useState, useEffect, useCallback } from 'react';
import { Catalog } from './components/Catalog';
import { Cart } from './components/Cart';
import { AdminPanel } from './components/AdminPanel';
import { CarritoItem, ViniloCatalogo } from './types/database';
import { ShoppingCart, Settings, Disc, Moon, Sun } from 'lucide-react';
import { AdminLogin } from './components/AdminLogin';

// 1. IMPORTAMOS TU LOGO DESDE ASSETS
import logoImg from './assets/logo.png';

type Page = 'catalog' | 'cart' | 'admin';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('catalog');
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [vinilos, setVinilos] = useState<ViniloCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  // ESTADO PARA MODO OSCURO
  const [isDarkMode, setIsDarkMode] = useState(false);

  // EFECTO PARA APLICAR EL MODO OSCURO AL DOCUMENTO
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const cargarVinilos = useCallback(async () => {
    try {
      setLoading(true);
      
      // CONFIGURACIÓN DE URL: Usamos el host actual para que funcione con localtunnel o localhost
      const API_BASE_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : `${window.location.protocol}//${window.location.host.replace(':5173', ':3001')}`;
      
      const response = await fetch(`${API_BASE_URL}/api/vinilos`);
      
      if (!response.ok) throw new Error('Error al conectar con el servidor');
      
      const data = await response.json();
      setVinilos(Array.isArray(data) ? data : []);
      
      console.log("✅ Datos del catálogo cargados desde Railway");
    } catch (error) {
      console.error("❌ Error de conexión al backend:", error);
      setVinilos([]); 
    } finally {
      setLoading(false);
    }
  }, []);

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
      if (existe) return prev.map(item => item.vinilo.id === vinilo.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      return [...prev, { vinilo, cantidad: 1 }];
    });
  };

  const handleUpdateCantidad = (id: string, cant: number) => {
    if (cant < 1) return;
    setCarrito(prev => prev.map(item => item.vinilo.id === id ? { ...item, cantidad: cant } : item));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 font-sans">
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          <div 
            className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-all" 
            onClick={handleLogoClick}
          >
            <div className="relative w-11 h-11 overflow-hidden rounded-full border-2 border-slate-100 dark:border-slate-700 shadow-sm group-hover:border-amber-500 transition-colors">
              <img 
                src={logoImg} 
                alt="Guacamayo Records" 
                className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            <div className="flex flex-col font-guacamayo">
              <span className="text-xl leading-none tracking-tighter text-slate-900 dark:text-white transition-colors">
                GUACAMAYO
              </span>
              <span className="text-[10px] font-bold text-amber-500 tracking-widest uppercase">
                Records
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-amber-400 hover:scale-110 active:scale-95 transition-all shadow-inner"
              title={isDarkMode ? "Modo Claro" : "Modo Oscuro"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button onClick={() => setCurrentPage('cart')} className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-colors">
              <ShoppingCart className="w-6 h-6" />
              {carrito.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">
                  {carrito.length}
                </span>
              )}
            </button>
            <button onClick={() => setCurrentPage('admin')} className="p-2 text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-colors">
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Disc className="w-12 h-12 text-slate-300 animate-spin mb-4" />
            <p className="text-slate-500 font-medium">Actualizando catálogo...</p>
          </div>
        ) : (
          <>
            {currentPage === 'catalog' && <Catalog vinilos={vinilos} onAddToCart={handleAddToCart} />}
            
            {currentPage === 'cart' && (
              <Cart 
                items={carrito} 
                onRemoveItem={(id) => setCarrito(prev => prev.filter(i => i.vinilo.id !== id))}
                onUpdateCantidad={handleUpdateCantidad}
                onBack={() => setCurrentPage('catalog')}
                onClear={() => setCarrito([])}
                divisaPreferida="ARS"
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
          </>
        )}
      </main>
    </div>
  );
}

export default App;