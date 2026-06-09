package com.whitelistbot.feature.rolesync;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.whitelistbot.WhitelistBotPlugin;
import com.whitelistbot.config.ConfigManager;
import com.whitelistbot.feature.Feature;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;

import java.io.*;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;

public class RoleSyncFeature implements Feature {

    private final Gson gson = new Gson();
    private WhitelistBotPlugin plugin;
    private ConfigManager config;
    private boolean luckPermsAvailable;

    @Override
    public String getName() {
        return "rolesync";
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    @Override
    public void onEnable(WhitelistBotPlugin plugin) {
        this.plugin = plugin;
        this.config = plugin.getConfigManager();
        this.luckPermsAvailable = Bukkit.getPluginManager().getPlugin("LuckPerms") != null;
        if (luckPermsAvailable) {
            plugin.getLogger().info("LuckPerms detected — role sync enabled");
        } else {
            plugin.getLogger().info("LuckPerms not found — role sync will return 501");
        }
    }

    @Override
    public void onDisable() {
        this.plugin = null;
        this.config = null;
    }

    @Override
    public List<Endpoint> getEndpoints() {
        return Collections.singletonList(new SyncEndpoint());
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

    private void setLuckPermsGroup(String playerName, String group) throws Exception {
        Object lpInstance = Class.forName("net.luckperms.api.LuckPerms")
                .getMethod("getProvider")
                .invoke(null);

        Object userManager = lpInstance.getClass()
                .getMethod("getUserManager")
                .invoke(lpInstance);

        OfflinePlayer offlinePlayer = Bukkit.getOfflinePlayer(playerName);
        UUID uuid = offlinePlayer.getUniqueId();

        Object userFuture = userManager.getClass()
                .getMethod("loadUser", UUID.class)
                .invoke(userManager, uuid);

        Object user = ((CompletableFuture<?>) userFuture).get();

        Method setPrimaryGroup = user.getClass().getMethod("setPrimaryGroup", String.class);
        setPrimaryGroup.invoke(user, group);

        Method saveUser = userManager.getClass().getMethod("saveUser", Class.forName("net.luckperms.api.model.user.User"));
        saveUser.invoke(userManager, user);
    }

    private class SyncEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/roles/sync";
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

                    if (!luckPermsAvailable) {
                        sendError(exchange, 501, "LuckPerms is not installed on this server");
                        return;
                    }

                    String body = readBody(exchange);
                    JsonObject req = gson.fromJson(body, JsonObject.class);
                    if (req == null || !req.has("player") || !req.has("group")) {
                        sendError(exchange, 400, "Missing 'player' or 'group' field");
                        return;
                    }

                    String player = req.get("player").getAsString();
                    String group = req.get("group").getAsString();

                    setLuckPermsGroup(player, group);
                    plugin.getLogger().info("Role sync: " + player + " -> " + group);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", "Group set to " + group);
                    sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/roles/sync", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
