# App Android de administración

La app Android es un companion privado de la web. No reemplaza la web ni tiene
una API o una base de datos separada: abre `https://www.guacamayorecords.com/?admin=1`
en Capacitor para reutilizar el login, las cookies y la sesión administrativa única.

## Actualizaciones

Al abrir, la app consulta `https://www.guacamayorecords.com/android-update.json`.
Si `versionCode` es mayor al instalado, ofrece descargar e instalar el APK indicado
en `apkUrl`. Android siempre pide confirmación: una app privada fuera de Google Play
no puede instalar actualizaciones silenciosamente.

Para publicar una versión nueva:

1. Aumentar `versionCode` y `versionName` en `android/app/build.gradle`.
2. Generar el APK release y subirlo a la URL indicada en `android-update.json`.
3. Actualizar `android-update.json` en el servidor con el nuevo `versionCode`.

La firma release usa las variables privadas `GUACAMAYO_KEYSTORE_FILE`,
`GUACAMAYO_KEYSTORE_PASSWORD` y `GUACAMAYO_KEY_ALIAS`. Hay que conservar el mismo
keystore para todas las versiones: Android rechaza una actualización firmada con
otra clave.

Los cambios de la interfaz web siguen llegando automáticamente porque Capacitor
carga la URL remota al iniciar.

## Sesión

- Se mantiene un único usuario administrativo.
- Solo puede existir una sesión admin activa entre la web y Android.
- Si el panel ya está abierto en otro dispositivo, el backend responde `423`.
- Para cambiar de dispositivo hay que cerrar sesión primero.

## Desbloqueo biométrico

Si ya existe una sesión administrativa guardada en el WebView, al abrir la app
Android solicita huella digital o el PIN/patrón del dispositivo mediante
`BiometricPrompt`. La contraseña nunca se guarda en el teléfono. En una instalación
nueva, primero se permite el login normal; la huella se solicita desde el siguiente
inicio mientras la sesión administrativa siga vigente.

## Desarrollo

Requisitos:

- Node.js 22 o superior.
- Android Studio con Android SDK.
- `ANDROID_HOME` configurado, o `android/local.properties` con `sdk.dir` local.

Comandos:

```bash
npm run build
npm run mobile:sync
cd android
./gradlew assembleDebug
```

En Windows, usar `gradlew.bat assembleDebug` desde la carpeta `android`.
El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

La app no debe publicarse con credenciales embebidas. El usuario y la contraseña
se ingresan en el login normal del panel.
