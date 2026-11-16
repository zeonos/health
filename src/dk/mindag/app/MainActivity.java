package dk.mindag.app;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Bundle;
import android.provider.CalendarContract;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.text.*;
import android.util.Base64;
import android.webkit.*;
import android.widget.Toast;

import org.json.*;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.Arrays;
import java.util.concurrent.*;
import javax.crypto.*;
import javax.crypto.spec.*;
import javax.net.ssl.HttpsURLConnection;

public final class MainActivity extends Activity {
    private static final String KEY = "min-dag-storage";
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private final ExecutorService worker = Executors.newFixedThreadPool(2);
    private WebView web;
    private String pendingReport;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(245, 245, 239));
        getWindow().setNavigationBarColor(Color.rgb(34, 73, 74));
        getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(245, 245, 239));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setAllowFileAccess(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new LocalPageOnly(getAssets()));
        web.addJavascriptInterface(new Bridge(), "MinDagAndroid");
        setContentView(web);
        web.loadUrl("https://" + ASSET_HOST + "/index.html");
    }

    private static final class LocalPageOnly extends WebViewClient {
        private final AssetManager assets;

        LocalPageOnly(AssetManager assets) { this.assets = assets; }

        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
        @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return true; }

        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            String path = url.getPath();
            if ("https".equals(url.getScheme()) && ASSET_HOST.equals(url.getHost()) && path != null) {
                String mime = assetMime(path);
                if (mime != null) {
                    try {
                        return new WebResourceResponse(mime, mime.equals("image/png") ? null : "UTF-8",
                            assets.open(path.substring(1)));
                    } catch (IOException missing) { /* Return an empty response below. */ }
                }
            }
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null,
                new ByteArrayInputStream(new byte[0]));
        }

        private static String assetMime(String path) {
            if (path.equals("/index.html")) return "text/html";
            if (path.equals("/style.css")) return "text/css";
            if (path.equals("/app.js") || path.equals("/body.js") || path.equals("/report.js")) return "text/javascript";
            if (path.matches("/faces/([1-9]|10)\\.png")) return "image/png";
            return null;
        }
    }

    @Override public void onBackPressed() { evaluate("window.minDagBack()"); }
    @Override protected void onResume() { super.onResume(); evaluate("window.minDagResume()"); }
    @Override protected void onDestroy() { worker.shutdown(); web.destroy(); super.onDestroy(); }

    private void evaluate(String script) {
        runOnUiThread(() -> { if (!isDestroyed() && web != null) web.evaluateJavascript(script, null); });
    }

    private synchronized SecretKey storageKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY)) return (SecretKey) keyStore.getKey(KEY, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }

    private static String pinDigest(String pin, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(pin.toCharArray(), salt, 100_000, 256);
        try {
            byte[] hash = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            return Base64.encodeToString(hash, Base64.NO_WRAP);
        } finally {
            spec.clearPassword();
        }
    }

    private final class Bridge {
        @JavascriptInterface public synchronized String load() {
            String stored = getSharedPreferences("min-dag", MODE_PRIVATE).getString("data", "");
            if (stored.isEmpty()) return "{}";
            try {
                byte[] bytes = Base64.decode(stored, Base64.NO_WRAP);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, storageKey(), new GCMParameterSpec(128, bytes, 0, 12));
                return new String(cipher.doFinal(Arrays.copyOfRange(bytes, 12, bytes.length)), StandardCharsets.UTF_8);
            } catch (Exception failure) { return ""; }
        }

        @JavascriptInterface public synchronized boolean save(String json) {
            try {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, storageKey());
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                bytes.write(cipher.getIV());
                bytes.write(cipher.doFinal(json.getBytes(StandardCharsets.UTF_8)));
                return getSharedPreferences("min-dag", MODE_PRIVATE).edit()
                    .putString("data", Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)).commit();
            } catch (Exception failure) { return false; }
        }

        @JavascriptInterface public String createPin(String pin) {
            try {
                byte[] salt = new byte[16];
                new SecureRandom().nextBytes(salt);
                return Base64.encodeToString(salt, Base64.NO_WRAP) + "." + pinDigest(pin, salt);
            } catch (Exception failure) { return ""; }
        }

        @JavascriptInterface public boolean checkPin(String pin, String stored) {
            try {
                String[] parts = stored.split("\\.", 2);
                String digest = pinDigest(pin, Base64.decode(parts[0], Base64.NO_WRAP));
                return MessageDigest.isEqual(digest.getBytes(StandardCharsets.UTF_8), parts[1].getBytes(StandardCharsets.UTF_8));
            } catch (Exception failure) { return false; }
        }

        @JavascriptInterface public void calendarPermission() {
            runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.READ_CALENDAR}, 1));
        }

        @JavascriptInterface public void calendar(long start, long end, String selection, int request) {
            worker.execute(() -> {
                JSONObject result;
                try { result = readCalendar(start, end, new JSONArray(selection)); }
                catch (Exception failure) { result = new JSONObject(java.util.Collections.singletonMap("status", "error")); }
                reply("minDagCalendar", request, result);
            });
        }

        @JavascriptInterface public void weather(String city, boolean lookup, int request) {
            worker.execute(() -> {
                JSONObject result;
                try {
                    String[] position = city.split(",", 2);
                    String url = lookup
                        ? "https://geocoding-api.open-meteo.com/v1/search?count=8&language=da&name=" + Uri.encode(city)
                        : "https://api.open-meteo.com/v1/forecast?latitude=" + Uri.encode(position[0])
                            + "&longitude=" + Uri.encode(position[1]) + "&timezone=auto&forecast_days=1"
                            + "&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=ms"
                            + "&daily=temperature_2m_min,temperature_2m_max&hourly=precipitation_probability";
                    result = getJson(url);
                } catch (Exception failure) { result = new JSONObject(java.util.Collections.singletonMap("error", true)); }
                reply(lookup ? "minDagCities" : "minDagWeather", request, result);
            });
        }

        @JavascriptInterface public void report(String report, String fileName) {
            runOnUiThread(() -> {
                pendingReport = report;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("application/pdf").putExtra(Intent.EXTRA_TITLE, fileName);
                try { startActivityForResult(intent, 2); }
                catch (ActivityNotFoundException unavailable) {
                    pendingReport = null;
                    showToast("Tabletten kan ikke åbne filvælgeren.");
                }
            });
        }
    }

    private void reply(String method, int request, JSONObject result) {
        evaluate("window." + method + "(" + request + "," + JSONObject.quote(result.toString())
            .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029") + ")");
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 1) evaluate("window.minDagRefreshCalendar()");
    }

    private JSONObject readCalendar(long start, long end, JSONArray selected) throws Exception {
        JSONObject result = new JSONObject();
        if (checkSelfPermission(Manifest.permission.READ_CALENDAR) != PackageManager.PERMISSION_GRANTED)
            return result.put("status", "permission");

        JSONArray calendars = new JSONArray();
        String[] calendarColumns = { "_id", "calendar_displayName", "account_name" };
        try (Cursor cursor = getContentResolver().query(CalendarContract.Calendars.CONTENT_URI, calendarColumns,
                null, null, "calendar_displayName ASC")) {
            if (cursor != null) while (cursor.moveToNext()) {
                calendars.put(new JSONObject().put("id", cursor.getString(0)).put("name", cursor.getString(1))
                    .put("account", cursor.getString(2)));
            }
        }

        JSONArray events = new JSONArray();
        if (selected.length() > 0) {
            String[] ids = new String[selected.length()];
            String[] placeholders = new String[ids.length];
            for (int index = 0; index < ids.length; index++) {
                ids[index] = selected.getString(index);
                placeholders[index] = "?";
            }
            Uri.Builder range = CalendarContract.Instances.CONTENT_URI.buildUpon();
            ContentUris.appendId(range, start);
            ContentUris.appendId(range, end);
            String[] columns = { "title", "begin", "end", "allDay", "eventLocation" };
            String where = "calendar_id IN (" + String.join(",", placeholders) + ") AND (eventStatus IS NULL OR eventStatus != 2)";
            try (Cursor cursor = getContentResolver().query(range.build(), columns, where, ids, "begin ASC")) {
                if (cursor != null) while (cursor.moveToNext() && events.length() < 80) {
                    events.put(new JSONObject().put("title", cursor.getString(0)).put("start", cursor.getLong(1))
                        .put("end", cursor.getLong(2)).put("allDay", cursor.getInt(3) != 0).put("place", cursor.getString(4)));
                }
            }
        }
        return result.put("status", "ok").put("calendars", calendars).put("events", events);
    }

    private static JSONObject getJson(String url) throws Exception {
        HttpsURLConnection connection = (HttpsURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(9000);
        connection.setReadTimeout(9000);
        connection.setInstanceFollowRedirects(false);
        try (InputStream input = connection.getInputStream()) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
            return new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
        } finally { connection.disconnect(); }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != 2) return;
        String report = pendingReport;
        pendingReport = null;
        if (result == RESULT_OK && data != null && report != null) {
            Uri destination = data.getData();
            worker.execute(() -> savePdf(destination, report));
        }
    }

    private void savePdf(Uri destination, String report) {
        PdfDocument pdf = new PdfDocument();
        try (OutputStream out = getContentResolver().openOutputStream(destination, "w")) {
            TextPaint paint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
            paint.setTextSize(11);
            paint.setColor(Color.rgb(23, 52, 53));
            StaticLayout layout = StaticLayout.Builder.obtain(report, 0, report.length(), paint, 511)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL).setLineSpacing(3, 1).build();
            int line = 0;
            int pageNumber = 1;
            while (line < layout.getLineCount()) {
                int top = layout.getLineTop(line);
                do { line++; } while (line < layout.getLineCount() && layout.getLineBottom(line) - top <= 750);
                int bottom = layout.getLineTop(line);
                PdfDocument.Page page = pdf.startPage(new PdfDocument.PageInfo.Builder(595, 842, pageNumber).create());
                page.getCanvas().save();
                page.getCanvas().translate(42, 42);
                page.getCanvas().clipRect(0, 0, 511, bottom - top);
                page.getCanvas().translate(0, -top);
                layout.draw(page.getCanvas());
                page.getCanvas().restore();
                page.getCanvas().drawText("Min Dag  ·  Side " + pageNumber++, 42, 816, paint);
                pdf.finishPage(page);
            }
            if (out == null) throw new IOException("No output stream");
            pdf.writeTo(out);
            showToast("PDF gemt");
        } catch (Exception failure) {
            showToast("PDF kunne ikke gemmes.");
        } finally {
            pdf.close();
        }
    }

    private void showToast(String message) {
        runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show());
    }
}
