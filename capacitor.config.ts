import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.guacamayorecords.admin',
  appName: 'Guacamayo Admin',
  webDir: 'dist',
  server: {
    // La app privada carga la web principal para compartir cookies, sesiones y
    // el bloqueo de sesión única sin duplicar el panel administrativo.
    url: 'https://www.guacamayorecords.com/?admin=1',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
