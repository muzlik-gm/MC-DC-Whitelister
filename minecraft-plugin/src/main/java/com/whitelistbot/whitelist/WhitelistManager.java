package com.whitelistbot.whitelist;

import com.whitelistbot.WhitelistBotPlugin;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;

import java.util.concurrent.TimeUnit;

public class WhitelistManager {

    public boolean addPlayer(String name) {
        try {
            return Bukkit.getScheduler().callSyncMethod(WhitelistBotPlugin.getInstance(), () -> {
                OfflinePlayer player = Bukkit.getOfflinePlayerIfCached(name);
                if (player == null) {
                    player = Bukkit.getOfflinePlayer(name);
                }
                if (player.isWhitelisted()) return false;
                player.setWhitelisted(true);
                return true;
            }).get(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            WhitelistBotPlugin.getInstance().getLogger().warning("Failed to whitelist " + name + ": " + e.getMessage());
            return false;
        }
    }

    public boolean removePlayer(String name) {
        try {
            return Bukkit.getScheduler().callSyncMethod(WhitelistBotPlugin.getInstance(), () -> {
                OfflinePlayer player = Bukkit.getOfflinePlayerIfCached(name);
                if (player == null) {
                    player = Bukkit.getOfflinePlayer(name);
                }
                if (!player.isWhitelisted()) return false;
                player.setWhitelisted(false);
                return true;
            }).get(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            WhitelistBotPlugin.getInstance().getLogger().warning("Failed to unwhitelist " + name + ": " + e.getMessage());
            return false;
        }
    }

    public boolean isWhitelisted(String name) {
        OfflinePlayer player = Bukkit.getOfflinePlayerIfCached(name);
        return player != null && player.isWhitelisted();
    }
}
