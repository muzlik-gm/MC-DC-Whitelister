package com.whitelistbot.feature.console;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.whitelistbot.WhitelistBotPlugin;
import com.whitelistbot.config.ConfigManager;
import com.whitelistbot.feature.Feature;
import org.bukkit.Bukkit;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.logging.Level;

public class ConsoleFeature implements Feature {

    private final Gson gson = new Gson();
    private WhitelistBotPlugin plugin;
    private ConfigManager config;

    @Override
    public String getName() {
        return "console";
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    @Override
    public void onEnable(WhitelistBotPlugin plugin) {
        this.plugin = plugin;
        this.config = plugin.getConfigManager();
    }

    @Override
    public void onDisable() {
        this.plugin = null;
        this.config = null;
    }

    @Override
    public List<Endpoint> getEndpoints() {
        return Arrays.asList(new ExecuteEndpoint());
    }

    private boolean authenticate(HttpExchange exchange) {
        String key = exchange.getRequestHeaders().getFirst("X-API-Key");
        if (key == null || config.getApiKey() == null) return false;
        if (key.length() != config.getApiKey().length()) return false;
        int result = 0;
        for (int i = 0; i < key.length(); i++) {
            result |= key.charAt(i) ^ config.getApiKey().charAt(i);
        }
        return result == 0;
    }

    private void sendJson(HttpExchange exchange, int code, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(code, bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }

    private void sendError(HttpExchange exchange, int code, String message) throws IOException {
        JsonObject obj = new JsonObject();
        obj.addProperty("success", false);
        obj.addProperty("error", message);
        sendJson(exchange, code, gson.toJson(obj));
    }

    private String readBody(HttpExchange exchange) throws IOException {
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

    private class ExecuteEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/console/execute";
        }

        @Override
        public HttpHandler getHandler() {
            return exchange -> {
                try {
                    if (!authenticate(exchange)) {
                        sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    if (!"POST".equals(exchange.getRequestMethod())) {
                        sendError(exchange, 405, "Method not allowed");
                        return;
                    }

                    String body = readBody(exchange);
                    JsonObject req = gson.fromJson(body, JsonObject.class);
                    if (req == null || !req.has("command")) {
                        sendError(exchange, 400, "Missing 'command' field");
                        return;
                    }

                    String command = req.get("command").getAsString();
                    if (command.length() > 256) {
                        sendError(exchange, 400, "Command too long (max 256 chars)");
                        return;
                    }

                    String lower = command.toLowerCase();
                    if (lower.contains("stop") || lower.contains("restart") || lower.contains("reload") || lower.matches(".*\\brl\\b.*")) {
                        sendError(exchange, 403, "Forbidden command");
                        return;
                    }

                    final StringBuilder output = new StringBuilder();
                    // Capture output using server console command sender gives us
                    boolean success = Bukkit.getScheduler().callSyncMethod(plugin, () ->
                        Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command)
                    ).get();

                    plugin.getLogger().info("[Remote Console] >> " + command);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("output", success ? "Command executed." : "Command returned false.");
                    sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/console/execute", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
