import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- CONFIGURACIÓN DE SEGURIDAD Y PUERTO ---
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Asegurar que la carpeta uploads existe
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// --- SERVIR ARCHIVOS ESTÁTICOS DEL FRONTEND (VITE) ---
app.use(express.static(path.join(__dirname, 'dist')));

// --- CONFIGURACIÓN DE BASE DE DATOS ---
const RAILWAY_DB_URL = process.env.MYSQL_URL;

const db = mysql.createConnection(RAILWAY_DB_URL);

db.connect(err => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    return;
  }
  console.log('🚀 ¡Guacamayo Records conectado exitosamente a la nube!');
});

// --- FUNCIÓN AUXILIAR: GENERAR NÚMERO DE ORDEN ---
const generarNumeroOrden = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `GR-${random}`;
};

// --- MULTER (SUBIDA DE IMÁGENES) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueSuffix);
  }
});
const upload = multer({ storage: storage });

// --- ENDPOINTS API ---

app.post('/api/upload', upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  const host = req.get('host'); 
  const protocol = req.protocol === 'http' && host.includes('railway') ? 'https' : req.protocol;
  const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

app.get('/api/configuracion_divisas', (req, res) => {
  db.query('SELECT * FROM configuracion_divisas', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.put('/api/configuracion_divisas/:tipo', (req, res) => {
  const { tipo } = req.params;
  const { tasa } = req.body;
  const query = 'UPDATE configuracion_divisas SET tasa = ?, ultima_actualizacion = NOW() WHERE tipo = ?';
  db.query(query, [tasa, tipo], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Tasa actualizada correctamente' });
  });
});

app.get('/api/vinilos', (req, res) => {
  db.query('SELECT * FROM inventario_vinilos', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.put('/api/vinilos/:id', (req, res) => {
  const { id } = req.params;
  const { titulo, artista, precio_venta, stock_actual, imagen_url } = req.body;
  const query = `
    UPDATE inventario_vinilos 
    SET titulo = ?, artista = ?, precio_venta = ?, stock_actual = ? , imagen_url = ? 
    WHERE id = ?`;
  db.query(query, [titulo, artista, precio_venta, stock_actual, imagen_url, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Vinilo actualizado correctamente' });
  });
});

app.delete('/api/vinilos/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM inventario_vinilos WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Vinilo eliminado correctamente' });
  });
});

// --- SISTEMA DE PEDIDOS INTEGRADO CON NÚMERO DE ORDEN ---

app.post('/api/pedidos', (req, res) => {
  const { nombre_cliente, whatsapp_cliente, total_pago, items } = req.body;
  const nroOrden = generarNumeroOrden(); // 1. Generamos el código GR-XXXX

  db.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: 'Error al iniciar transacción' });

    // 2. Insertamos el pedido incluyendo el nuevo campo numero_orden
    const queryPedido = 'INSERT INTO pedidos (numero_orden, nombre_cliente, whatsapp_cliente, total_pago, fecha, estado) VALUES (?, ?, ?, ?, NOW(), "pendiente")';
    
    db.query(queryPedido, [nroOrden, nombre_cliente, whatsapp_cliente, total_pago], (err, result) => {
      if (err) {
        return db.rollback(() => {
            console.error("❌ Error al insertar pedido:", err);
            res.status(500).json({ error: 'Error al guardar pedido en DB' });
        });
      }

      // 3. Descontar stock
      const promesasStock = items.map(item => {
        return new Promise((resolve, reject) => {
          const queryStock = 'UPDATE inventario_vinilos SET stock_actual = stock_actual - ? WHERE titulo = ? AND artista = ?';
          db.query(queryStock, [item.cantidad, item.vinilo.titulo, item.vinilo.artista], (err, resStock) => {
            if (err) reject(err);
            else resolve(resStock);
          });
        });
      });

      Promise.all(promesasStock)
        .then(() => {
          db.commit((err) => {
            if (err) return db.rollback(() => res.status(500).json({ error: 'Error al confirmar cambios' }));
            
            // 4. Devolvemos éxito y el nroOrden para que el frontend dispare el WhatsApp
            res.json({ 
                success: true,
                message: 'Pedido registrado con éxito', 
                id: result.insertId,
                numero_orden: nroOrden 
            });
          });
        })
        .catch(error => {
          db.rollback(() => {
            console.error("❌ Error actualizando stock:", error);
            res.status(500).json({ error: 'No se pudo actualizar el stock del inventario' });
          });
        });
    });
  });
});

app.get('/api/pedidos', (req, res) => {
  db.query('SELECT * FROM pedidos ORDER BY fecha DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.put('/api/pedidos/:id/finalizar', (req, res) => {
  const { id } = req.params;
  // Cambiado id_pedido por id según la estructura habitual de tus tablas, ajusta si es necesario
  const query = 'UPDATE pedidos SET estado = "finalizado" WHERE id = ?';
  db.query(query, [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Pedido marcado como finalizado' });
  });
});

// --- MANEJO DE RUTAS DEL FRONTEND ---
app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- INICIO DEL SERVIDOR ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor de Guacamayo Records activo en el puerto ${PORT}`);
});