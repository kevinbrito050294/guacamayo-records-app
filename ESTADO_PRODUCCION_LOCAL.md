# Estado Produccion / Local - GuacamayoRecords

> Indice operativo para iniciar sesiones sin confundir lo publicado con lo local.
> Ultima verificacion registrada: 2026-10-15/16. Produccion tiene prioridad.

## Regla de verdad

1. Produccion publica y `main` de GitHub son la referencia funcional.
2. El working tree local puede contener trabajo posterior, pruebas o archivos generados no publicados.
3. Nunca se iguala una copia con `reset`, `checkout`, `restore` o `clean` sin una decision explicita.
4. Antes de leer grandes volumenes locales se ejecuta `powershell -File scripts/verificar-estado-publicado.ps1` y se consulta este indice.

## Produccion actual

### Repositorio y servicio

- Repositorio: `kevinbrito050294/guacamayo-records-app`.
- Rama publicada: `main`.
- Ultimo commit publicado verificado: `7157bcc5ee25c03dc0b5a8810e56dff4e0968b3d` (`feat: actualizar app automaticamente y reingresar con biometria`).
- Railway: servicio `guacamayo-records-app`, entorno `production`, estado `Online`.
- Web publica: `https://www.guacamayorecords.com`.
- El servidor Express sirve simultaneamente la web estatica y la API.
- La base de datos de produccion es MySQL/MariaDB en Railway.

### Web y API

- Bundle publico verificado: `/assets/index-DJkzeOdx.js`.
- Catalogo publico: `GET /api/vinilos`.
- Cotizaciones: `GET /api/configuracion_divisas`.
- Actualizacion en tiempo real: `GET /api/catalogo-eventos` mediante SSE.
- El servidor detecta cambios de inventario/divisas y avisa a la web y al panel admin.
- Pedidos: `POST /api/pedidos`; valida stock, precios, cupones, direccion y Plumas dentro de una transaccion.
- El error `insercion is not defined` despues de crear pedidos fue corregido en `736c6501`.
- FCM para nuevos pedidos se ejecuta despues del commit de la transaccion.
- Compras: `GET/POST /api/admin/compras` y recepcion protegida por admin.
- Recepcion: `GET /api/admin/compras/items/:id/preparar-inventario` devuelve el codigo libre segun el patron real del inventario.
- Incorporacion: `POST /api/vinilos` con `compra_item_id` crea el vinilo, suma stock, vincula el item y actualiza su estado dentro de una transaccion.

### Android vieja, preservada

- Package: `com.guacamayorecords.admin`.
- Version publica: `1.16`, `versionCode 17`.
- Manifiesto: `https://www.guacamayorecords.com/android-update.json`.
- No se debe cambiar ese manifiesto a la version/package de la app nueva.
- La keystore original de esta app se perdio; no es posible generar actualizaciones compatibles sin recuperarla.
- La app vieja puede seguir usando la web remota y la API.

### Android nueva

- Package: `com.guacamayorecords.adminnuevo`.
- Version publica: `1.23`, `versionCode 24`.
- APK: `https://www.guacamayorecords.com/downloads/guacamayo-admin.apk`.
- Manifiesto propio: `https://www.guacamayorecords.com/android-update-nuevo.json`.
- APK publico verificado: HTTP 200, hash SHA-256 `8E1FE9C9A444513BCE72D61F827EFFFC1A52716CED6BAA8EF54B6C6B1C1D0735`.
- Hash del APK local y publico coinciden.
- Keystore nueva local: `android/app/guacamayo-release-2026.jks`; nunca subirla a GitHub.
- Firebase local: `android/app/google-services.json`; contiene el cliente nuevo y nunca subirlo a GitHub.
- Build: `applicationId com.guacamayorecords.adminnuevo`, Firebase Messaging, permiso Android `POST_NOTIFICATIONS` y `GuacamayoMessagingService` registrados.
- La notificacion popup requiere instalar la APK nueva, iniciar sesion, aceptar permisos y registrar el token FCM.
- La app consulta el manifiesto al iniciar, descarga automaticamente una APK nueva y abre el instalador Android; Android sigue exigiendo confirmar la instalacion por seguridad.
- Despues de un logout, el boton `Ingresar con huella / PIN` vuelve a autenticar usando la credencial cifrada sin pedir la contraseña.
- La biometria no se abre automaticamente al iniciar la app; solo se solicita al pulsar el boton de reingreso.

## Funcion de cada parte

| Parte | Fuente principal | Funcion |
| --- | --- | --- |
| `src/App.tsx` | Frontend React | Shell, navegacion, catalogo, carrito, cuenta y login admin |
| `src/components/Catalog.tsx` | Frontend React | Busqueda, filtros visuales, precios y disponibilidad |
| `src/components/Cart.tsx` | Frontend React | Validacion de checkout y envio del pedido |
| `src/components/AdminPanel.tsx` | Frontend React | Inventario, pedidos, cupones, divisas, Plumas y sesiones |
| `src/components/cuenta/*` | Frontend React | Login cliente, favoritos, pedidos, direcciones y cuenta |
| `src/lib/cuenta.ts` | Frontend API | Sesion cliente, favoritos, pedidos y datos de cuenta |
| `server.js` | Backend Express | API, transacciones, inventario, pedidos, FCM, SSE y archivos publicos |
| `auth.js` | Backend auth | Cookies, sesiones, roles admin y cliente |
| `db/migrations/*` | Base de datos | Esquema y cambios de MySQL/MariaDB |
| `android/app/*` | APK Capacitor | WebView remota, biometria, autologin, FCM y actualizador |
| `capacitor.config.ts` | Android | Package/app ID y URL remota de la app |
| `scripts/publicar-android.ps1` | Publicacion Android | Versiona, compila, firma, sube APK/manifiesto nuevo y verifica hash |
| `graphify-out/*` | Mapa de conocimiento | Indice navegable del codigo y documentacion, no fuente de produccion |

