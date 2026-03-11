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

// --- CONFIGURACIÓN DE CORS ---
// Esto permite que tu frontend (en local o en otro dominio) pueda hablar con el backend
app.use(cors()); 
app.use(express.json());

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'dist')));

// --- CONFIGURACIÓN DE BASE DE DATOS ---
const RAILWAY_DB_URL = process.env.MYSQL_URL;

// Usamos createPool en lugar de createConnection para mayor estabilidad en Railway
const db = mysql.createPool(RAILWAY_DB_URL);

console.log('🚀 Intentando conectar con la base de datos de Guacamayo...');

const generarNumeroOrden = () => {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `GR-${random}`;
};

// --- MULTER ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/'); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueSuffix);
  }
});
const upload = multer({ storage: storage });

// --- ENDPOINTS API ---

// Subida de imágenes
app.post('/api/upload', upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  const host = req.get('host'); 
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

// Obtener divisas (Aquí estaba el fallo de conexión)
app.get('/api/configuracion_divisas', (req, res) => {
  db.query('SELECT * FROM configuracion_divisas', (err, results) => {
    if (err) {
      console.error("❌ Error en GET divisas:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Actualizar divisas
app.put('/api/configuracion_divisas/:tipo', (req, res) => {
  const { tipo } = req.params;
  const { tasa } = req.body;
  const query = 'UPDATE configuracion_divisas SET tasa = ?, ultima_actualizacion = NOW() WHERE tipo = ?';
  db.query(query, [tasa, tipo], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Tasa actualizada correctamente' });
  });
});

// Inventario
app.get('/api/vinilos', (req, res) => {
  db.query('SELECT * FROM inventario_vinilos', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ... (Resto de tus endpoints de vinilos y pedidos se mantienen igual)

// --- SISTEMA DE PEDIDOS ---
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
            connection.query(queryStock, [item.cantidad, item.id_vinilo], (err, resStock) => {
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

// Finalizar pedido (Ajuste de id_pedido)
app.put('/api/pedidos/:id/finalizar', (req, res) => {
  const { id } = req.params;
  const query = 'UPDATE pedidos SET estado = "finalizado" WHERE id_pedido = ?';
  db.query(query, [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Pedido finalizado' });
  });
});

app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor de Guacamayo activo en puerto ${PORT}`);
});