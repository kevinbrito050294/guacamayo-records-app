# Manual de Operaciones - GuacamayoRecords

## Índice
1. [Introducción](#introducción)
2. [Panel de Administración](#panel-de-administración)
3. [Gestión de Vinilos](#gestión-de-vinilos)
4. [Códigos de Calidad](#códigos-de-calidad)
5. [Gestión de Precios](#gestión-de-precios)
6. [Importación Masiva](#importación-masiva)
7. [Solución de Problemas](#solución-de-problemas)

---

## Introducción

GuacamayoRecords es una plataforma de e-commerce para la venta de vinilos. Esta guía está dirigida a colaboradores que necesitan gestionar el inventario y mantener la tienda funcionando correctamente.

### Acceder al Panel de Admin

1. Ve a la página principal del catálogo
2. Busca el botón **"⚙️ Admin"** en la esquina inferior derecha
3. Haz clic para acceder al panel

---

## Panel de Administración

El panel tiene 4 secciones principales:

### 1. Nuevo Vinilo
Agrega discos individuales a la base de datos.

**Campos requeridos:**
- **Código (SKU)**: Identificador único (ej: LP001)
- **Artista**: Nombre del artista/banda
- **Título**: Nombre del álbum
- **Calidad**: Estado del vinilo (NM, EX, VG+, VG, G)

**Campos opcionales:**
- Género
- Precio (USD)
- Stock actual
- URL de imagen
- Descripción

### 2. Importar CSV
Carga múltiples vinilos a la vez desde un archivo.

**Formato requerido del CSV:**
```
codigo,imagen_url,stock_actual
LP001,https://ejemplo.com/imagen1.jpg,10
LP002,https://ejemplo.com/imagen2.jpg,5
LP003,https://ejemplo.com/imagen3.jpg,0
```

**Columnas obligatorias:**
- `codigo`: El SKU único del vinilo

**Columnas opcionales:**
- `imagen_url`: URL de la imagen del álbum
- `stock_actual`: Cantidad disponible

**Proceso:**
1. Prepara el archivo CSV con tus datos
2. Haz clic en "Seleccionar archivo" o arrastra el archivo
3. Verifica la vista previa
4. Haz clic en "Importar X registros"

⚠️ **Importante**: Solo actualiza los campos que specifies. No borra datos existentes.

### 3. Tasas de Cambio
Actualiza las divisas cuando cambia el precio del dólar.

**¿Cómo funciona?**
- Todos los precios se guardan en USD en la base de datos
- Las tasas de cambio se aplican para mostrar precios en ARS y USDT
- Cuando cambia el dólar, actualiza las tasas aquí
- ¡Los precios se actualizan automáticamente en todo el sitio!

**Pasos para actualizar:**
1. Ve a la pestaña "Tasas de Cambio"
2. Ingresa la nueva tasa del Dólar Blue (ejemplo: 1250)
3. Ingresa la nueva tasa de USDT si es necesario
4. Haz clic en "Guardar"
5. Verifica que se actualice correctamente

### 4. Manual
Esta es la guía que estás leyendo. Aparece en el panel para referencia rápida.

---

## Gestión de Vinilos

### Agregar un vinilo nuevo (Opción 1: Individual)

1. Haz clic en la pestaña **"Nuevo Vinilo"**
2. Completa el formulario:
   - **Código**: Usa un formato consistente (LP001, LP002, etc.)
   - **Artista**: Nombre completo
   - **Título**: Nombre exacto del álbum
   - **Género**: Selecciona de la lista o personaliza
   - **Calidad**: Evalúa el estado del disco
   - **Precio (USD)**: El precio base en dólares
   - **Stock**: Cantidad disponible
   - **Imagen**: URL de una foto del álbum
3. Haz clic en **"Agregar Vinilo"**
4. Si todo está correcto, verás un mensaje de éxito

### Agregar múltiples vinilos (Opción 2: CSV)

**Cuando usar:**
- Tienes más de 5 vinilos para cargar
- Necesitas actualizar imágenes y stock de muchos discos

**Paso a paso:**

1. **Preparar el CSV en Excel:**
   - Abre un archivo Excel en blanco
   - Crea 3 columnas: `codigo`, `imagen_url`, `stock_actual`
   - Llena tus datos
   - Guarda como CSV (no XLSX)

2. **Importar en la plataforma:**
   - Ve a "Importar CSV"
   - Sube tu archivo
   - Verifica la vista previa (primeras 5 filas)
   - Haz clic en "Importar"

3. **Verificar:**
   - Ve al catálogo
   - Busca tus nuevos vinilos
   - Confirma que los datos sean correctos

---

## Códigos de Calidad

Estos códigos estandarizados describen el estado del vinilo.

| Código | Nombre         | Descripción |
|--------|----------------|-------------|
| **NM** | Mint Condition | Prácticamente sin usar, como nuevo de fábrica |
| **EX** | Excellent      | Excelente estado, mínimo desgaste |
| **VG+** | Very Good Plus | Muy buen estado, poco desgaste pero funciona perfecto |
| **VG** | Very Good      | Buen estado, obviamente usado pero sin defectos graves |
| **G** | Good           | Estado aceptable, mucho desgaste pero funcional |

### Cómo evaluar un vinilo:
1. **Escucha y mira:** ¿Hace ruido? ¿Hay rayos visibles?
2. **Portada:** ¿El arte está en buen estado?
3. **Disco:** ¿El vinilo está limpio? ¿Tiene grietas o rayos profundos?
4. **General:** ¿Funciona bien o tiene problemas?

---

## Gestión de Precios

### El Dólar Blue y cómo funciona

En Argentina, los precios deben ajustarse constantemente según la tasa de cambio.

**Sistema automático:**
1. Los precios se guardan en USD (ejemplo: $25.00 USD)
2. Se convierten automáticamente a ARS usando la tasa del Dólar Blue
3. También se convierten a USDT (criptomonedas) si es necesario

**Ejemplo práctico:**
- Un vinilo cuesta: **$25 USD** (precio base)
- Dólar Blue actual: 1200 ARS
- Precio en ARS: 25 × 1200 = **$30,000 ARS**
- Si sube a 1250 ARS: 25 × 1250 = **$31,250 ARS** (automático!)

### Actualizar precios cuando sube el dólar

**Opción rápida (recomendada):**
1. Ve a "Tasas de Cambio"
2. Actualiza solo el "Dólar Blue"
3. Haz clic en "Guardar"
4. ¡Todos los precios se actualizan automáticamente!

**Opción manual (solo si necesitas cambiar precios específicos):**
1. Ve a "Nuevo Vinilo"
2. Si el vinilo ya existe en la base de datos, contacta al desarrollador
3. (En futuras versiones habrá edición de vinilos)

---

## Importación Masiva

### Caso de uso: Tienes 100 vinilos y necesitas cargar las imágenes

**Paso 1: Preparar datos en Excel**

Abre Excel y crea una tabla así:

| codigo | imagen_url | stock_actual |
|--------|-----------|---|
| LP001 | https://pexels.com/albums1.jpg | 5 |
| LP002 | https://pexels.com/albums2.jpg | 3 |
| LP003 | https://pexels.com/albums3.jpg | 0 |

**Paso 2: Guardar como CSV**
- Archivo > Guardar como
- Formato: CSV UTF-8 (.csv)
- Nombre: `vinilos.csv`

**Paso 3: Importar en la plataforma**
- Panel Admin > Importar CSV
- Sube `vinilos.csv`
- Verifica los datos mostrados
- Haz clic en "Importar"

**Paso 4: Verificar**
- Ve al catálogo
- Busca algunos vinilos
- Confirma que las imágenes y stock aparezcan correctamente

---

## Solución de Problemas

### "El código ya existe"
**Problema:** Intentaste agregar un vinilo con un código que ya existe.

**Solución:**
- Usa un código diferente
- O, si quieres actualizar uno existente, usa el CSV

### "Faltan campos requeridos"
**Problema:** No completaste un campo obligatorio.

**Campos obligatorios:**
- Código
- Artista
- Título
- Calidad

**Solución:** Completa todos estos campos antes de guardar.

### "El CSV no se importa"
**Problema:** El archivo no tiene el formato correcto.

**Verificar:**
- ¿El archivo es CSV? (no XLSX)
- ¿Tiene la columna "codigo"?
- ¿No hay filas vacías?
- ¿Está codificado en UTF-8?

### "Los precios no se actualizaron"
**Problema:** Cambiaste la tasa pero los precios siguen igual.

**Solución:**
- Recarga la página (F5)
- Los precios se cachean por 1 minuto

### "No veo mi imagen"
**Problema:** Cargaste una URL pero la imagen no aparece.

**Posibles causas:**
- La URL no es válida
- El servidor de la imagen no responde
- El formato de la URL es incorrecto

**Solución:**
- Verifica que la URL sea correcta
- Usa un hosting confiable (Pexels, Imgur, etc.)
- Prueba con `https://` en lugar de `http://`

---

## Mejores Prácticas

1. **Códigos consistentes:** Usa LP001, LP002, etc. (facilita búsquedas)
2. **Descripciones detalladas:** Añade info sobre el año, edición, etc.
3. **Imágenes claras:** Usa fotos de buena calidad del álbum
4. **Verificar datos:** Antes de importar masivamente, verifica 2-3 registros
5. **Backup:** Mantén un backup de tus CSVs por si acaso
6. **Actualizar tasas regularmente:** No dejes pasar más de 1 día sin revisar

---

## Contacto y Soporte

Si encuentras errores o necesitas ayuda:
- Contacta al desarrollador
- Describe qué intentabas hacer
- Incluye mensajes de error si los hay

---

**Versión:** 1.0
**Última actualización:** 2026-02-28
**Sistema:** GuacamayoRecords v1.0
