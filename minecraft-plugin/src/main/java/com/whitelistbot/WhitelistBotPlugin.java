package com.whitelistbot;

import com.whitelistbot.api.ApiServer;
import com.whitelistbot.command.WhitelistBotCommand;
import com.whitelistbot.config.ConfigManager;
import com.whitelistbot.data.DataStore;
import com.whitelistbot.feature.FeatureManager;
import com.whitelistbot.feature.activity.ActivityFeature;
import com.whitelistbot.feature.console.ConsoleFeature;
import com.whitelistbot.feature.pairing.PairingFeature;
import com.whitelistbot.feature.whitelist.WhitelistFeature;
import com.whitelistbot.listener.AntiAltListener;
import com.whitelistbot.pairing.PairingManager;
import com.whitelistbot.whitelist.WhitelistManager;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.io.IOException;

public class WhitelistBotPlugin extends JavaPlugin {

    private static WhitelistBotPlugin instance;
    private ConfigManager configManager;
    private WhitelistManager whitelistManager;
    private PairingManager pairingManager;
    private FeatureManager featureManager;
    private ApiServer apiServer;
    private DataStore dataStore;
    private boolean apiServerRunning;

    public static WhitelistBotPlugin getInstance() {
        return instance;
    }

    @Override
    public void onEnable() {
        instance = this;
        saveDefaultConfig();

        configManager = new ConfigManager(getConfig());
        whitelistManager = new WhitelistManager();
        pairingManager = new PairingManager();
        dataStore = new DataStore(this);
        featureManager = new FeatureManager(this);

        featureManager.register(new WhitelistFeature());
        featureManager.register(new PairingFeature());
        featureManager.register(new ConsoleFeature());
        featureManager.register(new ActivityFeature());

        apiServer = new ApiServer(this, configManager, featureManager);

        try {
            apiServer.start();
            apiServerRunning = true;
            getLogger().info("WhitelistBot enabled successfully.");
        } catch (IOException e) {
            apiServerRunning = false;
            getLogger().severe("Failed to start API server: " + e.getMessage());
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        getServer().getPluginManager().registerEvents(new AntiAltListener(this), this);

        WhitelistBotCommand cmd = new WhitelistBotCommand(this, configManager, pairingManager, dataStore);
        getCommand("whitelistbot").setExecutor(cmd);
        getCommand("whitelistbot").setTabCompleter(cmd);

        new BukkitRunnable() {
            @Override
            public void run() {
                pairingManager.cleanup();
            }
        }.runTaskTimer(this, 1200L, 1200L);

        String apiKey = configManager.getApiKey();
        if (apiKey == null || apiKey.isEmpty() || apiKey.equals("CHANGE_ME_TO_A_SECURE_RANDOM_KEY")) {
            getLogger().warning("Not paired with Discord. Run /wlb pair to generate a pairing code.");
            getLogger().warning("Or configure manually in config.yml then use >setup in Discord.");
        }
    }

    @Override
    public void onDisable() {
        if (featureManager != null) featureManager.disableAll();
        if (apiServer != null) apiServer.stop();
        if (dataStore != null) dataStore.saveNow();
        apiServerRunning = false;
        getLogger().info("WhitelistBot disabled.");
    }

    public boolean getApiServerRunning() { return apiServerRunning; }
    public ConfigManager getConfigManager() { return configManager; }
    public WhitelistManager getWhitelistManager() { return whitelistManager; }
    public PairingManager getPairingManager() { return pairingManager; }
    public FeatureManager getFeatureManager() { return featureManager; }
    public DataStore getDataStore() { return dataStore; }
}
