const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const mainPath = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'zakmolanitech', 'molanbusiness', 'MainActivity.java');
if (!fs.existsSync(manifestPath)) throw new Error('AndroidManifest.xml was not generated. Run npx cap add android first.');
let manifest = fs.readFileSync(manifestPath, 'utf8');
const activityPattern = /(<activity\\b(?=[^>]*android:name="[^"]*MainActivity")[^>]*>)([\\s\\S]*?)(<\\/activity>)/i;
const match = manifest.match(activityPattern);
if (!match) throw new Error('Could not find the Capacitor MainActivity in AndroidManifest.xml.');
if (!match[2].includes('android:scheme="molanbusiness"')) {
  const filter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="molanbusiness" android:host="auth-handoff" />
            </intent-filter>`;
  manifest = manifest.replace(activityPattern, match[1] + match[2] + filter + match[3]);
  fs.writeFileSync(manifestPath, manifest);
}
fs.mkdirSync(path.dirname(mainPath), { recursive: true });
const java = `package com.zakmolanitech.molanbusiness;

import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PREFS = "molan_business_app_access";
    private static final String TOKEN_KEY = "pending_handoff_token";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        captureHandoff(getIntent());
        installAccessBridge();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureHandoff(intent);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(
                "window.dispatchEvent(new Event('molan-access-handoff'))", null));
        }
    }

    private void installAccessBridge() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new AppAccessBridge(), "MolanBusinessNative");
        }
    }

    private void captureHandoff(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri uri = intent.getData();
        if (!"molanbusiness".equals(uri.getScheme()) || !"auth-handoff".equals(uri.getHost())) return;
        String token = uri.getQueryParameter("token");
        if (token != null && token.matches("[a-f0-9]{64}")) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(TOKEN_KEY, token).apply();
        }
    }

    public final class AppAccessBridge {
        @JavascriptInterface public boolean isNativeApp() { return true; }
        @JavascriptInterface public String getPendingHandoffToken() {
            return getSharedPreferences(PREFS, MODE_PRIVATE).getString(TOKEN_KEY, "");
        }
        @JavascriptInterface public void clearPendingHandoffToken() {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().remove(TOKEN_KEY).apply();
        }
        @JavascriptInterface public void closeAppAccess() {
            runOnUiThread(() -> {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('molan-close-app-access'))", null);
                }
            });
        }
    }
}
`;
fs.writeFileSync(mainPath, java);
console.log('Configured Molan Business Android deep link and secure native access bridge.');
