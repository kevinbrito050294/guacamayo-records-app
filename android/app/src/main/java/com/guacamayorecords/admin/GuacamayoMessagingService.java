package com.guacamayorecords.admin;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class GuacamayoMessagingService extends FirebaseMessagingService {
    public static final String CHANNEL_ID = "pedidos";
    private static final String TOKEN_PREFS = "admin_push";

    @Override
    public void onNewToken(@NonNull String token) {
        getSharedPreferences(TOKEN_PREFS, MODE_PRIVATE).edit().putString("token", token).apply();
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        RemoteMessage.Notification notification = message.getNotification();
        String title = notification != null && notification.getTitle() != null
                ? notification.getTitle() : "Nuevo pedido recibido";
        String body = notification != null && notification.getBody() != null
                ? notification.getBody() : "Revisá el panel de administración";
        mostrarNotificacion(title, body);
    }

    private void mostrarNotificacion(String title, String body) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Pedidos", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Avisos de nuevos pedidos");
            manager.createNotificationChannel(channel);
        }
        Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = intent == null ? null : PendingIntent.getActivity(
                this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);
        if (pendingIntent != null) builder.setContentIntent(pendingIntent);
        NotificationManagerCompat.from(this).notify((int) System.currentTimeMillis(), builder.build());
    }
}
