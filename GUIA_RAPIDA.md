# GuacamayoRecords - Guía Rápida de Inicio

## ¡Bienvenido a GuacamayoRecords!

Tu plataforma de venta de vinilos ya está lista. Aquí te mostramos cómo empezar en 5 minutos.

---

## 📱 Acceso a la Plataforma

### Para Clientes (Catálogo)
- Ve a la página principal
- Verás todos los vinilos disponibles
- Usa los filtros para buscar por género o calidad
- Selecciona tu divisa (ARS, USD o USDT)
- Agrega discos al carrito
- ¡Confirma tu compra por WhatsApp!

### Para Administradores (Gestión)
- Haz clic en el botón **"⚙️ Admin"** en la esquina inferior derecha
- Accede a 4 herramientas de gestión

---

## ⚙️ Panel de Administración - Las 4 Herramientas

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
2. Ingresa Dólar Blue: 1200 (o el actual)
3. Haz clic en "Guardar"
4. ¡Listo! Todos los precios se actualizan
```

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
| Géneros | 13 (Rock, Jazz, etc.) |
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
   - Cambia el número de WhatsApp en el checkout
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

**Versión:** 1.0
**Plataforma:** GuacamayoRecords
**Tecnología:** React + Supabase + Tailwind CSS
