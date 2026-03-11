-- Script de Base de Datos para GuacamayoRecords
-- Compatible con MySQL 8.0+
-- ¡IMPORTANTE! Este es solo un backup de referencia.
-- Estamos usando Supabase (PostgreSQL), pero aquí está la versión MySQL si la necesitas.

-- Crear base de datos
CREATE DATABASE IF NOT EXISTS guacamayo_records;
USE guacamayo_records;

-- Tabla: inventario_vinilos
CREATE TABLE IF NOT EXISTS inventario_vinilos (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  codigo VARCHAR(100) UNIQUE NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  artista VARCHAR(255) NOT NULL,
  genero VARCHAR(100) NOT NULL,
  precio_venta DECIMAL(10, 2) NOT NULL,
  stock_actual INT NOT NULL DEFAULT 0,
  calidad ENUM('NM', 'EX', 'VG+', 'VG', 'G') NOT NULL,
  imagen_url VARCHAR(500),
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_genero (genero),
  INDEX idx_calidad (calidad),
  INDEX idx_codigo (codigo)
);

-- Tabla: configuracion_divisas
CREATE TABLE IF NOT EXISTS configuracion_divisas (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  tipo ENUM('DOLAR_BLUE', 'USDT') UNIQUE NOT NULL,
  tasa DECIMAL(10, 2) NOT NULL,
  ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by CHAR(36),
  INDEX idx_tipo (tipo)
);

-- Tabla: clientes
CREATE TABLE IF NOT EXISTS clientes (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  whatsapp VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_email (email)
);

-- Tabla: pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  numero_pedido VARCHAR(50) UNIQUE NOT NULL,
  cliente_id CHAR(36),
  estado ENUM('pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado') NOT NULL DEFAULT 'pendiente',
  precio_total_usd DECIMAL(10, 2) NOT NULL,
  precio_total_ars DECIMAL(12, 2),
  precio_total_usdt DECIMAL(10, 4),
  divisa_preferida VARCHAR(10) DEFAULT 'ARS',
  fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  INDEX idx_cliente (cliente_id),
  INDEX idx_numero (numero_pedido)
);

-- Tabla: detalles_pedido
CREATE TABLE IF NOT EXISTS detalles_pedido (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  pedido_id CHAR(36) NOT NULL,
  vinilo_id CHAR(36) NOT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario_usd DECIMAL(10, 2) NOT NULL,
  subtotal_usd DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (vinilo_id) REFERENCES inventario_vinilos(id) ON DELETE RESTRICT,
  INDEX idx_pedido (pedido_id)
);

-- Insertar datos iniciales de tasas
INSERT INTO configuracion_divisas (tipo, tasa) VALUES
('DOLAR_BLUE', 1185.00),
('USDT', 1180.00)
ON DUPLICATE KEY UPDATE tasa = VALUES(tasa);

-- Crear vista para órdenes completas (opcional)
CREATE VIEW IF NOT EXISTS vw_pedidos_detalle AS
SELECT
  p.numero_pedido,
  p.estado,
  p.precio_total_usd,
  p.precio_total_ars,
  p.precio_total_usdt,
  p.divisa_preferida,
  p.fecha_pedido,
  c.nombre as cliente_nombre,
  c.whatsapp,
  COUNT(dp.id) as cantidad_items
FROM pedidos p
LEFT JOIN clientes c ON p.cliente_id = c.id
LEFT JOIN detalles_pedido dp ON p.id = dp.pedido_id
GROUP BY p.id;

-- Crear triggers para actualizar updated_at (opcional)
DELIMITER $$

CREATE TRIGGER IF NOT EXISTS inventario_vinilos_update
BEFORE UPDATE ON inventario_vinilos
FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER IF NOT EXISTS pedidos_update
BEFORE UPDATE ON pedidos
FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$

DELIMITER ;

-- Permisos (ajusta según usuarios)
-- GRANT SELECT ON guacamayo_records.* TO 'usuario_lectura'@'localhost';
-- GRANT SELECT, INSERT, UPDATE ON guacamayo_records.* TO 'usuario_admin'@'localhost';
-- FLUSH PRIVILEGES;

-- Datos de ejemplo para pruebas
INSERT INTO inventario_vinilos (codigo, titulo, artista, genero, precio_venta, stock_actual, calidad, imagen_url) VALUES
('LP001', 'Abbey Road', 'The Beatles', 'Rock', 25.00, 5, 'VG+', 'https://example.com/abbey-road.jpg'),
('LP002', 'Kind of Blue', 'Miles Davis', 'Jazz', 30.00, 3, 'EX', 'https://example.com/kind-of-blue.jpg'),
('LP003', 'Thriller', 'Michael Jackson', 'Pop', 20.00, 8, 'VG', 'https://example.com/thriller.jpg'),
('LP004', 'Dark Side of the Moon', 'Pink Floyd', 'Rock', 35.00, 2, 'NM', 'https://example.com/dark-side.jpg'),
('LP005', 'Rumours', 'Fleetwood Mac', 'Rock', 22.00, 6, 'VG+', 'https://example.com/rumours.jpg');

-- Índices adicionales para optimización
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_fecha ON pedidos(fecha_pedido);
CREATE INDEX idx_inventario_precio ON inventario_vinilos(precio_venta);

-- Mostrar resumen
SELECT 'Base de datos GuacamayoRecords creada exitosamente' as Mensaje;
SELECT CONCAT('Total de vinilos de ejemplo: ', COUNT(*)) FROM inventario_vinilos;
SELECT CONCAT('Tasas de cambio configuradas: ', COUNT(*)) FROM configuracion_divisas;
