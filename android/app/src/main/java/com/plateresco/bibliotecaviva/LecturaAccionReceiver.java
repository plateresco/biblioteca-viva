package com.plateresco.bibliotecaviva;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Botones de la notificacion de lectura: se pasan a la pagina, que es quien lleva la cuenta de las frases. */
public class LecturaAccionReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        String a = i.getStringExtra("a");
        MainActivity m = MainActivity.instancia;
        if (a != null && m != null) m.js("window.__lecturaAccion&&window.__lecturaAccion(" + MainActivity.q(a) + ")");
    }
}
