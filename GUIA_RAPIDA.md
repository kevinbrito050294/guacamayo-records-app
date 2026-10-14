# GuacamayoRecords - Guía Rápida de Inicio

## ¡Bienvenido a GuacamayoRecords!

Tu plataforma de venta de vinilos ya está lista. Aquí te mostramos cómo empezar en 5 minutos.

### Con qué está hecha

| Parte | Tecnología |
|---|---|
| Lo que ve el cliente | React 18 + TypeScript, armado con Vite |
| Lo que procesa los datos | Node + Express (`server.js` y `auth.js`), con sesiones y contraseñas hasheadas |
| Dónde se guardan los datos | MariaDB / MySQL (el driver es `mysql2`) |
| Estilos | Tailwind CSS |
| Dónde vive | Railway: un solo servicio sirve la web y la API |

No hay Supabase ni PostgreSQL: el backend es propio y la base es MySQL/MariaDB. El
esquema de la base lo definen las migraciones de `db/migrations/`, que se corren con
`npm run migrar`.

---

## 📱 Acceso a la Plataforma

### Para Clientes (Catálogo)
- Ve a la página principal
- Verás todos los vinilos disponibles
- Usá la barra de búsqueda para filtrar por artista o título
- Selecciona tu divisa (ARS, USD o USDT)
- Agrega discos al carrito
- ¡Confirma tu compra por WhatsApp!

### Para Administradores (Gestión)
- Haz clic en el engranaje **"⚙️"** de la barra superior
- Iniciá sesión con tu **email y contraseña** de administrador
- Accede a las 7 secciones del panel

> ¿No entrás o te olvidaste la contraseña? El acceso se crea/resetéa con un comando de la base, no hay contraseña fija. Ver [README.md](README.md) → sección "🔐 Acceso y Cuentas".

---

## ⚙️ Panel de Administración - Las Herramientas Principales

El panel tiene 7 pestañas: **Inventario**, **Pedidos**, **Cupones**, **Nuevo**,
**Importar**, **Tasas** y **Manual**. Abajo están **Nuevo**, **Importar**, **Tasas** y
**Manual**; inventario y pedidos se usan a diario y se explican en
[MANUAL_OPERACIONES.md](MANUAL_OPERACIONES.md), y los cupones, en detalle, en
[docs/COUPONS.md](docs/COUPONS.md).

### 1️⃣ Nuevo Vinilo
Agrega un disco individual.

**Tiempo:** 2 minutos por vinilo

```
Código: LP001
Artista: The Beatles
Título: Abbey Road
Precio: 25.00 USD
Calidad: VG+
Stock: 3
```

### 2️⃣ Importar CSV
Carga múltiples vinilos a la vez.

**Tiempo:** 5 minutos por 50 vinilos

**Archivos de ejemplo:**
- Tenemos `DATOS_EJEMPLO.csv` para que pruebes

**Pasos rápidos:**
```
1. Descarga DATOS_EJEMPLO.csv
2. Modifica con tus datos
3. Sube en "Importar CSV"
4. Haz clic en "Importar"
```

### 3️⃣ Tasas de Cambio
Actualiza precios automáticamente.

**Usa esto cuando:**
- El dólar blue sube/baja
- Cambian los precios de cripto

**Pasos rápidos:**
```
1. Ve a "Tasas de Cambio"
2. Ingresa el Dólar Blue de HOY (no hay un valor fijo: lo guardás vos)
3. Haz clic en "Guardar"
4. ¡Listo! Todos los precios se actualizan
```
> Las tasas se cachean 1 minuto en el navegador: si no te cambian, recargá con
> Ctrl+Shift+R.

### 4️⃣ Manual
La guía completa para ti y tu equipo.

---

## 🎯 Flujo de Trabajo Recomendado

### Día 1: Configuración
```
1. Prepara tu lista de 100-500 vinilos
2. Crea un CSV con: codigo, imagen_url, stock_actual
3. Importa todo de una vez
4. Verifica que se haya cargado correctamente
5. Ajusta tasas de cambio
```

