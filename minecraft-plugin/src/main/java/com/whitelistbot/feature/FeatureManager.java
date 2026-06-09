package com.whitelistbot.feature;

import com.whitelistbot.WhitelistBotPlugin;

import java.util.ArrayList;
import java.util.List;

public class FeatureManager {

    private final WhitelistBotPlugin plugin;
    private final List<Feature> features = new ArrayList<>();

    public FeatureManager(WhitelistBotPlugin plugin) {
        this.plugin = plugin;
    }

    public void register(Feature feature) {
        if (feature.isEnabled()) {
            feature.onEnable(plugin);
            features.add(feature);
            plugin.getLogger().info("Feature enabled: " + feature.getName());
        }
    }

    public void disableAll() {
        for (Feature feature : features) {
            try {
                feature.onDisable();
                plugin.getLogger().info("Feature disabled: " + feature.getName());
            } catch (Exception e) {
                plugin.getLogger().warning("Error disabling feature " + feature.getName() + ": " + e.getMessage());
            }
        }
        features.clear();
    }

    public List<Feature> getEnabledFeatures() {
        return new ArrayList<>(features);
    }
}
