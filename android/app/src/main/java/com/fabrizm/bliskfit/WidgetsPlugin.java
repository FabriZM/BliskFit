package com.fabrizm.bliskfit;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;

/** The web app's side of the home-screen widgets: hands over what they show (see WidgetStore) and refreshes them. */
@CapacitorPlugin(name = "Widgets")
public class WidgetsPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String snapshot = call.getString("snapshot");
        if (snapshot == null) {
            call.reject("snapshot is required");
            return;
        }
        try {
            WidgetStore.save(getContext(), snapshot, call.getString("muscles"));
        } catch (IOException | IllegalArgumentException e) {
            call.reject("Could not save the widget data", e);
            return;
        }
        WidgetStore.refreshAll(getContext());
        call.resolve(new JSObject());
    }
}
