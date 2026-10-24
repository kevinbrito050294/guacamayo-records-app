/// <reference types="vite/client" />

// Variables de entorno propias del front. Vite solo expone las que empiezan con VITE_.
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface Window {
  AndroidBiometric?: {
    // La contraseña solo entra al bridge para cifrarse; ningún método la devuelve.
    saveAdminCredentials: (adminId: string, email: string, nombre: string, password: string) => void;
    // Devuelve exclusivamente id, email, nombre y lastUsed.
    listAdminCredentials: () => string;
    selectAdmin: (adminId: string) => void;
    registerPushToken: () => void;
    requestBiometricLogin: () => void;
  };
}
