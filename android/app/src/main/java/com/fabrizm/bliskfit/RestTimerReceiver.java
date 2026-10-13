package com.fabrizm.bliskfit;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The rest notification's buttons and its end-of-rest alarm. The notification is updated here right away; the
 * workout itself changes in the web app, which gets the tap now if it is running, or when it next starts.
 */
public class RestTimerReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String a = intent.getAction();
        if (a == null) return;
        JSONObject n = RestNotifier.load(c);
        switch (a) {
            case RestNotifier.A_END:
                // Quiet while the app is open: it beeps on its own.
                if (n != null) RestNotifier.post(c, n, !RestTimerPlugin.isForeground());
                break;
            case RestNotifier.A_PLUS:
                if (n != null) {
                    long endsAt = Math.max(System.currentTimeMillis(), n.optLong("endsAt") + RestNotifier.PLUS_MS);
                    put(n, "endsAt", endsAt);
                    RestNotifier.save(c, n);
                    RestNotifier.post(c, n, false);
                    RestNotifier.scheduleEnd(c, endsAt);
                }
                deliver(c, action("plus"));
                break;
            case RestNotifier.A_SKIP:
                RestNotifier.hide(c);
                deliver(c, action("skip"));
                break;
            case RestNotifier.A_DONE:
                JSONObject done = action("done");
                put(done, "payload", intent.getStringExtra("payload"));
                if (!deliver(c, done) && n != null) {
                    RestNotifier.cancelEnd(c);
                    RestNotifier.postPending(c, n);
                }
                break;
            default:
                break;
        }
    }

    /** Hands an action to the web app; queues it when the app isn't running. True if delivered now. */
    private static boolean deliver(Context c, JSONObject action) {
        if (RestTimerPlugin.emit(action)) return true;
        RestNotifier.queue(c, action);
        return false;
    }

    private static JSONObject action(String name) {
        JSONObject o = new JSONObject();
        put(o, "action", name);
        return o;
    }

    private static void put(JSONObject o, String k, Object v) {
        try {
            o.put(k, v);
        } catch (JSONException e) {
            // unreachable: non-null key
        }
    }
}
