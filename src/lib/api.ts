// URL base de la API.
//
// En producción el Express de `server.js` sirve las dos cosas: los estáticos de
// `dist/` y las rutas `/api`. Por eso las llamadas son RELATIVAS (mismo origen):
// así la cookie httpOnly de sesión viaja como same-origin y no hay ni CORS ni
// SameSite=Lax que pelear (un dominio distinto sí rompería la cookie).
//
// En local el frontend lo sirve Vite (5173) y la API el Express (3001), que son
// mismo sitio (localhost) pero distinto origen: por eso van con credentials.
export function apiUrl(): string {
  return window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
}
