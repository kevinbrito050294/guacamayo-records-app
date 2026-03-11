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
const PORT = process.env.PORT || 3001;

// --- MIDDLEWARES ---
app.use(cors()); 
app.use(express.json());

// --- CONFIGURACIÓN DE CARPETA DE SUBIDAS (PERSISTENCIA) ---
// path.resolve asegura que la ruta sea absoluta y compatible con el volumen de Railway
const uploadDir = path.resolve(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
    console.log('📁 Creando carpeta de uploads para almacenamiento persistente...');
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Servimos los archivos estáticos
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'dist')));

// --- CONFIGURACIÓN DE BASE DE DATOS (POOL) ---
const RAILWAY_DB_URL = process.env.MYSQL_URL;
const db = mysql.createPool(RAILWAY_DB_URL);

console.log('🚀 Guacamayo Records: Conectando a la base de datos...');

const generarNumeroOrden = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `GR-${random}`;
};

// --- CONFIGURACIÓN DE MULTER (IMÁGENES) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => { 
    cb(null, uploadDir); // Usamos la ruta absoluta resuelta arriba
  },
  filename: (req, file, cb) => {
    // Reemplazamos espacios y caracteres raros para evitar errores en URLs de móvil
    const uniqueSuffix = Date.now() + '-' + file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    cb(null, uniqueSuffix);
  }
});
const upload = multer({ storage: storage });

// --- ENDPOINTS API: SUBIDA DE ARCHIVOS ---
app.post('/api/upload', upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  
  // IMPORTANTE: Devolvemos una ruta relativa. 
  // Esto evita que se guarde "localhost" o "dominio.com" fijo en la DB.
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

// --- ENDPOINTS API: CONFIGURACIÓN DE DIVISAS ---
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
  db.query(query, [tasa, tipo], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Tasa actualizada correctamente' });
  });
});

// --- ENDPOINTS API: INVENTARIO DE VINILOS (CRUD) ---

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
    SET titulo = ?, artista = ?, precio_venta = ?, stock_actual = ?, imagen_url = ? 
    WHERE id = ?`; 

  db.query(query, [titulo, artista, precio_venta, stock_actual, imagen_url, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Vinilo no encontrado" });
    }
    res.json({ message: 'Vinilo actualizado correctamente' });
  });
});

app.delete('/api/vinilos/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM inventario_vinilos WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Vinilo eliminado correctamente' });
  });
});

// --- ENDPOINTS API: SISTEMA DE PEDIDOS ---

app.post('/api/pedidos', (req, res) => {
  const { nombre_cliente, whatsapp_cliente, total_pago, items } = req.body;
  const nroOrden = generarNumeroOrden();

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Error de conexión' });

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        return res.status(500).json({ error: 'Error al iniciar transacción' });
      }

      const queryPedido = 'INSERT INTO pedidos (numero_orden, nombre_cliente, whatsapp_cliente, total_pago, fecha, estado) VALUES (?, ?, ?, ?, NOW(), "pendiente")';
      
      connection.query(queryPedido, [nroOrden, nombre_cliente, whatsapp_cliente, total_pago], (err, result) => {
        if (err) {
          return connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: 'Error al guardar pedido' });
          });
        }

        const promesasStock = items.map(item => {
          return new Promise((resolve, reject) => {
            const queryStock = 'UPDATE inventario_vinilos SET stock_actual = stock_actual - ? WHERE id = ?';
            connection.query(queryStock, [item.cantidad, item.id_vinilo || item.id], (err, resStock) => {
              if (err) reject(err);
              else resolve(resStock);
            });
          });
        });

        Promise.all(promesasStock)
          .then(() => {
            connection.commit((err) => {
              if (err) return connection.rollback(() => {
                connection.release();
                res.status(500).json({ error: 'Error al confirmar' });
              });
              connection.release();
              res.json({ success: true, message: 'Pedido registrado', id: result.insertId, numero_orden: nroOrden });
            });
          })
          .catch(error => {
            connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: 'No se pudo actualizar el stock' });
            });
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
  const query = 'UPDATE pedidos SET estado = "finalizado" WHERE id_pedido = ?';
  db.query(query, [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Pedido finalizado' });
  });
});

// --- MANEJO DE RUTAS DEL FRONTEND (SPA) ---
app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor de Guacamayo activo en puerto ${PORT}`);
});