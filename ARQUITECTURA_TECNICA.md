# Arquitectura Técnica - GuacamayoRecords

## Stack Tecnológico

- **Frontend:** React 18 + TypeScript
- **Base de Datos:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS
- **Build:** Vite
- **Icons:** Lucide React
- **API Cliente:** @supabase/supabase-js

---

## Estructura de Directorios

```
src/
├── components/
│   ├── Catalog.tsx           # Página principal de catálogo
│   ├── Cart.tsx              # Carrito de compras
│   ├── CurrencySelector.tsx  # Selector de divisas
│   ├── AdminPanel.tsx        # Panel de administración
│   ├── catalog/
│   │   ├── VinylCard.tsx     # Tarjeta de vinilo
│   │   └── FilterPanel.tsx   # Panel de filtros
│   └── admin/
│       ├── VinylForm.tsx     # Formulario para nuevo vinilo
│       ├── BulkImporter.tsx  # Importador de CSV
│       └── CurrencyManager.tsx # Gestor de tasas
├── lib/
│   ├── supabase.ts           # Cliente Supabase
│   ├── currency.ts           # Lógica de conversión
│   └── whatsapp.ts           # Integración WhatsApp
├── types/
│   └── database.ts           # Tipos TypeScript
├── App.tsx                   # Componente principal
├── main.tsx                  # Entrada
└── index.css                 # Estilos globales
```

---

## Base de Datos - Schema

### Tabla: `inventario_vinilos`
Almacena el catálogo completo.

```sql
id (UUID) PRIMARY KEY
codigo (VARCHAR) UNIQUE          -- SKU del vinilo
titulo (VARCHAR)                 -- Nombre del álbum
artista (VARCHAR)                -- Artista/banda
genero (VARCHAR)                 -- Género musical
precio_venta (DECIMAL)           -- Precio en USD
stock_actual (INTEGER)           -- Cantidad disponible
calidad (VARCHAR)                -- NM, EX, VG+, VG, G
imagen_url (VARCHAR)             -- URL de la foto
descripcion (TEXT)               -- Info adicional
created_at, updated_at           -- Timestamps
```

### Tabla: `configuracion_divisas`
Tasas de cambio actualizables.

```sql
id (UUID) PRIMARY KEY
tipo (VARCHAR) UNIQUE            -- DOLAR_BLUE, USDT
tasa (DECIMAL)                   -- Valor de la tasa
ultima_actualizacion (TIMESTAMP) -- Cuándo cambió
updated_by (UUID)                -- Quién la cambió
```

### Tabla: `clientes`
Información de compradores.

```sql
id (UUID) PRIMARY KEY
nombre (VARCHAR)                 -- Nombre del cliente
email (VARCHAR)                  -- Email
whatsapp (VARCHAR)               -- Número de WhatsApp
created_at                       -- Fecha de registro
```

### Tabla: `pedidos`
Órdenes de compra.

```sql
id (UUID) PRIMARY KEY
numero_pedido (VARCHAR) UNIQUE   -- ID único del pedido
cliente_id (UUID) FK             -- Cliente que compró
estado (VARCHAR)                 -- pendiente, confirmado, etc.
precio_total_usd (DECIMAL)       -- Total en USD
precio_total_ars (DECIMAL)       -- Total convertido a ARS
precio_total_usdt (DECIMAL)      -- Total convertido a USDT
divisa_preferida (VARCHAR)       -- Divisa elegida por cliente
fecha_pedido (TIMESTAMP)         -- Cuándo se realizó
created_at, updated_at           -- Timestamps
```

### Tabla: `detalles_pedido`
Items dentro de cada pedido.

```sql
id (UUID) PRIMARY KEY
pedido_id (UUID) FK              -- Orden a la que pertenece
vinilo_id (UUID) FK              -- Vinilo comprado
cantidad (INTEGER)               -- Cuántos se compraron
precio_unitario_usd (DECIMAL)    -- Precio unitario en USD
subtotal_usd (DECIMAL)           -- Cantidad × Precio
created_at                       -- Fecha
```

---

## Funcionalidades Clave

### 1. Sistema de Filtros
**Ubicación:** `components/catalog/FilterPanel.tsx`

Permite filtrar por:
- Género (Rock, Jazz, etc.)
- Calidad (NM, EX, VG+, VG, G)
- Búsqueda por texto (artista, título, código)

**Lógica:**
```typescript
filtrados = vinilos.filter(v =>
  matchGenero && matchCalidad && matchSearch
)
```

### 2. Conversión de Divisas
**Ubicación:** `lib/currency.ts`

Flujo:
1. Obtiene tasas de `configuracion_divisas`
2. Multiplica precio USD × tasa
3. Redondea a 2 decimales (ARS) o 4 (USDT)
4. Cachea por 1 minuto

```typescript
async convertirPrecio(precioUSD) {
  return {
    usd: precioUSD,
    ars: precioUSD * tasaDolarBlue,
    usdt: precioUSD * tasaUSDT
  }
}
```

### 3. Integración WhatsApp
**Ubicación:** `lib/whatsapp.ts`

Genera mensaje con:
- ID del pedido
- Lista de discos
- Precios en 3 divisas
- Link de WhatsApp con mensaje pre-llenado

```
URL: https://wa.me/5491123456789?text=[MENSAJE_ENCODEADO]
```

