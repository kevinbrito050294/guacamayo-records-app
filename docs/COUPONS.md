# 🎟️ Cupones de Descuento - GuacamayoRecords

Los cupones son los códigos que el cliente escribe en el carrito para que le hagan un
descuento. Los crea y los administra el admin desde el panel, y los aplica el backend
**contra la base**, nunca el navegador.

Si estás deployando algo que toca el checkout, leé primero
[la sección de la migración](#migración-y-qué-verificar): sin la migración
`2026-09-29_pedidos_cupones.sql` el pedido no se guarda.

---

## 📦 Qué es un cupón

Una fila de la tabla `cupones` (`db/migrations/2026-09-27_cupones.sql`, corregida por
`2026-09-28_cupones_schema.sql`):

| Columna | Qué es |
|---|---|
| `codigo` | Lo que escribe el cliente. Se guarda en MAYÚSCULAS, sin espacios. Máximo 50 caracteres, solo `[A-Z0-9_-]`. Es UNIQUE. |
| `tipo` | `porcentaje` o `fijo`. Es un ENUM: un tipo inventado ni entra a la base. |
| `valor` | El número del beneficio. `DECIMAL(10,2)`, así que mysql2 lo devuelve como texto (`"20.00"`). |
| `fecha_expiracion` | `DATE` o `NULL`. `NULL` = no vence. |
| `activo` | `1` sirve, `0` el panel lo muestra pero el carrito lo rechaza (la "baja lógica"). |
| `uso_maximo` | `INT` o `NULL`. `NULL` = ilimitado. |
| `usos_actuales` | Cuántas veces se gastó. Lo incrementa el backend dentro de la transacción; el panel puede editarlo o resetearlo explícitamente. |
| `creado_en` | Cuándo se creó. |

### Los dos tipos

- **`porcentaje`** → descuenta el `valor`% del subtotal. Tiene que ser mayor a 0 y
  **menor o igual a 100** (el server lo rechaza con 400 si te pasás).
- **`fijo`** → descuenta `valor` dólares del subtotal. Los precios del catálogo están
  en USD y es la moneda en la que se guarda `pedidos.total_pago`; la conversión a la
  divisa que está viendo el cliente la muestra el frontend.

Un cupón `fijo` más caro que el carrito **no** genera un total negativo: el total queda
en 0 (`Math.max(0, ...)` en `server.js`).

### Cuándo un cupón deja de servir

Las tres reglas se evalúan **contra la base**, en SQL, nunca con la fecha del navegador:

| Regla | Condición en SQL |
|---|---|
| Inactivo | `activo = 0` |
| Vencido | `fecha_expiracion IS NOT NULL AND fecha_expiracion < CURDATE()` |
| Agotado | `uso_maximo IS NOT NULL AND usos_actuales >= uso_maximo` |

**Por qué `CURDATE()` y no `new Date()`:** la fecha del navegador la controla el
cliente. Con la fecha del cliente, un cupón vencido se puede aplicar cambiando la hora
del reloj, y uno que todavía tiene margen se puede rechazar. `CURDATE()` es la fecha
del servidor de base de datos: es la única que nadie del lado del cliente puede mover.

Ojo con el formato: el listado del backoffice devuelve `fecha_expiracion` ya
formateada como `YYYY-MM-DD` con `DATE_FORMAT`, y el panel la arma a mano sin pasar
por `new Date('YYYY-MM-DD')` (eso se parsea como UTC midnight y en Argentina, UTC-3,
mostraba un día antes del real). Si agregás una consulta nueva, hacé lo mismo.

---

## 🔒 Por qué el descuento nunca se calcula desde el navegador

Hay dos rutas que parecen calcular el descuento. **Solo una de las dos manda.**

| | `POST /api/cupones/validar` | `POST /api/pedidos` |
|---|---|---|
| Quién lo llama | El carrito, para *pintar* el beneficio | El carrito, al confirmar |
| Contra qué calcula | No calcula nada: mira que el cupón esté activo, no vencido y con usos | Contra la base, dentro de la transacción del pedido |
| Quién cobra | Nadie, es solo ayuda visual | El server, y es el número que se guarda en `pedidos.total_pago` |

La regla es simple: **el navegador puede mentir, la base no.** Por eso:

- `POST /api/pedidos` **ignora el `total_pago` que le mandan**. Arma su propio subtotal
  con los precios leídos de `inventario_vinilos` y calcula el descuento sobre eso.
- Si el precio o el tipo del cupón cambian entre que el carrito pintó el descuento y el
  cliente apretó "confirmar", **manda el server**. Por eso el total que se confirma y
  el que se manda por WhatsApp es el que volvió del POST, no el que estaba en pantalla.

Esto no es teoría: es la protección contra comprar el catálogo entero por un centimo.
Antes el cliente mandaba el total y el server lo guardaba tal cual; cualquiera podía
mandar `{ total_pago: 0.01, items: [...] }`.

El carrito, igual, calcula el descuento para mostrarlo (así el cliente ve el beneficio
antes de confirmar). Eso es una cuestión de UX, no una fuente de verdad: si el server
rechaza el cupón, el carrito **ofrece rehacer el pedido sin cupón** con el total nuevo,
en vez de dejarlo trabado.

---

## 🛠️ Las 5 rutas

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/cupones/validar` | **Pública** (no pide sesión). Devuelve `id`, `codigo`, `tipo` y `valor`, o `400`. Tiene **rate limit**. |
| `GET` | `/api/admin/cupones` | Lista del backoffice. Activos primero, y dentro de ellos los que vencen antes; los sin fecha al final. |
| `POST` | `/api/admin/cupones` | Crea uno. `201` con la fila creada, `409` si el código ya existe. |
| `PUT` | `/api/admin/cupones/:id` | **Edición parcial**: solo toca los campos que vienen. |
| `DELETE` | `/api/admin/cupones/:id` | Lo borra de verdad. `404` si no existe. |

Las cuatro de `/api/admin/cupones` piden sesión de backoffice (`requiereAdmin`) y,
además, pasan por el gate CSRF por `Origin` que hay en `server.js`: los POST/PUT/DELETE
de otra web se cortan con `403`.

### `POST /api/cupones/validar` (la única pública)

Tres cosas que hay que tener presentes:

1. **Rate limit: 60 fallos por IP cada 10 minutos, y después `429`.** La ruta es
   pública y no exige sesión, así que sin throttle cualquiera puede probar códigos en
   boucle. Agota las 60 y esperá: no hay forma de "saltar" el límite salvo esperar la
   ventana.
2. **Un mismo `400` para todo.** Inexistente, inactivo, vencido y agotado devuelven
   todos `{"error": "Cupón inválido o vencido"}`. A propósito: si cada caso tuviera su
   propio mensaje, se podría usar la respuesta para descubrir qué códigos existen.
3. **Devuelve 4 campos, no más.** `id`, `codigo`, `tipo`, `valor`. `uso_maximo` y
   `usos_actuales` son del backoffice y **no se exponen**: verlos ayudaría a sondear
   el catálogo de cupones.

### `PUT /api/admin/cupones/:id` (edición parcial)

El cuerpo es parcial: se escribe lo que viene y se ignora lo que no. Es lo que permite
activar o desactivar con un `PUT { activo: 0 }` sin pisar el resto.

Las columnas que acepta:

| Campo | Regla |
|---|---|
| `codigo` | Se normaliza a mayúsculas. Máximo 50. Solo `[A-Z0-9_-]`. `409` si ya existe en otro cupón. |
| `tipo` | `porcentaje` o `fijo`. |
| `valor` | Número > 0. `<= 100` si el tipo (nuevo o ya guardado) es `porcentaje`. |
| `fecha_expiracion` | `YYYY-MM-DD` o vacío = `NULL` = no vence. |
| `uso_maximo` | Entero >= 1, o vacío = `NULL` = ilimitado. |
| `usos_actuales` | Entero >= 0. **No puede ser mayor que `uso_maximo`.** Vacío = "no lo toques". |
| `activo` | `0` o `1` (también acepta booleanos). |

`400` si no mandaste ningún campo, `404` si el cupón no existe, `409` si el código
choca con otro.

---

## 🖥️ Administración desde el panel

Engranaje ⚙️ → **Cupones**. Ahí se puede:

| Acción | Cómo | Qué llama |
|---|---|---|
| **Crear** | Botón `CREAR`, con código, tipo, valor, expiración y uso máximo. | `POST /api/admin/cupones` |
| **Editar** | Botón azul (lápiz): código, tipo, valor, fecha, uso máximo, **usos actuales** y activo. | `PUT /api/admin/cupones/:id` |
| **Activar / desactivar** | Botón de rayo. Baja lógica: el cupón sigue en la lista, marcado `INACTIVO`. | `PUT` con `{ activo }` |
| **Resetear usos** | Botón ámbar (↺). Vuelve el contador a 0 sin tocar código ni valor. | `PUT` con `{ usos_actuales: 0 }` |
| **Borrar** | Botón rojo (papelera). **Borra de verdad**, sin vuelta. | `DELETE /api/admin/cupones/:id` |

Un cupón recién creado arranca con `usos_actuales = 0`, aunque no lo mandes.

### Qué **no** se puede

- **No hay historial.** No existe un registro de quién cambió qué ni cuándo. La tabla
  `auditoria` existe en la base pero ningún handler escribe en ella.
- **No hay un límite por cliente.** `uso_maximo` es un contador **global**: un cliente
  logueado puede usar el mismo cupón en todos sus pedidos hasta agotar el contador.
- **No hay `valor_minimo` de pedido** ni restricción por producto o categoría.
- **No se puede deshacer un pedido.** No hay `DELETE` de pedidos: un pedido se cancela
  (`PUT /api/pedidos/:id/cancelar`) y listo. El total cobrado no se edita.
- **No se puede reaplicar un cupón a un pedido viejo.** El cupón se guarda al momento
  de comprar y no se toca más.

---

## ↩️ La regla de oro: qué pasa al cancelar

`PUT /api/pedidos/:id/cancelar` es la parte más delicada del circuito, y está escrita
así a propósito.

**Repone el stock desde el snapshot de la fila del pedido, ignorando el body.** Nunca
usa los `items` que manda el navegador. La versión anterior sí los usaba, y eso era
manipulable: mandar `{ items: [{ id: 1, cantidad: 9999 }]` inflaba el inventario.

Cómo funciona, en orden:

1. Abre una transacción y lee `estado`, `items` y `cupon_id` del pedido **con
   `FOR UPDATE`**. El lock deja el estado previo y los ids/cantidades bajo el mismo
   control de concurrencia que el pedido.
2. `404` si el pedido no existe.
3. `409` **si ya estaba cancelado**: se avisa y no se repone stock. Antes el segundo
   click del panel devolvía el doble.
4. `409` si el estado **no es `pendiente`**. `finalizado` y `entregado` son
   terminales: la mercadería ya salió del depósito, devolverla duplicaría el
   inventario. Cualquier estado desconocido cae acá también, a propósito: fail-safe.
5. Repone el stock sumando la cantidad de cada item del snapshot (`items` es el JSON
   que `POST /api/pedidos` guardó al comprar: id, cantidad, título y precio aplicado).
6. **Devuelve el uso del cupón**: `usos_actuales = GREATEST(0, usos_actuales - 1)`.
   El `GREATEST(0, ...)` es porque la columna es `NOT NULL` pero un pedido viejo puede
   tener el contador en 0, y bajarlo dejaría un `-1`.
7. Pone `estado = 'cancelado'` y responde `{ success, stock_repuesto }`.

Todo o nada: si algo falla, el rollback deja el stock y el contador como estaban. No
hay pedidos cancelados con la mercadería repuesta dos veces.

> El panel **ya no manda `items`**. Y aunque los mandara, no cambiaría el resultado.

---

## 🗄️ Migración y qué verificar

El esquema actual necesita **cinco** migraciones, en orden:

| Archivo | Qué hace |
|---|---|
| `2026-09-26_auth.sql` | Cuentas, sesiones, favoritos, auditoría. Agrega `usuario_id` a `pedidos`. |
| `2026-09-27_cupones.sql` | Crea la tabla `cupones`. |
| `2026-09-28_cupones_schema.sql` | Corrige `cupones`: `activo` y `usos_actuales` a NOT NULL, agrega `creado_en`, pasa `fecha_expiracion` de DATETIME a DATE. |
| `2026-09-29_pedidos_cupones.sql` | Crea `pedidos` si no existe y le agrega `cupon_id`, `cupon_codigo` y `descuento_aplicado`. |
| `2026-09-30_pedidos_direccion.sql` | Agrega `direccion_id` y el snapshot de dirección de envío a `pedidos`, con índice y FK opcional. |

### Cómo correrla

```bash
npm run migrar                    # aplica lo que falta y anota el historial
node scripts/migrar.mjs --estado  # applied / pending
node scripts/migrar.mjs --dry-run # ver el plan sin conectarse
```

Desde la PC, el host de Railway no resuelve: abrí un túnel primero.

```bash
railway connect MySQL --ssh --tunnel-only -P 33306
$env:MYSQL_URL='mysql://root:CLAVE@127.0.0.1:33306/railway'; npm run migrar
```

**Orden obligatorio: migración primero, deploy después.** `server.js` ya inserta
`cupon_id`, `cupon_codigo` y `descuento_aplicado` en `pedidos` y ya pide `creado_en`
en `cupones`. Si se sube a Railway sin correr la migración, **el checkout se rompe**
(columna inexistente) y el listado de cupones del panel también.

**Base nueva desde cero:** `npm run migrar` recorre los archivos por nombre y se detiene
en el primero que falla, y `2026-09-26_auth.sql` se cae en su sección 6 (hace
`ALTER TABLE pedidos` sobre una tabla que todavía no existe). El orden limpio es:

```bash
node scripts/migrar.mjs --archivo 2026-09-29_pedidos_cupones.sql
npm run migrar
```

El segundo comando completa `2026-09-26_auth.sql`, las migraciones de cupones y
`2026-09-30_pedidos_direccion.sql`. Esta última permite que una cuenta use una dirección
propia en el checkout; el pedido conserva una copia aunque luego se edite o borre la
dirección original.

### Qué verificar

`npm run migrar` **no imprime la salida de los SELECT** del final del archivo (el
script ignora los resultados). Para ver el estado final hay que correrlos a mano, con
el editor de queries de Railway o el cliente de MySQL:

1. **`SHOW CREATE TABLE cupones;`** — `activo` y `usos_actuales` tienen que decir
   `NOT NULL`, y tiene que estar `creado_en`.
2. **`SHOW CREATE TABLE pedidos;`** — tienen que existir `cupon_id`, `cupon_codigo` y
   `descuento_aplicado`.
3. **Si `pedidos.estado` es ENUM**, tiene que incluir `'pendiente'`, `'finalizado'` y
   `'cancelado'`. Si es VARCHAR (como la crea la migración) no hay nada que mirar.
4. **Prueba de humo:** creá un cupón desde el panel, aplicalo en el carrito, y fijate
   que en la lista de pedidos aparecen el código y el descuento. Después cancelá el
   pedido desde el panel y confirmá que el stock volvió y que el contador de usos
   bajó.

---

## 🆘 Problemas frecuentes

### El cupón no aplica

Te dice `Cupón inválido o vencido` o `400` al confirmar. En orden, mirá:

- ¿Está **activo**? (columna `activo`, o el botón de rayo del panel)
- ¿Venció? `fecha_expiracion < CURDATE()` es la regla. Si querés que no venza nunca,
  vaciá el campo de expiración (`NULL`).
- ¿Se agotó? `usos_actuales >= uso_maximo`. Mirá la columna **Usos** de la tabla.
- ¿El pedido quedó a medio hacer? Si el server rechaza el cupón, **el pedido entero se
  cae y no se cobra nada** (el rollback deshace el stock y el uso). El carrito te
  ofrece "Pedir sin cupón" con el total nuevo.
- **Ojo con el reloj del cliente:** la fecha que manda la base es la del servidor. Si en
  tu PC es un día más que en el servidor, el corte te va a sorprender. Para probar,
  usá una fecha de expiración lejos.

### Aparece agotado sin serlo

El panel muestra `AGOTADO` cuando `usos_actuales >= uso_maximo`, y eso no miente: el
contador no lo toca nadie más que el backend. Las dos causas reales:

- **Un `uso_maximo` chico.** Si lo cargaste mal, se "corrige" desde el ícono de editar:
  el campo **Usos actuales** y el **Uso máximo** son editables.
- **Cancelaste pedidos y algo quedó desfasado.** Cancelar devuelve el uso, pero solo si
  el pedido tenía `cupon_id`: los pedidos hechos **antes** de la migración
  `2026-09-29` no lo tienen, así que su cancelación no devuelve nada. Se corrige a
  mano desde el ícono de resetear (↺), que pone el contador en 0.

También puede ser un `NULL` silencioso de los tiempos anteriores a la migración
`2026-09-28`: si esa migración no corrió, un `usos_actuales = NULL` hace que
`NULL + 1 = NULL` y el cupón nunca se agota. Corré las migraciones.

### Error 429 al validar

`Demasiados intentos de cupón`. Son **60 validaciones fallidas por IP cada 10 minutos**
(`POST /api/cupones/validar` es pública, así que está throttleada). Las validaciones
exitosas no consumen cuota. Esperá la ventana y volvé a cargar el carrito.

No se puede "resetear": el contador vive en memoria, en el proceso del servidor, y se
limpia solo. Reiniciar el servidor también lo limpia, pero es un parche, no una
solución. Si te pasa normal, es que estás probando códigos en boucle: probá de a uno.

### El total del carrito no coincide con el del pedido

**El que manda es el del server.** Es a propósito: el precio del vinilo o el valor del
cupón pueden haber cambiado entre que se pintó el carrito y el pedido. El carrito lo
sabe y por eso el total que confirma y el que manda por WhatsApp es el que volvió del
`POST /api/pedidos`, no el que estaba en pantalla.

Si la diferencia es de un centavo o de un redondeo, es el `Math.round(x * 100) / 100` de
`server.js`. Si la diferencia es grande, revisá que el descuento se haya guardado bien:
`pedidos.descuento_aplicado` guarda el descuento **realmente aplicado** (`subtotal -
total`), no el teórico del cupón. Con un cupón fijo más caro que el carrito, el
descuento real queda recortado a que el total llegue a 0.

Si lo que se ve crudo es `$45.00` en vez de `$ 45,00`, eso no es un bug de cálculo: son
los `DECIMAL`, que mysql2 devuelve como texto y hay que formatear.

### Me olvidé la contraseña del admin

No hay contraseña en el código: es el hash `scrypt` de la fila en `admin_usuarios`.
Se resetea con el mismo comando que la crea:

```bash
$env:ADMIN_PASSWORD='mi-clave-nueva'; node scripts/crear-admin.mjs --email admin@guacamayorecords.com --nombre "Guacamayo"
```

Mínimo 8 caracteres. Si el email ya existe, el script **actualiza** el hash e imprime
`Actualizado: ...` (no duplica el usuario). Acepta también `--password 'mi-clave'`, y
los opcionales `--rol admin|editor` y `--activo 0`.

Después: cerrá la sesión vieja si quedó abierta (la sesión dura 12 h) y entrá de nuevo.

---

## 📎 Archivos relacionados

| Archivo | Qué tiene |
|---|---|
| `server.js` | Sección 4 (cupones) y sección 3 (pedidos). Son la fuente de verdad de este documento. |
| `src/lib/cupon.ts` | Estado del cupón del carrito: persistencia, re-validación y normalización. |
| `src/components/Cart.tsx` | El input del código, el total con descuento y el reintento sin cupón. |
| `src/components/AdminPanel.tsx` | `CouponManager`: alta, edición, activar, resetear usos y borrar. |
| `src/types/database.ts` | Tipo `Cupon` y `EstadoPedido`. |
| `db/migrations/2026-09-27_cupones.sql` | La tabla `cupones`. |
| `db/migrations/2026-09-28_cupones_schema.sql` | La corrección del esquema. |
| `db/migrations/2026-09-29_pedidos_cupones.sql` | Las columnas del cupón en `pedidos`. |
| `db/migrations/2026-09-30_pedidos_direccion.sql` | Dirección seleccionada y snapshot de envío en `pedidos`. |

---

**Versión:** 1.0 | 2026-09-29
