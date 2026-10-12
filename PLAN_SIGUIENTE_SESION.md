# PLAN DE CONTINUIDAD — estado real del proyecto

> Actualizado el 2026-10-12 después de una auditoría paralela del backend, frontend,
> Android, migraciones, documentación y Git. Este archivo reemplaza el plan histórico
> de septiembre/octubre que describía tareas ya resueltas.

## 1. Regla de trabajo

- Separar siempre **implementado localmente**, **publicado/verificado** y **pendiente de comprobar**.
- No asumir que el working tree local está desplegado en Railway.
- Antes de modificar código, consultar este archivo y verificar el estado real con comandos.
- Si se trabaja en paralelo, un dueño por archivo; nadie hace commit desde un agente.

## 2. Arquitectura vigente

- Frontend: React 18 + TypeScript + Vite + Tailwind.
- Backend: Express 5 en `server.js` y autenticación/sesiones en `auth.js`.
- Base de datos: MariaDB/MySQL mediante `mysql2`; `db/migrations/` es la fuente de verdad.
- Web publicada: `https://www.guacamayorecords.com`.
- App Android administrativa: Capacitor, biometría, autologin cifrado, actualización por APK y FCM.
- Compra: catálogo → carrito → validación server-side de precios/cupones/recompensas → pedido → WhatsApp.

## 3. Implementado en el código local

### Comercio y administración

- Catálogo de vinilos, búsqueda, stock, imágenes, CSV y edición de inventario.
- Precios en USD, ARS y USDT; tasas manuales y sincronización opcional con Binance.
- Carrito, checkout por WhatsApp y control de stock transaccional.
- Panel admin para inventario, pedidos, cupones, divisas, administradores, notificaciones y Plumas.

### Cuentas y pedidos

- Registro, login, Google OAuth opcional, logout y recuperación de contraseña por email.
- Direcciones, dirección principal, favoritos e historial de pedidos.
- Pedido con dirección y snapshot histórico de envío.
- Estados `pendiente`, `finalizado` y `cancelado`.
- Finalizar valida el estado previo; cancelar es idempotente desde el punto de vista del stock y no confía en `req.body.items`.

### Cupones

- Crear, editar, activar/desactivar, resetear usos y borrar desde el panel.
- Validación pública con rate limit y respuesta mínima.
- Descuento calculado y guardado por el backend dentro de la transacción; el navegador no es fuente de verdad.
- El cupón queda asociado al pedido y se revierte al cancelar cuando la fila del cupón sigue existiendo.

### Plumas/recompensas

- Ledger, saldo, cotización, consumo FIFO, ajustes administrativos, acreditación al finalizar y reversión al cancelar.
- Migración local: `db/migrations/2026-10-01_recompensas.sql`.

### Android

- Versión vigente: `versionCode 16`, `versionName 1.15`.
- Coincide en `android/app/build.gradle` y `android-update.json`.
- APK público verificado con HTTP 200, firma válida y hash coincidente con el APK local.
- Biometría/PIN, credenciales cifradas con AES/GCM + Android Keystore y soporte para varias cuentas.
- Actualización HTTPS mediante `scripts/publicar-android.ps1`.
- Push FCM implementado mediante `GuacamayoMessagingService.java` y `2026-10-08_admin_push_tokens.sql`.

## 4. Pendiente de verificar, no necesariamente pendiente de implementar

### Base de datos y producción

No hay evidencia local suficiente para afirmar que Railway tiene aplicadas todas las migraciones posteriores. Verificar, en este orden:

1. `npm run migrar` contra la base correcta.
2. Estado de `migraciones` y existencia de las columnas/índices de:
   - `2026-09-29_pedidos_cupones.sql`
   - `2026-09-30_pedidos_direccion.sql`
   - `2026-10-01_recompensas.sql`
   - `2026-10-06_configuracion_divisas_binance.sql`
   - `2026-10-07_configuracion_divisas_unicas.sql`
   - `2026-10-07_recuperacion_password.sql`
   - `2026-10-08_admin_push_tokens.sql`
3. Checkout con cupón, dirección y Plumas.
4. Crear, cancelar y finalizar pedidos.
5. Recuperación por email, sincronización Binance y push FCM.

`npm run migrar` descarta la salida de algunos `SELECT` de verificación; revisar la base con consultas explícitas después de migrar.

### Variables operativas

Confirmar en Railway, sin poner secretos en Git:

