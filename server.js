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

// ==========================================
// CONTROL DE SESIÓN ÚNICA
// ==========================================
let adminSession = {
    isActive: false,
    lastHeartbeat: null,
    token: null
};

setInterval(() => {
    if (adminSession.isActive && adminSession.lastHeartbeat) {
        if (Date.now() - adminSession.lastHeartbeat > 30000) {
            console.log("⚠️ Sesión liberada por inactividad.");
            adminSession.isActive = false;
            adminSession.token = null;
        }
    }
}, 10000);

// --- CONFIGURACIÓN DE IMÁGENES ---
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'dist')));

// --- CONEXIÓN DB (RAILWAY) ---
const db = mysql.createPool(process.env.MYSQL_URL);

// ==========================================
// 1. GESTIÓN DE DIVISAS
// ==========================================
app.get('/api/configuracion_divisas', (req, res) => {
    db.query('SELECT * FROM configuracion_divisas', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
    });
});

app.put('/api/configuracion_divisas/:tipo', (req, res) => {
    const { tipo } = req.params;
    const { tasa } = req.body;
    db.query('UPDATE configuracion_divisas SET tasa = ?, ultima_actualizacion = NOW() WHERE tipo = ?', [tasa, tipo], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ==========================================
// 2. GESTIÓN DE VINILOS
// ==========================================
app.get('/api/vinilos', (req, res) => {
    db.query('SELECT * FROM inventario_vinilos ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
    });
});

app.post('/api/vinilos', (req, res) => {
    const { titulo, artista, precio_venta, stock_actual, imagen_url, genero, calidad } = req.body;
    const query = `INSERT INTO inventario_vinilos (titulo, artista, precio_venta, stock_actual, imagen_url, genero, calidad) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.query(query, [titulo, artista, precio_venta, stock_actual, imagen_url, genero, calidad], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.put('/api/vinilos/:id', (req, res) => {
    const { id } = req.params;
    const { titulo, artista, precio_venta, stock_actual, imagen_url, genero, calidad } = req.body;
    const query = `UPDATE inventario_vinilos SET titulo=?, artista=?, precio_venta=?, stock_actual=?, imagen_url=?, genero=?, calidad=? WHERE id=?`; 
    db.query(query, [titulo, artista, precio_venta, stock_actual, imagen_url, genero, calidad, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'OK' });
    });
});

app.delete('/api/vinilos/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM inventario_vinilos WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Eliminado' });
    });
});

app.post('/api/upload-multiple', upload.array('imagenes'), (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });
    const urls = req.files.map(file => `/uploads/${file.filename}`);
    res.json({ urls });
});

// ==========================================
// 3. GESTIÓN DE PEDIDOS (FIXED)
// ==========================================
app.get('/api/pedidos', (req, res) => {
    db.query('SELECT * FROM pedidos ORDER BY fecha DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/pedidos', (req, res) => {
    const { nombre_cliente, whatsapp_cliente, total_pago, divisa_preferida, items } = req.body;
    const numero_orden = `GR-${Math.floor(1000 + Math.random() * 9000)}`;

    db.getConnection((err, conn) => {
        if (err) return res.status(500).json({ error: 'Error DB' });
        conn.beginTransaction((err) => {
            if (err) { conn.release(); return res.status(500).json({ error: err.message }); }

            // Guardamos el pedido incluyendo el campo 'items' como JSON string
            const q = `INSERT INTO pedidos (numero_orden, nombre_cliente, whatsapp_cliente, total_pago, divisa_preferida, estado, fecha, items) VALUES (?, ?, ?, ?, ?, 'pendiente', NOW(), ?)`;
            conn.query(q, [numero_orden, nombre_cliente, whatsapp_cliente, total_pago, divisa_preferida, JSON.stringify(items)], (err) => {
                if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ error: "Error Insert" }); });

                const proms = items.map(item => new Promise((resolve, reject) => {
                    conn.query('UPDATE inventario_vinilos SET stock_actual = stock_actual - ? WHERE id = ? AND stock_actual >= ?',
                        [item.cantidad, item.id, item.cantidad], (e, r) => {
                            if (e) reject(e);
                            else if (r.affectedRows === 0) reject(new Error("No stock"));
                            else resolve();
                        });
                }));

                Promise.all(proms).then(() => {
                    conn.commit(() => { conn.release(); res.json({ success: true, numero_orden }); });
                }).catch(e => conn.rollback(() => { conn.release(); res.status(400).json({ error: e.message }); }));
            });
        });
    });
});

// --- CANCELAR PEDIDO ---
app.put('/api/pedidos/:id/cancelar', (req, res) => {
    const { id } = req.params;
    let { items } = req.body;
    if (!items) return res.status(400).json({ error: "Faltan items" });

    db.getConnection((err, conn) => {
        if (err) return res.status(500).json({ error: "Error DB" });
        conn.beginTransaction((err) => {
            if (err) { conn.release(); return res.status(500).json({ error: "Error Trans" }); }

            conn.query('UPDATE pedidos SET estado = "cancelado" WHERE id_pedido = ?', [id], (err) => {
                if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ error: "Update Fail" }); });

                const itemsArr = Array.isArray(items) ? items : [];
                const proms = itemsArr.map(i => new Promise((resolve, reject) => {
                    const idV = i.id || (i.vinilo && i.vinilo.id);
                    const cant = Number(i.cantidad || 1);
                    if (!idV) return resolve();
                    conn.query('UPDATE inventario_vinilos SET stock_actual = stock_actual + ? WHERE id = ?', [cant, idV], e => e ? reject(e) : resolve());
                }));

                Promise.all(proms).then(() => {
                    conn.commit(() => { conn.release(); res.json({ success: true }); });
                }).catch(e => conn.rollback(() => { conn.release(); res.status(500).json({ error: "Stock Fail" }); }));
            });
        });
    });
});

app.put('/api/pedidos/:id/finalizar', (req, res) => {
    db.query('UPDATE pedidos SET estado = "finalizado" WHERE id_pedido = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ==========================================
// 4. LOGIN & SEGURIDAD
// ==========================================
app.post('/api/admin/login-check', (req, res) => {
    const { password } = req.body;
    if (adminSession.isActive && (Date.now() - adminSession.lastHeartbeat < 30000)) {
        return res.status(423).json({ error: 'BLOQUEADO' });
    }
    if (password === 'CONCHILIS2026') {
        const token = Math.random().toString(36).substr(2) + Date.now();
        adminSession = { isActive: true, lastHeartbeat: Date.now(), token };
        res.json({ success: true, token });
    } else {
        res.status(401).json({ error: 'Incorrecto' });
    }
});

app.post('/api/admin/heartbeat', (req, res) => {
    const { token } = req.body;
    if (token && adminSession.isActive && adminSession.token === token) {
        adminSession.lastHeartbeat = Date.now();
        return res.json({ status: 'alive' });
    }
    res.status(401).json({ status: 'session_lost' });
});

app.post('/api/admin/logout', (req, res) => {
    adminSession.isActive = false;
    adminSession.token = null;
    res.json({ success: true });
});

app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Puerto ${PORT}`));