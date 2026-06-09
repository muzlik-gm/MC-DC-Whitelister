package com.whitelistbot.feature.activity;

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
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.HandlerList;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerAdvancementDoneEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.logging.Level;

public class ActivityFeature implements Feature, Listener {

    private final Gson gson = new Gson();
    private final LinkedList<JsonObject> eventLog = new LinkedList<>();
    private static final int MAX_EVENTS = 1000;
    private WhitelistBotPlugin plugin;
    private ConfigManager config;

    @Override
    public String getName() {
        return "activity";
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
        HandlerList.unregisterAll(this);
        synchronized (eventLog) {
            eventLog.clear();
        }
        this.plugin = null;
        this.config = null;
    }

    @Override
    public List<Endpoint> getEndpoints() {
        return Arrays.asList(new PollEndpoint());
    }

    private void logEvent(String type, String player, String detail) {
        JsonObject evt = new JsonObject();
        evt.addProperty("type", type);
        evt.addProperty("player", player);
        evt.addProperty("detail", detail != null ? detail : "");
        evt.addProperty("time", System.currentTimeMillis() / 1000);
        synchronized (eventLog) {
            eventLog.add(evt);
            while (eventLog.size() > MAX_EVENTS) {
                eventLog.removeFirst();
            }
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player p = event.getPlayer();
        boolean firstJoin = !p.hasPlayedBefore();
        logEvent(firstJoin ? "first_join" : "join", p.getName(), null);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        logEvent("leave", event.getPlayer().getName(), null);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerDeath(PlayerDeathEvent event) {
        Player p = event.getEntity();
        String msg = event.deathMessage() != null ? net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText().serialize(event.deathMessage()) : p.getName() + " died";
        logEvent("death", p.getName(), msg);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onAdvancement(PlayerAdvancementDoneEvent event) {
        String key = event.getAdvancement().getKey().getKey();
        if (key.startsWith("recipes/")) return;
        logEvent("advancement", event.getPlayer().getName(), key);
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

    private class PollEndpoint implements Endpoint {
        @Override
        public String getPath() {
            return "/api/activity/poll";
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

                    String sinceStr = exchange.getRequestURI().getQuery();
                    long since = 0;
                    if (sinceStr != null && sinceStr.startsWith("since=")) {
                        try {
                            since = Long.parseLong(sinceStr.substring(6));
                        } catch (NumberFormatException ignored) {}
                    }

                    JsonArray arr = new JsonArray();
                    synchronized (eventLog) {
                        for (JsonObject evt : eventLog) {
                            if (evt.get("time").getAsLong() > since) {
                                arr.add(evt);
                            }
                        }
                    }

                    JsonObject res = new JsonObject();
                    res.addProperty("success", true);
                    res.add("events", arr);
                    sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/activity/poll", e);
                    sendError(exchange, 500, "Internal server error");
                }
            };
        }

        private void sendError(HttpExchange exchange, int code, String message) throws IOException {
            JsonObject obj = new JsonObject();
            obj.addProperty("success", false);
            obj.addProperty("error", message);
            sendJson(exchange, code, gson.toJson(obj));
        }
    }
}
