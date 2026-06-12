package com.whitelistbot.feature.rolesync;

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

import java.io.*;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
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

    private void setLuckPermsGroup(String playerName, String group) throws Exception {
        Object lpInstance = Class.forName("net.luckperms.api.LuckPerms")
                .getMethod("getProvider")
                .invoke(null);

        Object userManager = lpInstance.getClass()
                .getMethod("getUserManager")
                .invoke(lpInstance);

        OfflinePlayer offlinePlayer = Bukkit.getScheduler().callSyncMethod(plugin, () -> {
            OfflinePlayer p = Bukkit.getOfflinePlayerIfCached(playerName);
            return p != null ? p : Bukkit.getOfflinePlayer(playerName);
        }).get(10, TimeUnit.SECONDS);
        UUID uuid = offlinePlayer.getUniqueId();

        Object userFuture = userManager.getClass()
                .getMethod("loadUser", UUID.class)
                .invoke(userManager, uuid);

        Object user = ((CompletableFuture<?>) userFuture).get(10, TimeUnit.SECONDS);

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
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    if (!"POST".equals(exchange.getRequestMethod())) {
                        FeatureUtils.sendError(exchange, 405, "Method not allowed");
                        return;
                    }

                    if (!luckPermsAvailable) {
                        FeatureUtils.sendError(exchange, 501, "LuckPerms is not installed on this server");
                        return;
                    }

                    JsonObject req = FeatureUtils.parseBody(exchange);
                    if (req == null || !req.has("player") || !req.has("group")) {
                        FeatureUtils.sendError(exchange, 400, "Missing 'player' or 'group' field");
                        return;
                    }

                    String player = req.get("player").getAsString();
                    String group = req.get("group").getAsString();

                    setLuckPermsGroup(player, group);
                    plugin.getLogger().info("Role sync: " + player + " -> " + group);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", "Group set to " + group);
                    FeatureUtils.sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/roles/sync", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
