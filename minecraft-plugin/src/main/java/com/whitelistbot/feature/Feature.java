package com.whitelistbot.feature;

import com.sun.net.httpserver.HttpHandler;

import java.util.List;

public interface Feature {

    String getName();

    boolean isEnabled();

    void onEnable(com.whitelistbot.WhitelistBotPlugin plugin);

    void onDisable();

    List<Endpoint> getEndpoints();

    interface Endpoint {
        String getPath();
        HttpHandler getHandler();
    }
}
