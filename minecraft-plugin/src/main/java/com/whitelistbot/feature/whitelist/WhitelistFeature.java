package com.whitelistbot.feature.whitelist;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.whitelistbot.WhitelistBotPlugin;
import com.whitelistbot.config.ConfigManager;
import com.whitelistbot.data.DataStore;
import com.whitelistbot.feature.Feature;
import com.whitelistbot.whitelist.WhitelistManager;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

public class WhitelistFeature implements Feature {

    private final Gson gson = new Gson();
    private WhitelistBotPlugin plugin;
    private WhitelistManager whitelist;
    private ConfigManager config;
    private DataStore dataStore;

    @Override
    public String getName() {
        return "whitelist";
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    @Override
    public void onEnable(WhitelistBotPlugin plugin) {
        this.plugin = plugin;
        this.whitelist = plugin.getWhitelistManager();
        this.config = plugin.getConfigManager();
        this.dataStore = plugin.getDataStore();
    }

    @Override
    public void onDisable() {
        this.plugin = null;
        this.whitelist = null;
        this.config = null;
        this.dataStore = null;
    }

    @Override
    public List<Endpoint> getEndpoints() {
        return Arrays.asList(
            new HealthEndpoint(),
            new AddEndpoint(),
            new RemoveEndpoint(),
            new ConfigEndpoint()
        );
    }

    private boolean authenticate(HttpExchange exchange) {
        String key = exchange.getRequestHeaders().getFirst("X-API-Key");
        if (key == null || config.getApiKey() == null) return false;
        return constantTimeEquals(config.getApiKey(), key);
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a.length() != b.length()) return false;
        int result = 0;
        for (int i = 0; i < a.length(); i++) {
            result |= a.charAt(i) ^ b.charAt(i);
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

    private void sendSuccess(HttpExchange exchange, String message) throws IOException {
        JsonObject obj = new JsonObject();
        obj.addProperty("success", true);
        if (message != null) obj.addProperty("message", message);
        sendJson(exchange, 200, gson.toJson(obj));
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

    private JsonObject parseBody(HttpExchange exchange) throws IOException {
        String body = readBody(exchange);
        return gson.fromJson(body, JsonObject.class);
    }

    private class HealthEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/health";
        }

        @Override
        public HttpHandler getHandler() {
            return exchange -> {
                try {
                    if (!authenticate(exchange)) {
                        sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    sendSuccess(exchange, "OK");
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Health error", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }

    private class AddEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/whitelist/add";
        }

        @Override
        public HttpHandler getHandler() {
            return exchange -> {
                try {
                    if (!authenticate(exchange)) {
                        sendError(exchange, 401, "Unauthorized");
                        return;
                    }

                    JsonObject req = parseBody(exchange);
                    if (req == null || !req.has("player")) {
                        sendError(exchange, 400, "Missing 'player' field");
                        return;
                    }

                    String player = req.get("player").getAsString();
                    if (player.length() < 3 || player.length() > 16 || !player.matches("[a-zA-Z0-9_]+")) {
                        sendError(exchange, 400, "Invalid Minecraft username");
                        return;
                    }

                    boolean added = whitelist.addPlayer(player);
                    if (added) {
                        Bukkit.getScheduler().callSyncMethod(plugin, () -> {
                            OfflinePlayer off = Bukkit.getOfflinePlayer(player);
                            dataStore.setLinkTimestamp(off.getUniqueId());
                            plugin.getLogger().info("Whitelisted: " + player);
                            return null;
                        }).get(10, TimeUnit.SECONDS);
                        sendSuccess(exchange, player + " has been whitelisted");
                    } else {
                        sendError(exchange, 409, player + " is already whitelisted");
                    }
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in whitelist/add", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }

    private class RemoveEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/whitelist/remove";
        }

        @Override
        public HttpHandler getHandler() {
            return exchange -> {
                try {
                    if (!authenticate(exchange)) {
                        sendError(exchange, 401, "Unauthorized");
                        return;
                    }

                    JsonObject req = parseBody(exchange);
                    if (req == null || !req.has("player")) {
                        sendError(exchange, 400, "Missing 'player' field");
                        return;
                    }

                    String player = req.get("player").getAsString();
                    boolean removed = whitelist.removePlayer(player);

                    if (removed) {
                        plugin.getLogger().info("Unwhitelisted: " + player);
                        sendSuccess(exchange, player + " has been unwhitelisted");
                    } else {
                        sendError(exchange, 404, player + " is not whitelisted");
                    }
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in whitelist/remove", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }

    private class ConfigEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/config";
        }

        @Override
        public HttpHandler getHandler() {
            return exchange -> {
                try {
                    if (!authenticate(exchange)) {
                        sendError(exchange, 401, "Unauthorized");
                        return;
                    }

                    String method = exchange.getRequestMethod();

                    if ("GET".equals(method)) {
                        JsonArray cooldownOpts = new JsonArray();
                        for (String key : ConfigManager.COOLDOWN_KEYS) {
                            cooldownOpts.add(key);
                        }

                        JsonArray maxRange = new JsonArray();
                        for (int i = 1; i <= 5; i++) {
                            maxRange.add(i);
                        }

                        JsonObject unlink = new JsonObject();
                        unlink.addProperty("allow_user_unlink", config.isAllowUserUnlink());
                        unlink.addProperty("cooldown", config.getCooldownKey());
                        unlink.add("cooldown_options", cooldownOpts);

                        JsonObject antiAlt = new JsonObject();
                        antiAlt.addProperty("enabled", config.isAntiAltEnabled());
                        antiAlt.addProperty("max_accounts", config.getAntiAltMaxAccounts());
                        antiAlt.add("max_accounts_range", maxRange);

                        JsonObject data = new JsonObject();
                        data.add("unlink", unlink);
                        data.add("anti_alt", antiAlt);

                        data.addProperty("success", true);
                        sendJson(exchange, 200, gson.toJson(data));

                    } else if ("POST".equals(method)) {
                        JsonObject req = parseBody(exchange);
                        if (req == null) {
                            sendError(exchange, 400, "Invalid JSON");
                            return;
                        }

                        if (req.has("unlink")) {
                            JsonObject u = req.getAsJsonObject("unlink");
                            if (u.has("allow_user_unlink")) {
                                config.setAllowUserUnlink(u.get("allow_user_unlink").getAsBoolean());
                            }
                            if (u.has("cooldown")) {
                                config.setCooldownByKey(u.get("cooldown").getAsString());
                            }
                        }

                        if (req.has("anti_alt")) {
                            JsonObject a = req.getAsJsonObject("anti_alt");
                            if (a.has("enabled")) {
                                config.setAntiAltEnabled(a.get("enabled").getAsBoolean());
                            }
                            if (a.has("max_accounts")) {
                                config.setAntiAltMaxAccounts(a.get("max_accounts").getAsInt());
                            }
                        }

                        plugin.saveConfig();
                        sendSuccess(exchange, "Config updated");

                    } else {
                        sendError(exchange, 405, "Method not allowed");
                    }
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/config", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
