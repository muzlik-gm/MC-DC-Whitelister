package com.whitelistbot.config;

import com.whitelistbot.WhitelistBotPlugin;
import org.bukkit.configuration.file.FileConfiguration;

import java.security.SecureRandom;

public class ConfigManager {

    private static final String KEY_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final int KEY_LENGTH = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    public static final long[] COOLDOWN_VALUES = {
        600_000,          // 10m
        1_800_000,        // 30m
        3_600_000,        // 1h
        21_600_000,       // 6h
        86_400_000,       // 1d
        259_200_000,      // 3d
        604_800_000,      // 1w (default index 6)
        1_209_600_000,    // 2w
        2_592_000_000L    // 1mo
    };

    public static final String[] COOLDOWN_LABELS = {
        "10 minutes",
        "30 minutes",
        "1 hour",
        "6 hours",
        "1 day",
        "3 days",
        "1 week",
        "2 weeks",
        "1 month"
    };

    public static final String[] COOLDOWN_KEYS = {
        "10m", "30m", "1h", "6h", "1d", "3d", "1w", "2w", "1mo"
    };

    private static final int DEFAULT_COOLDOWN_INDEX = 6;

    private final String host;
    private final int port;
    private String apiKey;
    private boolean allowUserUnlink;
    private int cooldownIndex;
    private boolean antiAltEnabled;
    private int antiAltMaxAccounts;
    private final FileConfiguration config;

    public ConfigManager(FileConfiguration cfg) {
        this.config = cfg;
        this.host = cfg.getString("server.host", "127.0.0.1");
        int rawPort = cfg.getInt("server.port", 25252);
        if (rawPort < 1 || rawPort > 65535) {
            this.port = 25252;
            WhitelistBotPlugin.getInstance().getLogger().warning("Invalid port " + rawPort + " in config.yml, using default 25252");
        } else {
            this.port = rawPort;
        }
        this.apiKey = cfg.getString("api-key", "");
        this.allowUserUnlink = cfg.getBoolean("unlink.allow-user-unlink", true);
        this.antiAltEnabled = cfg.getBoolean("anti-alt.enabled", false);
        this.antiAltMaxAccounts = cfg.getInt("anti-alt.max-accounts", 1);

        String cooldownStr = cfg.getString("unlink.cooldown", "1w");
        this.cooldownIndex = parseCooldownIndex(cooldownStr);

        if (apiKey.isEmpty() || apiKey.equals("CHANGE_ME_TO_A_SECURE_RANDOM_KEY")) {
            WhitelistBotPlugin.getInstance().getLogger().warning(
                "The api-key in config.yml is still the default! Change it immediately."
            );
        }
    }

    private int parseCooldownIndex(String key) {
        for (int i = 0; i < COOLDOWN_KEYS.length; i++) {
            if (COOLDOWN_KEYS[i].equalsIgnoreCase(key)) return i;
        }
        return DEFAULT_COOLDOWN_INDEX;
    }

    public void setApiKey(String newKey) {
        this.apiKey = newKey;
        config.set("api-key", newKey);
    }

    public String rotateApiKey() {
        String newKey = generateApiKey();
        setApiKey(newKey);
        return newKey;
    }

    public static String generateApiKey() {
        StringBuilder sb = new StringBuilder(KEY_LENGTH);
        for (int i = 0; i < KEY_LENGTH; i++) {
            sb.append(KEY_CHARS.charAt(RANDOM.nextInt(KEY_CHARS.length())));
        }
        return sb.toString();
    }

    public void setAllowUserUnlink(boolean allow) {
        this.allowUserUnlink = allow;
        config.set("unlink.allow-user-unlink", allow);
    }

    public void setCooldownIndex(int index) {
        if (index < 0 || index >= COOLDOWN_KEYS.length) return;
        this.cooldownIndex = index;
        config.set("unlink.cooldown", COOLDOWN_KEYS[index]);
    }

    public void setCooldownByKey(String key) {
        for (int i = 0; i < COOLDOWN_KEYS.length; i++) {
            if (COOLDOWN_KEYS[i].equalsIgnoreCase(key)) {
                setCooldownIndex(i);
                return;
            }
        }
    }

    public void setAntiAltEnabled(boolean enabled) {
        this.antiAltEnabled = enabled;
        config.set("anti-alt.enabled", enabled);
    }

    public void setAntiAltMaxAccounts(int max) {
        if (max < 1 || max > 5) return;
        this.antiAltMaxAccounts = max;
        config.set("anti-alt.max-accounts", max);
    }

    public long getCooldownMillis() {
        return COOLDOWN_VALUES[cooldownIndex];
    }

    public String getCooldownLabel() {
        return COOLDOWN_LABELS[cooldownIndex];
    }

    public String getCooldownKey() {
        return COOLDOWN_KEYS[cooldownIndex];
    }

    public String getHost() { return host; }
    public int getPort() { return port; }
    public String getApiKey() { return apiKey; }
    public boolean isAllowUserUnlink() { return allowUserUnlink; }
    public int getCooldownIndex() { return cooldownIndex; }
    public boolean isAntiAltEnabled() { return antiAltEnabled; }
    public int getAntiAltMaxAccounts() { return antiAltMaxAccounts; }
}
