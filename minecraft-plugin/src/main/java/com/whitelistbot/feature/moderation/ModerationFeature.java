package com.whitelistbot.feature.moderation;

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
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerChatEvent;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

public class ModerationFeature implements Feature, Listener {

    private final Gson gson = new Gson();
    private final Map<UUID, MuteEntry> mutedPlayers = new ConcurrentHashMap<>();
    private WhitelistBotPlugin plugin;
    private ConfigManager config;

    private static class MuteEntry {
        final long expiresAt;
        final String reason;

        MuteEntry(long expiresAt, String reason) {
            this.expiresAt = expiresAt;
            this.reason = reason;
        }
    }

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
        Bukkit.getPluginManager().registerEvents(this, plugin);
    }

    @Override
    public void onDisable() {
        this.plugin = null;
        this.config = null;
        this.mutedPlayers.clear();
    }

    @Override
    public List<Endpoint> getEndpoints() {
        return Arrays.asList(
            new BanEndpoint(),
            new KickEndpoint(),
            new WarnEndpoint(),
            new MuteEndpoint(),
            new UnmuteEndpoint()
        );
    }

    @EventHandler
    public void onPlayerChat(AsyncPlayerChatEvent event) {
        MuteEntry entry = mutedPlayers.get(event.getPlayer().getUniqueId());
        if (entry != null) {
            if (System.currentTimeMillis() < entry.expiresAt) {
                event.setCancelled(true);
                event.getPlayer().sendMessage("§cYou are muted. Reason: " + entry.reason);
            } else {
                mutedPlayers.remove(event.getPlayer().getUniqueId());
            }
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
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    if (!"POST".equals(exchange.getRequestMethod())) {
                        FeatureUtils.sendError(exchange, 405, "Method not allowed");
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
                    String reason = req.has("reason") ? req.get("reason").getAsString() : "No reason provided.";

                    Bukkit.getScheduler().callSyncMethod(plugin, () -> {
                        Bukkit.getBanList(org.bukkit.BanList.Type.NAME).addBan(player, reason, (Date) null, "Discord Bot");
                        Player online = Bukkit.getPlayerExact(player);
                        if (online != null) {
                            online.kickPlayer("Banned: " + reason);
                        }
                        return null;
                    }).get(10, TimeUnit.SECONDS);

                    plugin.getLogger().info("Banned: " + player + " \u2014 " + reason);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", player + " has been banned");
                    FeatureUtils.sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/moderation/ban", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
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
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    if (!"POST".equals(exchange.getRequestMethod())) {
                        FeatureUtils.sendError(exchange, 405, "Method not allowed");
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
                    String reason = req.has("reason") ? req.get("reason").getAsString() : "No reason provided.";

                    boolean kicked = Bukkit.getScheduler().callSyncMethod(plugin, () -> {
                        Player online = Bukkit.getPlayerExact(player);
                        if (online == null) return false;
                        online.kickPlayer("Kicked: " + reason);
                        return true;
                    }).get(10, TimeUnit.SECONDS);

                    if (!kicked) {
                        FeatureUtils.sendError(exchange, 404, player + " is not online");
                        return;
                    }

                    plugin.getLogger().info("Kicked: " + player + " \u2014 " + reason);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", player + " has been kicked");
                    FeatureUtils.sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/moderation/kick", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
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
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    if (!"POST".equals(exchange.getRequestMethod())) {
                        FeatureUtils.sendError(exchange, 405, "Method not allowed");
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
                    String reason = req.has("reason") ? req.get("reason").getAsString() : "No reason provided.";

                    Bukkit.getScheduler().callSyncMethod(plugin, () -> {
                        Player online = Bukkit.getPlayerExact(player);
                        if (online != null) {
                            online.sendMessage("§e[Warning] §f" + reason);
                        }
                        return null;
                    }).get(10, TimeUnit.SECONDS);

                    plugin.getLogger().info("Warned: " + player + " \u2014 " + reason);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", player + " has been warned");
                    FeatureUtils.sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/moderation/warn", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }

    private class MuteEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/moderation/mute";
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
                    int duration = req.has("duration") ? req.get("duration").getAsInt() : 30;
                    String reason = req.has("reason") ? req.get("reason").getAsString() : "No reason provided.";

                    if (duration <= 0) {
                        FeatureUtils.sendError(exchange, 400, "Duration must be positive");
                        return;
                    }

                    // Combined single sync call to avoid race conditions
                    Bukkit.getScheduler().callSyncMethod(plugin, () -> {
                        Player online = Bukkit.getPlayerExact(player);
                        UUID uuid;
                        if (online != null) {
                            uuid = online.getUniqueId();
                            online.sendMessage("§cYou have been muted for " + duration + " minute(s). Reason: " + reason);
                        } else {
                            OfflinePlayer off = Bukkit.getOfflinePlayerIfCached(player);
                            if (off != null) {
                                uuid = off.getUniqueId();
                            } else {
                                return null;
                            }
                        }
                        // Use long multiplication to prevent overflow
                        mutedPlayers.put(uuid, new MuteEntry(System.currentTimeMillis() + (duration * 60L * 1000L), reason));
                        return null;
                    }).get(10, TimeUnit.SECONDS);

                    plugin.getLogger().info("Muted: " + player + " \u2014 " + duration + "m \u2014 " + reason);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", player + " has been muted for " + duration + " minute(s)");
                    FeatureUtils.sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/moderation/mute", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }

    private class UnmuteEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/moderation/unmute";
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

                    Bukkit.getScheduler().callSyncMethod(plugin, () -> {
                        Player online = Bukkit.getPlayerExact(player);
                        if (online != null) {
                            mutedPlayers.remove(online.getUniqueId());
                            online.sendMessage("§aYou have been unmuted.");
                        }
                        return null;
                    }).get(10, TimeUnit.SECONDS);

                    plugin.getLogger().info("Unmuted: " + player);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", player + " has been unmuted");
                    FeatureUtils.sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/moderation/unmute", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