### Día a Día: Mantenimiento
```
1. Cada mañana: Verifica las nuevas órdenes por WhatsApp
2. Cada vez que sube el dólar: Actualiza tasa en "Tasas de Cambio"
3. Cuando llega stock: Usa CSV para actualizar cantidades
4. Mensualmente: Revisa qué vinilos no se venden
```

---

## 📊 Estadísticas de la Plataforma

| Métrica | Valor |
|---------|-------|
| Divisas soportadas | 3 (ARS, USD, USDT) |
| Códigos de calidad | 5 (NM, EX, VG+, VG, G) |
| Géneros | texto libre (se escriben al cargar) |
| Tiempo máx. para cargar 100 vinilos | 10 minutos |

---

## 💡 Tips Profesionales

### Para obtener mejores resultados:

1. **Usa códigos ordenados:** LP001, LP002, LP003...
   - Facilita búsquedas
   - Evita confusiones

2. **Imágenes de calidad:**
   - Usa URLs de Pexels, Unsplash o tu servidor
   - Prefiere fotos reales de tus discos

3. **Descripciones completas:**
   - Año de lanzamiento
   - Número de catálogo
   - Información especial (ej: "edición de bolsillo")

4. **Actualiza precios rápido:**
   - No dejes pasar más de 1 hora sin revisar el dólar
   - Usa "Tasas de Cambio" para hacerlo en 30 segundos

5. **Verifica antes de importar:**
   - Siempre revisa 2-3 registros en la vista previa
   - Asegúrate de que el CSV esté bien formado

---

## ❌ Errores Comunes (y cómo evitarlos)

### Error: "El código ya existe"
```
❌ Malo: Intentar agregar LP001 dos veces
✅ Bien: Usar LP001, LP002, LP003...
```

### Error: "CSV no se importa"
```
❌ Malo: Guardar como XLSX o TXT
✅ Bien: Guardar específicamente como CSV UTF-8
```

### Error: "La imagen no aparece"
```
❌ Malo: http://servidor-local.com/imagen.jpg
✅ Bien: https://pexels.com/photo-123456.jpg
```

### Error: "Los precios no se actualizaron"
```
❌ Malo: Cambiar tasa y no recargar página
✅ Bien: Cambiar tasa, hacer F5, esperar 2 segundos
```

---

## 🚀 Próximos Pasos

1. **Carga datos de prueba:**
   - Usa `DATOS_EJEMPLO.csv` para familiarizarte
   - Verifica que todo funcione

2. **Personaliza:**
   - Cambia la constante `telTienda` en `src/components/Cart.tsx` (el número de
     WhatsApp del checkout) y después `npm run build`
   - Ajusta las tasas de cambio

3. **Invita a tu equipo:**
   - Comparte `MANUAL_OPERACIONES.md`
   - Muéstrales cómo usar el admin

4. **Comienza a vender:**
   - Publicita el link en Instagram/TikTok
   - ¡Recibe órdenes por WhatsApp!

---

## 📞 Soporte

Si necesitas ayuda:
- Consulta `MANUAL_OPERACIONES.md` para detalles
- Para cupones, `docs/COUPONS.md` (incluye qué hacer si un cupón no aplica)
- Para acceso al panel o login con Google, `README.md` → "🔐 Acceso y Cuentas"
- La mayoría de problemas se resuelven recargando la página (F5)
- Si persiste, contacta al desarrollo

---

## 🎉 ¡Ya estás listo!

Tu e-commerce está funcionando. Ahora solo necesitas:
1. Datos (vinilos)
2. Imágenes
3. Tasas de cambio correctas
4. ¡Comenzar a vender!

**¿Listo para agregar tu primer vinilo?**
→ Ve al panel Admin y haz clic en "Nuevo Vinilo"

---

**Versión:** 1.1
**Plataforma:** GuacamayoRecords
**Tecnología:** React 18 + Express 5 + MariaDB/MySQL + Tailwind CSS
