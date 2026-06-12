package com.whitelistbot.feature.economy;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.whitelistbot.WhitelistBotPlugin;
import com.whitelistbot.config.ConfigManager;
import com.whitelistbot.feature.Feature;
import com.whitelistbot.feature.FeatureUtils;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;
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

    private double getPlayerBalance(String playerName) throws Exception {
        if (!FeatureUtils.isValidMinecraftUsername(playerName)) {
            throw new IllegalArgumentException("Invalid player name");
        }
        OfflinePlayer player = Bukkit.getScheduler().callSyncMethod(plugin, () -> {
            OfflinePlayer p = Bukkit.getOfflinePlayerIfCached(playerName);
            return p != null ? p : Bukkit.getOfflinePlayer(playerName);
        }).get(10, TimeUnit.SECONDS);
        return (double) economy.getClass().getMethod("getBalance", OfflinePlayer.class).invoke(economy, player);
    }

    private void givePlayerMoney(String playerName, double amount) throws Exception {
        if (!FeatureUtils.isValidMinecraftUsername(playerName)) {
            throw new IllegalArgumentException("Invalid player name");
        }
        OfflinePlayer player = Bukkit.getScheduler().callSyncMethod(plugin, () -> {
            OfflinePlayer p = Bukkit.getOfflinePlayerIfCached(playerName);
            return p != null ? p : Bukkit.getOfflinePlayer(playerName);
        }).get(10, TimeUnit.SECONDS);
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
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    if (!"GET".equals(exchange.getRequestMethod())) {
                        FeatureUtils.sendError(exchange, 405, "Method not allowed");
                        return;
                    }

                    if (!vaultAvailable) {
                        FeatureUtils.sendError(exchange, 501, "Vault is not installed on this server");
                        return;
                    }

                    String query = exchange.getRequestURI().getQuery();
                    String player = null;
                    if (query != null && query.startsWith("player=")) {
                        player = query.substring(7);
                    }
                    if (player == null || player.isEmpty()) {
                        FeatureUtils.sendError(exchange, 400, "Missing 'player' query parameter");
                        return;
                    }

                    double balance = getPlayerBalance(player);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("player", player);
                    res.addProperty("balance", balance);
                    FeatureUtils.sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/economy/balance", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
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
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    if (!"POST".equals(exchange.getRequestMethod())) {
                        FeatureUtils.sendError(exchange, 405, "Method not allowed");
                        return;
                    }

                    if (!vaultAvailable) {
                        FeatureUtils.sendError(exchange, 501, "Vault is not installed on this server");
                        return;
                    }

                    JsonObject req = FeatureUtils.parseBody(exchange);
                    if (req == null || !req.has("player") || !req.has("amount")) {
                        FeatureUtils.sendError(exchange, 400, "Missing 'player' or 'amount' field");
                        return;
                    }

                    String player = req.get("player").getAsString();
                    double amount = req.get("amount").getAsDouble();

                    if (!Double.isFinite(amount) || amount <= 0) {
                        FeatureUtils.sendError(exchange, 400, "'amount' must be a positive finite number");
                        return;
                    }

                    givePlayerMoney(player, amount);

                    String reason = req.has("reason") ? req.get("reason").getAsString() : "";
                    plugin.getLogger().info("[Economy] +" + amount + " to " + player + (reason.isEmpty() ? "" : " (" + reason + ")"));

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", "Given " + amount + " to " + player);
                    FeatureUtils.sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/economy/give", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
