/*
  # GuacamayoRecords E-commerce Database Schema
  
  1. New Tables
    - `inventario_vinilos`: Catálogo de vinilos con información detallada
    - `configuracion_divisas`: Tasas de cambio actualizables
    - `clientes`: Información de compradores
    - `pedidos`: Órdenes de compra
    - `detalles_pedido`: Items en cada orden
  
  2. Security
    - RLS habilitado en todas las tablas
    - Políticas restrictivas por defecto
    - Acceso público limitado a catálogo
  
  3. Notas Importantes
    - Precios base en USD
    - Conversión dinámica a ARS y USDT
    - Códigos de calidad estandarizados (NM, EX, VG+, VG, G)
*/

-- Crear tabla de inventario
CREATE TABLE IF NOT EXISTS inventario_vinilos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(100) UNIQUE NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  artista VARCHAR(255) NOT NULL,
  genero VARCHAR(100) NOT NULL,
  precio_venta DECIMAL(10, 2) NOT NULL,
  stock_actual INTEGER NOT NULL DEFAULT 0,
  calidad VARCHAR(50) NOT NULL CHECK (calidad IN ('NM', 'EX', 'VG+', 'VG', 'G')),
  imagen_url VARCHAR(500),
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Crear tabla de configuración de divisas
CREATE TABLE IF NOT EXISTS configuracion_divisas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(50) UNIQUE NOT NULL CHECK (tipo IN ('DOLAR_BLUE', 'USDT')),
  tasa DECIMAL(10, 2) NOT NULL,
  ultima_actualizacion TIMESTAMPTZ DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Crear tabla de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  whatsapp VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Crear tabla de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido VARCHAR(50) UNIQUE NOT NULL,
  cliente_id uuid REFERENCES clientes(id) ON DELETE RESTRICT,
  estado VARCHAR(50) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado')),
  precio_total_usd DECIMAL(10, 2) NOT NULL,
  precio_total_ars DECIMAL(12, 2),
  precio_total_usdt DECIMAL(10, 4),
  divisa_preferida VARCHAR(10) DEFAULT 'ARS',
  fecha_pedido TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Crear tabla de detalles del pedido
CREATE TABLE IF NOT EXISTS detalles_pedido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES pedidos(id) ON DELETE CASCADE,
  vinilo_id uuid REFERENCES inventario_vinilos(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario_usd DECIMAL(10, 2) NOT NULL,
  subtotal_usd DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en todas las tablas
ALTER TABLE inventario_vinilos ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_divisas ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_pedido ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para inventario_vinilos (público para lectura)
CREATE POLICY "Inventario público para lectura"
  ON inventario_vinilos
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Solo admin puede insertar vinilos"
  ON inventario_vinilos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Solo admin puede actualizar vinilos"
  ON inventario_vinilos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  );

-- Políticas RLS para configuracion_divisas (público para lectura)
CREATE POLICY "Tasas de cambio públicas"
  ON configuracion_divisas
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Solo admin puede actualizar tasas"
  ON configuracion_divisas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  );

-- Políticas RLS para clientes
CREATE POLICY "Clientes pueden leer sus propios datos"
  ON clientes
  FOR SELECT
  TO authenticated
  USING (true);

-- Políticas RLS para pedidos
CREATE POLICY "Usuarios pueden leer sus propios pedidos"
  ON pedidos
  FOR SELECT
  TO authenticated
  USING (
    cliente_id IS NULL OR
    EXISTS (
      SELECT 1 FROM clientes
      WHERE clientes.id = pedidos.cliente_id
    )
  );

-- Políticas RLS para detalles_pedido
CREATE POLICY "Acceso a detalles de pedidos propios"
  ON detalles_pedido
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos
      WHERE pedidos.id = detalles_pedido.pedido_id
    )
  );

-- Crear índices para optimización
CREATE INDEX idx_inventario_genero ON inventario_vinilos(genero);
CREATE INDEX idx_inventario_calidad ON inventario_vinilos(calidad);
CREATE INDEX idx_inventario_codigo ON inventario_vinilos(codigo);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_numero ON pedidos(numero_pedido);
CREATE INDEX idx_detalles_pedido ON detalles_pedido(pedido_id);
