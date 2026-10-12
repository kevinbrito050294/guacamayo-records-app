package com.guacamayorecords.admin;

import android.app.AlertDialog;
import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
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
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;
import org.json.JSONArray;

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
import android.view.View;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    private static final String UPDATE_URL =
            "https://www.guacamayorecords.com/android-update.json";
    private static final String KEY_ALIAS = "guacamayo-admin-credentials";
    private static final String CREDENTIALS_PREFS = "admin_biometric_credentials";
    private static final String CREDENTIALS_LIST = "credentials";
    private static final String SELECTED_ADMIN_ID = "selectedAdminId";
    private final ExecutorService updateExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean biometricPromptShown;
    private boolean authenticationInProgress;
    private boolean authFlowStarted;
    private boolean updateCheckScheduled;
    private int updateCheckAttempts;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        // La vista puede terminar de cargar antes de que aparezca el diálogo biométrico.
        // Ocultarla desde el primer ciclo evita mostrar el panel privado durante esa ventana.
        webView.setVisibility(View.INVISIBLE);
        webView.addJavascriptInterface(new AndroidBiometricBridge(), "AndroidBiometric");
        // WebView restores httpOnly cookies asynchronously after the activity
        // starts; checking immediately can miss an existing admin session.
        mainHandler.postDelayed(this::checkBiometricUnlock, 1500);
    }

    @Override
    public void onStart() {
        super.onStart();
    }

    @Override
    public void onStop() {
        super.onStop();
    }

    @Override
    public void onDestroy() {
        mainHandler.removeCallbacksAndMessages(null);
        updateExecutor.shutdownNow();
        super.onDestroy();
    }

    /** Require device authentication before opening the private admin app. */
    private void checkBiometricUnlock() {
        if (isFinishing() || authFlowStarted) return;
        startUnlockFlow();
    }

    private void startUnlockFlow() {
        if (isFinishing() || authFlowStarted) return;
        authFlowStarted = true;

        int authenticators = BiometricManager.Authenticators.BIOMETRIC_WEAK
                | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        BiometricManager manager = BiometricManager.from(this);
        if (manager.canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) {
            // No device credential exists, so there is no stronger gate to wait for.
            revealWebView();
            scheduleUpdateCheck(500);
            return;
        }
        biometricPromptShown = true;
        authenticationInProgress = true;

        Executor executor = ContextCompat.getMainExecutor(this);
        BiometricPrompt prompt = new BiometricPrompt(this, executor,
                new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                            super.onAuthenticationError(errorCode, errString);
                            authenticationInProgress = false;
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
                            authenticationInProgress = false;
                            waitForPageReady(() -> {
                                if (readAdminCredentials() == null) {
                                    revealWebView();
                                    Toast.makeText(MainActivity.this,
                                            "Ingresá una vez con email y contraseña para activar la huella.",
                                            Toast.LENGTH_LONG).show();
                                } else {
                                    continueWithExistingSession();
                                }
                            });
                            scheduleUpdateCheck(1500);
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

    private void waitForPageReady(Runnable action) {
        waitForPageReady(action, 0);
    }

    private void waitForPageReady(Runnable action, int attempt) {
        getBridge().getWebView().evaluateJavascript("document.readyState", state -> {
            if ("\"complete\"".equals(state)) {
                action.run();
            } else if (attempt < 50) {
                mainHandler.postDelayed(() -> waitForPageReady(action, attempt + 1), 100);
            }
        });
    }

    private void revealWebView() {
        getBridge().getWebView().setVisibility(View.VISIBLE);
        solicitarPermisoNotificaciones();
    }

    private void solicitarPermisoNotificaciones() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4101);
        }
    }

    private void registerPushToken() {
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
            String script = "fetch('/api/admin/push-token',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:" + JSONObject.quote(token) + "})})";
            getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(script, ignored -> { }));
        });
    }

    private void scheduleUpdateCheck(long delayMs) {
        if (updateCheckScheduled) return;
        updateCheckScheduled = true;
        new Handler(Looper.getMainLooper()).postDelayed(this::checkForUpdate, delayMs);
    }

    private void autoLoginWithStoredCredentials() {
        String[] credentials = readAdminCredentials();
        if (credentials == null) {
            revealWebView();
            return;
        }

        String script = "(async function(){await new Promise(resolve=>setTimeout(resolve,800));" +
                "const before=await fetch('/api/admin/yo',{credentials:'include'});" +
                "if(before.ok)return 'active';" +
                "const response=await fetch('/api/admin/login',{" +
                "method:'POST',credentials:'include',headers:{'Content-Type':'application/json'}," +
                "body:JSON.stringify({email:" + JSONObject.quote(credentials[0]) +
                ",password:" + JSONObject.quote(credentials[1]) + "})});" +
                "const session=await fetch('/api/admin/yo',{credentials:'include'});" +
                "return session.ok?'active':'inactive';})().catch(()=> 'inactive');";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(script, result -> {
            if ("\"active\"".equals(result)) {
                registerPushToken();
                getBridge().getWebView().reload();
                waitForPageReady(this::revealWebView);
            } else revealWebView();
        }));
    }

    private void continueWithExistingSession() {
        // La cookie del WebView puede restaurarse después de este callback. Como
        // el backend permite multisesión, el camino fiable es autenticar con la
        // credencial cifrada seleccionada y no depender de una cookie intermedia.
        autoLoginWithStoredCredentials();
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

    private void saveAdminCredentials(String adminId, String email, String nombre, String password) {
        try {
            if (adminId == null || adminId.trim().isEmpty()) return;
            SharedPreferences preferences = getSharedPreferences(CREDENTIALS_PREFS, MODE_PRIVATE);
            JSONArray credentials = readCredentialsArray(preferences);
            JSONObject replacement = new JSONObject();
            replacement.put("id", adminId.trim());
            replacement.put("email", email.trim().toLowerCase(java.util.Locale.ROOT));
            replacement.put("nombre", nombre == null ? "" : nombre.trim());
            replacement.put("password", encryptCredential(password));
            replacement.put("lastUsed", System.currentTimeMillis());
            JSONArray updated = new JSONArray();
            for (int index = 0; index < credentials.length(); index++) {
                JSONObject current = credentials.optJSONObject(index);
                if (current != null && adminId.trim().equals(current.optString("id"))) continue;
                if (current != null) updated.put(current);
            }
            updated.put(replacement);
            preferences.edit().putString(CREDENTIALS_LIST, updated.toString())
                    .putString(SELECTED_ADMIN_ID, adminId.trim()).remove("email").remove("password").apply();
        } catch (Exception error) {
            runOnUiThread(() -> Toast.makeText(this,
                    "No se pudo activar el acceso biométrico.", Toast.LENGTH_LONG).show());
        }
    }

    private JSONArray readCredentialsArray(SharedPreferences preferences) throws Exception {
        String stored = preferences.getString(CREDENTIALS_LIST, null);
        if (stored != null) return new JSONArray(stored);
        String legacyEmail = preferences.getString("email", null);
        String legacyPassword = preferences.getString("password", null);
        JSONArray migrated = new JSONArray();
        if (legacyEmail != null && legacyPassword != null) {
            String email = decryptCredential(legacyEmail).trim().toLowerCase(java.util.Locale.ROOT);
            JSONObject credential = new JSONObject();
            credential.put("id", "legacy:" + email);
            credential.put("email", email);
            credential.put("nombre", "");
            credential.put("password", decryptCredential(legacyPassword));
            credential.put("lastUsed", System.currentTimeMillis());
            migrated.put(credential);
            preferences.edit().putString(CREDENTIALS_LIST, migrated.toString())
                    .putString(SELECTED_ADMIN_ID, "legacy:" + email).remove("email").remove("password").apply();
        }
        return migrated;
    }

    private String[] readAdminCredentials() {
        try {
            SharedPreferences preferences = getSharedPreferences(CREDENTIALS_PREFS, MODE_PRIVATE);
            JSONArray credentials = readCredentialsArray(preferences);
            String selectedId = preferences.getString(SELECTED_ADMIN_ID, null);
            JSONObject selected = null;
            for (int index = 0; index < credentials.length(); index++) {
                JSONObject candidate = credentials.optJSONObject(index);
                if (candidate != null && selectedId != null && selectedId.equals(candidate.optString("id"))) {
                    selected = candidate;
                    break;
                }
            }
            if (selected == null) {
                for (int index = 0; index < credentials.length(); index++) {
                    JSONObject candidate = credentials.optJSONObject(index);
                    if (candidate != null && (selected == null
                            || candidate.optLong("lastUsed", 0) > selected.optLong("lastUsed", 0))) {
                        selected = candidate;
                    }
                }
            }
            if (selected == null) return null;
            preferences.edit().putString(SELECTED_ADMIN_ID, selected.optString("id")).apply();
            return new String[]{selected.optString("email"), decryptCredential(selected.getString("password"))};
        } catch (Exception error) {
            return null;
        }
    }

    private String listAdminCredentials() {
        try {
            JSONArray credentials = readCredentialsArray(getSharedPreferences(CREDENTIALS_PREFS, MODE_PRIVATE));
            JSONArray metadata = new JSONArray();
            for (int index = 0; index < credentials.length(); index++) {
                JSONObject credential = credentials.optJSONObject(index);
                if (credential == null) continue;
                JSONObject item = new JSONObject();
                item.put("id", credential.optString("id"));
                item.put("email", credential.optString("email"));
                item.put("nombre", credential.optString("nombre"));
                item.put("lastUsed", credential.optLong("lastUsed", 0));
                metadata.put(item);
            }
            return metadata.toString();
        } catch (Exception error) {
            return "[]";
        }
    }

    private void selectAdmin(String adminId) {
        if (adminId == null || adminId.trim().isEmpty()) return;
        String normalizedId = adminId.trim();
        try {
            SharedPreferences preferences = getSharedPreferences(CREDENTIALS_PREFS, MODE_PRIVATE);
            JSONArray credentials = readCredentialsArray(preferences);
            for (int index = 0; index < credentials.length(); index++) {
                JSONObject credential = credentials.optJSONObject(index);
                if (credential != null && normalizedId.equals(credential.optString("id"))) {
                    credential.put("lastUsed", System.currentTimeMillis());
                    preferences.edit().putString(SELECTED_ADMIN_ID, normalizedId)
                            .putString(CREDENTIALS_LIST, credentials.toString()).apply();
                    return;
                }
            }
        } catch (Exception ignored) {
            // Manual login remains available if a local entry is malformed.
        }
    }

    public final class AndroidBiometricBridge {
        @JavascriptInterface
        public void saveAdminCredentials(String adminId, String email, String nombre, String password) {
            if (adminId != null && !adminId.isEmpty() && email != null && !email.isEmpty()
                    && password != null && !password.isEmpty()) {
                MainActivity.this.saveAdminCredentials(adminId, email, nombre, password);
            }
        }

        @JavascriptInterface
        public String listAdminCredentials() {
            return MainActivity.this.listAdminCredentials();
        }

        @JavascriptInterface
        public void selectAdmin(String adminId) {
            MainActivity.this.selectAdmin(adminId);
        }

        @JavascriptInterface
        public void registerPushToken() {
            MainActivity.this.registerPushToken();
        }
    }

    private void checkForUpdate() {
        updateExecutor.execute(() -> {
            try {
                // Evita que WebView/proxies entreguen un manifiesto viejo y espera a
                // que termine la ventana biométrica antes de abrir un AlertDialog.
                String updateUrl = UPDATE_URL + "?t=" + System.currentTimeMillis();
                HttpURLConnection connection = (HttpURLConnection) new URL(updateUrl).openConnection();
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
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
            } catch (Exception error) {
                Log.w("GuacamayoAdmin", "No se pudo consultar actualizaciones (intento "
                        + updateCheckAttempts + ")", error);
                if (updateCheckAttempts++ < 1) {
                    updateCheckScheduled = false;
                    new Handler(Looper.getMainLooper()).postDelayed(
                            () -> { updateCheckScheduled = true; checkForUpdate(); }, 10000);
                }
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
