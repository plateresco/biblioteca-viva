package com.plateresco.bibliotecaviva;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/** Recordatorio diario de lectura que suena aunque la app este cerrada, y se calla si ese dia ya leiste. */
final class Recordatorio {
    static final String CANAL = "recordatorio";
    private Recordatorio() { }

    static SharedPreferences p(Context c) { return c.getSharedPreferences("recordatorio", Context.MODE_PRIVATE); }

    static void configurar(Context c, boolean on, int h, int m) {
        p(c).edit().putBoolean("on", on).putInt("h", h).putInt("m", m).apply();
        if (on) programar(c); else cancelar(c);
    }
    static void leidoHoy(Context c, String iso) { p(c).edit().putString("leido", iso).apply(); }

    static PendingIntent pend(Context c) {
        return PendingIntent.getBroadcast(c, 7, new Intent(c, RecordatorioReceiver.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
    static void programar(Context c) {
        SharedPreferences sp = p(c);
        if (!sp.getBoolean("on", false)) return;
        Calendar t = Calendar.getInstance();
        t.set(Calendar.HOUR_OF_DAY, sp.getInt("h", 21)); t.set(Calendar.MINUTE, sp.getInt("m", 30)); t.set(Calendar.SECOND, 0); t.set(Calendar.MILLISECOND, 0);
        if (!t.after(Calendar.getInstance())) t.add(Calendar.DAY_OF_YEAR, 1);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t.getTimeInMillis(), pend(c));
    }
    static void cancelar(Context c) { ((AlarmManager) c.getSystemService(Context.ALARM_SERVICE)).cancel(pend(c)); }

    static void mostrar(Context c) {
        String hoy = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        if (hoy.equals(p(c).getString("leido", ""))) return;          // ya leiste hoy: no molesta
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CANAL, "Recordatorio de lectura", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent abrir = PendingIntent.getActivity(c, 8, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CANAL) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle("¿Un rato de lectura?").setContentText("Un ratito antes de que termine el día.").setContentIntent(abrir).setAutoCancel(true);
        try { nm.notify(70, b.build()); } catch (SecurityException ignored) { }
    }
}
