package com.whitelistbot.data;

import com.whitelistbot.WhitelistBotPlugin;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class DataStore {

    private final WhitelistBotPlugin plugin;
    private final File file;
    private final YamlConfiguration data;

    private final Map<UUID, String> playerIps = new ConcurrentHashMap<>();
    private final Map<UUID, Long> lastSeen = new ConcurrentHashMap<>();
    private final Map<UUID, Long> linkTimestamps = new ConcurrentHashMap<>();
    private long lastSave = 0;
    private static final long SAVE_INTERVAL = 5000;

    public DataStore(WhitelistBotPlugin plugin) {
        this.plugin = plugin;
        this.file = new File(plugin.getDataFolder(), "data.yml");
        this.data = YamlConfiguration.loadConfiguration(file);
        load();
    }

    public void recordPlayerIp(UUID uuid, String ip) {
        playerIps.put(uuid, ip);
        lastSeen.put(uuid, System.currentTimeMillis());
        save();
    }

    public int countAccountsOnIp(String ip) {
        return (int) playerIps.values().stream().filter(ip::equals).count();
    }

    public int countAccountsOnIpExcluding(String ip, UUID exclude) {
        return (int) playerIps.entrySet().stream()
                .filter(e -> ip.equals(e.getValue()) && !exclude.equals(e.getKey()))
                .count();
    }

    public String getIp(UUID uuid) {
        return playerIps.get(uuid);
    }

    public void setLinkTimestamp(UUID uuid) {
        linkTimestamps.put(uuid, System.currentTimeMillis());
        save();
    }

    public long getLinkTimestamp(UUID uuid) {
        return linkTimestamps.getOrDefault(uuid, 0L);
    }

    public long getTimeSinceLinked(UUID uuid) {
        long linked = getLinkTimestamp(uuid);
        if (linked == 0) return Long.MAX_VALUE;
        return System.currentTimeMillis() - linked;
    }

    public boolean hasLinkTimestamp(UUID uuid) {
        return linkTimestamps.containsKey(uuid);
    }

    public void save() {
        long now = System.currentTimeMillis();
        if (now - lastSave < SAVE_INTERVAL) return;
        lastSave = now;

        data.set("player-ips", null);
        data.set("link-times", null);

        for (Map.Entry<UUID, String> e : playerIps.entrySet()) {
            data.set("player-ips." + e.getKey() + ".ip", e.getValue());
            data.set("player-ips." + e.getKey() + ".last-seen", lastSeen.getOrDefault(e.getKey(), 0L));
        }

        for (Map.Entry<UUID, Long> e : linkTimestamps.entrySet()) {
            data.set("link-times." + e.getKey(), e.getValue());
        }

        IOException lastEx = null;
        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                data.save(file);
                return;
            } catch (IOException ex) {
                lastEx = ex;
                if (attempt < 2) {
                    try { Thread.sleep(100); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                }
            }
        }
        plugin.getLogger().warning("Failed to save data.yml after 3 attempts: " + lastEx.getMessage());
    }

    public void saveNow() {
        lastSave = 0;
        save();
    }

    private void load() {
        playerIps.clear();
        linkTimestamps.clear();

        if (data.contains("player-ips")) {
            for (String key : data.getConfigurationSection("player-ips").getKeys(false)) {
                try {
                    UUID uuid = UUID.fromString(key);
                    String ip = data.getString("player-ips." + key + ".ip");
                    long seen = data.getLong("player-ips." + key + ".last-seen", 0L);
                    if (ip != null) {
                        playerIps.put(uuid, ip);
                        lastSeen.put(uuid, seen);
                    }
                } catch (IllegalArgumentException ignored) {}
            }
        }

        if (data.contains("link-times")) {
            for (String key : data.getConfigurationSection("link-times").getKeys(false)) {
                try {
                    UUID uuid = UUID.fromString(key);
                    long ts = data.getLong("link-times." + key);
                    linkTimestamps.put(uuid, ts);
                } catch (IllegalArgumentException ignored) {}
            }
        }

        plugin.getLogger().info("Loaded " + playerIps.size() + " player IPs and " + linkTimestamps.size() + " link timestamps.");
    }
}
