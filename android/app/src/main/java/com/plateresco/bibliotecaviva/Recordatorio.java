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
    /** Avisos con contexto que deja la pagina: prestamo por vencer, plan atrasado, interruptores y horario de silencio. */
    static void contexto(Context c, String json) { p(c).edit().putString("ctx", json).apply(); programar(c); }
    static int minutos(String hhmm, int def) { try { String[] x = hhmm.split(":"); return Integer.parseInt(x[0]) * 60 + Integer.parseInt(x[1]); } catch (Exception e) { return def; } }
    /** true si la hora (en minutos del dia) cae dentro del horario de silencio. */
    static boolean silencio(Context c, int min) {
        try {
            org.json.JSONObject s = new org.json.JSONObject(p(c).getString("ctx", "{}")).optJSONObject("silencio"); if (s == null) return false;
            int d = minutos(s.optString("d", "22:00"), 1320), h = minutos(s.optString("h", "08:00"), 480);
            return d > h ? (min >= d || min < h) : (min >= d && min < h);
        } catch (Exception e) { return false; }
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
        try {
            org.json.JSONObject sj = new org.json.JSONObject(sp.getString("ctx", "{}")).optJSONObject("silencio");
            if (sj != null && silencio(c, t.get(Calendar.HOUR_OF_DAY) * 60 + t.get(Calendar.MINUTE))) { int h = minutos(sj.optString("h", "08:00"), 480); t.set(Calendar.HOUR_OF_DAY, h / 60); t.set(Calendar.MINUTE, h % 60); }
        } catch (Exception ignored) { }
        if (!t.after(Calendar.getInstance())) t.add(Calendar.DAY_OF_YEAR, 1);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t.getTimeInMillis(), pend(c));
    }
    static void cancelar(Context c) { ((AlarmManager) c.getSystemService(Context.ALARM_SERVICE)).cancel(pend(c)); }

    static void mostrar(Context c) {
        String hoy = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        if (hoy.equals(p(c).getString("leido", ""))) return;          // ya leiste hoy: no molesta
        java.util.Calendar ahora = java.util.Calendar.getInstance();
        if (silencio(c, ahora.get(java.util.Calendar.HOUR_OF_DAY) * 60 + ahora.get(java.util.Calendar.MINUTE))) return;   // horario de silencio
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CANAL, "Recordatorio de lectura", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent abrir = PendingIntent.getActivity(c, 8, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CANAL) : new Notification.Builder(c);
        // Con los datos que la pagina dejo guardados: la racha, las paginas de hoy y el libro actual.
        org.json.JSONObject j = Widgets.datos(c);
        int racha = j.optInt("racha", 0), hoyP = j.optInt("hoy", 0), meta = j.optInt("meta", 20); String libro = j.optString("t", "");
        String titulo = racha >= 2 ? "Tu racha de " + racha + " días está en juego" : "¿Un rato de lectura?";
        int faltan = Math.max(1, meta - hoyP);
        String texto = !libro.isEmpty() ? "Te faltan " + faltan + " páginas de «" + libro + "». Con 10 minutos alcanza." : "Un ratito antes de que termine el día.";
        // Un solo aviso al dia: el mas importante entre prestamo por vencer, plan atrasado y la meta.
        String destino = "CONTINUAR";
        try {
            org.json.JSONObject cx = new org.json.JSONObject(p(c).getString("ctx", "{}")), on = cx.optJSONObject("on");
            org.json.JSONObject pr = cx.optJSONObject("prestamo"), pl = cx.optJSONObject("plan");
            if (pr != null && (on == null || on.optBoolean("prestamos", true))) { titulo = "Préstamo por vencer"; texto = pr.optString("txt", texto); destino = "PRESTAMOS"; }
            else if (pl != null && (on == null || on.optBoolean("plan", true))) { titulo = "Plan de lectura"; texto = pl.optString("txt", texto); destino = "PLAN"; }
            else if (on != null && !on.optBoolean("meta", true)) { titulo = "¿Un rato de lectura?"; texto = "Un ratito antes de que termine el día."; }
        } catch (Exception ignored) { }
        Intent continuar = new Intent(c, MainActivity.class).setAction("com.plateresco.bibliotecaviva." + destino).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pc = PendingIntent.getActivity(c, 9, continuar, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle(titulo).setContentText(texto).setStyle(new Notification.BigTextStyle().bigText(texto)).setContentIntent(pc).setAutoCancel(true);
        if (!libro.isEmpty()) b.addAction(android.R.drawable.ic_menu_view, "Abrir libro", pc);
        try { nm.notify(70, b.build()); } catch (SecurityException ignored) { }
    }
}
