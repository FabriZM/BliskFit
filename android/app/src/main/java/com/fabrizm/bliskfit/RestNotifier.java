package com.fabrizm.bliskfit;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The rest notification: a silent countdown with the next set while resting, which turns into the "rest over" alert
 * at the end (an alarm, so it fires with the screen locked). Its buttons are handled by RestTimerReceiver without
 * opening the app. The notice the web app last showed is kept in preferences so the alarm and the buttons can
 * rebuild it after the app's process is gone.
 */
final class RestNotifier {
    /** Same id as the rest notification of older versions, so an update replaces it. */
    static final int ID = 1001;
    static final String LIVE = "rest_countdown";
    static final String ALERT = "rest_alert";
    static final String A_END = "com.fabrizm.bliskfit.REST_END";
    static final String A_DONE = "com.fabrizm.bliskfit.REST_DONE";
    static final String A_PLUS = "com.fabrizm.bliskfit.REST_PLUS";
    static final String A_SKIP = "com.fabrizm.bliskfit.REST_SKIP";
    static final String A_OPEN = "com.fabrizm.bliskfit.REST_OPEN";
    static final long PLUS_MS = 15_000;

    private static final String PREFS = "rest_timer";
    private static final String NOTICE = "notice";
    private static final String PENDING = "pending";

    private RestNotifier() {}

    static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        // Default importance so it sits with the other notifications, not folded away under "Silent"; no sound.
        NotificationChannel live = new NotificationChannel(LIVE, "Rest countdown", NotificationManager.IMPORTANCE_DEFAULT);
        live.setDescription("The running rest timer and your next set");
        live.setSound(null, null);
        live.enableVibration(false);
        live.setShowBadge(false);
        live.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        NotificationChannel alert = new NotificationChannel(ALERT, "Rest over", NotificationManager.IMPORTANCE_HIGH);
        alert.setDescription("Sounds when a rest ends");
        alert.enableVibration(true);
        alert.setVibrationPattern(new long[] {0, 250, 120, 250});
        alert.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(live);
        nm.createNotificationChannel(alert);
    }

    // ---- stored notice and pending actions ----------------------------------------------------------------

    static void save(Context c, JSONObject n) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(NOTICE, n.toString()).apply();
    }

    static JSONObject load(Context c) {
        String s = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(NOTICE, null);
        try {
            return s == null ? null : new JSONObject(s);
        } catch (JSONException e) {
            return null;
        }
    }

    /** A button tap the web app wasn't running to receive; handed over when it starts (takePending). */
    static void queue(Context c, JSONObject action) {
        JSONArray all = pending(c);
        all.put(action);
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(PENDING, all.toString()).commit();
    }

    static JSONArray takePending(Context c) {
        JSONArray all = pending(c);
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(PENDING).commit();
        return all;
    }

    private static JSONArray pending(Context c) {
        String s = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PENDING, null);
        try {
            return s == null ? new JSONArray() : new JSONArray(s);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    // ---- showing ----------------------------------------------------------------------------------------

    /**
     * Shows the notice: counting down until `endsAt`, "rest over" after. `alert` makes it sound (the end of a rest
     * while the app is in the background); every other update is silent.
     */
    static void post(Context c, JSONObject n, boolean alert) {
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        if (!nm.areNotificationsEnabled()) return;
        try {
            // A sounding update must not be swallowed by "only alert once" on the silent countdown it replaces.
            if (alert) nm.cancel(ID);
            nm.notify(ID, build(c, n, alert));
        } catch (SecurityException e) {
            // Notification permission withdrawn meanwhile.
        }
    }

    /** The notification for a notice; also what the countdown service holds as its foreground notification. */
    static Notification build(Context c, JSONObject n, boolean alert) {
        ensureChannels(c);
        long endsAt = n.optLong("endsAt");
        boolean over = System.currentTimeMillis() >= endsAt - 500;
        String text = n.optString("text");
        String payload = n.optString("payload", "");
        JSONObject labels = n.optJSONObject("labels");

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, alert ? ALERT : LIVE)
            .setSmallIcon(R.drawable.ic_stat_bliskfit)
            .setColor(Color.parseColor("#45d0a0"))
            .setContentTitle(n.optString(over ? "overTitle" : "title"))
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(openApp(c))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(over ? NotificationCompat.CATEGORY_REMINDER : NotificationCompat.CATEGORY_PROGRESS)
            .setOngoing(!over)
            .setOnlyAlertOnce(!alert)
            .setSilent(!alert)
            .setShowWhen(endsAt > 0)
            .setWhen(endsAt);
        if (!over) {
            b.setUsesChronometer(true).setChronometerCountDown(true);
            // The draining bar: full at the start of the rest, empty at its end (RestTimerService re-posts it every second).
            long startedAt = n.optLong("startedAt");
            if (endsAt > startedAt && startedAt > 0) {
                int total = (int) Math.max(1, (endsAt - startedAt) / 1000);
                int left = (int) Math.min(total, Math.max(0, (endsAt - System.currentTimeMillis() + 999) / 1000));
                b.setProgress(total, left, false);
            }
        }

        if (labels != null) {
            if (!payload.isEmpty() && labels.has("done")) {
                Intent done = new Intent(c, RestTimerReceiver.class).setAction(A_DONE).putExtra("payload", payload);
                b.addAction(0, labels.optString("done"), broadcast(c, 1, done));
            }
            if (!over) {
                b.addAction(0, labels.optString("plus"), broadcast(c, 2, new Intent(c, RestTimerReceiver.class).setAction(A_PLUS)));
                b.addAction(0, labels.optString("skip"), broadcast(c, 3, new Intent(c, RestTimerReceiver.class).setAction(A_SKIP)));
            }
        }
        return b.build();
    }

    /** After Done with the app not running: the set is saved once it opens, so say that and drop the buttons. */
    static void postPending(Context c, JSONObject n) {
        try {
            JSONObject p = new JSONObject(n.toString());
            p.put("text", n.optString("pendingText"));
            p.put("title", n.optString("overTitle"));
            p.put("endsAt", 0);
            p.remove("labels");
            post(c, p, false);
        } catch (JSONException e) {
            // unreachable: copying a valid object
        }
    }

    static void hide(Context c) {
        // Forget the notice first: the service sees that and takes its own foreground notification down with it.
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(NOTICE).commit();
        cancelEnd(c);
        NotificationManagerCompat.from(c).cancel(ID);
    }

    // ---- end-of-rest alarm ------------------------------------------------------------------------------

    static void scheduleEnd(Context c, long endsAt) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent pi = endIntent(c);
        am.cancel(pi);
        if (endsAt <= System.currentTimeMillis()) return;
        // Exact only with the "alarms & reminders" grant; otherwise Android may deliver it a little late.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pi);
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pi);
        }
    }

    static void cancelEnd(Context c) {
        RestTimerService.stop(c);
        c.getSystemService(AlarmManager.class).cancel(endIntent(c));
    }

    private static PendingIntent endIntent(Context c) {
        return broadcast(c, 0, new Intent(c, RestTimerReceiver.class).setAction(A_END));
    }

    private static PendingIntent broadcast(Context c, int code, Intent i) {
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class).setAction(A_OPEN).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 4, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
