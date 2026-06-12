const { EmbedBuilder } = require('discord.js');
const moderationDb = require('../database/moderation');
const whitelistDb = require('../database/whitelist');
const MinecraftApi = require('../services/MinecraftApi');
const { isValidMinecraftUsername } = require('../utils/validation');
const { logAction } = require('../database/audit');

async function moderationHandler(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server is not linked to any Minecraft server. Pair one first with `/pair` or `>pair`.')]
    });
  }

  const action = ctx.commandName || ctx.options.get('action');

  if (action === 'ban') return handleBan(ctx);
  if (action === 'kick') return handleKick(ctx);
  if (action === 'warn') return handleWarn(ctx);
  if (action === 'warnings') return handleWarnings(ctx);
  if (action === 'delwarn') return handleDelwarn(ctx);

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Unknown moderation action.')]
  });
}

async function handleBan(ctx) {
  const username = ctx.options.get('username');
  if (!username || !isValidMinecraftUsername(username)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid Minecraft username.')]
    });
  }

  const reason = ctx.options.get('reason') || 'No reason provided.';
  await ctx.deferReply();

  const api = new MinecraftApi(ctx.guildConfig);
  const res = await api.banPlayer(username, reason);

  if (!res.ok) {
    if (res.auth_failure) {
      return ctx.editReply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Ban Failed').setDescription('Connection lost — API key was rejected.')]
      });
    }
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Ban Failed').setDescription(res.error || 'Could not ban player.')]
    });
  }

  logAction(ctx.guildId, 'ban', ctx.userId, username, reason);

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('Player Banned')
    .setDescription(`**${username}** has been banned.`)
    .addFields({ name: 'Reason', value: reason, inline: false });

  return ctx.editReply({ embeds: [embed] });
}

async function handleKick(ctx) {
  const username = ctx.options.get('username');
  if (!username || !isValidMinecraftUsername(username)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid Minecraft username.')]
    });
  }

  const reason = ctx.options.get('reason') || 'No reason provided.';
  await ctx.deferReply();

  const api = new MinecraftApi(ctx.guildConfig);
  const res = await api.kickPlayer(username, reason);

  if (!res.ok) {
    if (res.auth_failure) {
      return ctx.editReply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Kick Failed').setDescription('Connection lost — API key was rejected.')]
      });
    }
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Kick Failed').setDescription(res.error || 'Could not kick player.')]
    });
  }

  logAction(ctx.guildId, 'kick', ctx.userId, username, reason);

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('Player Kicked')
    .setDescription(`**${username}** has been kicked.`)
    .addFields({ name: 'Reason', value: reason, inline: false });

  return ctx.editReply({ embeds: [embed] });
}

async function handleWarn(ctx) {
  const username = ctx.options.get('username');
  if (!username || !isValidMinecraftUsername(username)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid Minecraft username.')]
    });
  }

  const reason = ctx.options.get('reason');
  if (!reason) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Provide a reason for the warning.')]
    });
  }

  await ctx.deferReply();

  const api = new MinecraftApi(ctx.guildConfig);

  let uuid = null;
  let playerName = username;

  const existing = whitelistDb.getByMinecraftUsername(ctx.guildId, username);
  if (existing) {
    const uuidRes = await api.request('/api/whitelist/uuid', { player: username });
    if (uuidRes.ok && uuidRes.uuid) {
      uuid = uuidRes.uuid;
    }
  }

  const apiRes = await api.warnPlayer(username, reason);

  const result = moderationDb.addWarning(
    ctx.guildId,
    uuid || username,
    playerName,
    ctx.userId,
    ctx.userTag,
    reason
  );

  if (!apiRes.ok && apiRes.auth_failure) {
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Warn Failed').setDescription('Connection lost — API key was rejected.')]
    });
  }

  logAction(ctx.guildId, 'warn', ctx.userId, username, reason);

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('Player Warned')
    .setDescription(`**${username}** has been warned (ID: \`${result.id}\`).`)
    .addFields({ name: 'Reason', value: reason, inline: false });

  return ctx.editReply({ embeds: [embed] });
}

async function handleWarnings(ctx) {
  const username = ctx.options.get('username');
  if (!username || !isValidMinecraftUsername(username)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid Minecraft username.')]
    });
  }

  const existing = whitelistDb.getByMinecraftUsername(ctx.guildId, username);
  const lookupKey = existing ? existing.minecraft_username : username;
  const warnings = moderationDb.getWarnings(ctx.guildId, lookupKey);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`Warnings for ${username}`)
    .setDescription(warnings.length === 0 ? 'No warnings found.' : `${warnings.length} warning(s):`);

  if (warnings.length > 0) {
    const lines = warnings.map((w, i) =>
      `**#${i + 1}** — ID: \`${w.id}\` — ${w.reason}\nBy ${w.moderator_name} — ${w.created_at}`
    );
    embed.addFields({ name: 'Warnings', value: lines.join('\n\n'), inline: false });
  }

  return ctx.reply({ embeds: [embed] });
}

async function handleDelwarn(ctx) {
  const id = ctx.options.get('id');
  if (id == null) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify a warning ID.')]
    });
  }

  const result = moderationDb.removeWarning(id);
  if (!result.ok) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`Warning ID \`${id}\` not found.`)]
    });
  }

  logAction(ctx.guildId, 'delwarn', ctx.userId, null, `Warning ID: ${id}`);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Warning Removed')
    .setDescription(`Warning ID \`${id}\` has been removed.`);

  return ctx.reply({ embeds: [embed] });
}

module.exports = moderationHandler;
