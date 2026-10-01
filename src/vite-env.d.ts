/// <reference types="vite/client" />

// Variables de entorno propias del front. Vite solo expone las que empiezan con VITE_.
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
