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

// --- LÓGICA DE CONTROL DE SESIÓN ÚNICA ---
let activeAdminSession = {
    isLocked: false,
    lastActivity: null
};

// --- CONFIGURACIÓN DE CARPETA DE SUBIDAS (PERSISTENCIA) ---
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    console.log('📁 Creando carpeta de uploads para almacenamiento persistente...');
    fs.mkdirSync(uploadDir, { recursive: true });
}

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
  destination: (req, file, cb) => { cb(null, uploadDir); },
  filename: (req, file, cb) => {
    // Limpieza de nombre de archivo para evitar errores en URLs
    const uniqueSuffix = Date.now() + '-' + file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    cb(null, uniqueSuffix);
  }
});
const upload = multer({ storage: storage });

// --- ENDPOINTS DE ADMINISTRACIÓN (SESIÓN Y BLOQUEO) ---

app.post('/api/admin/login-check', (req, res) => {
    const { password } = req.body;
    const now = Date.now();
    if (activeAdminSession.isLocked && (now - activeAdminSession.lastActivity > 15 * 60 * 1000)) {
        activeAdminSession.isLocked = false;
    }
    if (password === 'CONCHILIS2026') {
        if (!activeAdminSession.isLocked) {
            activeAdminSession.isLocked = true;
            activeAdminSession.lastActivity = now;
            res.json({ success: true });
        } else {
            res.status(423).json({ error: 'Panel ocupado. Solo un administrador puede editar a la vez.' });
        }
    } else {
        res.status(401).json({ error: 'Contraseña incorrecta' });
    }
});

app.post('/api/admin/heartbeat', (req, res) => {
    if (activeAdminSession.isLocked) {
        activeAdminSession.lastActivity = Date.now();
        res.json({ status: 'mantenido' });
    } else {
        res.status(401).json({ error: 'Sesión no activa' });
    }
});

app.post('/api/admin/logout', (req, res) => {
    activeAdminSession.isLocked = false;
    activeAdminSession.lastActivity = null;
    res.json({ message: 'Panel liberado correctamente' });
});

// --- ENDPOINTS API: SUBIDA DE ARCHIVOS (MÚLTIPLES) ---

// Nuevo endpoint para subir hasta 5 imágenes a la vez
app.post('/api/upload-multiple', upload.array('imagenes', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se subieron archivos' });
  }
  
  // Mapeamos los archivos a sus rutas relativas y los unimos por comas
  const imageUrls = req.files.map(file => `/uploads/${file.filename}`).join(',');
  res.json({ url: imageUrls });
});

// Mantenemos el single por compatibilidad si es necesario
app.post('/api/upload', upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
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
  const query = `UPDATE inventario_vinilos SET titulo = ?, artista = ?, precio_venta = ?, stock_actual = ?, imagen_url = ? WHERE id = ?`; 
  db.query(query, [titulo, artista, precio_venta, stock_actual, imagen_url, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Vinilo no encontrado" });
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
      if (err) { connection.release(); return res.status(500).json({ error: 'Error al iniciar' }); }

      const queryPedido = 'INSERT INTO pedidos (numero_orden, nombre_cliente, whatsapp_cliente, total_pago, fecha, estado) VALUES (?, ?, ?, ?, NOW(), "pendiente")';
      connection.query(queryPedido, [nroOrden, nombre_cliente, whatsapp_cliente, total_pago], (err, result) => {
        if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: 'Error' }); });

        const promesasStock = items.map(item => {
          return new Promise((resolve, reject) => {
            const queryStock = 'UPDATE inventario_vinilos SET stock_actual = stock_actual - ? WHERE id = ?';
            connection.query(queryStock, [item.cantidad, item.id_vinilo || item.id], (err, resStock) => {
              if (err) reject(err); else resolve(resStock);
            });
          });
        });

        Promise.all(promesasStock).then(() => {
          connection.commit((err) => {
            if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: 'Error' }); });
            connection.release();
            res.json({ success: true, message: 'Pedido registrado', id: result.insertId, numero_orden: nroOrden });
          });
        }).catch(() => {
          connection.rollback(() => { connection.release(); res.status(500).json({ error: 'Error stock' }); });
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
  db.query(query, [id], (err) => {
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