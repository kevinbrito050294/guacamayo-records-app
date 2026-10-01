# App Android de administraci??n

La app Android es un companion privado de la web. No reemplaza la web ni tiene
una API o una base de datos separada: abre `https://www.guacamayorecords.com/?admin=1`
en Capacitor para reutilizar el login, las cookies y la sesi??n administrativa ??nica.

## Actualizaciones

Al abrir, la app consulta `https://www.guacamayorecords.com/android-update.json`.
Si `versionCode` es mayor al instalado, ofrece descargar e instalar el APK indicado
en `apkUrl`. Android siempre pide confirmaci??n: una app privada fuera de Google Play
no puede instalar actualizaciones silenciosamente.

Para publicar una versi??n nueva:

1. Aumentar `versionCode` y `versionName` en `android/app/build.gradle`.
2. Generar el APK release y subirlo a la URL indicada en `android-update.json`.
3. Actualizar `android-update.json` en el servidor con el nuevo `versionCode`.

Los cambios de la interfaz web siguen llegando autom??ticamente porque Capacitor
carga la URL remota al iniciar.

## Sesi??n

- Se mantiene un ??nico usuario administrativo.
- Solo puede existir una sesi??n admin activa entre la web y Android.
- Si el panel ya est?? abierto en otro dispositivo, el backend responde `423`.
- Para cambiar de dispositivo hay que cerrar sesi??n primero.

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

La app no debe publicarse con credenciales embebidas. El usuario y la contrase??a
se ingresan en el login normal del panel.
