package com.whitelistbot.pairing;

import java.security.SecureRandom;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class PairingManager {

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final Map<String, PairingSession> sessions = new ConcurrentHashMap<>();

    public String createSession(String host, int port, String apiKey) {
        String code = generateCode();
        sessions.put(code, new PairingSession(code, host, port, apiKey));
        return code;
    }

    public PairingSession validateAndClaim(String code) {
        PairingSession session = sessions.get(code);
        if (session == null || !session.isValid()) return null;
        session.markUsed();
        return session;
    }

    public PairingSession getSession(String code) {
        return sessions.get(code);
    }

    public boolean registerRemoteCode(String code) {
        if (sessions.containsKey(code)) return false;
        sessions.put(code, new PairingSession(code, null, 0, null));
        return true;
    }

    public void claimRemoteCode(String code, String claimedBy) {
        PairingSession session = sessions.get(code);
        if (session != null) {
            session.setClaimedBy(claimedBy);
        }
    }

    public void cleanup() {
        long now = System.currentTimeMillis();
        sessions.values().removeIf(s -> s.isExpired());
    }

    private String generateCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CHARS.charAt(RANDOM.nextInt(CHARS.length())));
        }
        return sb.toString();
    }
}
