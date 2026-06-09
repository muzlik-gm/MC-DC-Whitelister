const whitelistDb = require('../database/whitelist');
const guilds = require('../database/guilds');
const MinecraftApi = require('../services/MinecraftApi');
const { EmbedBuilder } = require('discord.js');

const COOLDOWN_MAP = {
  '10m': 600_000, '30m': 1_800_000, '1h': 3_600_000,
  '6h': 21_600_000, '1d': 86_400_000, '3d': 259_200_000,
  '1w': 604_800_000, '2w': 1_209_600_000, '1mo': 2_592_000_000,
};

function formatRemaining(ms) {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

async function unlink(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server isn\'t connected to any Minecraft server.')]
    });
  }

  const link = whitelistDb.getLink(ctx.guildId, ctx.userId);
  if (!link) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('You do not have a linked account in this server.')]
    });
  }

  await ctx.deferReply();

  const api = new MinecraftApi(ctx.guildConfig);
  const cfgResult = await api.getConfig();

  // Handle auth failure — API key was rotated on MC side
  if (cfgResult.auth_failure) {
    whitelistDb.unlinkAccount(ctx.guildId, ctx.userId);
    guilds.clearConfig(ctx.guildId);
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle('⚠️ Server Disconnected').setDescription(
        `The Minecraft server's API key was rotated. Your account **${link.minecraft_username}** has been removed from the whitelist.\n\nAsk an admin to re-pair the server with \`>pair\` or \`/pair\`.`
      )]
    });
  }

  if (cfgResult.ok) {
    const cfg = cfgResult;

    if (!cfg.unlink.allow_user_unlink) {
      return ctx.editReply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Unlinking is currently disabled by the server admin.')]
      });
    }

    const cooldownMs = COOLDOWN_MAP[cfg.unlink.cooldown];
    if (cooldownMs) {
      const linkedAt = new Date(link.linked_at + 'Z').getTime();
      const elapsed = Date.now() - linkedAt;
      if (elapsed < cooldownMs) {
        const remaining = formatRemaining(cooldownMs - elapsed);
        return ctx.editReply({
          embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription(`You must wait \`${remaining}\` before unlinking (cooldown: ${cfg.unlink.cooldown}).`)]
        });
      }
    }
  } else {
    // Plugin unreachable — still allow local unlink, but warn user
    whitelistDb.unlinkAccount(ctx.guildId, ctx.userId);
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle('⚠️ Partially Unlinked').setDescription(
        `**${link.minecraft_username}** has been removed from the local whitelist, but could not reach the Minecraft plugin to remove it from the server whitelist.\n\nIf you reconnect, run \`>unlink\` again.`
      )]
    });
  }

  whitelistDb.unlinkAccount(ctx.guildId, ctx.userId);

  const mcOnline = await api.healthCheck();
  if (mcOnline) {
    await api.removeFromWhitelist(link.minecraft_username);
  }

  return ctx.editReply({
    embeds: [new EmbedBuilder().setColor(0x3498db).setTitle('🔗 Unlinked').setDescription(`**${link.minecraft_username}** has been removed from this server's whitelist.`)]
  });
}

module.exports = unlink;
