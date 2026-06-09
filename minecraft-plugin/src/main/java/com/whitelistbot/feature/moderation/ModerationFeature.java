package com.whitelistbot.feature.moderation;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.whitelistbot.WhitelistBotPlugin;
import com.whitelistbot.config.ConfigManager;
import com.whitelistbot.feature.Feature;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.logging.Level;

public class ModerationFeature implements Feature {

    private final Gson gson = new Gson();
    private WhitelistBotPlugin plugin;
    private ConfigManager config;

    @Override
    public String getName() {
        return "moderation";
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
        return Arrays.asList(
            new BanEndpoint(),
            new KickEndpoint(),
            new WarnEndpoint()
        );
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

    private class BanEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/moderation/ban";
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
                    if (req == null || !req.has("player")) {
                        sendError(exchange, 400, "Missing 'player' field");
                        return;
                    }

                    String player = req.get("player").getAsString();
                    String reason = req.has("reason") ? req.get("reason").getAsString() : "No reason provided.";

                    Bukkit.getBanList(org.bukkit.BanList.Type.NAME).addBan(player, reason, (Date) null, "Discord Bot");
                    Player online = Bukkit.getPlayerExact(player);
                    if (online != null) {
                        online.kickPlayer("Banned: " + reason);
                    }

                    plugin.getLogger().info("Banned: " + player + " — " + reason);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", player + " has been banned");
                    sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/moderation/ban", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }

    private class KickEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/moderation/kick";
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
                    if (req == null || !req.has("player")) {
                        sendError(exchange, 400, "Missing 'player' field");
                        return;
                    }

                    String player = req.get("player").getAsString();
                    String reason = req.has("reason") ? req.get("reason").getAsString() : "No reason provided.";

                    Player online = Bukkit.getPlayerExact(player);
                    if (online == null) {
                        sendError(exchange, 404, player + " is not online");
                        return;
                    }

                    online.kickPlayer("Kicked: " + reason);
                    plugin.getLogger().info("Kicked: " + player + " — " + reason);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", player + " has been kicked");
                    sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/moderation/kick", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }

    private class WarnEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/moderation/warn";
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
                    if (req == null || !req.has("player")) {
                        sendError(exchange, 400, "Missing 'player' field");
                        return;
                    }

                    String player = req.get("player").getAsString();
                    String reason = req.has("reason") ? req.get("reason").getAsString() : "No reason provided.";

                    Player online = Bukkit.getPlayerExact(player);
                    if (online != null) {
                        online.sendMessage("§e[Warning] §f" + reason);
                    }

                    plugin.getLogger().info("Warned: " + player + " — " + reason);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", player + " has been warned");
                    sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/moderation/warn", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
