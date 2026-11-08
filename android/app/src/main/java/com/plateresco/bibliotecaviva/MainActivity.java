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

    WebView web;
    ValueCallback<Uri[]> chooserCb;
    boolean paginaLista = false;
    String pendienteArchivo = null;   // "url|nombre" de un EPUB recibido antes de que la web terminara de cargar

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
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
        s.setTextZoom(100);              // la app tiene su propio tamaño de texto; el del sistema desacomodaria los lomos
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
                if (pendienteArchivo != null) { String[] p = pendienteArchivo.split("\\|", 2); pendienteArchivo = null; entregarArchivo(p[0], p[1]); }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
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
        web.addJavascriptInterface(new Puente(), "AndroidApp");
        web.loadUrl(INICIO);
        manejarIntent(getIntent());
    }

    @Override protected void onNewIntent(Intent i) { super.onNewIntent(i); setIntent(i); manejarIntent(i); }

    void googleListo() { js("window.__googleListo&&window.__googleListo()"); }
    void googleError(String m) { js("window.__googleError&&window.__googleError(" + q(m) + ")"); }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
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
    String nombreDe(Uri u) {
        String n = "libro.epub";
        try (Cursor c = getContentResolver().query(u, null, null, null, null)) {
            if (c != null && c.moveToFirst()) { int k = c.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (k >= 0) n = c.getString(k); }
        } catch (Exception ignored) { }
        return n;
    }
    void entregarArchivo(String url, String nombre) { js("window.__abrirArchivo&&window.__abrirArchivo(" + q(url) + "," + q(nombre) + ")"); }

    @Override public void onRequestPermissionsResult(int r, String[] p, int[] g) { super.onRequestPermissionsResult(r, p, g); }

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
        @JavascriptInterface public void barras(final String colorHex, final boolean oscuro) {
            runOnUiThread(() -> {
                try {
                    int c = Color.parseColor(colorHex);
                    Window w = getWindow();
                    w.setStatusBarColor(c); w.setNavigationBarColor(c); web.setBackgroundColor(c);
                    View d = w.getDecorView(); int f = d.getSystemUiVisibility();
                    int luzSt = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR, luzNav = Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0;
                    if (oscuro) f &= ~(luzSt | luzNav); else f |= (luzSt | luzNav);
                    d.setSystemUiVisibility(f);
                } catch (Exception ignored) { }
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
