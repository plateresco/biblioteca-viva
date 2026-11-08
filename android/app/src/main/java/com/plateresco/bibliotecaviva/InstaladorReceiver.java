package com.plateresco.bibliotecaviva;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.widget.Toast;

/** Resultado de la instalacion de una actualizacion: si Android necesita confirmacion, la muestra; si falla, avisa. */
public class InstaladorReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent conf = i.getParcelableExtra(Intent.EXTRA_INTENT);
            if (conf != null) { conf.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); c.startActivity(conf); }
        } else if (st != PackageInstaller.STATUS_SUCCESS) {
            Toast.makeText(c, "No se pudo instalar la actualización.", Toast.LENGTH_LONG).show();
        }
    }
}
