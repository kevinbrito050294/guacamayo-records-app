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
// CONTROL DE SESIÓN ÚNICA (BLOQUEO GLOBAL)
// ==========================================
let adminSession = {
    isActive: false,
    lastHeartbeat: null,
    token: null
};

setInterval(() => {
    if (adminSession.isActive && adminSession.lastHeartbeat) {
        if (Date.now() - adminSession.lastHeartbeat > 30000) {
            console.log("⚠️ Bloqueo de sesión liberado por inactividad.");
            adminSession.isActive = false;
            adminSession.token = null;
        }
    }
}, 10000);

// --- CONFIGURACIÓN DE ALMACENAMIENTO DE IMÁGENES ---
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage });

app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'dist')));

// --- CONEXIÓN A BASE DE DATOS (RAILWAY) ---
const RAILWAY_DB_URL = process.env.MYSQL_URL;
const db = mysql.createPool(RAILWAY_DB_URL);

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
// 2. GESTIÓN DE VINILOS (INVENTARIO)
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
        res.json({ message: 'Eliminado correctamente' });
    });
});

app.post('/api/upload-multiple', upload.array('imagenes'), (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No se subieron archivos' });
    const urls = req.files.map(file => `/uploads/${file.filename}`);
    res.json({ urls });
});

// ==========================================
// 3. GESTIÓN DE PEDIDOS
// ==========================================

// --- NUEVO: CREAR PEDIDO DESDE EL CARRITO ---
app.post('/api/pedidos', (req, res) => {
    const { nombre_cliente, whatsapp_cliente, total_pago, divisa_preferida, items } = req.body;
    const numero_orden = `GR-${Math.floor(1000 + Math.random() * 9000)}`;

    db.getConnection((err, conn) => {
        if (err) return res.status(500).json({ error: 'Error de conexión a la base de datos' });

        conn.beginTransaction((err) => {
            if (err) { conn.release(); return res.status(500).json({ error: err.message }); }

            // 1. Insertar el pedido principal
            const queryPedido = `INSERT INTO pedidos (numero_orden, nombre_cliente, whatsapp_cliente, total_pago, divisa_preferida, estado, fecha) VALUES (?, ?, ?, ?, ?, 'pendiente', NOW())`;
            
            conn.query(queryPedido, [numero_orden, nombre_cliente, whatsapp_cliente, total_pago, divisa_preferida], (err) => {
                if (err) {
                    return conn.rollback(() => { conn.release(); res.status(500).json({ error: "Error al guardar el pedido" }); });
                }

                // 2. Actualizar stock de cada producto enviado
                const promesasStock = items.map(item => {
                    return new Promise((resolve, reject) => {
                        conn.query(
                            'UPDATE inventario_vinilos SET stock_actual = stock_actual - ? WHERE id = ? AND stock_actual >= ?',
                            [item.cantidad, item.id, item.cantidad],
                            (err, resUpdate) => {
                                if (err) return reject(err);
                                if (resUpdate.affectedRows === 0) return reject(new Error(`Sin stock suficiente para: ${item.titulo}`));
                                resolve();
                            }
                        );
                    });
                });

                Promise.all(promesasStock)
                    .then(() => {
                        conn.commit((err) => {
                            if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ error: "Error al confirmar la transacción" }); });
                            conn.release();
                            res.json({ success: true, numero_orden });
                        });
                    })
                    .catch((error) => {
                        conn.rollback(() => { conn.release(); res.status(400).json({ error: error.message }); });
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
    db.query('UPDATE pedidos SET estado = "finalizado" WHERE id_pedido = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.put('/api/pedidos/:id/cancelar', (req, res) => {
    const { id } = req.params;
    const { items } = req.body;
    
    db.getConnection((err, conn) => {
        if (err) return res.status(500).send();
        conn.beginTransaction(() => {
            conn.query('UPDATE pedidos SET estado = "cancelado" WHERE id_pedido = ?', [id], (err) => {
                if (err) return conn.rollback(() => { conn.release(); res.status(500).send(); });
                
                const proms = items.map(i => new Promise((resolve, reject) => {
                    const idVinilo = i.vinilo ? i.vinilo.id : i.id;
                    conn.query('UPDATE inventario_vinilos SET stock_actual = stock_actual + ? WHERE id = ?', [i.cantidad, idVinilo], e => e ? reject(e) : resolve());
                }));
                
                Promise.all(proms)
                    .then(() => conn.commit(() => { conn.release(); res.json({ success: true }); }))
                    .catch(() => conn.rollback(() => { conn.release(); res.status(500).send(); }));
            });
        });
    });
});

// ==========================================
// 4. SEGURIDAD Y LOGIN (MULTIDISPOSITIVO)
// ==========================================

app.post('/api/admin/login-check', (req, res) => {
    const { password } = req.body;

    if (adminSession.isActive && (Date.now() - adminSession.lastHeartbeat < 30000)) {
        return res.status(423).json({ 
            error: 'BLOQUEADO', 
            message: 'El panel ya está siendo usado en otro dispositivo o pestaña.' 
        });
    }

    if (password === 'CONCHILIS2026') {
        const newToken = Math.random().toString(36).substr(2) + Date.now();
        adminSession = {
            isActive: true,
            lastHeartbeat: Date.now(),
            token: newToken
        };
        res.json({ success: true, token: newToken });
    } else {
        res.status(401).json({ error: 'Credenciales inválidas' });
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

// SPA Handler (Siempre al final)
app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor Guacamayo corriendo en puerto ${PORT}`));