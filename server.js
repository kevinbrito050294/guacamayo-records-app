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

// --- ENDPOINTS DE CUPONES ---

// Listar todos los cupones (Admin)
app.get('/api/admin/cupones', (req, res) => {
  db.query('SELECT * FROM cupones ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Crear un cupón (Admin)
app.post('/api/admin/cupones', (req, res) => {
  const { codigo, tipo, valor, fecha_expiracion, uso_maximo } = req.body;
  const query = 'INSERT INTO cupones (codigo, tipo, valor, fecha_expiracion, uso_maximo) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [codigo.toUpperCase(), tipo, valor, fecha_expiracion || null, uso_maximo || null], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Validar un cupón (Carrito)
app.post('/api/cupones/validar', (req, res) => {
  const { codigo } = req.body;
  const query = 'SELECT * FROM cupones WHERE codigo = ? AND activo = 1';
  
  db.query(query, [codigo.toUpperCase()], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error DB' });
    if (results.length === 0) return res.status(404).json({ error: 'Cupón no encontrado o inactivo' });

    const cupon = results[0];
    const ahora = new Date();

    if (cupon.fecha_expiracion && new Date(cupon.fecha_expiracion) < ahora) {
      return res.status(400).json({ error: 'Este cupón ha expirado' });
    }

    if (cupon.uso_maximo && cupon.usos_actuales >= cupon.uso_maximo) {
      return res.status(400).json({ error: 'Límite de usos alcanzado' });
    }

    res.json(cupon);
  });
});

// --- ENDPOINTS API VINILOS ---
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
  const { nombre_cliente, whatsapp_cliente, total_pago, items, cupon_id } = req.body;
  const nroOrden = generarNumeroOrden();

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Error de conexión a la base de datos' });
    
    connection.beginTransaction((err) => {
      if (err) { connection.release(); return res.status(500).json({ error: 'Error al iniciar transacción' }); }

      // 1. Insertar el Pedido (agregamos cupon_id a la consulta si tu tabla lo tiene, si no, se guarda igual)
      const queryPedido = 'INSERT INTO pedidos (numero_orden, nombre_cliente, whatsapp_cliente, total_pago, items, cupon_id, fecha, estado) VALUES (?, ?, ?, ?, ?, ?, NOW(), "pendiente")';
      connection.query(queryPedido, [nroOrden, nombre_cliente, whatsapp_cliente, total_pago, JSON.stringify(items), cupon_id || null], (err, result) => {
        if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: "Error al guardar el pedido" }); });

        // 2. Descontar Stock
        const promesasOperaciones = items.map(item => {
          return new Promise((resolve, reject) => {
            const queryStock = 'UPDATE inventario_vinilos SET stock_actual = stock_actual - ? WHERE id = ?';
            connection.query(queryStock, [item.cantidad, item.id], (err, res) => {
              if (err) reject(err); else resolve(res);
            });
          });
        });

        // 3. Incrementar usos del cupón si se usó uno
        if (cupon_id) {
          promesasOperaciones.push(new Promise((resolve, reject) => {
            const queryCupon = 'UPDATE cupones SET usos_actuales = usos_actuales + 1 WHERE id = ?';
            connection.query(queryCupon, [cupon_id], (err) => {
              if (err) reject(err); else resolve();
            });
          }));
        }

        Promise.all(promesasOperaciones)
          .then(() => {
            connection.commit((err) => {
              if (err) return connection.rollback(() => { connection.release(); res.status(500).send(); });
              connection.release();
              res.json({ success: true, numero_orden: nroOrden });
            });
          })
          .catch((err) => connection.rollback(() => { 
            connection.release(); 
            res.status(500).json({ error: "Error procesando el stock o cupón" }); 
          }));
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

// Admin login simple
app.post('/api/admin/login-check', (req, res) => {
    const { password } = req.body;
    if (password === 'CONCHILIS2026') {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Incorrecto' });
    }
});

app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Puerto ${PORT}`));