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

app.use(cors()); 
app.use(express.json());

let activeAdminSession = { isLocked: false, lastActivity: null };

const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'dist')));

const RAILWAY_DB_URL = process.env.MYSQL_URL;
const db = mysql.createPool(RAILWAY_DB_URL);

const generarNumeroOrden = () => `GR-${Math.floor(1000 + Math.random() * 9000)}`;

const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadDir); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    cb(null, uniqueSuffix);
  }
});
const upload = multer({ storage: storage });

// --- ENDPOINTS ADMIN ---
app.post('/api/admin/login-check', (req, res) => {
    const { password } = req.body;
    const now = Date.now();
    if (password === 'CONCHILIS2026') {
        activeAdminSession.isLocked = true;
        activeAdminSession.lastActivity = now;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Incorrecto' });
    }
});

// --- ENDPOINTS API ---
app.get('/api/vinilos', (req, res) => {
  db.query('SELECT * FROM inventario_vinilos', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.put('/api/vinilos/:id', (req, res) => {
  const { id } = req.params;
  const { titulo, artista, precio_venta, stock_actual, imagen_url } = req.body;
  const query = `UPDATE inventario_vinilos SET titulo=?, artista=?, precio_venta=?, stock_actual=?, imagen_url=? WHERE id=?`; 
  db.query(query, [titulo, artista, precio_venta, stock_actual, imagen_url, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Actualizado' });
  });
});

// --- SISTEMA DE PEDIDOS ---
app.post('/api/pedidos', (req, res) => {
  const { nombre_cliente, whatsapp_cliente, total_pago, items } = req.body;
  const nroOrden = generarNumeroOrden();

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Error DB' });
    
    connection.beginTransaction((err) => {
      if (err) { connection.release(); return res.status(500).json({ error: 'Error Transacción' }); }

      const queryPedido = 'INSERT INTO pedidos (numero_orden, nombre_cliente, whatsapp_cliente, total_pago, items, fecha, estado) VALUES (?, ?, ?, ?, ?, NOW(), "pendiente")';
      connection.query(queryPedido, [nroOrden, nombre_cliente, whatsapp_cliente, total_pago, JSON.stringify(items)], (err, result) => {
        if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err }); });

        const promesasStock = items.map(item => {
          return new Promise((resolve, reject) => {
            const queryStock = 'UPDATE inventario_vinilos SET stock_actual = stock_actual - ? WHERE id = ?';
            connection.query(queryStock, [item.cantidad, item.id], (err, res) => {
              if (err) reject(err); else resolve(res);
            });
          });
        });

        Promise.all(promesasStock).then(() => {
          connection.commit((err) => {
            connection.release();
            res.json({ success: true, numero_orden: nroOrden });
          });
        }).catch(() => connection.rollback(() => { connection.release(); res.status(500).send(); }));
      });
    });
  });
});

app.get('/api/pedidos', (req, res) => {
  db.query('SELECT * FROM pedidos ORDER BY (estado = "cancelado") ASC, fecha DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.put('/api/pedidos/:id/cancelar', (req, res) => {
  const { id } = req.params;
  const { items } = req.body;

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Error DB' });

    connection.beginTransaction((err) => {
      connection.query('UPDATE pedidos SET estado = "cancelado" WHERE id_pedido = ?', [id], (err) => {
        if (err) return connection.rollback(() => { connection.release(); res.status(500).send(); });

        if (items && Array.isArray(items)) {
          const promesasDevolucion = items.map(item => {
            return new Promise((resolve, reject) => {
              const queryReponer = 'UPDATE inventario_vinilos SET stock_actual = stock_actual + ? WHERE id = ?';
              connection.query(queryReponer, [item.cantidad, item.id_vinilo || item.id], (err) => {
                if (err) reject(err); else resolve();
              });
            });
          });

          Promise.all(promesasDevolucion).then(() => {
            connection.commit(() => { connection.release(); res.json({ message: 'Pedido cancelado y stock devuelto' }); });
          }).catch(() => connection.rollback(() => { connection.release(); res.status(500).send(); }));
        } else {
          connection.commit(() => { connection.release(); res.json({ message: 'Pedido cancelado' }); });
        }
      });
    });
  });
});

app.put('/api/pedidos/:id/finalizar', (req, res) => {
  db.query('UPDATE pedidos SET estado = "finalizado" WHERE id_pedido = ?', [req.params.id], (err) => {
    if (err) res.status(500).send(); else res.json({ message: 'Finalizado' });
  });
});

app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Puerto ${PORT}`));