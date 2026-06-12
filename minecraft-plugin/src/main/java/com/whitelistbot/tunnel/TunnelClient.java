package com.whitelistbot.tunnel;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.whitelistbot.WhitelistBotPlugin;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

public class TunnelClient {

    private final WhitelistBotPlugin plugin;
    private final String wsUrl;
    private final String apiKey;
    private final Gson gson = new Gson();
    private final ConcurrentHashMap<String, PendingRequest> pending = new ConcurrentHashMap<>();
    private WebSocketClient client;
    private volatile boolean connected;

    public TunnelClient(WhitelistBotPlugin plugin, String host, int port, String apiKey) {
        this.plugin = plugin;
        this.wsUrl = "ws://" + host + ":" + port;
        this.apiKey = apiKey;
    }

    public void connect() {
        try {
            client = new WebSocketClient(new URI(wsUrl)) {
                @Override
                public void onOpen(ServerHandshake handshake) {
                    connected = true;
                    plugin.getLogger().info("Connected to tunnel server at " + wsUrl);
                    JsonObject auth = new JsonObject();
                    auth.addProperty("type", "auth");
                    auth.addProperty("api_key", apiKey);
                    send(auth.toString());
                }

                @Override
                public void onMessage(String message) {
                    try {
                        JsonObject msg = gson.fromJson(message, JsonObject.class);
                        String type = msg.has("type") ? msg.get("type").getAsString() : "";
                        if ("request".equals(type)) {
                            handleRequest(msg);
                        } else if ("response".equals(type) && msg.has("id")) {
                            String id = msg.get("id").getAsString();
                            PendingRequest p = pending.remove(id);
                            if (p != null) {
                                p.resolve(msg);
                            }
                        }
                    } catch (Exception e) {
                        plugin.getLogger().log(Level.WARNING, "Error processing tunnel message", e);
                    }
                }

                @Override
                public void onClose(int code, String reason, boolean remote) {
                    connected = false;
                    plugin.getLogger().warning("Tunnel disconnected (" + code + "): " + reason);
                    for (PendingRequest p : pending.values()) {
                        JsonObject err = new JsonObject();
                        err.addProperty("type", "response");
                        err.addProperty("status", 503);
                        err.add("body", new JsonObject());
                        p.resolve(err);
                    }
                    pending.clear();
                    scheduleReconnect();
                }

                @Override
                public void onError(Exception ex) {
                    connected = false;
                    plugin.getLogger().log(Level.WARNING, "Tunnel error", ex);
                }
            };
            client.connect();
        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Failed to connect tunnel", e);
            scheduleReconnect();
        }
    }

    private void handleRequest(JsonObject msg) {
        String id = msg.get("id").getAsString();
        String method = msg.get("method").getAsString();
        String path = msg.get("path").getAsString();
        JsonObject body = msg.has("body") && !msg.get("body").isJsonNull() ? msg.get("body").getAsJsonObject() : null;

        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                String localUrl = "http://127.0.0.1:" + plugin.getConfigManager().getPort() + path;
                HttpURLConnection conn = (HttpURLConnection) new URL(localUrl).openConnection();
                conn.setRequestMethod(method);
                conn.setRequestProperty("X-API-Key", plugin.getConfigManager().getApiKey());
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);

                if (body != null) {
                    conn.setDoOutput(true);
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                    }
                }

                int status = conn.getResponseCode();
                String responseBody;
                try (InputStream is = (status >= 200 && status < 300) ? conn.getInputStream() : conn.getErrorStream();
                     ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[4096];
                    int n;
                    while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
                    responseBody = bos.toString(StandardCharsets.UTF_8);
                }

                JsonObject response = new JsonObject();
                response.addProperty("type", "response");
                response.addProperty("id", id);
                response.addProperty("status", status);
                try {
                    response.add("body", gson.fromJson(responseBody, JsonObject.class));
                } catch (Exception e) {
                    JsonObject fallback = new JsonObject();
                    fallback.addProperty("raw", responseBody);
                    response.add("body", fallback);
                }

                if (client != null && connected) {
                    client.send(response.toString());
                }
            } catch (Exception e) {
                JsonObject error = new JsonObject();
                error.addProperty("type", "response");
                error.addProperty("id", id);
                error.addProperty("status", 502);
                JsonObject errBody = new JsonObject();
                errBody.addProperty("error", e.getMessage());
                error.add("body", errBody);
                if (client != null && connected) {
                    client.send(error.toString());
                }
            }
        });
    }

    private void scheduleReconnect() {
        plugin.getServer().getScheduler().runTaskLater(plugin, () -> {
            plugin.getLogger().info("Reconnecting to tunnel...");
            connect();
        }, 200L);
    }

    public void disconnect() {
        if (client != null) {
            connected = false;
            client.close();
        }
    }

    public boolean isConnected() {
        return connected;
    }

    private static class PendingRequest {
        private java.util.function.Consumer<JsonObject> resolver;
        PendingRequest(java.util.function.Consumer<JsonObject> resolver) {
            this.resolver = resolver;
        }
        void resolve(JsonObject response) {
            if (resolver != null) resolver.accept(response);
        }
    }
}