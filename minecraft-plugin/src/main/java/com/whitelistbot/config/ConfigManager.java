package com.whitelistbot.config;

import com.whitelistbot.WhitelistBotPlugin;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Properties;

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
        
        // Check environment variables first
        String envApiKey = System.getenv("MINECRAFT_API_KEY");
        String envHost = System.getenv("MC_HOST");
        String envPort = System.getenv("MC_PORT");
        
        // Set host: env var → config.yml → auto-detect
        if (envHost != null && !envHost.isEmpty()) {
            this.host = envHost;
        } else {
            String configHost = cfg.getString("server.host", "127.0.0.1");
            if (configHost.equals("127.0.0.1") || configHost.equals("0.0.0.0") || configHost.isEmpty()) {
                this.host = detectExternalHost(configHost);
            } else {
                this.host = configHost;
            }
        }
        
        // Set port from environment or config
        int rawPort;
        if (envPort != null) {
            try {
                rawPort = Integer.parseInt(envPort);
            } catch (NumberFormatException e) {
                WhitelistBotPlugin.getInstance().getLogger().warning("Invalid MC_PORT environment variable " + envPort + ", using config value");
                rawPort = cfg.getInt("server.port", 25252);
            }
        } else {
            rawPort = cfg.getInt("server.port", 25252);
        }
        
        if (rawPort < 1 || rawPort > 65535) {
            this.port = 25252;
            WhitelistBotPlugin.getInstance().getLogger().warning("Invalid port " + rawPort + " in config.yml, using default 25252");
        } else {
            this.port = rawPort;
        }
        
        // Set API key from environment or config
        if (envApiKey != null && !envApiKey.isEmpty()) {
            this.apiKey = envApiKey;
        } else {
            this.apiKey = cfg.getString("api-key", "");
        }
        
        this.allowUserUnlink = cfg.getBoolean("unlink.allow-user-unlink", true);
        this.antiAltEnabled = cfg.getBoolean("anti-alt.enabled", false);
        this.antiAltMaxAccounts = cfg.getInt("anti-alt.max-accounts", 1);

        String cooldownStr = cfg.getString("unlink.cooldown", "1w");
        this.cooldownIndex = parseCooldownIndex(cooldownStr);

        // Validate API key
        if (this.apiKey.isEmpty()) {
            WhitelistBotPlugin.getInstance().getLogger().warning(
                "Minecraft API key is not configured. " +
                "Run /wlb pair in-game or set api-key in config.yml."
            );
        } else if (this.apiKey.equals("CHANGE_ME_TO_A_SECURE_RANDOM_KEY")) {
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

    private String detectExternalHost(String fallback) {
        WhitelistBotPlugin plugin = WhitelistBotPlugin.getInstance();
        if (plugin == null) return fallback;

        // 1. Check Pterodactyl environment variables
        String[] envNames = {"SERVER_IP", "ADDRESS", "EXTERNAL_IP", "PUBLIC_IP", "HOSTNAME"};
        for (String envName : envNames) {
            String val = System.getenv(envName);
            if (val != null && !val.isEmpty() && !val.equals("127.0.0.1") && !val.equals("0.0.0.0")) {
                plugin.getLogger().info("Detected external host from " + envName + ": " + val);
                return val;
            }
        }

        // 2. Read server.properties from the MC server directory (parent of plugin folder)
        try {
            File propsFile = new File(plugin.getDataFolder().getParentFile(), "server.properties");
            if (propsFile.exists()) {
                Properties props = new Properties();
                try (InputStreamReader reader = new InputStreamReader(new FileInputStream(propsFile), StandardCharsets.ISO_8859_1)) {
                    props.load(reader);
                }
                String serverIp = props.getProperty("server-ip", "").trim();
                if (!serverIp.isEmpty() && !serverIp.equals("0.0.0.0")) {
                    plugin.getLogger().info("Detected external host from server.properties: " + serverIp);
                    return serverIp;
                }
            }
        } catch (Exception e) {
            plugin.getLogger().fine("Could not read server.properties: " + e.getMessage());
        }

        // 3. Try to detect from network interfaces
        try {
            java.util.Enumeration<java.net.NetworkInterface> interfaces = java.net.NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                java.net.NetworkInterface ni = interfaces.nextElement();
                if (ni.isLoopback() || !ni.isUp()) continue;
                java.util.Enumeration<java.net.InetAddress> addrs = ni.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    java.net.InetAddress addr = addrs.nextElement();
                    if (!addr.isLoopbackAddress() && addr instanceof java.net.Inet4Address) {
                        String ip = addr.getHostAddress();
                        plugin.getLogger().info("Detected external host from " + ni.getName() + ": " + ip);
                        return ip;
                    }
                }
            }
        } catch (Exception ignored) {}

        plugin.getLogger().warning("Could not auto-detect external host. Using fallback: " + fallback);
        return fallback;
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
