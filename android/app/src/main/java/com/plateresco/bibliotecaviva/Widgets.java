package com.plateresco.bibliotecaviva;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** Widgets de la pantalla de inicio: el libro que lees y la racha de lectura. La pagina les envia los datos. */
final class Widgets {
    private Widgets() { }

    static void guardar(Context c, String json) {
        c.getSharedPreferences("widget", Context.MODE_PRIVATE).edit().putString("json", json).apply();
        refrescar(c);
    }

    static JSONObject datos(Context c) {
        try { return new JSONObject(c.getSharedPreferences("widget", Context.MODE_PRIVATE).getString("json", "{}")); }
        catch (Exception e) { return new JSONObject(); }
    }

    static void refrescar(Context c) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            for (int id : m.getAppWidgetIds(new ComponentName(c, ContinuarWidget.class))) m.updateAppWidget(id, continuar(c));
            for (int id : m.getAppWidgetIds(new ComponentName(c, RachaWidget.class))) m.updateAppWidget(id, racha(c));
            for (int id : m.getAppWidgetIds(new ComponentName(c, FraseWidget.class))) m.updateAppWidget(id, frase(c));
            for (int id : m.getAppWidgetIds(new ComponentName(c, MetaWidget.class))) m.updateAppWidget(id, meta(c));
        } catch (Exception ignored) { }
    }

    static PendingIntent abrir(Context c, String accion) {
        Intent i = new Intent(c, MainActivity.class).setAction("com.plateresco.bibliotecaviva." + accion).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, accion.hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static RemoteViews continuar(Context c) {
        JSONObject j = datos(c);
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_continuar);
        String t = j.optString("t", "");
        if (t.isEmpty()) {
            v.setTextViewText(R.id.w_titulo, "Sin libro en curso");
            v.setTextViewText(R.id.w_sub, "Abre la app y empieza uno");
            v.setProgressBar(R.id.w_prog, 100, 0, false);
        } else {
            v.setTextViewText(R.id.w_titulo, t);
            v.setTextViewText(R.id.w_sub, j.optString("a", "") + " · pág. " + j.optInt("r", 0) + " de " + j.optInt("p", 0));
            v.setProgressBar(R.id.w_prog, 100, j.optInt("pct", 0), false);
        }
        v.setOnClickPendingIntent(R.id.w_root, abrir(c, "CONTINUAR"));
        return v;
    }

    /** Anillo con las paginas de hoy contra la meta. */
    static RemoteViews meta(Context c) {
        JSONObject j = datos(c);
        int hoy = j.optInt("hoy", 0), meta = Math.max(1, j.optInt("meta", 20));
        int tam = 260; float g = 26f;
        android.graphics.Bitmap bm = android.graphics.Bitmap.createBitmap(tam, tam, android.graphics.Bitmap.Config.ARGB_8888);
        android.graphics.Canvas cv = new android.graphics.Canvas(bm);
        android.graphics.Paint p = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        p.setStyle(android.graphics.Paint.Style.STROKE); p.setStrokeWidth(g); p.setStrokeCap(android.graphics.Paint.Cap.ROUND);
        android.graphics.RectF r = new android.graphics.RectF(g, g, tam - g, tam - g);
        p.setColor(0xFF2C3A40); cv.drawArc(r, 0, 360, false, p);
        p.setColor(0xFF62B7AB); cv.drawArc(r, -90, 360f * Math.min(1f, hoy / (float) meta), false, p);
        android.graphics.Paint t = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        t.setColor(0xFFEDE6D6); t.setTextAlign(android.graphics.Paint.Align.CENTER); t.setTextSize(90f); t.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        cv.drawText(String.valueOf(hoy), tam / 2f, tam / 2f + 30f, t);
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_meta);
        v.setImageViewBitmap(R.id.w_anillo, bm);
        v.setTextViewText(R.id.w_meta_t, hoy >= meta ? "¡Meta cumplida!" : hoy + " de " + meta + " págs.");
        v.setOnClickPendingIntent(R.id.w_root3, abrir(c, "CONTINUAR"));
        return v;
    }

    static RemoteViews frase(Context c) {
        JSONObject j = datos(c);
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_frase);
        String f = j.optString("frase", "");
        v.setTextViewText(R.id.w_frase, f.isEmpty() ? "Subraya frases mientras lees y aparecerán aquí." : "“" + f + "”");
        v.setTextViewText(R.id.w_frase_l, j.optString("fraseLibro", ""));
        v.setOnClickPendingIntent(R.id.w_root3, abrir(c, "CONTINUAR"));
        return v;
    }

    static RemoteViews racha(Context c) {
        JSONObject j = datos(c);
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_racha);
        int n = j.optInt("racha", 0);
        v.setTextViewText(R.id.w_racha, String.valueOf(n));
        v.setTextViewText(R.id.w_racha_l, n == 1 ? "día seguido" : "días seguidos");
        StringBuilder sb = new StringBuilder();
        JSONArray s = j.optJSONArray("semana");
        for (int k = 0; k < 7; k++) sb.append(s != null && s.optInt(k, 0) == 1 ? "● " : "○ ");
        v.setTextViewText(R.id.w_semana, sb.toString().trim());
        v.setTextViewText(R.id.w_hoy, j.optInt("hoy", 0) + " de " + j.optInt("meta", 20) + " págs. hoy");
        v.setOnClickPendingIntent(R.id.w_root2, abrir(c, "CONTINUAR"));
        return v;
    }
}
