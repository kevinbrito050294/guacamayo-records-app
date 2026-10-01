package com.guacamayorecords.admin;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Toast;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;

public class MainActivity extends BridgeActivity {
    private static final String UPDATE_URL =
            "https://www.guacamayorecords.com/android-update.json";
    private static final String KEY_ALIAS = "guacamayo-admin-credentials";
    private static final String CREDENTIALS_PREFS = "admin_biometric_credentials";
    private final ExecutorService updateExecutor = Executors.newSingleThreadExecutor();
    private boolean biometricPromptShown;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getBridge().getWebView().addJavascriptInterface(new AndroidBiometricBridge(), "AndroidBiometric");
        // WebView restores httpOnly cookies asynchronously after the activity
        // starts; checking immediately can miss an existing admin session.
        new Handler(Looper.getMainLooper()).postDelayed(this::checkBiometricUnlock, 1500);
        checkForUpdate();
    }

    @Override
    public void onDestroy() {
        updateExecutor.shutdownNow();
        super.onDestroy();
    }

    /** Require device authentication before opening the private admin app. */
    private void checkBiometricUnlock() {
        if (biometricPromptShown) return;

        int authenticators = BiometricManager.Authenticators.BIOMETRIC_WEAK
                | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        BiometricManager manager = BiometricManager.from(this);
        if (manager.canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) return;
        biometricPromptShown = true;

        Executor executor = ContextCompat.getMainExecutor(this);
        BiometricPrompt prompt = new BiometricPrompt(this, executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        finishAndRemoveTask();
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                        Toast.makeText(MainActivity.this,
                                "No se pudo verificar la huella.", Toast.LENGTH_SHORT).show();
                    }

                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        autoLoginWithStoredCredentials();
                    }
                });

        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Desbloquear Guacamayo Admin")
                .setSubtitle("Usá tu huella o el PIN del dispositivo")
                .setDescription("La sesión administrativa está protegida")
                .setAllowedAuthenticators(authenticators)
                .setConfirmationRequired(false)
                .build();
        prompt.authenticate(promptInfo);
    }

    private void autoLoginWithStoredCredentials() {
        String[] credentials = readAdminCredentials();
        if (credentials == null) {
            runOnUiThread(() -> Toast.makeText(this,
                    "Ingresá una vez con email y contraseña para activar la huella.",
                    Toast.LENGTH_LONG).show());
            return;
        }

        String script = "(async function(){const response=await fetch('/api/admin/login',{" +
                "method:'POST',credentials:'include',headers:{'Content-Type':'application/json'}," +
                "body:JSON.stringify({email:" + JSONObject.quote(credentials[0]) +
                ",password:" + JSONObject.quote(credentials[1]) + "})});" +
                "if(response.ok){window.location.reload();}" +
                "else{alert('No se pudo iniciar sesión con la credencial guardada.');}" +
                "})();";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(script, null));
    }

    private SecretKey getCredentialsKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(
                    KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build());
            generator.generateKey();
        }
        return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
    }

    private String encryptCredential(String value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getCredentialsKey());
        String iv = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP);
        String encrypted = Base64.encodeToString(
                cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
        return iv + ":" + encrypted;
    }

    private String decryptCredential(String value) throws Exception {
        String[] parts = value.split(":", 2);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getCredentialsKey(), new GCMParameterSpec(
                128, Base64.decode(parts[0], Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    private void saveAdminCredentials(String email, String password) {
        try {
            getSharedPreferences(CREDENTIALS_PREFS, MODE_PRIVATE).edit()
                    .putString("email", encryptCredential(email))
                    .putString("password", encryptCredential(password))
                    .apply();
        } catch (Exception error) {
            Log.e("GuacamayoAdmin", "No se pudieron guardar las credenciales seguras", error);
            runOnUiThread(() -> Toast.makeText(this,
                    "No se pudo activar el acceso biométrico.", Toast.LENGTH_LONG).show());
        }
    }

    private String[] readAdminCredentials() {
        try {
            SharedPreferences preferences = getSharedPreferences(CREDENTIALS_PREFS, MODE_PRIVATE);
            String email = preferences.getString("email", null);
            String password = preferences.getString("password", null);
            if (email == null || password == null) return null;
            return new String[]{decryptCredential(email), decryptCredential(password)};
        } catch (Exception error) {
            return null;
        }
    }

    public final class AndroidBiometricBridge {
        @JavascriptInterface
        public void saveAdminCredentials(String email, String password) {
            if (email != null && !email.isEmpty() && password != null && !password.isEmpty()) {
                MainActivity.this.saveAdminCredentials(email, password);
            }
        }
    }

    private void checkForUpdate() {
        updateExecutor.execute(() -> {
            try {
                HttpURLConnection connection = (HttpURLConnection) new URL(UPDATE_URL).openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setRequestMethod("GET");

                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return;

                String payload;
                try (InputStream input = connection.getInputStream()) {
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    byte[] buffer = new byte[4096];
                    int read;
                    while ((read = input.read(buffer)) != -1) bytes.write(buffer, 0, read);
                    payload = bytes.toString("UTF-8");
                } finally {
                    connection.disconnect();
                }

                JSONObject update = new JSONObject(payload);
                long latestVersionCode = update.getLong("versionCode");
                String latestVersionName = update.optString("versionName", "nueva");
                String apkUrl = update.getString("apkUrl");
                long installedVersionCode = getInstalledVersionCode();

                if (latestVersionCode <= installedVersionCode || !apkUrl.startsWith("https://")) return;

                runOnUiThread(() -> showUpdateDialog(latestVersionCode, latestVersionName, apkUrl));
            } catch (Exception ignored) {
                // An update check must never prevent the admin panel from opening.
            }
        });
    }

    private long getInstalledVersionCode() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode();
            }
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
        } catch (Exception error) {
            return Long.MAX_VALUE;
        }
    }

    private void showUpdateDialog(long versionCode, String versionName, String apkUrl) {
        new AlertDialog.Builder(this)
                .setTitle("Actualización disponible")
                .setMessage("Hay una nueva versión (" + versionName + "). ¿Querés instalarla ahora?")
                .setNegativeButton("Más tarde", null)
                .setPositiveButton("Actualizar", (dialog, which) -> downloadAndInstall(versionCode, apkUrl))
                .show();
    }

    private void downloadAndInstall(long versionCode, String apkUrl) {
        Toast.makeText(this, "Descargando actualización...", Toast.LENGTH_LONG).show();
        updateExecutor.execute(() -> {
            File apkFile = new File(getCacheDir(), "guacamayo-admin-" + versionCode + ".apk");
            try {
                HttpURLConnection connection = (HttpURLConnection) new URL(apkUrl).openConnection();
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(30000);
                connection.setRequestMethod("GET");
                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    throw new IllegalStateException("No se pudo descargar la actualización");
                }

                try (InputStream input = connection.getInputStream();
                     FileOutputStream output = new FileOutputStream(apkFile)) {
                    byte[] buffer = new byte[8192];
                    int read;
                    long total = 0;
                    while ((read = input.read(buffer)) != -1) {
                        total += read;
                        if (total > 200L * 1024 * 1024) {
                            throw new IllegalStateException("La actualización es demasiado grande");
                        }
                        output.write(buffer, 0, read);
                    }
                } finally {
                    connection.disconnect();
                }

                runOnUiThread(() -> installApk(apkFile));
            } catch (Exception error) {
                apkFile.delete();
                runOnUiThread(() -> Toast.makeText(
                        this, "No se pudo descargar la actualización.", Toast.LENGTH_LONG).show());
            }
        });
    }

    private void installApk(File apkFile) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getPackageManager().canRequestPackageInstalls()) {
            new AlertDialog.Builder(this)
                    .setTitle("Permiso necesario")
                    .setMessage("Android necesita permitir instalaciones desde esta app para actualizar el APK.")
                    .setNegativeButton("Cancelar", null)
                    .setPositiveButton("Abrir ajustes", (dialog, which) -> {
                        Intent settings = new Intent(
                                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + getPackageName()));
                        startActivity(settings);
                    })
                    .show();
            return;
        }

        Uri apkUri = FileProvider.getUriForFile(
                this, getPackageName() + ".fileprovider", apkFile);
        Intent install = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(apkUri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(install);
    }
}