- `MYSQL_URL` y credenciales rotadas.
- `RESEND_API_KEY`, `MAIL_FROM` y `PUBLIC_APP_URL`.
- `FIREBASE_SERVICE_ACCOUNT_JSON`.
- Variables de Binance si se usa sincronización automática.

### Prueba Android real

Probar en un dispositivo físico:

- actualización desde una versión anterior a 1.15;
- huella/PIN y autologin después del login manual;
- cambio entre cuentas administrativas;
- recepción de push con la app cerrada.

## 5. Pendientes funcionales reales

Prioridad alta:

1. Mostrar la dirección/snapshot de envío en “Mis pedidos” y en el detalle del panel admin.
2. Hacer que el total visual del carrito incluya el descuento estimado de Plumas, para que coincida con el total server-side.
3. Refrescar el saldo de Plumas inmediatamente después de login o registro.
4. Corregir la consulta duplicada de `/api/admin/yo` en `src/App.tsx`.
5. Precargar el WhatsApp del perfil en el checkout cuando el cliente está autenticado.
6. Bloquear acciones simultáneas de favoritos mientras una operación está en curso.
7. Decidir si el indicador de vigencia de cupones del panel debe calcularse desde una fecha entregada por el servidor para evitar diferencias cerca de medianoche.

Deuda de calidad:

- No hay tests automatizados para carrito, cupones, stock, direcciones, pedidos ni Plumas.
- `ConfiguracionDivisa.tasa` está tipada como `number`, aunque MySQL puede devolver DECIMAL como string.
- `divisa_preferida` debe validarse contra `USD`, `ARS` y `USDT`.
- No existe auditoría sistemática para cambios de pedidos, cupones y ajustes administrativos.
- Si se borra un cupón usado, la cancelación no puede restaurar su contador.
- Una base totalmente vacía puede fallar en `2026-09-26_auth.sql` porque esa migración presupone que existen tablas históricas de inventario/divisas.

## 6. Documentación que debe alinearse

La implementación ya avanzó más que varios documentos. Revisar antes de tomar decisiones:

- `docs/PLUMAS.md`: todavía describe endpoints/migración como inexistentes.
- `ARQUITECTURA_TECNICA.md`: contiene el mismo estado antiguo de Plumas.
- `docs/ACCOUNT_RECOVERY.md`: aclarar que la recuperación implementada es para cuentas de cliente, no necesariamente admins.
- `docs/COUPONS.md`: eliminar referencias a estados antiguos como `entregado` si no existen en el flujo actual.
- `README.md`: enumerar toda la documentación actual, incluyendo Android, recuperación y Plumas.
- `graphify-out/`: regenerar después de consolidar documentación y código.

## 7. Seguridad y repositorio

- `.env` ya no está en el índice actual, pero una credencial real quedó en el historial Git según la auditoría.
- Rotar la credencial de base de datos en Railway y auditar otros secretos históricos.
- No subir `.env`, contraseñas, JSON de Firebase ni la contraseña del keystore.
- El working tree tiene muchos cambios modificados/no trackeados, incluyendo código, migraciones, Android, `dist/`, `downloads/` y Graphify.
- Antes de commitear, separar cambios funcionales de archivos generados y revisar `git status`/`git diff`.

## 8. Verificación obligatoria antes de cerrar una sesión funcional

```bash
npm run migrar
npm run lint
npm run typecheck
npm run build
node --check server.js
git status
```

Después de modificar código o documentación:

```bash
graphify update .
```

Para cambios Android distribuidos:

```powershell
scripts/publicar-android.ps1
```

El script debe usar la keystore vigente, incrementar la versión, generar el release, publicar el APK/manifiesto y verificar por HTTPS el hash descargado. No afirmar que quedó publicado si falta cualquiera de esas verificaciones.

## 9. Estado de Git y publicación al 2026-10-12

- Rama local: `main`.
- Último commit local: `edad373` (`docs: dejar continuidad de sesion biometrica`).
- El working tree está ampliamente modificado y contiene trabajo posterior al último commit.
- Android publicado y verificado: `1.15` / `versionCode 16`.
- No asumir que todos los cambios locales posteriores al último commit están desplegados en Railway.

## 10. Orden recomendado para la próxima sesión

1. Confirmar estado de Railway y aplicar/verificar migraciones.
2. Ejecutar las verificaciones de la sección 8.
3. Probar los flujos críticos web y Android indicados arriba.
4. Corregir primero los siete pendientes funcionales concretos.
5. Alinear documentación contradictoria.
6. Separar y revisar cambios del working tree antes de crear commits.
7. Actualizar Graphify y volver a fechar este archivo solo si cambia el estado verificable.
