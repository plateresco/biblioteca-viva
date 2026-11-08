package com.plateresco.bibliotecaviva;

import android.app.Activity;
import android.content.Context;
import android.content.IntentSender;
import android.content.SharedPreferences;

import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.tasks.Tasks;

import java.util.Collections;
import java.util.concurrent.TimeUnit;

/**
 * Inicio de sesion de Google con los servicios de Google del telefono (no usa navegador ni enlaces de retorno).
 * Android guarda el permiso concedido; cada vez que hace falta un token se pide en silencio.
 */
final class AuthGoogle {
    static final String SCOPE = "https://www.googleapis.com/auth/drive.appdata";
    static final int REQ = 43;
    private AuthGoogle() { }

    static SharedPreferences p(Context c) { return c.getSharedPreferences("auth", Context.MODE_PRIVATE); }
    static boolean hayRefresh(Context c) { return p(c).getBoolean("conectado", false); }
    static void cerrar(Context c) { p(c).edit().clear().apply(); }

    static AuthorizationRequest pedido() {
        return AuthorizationRequest.builder().setRequestedScopes(Collections.singletonList(new Scope(SCOPE))).build();
    }

    static void guardar(Context c, AuthorizationResult r) {
        p(c).edit().putBoolean("conectado", true).putString("access", r.getAccessToken())
                .putLong("exp", System.currentTimeMillis() + 50 * 60 * 1000L).apply();
    }

    /** Abre la pantalla de permiso de Google. Devuelve el resultado en MainActivity.onActivityResult. */
    static void iniciar(final Activity a) {
        Identity.getAuthorizationClient(a).authorize(pedido())
                .addOnSuccessListener(r -> {
                    if (r.hasResolution()) {
                        try {
                            a.startIntentSenderForResult(r.getPendingIntent().getIntentSender(), REQ, null, 0, 0, 0);
                        } catch (IntentSender.SendIntentException e) { ((MainActivity) a).googleError("No pude abrir la pantalla de Google."); }
                    } else { guardar(a, r); ((MainActivity) a).googleListo(); }
                })
                .addOnFailureListener(e -> ((MainActivity) a).googleError(String.valueOf(e.getMessage())));
    }

    /** Token vigente; si caduco, se renueva en silencio con los servicios de Google. */
    static synchronized String tokenAcceso(Context c) throws Exception {
        SharedPreferences sp = p(c);
        String acc = sp.getString("access", "");
        if (!acc.isEmpty() && sp.getLong("exp", 0) > System.currentTimeMillis() + 60000) return acc;
        if (!hayRefresh(c)) throw new Exception("Sin sesion de Google.");
        AuthorizationResult r = Tasks.await(Identity.getAuthorizationClient(c).authorize(pedido()), 20, TimeUnit.SECONDS);
        if (r.hasResolution() || r.getAccessToken() == null) { cerrar(c); throw new Exception("Vuelve a conectar tu cuenta de Google."); }
        guardar(c, r);
        return r.getAccessToken();
    }
}
