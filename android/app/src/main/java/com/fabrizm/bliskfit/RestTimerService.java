package com.fabrizm.bliskfit;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;
import org.json.JSONObject;

/**
 * Keeps the rest notification's draining bar moving while the app is in the background, and buzzes a short warning
 * as the rest runs out (10, 3, 2 and 1 seconds left). It only ticks: the notice it shows is the one RestNotifier
 * stored, re-read every second, so +15 and −15 need no wiring here. The end-of-rest alert stays with the alarm.
 */
public class RestTimerService extends Service {
    /** Seconds left at which to buzz once. */
    private static final int[] WARN_AT = {10, 3, 2, 1};
    private static final long WARN_MS = 80;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable tick = this::tick;
    private int prevSecs = Integer.MAX_VALUE;
    private int lastWarned = -1;

    /** Starts (or restarts) the countdown for the stored notice. Harmless if Android won't let the app start it now. */
    static void start(Context c) {
        try {
            Intent i = new Intent(c, RestTimerService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) c.startForegroundService(i);
            else c.startService(i);
        } catch (RuntimeException e) {
            // Started from the background (Android 12+): a running service already follows the stored notice.
        }
    }

    static void stop(Context c) {
        c.stopService(new Intent(c, RestTimerService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        JSONObject n = RestNotifier.load(this);
        if (n == null || n.optLong("endsAt") <= System.currentTimeMillis()) {
            // startForegroundService() obliges us to call startForeground(); a stored notice may be gone by now.
            enterForeground(RestNotifier.build(this, n != null ? n : new JSONObject(), false));
            stopSelf();
            return START_NOT_STICKY;
        }
        enterForeground(RestNotifier.build(this, n, false));
        handler.removeCallbacks(tick);
        prevSecs = Integer.MAX_VALUE;
        lastWarned = -1;
        tick();
        return START_NOT_STICKY;
    }

    private void tick() {
        JSONObject n = RestNotifier.load(this);
        long remaining = n == null ? 0 : n.optLong("endsAt") - System.currentTimeMillis();
        if (remaining <= 0) {
            stopSelf();
            return;
        }
        int secs = (int) Math.ceil(remaining / 1000.0);
        if (secs > prevSecs) lastWarned = -1; // time was added: warn again on the way down
        prevSecs = secs;
        if (secs != lastWarned && isWarning(secs)) {
            lastWarned = secs;
            buzz();
        }
        NotificationManagerCompat nm = NotificationManagerCompat.from(this);
        if (nm.areNotificationsEnabled()) {
            try {
                nm.notify(RestNotifier.ID, RestNotifier.build(this, n, false));
            } catch (SecurityException e) {
                // Notification permission withdrawn meanwhile.
            }
        }
        // Next tick on the next whole second left, so the warnings land on time.
        long next = remaining - ((remaining - 1) / 1000) * 1000;
        handler.postDelayed(tick, Math.max(1, next));
    }

    private static boolean isWarning(int secs) {
        for (int w : WARN_AT) if (w == secs) return true;
        return false;
    }

    private void buzz() {
        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null || !v.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) v.vibrate(VibrationEffect.createOneShot(WARN_MS, VibrationEffect.DEFAULT_AMPLITUDE));
        else v.vibrate(WARN_MS);
    }

    private void enterForeground(Notification notification) {
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, RestNotifier.ID, notification, type);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(tick);
        // Hidden or skipped: take the notification down with the service. Otherwise (rest over, or Done made while the
        // app wasn't running) leave whatever RestNotifier posted last.
        boolean hidden = RestNotifier.load(this) == null;
        ServiceCompat.stopForeground(this, hidden ? ServiceCompat.STOP_FOREGROUND_REMOVE : ServiceCompat.STOP_FOREGROUND_DETACH);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
