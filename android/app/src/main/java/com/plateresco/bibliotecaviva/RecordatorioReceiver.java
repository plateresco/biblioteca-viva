package com.plateresco.bibliotecaviva;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class RecordatorioReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        Recordatorio.mostrar(c);
        Recordatorio.programar(c);       // deja listo el del dia siguiente
    }
}
