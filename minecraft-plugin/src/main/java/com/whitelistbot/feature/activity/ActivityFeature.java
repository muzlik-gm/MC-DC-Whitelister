package com.whitelistbot.feature.activity;

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
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.HandlerList;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerAdvancementDoneEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.scheduler.BukkitRunnable;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

public class ActivityFeature implements Feature, Listener {

    private final Gson gson = new Gson();
    private final LinkedList<JsonObject> eventLog = new LinkedList<>();
    private static final int MAX_EVENTS = 1000;
    private WhitelistBotPlugin plugin;
    private ConfigManager config;

    private final Map<UUID, Long> sessionStart = new ConcurrentHashMap<>();
    private final Map<UUID, Long> totalPlaytime = new ConcurrentHashMap<>();
    private final Set<UUID> milestoneSent = ConcurrentHashMap.newKeySet();
    private final List<Integer> milestones = new ArrayList<>();

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

        List<Integer> cfgMilestones = plugin.getConfig().getIntegerList("milestones");
        if (cfgMilestones.isEmpty()) {
            cfgMilestones = Arrays.asList(1, 10, 50, 100, 500, 1000);
        }
        milestones.clear();
        milestones.addAll(cfgMilestones);

        new BukkitRunnable() {
            @Override
            public void run() {
                checkMilestones();
            }
        }.runTaskTimer(plugin, 1200L, 1200L);
    }

    @Override
    public void onDisable() {
        HandlerList.unregisterAll(this);
        synchronized (eventLog) {
            eventLog.clear();
        }
        sessionStart.clear();
        totalPlaytime.clear();
        milestoneSent.clear();
        this.plugin = null;
        this.config = null;
    }

    @Override
    public List<Endpoint> getEndpoints() {
        return Arrays.asList(new PollEndpoint());
    }

    private void logEvent(String type, String player, String detail) {
        logEvent(type, player, detail, null);
    }

    private void logEvent(String type, String player, String detail, Integer hours) {
        JsonObject evt = new JsonObject();
        evt.addProperty("type", type);
        evt.addProperty("player", player);
        evt.addProperty("detail", detail != null ? detail : "");
        evt.addProperty("time", System.currentTimeMillis() / 1000);
        if (hours != null) {
            evt.addProperty("hours", hours);
        }
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
        sessionStart.put(p.getUniqueId(), System.currentTimeMillis());
        boolean firstJoin = !p.hasPlayedBefore();
        logEvent(firstJoin ? "first_join" : "join", p.getName(), null);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        Player p = event.getPlayer();
        logEvent("leave", event.getPlayer().getName(), null);
        Long start = sessionStart.remove(p.getUniqueId());
        if (start != null) {
            long elapsed = System.currentTimeMillis() - start;
            totalPlaytime.merge(p.getUniqueId(), elapsed, Long::sum);
        }
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

    private void checkMilestones() {
        long now = System.currentTimeMillis();
        for (Player p : Bukkit.getOnlinePlayers()) {
            UUID uuid = p.getUniqueId();
            long total = totalPlaytime.getOrDefault(uuid, 0L);
            Long start = sessionStart.get(uuid);
            if (start != null) {
                total += (now - start);
            }
            long hours = total / 3600000L;
            for (int milestone : milestones) {
                if (hours >= milestone && !milestoneSent.contains(uuid)) {
                    milestoneSent.add(uuid);
                    logEvent("milestone", p.getName(), null, (int) hours);
                }
            }
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
                    if (!FeatureUtils.authenticate(exchange, config.getApiKey())) {
                        FeatureUtils.sendError(exchange, 401, "Unauthorized");
                        return;
                    }
                    if (!"GET".equals(exchange.getRequestMethod())) {
                        FeatureUtils.sendError(exchange, 405, "Method not allowed");
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
                    FeatureUtils.sendJson(exchange, 200, gson.toJson(res));
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in /api/activity/poll", e);
                    FeatureUtils.sendError(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
