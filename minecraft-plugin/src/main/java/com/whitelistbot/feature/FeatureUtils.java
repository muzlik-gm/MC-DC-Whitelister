package com.whitelistbot.feature;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class FeatureUtils {

    private static final Gson GSON = new Gson();

    public static boolean authenticate(HttpExchange exchange, String apiKey) {
        String key = exchange.getRequestHeaders().getFirst("X-API-Key");
        if (key == null || apiKey == null) return false;
        if (key.length() != apiKey.length()) return false;
        int result = 0;
        for (int i = 0; i < key.length(); i++) {
            result |= key.charAt(i) ^ apiKey.charAt(i);
        }
        return result == 0;
    }

    public static void sendJson(HttpExchange exchange, int code, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(code, bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }

    public static void sendError(HttpExchange exchange, int code, String message) throws IOException {
        JsonObject obj = new JsonObject();
        obj.addProperty("success", false);
        obj.addProperty("error", message);
        sendJson(exchange, code, GSON.toJson(obj));
    }

    public static void sendSuccess(HttpExchange exchange, String message) throws IOException {
        JsonObject obj = new JsonObject();
        obj.addProperty("success", true);
        if (message != null) obj.addProperty("message", message);
        sendJson(exchange, 200, GSON.toJson(obj));
    }

    public static String readBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody();
             ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[4096];
            int n;
            while ((n = is.read(buf)) != -1) {
                bos.write(buf, 0, n);
            }
            return bos.toString(StandardCharsets.UTF_8);
        }
    }

    public static JsonObject parseBody(HttpExchange exchange) throws IOException {
        String body = readBody(exchange);
        return GSON.fromJson(body, JsonObject.class);
    }

    public static boolean isValidMinecraftUsername(String name) {
        return name != null && name.length() >= 3 && name.length() <= 16 && name.matches("[a-zA-Z0-9_]+");
    }
}
