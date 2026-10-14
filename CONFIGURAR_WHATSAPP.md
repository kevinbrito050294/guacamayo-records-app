# ⚙️ Configurar WhatsApp para GuacamayoRecords

Cuando un cliente compra, la plataforma lo redirige a WhatsApp con un mensaje pre-llenado. Aquí te explicamos cómo configurarlo.

---

## 🔧 Paso 1: Encontrar tu Número de WhatsApp

### Opción A: Si tienes WhatsApp Business
1. Abre WhatsApp Business
2. Ve a Configuración → Acerca de
3. Copia tu número (ej: 549-1234-5678)

### Opción B: Si tienes WhatsApp Normal
1. Abre WhatsApp
2. Ve a Configuración → Acerca de
3. Copia tu número (con código de país)

**Formato correcto:**
- ✅ 5491123456789 (sin espacios)
- ✅ +5491123456789 (con + adelante)
- ❌ 011-1234-5678 (formato antiguo)
- ❌ 9-1234-5678 (sin código de país)

---

## 🔗 Paso 2: Actualizar el Número en la Plataforma

### Ubicación del Número en el Código

Archivo: `src/components/Cart.tsx`. El número es la constante `telTienda`, que se arma
justo antes de abrir la conversación.

> No anotes el número de línea: se corre con cada cambio en el archivo. Buscá el nombre.

### Cambiar el Número

1. Abre el archivo `src/components/Cart.tsx`
2. Buscá la constante `telTienda`
3. Reemplazá su valor por tu número:

**Antes:**
```typescript
const telTienda = "5491123456789";
```

**Después:**
```typescript
const telTienda = "5491198765432";  // Tu número real
```

4. Guarda el archivo
5. Reconstruye: `npm run build`

---

## 📱 Paso 3: Verificar que Funcione

### Probar en Desarrollo
1. Abre el catálogo: `npm run dev`
2. Agrega un vinilo al carrito
3. Haz clic en "Confirmar por WhatsApp"
4. Verifica que:
   - ✅ Se abra WhatsApp
   - ✅ Tu número sea el correcto
   - ✅ El mensaje tenga todos los datos

### Probar en Producción
1. Abre tu sitio en producción
2. Repite los pasos de arriba
3. ¡Verifica que todo funcione!

---

## 💬 Estructura del Mensaje

El cliente verá algo así (es la plantilla real de `mensajeWA` en `Cart.tsx`):

```
¡Hola Guacamayo Records! 🦜

📦 *PEDIDO: #GR-1234*
👤 Cliente: Ana
🎸 Discos:
- 1x *Abbey Road*
- 2x *Kind of Blue*
🎟️ Cupón: VERANO10 (-USD 5.50)
💰 *TOTAL A PAGAR: $71,625*
_(Ref: USD 49.50)_

¿Me pasan los datos para la transferencia?
```

Tres cosas del formato real que no se ven en este ejemplo: el cupón y su descuento solo
aparecen si hubo cupón; el total va primero en **ARS** (es lo que el cliente va a pagar)
con la referencia en USD debajo; y el pedido ya quedó registrado en la base antes de
mandarse el mensaje, así que el número de orden es real y se puede buscar en el panel.

---

## 🎯 Mejores Prácticas

### ✅ Haz Esto
- Responde rápido los mensajes (máximo 1 hora)
- Confirma disponibilidad inmediatamente
- Envía detalles de pago claros
- Mantén el número actualizado

### ❌ Evita Esto
- Dejar clientes sin respuesta
- Dar información incorrecta
- Cambiar precios sin aviso
- Usar números compartidos

---

## 🔐 Consideraciones de Privacidad

⚠️ **Importante:**
- El número de WhatsApp es **público** (visible en el código)
- Cualquiera que visite el sitio verá en el inspector que tu número está en `Cart.tsx`
  (constante `telTienda`)
- Si no quieres que sea evidente, podés:
  1. Leerlo de una variable de entorno (`VITE_*`, y asumiendo que también es pública:
     las `VITE_` se compilan en el bundle, así que solo te sirve si no querés el número
     *en el repositorio*, no si querés ocultarlo del visitante)
  2. Obtenerlo desde la BD, o pedirlo por una ruta del server
  3. Usar un servicio de enmascaramiento

