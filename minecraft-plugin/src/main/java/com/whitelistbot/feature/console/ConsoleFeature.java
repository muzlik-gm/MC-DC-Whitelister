package com.whitelistbot.feature.console;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.whitelistbot.WhitelistBotPlugin;
import com.whitelistbot.config.ConfigManager;
import com.whitelistbot.feature.Feature;
import com.whitelistbot.feature.FeatureUtils;
import org.bukkit.Bukkit;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

public class ConsoleFeature implements Feature {

    private final Gson gson = new Gson();
    private WhitelistBotPlugin plugin;
    private ConfigManager config;

    private static final List<String> ALLOWED_PREFIXES = Arrays.asList(
        "list", "say", "tell", "msg", "w", "me", "help",
        "seed", "time", "weather", "difficulty", "gamerule",
        "scoreboard", "team", "effect", "give", "clear",
        "enchant", "xp", "spawnpoint", "setworldspawn",
        "whitelist list", "whitelist add", "whitelist remove",
        "banlist", "kick", "tag", "bossbar",
        "advancement", "recipe", "datapack",
        "worldborder", "tps", "lag"
    );

    @Override
    public String getName() {
        return "console";
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
        return Arrays.asList(new ExecuteEndpoint());
    }

    private boolean isCommandAllowed(String command) {
        String lower = command.trim().toLowerCase();
        for (String prefix : ALLOWED_PREFIXES) {
            if (lower.startsWith(prefix)) return true;
        }
        return false;
    }

    private class ExecuteEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/console/execute";
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
                    if (req == null || !req.has("command")) {
                        FeatureUtils.sendError(exchange, 400, "Missing 'command' field");
                        return;
                    }

                    String command = req.get("command").getAsString();
                    if (command.length() > 256) {
                        FeatureUtils.sendError(exchange, 400, "Command too long (max 256 chars)");
                        return;
                    }

                    if (!isCommandAllowed(command)) {
                        FeatureUtils.sendError(exchange, 403, "Command not in allowed list");
                        return;
                    }

                    boolean success = Bukkit.getScheduler().callSyncMethod(plugin, () ->
                        Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command)
                    ).get(10, TimeUnit.SECONDS);

                    plugin.getLogger().info("[Remote Console] >> " + command);

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.addProperty("output", success ? "Command executed." : "Command returned false.");
                    FeatureUtils.sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/console/execute", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
