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

// --- CONFIGURACIÓN DE IMÁGENES ---
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

// --- BASE DE DATOS ---
const RAILWAY_DB_URL = process.env.MYSQL_URL;
const db = mysql.createPool(RAILWAY_DB_URL);

const generarNumeroOrden = () => `GR-${Math.floor(1000 + Math.random() * 9000)}`;

// --- NUEVO: ENDPOINTS DE DIVISAS (Para evitar errores en consola) ---
app.get('/api/configuracion_divisas', (req, res) => {
    db.query('SELECT * FROM configuracion_divisas LIMIT 1', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results[0] || { tasa_paralelo: 1, tasa_bcv: 1 });
    });
});

app.post('/api/configuracion_divisas', (req, res) => {
    const { tasa_paralelo, tasa_bcv } = req.body;
    const query = 'UPDATE configuracion_divisas SET tasa_paralelo = ?, tasa_bcv = ?, ultima_actualizacion = NOW() WHERE id = 1';
    db.query(query, [tasa_paralelo, tasa_bcv], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- NUEVO: CARGA DE IMÁGENES (Para el AdminPanel) ---
app.post('/api/upload-multiple', upload.array('imagenes'), (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });
    const urls = req.files.map(file => `/uploads/${file.filename}`);
    res.json({ urls });
});

// --- NUEVO: SESIÓN ADMIN (POST para que coincida con tu useEffect de App.tsx) ---
app.post('/api/admin/heartbeat', (req, res) => {
    res.json({ status: 'alive', lastActivity: new Date() });
});

app.post('/api/admin/logout', (req, res) => {
    res.json({ success: true, message: 'Sesión liberada en servidor' });
});

// --- CUPONES ---
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

app.post('/api/cupones/validar', (req, res) => {
    const { codigo } = req.body;
    db.query('SELECT * FROM cupones WHERE codigo = ? AND activo = 1', [codigo.toUpperCase()], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'Inválido' });
        res.json(results[0]);
    });
});

// --- VINILOS ---
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
        res.json({ message: 'OK' });
    });
});

// --- PEDIDOS ---
app.post('/api/pedidos', (req, res) => {
    const { nombre_cliente, whatsapp_cliente, total_pago, items, cupon_id } = req.body;
    const nroOrden = generarNumeroOrden();
    db.getConnection((err, conn) => {
        if (err) return res.status(500).send();
        conn.beginTransaction(() => {
            const q = 'INSERT INTO pedidos (numero_orden, nombre_cliente, whatsapp_cliente, total_pago, items, cupon_id, fecha, estado) VALUES (?, ?, ?, ?, ?, ?, NOW(), "pendiente")';
            conn.query(q, [nroOrden, nombre_cliente, whatsapp_cliente, total_pago, JSON.stringify(items), cupon_id], (err) => {
                if (err) return conn.rollback(() => { conn.release(); res.status(500).send(); });
                
                const proms = items.map(i => new Promise((res, rej) => {
                    conn.query('UPDATE inventario_vinilos SET stock_actual = stock_actual - ? WHERE id = ?', [i.cantidad, i.id], e => e ? rej(e) : res());
                }));
                
                Promise.all(proms).then(() => {
                    conn.commit(() => { conn.release(); res.json({ success: true, numero_orden: nroOrden }); });
                }).catch(() => conn.rollback(() => { conn.release(); res.status(500).send(); }));
            });
        });
    });
});

// --- LOGIN ---
app.post('/api/admin/login-check', (req, res) => {
    if (req.body.password === 'CONCHILIS2026') res.json({ success: true });
    else res.status(401).json({ error: 'Incorrecto' });
});

// SPA Handler
app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Puerto ${PORT}`));