package com.plateresco.bibliotecaviva;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.util.Base64;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Mi Biblioteca Viva como app de Android: lleva la biblioteca (la misma web) adentro, asi abre al instante y sin internet,
 * y suma lo que una pagina no puede: sesion de Google duradera, escaner de ISBN, recordatorios con la app cerrada,
 * abrir EPUB desde otras apps, boton Atras, vibraciones y barras del sistema del color de la sala.
 */
public class MainActivity extends Activity {
    static final String DOMINIO = "appassets.androidplatform.net";
    static final String INICIO = "https://" + DOMINIO + "/assets/index.html";
    static final int REQ_ARCHIVO = 41, REQ_NOTIF = 42;

    static MainActivity instancia;
    VozNeuronal neural;
    VozNeuronal vn() { if (neural == null) neural = new VozNeuronal(this, c -> js(c)); return neural; }
    static final int REQ_FOTO = 44, REQ_DICTADO = 45, REQ_MIC = 46;
    android.webkit.PermissionRequest micPendiente;
    Uri fotoUri;
    String pendienteAtajo = null, pendienteTexto = null;
    boolean volumenPagina = false;
    boolean dndPrevio = false; int filtroPrevio = -1;
    WebView web;
    android.speech.tts.TextToSpeech voz; boolean vozLista = false;
    ValueCallback<Uri[]> chooserCb;
    boolean paginaLista = false;
    String pendienteArchivo = null;   // "url|nombre" de un EPUB recibido antes de que la web terminara de cargar

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        instancia = this;
        web = new WebView(this);
        web.setBackgroundColor(0xFF16262A);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        if (Build.VERSION.SDK_INT >= 29) s.setForceDark(WebSettings.FORCE_DARK_OFF);   // la app trae sus propios temas; Android no debe oscurecerla por su cuenta
        s.setTextZoom(100);             // la app tiene su propio tamaño de texto; el del sistema desacomodaria los lomos
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // La carpeta de EPUB recibidos debe ser una subcarpeta de la cache (la cache misma no se permite).
        File entrada = new File(getCacheDir(), "entrada"); entrada.mkdirs();
        WebViewAssetLoader.Builder lb = new WebViewAssetLoader.Builder()
                .setDomain(DOMINIO)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this));
        try { lb.addPathHandler("/cache/entrada/", new WebViewAssetLoader.InternalStoragePathHandler(this, entrada)); }
        catch (Exception e) { /* sin esta ruta solo falla abrir EPUB desde otras apps */ }
        final WebViewAssetLoader loader = lb.build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return loader.shouldInterceptRequest(r.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (DOMINIO.equals(u.getHost())) return false;
                abrirExterno(u.toString());
                return true;
            }
            @Override public void onPageFinished(WebView v, String url) {
                paginaLista = true;
                if (pendienteTexto != null) { String t = pendienteTexto; pendienteTexto = null; js("setTimeout(function(){window.__compartirTexto&&window.__compartirTexto(" + q(t) + ")},1200)"); }
                if (pendienteAtajo != null) { String a = pendienteAtajo; pendienteAtajo = null; atajo(a); }
                if (pendienteArchivo != null) { String[] p = pendienteArchivo.split("\\|", 2); pendienteArchivo = null; entregarArchivo(p[0], p[1]); }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(final android.webkit.PermissionRequest req) {
                runOnUiThread(() -> {
                    boolean mic = false; for (String r : req.getResources()) if (android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) mic = true;
                    if (!mic) { req.deny(); return; }
                    if (Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { req.grant(new String[]{android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE}); }
                    else { micPendiente = req; requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC); }
                });
            }
            @Override public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (chooserCb != null) chooserCb.onReceiveValue(null);
                chooserCb = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try { startActivityForResult(Intent.createChooser(i, "Elegir archivo"), REQ_ARCHIVO); return true; }
                catch (Exception e) { chooserCb = null; return false; }
            }
        });
        try {
            voz = new android.speech.tts.TextToSpeech(this, st -> {
                vozLista = st == android.speech.tts.TextToSpeech.SUCCESS;
                if (vozLista) voz.setOnUtteranceProgressListener(new android.speech.tts.UtteranceProgressListener() {
                    @Override public void onStart(String id) { }
                    @Override public void onDone(String id) { js("window.__ttsFin&&window.__ttsFin(" + q(id) + ",1)"); }
                    @Override public void onError(String id) { js("window.__ttsFin&&window.__ttsFin(" + q(id) + ",0)"); }
                    @Override public void onStop(String id, boolean interrumpido) { js("window.__ttsFin&&window.__ttsFin(" + q(id) + ",2)"); }
                });
            });
        } catch (Exception e) { voz = null; }
        web.addJavascriptInterface(new Puente(), "AndroidApp");
        web.loadUrl(INICIO);
        manejarIntent(getIntent());
    }

    @Override protected void onDestroy() { if (instancia == this) instancia = null; try { if (neural != null) neural.cerrar(); } catch (Throwable ignored) { } try { if (voz != null) { voz.stop(); voz.shutdown(); } } catch (Exception ignored) { } super.onDestroy(); }

    // Con el lector abierto, las teclas de volumen pasan la pagina (si el usuario lo activo)
    @Override public boolean onKeyDown(int k, android.view.KeyEvent e) {
        if (volumenPagina && (k == android.view.KeyEvent.KEYCODE_VOLUME_UP || k == android.view.KeyEvent.KEYCODE_VOLUME_DOWN)) {
            js("window.__volumen&&window.__volumen('" + (k == android.view.KeyEvent.KEYCODE_VOLUME_UP ? "up" : "down") + "')"); return true;
        }
        return super.onKeyDown(k, e);
    }
    @Override public boolean onKeyUp(int k, android.view.KeyEvent e) {
        if (volumenPagina && (k == android.view.KeyEvent.KEYCODE_VOLUME_UP || k == android.view.KeyEvent.KEYCODE_VOLUME_DOWN)) return true;
        return super.onKeyUp(k, e);
    }

    @Override protected void onNewIntent(Intent i) { super.onNewIntent(i); setIntent(i); manejarIntent(i); }

    void googleListo() { js("window.__googleListo&&window.__googleListo()"); }
    void googleError(String m) { js("window.__googleError&&window.__googleError(" + q(m) + ")"); }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_DICTADO) {
            if (res == RESULT_OK && data != null) { java.util.ArrayList<String> l = data.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS); if (l != null && !l.isEmpty()) { js("window.__dictado&&window.__dictado(" + q(l.get(0)) + ")"); return; } }
            js("window.__dictado&&window.__dictado('')"); return;
        }
        if (req == REQ_FOTO) {
            if (res != RESULT_OK || fotoUri == null) { js("window.__ocrError&&window.__ocrError('Cancelaste la foto.')"); return; }
            try {
                com.google.mlkit.vision.common.InputImage img = com.google.mlkit.vision.common.InputImage.fromFilePath(this, fotoUri);
                com.google.mlkit.vision.text.TextRecognition.getClient(com.google.mlkit.vision.text.latin.TextRecognizerOptions.DEFAULT_OPTIONS).process(img)
                        .addOnSuccessListener(t -> { String x = t.getText(); if (x == null || x.trim().isEmpty()) js("window.__ocrError&&window.__ocrError('No encontre texto en la foto. Prueba con mas luz y la pagina derecha.')"); else js("window.__ocrTexto&&window.__ocrTexto(" + q(x) + ")"); })
                        .addOnFailureListener(e -> js("window.__ocrError&&window.__ocrError('No pude leer la pagina.')"));
            } catch (Exception e) { js("window.__ocrError&&window.__ocrError('No pude abrir la foto.')"); }
            return;
        }
        if (req == AuthGoogle.REQ) {
            if (res != RESULT_OK || data == null) { googleError("Cancelaste el inicio de sesion."); return; }
            try {
                AuthGoogle.guardar(this, com.google.android.gms.auth.api.identity.Identity.getAuthorizationClient(this).getAuthorizationResultFromIntent(data));
                googleListo();
            } catch (Exception e) { googleError(String.valueOf(e.getMessage())); }
            return;
        }
        if (req == REQ_ARCHIVO && chooserCb != null) {
            Uri[] out = null;
            if (res == RESULT_OK && data != null) {
                ClipData cd = data.getClipData();
                if (cd != null) { out = new Uri[cd.getItemCount()]; for (int k = 0; k < out.length; k++) out[k] = cd.getItemAt(k).getUri(); }
                else if (data.getData() != null) out = new Uri[]{data.getData()};
            }
            chooserCb.onReceiveValue(out);
            chooserCb = null;
        }
    }

    // Boton Atras: primero la web cierra lo que tenga abierto (hoja, escena, lector...); si no hay nada, la app pasa a segundo plano.
    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){try{return window.__atras&&window.__atras()?1:0}catch(e){return 0}})()", v -> {
            if (!"1".equals(v)) moveTaskToBack(true);
        });
    }

    void js(final String code) { runOnUiThread(() -> web.evaluateJavascript(code, null)); }
    static String q(String s) { return JSONObject.quote(s == null ? "" : s); }
    void abrirExterno(String url) { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { } }
    void aviso(String t) { runOnUiThread(() -> Toast.makeText(this, t, Toast.LENGTH_LONG).show()); }

    /* ---------- Intents: regreso de Google y EPUB recibidos ---------- */
    void manejarIntent(Intent i) {
        if (i == null) return;
        Uri d = i.getData(), st = i.getParcelableExtra(Intent.EXTRA_STREAM);
        String act = i.getAction();
        if (act != null && act.startsWith("com.plateresco.bibliotecaviva.") && !act.endsWith(".ACC_stop")) {
            String a = act.substring(act.lastIndexOf('.') + 1).toLowerCase();
            if (paginaLista) atajo(a); else pendienteAtajo = a;
            return;
        }
        if (Intent.ACTION_SEND.equals(act) && st == null && i.getStringExtra(Intent.EXTRA_TEXT) != null) {     // texto de otra app: se guarda como frase
            final String t = i.getStringExtra(Intent.EXTRA_TEXT);
            if (paginaLista) js("setTimeout(function(){window.__compartirTexto&&window.__compartirTexto(" + q(t) + ")},600)"); else pendienteTexto = t;
            return;
        }
        Uri archivo = Intent.ACTION_SEND.equals(act) ? st : (Intent.ACTION_VIEW.equals(act) ? d : null);
        if (archivo != null) {
            final Uri f = archivo;
            new Thread(() -> {
                try {
                    String nombre = nombreDe(f);
                    File dir = new File(getCacheDir(), "entrada"); dir.mkdirs();
                    File dest = new File(dir, System.currentTimeMillis() + "-" + nombre.replaceAll("[^A-Za-z0-9._-]", "_"));
                    try (InputStream in = getContentResolver().openInputStream(f); OutputStream out = new FileOutputStream(dest)) {
                        byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    }
                    String url = "https://" + DOMINIO + "/cache/entrada/" + Uri.encode(dest.getName());
                    if (paginaLista) entregarArchivo(url, nombre); else pendienteArchivo = url + "|" + nombre;
                } catch (Exception e) { aviso("No pude abrir ese archivo."); }
            }).start();
        }
    }
    // Atajos del icono y botones de los widgets: la web ya sabe que hacer con cada uno.
    void atajo(String a) { js("setTimeout(function(){window.__atajo&&window.__atajo(" + q(a) + ")},900)"); }

    static boolean hostPermitido(String u) {
        try {
            URL url = new URL(u); String h = url.getHost().toLowerCase(), pr = url.getProtocol();
            if (!"https".equals(pr) && !"http".equals(pr)) return false;
            boolean local = h.equals("localhost") || h.endsWith(".local") || h.matches("10\\.\\d+\\.\\d+\\.\\d+") || h.matches("192\\.168\\.\\d+\\.\\d+") || h.matches("172\\.(1[6-9]|2\\d|3[01])\\.\\d+\\.\\d+");
            if (local) return true;      // catalogos propios en la red de la casa (Calibre, etc.)
            if (!"https".equals(pr)) return false;
            return h.equals("gutenberg.org") || h.endsWith(".gutenberg.org") || h.equals("archive.org") || h.endsWith(".archive.org") || h.equals("standardebooks.org") || h.endsWith(".standardebooks.org") || h.equals("feedbooks.com") || h.endsWith(".feedbooks.com");
        } catch (Exception e) { return false; }
    }

    String nombreDe(Uri u) {
        String n = "libro.epub";
        try (Cursor c = getContentResolver().query(u, null, null, null, null)) {
            if (c != null && c.moveToFirst()) { int k = c.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (k >= 0) n = c.getString(k); }
        } catch (Exception ignored) { }
        return n;
    }
    void entregarArchivo(String url, String nombre) { js("window.__abrirArchivo&&window.__abrirArchivo(" + q(url) + "," + q(nombre) + ")"); }

    @Override public void onRequestPermissionsResult(int r, String[] p, int[] g) {
        super.onRequestPermissionsResult(r, p, g);
        if (r == REQ_MIC && micPendiente != null) {
            if (g.length > 0 && g[0] == PackageManager.PERMISSION_GRANTED) micPendiente.grant(new String[]{android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE}); else micPendiente.deny();
            micPendiente = null;
        }
    }

    /* ---------- Lo que la web puede pedirle a Android ---------- */
    class Puente {
        @JavascriptInterface public boolean esApp() { return true; }
        @JavascriptInterface public int versionCode() {
            try { return (int) (Build.VERSION.SDK_INT >= 28 ? getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode() : getPackageManager().getPackageInfo(getPackageName(), 0).versionCode); }
            catch (Exception e) { return 0; }
        }
        @JavascriptInterface public String versionName() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
        }
        @JavascriptInterface public void haptico(final String tipo) {
            runOnUiThread(() -> {
                int c = "pesado".equals(tipo) ? HapticFeedbackConstants.LONG_PRESS
                        : "exito".equals(tipo) ? (Build.VERSION.SDK_INT >= 30 ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.LONG_PRESS)
                        : HapticFeedbackConstants.CLOCK_TICK;
                web.performHapticFeedback(c);
            });
        }
        // Barras del sistema del mismo color que la sala; iconos claros u oscuros segun el tema.
        // arriba = color de la barra de estado; abajo = color de la barra de navegación; los iconos se eligen por separado según el brillo de cada color.
        @JavascriptInterface public void barras(final String arribaHex, final String abajoHex, final boolean arribaOscuro, final boolean abajoOscuro) {
            runOnUiThread(() -> {
                try {
                    int a = Color.parseColor(arribaHex), z = Color.parseColor(abajoHex);
                    Window w = getWindow();
                    w.setStatusBarColor(a); w.setNavigationBarColor(z); web.setBackgroundColor(a);
                    w.getDecorView().setBackgroundColor(a);
                    View d = w.getDecorView(); int f = d.getSystemUiVisibility();
                    int luzSt = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR, luzNav = Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0;
                    if (arribaOscuro) f &= ~luzSt; else f |= luzSt;
                    if (abajoOscuro) f &= ~luzNav; else f |= luzNav;
                    d.setSystemUiVisibility(f);
                } catch (Exception ignored) { }
            });
        }
        /* Voz de Android (Google): mucho mas natural que la del navegador y funciona con las voces de alta calidad */
        @JavascriptInterface public boolean ttsDisponible() { return voz != null && vozLista; }
        @JavascriptInterface public String ttsVoces() {
            try {
                org.json.JSONArray a = new org.json.JSONArray();
                if (voz == null || !vozLista || voz.getVoices() == null) return "[]";
                for (android.speech.tts.Voice v : voz.getVoices()) {
                    if (!"es".equals(v.getLocale().getLanguage())) continue;
                    JSONObject o = new JSONObject();
                    o.put("name", v.getName()); o.put("lang", v.getLocale().toLanguageTag());
                    o.put("net", v.isNetworkConnectionRequired()); o.put("q", v.getQuality());
                    a.put(o);
                }
                return a.toString();
            } catch (Exception e) { return "[]"; }
        }
        @JavascriptInterface public void ttsHablar(final String id, final String texto, final String vozNombre, final float velocidad) {
            runOnUiThread(() -> {
                try {
                    if (voz == null || !vozLista) { js("window.__ttsFin&&window.__ttsFin(" + q(id) + ",0)"); return; }
                    if (vozNombre != null && !vozNombre.isEmpty()) for (android.speech.tts.Voice v : voz.getVoices()) if (v.getName().equals(vozNombre)) { voz.setVoice(v); break; }
                    voz.setSpeechRate(velocidad > 0 ? velocidad : 1f);
                    String t = texto.length() > 3900 ? texto.substring(0, 3900) : texto;
                    voz.speak(t, android.speech.tts.TextToSpeech.QUEUE_FLUSH, null, id);
                } catch (Exception e) { js("window.__ttsFin&&window.__ttsFin(" + q(id) + ",0)"); }
            });
        }
        @JavascriptInterface public void ttsParar() { runOnUiThread(() -> { try { if (voz != null) voz.stop(); } catch (Exception ignored) { } }); }
        /* Voz neuronal sin conexion (Piper): se descarga una vez y funciona sin internet */
        @JavascriptInterface public String neuralCatalogo() { try { return vn().catalogo(); } catch (Throwable e) { return "[]"; } }
        @JavascriptInterface public boolean neuralLista(String id) { try { return vn().lista(id); } catch (Throwable e) { return false; } }
        @JavascriptInterface public void neuralDescargar(String id) { try { vn().descargar(id); } catch (Throwable e) { js("window.__vozError&&window.__vozError(" + q(id) + "," + q("Esta version no incluye la voz neuronal.") + ")"); } }
        @JavascriptInterface public void neuralBorrar(String id) { try { vn().quitar(id); } catch (Throwable ignored) { } }
        @JavascriptInterface public void neuralHablar(String idUtt, String voz, String texto, String sig, float vel) {
            try { vn().hablar(idUtt, voz, texto, sig, vel); } catch (Throwable e) { js("window.__ttsFin&&window.__ttsFin(" + q(idUtt) + ",0)"); }
        }
        @JavascriptInterface public void neuralParar() { try { if (neural != null) neural.parar(); } catch (Throwable ignored) { } }

        /* Lectura en voz alta con la pantalla apagada: notificacion de reproductor */
        @JavascriptInterface public void lecturaEstado(final boolean on, final boolean pausa, final String titulo, final String frase) {
            runOnUiThread(() -> {
                try {
                    if (on) {
                        if (!LecturaService.activo) {
                            Intent i = new Intent(MainActivity.this, LecturaService.class).putExtra("t", titulo).putExtra("f", frase).putExtra("pausa", pausa);
                            if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
                            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
                        } else LecturaService.actualizar(MainActivity.this, titulo, frase, pausa);
                    } else if (LecturaService.activo) {
                        stopService(new Intent(MainActivity.this, LecturaService.class));
                    }
                } catch (Exception ignored) { }
            });
        }

        /* No molestar mientras lees: silencia los avisos y los devuelve al salir (pide un permiso especial la primera vez) */
        @JavascriptInterface public boolean noMolestar(final boolean on) {
            try {
                android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (!nm.isNotificationPolicyAccessGranted()) {
                    runOnUiThread(() -> { Intent i = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); });
                    return false;
                }
                if (on) { if (filtroPrevio < 0) filtroPrevio = nm.getCurrentInterruptionFilter(); nm.setInterruptionFilter(android.app.NotificationManager.INTERRUPTION_FILTER_PRIORITY); }
                else if (filtroPrevio >= 0) { nm.setInterruptionFilter(filtroPrevio); filtroPrevio = -1; }
                return true;
            } catch (Throwable e) { return false; }
        }
        @JavascriptInterface public boolean noMolestarPermitido() {
            try { return ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE)).isNotificationPolicyAccessGranted(); } catch (Throwable e) { return false; }
        }

        /* Catalogo de clasicos gratis: la app consulta y baja desde sitios de libros de dominio publico (el navegador no puede por CORS) */
        @JavascriptInterface public void httpGet(final String id, final String url) {
            new Thread(() -> {
                try {
                    if (!hostPermitido(url)) throw new Exception("Sitio no permitido");
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setInstanceFollowRedirects(true); c.setConnectTimeout(15000); c.setReadTimeout(25000);
                    c.setRequestProperty("User-Agent", "MiBiblioteca/1.0 (app de lectura personal)");
                    int st = c.getResponseCode();
                    StringBuilder sb = new StringBuilder();
                    try (InputStream in = st >= 400 ? c.getErrorStream() : c.getInputStream()) {
                        if (in != null) { byte[] buf = new byte[16384]; int n; while ((n = in.read(buf)) > 0 && sb.length() < 3000000) sb.append(new String(buf, 0, n, "UTF-8")); }
                    }
                    js("window.__httpRes&&window.__httpRes(" + q(id) + "," + st + "," + q(sb.toString()) + ")");
                } catch (Exception e) { js("window.__httpRes&&window.__httpRes(" + q(id) + ",0,'')"); }
            }).start();
        }
        @JavascriptInterface public void descargarEpub(final String url, final String nombre) {
            new Thread(() -> {
                try {
                    if (!hostPermitido(url)) throw new Exception("Sitio no permitido");
                    File dir = new File(getCacheDir(), "entrada"); dir.mkdirs();
                    String limpio = nombre.replaceAll("[^A-Za-z0-9._-]", "_");
                    File dest = new File(dir, System.currentTimeMillis() + "-" + limpio);
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setInstanceFollowRedirects(true); c.setConnectTimeout(20000); c.setReadTimeout(60000);
                    c.setRequestProperty("User-Agent", "MiBiblioteca/1.0 (app de lectura personal)");
                    if (c.getResponseCode() >= 400) throw new Exception("Respuesta " + c.getResponseCode());
                    try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(dest)) { byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) > 0) out.write(buf, 0, n); }
                    if (dest.length() < 2000) throw new Exception("Archivo vacio");
                    js("window.__descargaOk&&window.__descargaOk()");
                    entregarArchivo("https://" + DOMINIO + "/cache/entrada/" + Uri.encode(dest.getName()), limpio);
                } catch (Exception e) { js("window.__descargaError&&window.__descargaError(" + q("No se pudo bajar el libro. Revisa tu conexión.") + ")"); }
            }).start();
        }

        /* Huella para el bloqueo de la app (Android 9 o mas) */
        @JavascriptInterface public boolean biometriaDisponible() { return Build.VERSION.SDK_INT >= 28 && getPackageManager().hasSystemFeature(PackageManager.FEATURE_FINGERPRINT); }
        @JavascriptInterface public void biometria() {
            runOnUiThread(() -> {
                try {
                    if (Build.VERSION.SDK_INT < 28) { js("window.__bioError&&window.__bioError()"); return; }
                    android.hardware.biometrics.BiometricPrompt bp = new android.hardware.biometrics.BiometricPrompt.Builder(MainActivity.this)
                            .setTitle("Mi Biblioteca").setNegativeButton("Usar PIN", getMainExecutor(), (d, w) -> js("window.__bioError&&window.__bioError()")).build();
                    bp.authenticate(new android.os.CancellationSignal(), getMainExecutor(), new android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
                        @Override public void onAuthenticationSucceeded(android.hardware.biometrics.BiometricPrompt.AuthenticationResult r) { js("window.__bioOk&&window.__bioOk()"); }
                        @Override public void onAuthenticationError(int c, CharSequence m) { js("window.__bioError&&window.__bioError()"); }
                    });
                } catch (Throwable e) { js("window.__bioError&&window.__bioError()"); }
            });
        }

        @JavascriptInterface public void teclasVolumen(boolean on) { volumenPagina = on; }
        @JavascriptInterface public void pantallaEncendida(final boolean on) {
            runOnUiThread(() -> { if (on) getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); else getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); });
        }

        /* Widgets de la pantalla de inicio */
        @JavascriptInterface public void widgets(String json) { Widgets.guardar(MainActivity.this, json); }

        /* Escanear una pagina de un libro de papel: foto con la camara y reconocimiento de texto en el telefono */
        @JavascriptInterface public void escanearPagina() {
            runOnUiThread(() -> {
                try {
                    File dir = new File(getCacheDir(), "capturas"); dir.mkdirs();
                    File f = new File(dir, "pagina-" + System.currentTimeMillis() + ".jpg");
                    fotoUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", f);
                    Intent i = new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).putExtra(android.provider.MediaStore.EXTRA_OUTPUT, fotoUri)
                            .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivityForResult(i, REQ_FOTO);
                } catch (Exception e) { js("window.__ocrError&&window.__ocrError('No pude abrir la camara.')"); }
            });
        }

        @JavascriptInterface public void abrirExterno(String url) { MainActivity.this.abrirExterno(url); }

        /* Escaner de ISBN de Google (no necesita permiso de camara) */
        @JavascriptInterface public void escanearIsbn() {
            runOnUiThread(() -> {
                GmsBarcodeScannerOptions op = new GmsBarcodeScannerOptions.Builder()
                        .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A).build();
                GmsBarcodeScanning.getClient(MainActivity.this, op).startScan()
                        .addOnSuccessListener(b -> js("window.__isbnEscaneado&&window.__isbnEscaneado(" + q(b.getRawValue()) + ")"))
                        .addOnCanceledListener(() -> js("window.__isbnCancelado&&window.__isbnCancelado()"))
                        .addOnFailureListener(e -> js("window.__isbnError&&window.__isbnError(" + q(String.valueOf(e.getMessage())) + ")"));
            });
        }

        /* Fondo de pantalla (inicio, bloqueo o ambos) con una imagen que dibuja la web */
        @JavascriptInterface public void ponerFondo(final String b64, final String donde) {
            new Thread(() -> {
                try {
                    byte[] d = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
                    android.graphics.Bitmap bm = android.graphics.BitmapFactory.decodeByteArray(d, 0, d.length);
                    android.app.WallpaperManager wm = android.app.WallpaperManager.getInstance(MainActivity.this);
                    int f = "bloqueo".equals(donde) ? android.app.WallpaperManager.FLAG_LOCK : "inicio".equals(donde) ? android.app.WallpaperManager.FLAG_SYSTEM : (android.app.WallpaperManager.FLAG_SYSTEM | android.app.WallpaperManager.FLAG_LOCK);
                    wm.setBitmap(bm, null, true, f);
                    js("window.__fondoOk&&window.__fondoOk()");
                } catch (Throwable e) { js("window.__fondoError&&window.__fondoError()"); }
            }).start();
        }

        /* Lector de codigos QR de Google (no necesita permiso de camara) */
        @JavascriptInterface public void escanearQr() {
            runOnUiThread(() -> {
                GmsBarcodeScannerOptions op = new GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build();
                GmsBarcodeScanning.getClient(MainActivity.this, op).startScan()
                        .addOnSuccessListener(b -> js("window.__qrEscaneado&&window.__qrEscaneado(" + q(b.getRawValue()) + ")"))
                        .addOnCanceledListener(() -> js("window.__qrEscaneado&&window.__qrEscaneado('')"))
                        .addOnFailureListener(e -> js("window.__qrEscaneado&&window.__qrEscaneado('')"));
            });
        }

        /* Dictado: el reconocedor de voz del sistema devuelve el texto */
        @JavascriptInterface public void dictar() {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                            .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "es-ES").putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, "Dicta tu nota");
                    startActivityForResult(i, REQ_DICTADO);
                } catch (Exception e) { js("window.__dictado&&window.__dictado('')"); }
            });
        }

        /* Traductor sin conexion de Google (ML Kit): se baja el idioma una vez y despues traduce en el telefono */
        @JavascriptInterface public void traducir(final String id, final String texto, final String de) {
            runOnUiThread(() -> {
                try {
                    String src = com.google.mlkit.nl.translate.TranslateLanguage.fromLanguageTag(de);
                    if (src == null) { js("window.__trad&&window.__trad(" + q(id) + ",0," + q("Idioma no disponible") + ")"); return; }
                    final com.google.mlkit.nl.translate.Translator t = com.google.mlkit.nl.translate.Translation.getClient(new com.google.mlkit.nl.translate.TranslatorOptions.Builder()
                            .setSourceLanguage(src).setTargetLanguage(com.google.mlkit.nl.translate.TranslateLanguage.SPANISH).build());
                    t.downloadModelIfNeeded()
                            .addOnSuccessListener(v -> t.translate(texto)
                                    .addOnSuccessListener(r -> js("window.__trad&&window.__trad(" + q(id) + ",1," + q(r) + ")"))
                                    .addOnFailureListener(e -> js("window.__trad&&window.__trad(" + q(id) + ",0," + q("No pude traducir.") + ")")))
                            .addOnFailureListener(e -> js("window.__trad&&window.__trad(" + q(id) + ",0," + q("Necesito conexion la primera vez para bajar el idioma.") + ")"));
                } catch (Throwable e) { js("window.__trad&&window.__trad(" + q(id) + ",0," + q("No pude traducir.") + ")"); }
            });
        }

        /* Sesion de Google que no caduca (guarda un token de renovacion en el telefono) */
        @JavascriptInterface public boolean sesionGoogle() { return AuthGoogle.hayRefresh(MainActivity.this); }
        @JavascriptInterface public boolean googleDisponible() { return !BuildConfig.GOOGLE_CLIENT_ID.isEmpty(); }
        @JavascriptInterface public void iniciarSesionGoogle() { runOnUiThread(() -> AuthGoogle.iniciar(MainActivity.this)); }
        @JavascriptInterface public void cerrarSesionGoogle() { AuthGoogle.cerrar(MainActivity.this); }
        @JavascriptInterface public void tokenGoogle(final String cb) {
            new Thread(() -> {
                try { String t = AuthGoogle.tokenAcceso(MainActivity.this); js("window.__gtoken&&window.__gtoken(" + q(cb) + "," + q(t) + ",'')"); }
                catch (Exception e) { js("window.__gtoken&&window.__gtoken(" + q(cb) + ",''," + q(String.valueOf(e.getMessage())) + ")"); }
            }).start();
        }

        /* Recordatorio diario */
        @JavascriptInterface public void programarRecordatorio(boolean on, int hora, int minuto) { Recordatorio.configurar(MainActivity.this, on, hora, minuto); }
        @JavascriptInterface public void avisos(String json) { Recordatorio.contexto(MainActivity.this, json); }
        @JavascriptInterface public void marcarLeidoHoy(String iso) { Recordatorio.leidoHoy(MainActivity.this, iso); }
        @JavascriptInterface public void pedirPermisoNotificaciones() {
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF));
        }

        /* Archivos: guardar en Descargas y compartir imagenes con la hoja de Android */
        @JavascriptInterface public void guardarArchivo(final String nombre, final String mime, final String b64) {
            new Thread(() -> {
                try {
                    byte[] datos = Base64.decode(b64, Base64.DEFAULT);
                    if (Build.VERSION.SDK_INT >= 29) {
                        ContentValues cv = new ContentValues();
                        cv.put(MediaStore.Downloads.DISPLAY_NAME, nombre); cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                        cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                        Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                        try (OutputStream out = getContentResolver().openOutputStream(u)) { out.write(datos); }
                        aviso("Guardado en Descargas: " + nombre);
                    } else {
                        File dir = getExternalFilesDir(null), f = new File(dir, nombre);
                        try (OutputStream out = new FileOutputStream(f)) { out.write(datos); }
                        aviso("Guardado en " + f.getAbsolutePath());
                    }
                } catch (Exception e) { aviso("No pude guardar el archivo."); }
            }).start();
        }
        @JavascriptInterface public void compartirImagen(final String nombre, final String b64, final String texto) {
            new Thread(() -> {
                try {
                    File dir = new File(getCacheDir(), "compartir"); dir.mkdirs();
                    File f = new File(dir, nombre);
                    try (OutputStream out = new FileOutputStream(f)) { out.write(Base64.decode(b64, Base64.DEFAULT)); }
                    Uri u = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", f);
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("image/png"); i.putExtra(Intent.EXTRA_STREAM, u); i.putExtra(Intent.EXTRA_TEXT, texto);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    Intent ch = Intent.createChooser(i, "Compartir"); ch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(ch);
                } catch (Exception e) { aviso("No pude compartir la imagen."); }
            }).start();
        }

        /* Versiones nuevas: baja el APK y abre el instalador de Android */
        @JavascriptInterface public void instalarActualizacion(final String url) {
            new Thread(() -> {
                try {
                    File dir = new File(getCacheDir(), "apk"); dir.mkdirs();
                    File apk = new File(dir, "BibliotecaViva.apk");
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setInstanceFollowRedirects(true); c.setConnectTimeout(15000); c.setReadTimeout(60000);
                    try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(apk)) {
                        byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    }
                    if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
                        aviso("Permite instalar desde esta app y vuelve a tocar «Actualizar».");
                        Intent ai = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()));
                        ai.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(ai);
                        return;
                    }
                    // Instalacion por sesion: desde Android 12, tras la primera vez, se actualiza sin pedir confirmacion.
                    android.content.pm.PackageInstaller pi = getPackageManager().getPackageInstaller();
                    android.content.pm.PackageInstaller.SessionParams sp = new android.content.pm.PackageInstaller.SessionParams(android.content.pm.PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                    sp.setAppPackageName(getPackageName());
                    if (Build.VERSION.SDK_INT >= 31) sp.setRequireUserAction(android.content.pm.PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
                    int sid = pi.createSession(sp);
                    try (android.content.pm.PackageInstaller.Session se = pi.openSession(sid)) {
                        try (InputStream in = new java.io.FileInputStream(apk); OutputStream out = se.openWrite("app", 0, apk.length())) {
                            byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                            se.fsync(out);
                        }
                        Intent ri = new Intent(MainActivity.this, InstaladorReceiver.class);
                        android.app.PendingIntent pend = android.app.PendingIntent.getBroadcast(MainActivity.this, sid, ri,
                                android.app.PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? android.app.PendingIntent.FLAG_MUTABLE : 0));
                        se.commit(pend.getIntentSender());
                    }
                } catch (Exception e) { aviso("No pude bajar la actualización."); js("window.__actualizacionFalla&&window.__actualizacionFalla()"); }
            }).start();
        }
    }
}
