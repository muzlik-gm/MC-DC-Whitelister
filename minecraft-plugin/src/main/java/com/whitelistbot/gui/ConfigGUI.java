package com.whitelistbot.gui;

import com.whitelistbot.WhitelistBotPlugin;
import com.whitelistbot.config.ConfigManager;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.HandlerList;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.inventory.meta.SkullMeta;

import java.util.ArrayList;
import java.util.List;

public class ConfigGUI implements InventoryHolder, Listener {

    private static final String TITLE = "WhitelistBot Config";
    private static final int SIZE = 27;

    static final int SLOT_TOGGLE_UNLINK = 10;
    static final int SLOT_COOLDOWN = 13;
    static final int SLOT_DECREASE_COOLDOWN = 12;
    static final int SLOT_INCREASE_COOLDOWN = 14;

    static final int SLOT_TOGGLE_ANTIALT = 19;
    static final int SLOT_MAX_ACCOUNTS = 22;
    static final int SLOT_DECREASE_MAX = 21;
    static final int SLOT_INCREASE_MAX = 23;

    private final WhitelistBotPlugin plugin;
    private final ConfigManager config;
    private final Player player;
    private final Inventory inventory;

    public ConfigGUI(WhitelistBotPlugin plugin, Player player) {
        this.plugin = plugin;
        this.config = plugin.getConfigManager();
        this.player = player;
        this.inventory = Bukkit.createInventory(this, SIZE, Component.text(TITLE));
        build();
        plugin.getServer().getPluginManager().registerEvents(this, plugin);
        player.openInventory(inventory);
    }

    private void build() {
        for (int i = 0; i < SIZE; i++) {
            inventory.setItem(i, glass(Material.GRAY_STAINED_GLASS_PANE, " "));
        }

        inventory.setItem(4, item(Material.NAME_TAG, "§6§lWhitelistBot Config",
                "§7Configure all plugin settings here",
                "§7Click toggles, arrows cycle values"));

        inventory.setItem(9, glass(Material.LIGHT_BLUE_STAINED_GLASS_PANE, "§b§lUnlink Settings"));

        updateUnlinkToggle();
        updateCooldown();

        inventory.setItem(18, glass(Material.LIGHT_BLUE_STAINED_GLASS_PANE, "§b§lAnti-Alt Settings"));

        updateAntiAltToggle();
        updateMaxAccounts();
    }

    private void updateUnlinkToggle() {
        boolean enabled = config.isAllowUserUnlink();
        inventory.setItem(SLOT_TOGGLE_UNLINK, item(
                enabled ? Material.LIME_STAINED_GLASS_PANE : Material.RED_STAINED_GLASS_PANE,
                (enabled ? "§a§l" : "§c§l") + "User Unlink: " + (enabled ? "ON" : "OFF"),
                "§7Click to toggle"
        ));
    }

    private void updateCooldown() {
        inventory.setItem(SLOT_COOLDOWN, item(
                Material.PAPER,
                "§eCooldown: " + config.getCooldownLabel(),
                "§7Players must wait this long",
                "§7after linking before they can unlink"
        ));
        inventory.setItem(SLOT_DECREASE_COOLDOWN, item(
                Material.ARROW,
                "§e« Decrease Cooldown",
                "§7Current: " + config.getCooldownLabel()
        ));
        inventory.setItem(SLOT_INCREASE_COOLDOWN, item(
                Material.ARROW,
                "§eIncrease Cooldown »",
                "§7Current: " + config.getCooldownLabel()
        ));
    }

    private void updateAntiAltToggle() {
        boolean enabled = config.isAntiAltEnabled();
        inventory.setItem(SLOT_TOGGLE_ANTIALT, item(
                enabled ? Material.LIME_STAINED_GLASS_PANE : Material.RED_STAINED_GLASS_PANE,
                (enabled ? "§a§l" : "§c§l") + "Anti-Alt: " + (enabled ? "ON" : "OFF"),
                "§7Click to toggle"
        ));
    }

    private void updateMaxAccounts() {
        int max = config.getAntiAltMaxAccounts();
        ItemStack head = item(
                Material.PLAYER_HEAD,
                "§eMax Accounts Per IP: §f" + max,
                "§7Kicks players if more than this",
                "§7many accounts share an IP"
        );
        inventory.setItem(SLOT_MAX_ACCOUNTS, head);
        inventory.setItem(SLOT_DECREASE_MAX, item(
                Material.ARROW,
                "§e« Decrease Max",
                "§7Current: " + max
        ));
        inventory.setItem(SLOT_INCREASE_MAX, item(
                Material.ARROW,
                "§eIncrease Max »",
                "§7Current: " + max
        ));
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        if (!event.getInventory().equals(inventory)) return;
        event.setCancelled(true);

        if (event.getCurrentItem() == null || event.getCurrentItem().getType() == org.bukkit.Material.AIR || !event.getCurrentItem().hasItemMeta()) return;
        if (!event.getWhoClicked().equals(player)) return;

        int slot = event.getSlot();

        switch (slot) {
            case SLOT_TOGGLE_UNLINK -> {
                config.setAllowUserUnlink(!config.isAllowUserUnlink());
                plugin.saveConfig();
                updateUnlinkToggle();
            }
            case SLOT_DECREASE_COOLDOWN -> {
                int idx = config.getCooldownIndex();
                idx = (idx - 1 + ConfigManager.COOLDOWN_VALUES.length) % ConfigManager.COOLDOWN_VALUES.length;
                config.setCooldownIndex(idx);
                plugin.saveConfig();
                updateCooldown();
            }
            case SLOT_INCREASE_COOLDOWN -> {
                int idx = config.getCooldownIndex();
                idx = (idx + 1) % ConfigManager.COOLDOWN_VALUES.length;
                config.setCooldownIndex(idx);
                plugin.saveConfig();
                updateCooldown();
            }
            case SLOT_TOGGLE_ANTIALT -> {
                config.setAntiAltEnabled(!config.isAntiAltEnabled());
                plugin.saveConfig();
                updateAntiAltToggle();
            }
            case SLOT_DECREASE_MAX -> {
                int max = Math.max(1, config.getAntiAltMaxAccounts() - 1);
                config.setAntiAltMaxAccounts(max);
                plugin.saveConfig();
                updateMaxAccounts();
            }
            case SLOT_INCREASE_MAX -> {
                int max = Math.min(5, config.getAntiAltMaxAccounts() + 1);
                config.setAntiAltMaxAccounts(max);
                plugin.saveConfig();
                updateMaxAccounts();
            }
        }
    }

    @EventHandler
    public void onClose(InventoryCloseEvent event) {
        if (!event.getInventory().equals(inventory)) return;
        if (!event.getPlayer().equals(player)) return;
        HandlerList.unregisterAll(this);
    }

    @Override
    public Inventory getInventory() {
        return inventory;
    }

    private ItemStack item(Material mat, String name, String... lore) {
        ItemStack item = new ItemStack(mat);
        ItemMeta meta = item.getItemMeta();
        meta.displayName(Component.text(name));
        List<Component> loreList = new ArrayList<>();
        for (String line : lore) {
            loreList.add(Component.text(line));
        }
        meta.lore(loreList);
        item.setItemMeta(meta);
        return item;
    }

    private ItemStack glass(Material mat, String name) {
        ItemStack item = new ItemStack(mat);
        ItemMeta meta = item.getItemMeta();
        meta.displayName(Component.text(name));
        item.setItemMeta(meta);
        return item;
    }
}
