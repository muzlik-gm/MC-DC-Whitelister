package com.whitelistbot.command;

import com.whitelistbot.WhitelistBotPlugin;
import com.whitelistbot.config.ConfigManager;
import com.whitelistbot.data.DataStore;
import com.whitelistbot.gui.ConfigGUI;
import com.whitelistbot.pairing.PairingManager;
import com.whitelistbot.pairing.PairingSession;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.event.HoverEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

public class WhitelistBotCommand implements CommandExecutor, TabCompleter {

    private static final int DEFAULT_PORT = 25252;

    private final WhitelistBotPlugin plugin;
    private final ConfigManager config;
    private final PairingManager pairing;
    private final DataStore dataStore;

    public WhitelistBotCommand(WhitelistBotPlugin plugin, ConfigManager config, PairingManager pairing, DataStore dataStore) {
        this.plugin = plugin;
        this.config = config;
        this.pairing = pairing;
        this.dataStore = dataStore;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            showHelp(sender);
            return true;
        }

        switch (args[0].toLowerCase()) {
            case "pair" -> handlePair(sender);
            case "connect" -> handleConnect(sender, args);
            case "unlink" -> handleUnlink(sender);
            case "status" -> handleStatus(sender);
            case "tutorial" -> handleTutorial(sender);
            case "config" -> handleConfig(sender);
            default -> showHelp(sender);
        }
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (args.length == 1) {
            List<String> cmds = new ArrayList<>(Arrays.asList("pair", "connect", "unlink", "status", "tutorial", "config"));
            return cmds;
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("connect")) {
            return Collections.singletonList("<code>");
        }
        return Collections.emptyList();
    }

    private Component separator() {
        return Component.text("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", NamedTextColor.DARK_GRAY, TextDecoration.STRIKETHROUGH);
    }

    private Component cmd(String text) {
        return Component.text(text, NamedTextColor.YELLOW, TextDecoration.BOLD);
    }

    private Component val(String text) {
        return Component.text(text, NamedTextColor.WHITE);
    }

    private Component label(String text) {
        return Component.text(text, NamedTextColor.AQUA);
    }

    private Component dim(String text) {
        return Component.text(text, NamedTextColor.GRAY);
    }

    private Component warn(String text) {
        return Component.text(text, NamedTextColor.YELLOW);
    }

    private Component good(String text) {
        return Component.text(text, NamedTextColor.GREEN);
    }

    private Component bad(String text) {
        return Component.text(text, NamedTextColor.RED);
    }

    private Component bold(String text, NamedTextColor color) {
        return Component.text(text, color, TextDecoration.BOLD);
    }

    private Component clickable(String text, String copyText, String hoverText) {
        return Component.text(text, NamedTextColor.YELLOW, TextDecoration.BOLD)
                .clickEvent(ClickEvent.copyToClipboard(copyText))
                .hoverEvent(HoverEvent.showText(Component.text(hoverText, NamedTextColor.GREEN)));
    }

    private Component timeRemaining(long millis) {
        long sec = millis / 1000;
        long min = sec / 60;
        long hrs = min / 60;
        long days = hrs / 24;
        if (days > 0) return Component.text(days + " day(s) " + (hrs % 24) + "h", NamedTextColor.AQUA);
        if (hrs > 0) return Component.text(hrs + "h " + (min % 60) + "m", NamedTextColor.AQUA);
        if (min > 0) return Component.text(min + "m " + (sec % 60) + "s", NamedTextColor.AQUA);
        return Component.text(sec + "s", NamedTextColor.AQUA);
    }

    private void showHelp(CommandSender sender) {
        sender.sendMessage(separator());
        sender.sendMessage(label("WhitelistBot ").append(dim("by muzlik")));
        sender.sendMessage(cmd("/wlb pair").append(dim("  \u2014 Generate a pairing code for Discord")));
        sender.sendMessage(cmd("/wlb connect <code>").append(dim("  \u2014 Confirm a pairing from Discord")));
        sender.sendMessage(cmd("/wlb unlink").append(dim("  \u2014 Rotate API key and disconnect Discord")));
        sender.sendMessage(cmd("/wlb status").append(dim("  \u2014 Show server connection status")));
        sender.sendMessage(cmd("/wlb tutorial").append(dim("  \u2014 Show full setup guide")));
        sender.sendMessage(cmd("/wlb config").append(dim("  \u2014 Open configuration GUI")));
        sender.sendMessage(separator());
    }

    private void handleTutorial(CommandSender sender) {
        sender.sendMessage(separator());
        sender.sendMessage(label("WhitelistBot Setup Guide"));
        sender.sendMessage(Component.empty());

        sender.sendMessage(bold("Method 1 \u2014 MC to Discord", NamedTextColor.GOLD));
        sender.sendMessage(dim("1. Run ").append(cmd("/wlb pair")).append(dim(" on this server")));
        sender.sendMessage(dim("2. Click the ").append(cmd("yellow command")).append(dim(" to copy it")));
        sender.sendMessage(dim("3. ").append(bold("Paste", NamedTextColor.GREEN)).append(dim(" it into Discord \u2014 it starts with ")).append(cmd(">")));
        sender.sendMessage(Component.empty());

        sender.sendMessage(bold("Method 2 \u2014 Discord to MC", NamedTextColor.GOLD));
        sender.sendMessage(dim("1. In Discord, run ").append(cmd(">pair ip:your.server.ip")));
        sender.sendMessage(dim("2. You get a code. Run ").append(cmd("/wlb connect <code>")).append(dim(" here")));
        sender.sendMessage(dim("3. Click the ").append(cmd("yellow command")).append(dim(" it gives you")));
        sender.sendMessage(dim("4. ").append(bold("Paste", NamedTextColor.GREEN)).append(dim(" it into Discord to finish")));
        sender.sendMessage(Component.empty());

        sender.sendMessage(good("Discord prefix commands use ").append(cmd(">")));
        sender.sendMessage(
                clickable(">connect <code> ip:your.server.ip", ">connect <code> ip:your.server.ip", "Click to copy example")
        );
        sender.sendMessage(dim("Replace ").append(val("<code>")).append(dim(" with your actual pairing code.")));
        sender.sendMessage(separator());
    }

    private void handlePair(CommandSender sender) {
        String host = config.getHost();
        int port = config.getPort();

        String apiKey = config.getApiKey();
        if (apiKey == null || apiKey.isEmpty()) {
            apiKey = "pending";
        } else if (apiKey.equals("CHANGE_ME_TO_A_SECURE_RANDOM_KEY")) {
            apiKey = "pending";
        }

        String code = pairing.createSession(host, port, apiKey);

        String portDisplay = (port != DEFAULT_PORT) ? " port:" + port : "";
        String fullCommand = ">connect " + code + " ip:" + host + portDisplay;
        String serverDisplay = host + (port != DEFAULT_PORT ? ":" + port : "");

        sender.sendMessage(separator());
        sender.sendMessage(good("Pairing code generated"));
        sender.sendMessage(label("Code").append(dim(": ")).append(val(code)));
        sender.sendMessage(label("Server").append(dim(": ")).append(val(serverDisplay)));
        sender.sendMessage(Component.empty());
        sender.sendMessage(dim("Click below to copy the Discord command:"));
        sender.sendMessage(
                Component.text(fullCommand, NamedTextColor.YELLOW, TextDecoration.BOLD)
                        .clickEvent(ClickEvent.copyToClipboard(fullCommand))
                        .hoverEvent(HoverEvent.showText(Component.text("Click to copy", NamedTextColor.GREEN)))
        );
        sender.sendMessage(dim("Then ").append(bold("paste", NamedTextColor.GREEN)).append(dim(" it into Discord.")));
        sender.sendMessage(bad("Code expires in 5 minutes. One-time use."));

        // Show port allocation reminder for hosted servers
        if (port == DEFAULT_PORT) {
            sender.sendMessage(Component.empty());
            sender.sendMessage(warn("Important: If your server is hosted (Pterodactyl, etc.),"));
            sender.sendMessage(warn("allocate port " + port + " (TCP) in your panel, or pairing will fail."));
        }

        sender.sendMessage(dim("Tip: Use ").append(cmd(">tutorial")).append(dim(" in Discord for the full guide.")));
        sender.sendMessage(separator());
    }

    private void handleConnect(CommandSender sender, String[] args) {
        if (args.length < 2) {
            sender.sendMessage(bad("Usage: ").append(cmd("/wlb connect <code>")));
            return;
        }

        String code = args[1].toUpperCase();
        PairingSession session = pairing.getSession(code);

        if (session == null) {
            sender.sendMessage(bad("Unknown code. Make sure you copied it correctly."));
            sender.sendMessage(dim("Codes expire after 5 minutes. Server restarts also clear codes."));
            return;
        }

        if (session.isExpired()) {
            sender.sendMessage(bad("This code has expired. ").append(cmd("/wlb pair")).append(bad(" to generate a new one.")));
            return;
        }

        if (session.getApiKey() == null) {
            if (session.getClaimedBy() != null) {
                sender.sendMessage(warn("This code is already being processed. Check Discord."));
                return;
            }
            pairing.claimRemoteCode(code, sender.getName());

            String host = config.getHost();
            int port = config.getPort();
            String portPart = (port != DEFAULT_PORT) ? " port:" + port : "";
            String serverDisplay = host + (port != DEFAULT_PORT ? ":" + port : "");
            String fullCommand = ">connect " + code + " ip:" + host + portPart;

            sender.sendMessage(separator());
            sender.sendMessage(good("Challenge accepted from Discord"));
            sender.sendMessage(label("Server").append(dim(": ")).append(val(serverDisplay)));
            sender.sendMessage(Component.empty());
            sender.sendMessage(dim("Click below to copy the Discord command:"));
            sender.sendMessage(
                    Component.text(fullCommand, NamedTextColor.YELLOW, TextDecoration.BOLD)
                            .clickEvent(ClickEvent.copyToClipboard(fullCommand))
                            .hoverEvent(HoverEvent.showText(Component.text("Click to copy \u2192", NamedTextColor.GREEN)))
            );
            sender.sendMessage(dim("Then ").append(bold("paste", NamedTextColor.GREEN)).append(dim(" it into Discord to complete the connection.")));
            sender.sendMessage(separator());
        } else {
            if (session.isUsed()) {
                sender.sendMessage(warn("This code has already been used. The server is connected."));
                return;
            }
            String host = session.getHost();
            int port = session.getPort();
            String fullCommand = ">connect " + code + " ip:" + host + (port != DEFAULT_PORT ? " port:" + port : "");
            sender.sendMessage(dim("This code was generated by this server."));
            sender.sendMessage(
                    dim("Click to copy for Discord: ")
                            .append(Component.text(fullCommand, NamedTextColor.YELLOW, TextDecoration.BOLD)
                                    .clickEvent(ClickEvent.copyToClipboard(fullCommand))
                                    .hoverEvent(HoverEvent.showText(Component.text("Click to copy", NamedTextColor.GREEN))))
            );
        }
    }

    private void handleUnlink(CommandSender sender) {
        if (!config.isAllowUserUnlink()) {
            sender.sendMessage(bad("User unlink is disabled by the server admin."));
            return;
        }

        if (sender instanceof Player player) {
            UUID uuid = player.getUniqueId();

            if (dataStore.hasLinkTimestamp(uuid)) {
                long elapsed = dataStore.getTimeSinceLinked(uuid);
                long cooldown = config.getCooldownMillis();

                if (elapsed < cooldown) {
                    long remaining = cooldown - elapsed;
                    sender.sendMessage(separator());
                    sender.sendMessage(bad("You must wait before unlinking."));
                    sender.sendMessage(dim("Time remaining: ").append(timeRemaining(remaining)));
                    sender.sendMessage(dim("Cooldown from linking: ").append(val(config.getCooldownLabel())));
                    sender.sendMessage(separator());
                    return;
                }
            }
        }

        String newKey = ConfigManager.generateApiKey();

        config.setApiKey(newKey);
        plugin.saveConfig();

        sender.sendMessage(separator());
        sender.sendMessage(bad("API key rotated"));
        sender.sendMessage(dim("The Discord bot can no longer connect with the old key."));
        sender.sendMessage(Component.empty());
        sender.sendMessage(dim("To reconnect, run in Discord:"));
        sender.sendMessage(
                clickable(">setup apikey:" + newKey, ">setup apikey:" + newKey, "Click to copy")
        );
        sender.sendMessage(dim("Or generate a new pairing with ").append(cmd("/wlb pair")));
        sender.sendMessage(separator());
    }

    private void handleStatus(CommandSender sender) {
        String host = config.getHost();
        int port = config.getPort();
        String currentKey = config.getApiKey();
        boolean keyIsEmpty = currentKey == null || currentKey.isEmpty() || currentKey.equals("pending");
        boolean hasDefaultKey = currentKey.equals("CHANGE_ME_TO_A_SECURE_RANDOM_KEY");

        sender.sendMessage(separator());
        sender.sendMessage(label("Server Status"));
        sender.sendMessage(
                dim("External Host").append(dim(": ")).append(val(host))
        );
        sender.sendMessage(
                dim("API Port").append(dim(": ")).append(val(String.valueOf(port)))
        );
        sender.sendMessage(
                dim("API Server").append(dim(": ")).append(
                        plugin.getApiServerRunning()
                                ? good("Listening on 0.0.0.0:" + port)
                                : bad("Stopped"))
        );
        sender.sendMessage(
                dim("API Key").append(dim(": ")).append(
                        keyIsEmpty ? bad("Not configured. Run /wlb pair")
                        : hasDefaultKey ? bad("Change in config.yml")
                        : good("Configured"))
        );
        if (plugin.getApiServerRunning()) {
            sender.sendMessage(Component.empty());
            sender.sendMessage(good("Ready to pair! Use ").append(cmd("/wlb pair")).append(good(" or run ")).append(cmd(">pair")).append(good(" in Discord.")));
        }

        sender.sendMessage(Component.empty());
        sender.sendMessage(bold("Config", NamedTextColor.AQUA));
        sender.sendMessage(
                dim("Unlink: ").append(config.isAllowUserUnlink() ? good("Allowed") : bad("Disabled"))
                .append(dim(" | Cooldown: ")).append(val(config.getCooldownLabel()))
        );
        sender.sendMessage(
                dim("Anti-Alt: ").append(config.isAntiAltEnabled() ? good("Enabled") : bad("Disabled"))
                .append(dim(" | Max/IP: ")).append(val(String.valueOf(config.getAntiAltMaxAccounts())))
        );
        sender.sendMessage(dim("Run ").append(cmd("/wlb config")).append(dim(" to open the config GUI.")));
        sender.sendMessage(separator());
    }

    private void handleConfig(CommandSender sender) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(bad("Only players can open the config GUI."));
            return;
        }
        new ConfigGUI(plugin, player);
    }


}
