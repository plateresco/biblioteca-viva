package com.plateresco.bibliotecaviva;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;

import com.k2fsa.sherpa.onnx.GeneratedAudio;
import com.k2fsa.sherpa.onnx.OfflineTts;
import com.k2fsa.sherpa.onnx.OfflineTtsConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Voz neuronal sin conexion (Piper dentro de sherpa-onnx). Las voces se descargan una vez (unos 20 MB cada una) a la
 * carpeta privada de la app. Mientras una frase suena, la siguiente ya se esta generando para que no haya huecos.
 * Todo el codigo esta aislado: si algo falla, la web vuelve a la voz de Google.
 */
final class VozNeuronal {
    interface Aviso { void js(String codigo); }

    static final String BASE = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/";
    static final String[][] VOCES = {
            // id, nombre, archivo, tamano en MB
            {"claude", "Claude · México (alta calidad)", "vits-piper-es_MX-claude-high-int8.tar.bz2", "20"},
            {"davefx", "Dave · España", "vits-piper-es_ES-davefx-medium-int8.tar.bz2", "20"},
            {"ald", "Ald · México", "vits-piper-es_MX-ald-medium-int8.tar.bz2", "20"},
    };

    private final Context ctx;
    private final Aviso aviso;
    private OfflineTts tts;
    private String cargada = "";
    private volatile int token = 0;                 // sube con cada «parar» para cortar lo que esté en curso
    private volatile AudioTrack pista;
    private final ExecutorService genEx = Executors.newSingleThreadExecutor();    // la generación va en serie (el modelo no es reentrante)
    private final ExecutorService hablaEx = Executors.newSingleThreadExecutor();
    private final Map<String, Future<GeneratedAudio>> pendientes = new HashMap<>();

    VozNeuronal(Context c, Aviso a) { ctx = c.getApplicationContext(); aviso = a; }

    File carpeta(String id) { return new File(ctx.getFilesDir(), "voces/" + id); }
    boolean lista(String id) { return new File(carpeta(id), "listo").exists(); }

    String catalogo() {
        JSONArray a = new JSONArray();
        try {
            for (String[] v : VOCES) {
                JSONObject o = new JSONObject();
                o.put("id", v[0]); o.put("nombre", v[1]); o.put("mb", Integer.parseInt(v[3])); o.put("lista", lista(v[0]));
                a.put(o);
            }
        } catch (Exception ignored) { }
        return a.toString();
    }

