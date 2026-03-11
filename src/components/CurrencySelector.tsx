import { DollarSign } from 'lucide-react';

interface CurrencySelectorProps {
  divisaActual: 'USD' | 'ARS' | 'USDT';
  onDivisaChange: (divisa: 'USD' | 'ARS' | 'USDT') => void;
}

export function CurrencySelector({ divisaActual, onDivisaChange }: CurrencySelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <DollarSign className="w-5 h-5 text-slate-600" />
      <select
        value={divisaActual}
        onChange={(e) => onDivisaChange(e.target.value as 'USD' | 'ARS' | 'USDT')}
        className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm font-semibold"
      >
        <option value="ARS">ARS (Pesos)</option>
        <option value="USD">USD (Dólares)</option>
        <option value="USDT">USDT (Cripto)</option>
      </select>
    </div>
  );
}
