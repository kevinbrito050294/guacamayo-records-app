# Manual de Operaciones - GuacamayoRecords

## Índice
1. [Introducción](#introducción)
2. [Panel de Administración](#panel-de-administración)
3. [Gestión de Vinilos](#gestión-de-vinilos)
4. [Códigos de Calidad](#códigos-de-calidad)
5. [Gestión de Precios](#gestión-de-precios)
6. [Importación Masiva](#importación-masiva)
7. [Ledger de Plumas](#ledger-de-plumas)
8. [Recuperación de cuenta](#recuperación-de-cuenta)
9. [Solución de Problemas](#solución-de-problemas)

---

## Introducción

GuacamayoRecords es una plataforma de e-commerce para la venta de vinilos. Esta guía está dirigida a colaboradores que necesitan gestionar el inventario y mantener la tienda funcionando correctamente.

### Acceder al Panel de Admin

1. Ve a la página principal del catálogo
2. Haz clic en el engranaje **"⚙️"** de la barra superior
3. Iniciá sesión con tu **email y contraseña** de administrador
4. El panel se abre solo y dura 12 horas (se corta antes si pasan 15 minutos sin actividad)

**¿Olvidaste la contraseña o nunca te dieron un usuario?**

No hay una contraseña única del sistema: cada persona del equipo tiene su propio usuario en la base. Para crear uno nuevo o resetear la contraseña de alguien:

```bash
$env:ADMIN_PASSWORD='clave-nueva'; node scripts/crear-admin.mjs --email admin@guacamayorecords.com --nombre "Guacamayo"
```

Necesitás la base de datos conectada (`MYSQL_URL` en el `.env`) y las migraciones
aplicadas. Para el login del panel alcanza con `db/migrations/2026-09-26_auth.sql`, pero
lo normal es correrlas todas: `npm run migrar` (el checkout y los cupones dependen de las
migraciones posteriores). Si el email ya existe, el comando cambia la contraseña.

> Si arrancás de una base **vacía**, `npm run migrar` se frena en la primera migración
> porque hace `ALTER TABLE pedidos` sobre una tabla que todavía no existe. El orden
> limpio es `node scripts/migrar.mjs --archivo 2026-09-29_pedidos_cupones.sql` y después
> `npm run migrar`. Ver [docs/COUPONS.md](docs/COUPONS.md).

---

## Panel de Administración

El panel tiene 8 pestañas: **Inventario**, **Pedidos**, **Plumas**, **Cupones**, **Nuevo**,
**Importar**, **Tasas** y **Manual**. Esta guía explica las que se usan todos los días
(cargar vinilos, importar CSV y actualizar tasas); los pedidos y los cupones tienen su
propia documentación:

- **Pedidos**: se confirman, cancelan y finalizan desde la pestaña Pedidos. Cancelar
  repone el stock y devuelve el uso del cupón. Ver [ARQUITECTURA_TECNICA.md](ARQUITECTURA_TECNICA.md).
- **Cupones**: se crean y editan desde la pestaña Cupones. Ver [docs/COUPONS.md](docs/COUPONS.md).
- **Plumas**: consulta movimientos por usuario/pedido y registra ajustes auditados. Ver la sección siguiente.

## Ledger de Plumas

La pestaña **Plumas** es una vista de auditoría, no una caja para editar saldos.
Filtrá por `usuario_id` o `pedido_id` y pulsá **Buscar**. Si el contrato está
publicado, verás tipo, unidades, motivo y fecha de caducidad. Un `404/405` indica
que el backend todavía no tiene el ledger: no significa que el usuario tenga
cero Plumas.

Para un ajuste manual:

1. Ingresá el `usuario_id` y, si corresponde, el `pedido_id`.
2. Usá unidades enteras con signo: positivo acredita y negativo debita.
3. Escribí un motivo concreto de 10 a 500 caracteres.
4. Pulsá **Registrar movimiento** y verificá que aparezca en el ledger.

El límite operativo es de `100000` Plumas por ajuste. No ingreses un saldo final,
ni importes USD, ni intentes corregir dos veces la misma operación. El servidor
usa una clave idempotente y debe dejar un solo movimiento si la petición se
reintenta. Las Plumas ganadas equivalen al 5% del subtotal neto, se acreditan al
finalizar el pedido, pueden cubrir como máximo el 50% del subtotal y caducan a
los 12 meses. La cancelación revierte la acreditación o el consumo una sola vez.
Los invitados no participan.

Contrato detallado: [docs/PLUMAS.md](docs/PLUMAS.md).

## Recuperación de cuenta

La recuperación se solicita desde la pantalla de acceso. El sistema muestra el mismo
mensaje aunque el email no exista, para no revelar qué cuentas están registradas. Si
corresponde, Resend envía un enlace con un token de un solo uso que vence a los **30
minutos**. El enlace deja de funcionar inmediatamente después de cambiar la contraseña.

La configuración corresponde al responsable técnico: `RESEND_API_KEY` se guarda como
secreto privado en Railway, `MAIL_FROM` debe ser una dirección de un dominio verificado en
Resend y `PUBLIC_APP_URL` debe ser la URL HTTPS pública de la tienda. No cambiar estas
variables en el navegador ni compartir la API key. Ver el procedimiento y la lista de
pruebas en [docs/ACCOUNT_RECOVERY.md](docs/ACCOUNT_RECOVERY.md).

Si una persona no recibe el correo, primero verificar spam, el estado del dominio y los
eventos de envío en Resend. No confirmar desde soporte si el email tiene cuenta; reenviar
la solicitud usando el mismo mensaje genérico.

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
- Binance USDTARS sincroniza automáticamente las tasas dos veces por día
- Por decisión operativa, el valor de Binance USDTARS se usa como referencia para
  `DOLAR_BLUE` y `USDT`, por lo que ambas quedan con el mismo valor
- ¡Los precios se actualizan automáticamente en todo el sitio!

**Sincronización automática:**
1. El servicio consulta el par Binance USDTARS en los dos horarios diarios configurados
2. Valida que la respuesta sea un número finito y positivo
3. Guarda el mismo valor en `DOLAR_BLUE` y `USDT`
4. Si Binance no responde o el valor es inválido, conserva el último valor válido y no
   sobrescribe las tasas

Los horarios y la zona horaria se pueden configurar en el servidor con `BINANCE_SYNC_HOURS`
y `BINANCE_SYNC_TIMEZONE`, si esas variables existen. Si no están definidas, rige la
configuración predeterminada del servicio.

**Sincronización manual:**
1. Ve a la pestaña "Tasas de Cambio"
2. Haz clic en **Sincronizar Binance**
3. Espera el mensaje de resultado y confirma que las dos tasas queden iguales

**Edición manual:**
1. Ve a la pestaña "Tasas de Cambio"
2. Edita el valor de `DOLAR_BLUE` o `USDT` según la corrección operativa que necesites
3. Haz clic en "Guardar"
4. Verifica que se actualice correctamente

La edición manual permite corregir una tasa sin esperar la próxima ejecución automática.
Si el valor de Binance es válido, la sincronización siguiente volverá a aplicar el mismo
valor en ambas tasas.

**Cómo comprobar la última sincronización:**
1. Abre **Tasas de Cambio**
2. Revisa la fecha y hora que aparece junto a `DOLAR_BLUE` y `USDT`
3. Después de una sincronización automática exitosa, ambas marcas deben corresponder a la
   ejecución y ambas tasas deben mostrar el mismo valor
4. Después de pulsar el botón manual, la marca debe cambiar sin esperar al horario diario

Si la marca no cambia, revisá el mensaje del botón y el registro operativo del servicio:
puede tratarse de un fallo de conexión, una respuesta inválida de Binance o una ejecución
que todavía no llegó a su horario.

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

**Opción manual (solo si necesitas cambiar el precio de un disco puntual):**
1. Ve a la pestaña **Inventario**
2. Buscá el vinilo y abrí el ícono del lápiz
3. Cambiá el precio (u otro campo) y guardá

Ojo: el precio se guarda **siempre en USD**. Lo que cambia con el dólar es la tasa
(arriba), no el precio del disco.

> La tasa se cachea 1 minuto en el navegador. Si guardás y el catálogo sigue mostrando
> el precio viejo, esperá un minuto o recargá con Ctrl+Shift+R.

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

### "No puedo entrar al panel"
**Problema:** El login pide email y contraseña y no los tenés a mano.
**Solución:**
- Verificá que estés escribiendo el email con el que te crearon el usuario
- Si la contraseña falla 5 veces, la cuenta queda bloqueada 15 minutos: esperá y probá de nuevo
- Si seguís sin entrar, hay que resetear la contraseña desde la base (ver "Acceder al Panel de Admin")

### "El panel dice que ya está abierto en otro dispositivo"
**Problema:** La sesión es única: no se pueden usar dos sesiones del mismo admin a la vez.
**Solución:**
- Cerrá la otra pestaña o el otro equipo que tenga el panel abierto
- Si esa sesión ya no existe más, esperá 1 minuto y volvé a intentar (la actividad se renueva cada 15 segundos)

### "La sesión se cerró sola"
**Problema:** El panel se desconectó sin que hicieras nada.
**Solución:**
- Es normal a los 15 minutos sin actividad (mouse, teclado, scroll o touch)
- Volvé a iniciar sesión con tu email y contraseña

### "El código ya existe"
**Problema:** Intentaste agregar un vinilo con un código que ya existe.

**Solución:**
- Usá un código diferente
- O editá el vinilo que ya está: pestaña **Inventario** → ícono del lápiz
- O actualizá muchos a la vez con el CSV

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
- Esperá 1 minuto (la tasa se cachea) o recargá con Ctrl+Shift+R
- Fijate que hayas guardado: el cartel tiene que decir que la tasa quedó

### "La sincronización de Binance no actualizó las tasas"
**Problema:** La sincronización automática o el botón manual no cambió `DOLAR_BLUE` y
`USDT`.

**Solución:**
- Revisá el mensaje de resultado y la fecha/hora de `ultima_actualizacion` en **Tasas de Cambio**
- Confirmá que el valor recibido sea numérico y positivo; respuestas inválidas se rechazan
- Si Binance está caído o no responde, se conserva el último valor válido por seguridad
- Usá la edición manual si necesitás corregir el precio de inmediato
- Si el problema persiste, revisá `BINANCE_SYNC_HOURS`, `BINANCE_SYNC_TIMEZONE` si están
  definidas, y el registro del servicio

### "El checkout no guarda el pedido" / "El panel no muestra los cupones"
**Problema:** Faltó correr una migración. El server ya escribe `cupon_id`,
`cupon_codigo` y `descuento_aplicado` en `pedidos`, y pide `creado_en` en `cupones`.

**Solución:**
```bash
npm run migrar
node scripts/migrar.mjs --estado   # applied / pending
```
- En Railway: shell del servicio MySQL, base `railway`
- Si arrancás de una base vacía, primero
  `node scripts/migrar.mjs --archivo 2026-09-29_pedidos_cupones.sql` y después `npm run migrar`
- Detalle: [docs/COUPONS.md](docs/COUPONS.md) → "Migración y qué verificar"

### "No aparece el botón de iniciar sesión con Google"
**Problema:** Falta `VITE_GOOGLE_CLIENT_ID` en el `.env`. **No tira ningún error**: el
componente devuelve `null` y el botón simplemente no se dibuja.

**Solución:**
- Poné `VITE_GOOGLE_CLIENT_ID` con **exactamente el mismo valor** que `GOOGLE_CLIENT_ID`
  del server
- Registrá el origen JS en la consola de Google: `http://localhost:5173` en desarrollo,
  el dominio real en producción
- Recorré `npm run build` (las `VITE_*` se compilan; cambiar el `.env` solo no alcanza)
- Detalle: [README.md](README.md) → "🔐 Acceso y Cuentas"

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
7. **Un usuario por persona:** Cada colaborador entra con su propio email, así sabés quién hizo qué y podés desactivar a alguien sin romper al resto

---

## Contacto y Soporte

Si encuentras errores o necesitas ayuda:
- Contacta al desarrollador
- Describe qué intentabas hacer
- Incluye mensajes de error si los hay

---

**Versión:** 1.2
**Última actualización:** 2026-10-06
**Sistema:** GuacamayoRecords v1.0
