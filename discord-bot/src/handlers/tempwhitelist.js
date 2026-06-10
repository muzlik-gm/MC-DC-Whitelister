const { EmbedBuilder } = require('discord.js');
const tempDb = require('../database/tempwhitelist');
const MinecraftApi = require('../services/MinecraftApi');
const { isValidMinecraftUsername } = require('../utils/validation');
const { logAction } = require('../database/audit');

async function tempwhitelistHandler(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server is not linked to any Minecraft server. Pair one first with `/pair` or `>pair`.')]
    });
  }

  const action = ctx.options.get('action');

  if (action === 'add') return handleAdd(ctx);
  if (action === 'list') return handleList(ctx);
  if (action === 'remove') return handleRemove(ctx);

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Usage: `/tempwhitelist add <username> <duration>`, `/tempwhitelist list`, or `/tempwhitelist remove <username>`')]
  });
}

async function handleAdd(ctx) {
  const username = ctx.options.get('username');
  if (!username || !isValidMinecraftUsername(username)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid Minecraft username.')]
    });
  }

  const duration = ctx.options.get('duration');
  if (duration == null || duration < 1) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify a valid duration in hours.')]
    });
  }

  await ctx.deferReply();

  const api = new MinecraftApi(ctx.guildConfig);
  const res = await api.addToWhitelist(username);

  if (!res.ok) {
    if (res.auth_failure) {
      return ctx.editReply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Temp Whitelist Failed').setDescription('Connection lost — API key was rejected.')]
      });
    }
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Temp Whitelist Failed').setDescription(res.error || 'Could not whitelist player.')]
    });
  }

  const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
  tempDb.addTempWhitelist(ctx.guildId, null, username, expiresAt, ctx.userId);

  logAction(ctx.guildId, 'tempwhitelist_add', ctx.userId, username, `Duration: ${duration}h`);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Temporary Whitelist Added')
    .setDescription(`**${username}** has been whitelisted for **${duration}** hour(s).`);

  return ctx.editReply({ embeds: [embed] });
}

async function handleList(ctx) {
  const entries = tempDb.getActive(ctx.guildId);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Active Temporary Whitelists')
    .setDescription(entries.length === 0 ? 'No active temporary whitelists.' : `${entries.length} active entry(ies):`);

  if (entries.length > 0) {
    const lines = entries.map(e =>
      `**${e.minecraft_username}** — expires <t:${Math.floor(new Date(e.expires_at).getTime() / 1000)}:R>`
    );
    embed.addFields({ name: 'Entries', value: lines.join('\n'), inline: false });
  }

  return ctx.reply({ embeds: [embed] });
}

async function handleRemove(ctx) {
  const username = ctx.options.get('username');
  if (!username || !isValidMinecraftUsername(username)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid Minecraft username.')]
    });
  }

  await ctx.deferReply();

  const api = new MinecraftApi(ctx.guildConfig);
  await api.removeFromWhitelist(username);

  tempDb.remove(ctx.guildId, username);

  logAction(ctx.guildId, 'tempwhitelist_remove', ctx.userId, username, null);

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('Temporary Whitelist Removed')
    .setDescription(`**${username}** has been removed from the temporary whitelist.`);

  return ctx.editReply({ embeds: [embed] });
}

module.exports = tempwhitelistHandler;
