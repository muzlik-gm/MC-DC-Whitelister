package com.whitelistbot.listener;

import com.whitelistbot.WhitelistBotPlugin;
import com.whitelistbot.config.ConfigManager;
import com.whitelistbot.data.DataStore;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

public class AntiAltListener implements Listener {

    private final WhitelistBotPlugin plugin;
    private final DataStore dataStore;
    private final ConfigManager config;

    public AntiAltListener(WhitelistBotPlugin plugin) {
        this.plugin = plugin;
        this.dataStore = plugin.getDataStore();
        this.config = plugin.getConfigManager();
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        if (!config.isAntiAltEnabled()) return;

        Player player = event.getPlayer();
        String ip = player.getAddress() != null
                ? player.getAddress().getAddress().getHostAddress()
                : "unknown";

        dataStore.recordPlayerIp(player.getUniqueId(), ip);

        int existing = dataStore.countAccountsOnIpExcluding(ip, player.getUniqueId());

        if (existing >= config.getAntiAltMaxAccounts()) {
            player.kick(Component.text()
                    .append(Component.text("Too many accounts from the same IP address.\n", NamedTextColor.RED))
                    .append(Component.text("Only " + config.getAntiAltMaxAccounts() + " account(s) per IP allowed.", NamedTextColor.YELLOW))
                    .build()
            );
            plugin.getLogger().warning("Kicked " + player.getName() + " (" + ip + "): max accounts per IP reached.");
        }
    }
}
