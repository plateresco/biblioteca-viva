package com.plateresco.bibliotecaviva;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/** Boton del panel de ajustes rapidos: abre el libro que estas leyendo. */
public class ContinuarTile extends TileService {
    @Override public void onStartListening() {
        Tile t = getQsTile(); if (t == null) return;
        t.setState(Tile.STATE_INACTIVE); t.updateTile();
    }
    @Override public void onClick() {
        Intent i = new Intent(this, MainActivity.class).setAction("com.plateresco.bibliotecaviva.CONTINUAR").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (Build.VERSION.SDK_INT >= 34) startActivityAndCollapse(PendingIntent.getActivity(this, 11, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        else startActivityAndCollapse(i);
    }
}
