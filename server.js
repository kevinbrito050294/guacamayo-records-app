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

const generarNumeroOrden = () => `GR-${Math.floor(1000 + Math.random() * 9000)}`;

// ==========================================
// 1. GESTIÓN DE DIVISAS (CORREGIDO)
// ==========================================

// Obtener todas las tasas (Dolar Blue, USDT, etc.)
app.get('/api/configuracion_divisas', (req, res) => {
    db.query('SELECT * FROM configuracion_divisas', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []); // Enviamos el array completo para el frontend
    });
});

// Actualizar una tasa específica por su tipo
app.put('/api/configuracion_divisas/:tipo', (req, res) => {
    const { tipo } = req.params;
    const { tasa } = req.body;
    const query = 'UPDATE configuracion_divisas SET tasa = ?, ultima_actualizacion = NOW() WHERE tipo = ?';
    
    db.query(query, [tasa, tipo], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Divisa no encontrada' });
        res.json({ success: true });
    });
});

// ==========================================
// 2. GESTIÓN DE VINILOS (INVENTARIO)
// ==========================================

app.get('/api/vinilos', (req, res) => {
    db.query('SELECT * FROM inventario_vinilos', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results || []);
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

// Carga de múltiples imágenes para la galería
app.post('/api/upload-multiple', upload.array('imagenes'), (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No se subieron archivos' });
    const urls = req.files.map(file => `/uploads/${file.filename}`);
    res.json({ urls });
});

// ==========================================
// 3. GESTIÓN DE PEDIDOS Y VENTAS
// ==========================================

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

app.post('/api/pedidos', (req, res) => {
    const { nombre_cliente, whatsapp_cliente, total_pago, items, cupon_id } = req.body;
    const nroOrden = generarNumeroOrden();
    
    db.getConnection((err, conn) => {
        if (err) return res.status(500).send();
        conn.beginTransaction(() => {
            const q = 'INSERT INTO pedidos (numero_orden, nombre_cliente, whatsapp_cliente, total_pago, items, cupon_id, fecha, estado) VALUES (?, ?, ?, ?, ?, ?, NOW(), "pendiente")';
            conn.query(q, [nroOrden, nombre_cliente, whatsapp_cliente, total_pago, JSON.stringify(items), cupon_id], (err) => {
                if (err) return conn.rollback(() => { conn.release(); res.status(500).send(); });
                
                // Descontar stock por cada item
                const proms = items.map(i => new Promise((resolve, reject) => {
                    conn.query('UPDATE inventario_vinilos SET stock_actual = stock_actual - ? WHERE id = ?', [i.cantidad, i.id], e => e ? reject(e) : resolve());
                }));
                
                Promise.all(proms)
                    .then(() => {
                        conn.commit(() => { conn.release(); res.json({ success: true, numero_orden: nroOrden }); });
                    })
                    .catch(() => conn.rollback(() => { conn.release(); res.status(500).send(); }));
            });
        });
    });
});

// ==========================================
// 4. CUPONES Y SEGURIDAD
// ==========================================

app.get('/api/admin/cupones', (req, res) => {
    db.query('SELECT * FROM cupones ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/admin/cupones', (req, res) => {
    const { codigo, tipo, valor, fecha_expiracion, uso_maximo } = req.body;
    const query = 'INSERT INTO cupones (codigo, tipo, valor, fecha_expiracion, uso_maximo) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [codigo.toUpperCase(), tipo, valor, fecha_expiracion, uso_maximo], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/admin/login-check', (req, res) => {
    if (req.body.password === 'CONCHILIS2026') res.json({ success: true });
    else res.status(401).json({ error: 'Credenciales inválidas' });
});

app.post('/api/admin/heartbeat', (req, res) => {
    res.json({ status: 'alive', lastActivity: new Date() });
});

// SPA Handler (para que React maneje las rutas)
app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));