    /* ---------- Descarga e instalacion ---------- */
    void descargar(final String id) {
        new Thread(() -> {
            String[] voz = null;
            for (String[] v : VOCES) if (v[0].equals(id)) voz = v;
            if (voz == null) { aviso.js("window.__vozError&&window.__vozError(" + MainActivity.q(id) + ",'Voz desconocida')"); return; }
            File tmp = new File(ctx.getCacheDir(), "voz-" + id + ".tar.bz2");
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(BASE + voz[2]).openConnection();
                c.setInstanceFollowRedirects(true); c.setConnectTimeout(20000); c.setReadTimeout(60000);
                long total = c.getContentLengthLong(), leido = 0; int ultimo = -1;
                try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(tmp)) {
                    byte[] buf = new byte[65536]; int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n); leido += n;
                        int p = total > 0 ? (int) (leido * 90 / total) : 0;          // 90 % descarga, 10 % descompresión
                        if (p != ultimo) { ultimo = p; aviso.js("window.__vozProgreso&&window.__vozProgreso(" + MainActivity.q(id) + "," + p + ")"); }
                    }
                }
                File dest = carpeta(id); borrar(dest); dest.mkdirs();
                try (InputStream in = new BufferedInputStream(new FileInputStream(tmp)); BZip2CompressorInputStream bz = new BZip2CompressorInputStream(in);
                     TarArchiveInputStream tar = new TarArchiveInputStream(bz)) {
                    String raiz = dest.getCanonicalPath() + File.separator; TarArchiveEntry e;
                    while ((e = tar.getNextTarEntry()) != null) {
                        File f = new File(dest, e.getName());
                        if (!f.getCanonicalPath().startsWith(raiz)) continue;                      // no salir de la carpeta
                        if (e.isDirectory()) { f.mkdirs(); continue; }
                        f.getParentFile().mkdirs();
                        try (OutputStream out = new FileOutputStream(f)) { byte[] buf = new byte[65536]; int n; while ((n = tar.read(buf)) > 0) out.write(buf, 0, n); }
                    }
                }
                if (modelo(id) == null) throw new Exception("El archivo de la voz no trae el modelo esperado.");
                new File(dest, "listo").createNewFile();
                aviso.js("window.__vozListo&&window.__vozListo(" + MainActivity.q(id) + ")");
            } catch (Throwable e) {
                borrar(carpeta(id));
                aviso.js("window.__vozError&&window.__vozError(" + MainActivity.q(id) + "," + MainActivity.q("No se pudo descargar la voz: " + e.getMessage()) + ")");
            } finally { tmp.delete(); }
        }).start();
    }

    void quitar(String id) { synchronized (this) { if (cargada.equals(id)) { liberar(); } } borrar(carpeta(id)); }

    static void borrar(File f) {
        if (f == null || !f.exists()) return;
        File[] h = f.listFiles(); if (h != null) for (File x : h) borrar(x);
        f.delete();
    }

    // Carpeta del modelo ya descomprimido: contiene un .onnx, tokens.txt y espeak-ng-data.
    private File modelo(String id) {
        File[] top = carpeta(id).listFiles(); if (top == null) return null;
        for (File d : top) {
            if (!d.isDirectory()) continue;
            File[] fs = d.listFiles(); if (fs == null) continue;
            boolean onnx = false; for (File x : fs) if (x.getName().endsWith(".onnx")) onnx = true;
            if (onnx && new File(d, "tokens.txt").exists() && new File(d, "espeak-ng-data").exists()) return d;
        }
        return null;
    }

    private synchronized void cargar(String id) throws Exception {
        if (cargada.equals(id) && tts != null) return;
        liberar();
        File d = modelo(id); if (d == null) throw new Exception("La voz no esta instalada.");
        String onnx = null; for (File x : d.listFiles()) if (x.getName().endsWith(".onnx")) onnx = x.getAbsolutePath();
        OfflineTtsVitsModelConfig v = new OfflineTtsVitsModelConfig();
        v.setModel(onnx); v.setTokens(new File(d, "tokens.txt").getAbsolutePath()); v.setDataDir(new File(d, "espeak-ng-data").getAbsolutePath());
        OfflineTtsModelConfig m = new OfflineTtsModelConfig(); m.setVits(v); m.setNumThreads(2); m.setDebug(false); m.setProvider("cpu");
        OfflineTtsConfig c = new OfflineTtsConfig(); c.setModel(m);
        tts = new OfflineTts(null, c); cargada = id;
    }

    private synchronized void liberar() {
        pendientes.clear();
        try { if (tts != null) tts.release(); } catch (Throwable ignored) { }
        tts = null; cargada = "";
    }

    /* ---------- Hablar ---------- */
    private Future<GeneratedAudio> generar(final String id, final String texto, final float vel) {
        final String clave = id + "|" + vel + "|" + texto;
        synchronized (pendientes) {
            Future<GeneratedAudio> f = pendientes.get(clave);
            if (f == null) {
                f = genEx.submit(() -> { cargar(id); synchronized (VozNeuronal.this) { return tts.generate(texto, 0, vel); } });
                pendientes.put(clave, f);
            }
            return f;
        }
    }

    void hablar(final String idUtt, final String vozId, final String texto, final String siguiente, final float vel) {
        final int mio = ++token;
        pararPista();
        hablaEx.submit(() -> {
            int estado = 0;
            try {
                float v = vel > 0 ? vel : 1f;
                Future<GeneratedAudio> f = generar(vozId, texto, v);
                if (siguiente != null && !siguiente.isEmpty()) generar(vozId, siguiente, v);       // se prepara mientras suena esta frase
                GeneratedAudio a = f.get();
                synchronized (pendientes) { pendientes.remove(vozId + "|" + v + "|" + texto); }
                if (mio != token) { estado = 2; return; }
                estado = reproducir(a, mio) ? 1 : 2;
            } catch (Throwable e) { estado = 0; }
            finally { aviso.js("window.__ttsFin&&window.__ttsFin(" + MainActivity.q(idUtt) + "," + estado + ")"); }
        });
    }

    private boolean reproducir(GeneratedAudio a, int mio) {
        float[] s = a.getSamples(); int sr = a.getSampleRate();
        int min = AudioTrack.getMinBufferSize(sr, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT);
        AudioTrack t = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_FLOAT).setSampleRate(sr).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                .setBufferSizeInBytes(Math.max(min, 8192)).setTransferMode(AudioTrack.MODE_STREAM).build();
        pista = t;
        try {
            t.play();
            int pos = 0;
            while (pos < s.length) {
                if (mio != token) return false;
                int n = t.write(s, pos, Math.min(4096, s.length - pos), AudioTrack.WRITE_BLOCKING);
                if (n <= 0) return false;
                pos += n;
            }
            while (t.getPlaybackHeadPosition() < s.length) {                  // espera a que termine de sonar lo ya escrito
                if (mio != token) return false;
                Thread.sleep(25);
            }
            return true;
        } catch (Throwable e) { return false; }
        finally { try { t.stop(); } catch (Throwable ignored) { } t.release(); if (pista == t) pista = null; }
    }

    private void pararPista() { AudioTrack t = pista; if (t != null) { try { t.pause(); t.flush(); } catch (Throwable ignored) { } } }

    void parar() { token++; pararPista(); }

    void cerrar() { token++; pararPista(); genEx.shutdownNow(); hablaEx.shutdownNow(); synchronized (this) { liberar(); } }
}
