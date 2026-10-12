# Recuperacion de cuenta por email

Este documento define el flujo de "Olvide mi contrasena" para cuentas de cliente y
administradores. El envio se realiza con [Resend](https://resend.com/) desde el backend;
la clave de Resend nunca se entrega al navegador ni se compila dentro del frontend.

> **Estado:** contrato operativo y de configuracion. Si las rutas aun no estan publicadas
> en el backend, esta guia no implica que la funcionalidad ya este desplegada.

## Flujo

1. La persona envia su email desde la pantalla de recuperacion.
2. El servidor responde el mismo mensaje tanto si el email existe como si no existe.
3. Si la cuenta existe y esta habilitada, el servidor genera un token criptograficamente
   aleatorio, guarda solamente su hash, y envia por Resend un enlace construido con
   `PUBLIC_APP_URL`.
4. El enlace puede usarse durante **30 minutos** desde su creacion.
5. Al abrirlo, el servidor valida el hash, la expiracion y que el token no haya sido usado.
   Si todo es valido, permite establecer una nueva contrasena.
6. Al completar el cambio, el token se marca como consumido dentro de la misma operacion y
   deja de servir. Un segundo intento con el mismo enlace debe rechazarse.

El token es de **un solo uso**: no se reutiliza, no se guarda en texto plano y no se
registra completo en logs. El enlace debe viajar por HTTPS.

## Anti-enumeracion

- La solicitud responde igual para emails existentes, inexistentes o no habilitados.
- No se informa si el correo fue enviado, si la cuenta existe ni cuál es su estado.
- El tiempo y el formato de respuesta deben ser equivalentes en ambos casos.
- El endpoint debe aplicar rate limit por IP y por identificador de cuenta, sin revelar qué
  límite se alcanzó.
- Los logs pueden registrar una referencia técnica o un hash truncado, nunca el token ni la
  contraseña.

El mensaje recomendado es: **"Si el email corresponde a una cuenta, recibirás un enlace
para recuperar el acceso."**

## Variables de entorno

| Variable | Uso | Secreto |
|---|---|---|
| `RESEND_API_KEY` | Credencial server-side para enviar el correo mediante Resend. | Si |
| `MAIL_FROM` | Remitente visible, por ejemplo `GuacamayoRecords <no-reply@dominio.tld>`. | No, pero debe ser un remitente verificado. |
| `PUBLIC_APP_URL` | Origen publico del enlace, por ejemplo `https://www.guacamayorecords.com`. | No |

`RESEND_API_KEY` debe existir solo en el entorno del backend y en el gestor de secretos del
hosting. No debe comenzar con `VITE_`, no debe copiarse a variables publicas y no debe
aparecer en tickets, capturas ni archivos versionados.

## Dominio y remitente en Resend

1. En Resend, agregar el dominio que se usara en `MAIL_FROM`.
2. Publicar en DNS los registros SPF y DKIM que Resend indique; agregar DMARC con una
   politica acorde a la operacion del dominio.
3. Esperar la verificacion y confirmar que el dominio figure como **Verified**.
4. Usar en `MAIL_FROM` una direccion del dominio verificado, por ejemplo
   `GuacamayoRecords <no-reply@guacamayorecords.com>`.
5. Crear una API key con el alcance minimo necesario para enviar correos y guardarla en
   Railway como `RESEND_API_KEY`.
6. Configurar `PUBLIC_APP_URL` con HTTPS y el dominio real que abrira el usuario. No usar
   `localhost`, una URL de preview ni el dominio de Resend en produccion.
7. Enviar una prueba y comprobar recepcion, SPF, DKIM, DMARC y que el enlace apunte al
   dominio publico correcto.

Si Resend rechaza el envio, conservar el mismo mensaje generico hacia la persona usuaria y
registrar el error tecnico del proveedor para soporte. No mostrar la respuesta de Resend.

## Verificacion operativa

- Solicitar recuperacion con un email existente y confirmar la recepcion.
- Solicitarla con un email inexistente y confirmar que la respuesta visible sea identica.
- Usar el enlace despues de 30 minutos y confirmar que sea invalido.
- Usar dos veces un enlace valido y confirmar que solo el primer cambio funcione.
- Confirmar que el correo use el dominio y el remitente verificados.
- Rotar la API key si aparece en logs, commits o capturas, y revisar los envios recientes en Resend.
