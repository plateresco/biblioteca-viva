package com.plateresco.bibliotecaviva;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/**
 * Mantiene viva la lectura en voz alta con la pantalla apagada: servicio en primer plano con una notificacion
 * de reproductor (anterior, pausa, siguiente, detener) y un bloqueo parcial para que el telefono no se duerma.
 */
public class LecturaService extends Service {
    static final int ID = 77;
    static final String CANAL = "lectura";
    static volatile boolean activo = false;
    private PowerManager.WakeLock wl;

    @Override public IBinder onBind(Intent i) { return null; }

    @Override public int onStartCommand(Intent i, int flags, int startId) {
        String t = i != null && i.getStringExtra("t") != null ? i.getStringExtra("t") : "";
        String f = i != null && i.getStringExtra("f") != null ? i.getStringExtra("f") : "";
        boolean pausa = i != null && i.getBooleanExtra("pausa", false);
        crearCanal(this);
        Notification n = construir(this, t, f, pausa);
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(ID, n);
        activo = true;
        if (wl == null) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null) { wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "bibliotecaviva:lectura"); wl.acquire(4 * 60 * 60 * 1000L); }
        }
        return START_NOT_STICKY;
    }

    @Override public void onDestroy() {
        activo = false;
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
        super.onDestroy();
    }

    static void crearCanal(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Lectura en voz alta", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Controles de la lectura en voz alta");
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
    }

    static PendingIntent accion(Context c, String a) {
        Intent i = new Intent(c, LecturaAccionReceiver.class).setAction("com.plateresco.bibliotecaviva.ACC_" + a).putExtra("a", a);
        return PendingIntent.getBroadcast(c, a.hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    @SuppressWarnings("deprecation")
    static Notification construir(Context c, String t, String f, boolean pausa) {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CANAL) : new Notification.Builder(c);
        PendingIntent abrir = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle(t.isEmpty() ? "Leyendo en voz alta" : t).setContentText(f)
                .setOngoing(true).setOnlyAlertOnce(true).setContentIntent(abrir).setCategory(Notification.CATEGORY_TRANSPORT);
        b.addAction(android.R.drawable.ic_media_previous, "Anterior", accion(c, "prev"));
        b.addAction(pausa ? android.R.drawable.ic_media_play : android.R.drawable.ic_media_pause, pausa ? "Seguir" : "Pausa", accion(c, "pausa"));
        b.addAction(android.R.drawable.ic_media_next, "Siguiente", accion(c, "next"));
        b.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Detener", accion(c, "stop"));
        b.setStyle(new Notification.MediaStyle().setShowActionsInCompactView(0, 1, 2));
        return b.build();
    }

    static void actualizar(Context c, String t, String f, boolean pausa) {
        try { ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(ID, construir(c, t, f, pausa)); } catch (Exception ignored) { }
    }
}
