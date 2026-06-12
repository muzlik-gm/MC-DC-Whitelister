const { EmbedBuilder } = require('discord.js');
const MinecraftApi = require('../services/MinecraftApi');
const { isValidMinecraftUsername } = require('../utils/validation');
const { logAction } = require('../database/audit');

async function muteHandler(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server is not linked to any Minecraft server. Pair one first with `/pair` or `>pair`.')]
    });
  }

  if (ctx.options.get('remove') || ctx.options.get('action') === 'remove') return handleUnmute(ctx);
  return handleMute(ctx);
}

async function handleMute(ctx) {
  const username = ctx.options.get('username');
  if (!username || !isValidMinecraftUsername(username)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid Minecraft username.')]
    });
  }

  const duration = ctx.options.get('duration');
  if (duration == null || duration < 1) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify a valid duration in minutes.')]
    });
  }

  const reason = ctx.options.get('reason') || 'No reason provided.';
  await ctx.deferReply();

  const api = new MinecraftApi(ctx.guildConfig);
  const res = await api.request('/api/moderation/mute', { player: username, duration, reason });

  if (!res.ok) {
    if (res.auth_failure) {
      return ctx.editReply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Mute Failed').setDescription('Connection lost — API key was rejected.')]
      });
    }
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Mute Failed').setDescription(res.error || 'Could not mute player.')]
    });
  }

  logAction(ctx.guildId, 'mute', ctx.userId, username, `Duration: ${duration}m — ${reason}`);

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('Player Muted')
    .setDescription(`**${username}** has been muted for **${duration}** minute(s).`)
    .addFields({ name: 'Reason', value: reason, inline: false });

  return ctx.editReply({ embeds: [embed] });
}

async function handleUnmute(ctx) {
  const username = ctx.options.get('username');
  if (!username || !isValidMinecraftUsername(username)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid Minecraft username.')]
    });
  }

  await ctx.deferReply();

  const api = new MinecraftApi(ctx.guildConfig);
  const res = await api.request('/api/moderation/unmute', { player: username });

  if (!res.ok) {
    if (res.auth_failure) {
      return ctx.editReply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Unmute Failed').setDescription('Connection lost — API key was rejected.')]
      });
    }
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Unmute Failed').setDescription(res.error || 'Could not unmute player.')]
    });
  }

  logAction(ctx.guildId, 'unmute', ctx.userId, username, null);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Player Unmuted')
    .setDescription(`**${username}** has been unmuted.`);

  return ctx.editReply({ embeds: [embed] });
}

module.exports = muteHandler;
