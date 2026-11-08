package com.plateresco.bibliotecaviva;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Al encender el telefono se vuelve a programar el recordatorio (las alarmas se pierden al reiniciar). */
public class ArranqueReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) Recordatorio.programar(c);
    }
}
