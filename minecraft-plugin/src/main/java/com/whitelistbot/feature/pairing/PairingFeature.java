package com.whitelistbot.feature.pairing;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.whitelistbot.WhitelistBotPlugin;
import com.whitelistbot.feature.Feature;
import com.whitelistbot.feature.FeatureUtils;
import com.whitelistbot.pairing.PairingManager;
import com.whitelistbot.pairing.PairingSession;
import org.bukkit.Bukkit;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

public class PairingFeature implements Feature {

    private final Gson gson = new Gson();
    private WhitelistBotPlugin plugin;
    private PairingManager pairing;

    @Override
    public String getName() { return "pairing"; }

    @Override
    public boolean isEnabled() { return true; }

    @Override
    public void onEnable(WhitelistBotPlugin plugin) {
        this.plugin = plugin;
        this.pairing = plugin.getPairingManager();
    }

    @Override
    public void onDisable() {
        this.plugin = null;
        this.pairing = null;
    }

    @Override
    public List<Endpoint> getEndpoints() {
        return Arrays.asList(new ValidateEndpoint(), new ChallengeEndpoint(), new DisconnectEndpoint());
    }

    private void reply(HttpExchange exchange, int code, String json) throws java.io.IOException {
        byte[] bytes = json.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(code, bytes.length);
        try (java.io.OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }

    private void ok(HttpExchange exchange, JsonObject data) throws java.io.IOException {
        data.addProperty("success", true);
        reply(exchange, 200, gson.toJson(data));
    }

    private void fail(HttpExchange exchange, int code, String msg) throws java.io.IOException {
        JsonObject o = new JsonObject();
        o.addProperty("success", false);
        o.addProperty("error", msg);
        reply(exchange, code, gson.toJson(o));
    }

    private class ValidateEndpoint implements Endpoint {
        @Override
        public String getPath() { return "/api/pair/validate"; }

        @Override
        public HttpHandler getHandler() {
            return exchange -> {
                try {
                    JsonObject req = FeatureUtils.parseBody(exchange);
                    if (req == null || !req.has("code")) {
                        fail(exchange, 400, "Missing 'code' field");
                        return;
                    }

                    String code = req.get("code").getAsString().toUpperCase();
                    PairingSession session = pairing.peekSession(code);

                    if (session == null) {
                        fail(exchange, 404, "Invalid or expired pairing code");
                        return;
                    }

                    if (session.getClaimedBy() == null) {
                        fail(exchange, 400, "This code was initiated from Discord. Run /wlb connect " + code + " in Minecraft first.");
                        return;
                    }

                    session = pairing.validateAndClaim(code);
                    if (session == null) {
                        fail(exchange, 404, "Invalid or expired pairing code");
                        return;
                    }

                    String newApiKey = plugin.getConfigManager().rotateApiKey();
                    Bukkit.getScheduler().callSyncMethod(plugin, () -> {
                        plugin.saveConfig();
                        return null;
                    }).get(10, TimeUnit.SECONDS);

                    String host = session.getHost() != null ? session.getHost() : plugin.getConfigManager().getHost();
                    int port = session.getPort() != 0 ? session.getPort() : plugin.getConfigManager().getPort();

                    JsonObject data = new JsonObject();
                    data.addProperty("host", host);
                    data.addProperty("port", port);
                    data.addProperty("api_key", newApiKey);
                    ok(exchange, data);

                    plugin.getLogger().info("Server paired with Discord successfully");
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in pair/validate", e);
                    fail(exchange, 500, "Internal server error");
                }
            };
        }
    }

    private class ChallengeEndpoint implements Endpoint {
        @Override
        public String getPath() { return "/api/pair/challenge"; }

        @Override
        public HttpHandler getHandler() {
            return exchange -> {
                try {
                    JsonObject req = FeatureUtils.parseBody(exchange);
                    if (req == null || !req.has("code")) {
                        fail(exchange, 400, "Missing 'code' field");
                        return;
                    }

                    String code = req.get("code").getAsString().toUpperCase();
                    boolean registered = pairing.registerRemoteCode(code);

                    if (!registered) {
                        fail(exchange, 409, "Code already exists");
                        return;
                    }

                    JsonObject data = new JsonObject();
                    data.addProperty("message", "Code accepted. Use /whitelistbot connect " + code + " in-game to confirm.");
                    ok(exchange, data);

                    plugin.getLogger().info("Challenge code registered from Discord");
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in pair/challenge", e);
                    fail(exchange, 500, "Internal server error");
                }
            };
        }
    }

    private class DisconnectEndpoint implements Endpoint {
        @Override
        public String getPath() { return "/api/pair/disconnect"; }

        @Override
        public HttpHandler getHandler() {
            return exchange -> {
                try {
                    if (!FeatureUtils.authenticate(exchange, plugin.getConfigManager().getApiKey())) {
                        fail(exchange, 401, "Unauthorized");
                        return;
                    }

                    JsonObject req = FeatureUtils.parseBody(exchange);
                    String guildId = req != null && req.has("guild_id") ? req.get("guild_id").getAsString() : "unknown";

                    JsonObject data = new JsonObject();
                    data.addProperty("message", "Disconnect acknowledged. API key remains valid for reconnection.");
                    ok(exchange, data);

                    plugin.getLogger().info("Discord bot disconnected (guild: " + guildId + ")");
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Error in pair/disconnect", e);
                    fail(exchange, 500, "Internal server error");
                }
            };
        }
    }
}
