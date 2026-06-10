package com.whitelistbot.feature.economy;

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
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.logging.Level;

public class EconomyFeature implements Feature {

    private final Gson gson = new Gson();
    private WhitelistBotPlugin plugin;
    private ConfigManager config;
    private boolean vaultAvailable;
    private Object economy;

    @Override
    public String getName() {
        return "economy";
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    @Override
    public void onEnable(WhitelistBotPlugin plugin) {
        this.plugin = plugin;
        this.config = plugin.getConfigManager();

        try {
            if (Bukkit.getPluginManager().getPlugin("Vault") != null) {
                Class<?> economyClass = Class.forName("net.milkbowl.vault.economy.Economy");
                Object provider = Bukkit.getServicesManager().getRegistration(economyClass);
                if (provider != null) {
                    economy = economyClass.cast(provider.getClass().getMethod("getProvider").invoke(provider));
                    vaultAvailable = true;
                    plugin.getLogger().info("Vault economy detected");
                }
            }
        } catch (Exception e) {
            vaultAvailable = false;
            plugin.getLogger().info("Vault not found — economy endpoints will return 501");
        }

        if (!vaultAvailable) {
            plugin.getLogger().info("Vault not found — economy endpoints will return 501");
        }
    }

    @Override
    public void onDisable() {
        this.plugin = null;
        this.config = null;
        this.economy = null;
    }

    @Override
    public List<Endpoint> getEndpoints() {
        return Arrays.asList(
            new BalanceEndpoint(),
            new GiveEndpoint()
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

    private double getPlayerBalance(String playerName) throws Exception {
        OfflinePlayer player = Bukkit.getOfflinePlayer(playerName);
        return (double) economy.getClass().getMethod("getBalance", OfflinePlayer.class).invoke(economy, player);
    }

    private void givePlayerMoney(String playerName, double amount) throws Exception {
        OfflinePlayer player = Bukkit.getOfflinePlayer(playerName);
        economy.getClass().getMethod("depositPlayer", OfflinePlayer.class, double.class).invoke(economy, player, amount);
    }

    private class BalanceEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/economy/balance";
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

                    if (!vaultAvailable) {
                        sendError(exchange, 501, "Vault is not installed on this server");
                        return;
                    }

                    String query = exchange.getRequestURI().getQuery();
                    String player = null;
                    if (query != null && query.startsWith("player=")) {
                        player = query.substring(7);
                    }
                    if (player == null || player.isEmpty()) {
                        sendError(exchange, 400, "Missing 'player' query parameter");
                        return;
                    }

                    double balance = getPlayerBalance(player);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("player", player);
                    res.addProperty("balance", balance);
                    sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/economy/balance", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }

    private class GiveEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/economy/give";
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

                    if (!vaultAvailable) {
                        sendError(exchange, 501, "Vault is not installed on this server");
                        return;
                    }

                    String body = readBody(exchange);
                    JsonObject req = gson.fromJson(body, JsonObject.class);
                    if (req == null || !req.has("player") || !req.has("amount")) {
                        sendError(exchange, 400, "Missing 'player' or 'amount' field");
                        return;
                    }

                    String player = req.get("player").getAsString();
                    double amount = req.get("amount").getAsDouble();

                    givePlayerMoney(player, amount);

                    String reason = req.has("reason") ? req.get("reason").getAsString() : "";
                    plugin.getLogger().info("[Economy] +" + amount + " to " + player + (reason.isEmpty() ? "" : " (" + reason + ")"));

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", "Given " + amount + " to " + player);
                    sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/economy/give", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
