const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const guilds = require('../database/guilds');
const MinecraftApi = require('../services/MinecraftApi');
const whitelistDb = require('../database/whitelist');

const COOLDOWN_LABELS = {
  '10m': '10 minutes', '30m': '30 minutes', '1h': '1 hour',
  '6h': '6 hours', '1d': '1 day', '3d': '3 days',
  '1w': '1 week', '2w': '2 weeks', '1mo': '1 month'
};

const COOLDOWN_ORDER = ['10m', '30m', '1h', '6h', '1d', '3d', '1w', '2w', '1mo'];
const MAX_RANGE = [1, 2, 3, 4, 5];

const ERROR_EMBED = (msg) => new EmbedBuilder().setColor(0xe74c3c).setDescription(msg);

async function handleCommand(ctx) {
  const guildCfg = guilds.getConfig(ctx.guildId);
  if (!guildCfg) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Server not paired yet. Use `>setup` or `/setup` first.')],
      flags: 64
    });
  }

  await ctx.deferReply();

  const api = new MinecraftApi(guildCfg);
  const result = await api.getConfig();

  if (!result.ok) {
    if (result.auth_failure) {
      guilds.clearConfig(ctx.guildId);
      whitelistDb.removeAllForGuild(ctx.guildId);
    }
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Failed to Load Config').setDescription(result.error || 'Could not reach the Minecraft plugin.')]
    });
  }

  const embed = buildEmbed(result);
  const rows = buildRows(result);
  return ctx.editReply({ embeds: [embed], components: rows });
}

async function handleComponent(interaction) {
  const customId = interaction.customId;
  const guildCfg = guilds.getConfig(interaction.guildId);
  if (!guildCfg) {
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Server not paired.')],
      components: []
    });
  }

  const api = new MinecraftApi(guildCfg);

  // Always defer first — API calls may take time
  await interaction.deferUpdate();

  // Handle each interaction type
  try {
    let result;

    switch (customId) {
      case 'config_refresh':
        result = await api.getConfig();
        if (!result.ok) throw new Error(result.error);
        return interaction.editReply({ embeds: [buildEmbed(result)], components: buildRows(result) });

      case 'config_select_cooldown': {
        if (!interaction.isStringSelectMenu()) return;
        const cooldown = interaction.values[0];
        const r = await api.updateConfig({ unlink: { cooldown } });
        if (!r.ok) throw new Error(r.error);
        result = await api.getConfig();
        if (!result.ok) throw new Error(result.error);
        return interaction.editReply({ embeds: [buildEmbed(result)], components: buildRows(result) });
      }

      case 'config_select_maxaccounts': {
        if (!interaction.isStringSelectMenu()) return;
        const max = parseInt(interaction.values[0], 10);
        const r = await api.updateConfig({ anti_alt: { max_accounts: max } });
        if (!r.ok) throw new Error(r.error);
        result = await api.getConfig();
        if (!result.ok) throw new Error(result.error);
        return interaction.editReply({ embeds: [buildEmbed(result)], components: buildRows(result) });
      }

      case 'config_toggle_unlink': {
        result = await api.getConfig();
        if (!result.ok) throw new Error(result.error);
        const toggleTo = !result.unlink.allow_user_unlink;
        const r = await api.updateConfig({ unlink: { allow_user_unlink: toggleTo } });
        if (!r.ok) throw new Error(r.error);
        result = await api.getConfig();
        if (!result.ok) throw new Error(result.error);
        return interaction.editReply({ embeds: [buildEmbed(result)], components: buildRows(result) });
      }

      case 'config_toggle_antialt': {
        result = await api.getConfig();
        if (!result.ok) throw new Error(result.error);
        const toggleTo = !result.anti_alt.enabled;
        const r = await api.updateConfig({ anti_alt: { enabled: toggleTo } });
        if (!r.ok) throw new Error(r.error);
        result = await api.getConfig();
        if (!result.ok) throw new Error(result.error);
        return interaction.editReply({ embeds: [buildEmbed(result)], components: buildRows(result) });
      }

      default:
        return interaction.editReply({
          embeds: [ERROR_EMBED('Unknown interaction.')],
          components: []
        });
    }
  } catch (err) {
    return interaction.editReply({
      embeds: [ERROR_EMBED(err.message || 'Failed to update config.')],
      components: []
    });
  }
}

function buildEmbed(result) {
  const u = result.unlink;
  const a = result.anti_alt;
  const cooldownLabel = COOLDOWN_LABELS[u.cooldown] || u.cooldown;

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('⚙️ WhitelistBot Configuration')
    .setDescription('Changes update the config.yml on your Minecraft server in real time.')
    .addFields(
      { name: '🔓 User Unlink', value: u.allow_user_unlink ? '✅ Allowed' : '❌ Disabled', inline: true },
      { name: '⏱️ Unlink Cooldown', value: cooldownLabel, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: '🛡️ Anti-Alt', value: a.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
      { name: '👥 Max Accounts / IP', value: `\`${a.max_accounts}\``, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
    )
    .setFooter({ text: 'Changes are synced with the MC config GUI' });
}

function buildRows(result) {
  const u = result.unlink;
  const a = result.anti_alt;
  const currentCooldownLabel = COOLDOWN_LABELS[u.cooldown] || u.cooldown;

  const unlinkBtn = new ButtonBuilder()
    .setCustomId('config_toggle_unlink')
    .setLabel(u.allow_user_unlink ? '🔓 User Unlink: ON' : '🔒 User Unlink: OFF')
    .setStyle(u.allow_user_unlink ? ButtonStyle.Success : ButtonStyle.Danger);

  const cooldownSelect = new StringSelectMenuBuilder()
    .setCustomId('config_select_cooldown')
    .setPlaceholder('Cooldown: ' + currentCooldownLabel)
    .addOptions(
      COOLDOWN_ORDER.map(k => ({
        label: COOLDOWN_LABELS[k],
        value: k,
        default: k === u.cooldown
      }))
    );

  const antialtBtn = new ButtonBuilder()
    .setCustomId('config_toggle_antialt')
    .setLabel(a.enabled ? '🛡️ Anti-Alt: ON' : '🛡️ Anti-Alt: OFF')
    .setStyle(a.enabled ? ButtonStyle.Success : ButtonStyle.Danger);

  const maxSelect = new StringSelectMenuBuilder()
    .setCustomId('config_select_maxaccounts')
    .setPlaceholder('Max/IP: ' + a.max_accounts)
    .addOptions(
      MAX_RANGE.map(n => ({
        label: n + ' account' + (n > 1 ? 's' : ''),
        value: String(n),
        default: n === a.max_accounts
      }))
    );

  const refreshBtn = new ButtonBuilder()
    .setCustomId('config_refresh')
    .setLabel('🔄 Refresh')
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder().addComponents(unlinkBtn, antialtBtn);
  const row2 = new ActionRowBuilder().addComponents(cooldownSelect);
  const row3 = new ActionRowBuilder().addComponents(maxSelect);
  const row4 = new ActionRowBuilder().addComponents(refreshBtn);

  return [row1, row2, row3, row4];
}

module.exports = { handleCommand, handleComponent };
