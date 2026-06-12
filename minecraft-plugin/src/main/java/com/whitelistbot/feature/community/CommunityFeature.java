package com.whitelistbot.feature.community;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.whitelistbot.WhitelistBotPlugin;
import com.whitelistbot.config.ConfigManager;
import com.whitelistbot.feature.Feature;
import com.whitelistbot.feature.FeatureUtils;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

public class CommunityFeature implements Feature {

    private final Gson gson = new Gson();
    private WhitelistBotPlugin plugin;
    private ConfigManager config;

    private static final List<String> ALLOWED_COMMANDS = Arrays.asList(
        "say", "tell", "msg", "w", "me", "help",
        "effect", "give", "clear", "enchant", "xp",
        "spawnpoint", "setworldspawn", "tag",
        "advancement", "recipe", "title", "bossbar",
        "playsound", "stopsound", "particle",
        "team", "scoreboard", "worldborder"
    );

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

    private boolean isCommandAllowed(String command) {
        String lower = command.trim().toLowerCase();
        // Remove %player% placeholder for checking
        String check = lower.replace("%player%", "").trim();
        for (String prefix : ALLOWED_COMMANDS) {
            if (check.startsWith(prefix)) return true;
        }
        return false;
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
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    if (!"POST".equals(exchange.getRequestMethod())) {
                        FeatureUtils.sendError(exchange, 405, "Method not allowed");
                        return;
                    }

                    JsonObject req = FeatureUtils.parseBody(exchange);
                    if (req == null || !req.has("player") || !req.has("command")) {
                        FeatureUtils.sendError(exchange, 400, "Missing 'player' or 'command' field");
                        return;
                    }

                    String player = req.get("player").getAsString();
                    String command = req.get("command").getAsString();

                    if (!FeatureUtils.isValidMinecraftUsername(player)) {
                        FeatureUtils.sendError(exchange, 400, "Invalid Minecraft username");
                        return;
                    }

                    if (command.length() > 256) {
                        FeatureUtils.sendError(exchange, 400, "Command too long (max 256 chars)");
                        return;
                    }

                    if (!isCommandAllowed(command)) {
                        FeatureUtils.sendError(exchange, 403, "Command not in allowed list");
                        return;
                    }

                    String resolved = command.replace("%player%", player);
                    Bukkit.getScheduler().callSyncMethod(plugin, () ->
                        Bukkit.dispatchCommand(Bukkit.getConsoleSender(), resolved)
                    ).get(10, TimeUnit.SECONDS);

                    plugin.getLogger().info("[Community Reward] >> " + resolved);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("message", "Command queued for execution");
                    FeatureUtils.sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/community/reward", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
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
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    if (!"GET".equals(exchange.getRequestMethod())) {
                        FeatureUtils.sendError(exchange, 405, "Method not allowed");
                        return;
                    }

                    Collection<? extends Player> onlinePlayers = Bukkit.getScheduler().callSyncMethod(plugin, () -> Bukkit.getOnlinePlayers()).get(10, TimeUnit.SECONDS);
                    JsonArray players = new JsonArray();
                    for (Player p : onlinePlayers) {
                        players.add(p.getName());
                    }

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.add("players", players);
                    FeatureUtils.sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/community/players", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
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
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    if (!"GET".equals(exchange.getRequestMethod())) {
                        FeatureUtils.sendError(exchange, 405, "Method not allowed");
                        return;
                    }

                    Object[] syncResult = Bukkit.getScheduler().callSyncMethod(plugin, () -> new Object[]{
                        Bukkit.getOnlinePlayers().toArray(new Player[0]),
                        Bukkit.getMaxPlayers()
                    }).get(10, TimeUnit.SECONDS);
                    Player[] onlinePlayers = (Player[]) syncResult[0];
                    int maxPlayers = (int) syncResult[1];

                    JsonArray players = new JsonArray();
                    for (Player p : onlinePlayers) {
                        players.add(p.getName());
                    }

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("count", onlinePlayers.length);
                    res.addProperty("max", maxPlayers);
                    res.add("players", players);
                    FeatureUtils.sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/community/online", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
