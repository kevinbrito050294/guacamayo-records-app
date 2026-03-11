import { Wallet, ChevronDown } from 'lucide-react';

interface CurrencySelectorProps {
  divisaActual: 'USD' | 'ARS' | 'USDT';
  onDivisaChange: (divisa: 'USD' | 'ARS' | 'USDT') => void;
}

export function CurrencySelector({ divisaActual, onDivisaChange }: CurrencySelectorProps) {
  return (
    <div className="relative flex items-center bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500/50 transition-all group shadow-inner">
      {/* Icono decorativo */}
      <Wallet className="w-4 h-4 text-slate-400 group-hover:text-amber-500 mr-2 transition-colors" />
      
      <div className="flex flex-col">
        {/* Etiqueta pequeña superior */}
        <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase leading-none mb-0.5 tracking-tighter">
          Moneda Principal
        </span>
        
        {/* Selector Nativo (mejor compatibilidad móvil) */}
        <select
          value={divisaActual}
          onChange={(e) => onDivisaChange(e.target.value as 'USD' | 'ARS' | 'USDT')}
          className="bg-transparent text-xs font-black text-slate-900 dark:text-white appearance-none cursor-pointer outline-none uppercase tracking-tighter pr-4"
        >
          <option value="ARS" className="dark:bg-slate-900">ARS (Pesos)</option>
          <option value="USD" className="dark:bg-slate-900">USD (Dólar)</option>
          <option value="USDT" className="dark:bg-slate-900">USDT (Cripto)</option>
        </select>
      </div>
      
      {/* Indicador de flecha para el select */}
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-amber-500 transition-colors" />
    </div>
  );
}