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
import com.whitelistbot.feature.FeatureUtils;
import com.whitelistbot.whitelist.WhitelistManager;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;

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

    private class HealthEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/health";
        }

        @Override
        public HttpHandler getHandler() {
            return exchange -> {
                try {
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    FeatureUtils.sendSuccess(exchange, "OK");
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Health error", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
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
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
                        return;
                    }

                    JsonObject req = FeatureUtils.parseBody(exchange);
                    if (req == null || !req.has("player")) {
                        FeatureUtils.sendError(exchange, 400, "Missing 'player' field");
                        return;
                    }

                    String player = req.get("player").getAsString();
                    if (!FeatureUtils.isValidMinecraftUsername(player)) {
                        FeatureUtils.sendError(exchange, 400, "Invalid Minecraft username");
                        return;
                    }

                    boolean added = whitelist.addPlayer(player);
                    if (added) {
                        Bukkit.getScheduler().callSyncMethod(plugin, () -> {
                            OfflinePlayer off = Bukkit.getOfflinePlayerIfCached(player);
                            if (off != null) {
                                dataStore.setLinkTimestamp(off.getUniqueId());
                            }
                            plugin.getLogger().info("Whitelisted: " + player);
                            return null;
                        }).get(10, TimeUnit.SECONDS);
                        FeatureUtils.sendSuccess(exchange, player + " has been whitelisted");
                    } else {
                        FeatureUtils.sendError(exchange, 409, player + " is already whitelisted");
                    }
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in whitelist/add", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
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
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
                        return;
                    }

                    JsonObject req = FeatureUtils.parseBody(exchange);
                    if (req == null || !req.has("player")) {
                        FeatureUtils.sendError(exchange, 400, "Missing 'player' field");
                        return;
                    }

                    String player = req.get("player").getAsString();
                    boolean removed = whitelist.removePlayer(player);

                    if (removed) {
                        plugin.getLogger().info("Unwhitelisted: " + player);
                        FeatureUtils.sendSuccess(exchange, player + " has been unwhitelisted");
                    } else {
                        FeatureUtils.sendError(exchange, 404, player + " is not whitelisted");
                    }
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in whitelist/remove", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
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
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
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
                        FeatureUtils.sendJson(exchange, 200, gson.toJson(data));

                    } else if ("POST".equals(method)) {
                        JsonObject req = FeatureUtils.parseBody(exchange);
                        if (req == null) {
                            FeatureUtils.sendError(exchange, 400, "Invalid JSON");
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
                        FeatureUtils.sendSuccess(exchange, "Config updated");

                    } else {
                        FeatureUtils.sendError(exchange, 405, "Method not allowed");
                    }
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/config", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
