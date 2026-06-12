package com.whitelistbot.api;

import com.sun.net.httpserver.HttpServer;
import com.whitelistbot.WhitelistBotPlugin;
import com.whitelistbot.config.ConfigManager;
import com.whitelistbot.feature.Feature;
import com.whitelistbot.feature.FeatureManager;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class ApiServer {

    private final WhitelistBotPlugin plugin;
    private final ConfigManager config;
    private final FeatureManager featureManager;
    private HttpServer server;
    private ExecutorService executor;

    public ApiServer(WhitelistBotPlugin plugin, ConfigManager config, FeatureManager featureManager) {
        this.plugin = plugin;
        this.config = config;
        this.featureManager = featureManager;
    }

    public void start() throws IOException {
        String bindHost = plugin.getConfig().getString("server.host", "127.0.0.1");
        InetSocketAddress addr = new InetSocketAddress(bindHost, config.getPort());
        server = HttpServer.create(addr, 0);
        executor = Executors.newFixedThreadPool(10);
        server.setExecutor(executor);

        for (Feature feature : featureManager.getEnabledFeatures()) {
            for (Feature.Endpoint ep : feature.getEndpoints()) {
                server.createContext(ep.getPath(), ep.getHandler());
                plugin.getLogger().info("  → " + ep.getPath() + " (" + feature.getName() + ")");
            }
        }

        server.start();
        plugin.getLogger().info("API server listening on " + bindHost + ":" + config.getPort());
    }

    public void stop() {
        if (server != null) {
            server.stop(1);
            plugin.getLogger().info("API server stopped.");
        }
        if (executor != null) {
            executor.shutdown();
            try {
                if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                    executor.shutdownNow();
                }
            } catch (InterruptedException e) {
                executor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }
}
