package com.whitelistbot.pairing;

public class PairingSession {

    private final String code;
    private final String host;
    private final int port;
    private final String apiKey;
    private final long createdAt;
    private volatile boolean used;
    private volatile String claimedBy;

    public PairingSession(String code, String host, int port, String apiKey) {
        this.code = code;
        this.host = host;
        this.port = port;
        this.apiKey = apiKey;
        this.createdAt = System.currentTimeMillis();
        this.used = false;
    }

    public boolean isExpired() {
        return System.currentTimeMillis() - createdAt > 300_000;
    }

    public boolean isValid() {
        return !used && !isExpired();
    }

    public void markUsed() { this.used = true; }

    public String getCode() { return code; }
    public String getHost() { return host; }
    public int getPort() { return port; }
    public String getApiKey() { return apiKey; }
    public boolean isUsed() { return used; }
    public String getClaimedBy() { return claimedBy; }
    public void setClaimedBy(String claimedBy) { this.claimedBy = claimedBy; }
}
