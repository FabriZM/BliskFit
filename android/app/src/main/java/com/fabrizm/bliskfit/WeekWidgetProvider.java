package com.fabrizm.bliskfit;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/** "This week": the seven days with the trained ones filled in, and how many of the weekly goal are done. */
public class WeekWidgetProvider extends AppWidgetProvider {
    private static final int[] LABELS = {
        R.id.day_label_0, R.id.day_label_1, R.id.day_label_2, R.id.day_label_3, R.id.day_label_4, R.id.day_label_5, R.id.day_label_6 };
    private static final int[] MARKS = {
        R.id.day_mark_0, R.id.day_mark_1, R.id.day_mark_2, R.id.day_mark_3, R.id.day_mark_4, R.id.day_mark_5, R.id.day_mark_6 };

    @Override
    public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_week);
        JSONObject s = WidgetStore.snapshot(c);
        if (s != null) {
            JSONObject text = s.optJSONObject("text");
            JSONObject week = s.optJSONObject("week");
            if (text != null) {
                v.setTextViewText(R.id.week_title, text.optString("weekTitle"));
                v.setTextViewText(R.id.week_goal, text.optString("goalLine"));
                v.setTextViewText(R.id.week_streak, text.optString("streakLine"));
            }
            JSONArray days = week == null ? null : week.optJSONArray("days");
            for (int i = 0; days != null && i < LABELS.length && i < days.length(); i++) {
                JSONObject d = days.optJSONObject(i);
                if (d == null) continue;
                boolean trained = d.optBoolean("trained");
                v.setTextViewText(LABELS[i], d.optString("label"));
                v.setTextViewText(MARKS[i], trained ? "\u2713" : "");
                v.setInt(MARKS[i], "setBackgroundResource", trained ? R.drawable.widget_day_on
                    : d.optBoolean("today") ? R.drawable.widget_day_today : R.drawable.widget_day_off);
                v.setFloat(LABELS[i], "setAlpha", d.optBoolean("future") ? 0.5f : 1f);
            }
            if (week != null) {
                v.setProgressBar(R.id.week_progress, Math.max(1, week.optInt("goal", 1)), Math.min(week.optInt("count"), week.optInt("goal", 1)), false);
            }
        }
        v.setOnClickPendingIntent(R.id.widget_root, WidgetStore.openApp(c));
        mgr.updateAppWidget(ids, v);
    }
}
