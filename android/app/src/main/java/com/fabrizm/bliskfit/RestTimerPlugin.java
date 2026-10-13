package com.fabrizm.bliskfit;

import android.content.Intent;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The web app's side of the rest notification (see RestNotifier): show or hide it, and receive its button taps as
 * "action" events ({action: done|plus|skip|open, payload?}). Taps made while the app wasn't running are kept and
 * returned once by takePending.
 */
@CapacitorPlugin(name = "RestTimer")
public class RestTimerPlugin extends Plugin {
    private static RestTimerPlugin instance;
    private static volatile boolean foreground;

    static boolean isForeground() {
        return foreground;
    }

    /** Sends an action to the web app if it is running. */
    static boolean emit(JSONObject action) {
        RestTimerPlugin p = instance;
        if (p == null) return false;
        try {
            p.notifyListeners("action", JSObject.fromJSONObject(action), true);
            return true;
        } catch (JSONException e) {
            return false;
        }
    }

    @Override
    public void load() {
        instance = this;
        foreground = true;
        RestNotifier.ensureChannels(getContext());
        handleOnNewIntent(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (intent != null && RestNotifier.A_OPEN.equals(intent.getAction())) {
            JSObject open = new JSObject();
            open.put("action", "open");
            notifyListeners("action", open, true);
            intent.setAction(null); // once
        }
    }

    @Override
    protected void handleOnResume() {
        foreground = true;
    }

    @Override
    protected void handleOnPause() {
        foreground = false;
    }

    @Override
    protected void handleOnDestroy() {
        foreground = false;
        if (instance == this) instance = null;
    }

    @PluginMethod
    public void show(PluginCall call) {
        JSObject n = call.getData();
        RestNotifier.save(getContext(), n);
        RestNotifier.post(getContext(), n, false);
        RestNotifier.scheduleEnd(getContext(), n.optLong("endsAt"));
        call.resolve();
    }

    @PluginMethod
    public void hide(PluginCall call) {
        RestNotifier.hide(getContext());
        call.resolve();
    }

    @PluginMethod
    public void takePending(PluginCall call) {
        JSONArray all = RestNotifier.takePending(getContext());
        JSArray out = new JSArray();
        for (int i = 0; i < all.length(); i++) out.put(all.opt(i));
        JSObject res = new JSObject();
        res.put("actions", out);
        call.resolve(res);
    }
}
