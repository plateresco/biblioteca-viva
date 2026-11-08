package com.plateresco.bibliotecaviva;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;

import androidx.browser.customtabs.CustomTabsIntent;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * Inicio de sesion de Google con PKCE (sin contrasena ni secreto en la app). Se guarda un token de renovacion en el telefono,
 * asi la sesion no caduca a la hora como en la pagina web.
 */
final class AuthGoogle {
    static final String REDIRECT = "com.plateresco.bibliotecaviva:/oauth2redirect";
    static final String SCOPE = "https://www.googleapis.com/auth/drive.appdata";
    private AuthGoogle() { }

    static SharedPreferences p(Context c) { return c.getSharedPreferences("auth", Context.MODE_PRIVATE); }
    static boolean hayRefresh(Context c) { return !p(c).getString("refresh", "").isEmpty(); }
    static void cerrar(Context c) { p(c).edit().clear().apply(); }

    static String aleatorio(int n) {
        byte[] b = new byte[n]; new SecureRandom().nextBytes(b);
        return Base64.encodeToString(b, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    static void iniciar(Activity a) {
        try {
            String verifier = aleatorio(48), state = aleatorio(12);
            byte[] h = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes("US-ASCII"));
            String challenge = Base64.encodeToString(h, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
            p(a).edit().putString("verifier", verifier).putString("state", state).apply();
            Uri u = Uri.parse("https://accounts.google.com/o/oauth2/v2/auth").buildUpon()
                    .appendQueryParameter("client_id", BuildConfig.GOOGLE_CLIENT_ID)
                    .appendQueryParameter("redirect_uri", REDIRECT)
                    .appendQueryParameter("response_type", "code")
                    .appendQueryParameter("scope", SCOPE)
                    .appendQueryParameter("code_challenge", challenge)
                    .appendQueryParameter("code_challenge_method", "S256")
                    .appendQueryParameter("state", state)
                    .appendQueryParameter("access_type", "offline")
                    .appendQueryParameter("prompt", "consent")
                    .build();
            new CustomTabsIntent.Builder().build().launchUrl(a, u);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    // Google devuelve a la app con ?code=...; se cambia por el token de acceso y el de renovacion.
    static void canje(Context c, Uri redirect) throws Exception {
        String err = redirect.getQueryParameter("error");
        if (err != null) throw new Exception(err.equals("access_denied") ? "Cancelaste el inicio de sesion." : err);
        if (!p(c).getString("state", "").equals(redirect.getQueryParameter("state"))) throw new Exception("Respuesta de Google no valida.");
        String code = redirect.getQueryParameter("code");
        if (code == null) throw new Exception("Google no envio el codigo.");
        String body = "client_id=" + enc(BuildConfig.GOOGLE_CLIENT_ID) + "&code=" + enc(code) + "&code_verifier=" + enc(p(c).getString("verifier", ""))
                + "&redirect_uri=" + enc(REDIRECT) + "&grant_type=authorization_code";
        JSONObject j = new JSONObject(post("https://oauth2.googleapis.com/token", body));
        SharedPreferences.Editor e = p(c).edit();
        e.putString("access", j.getString("access_token")).putLong("exp", System.currentTimeMillis() + j.optLong("expires_in", 3600) * 1000);
        if (j.has("refresh_token")) e.putString("refresh", j.getString("refresh_token"));
        e.remove("verifier").apply();
    }

    static synchronized String tokenAcceso(Context c) throws Exception {
        SharedPreferences sp = p(c);
        String acc = sp.getString("access", "");
        if (!acc.isEmpty() && sp.getLong("exp", 0) > System.currentTimeMillis() + 60000) return acc;
        String ref = sp.getString("refresh", "");
        if (ref.isEmpty()) throw new Exception("Sin sesion de Google.");
        String body = "client_id=" + enc(BuildConfig.GOOGLE_CLIENT_ID) + "&refresh_token=" + enc(ref) + "&grant_type=refresh_token";
        JSONObject j;
        try { j = new JSONObject(post("https://oauth2.googleapis.com/token", body)); }
        catch (Exception e) { if (String.valueOf(e.getMessage()).contains("invalid_grant")) cerrar(c); throw e; }
        sp.edit().putString("access", j.getString("access_token")).putLong("exp", System.currentTimeMillis() + j.optLong("expires_in", 3600) * 1000).apply();
        return j.getString("access_token");
    }

    static String enc(String s) throws Exception { return URLEncoder.encode(s, "UTF-8"); }

    static String post(String url, String body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod("POST"); c.setDoOutput(true); c.setConnectTimeout(15000); c.setReadTimeout(20000);
        c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        try (OutputStream o = c.getOutputStream()) { o.write(body.getBytes("UTF-8")); }
        int code = c.getResponseCode();
        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
        StringBuilder sb = new StringBuilder(); byte[] buf = new byte[4096]; int n;
        if (in != null) while ((n = in.read(buf)) > 0) sb.append(new String(buf, 0, n, "UTF-8"));
        if (code >= 400) throw new Exception("Google respondio " + code + ": " + sb);
        return sb.toString();
    }
}
