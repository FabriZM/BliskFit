package com.fabrizm.bliskfit;

import android.accounts.Account;
import android.app.Activity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.ClearTokenRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.RevokeAccessRequest;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;
import java.util.List;

/**
 * Access tokens for Google Drive backups through Google's Authorization API (Play services). Only the drive.file
 * scope: the app can see and change only the files it created. Google matches this app to its OAuth client by
 * package name and signing-key fingerprint, so no client ID lives here.
 */
@CapacitorPlugin(name = "GoogleDrive")
public class GoogleDrivePlugin extends Plugin {

    private static final List<Scope> SCOPES = Collections.singletonList(new Scope("https://www.googleapis.com/auth/drive.file"));

    private ActivityResultLauncher<IntentSenderRequest> consentLauncher;
    private PluginCall pending;

    @Override
    public void load() {
        // Registered while the activity is being created, as the Activity Result API requires.
        consentLauncher = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), (result) -> {
            PluginCall call = pending;
            pending = null;
            if (call == null) return;
            if (result.getResultCode() != Activity.RESULT_OK) {
                call.reject("Sign-in canceled", "CANCELED");
                return;
            }
            try {
                resolveToken(call, client().getAuthorizationResultFromIntent(result.getData()));
            } catch (ApiException e) {
                call.reject(e.getMessage(), "FAILED", e);
            }
        });
    }

    private AuthorizationClient client() {
        return Identity.getAuthorizationClient(getActivity());
    }

    /** { interactive }: when consent is needed, show Google's screen (true) or reject with NEEDS_CONSENT (false). */
    @PluginMethod
    public void authorize(PluginCall call) {
        boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", false));
        AuthorizationRequest request = AuthorizationRequest.builder().setRequestedScopes(SCOPES).build();
        client()
            .authorize(request)
            .addOnSuccessListener((auth) -> {
                if (!auth.hasResolution()) {
                    resolveToken(call, auth);
                } else if (!interactive || auth.getPendingIntent() == null) {
                    call.reject("Needs the user's consent", "NEEDS_CONSENT");
                } else if (pending != null) {
                    call.reject("Sign-in already in progress", "FAILED");
                } else {
                    pending = call;
                    consentLauncher.launch(new IntentSenderRequest.Builder(auth.getPendingIntent().getIntentSender()).build());
                }
            })
            .addOnFailureListener((e) -> call.reject(e.getMessage(), "FAILED", e));
    }

    private void resolveToken(PluginCall call, AuthorizationResult auth) {
        String token = auth.getAccessToken();
        if (token == null) {
            call.reject("No access token", "FAILED");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("accessToken", token);
        call.resolve(ret);
    }

    /** { token }: drops a token Google rejected from Play services' cache. */
    @PluginMethod
    public void clearToken(PluginCall call) {
        String token = call.getString("token");
        if (token == null) {
            call.resolve();
            return;
        }
        client()
            .clearToken(ClearTokenRequest.builder().setToken(token).build())
            .addOnCompleteListener((t) -> call.resolve());
    }

    /** { email }: withdraws the app's Drive access for that account. Never fails the disconnect. */
    @PluginMethod
    public void revoke(PluginCall call) {
        String email = call.getString("email");
        if (email == null) {
            call.resolve();
            return;
        }
        RevokeAccessRequest request = RevokeAccessRequest.builder().setAccount(new Account(email, "com.google")).setScopes(SCOPES).build();
        client().revokeAccess(request).addOnCompleteListener((t) -> call.resolve());
    }
}
