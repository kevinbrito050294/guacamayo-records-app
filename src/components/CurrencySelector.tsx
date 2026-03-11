import { Wallet, ChevronDown } from 'lucide-react';

interface CurrencySelectorProps {
  divisaActual: 'USD' | 'ARS' | 'USDT';
  onDivisaChange: (divisa: 'USD' | 'ARS' | 'USDT') => void;
}

export function CurrencySelector({ divisaActual, onDivisaChange }: CurrencySelectorProps) {
  return (
    <div className="relative flex items-center bg-slate-100 dark:bg-slate-800/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500/50 transition-all group shadow-inner min-w-0">
      
      {/* Icono decorativo - Se oculta en móviles muy pequeños para ganar espacio */}
      <Wallet className="hidden xs:block w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 mr-1.5 sm:mr-2 transition-colors flex-shrink-0" />
      
      <div className="flex flex-col min-w-0 overflow-hidden">
        {/* Etiqueta pequeña superior: Acortada en móvil para que no desborde */}
        <span className="text-[7px] sm:text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase leading-none mb-0.5 tracking-tighter truncate">
          <span className="xs:hidden">Divisa</span>
          <span className="hidden xs:inline">Moneda Principal</span>
        </span>
        
        {/* Selector Nativo */}
        <div className="relative flex items-center">
          <select
            value={divisaActual}
            onChange={(e) => onDivisaChange(e.target.value as 'USD' | 'ARS' | 'USDT')}
            className="bg-transparent text-[10px] sm:text-xs font-black text-slate-900 dark:text-white appearance-none cursor-pointer outline-none uppercase tracking-tighter pr-4 w-full"
          >
            {/* Usamos nombres cortos para que el navegador no ensanche el componente */}
            <option value="ARS" className="dark:bg-slate-900">ARS</option>
            <option value="USD" className="dark:bg-slate-900">USD</option>
            <option value="USDT" className="dark:bg-slate-900">USDT</option>
          </select>
          
          {/* Indicador de flecha: Posicionado para no molestar */}
          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-amber-500 transition-colors" />
        </div>
      </div>
    </div>
  );
}