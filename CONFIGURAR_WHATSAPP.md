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

Archivo: `src/components/Cart.tsx`

Busca esta línea (aproximadamente línea 43):
```typescript
const numeroWhatsApp = '5491123456789';
```

### Cambiar el Número

1. Abre el archivo `src/components/Cart.tsx`
2. Busca la línea con `numeroWhatsApp`
3. Reemplaza con tu número:

**Antes:**
```typescript
const numeroWhatsApp = '5491123456789';
```

**Después:**
```typescript
const numeroWhatsApp = '5491198765432';  // Tu número real
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

El cliente verá algo así:

```
Hola! Quisiera confirmar esta orden:

📦 Pedido #GR1709148900123

• The Beatles - Abbey Road (1x) - $25.00 USD
• Miles Davis - Kind of Blue (1x) - $30.00 USD

💰 Total:
• USD: $55.00
• ARS: $65,175.00
• USDT: 55.0000

Por favor, confirmar disponibilidad y forma de pago.

¡Gracias!
```

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
- Si no quieres que sea evidente, puedes:
  1. Guardar el número en una variable de entorno
  2. Obtenerlo desde la BD
  3. Usar un servicio de enmascaramiento

**Por ahora (v1.0):** El número está en el código. Es suficiente.

---

## 🚀 Casos Avanzados

### Múltiples Números de WhatsApp
Si tienes 2 números (personal y business):

```typescript
// Opción 1: Elegir uno
const numeroWhatsApp = '5491123456789';  // Tu principal

// Opción 2: Balancear carga (alternancia)
const numeros = ['5491123456789', '5491198765432'];
const numeroWhatsApp = numeros[Math.floor(Math.random() * numeros.length)];

// Opción 3: Por horario
const hora = new Date().getHours();
const numeroWhatsApp = hora > 20 ? '5491198765432' : '5491123456789';
```

### Agregar Más Info al Mensaje
En `lib/whatsapp.ts`, puedes personalizar el mensaje:

```typescript
const mensaje = `Hola! Tengo una pregunta sobre este orden...
...
Por favor contacta a: [tu nombre]
Web: [tu sitio]
Email: [tu email]`;
```

---

## 🆘 Troubleshooting

### "No se abre WhatsApp"
**Causa:** Navegador bloqueó la apertura de WhatsApp
**Solución:** Permite pop-ups en tu navegador

### "El número no funciona"
**Causa:** Formato incorrecto
**Solución:** Verifica que sea:
- Sin guiones: ✅ 5491234567890
- Sin espacios: ✅ 5491234567890
- Con código país: ✅ 549...

### "El mensaje no tiene los datos"
**Causa:** Error en la función de generación
**Solución:**
1. Abre consola (F12)
2. Copia el error
3. Reporta al desarrollo

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
| 2 | Actualiza `src/components/Cart.tsx` | 1 min |
| 3 | Reconstruye el proyecto | 10 seg |
| 4 | Prueba con un carrito de ejemplo | 2 min |
| 5 | ¡Listo para vender! | - |

---

**¿Necesitas ayuda?** Consulta el archivo `MANUAL_OPERACIONES.md` o contacta al desarrollo.

---

**Versión:** 1.0 | 2026-02-28