## Estado local actual

- Local HEAD: `0ebbbbe32e05dbc7379c8ead54db189eefa0b9b2`.
- GitHub/main y local no coinciden.
- Working tree ampliamente modificado; no asumir que sus cambios estan publicados.
- Hay archivos generados y cambios ajenos en `node_modules`, `dist`, Graphify y otros archivos.
- Package local Android: `com.guacamayorecords.adminnuevo`, `1.19/20`.
- El indice Graphify local se actualiza con `C:\Python314\python.exe -m graphify update .`.
- Ultima actualizacion Graphify local: 776 nodos, 1259 edges, 71 comunidades. Quedo advertido que faltan `tree_sitter_sql` y hay 3 archivos Gradle con extraccion parcial.
- El Graphify local es orientativo hasta comparar su version con GitHub.
- `apksigner` no esta disponible en el entorno; se verifican build Gradle, package, HTTP 200 y SHA-256.

## Cierre obligatorio de cada tarea

1. Ejecutar `powershell -File scripts/verificar-estado-publicado.ps1` antes de editar/publicar.
2. Revisar que la solucion no incluya cambios ajenos del working tree.
3. Ejecutar validaciones apropiadas: `npm run typecheck`, `npm run build`, `node --check server.js` o el flujo Android.
4. Actualizar este archivo con versiones, commits, URLs, hashes, bloqueos y decisiones nuevas.
5. Ejecutar Graphify incremental y registrar que se actualizo `graphify-out/`.
6. Ejecutar `powershell -File scripts/backup-critico.ps1` al finalizar una tarea funcional.
7. Publicar solo cuando la verificacion de produccion y el diff aislado sean correctos.
8. Repetir la comprobacion publica despues del deploy; no afirmar publicado por el solo hecho de subir un archivo.

## Backups y recuperacion

- El backup debe vivir fuera del repositorio, preferentemente en un disco/cloud con acceso restringido.
- Ejecutar `scripts/backup-critico.ps1` al cierre de cada tarea y programarlo diariamente en Windows.
- El backup incluye fuente critica, migraciones, APK, manifiestos, `google-services.json` y keystores si existen.
- Secretos nunca se commitean ni se imprimen en logs; el directorio de backup debe protegerse con cifrado/permisos.
- Conservar varias generaciones. El script mantiene por defecto las ultimas 20.
- Un APK no reemplaza una keystore: guardar siempre el archivo `.jks` original y su contraseña en un gestor seguro.
- Respaldar tambien `FIREBASE_SERVICE_ACCOUNT_JSON` y variables de Railway en un gestor seguro, nunca en Git.

## Perdidas conocidas y decisiones

- Se perdio la keystore de `com.guacamayorecords.admin`; por eso se creo `com.guacamayorecords.adminnuevo` con una keystore nueva.
- La app vieja y la nueva son aplicaciones distintas y deben conservar manifiestos de actualizacion separados.
- Si una tarea toca Android/Firebase, verificar package, `google-services.json`, keystore, version, APK, hash y manifiesto antes de publicar.

## Compras y recepcion implementadas

- Migracion aplicada en MySQL de produccion: `2026-10-16_compras_abastecimiento.sql`.
- El patron real de codigos detectado en produccion es `VIN` + tres digitos; el siguiente libre al implementar fue `VIN028`.
- El algoritmo no fija `VIN000X`: analiza los codigos existentes, busca el primer numero libre y usa un bloqueo MySQL para evitar colisiones concurrentes.
- La pestaña `Compras` permite registrar proveedor, tasas ARS/USDT y VES/USDT, e items de compra.
- El item no aparece en el catalogo hasta que se pulsa `Agregar al inventario` y se completa el `VinylForm` precargado.
- El precio de venta sigue siendo obligatorio y editable; el costo de compra permanece separado.
- El formulario de compras carga el precio unitario en USDT; el backend calcula y guarda equivalentes VES y ARS usando las tasas snapshot.
- La misma compra admite multiples discos/items y conserva las tasas ARS/USDT y VES/USDT de la operacion.

## Ultima tarea de mantenimiento

- Indice creado y reglas persistentes agregadas a `AGENTS.md`.
- Backup verificado en `C:\Users\kevin\Backups\guacamayo-records\20261015-222623`.
- El backup contiene keystore, Firebase, APK y `SHA256.json` fuera del repositorio.
- Los cambios de este indice y del script de backup deben publicarse documentalmente sin subir secretos ni mezclar cambios locales ajenos.
