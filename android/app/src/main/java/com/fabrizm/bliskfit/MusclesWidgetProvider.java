package com.fabrizm.bliskfit;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;

/** "Muscles worked": front and back body shaded by this week's sets (drawn by the web app, shown here as a picture). */
public class MusclesWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_muscles);
        JSONObject s = WidgetStore.snapshot(c);
        JSONObject text = s == null ? null : s.optJSONObject("text");
        Bitmap map = WidgetStore.muscles(c);
        v.setTextViewText(R.id.muscles_title, text == null ? "" : text.optString("musclesTitle"));
        v.setTextViewText(R.id.muscles_empty, text == null ? "" : text.optString("musclesEmpty"));
        v.setViewVisibility(R.id.muscles_image, map == null ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.muscles_empty, map == null ? View.VISIBLE : View.GONE);
        if (map != null) v.setImageViewBitmap(R.id.muscles_image, map);
        v.setOnClickPendingIntent(R.id.widget_root, WidgetStore.openApp(c));
        mgr.updateAppWidget(ids, v);
    }
}
