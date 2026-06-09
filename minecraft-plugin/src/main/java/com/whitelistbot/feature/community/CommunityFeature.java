package com.whitelistbot.feature.community;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
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
import java.util.List;
import java.util.logging.Level;

public class CommunityFeature implements Feature {

    private final Gson gson = new Gson();
    private WhitelistBotPlugin plugin;
    private ConfigManager config;

    @Override
    public String getName() {
        return "community";
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
            new RewardEndpoint(),
            new PlayersEndpoint(),
            new OnlineEndpoint()
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

    private class RewardEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/community/reward";
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
                    if (req == null || !req.has("player") || !req.has("command")) {
                        sendError(exchange, 400, "Missing 'player' or 'command' field");
                        return;
                    }

                    String player = req.get("player").getAsString();
                    String command = req.get("command").getAsString();

                    Bukkit.getScheduler().callSyncMethod(plugin, () ->
                        Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command.replace("%player%", player))
                    );

                    plugin.getLogger().info("[Community Reward] >> " + command.replace("%player%", player));

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", "Command queued for execution");
                    sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/community/reward", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }

    private class PlayersEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/community/players";
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

                    JsonArray players = new JsonArray();
                    for (Player p : Bukkit.getOnlinePlayers()) {
                        players.add(p.getName());
                    }

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.add("players", players);
                    sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/community/players", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }

    private class OnlineEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/community/online";
        }

        @Override
        public HttpHandler getHandler() {
            return exchange -> {
                try {
                    if (!authenticate(exchange)) {
                        sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    if (!"GET".equals(exchange.getRequestMethod())) {
                        sendError(exchange, 405, "Method not allowed");
                        return;
                    }

                    JsonArray players = new JsonArray();
                    for (Player p : Bukkit.getOnlinePlayers()) {
                        players.add(p.getName());
                    }

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("count", Bukkit.getOnlinePlayers().size());
                    res.addProperty("max", Bukkit.getMaxPlayers());
                    res.add("players", players);
                    sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/community/online", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
