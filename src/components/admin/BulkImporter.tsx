import { useState } from 'react';
import { Upload, AlertCircle, Check } from 'lucide-react';

interface CSVRow {
  codigo?: string;
  imagen_url?: string;
  stock_actual?: string;
  [key: string]: string | undefined;
}

export function BulkImporter() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [preview, setPreview] = useState<CSVRow[]>([]);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const text = await file.text();
      const lines = text.trim().split('\n');

      if (lines.length < 2) {
        setMessage({ type: 'error', text: 'El archivo debe tener al menos un encabezado y una fila de datos' });
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const requiredFields = ['codigo'];

      const missingFields = requiredFields.filter((field) => !headers.includes(field));
      if (missingFields.length > 0) {
        setMessage({
          type: 'error',
          text: `Faltan columnas requeridas: ${missingFields.join(', ')}`,
        });
        return;
      }

      const rows: CSVRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;

        const values = lines[i].split(',').map((v) => v.trim());
        const row: CSVRow = {};

        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        rows.push(row);
      }

      setPreview(rows);
      setMessage({ type: 'success', text: `Se encontraron ${rows.length} registros para actualizar` });
    } catch (error) {
      console.error('Error reading file:', error);
      setMessage({ type: 'error', text: 'Error al leer el archivo' });
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (preview.length === 0) {
      setMessage({ type: 'error', text: 'No hay datos para importar' });
      return;
    }

    try {
      setLoading(true);
      let exitos = 0;

      // Enviamos cada fila a nuestro servidor local
      for (const row of preview) {
        if (!row.codigo) continue;

        const updateData: any = {
            codigo: row.codigo,
            imagen_url: row.imagen_url || null,
            stock_actual: row.stock_actual ? parseInt(row.stock_actual) : null
        };

        const response = await fetch('http://localhost:3001/api/vinilos/bulk-update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });

        if (response.ok) exitos++;
      }

      setMessage({ type: 'success', text: `${exitos} vinilos actualizados correctamente en MySQL` });
      setPreview([]);
      setTimeout(() => setMessage(null), 4000);
    } catch (error) {
      console.error('Error importing data:', error);
      setMessage({ type: 'error', text: 'Error al conectar con el servidor de MySQL' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-slate-900 mb-6">Importador Masivo (MySQL Local)</h2>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-slate-900 mb-3">
          Selecciona un archivo CSV
        </label>
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors">
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={loading}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className="cursor-pointer text-slate-900 font-semibold hover:text-slate-700"
          >
            Haz clic para seleccionar el archivo de vinilos
          </label>
          <p className="text-sm text-slate-500 mt-2">Formatos aceptados: .csv</p>
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {preview.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-900 mb-4">Vista previa (Primeros 5)</h3>
          <div className="overflow-x-auto mb-6 border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-900">Código</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-900">Imagen URL</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-900">Stock</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-2 text-slate-900 font-mono">{row.codigo}</td>
                    <td className="px-4 py-2 text-slate-600 truncate max-w-xs">{row.imagen_url || '-'}</td>
                    <td className="px-4 py-2 text-slate-900">{row.stock_actual || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Procesando archivo...' : `Actualizar ${preview.length} vinilos en mi base de datos`}
          </button>
        </div>
      )}
    </div>
  );
}