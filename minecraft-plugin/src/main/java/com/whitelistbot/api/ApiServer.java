package com.whitelistbot.api;

import com.sun.net.httpserver.HttpServer;
import com.whitelistbot.WhitelistBotPlugin;
import com.whitelistbot.config.ConfigManager;
import com.whitelistbot.feature.Feature;
import com.whitelistbot.feature.FeatureManager;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

public class ApiServer {

    private final WhitelistBotPlugin plugin;
    private final ConfigManager config;
    private final FeatureManager featureManager;
    private HttpServer server;

    public ApiServer(WhitelistBotPlugin plugin, ConfigManager config, FeatureManager featureManager) {
        this.plugin = plugin;
        this.config = config;
        this.featureManager = featureManager;
    }

    public void start() throws IOException {
        InetSocketAddress addr = new InetSocketAddress(config.getHost(), config.getPort());
        server = HttpServer.create(addr, 0);
        server.setExecutor(Executors.newFixedThreadPool(10));

        for (Feature feature : featureManager.getEnabledFeatures()) {
            for (Feature.Endpoint ep : feature.getEndpoints()) {
                server.createContext(ep.getPath(), ep.getHandler());
                plugin.getLogger().info("  → " + ep.getPath() + " (" + feature.getName() + ")");
            }
        }

        server.start();
        plugin.getLogger().info("API server listening on " + config.getHost() + ":" + config.getPort());
    }

    public void stop() {
        if (server != null) {
            server.stop(1);
            plugin.getLogger().info("API server stopped.");
        }
    }
}
