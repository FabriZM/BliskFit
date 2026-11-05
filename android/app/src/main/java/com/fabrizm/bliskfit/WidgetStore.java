package com.fabrizm.bliskfit;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * What the home-screen widgets show. The web app owns the data (it lives in the WebView's IndexedDB), so it pushes
 * a small JSON snapshot and the muscle map as a PNG through WidgetsPlugin; the widgets only read them from here.
 */
final class WidgetStore {
    private static final String PREFS = "widgets";
    private static final String SNAPSHOT = "snapshot";
    private static final String MUSCLES_FILE = "widget_muscles.png";

    private WidgetStore() {}

    static void save(Context c, String snapshotJson, String musclesBase64) throws IOException {
        File png = new File(c.getFilesDir(), MUSCLES_FILE);
        if (musclesBase64 == null || musclesBase64.isEmpty()) {
            //noinspection ResultOfMethodCallIgnored
            png.delete();
        } else {
            try (FileOutputStream out = new FileOutputStream(png)) {
                out.write(Base64.decode(musclesBase64, Base64.DEFAULT));
            }
        }
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(SNAPSHOT, snapshotJson).apply();
    }

    /** The last snapshot, or null before the app has sent one. */
    static JSONObject snapshot(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = p.getString(SNAPSHOT, null);
        if (json == null) return null;
        try {
            return new JSONObject(json);
        } catch (JSONException e) {
            return null;
        }
    }

    /** This week's muscle map, or null when nothing was worked yet. */
    static Bitmap muscles(Context c) {
        File png = new File(c.getFilesDir(), MUSCLES_FILE);
        return png.exists() ? BitmapFactory.decodeFile(png.getAbsolutePath()) : null;
    }

    /** Tapping a widget opens the app. */
    static PendingIntent openApp(Context c) {
        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void refreshAll(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (Class<?> provider : new Class<?>[] { WeekWidgetProvider.class, MusclesWidgetProvider.class }) {
            int[] ids = mgr.getAppWidgetIds(new ComponentName(c, provider));
            if (ids.length == 0) continue;
            Intent update = new Intent(c, provider).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            c.sendBroadcast(update);
        }
    }
}
