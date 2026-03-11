import { ChevronDown } from 'lucide-react';
import { CalidadVinilo } from '../../types/database';
import { useState } from 'react';

interface FilterPanelProps {
  generos: string[];
  selectedGenero: string | null;
  onGeneroChange: (genero: string | null) => void;
  selectedCalidad: CalidadVinilo | null;
  onCalidadChange: (calidad: CalidadVinilo | null) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

const CALIDADES: { value: CalidadVinilo; label: string; description: string }[] = [
  { value: 'NM', label: 'NM (Mint)', description: 'Prácticamente sin uso' },
  { value: 'EX', label: 'EX (Excellent)', description: 'Excelente estado' },
  { value: 'VG+', label: 'VG+ (Very Good+)', description: 'Muy buen estado' },
  { value: 'VG', label: 'VG (Very Good)', description: 'Buen estado' },
  { value: 'G', label: 'G (Good)', description: 'Estado aceptable' },
];

export function FilterPanel({
  generos,
  selectedGenero,
  onGeneroChange,
  selectedCalidad,
  onCalidadChange,
  searchTerm,
  onSearchChange,
}: FilterPanelProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por artista, título o código..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 text-slate-900 font-semibold md:hidden mb-4"
      >
        Filtros
        <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
      </button>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${!showFilters && 'hidden md:grid'}`}>
        <div>
          <h3 className="font-semibold text-slate-900 mb-3">Género</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <button
              onClick={() => onGeneroChange(null)}
              className={`block w-full text-left px-3 py-2 rounded-lg transition-colors ${
                selectedGenero === null
                  ? 'bg-slate-900 text-white'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              Todos los géneros
            </button>
            {generos.map((genero) => (
              <button
                key={genero}
                onClick={() => onGeneroChange(genero)}
                className={`block w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedGenero === genero
                    ? 'bg-slate-900 text-white'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                {genero}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-3">Calidad/Estado</h3>
          <div className="space-y-2">
            <button
              onClick={() => onCalidadChange(null)}
              className={`block w-full text-left px-3 py-2 rounded-lg transition-colors ${
                selectedCalidad === null
                  ? 'bg-slate-900 text-white'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              Todos los estados
            </button>
            {CALIDADES.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => onCalidadChange(value)}
                className={`block w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                  selectedCalidad === value
                    ? 'bg-slate-900 text-white'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
                title={description}
              >
                <span className="font-semibold">{label}</span>
                <p className={`text-xs ${selectedCalidad === value ? 'text-slate-200' : 'text-slate-500'}`}>
                  {description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