**Por ahora (v1.0):** El número está en el código. Es suficiente.

---

## 🚀 Casos Avanzados

### Múltiples Números de WhatsApp
Si tienes 2 números (personal y business):

> Ojo: el número se elige al confirmar el pedido, en `Cart.tsx`. Si lo querés rotar,
> definí la lista **antes** del `window.open` y elegí de ahí; si lo dejás para después
> del pedido, el cliente ya mandó el mensaje al primero.

```typescript
// Opción 1: Elegir uno
const telTienda = "5491123456789";  // Tu principal

// Opción 2: Balancear carga (alternancia)
const numeros = ["5491123456789", "5491198765432"];
const telTienda = numeros[Math.floor(Math.random() * numeros.length)];

// Opción 3: Por horario
const hora = new Date().getHours();
const telTienda = hora > 20 ? "5491198765432" : "5491123456789";
```

### Agregar Más Info al Mensaje
El mensaje se arma **inline en `src/components/Cart.tsx`**, en la constante `mensajeWA`
(justo arriba del `window.open` con el link de `wa.me`). No hay un módulo aparte: si
querés cambiar el texto, se edita esa plantilla.

```typescript
const mensajeWA = `¡Hola Guacamayo Records! 🦜\n\n` +
  `📦 *PEDIDO: #${numeroOrden}*\n` +
  // ... tus líneas
  `¿Me pasan los datos para la transferencia?`;
```

Un detalle que conviene no romper: el total que va en el mensaje es **el que devolvió el
server** (`respuesta.total_pago` del `POST /api/pedidos`), no el que estaba en pantalla.
Es el número que el backend calculó contra la base, y es el que hay que confirmar.

---

## 🆘 Troubleshooting

### "No se abre WhatsApp"
**Causa:** Navegador bloqueó la apertura de WhatsApp
**Solución:** Permite pop-ups en tu navegador
**Ojo:** si el pedido tampoco se guardó, el problema no es el pop-up: mirá la respuesta
del `POST /api/pedidos` en la consola. El mensaje solo se arma si el server devolvió el
pedido.

### "El número no funciona"
**Causa:** Formato incorrecto
**Solución:** Verifica que sea:
- Sin guiones: ✅ 5491234567890
- Sin espacios: ✅ 5491234567890
- Con código país: ✅ 549...

### "El mensaje no tiene los datos"
**Causa:** Plantilla desactualizada o pedido incompleto
**Solución:**
1. Revisá la plantilla `mensajeWA` en `src/components/Cart.tsx`
2. Mirá la respuesta del `POST /api/pedidos` en la consola
3. Si sigue faltando, reportalo al desarrollo con el texto que recibiste

---

## 📞 Test Rápido

¿Quieres probar sin datos reales?

1. Ve a `DATOS_EJEMPLO.csv`
2. Importa los 10 vinilos de ejemplo
3. Agrega algunos al carrito
4. Comprueba que WhatsApp funciona
5. ¡Perfecto! Ya estás listo

---

## ✨ Tips Pro

1. **Automatización:** Usa un bot de WhatsApp para auto-responder disponibilidad
2. **CRM:** Guarda un registro de clientes en una hoja de cálculo
3. **Plantillas:** Prepara respuestas estándar para ahorrar tiempo
4. **Horarios:** Establece horarios de atención claros
5. **Confirmación:** Pídele al cliente que confirme su dirección

---

## Resumen Rápido

| Paso | Acción | Tiempo |
|------|--------|--------|
| 1 | Obtén tu número WhatsApp | 2 min |
| 2 | Ponelo en `telTienda`, dentro de `src/components/Cart.tsx` | 1 min |
| 3 | Reconstruye el proyecto (`npm run build`) | 10 seg |
| 4 | Prueba con un carrito de ejemplo | 2 min |
| 5 | ¡Listo para vender! | - |

---

**¿Necesitas ayuda?** Consulta el archivo `MANUAL_OPERACIONES.md` o contacta al desarrollo.

---

**Versión:** 1.1 | 2026-09-29