### 4. Importador CSV
**Ubicación:** `components/admin/BulkImporter.tsx`

Pasos:
1. Lee archivo CSV
2. Parsea líneas
3. Valida columnas (requiere "codigo")
4. Genera vista previa
5. Actualiza registros en BD

**Seguridad:**
- Solo actualiza campos especificados
- No borra datos existentes
- Valida tipos de datos

### 5. Gestor de Tasas
**Ubicación:** `components/admin/CurrencyManager.tsx`

- Obtiene tasas actuales
- Permite editar valores
- Guarda en BD
- Invalida cache

---

## Flujos de Usuario

### Flujo 1: Cliente compra un vinilo

```
1. Cliente ve catálogo
   ↓
2. Selecciona divisa (ARS/USD/USDT)
   ↓
3. Filtra por género/calidad
   ↓
4. Hace clic "Agregar al Carrito"
   ↓
5. Ve carrito
   ↓
6. Haz clic "Confirmar por WhatsApp"
   ↓
7. Se abre WhatsApp con mensaje pre-llenado
   ↓
8. Admin ve mensaje y confirma disponibilidad
```

### Flujo 2: Admin carga un vinilo

```
Opción A: Individual
1. Admin → Panel → "Nuevo Vinilo"
2. Completa formulario
3. Haz clic "Agregar Vinilo"
4. Aparece en catálogo

Opción B: Masivo
1. Admin → Panel → "Importar CSV"
2. Prepara archivo CSV
3. Sube archivo
4. Verifica vista previa
5. Haz clic "Importar"
6. Se actualizan registros
```

### Flujo 3: Admin actualiza precios

```
1. Dólar blue sube a 1250
2. Admin → Panel → "Tasas de Cambio"
3. Edita "Dólar Blue" a 1250
4. Haz clic "Guardar"
5. Sistema invalida cache
6. Clientes ven precios nuevos al recargar
```

---

## Seguridad

### Row Level Security (RLS)

Todas las tablas tienen políticas RLS:

- **inventario_vinilos**: Lectura pública, solo admin edita
- **configuracion_divisas**: Lectura pública, solo admin edita
- **clientes**: Solo clientes leen sus datos
- **pedidos**: Solo cliente ve sus pedidos
- **detalles_pedido**: Solo acceso a pedidos propios

### Validaciones

- **Frontend:** Validación básica en formularios
- **Backend:** Constraints SQL (UNIQUE, CHECK, FK)
- **Auth:** Requiere usuario admin para editar

---

## Performance

### Optimizaciones

1. **Indexación:**
   - Índices en `genero`, `calidad`, `codigo` (búsquedas rápidas)
   - Índices en `cliente_id`, `numero_pedido` (queries)

2. **Caching:**
   - Tasas de cambio cacheadas 1 minuto
   - Reduce queries redundantes

3. **Lazy Loading:**
   - Imágenes se cargan bajo demanda
   - Componentes se renderan según necesidad

4. **Query Optimization:**
   - Usa `maybeSingle()` para single rows
   - `select()` específico (no *)
   - Índices en columnas frecuentes

---

## Variables de Entorno

```
VITE_SUPABASE_URL=https://[proyecto].supabase.co
VITE_SUPABASE_ANON_KEY=[clave anónima de Supabase]
```

Estas se cargan automáticamente desde Supabase.

---

## Extensiones Futuras

Ideas para mejorar:

1. **Edición de vinilos:**
   - Permitir admin editar registros existentes
   - Historial de cambios

2. **Gestión de órdenes:**
   - Dashboard de pedidos
   - Estados de envío
   - Emails de confirmación

3. **Autenticación:**
   - Login para admin
   - Roles granulares
   - 2FA

4. **Reportes:**
   - Ventas por mes
   - Vinilos más populares
   - Análisis de género

5. **Integraciones:**
   - Sincronización con Instagram
   - MercadoLibre API
   - Pagaré/Stripe para pagos

---

## Notas Técnicas

### Por qué Supabase y no MySQL local?

- ✅ Acceso en la nube
- ✅ Escalabilidad automática
- ✅ Backups automáticos
- ✅ Seguridad gestionada
- ✅ API REST integrada
- ✅ RLS nativo
- ❌ Más costoso (pero gratis tier disponible)

### Por qué Tailwind CSS?

- ✅ Rápido de desarrollar
- ✅ Responsive por defecto
- ✅ Temas personalizables
- ✅ Bundle pequeño
- ✅ Sin overhead de componentes

### Por qué Vite?

- ✅ Build 10x más rápido que Webpack
- ✅ HMR instantáneo
- ✅ Menos configuración
- ✅ Mejor DX (developer experience)

---

## Troubleshooting Técnico

**Error: "Missing Supabase env vars"**
- Verifica que `.env` tenga las variables correctas

**Error: "RLS policy violation"**
- Supabase está bloqueando acceso por seguridad
- Verifica que el usuario tenga permisos

**Error: "Cannot read property 'map' of undefined"**
- La query devolvió null, usa `?.`

**Imágenes no cargan:**
- Verifica que URL sea HTTPS
- Verifica CORS del servidor de imágenes

---

**Versión:** 1.0
**Última actualización:** 2026-02-28
**Mantenedor:** Desarrollo
