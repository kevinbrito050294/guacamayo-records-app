import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Configura aquí tus datos de MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',           // Tu usuario de MySQL
  password: 'jiokmou', // Tu contraseña de MySQL
  database: 'inventario' // El nombre de tu base de datos
});

db.connect(err => {
  if (err) {
    console.error('❌ Error conectando a MySQL:', err.message);
    return;
  }
  console.log('✅ Conectado a la base de datos MySQL local');
});

// Ruta para obtener divisas
app.get('/api/configuracion_divisas', (req, res) => {
  db.query('SELECT * FROM configuracion_divisas', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Ruta para actualizar una divisa
app.put('/api/configuracion_divisas/:tipo', (req, res) => {
  const { tipo } = req.params;
  const { tasa } = req.body;
  const query = 'UPDATE configuracion_divisas SET tasa = ?, ultima_actualizacion = NOW() WHERE tipo = ?';
  
  db.query(query, [tasa, tipo], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Tasa actualizada correctamente' });
  });
});

const PORT = 3001;

// --- RUTAS PARA VINILOS ---

// 1. Obtener todos los vinilos para el catálogo
app.get('/api/vinilos', (req, res) => {
  // Asegúrate de que tu tabla se llame 'inventario_vinilos' o cámbialo aquí
  db.query('SELECT * FROM inventario_vinilos', (err, results) => {
    if (err) {
      console.error('Error al obtener vinilos:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// 2. Guardar un pedido (para que el botón del carrito funcione)
app.post('/api/pedidos', (req, res) => {
  const { cliente_nombre, cliente_whatsapp, total_usd, items } = req.body;
  
  const query = 'INSERT INTO pedidos (cliente_nombre, cliente_whatsapp, total_usd, fecha) VALUES (?, ?, ?, NOW())';
  
  db.query(query, [cliente_nombre, cliente_whatsapp, total_usd], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Aquí podrías insertar también los detalles en una tabla 'pedidos_items' si la tienes
    res.json({ message: 'Pedido guardado con éxito', id: result.insertId });
  });
});
app.listen(PORT, () => {
  console.log(`🚀 Servidor de Guacamayo Records activo en http://localhost:${PORT}`);
});