import { ShoppingCart, AlertCircle } from 'lucide-react';
import { ViniloCatalogo, PreciosConvertidos } from '../../types/database';

interface VinylCardProps {
  vinilo: ViniloCatalogo;
  precios: PreciosConvertidos;
  divisaPreferida: 'USD' | 'ARS' | 'USDT';
  onAddToCart: (vinilo: ViniloCatalogo) => void;
}

export function VinylCard({ vinilo, precios, divisaPreferida, onAddToCart }: VinylCardProps) {
  const precioMostrado =
    divisaPreferida === 'ARS' ? precios.ars : divisaPreferida === 'USDT' ? precios.usdt : precios.usd;

  const simbolo = divisaPreferida === 'ARS' ? '$' : divisaPreferida === 'USDT' ? 'USDT' : 'USD $';

  const calidades: { [key: string]: string } = {
    NM: 'Mint Condition',
    EX: 'Excellent',
    'VG+': 'Very Good+',
    VG: 'Very Good',
    G: 'Good',
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="relative h-56 bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden">
        {vinilo.imagen_url ? (
          <img
            src={vinilo.imagen_url}
            alt={`${vinilo.artista} - ${vinilo.titulo}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-2">🎵</div>
              <p className="text-slate-500 text-sm">Imagen no disponible</p>
            </div>
          </div>
        )}

        <div className="absolute top-3 right-3 bg-slate-900 text-white px-3 py-1 rounded-full text-xs font-semibold">
          {vinilo.calidad}
        </div>

        {vinilo.stock_actual === 0 && (
          <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
            <div className="text-white text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="font-semibold">Agotado</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{vinilo.genero}</p>
        <h3 className="font-bold text-slate-900 mb-1 line-clamp-2">{vinilo.artista}</h3>
        <p className="text-sm text-slate-600 mb-3 line-clamp-2">{vinilo.titulo}</p>

        <div className="mb-3 text-xs text-slate-500 space-y-1">
           
            {vinilo.pais_origen && <p>Origen: {vinilo.pais_origen}</p>}
            <p>{calidades[vinilo.calidad]}</p>
          </div>

        <div className="border-t pt-3 mb-4">
          <p className="text-2xl font-bold text-slate-900">
            {simbolo} {precioMostrado.toLocaleString('es-AR', { minimumFractionDigits: divisaPreferida === 'USDT' ? 4 : 2 })}
          </p>
        </div>

        <button
          onClick={() => onAddToCart(vinilo)}
          disabled={vinilo.stock_actual === 0}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          Agregar al Carrito
        </button>
      </div>
    </div>
  );
}
