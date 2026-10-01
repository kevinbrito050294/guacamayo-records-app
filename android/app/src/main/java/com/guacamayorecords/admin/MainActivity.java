package com.guacamayorecords.admin;

import android.app.AlertDialog;
import android.content.Intent;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Executor;

public class MainActivity extends BridgeActivity {
    private static final String UPDATE_URL =
            "https://www.guacamayorecords.com/android-update.json";
    private final ExecutorService updateExecutor = Executors.newSingleThreadExecutor();
    private boolean biometricPromptShown;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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

    /**
     * The WebView keeps the httpOnly admin cookie between launches. When there
     * is an existing session, require the device biometric/PIN before exposing
     * the panel again. A first install without a cookie still opens normally
     * so the administrator can perform the initial login.
     */
    private void checkBiometricUnlock() {
        if (biometricPromptShown) return;
        android.webkit.CookieManager cookies = android.webkit.CookieManager.getInstance();
        String siteCookies = cookies.getCookie("https://www.guacamayorecords.com");
        if (!cookies.hasCookies() && (siteCookies == null || siteCookies.isEmpty())) return;

        int authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG
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
