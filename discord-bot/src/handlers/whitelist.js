const whitelistDb = require('../database/whitelist');
const guilds = require('../database/guilds');
const rolesDb = require('../database/roles');
const MinecraftApi = require('../services/MinecraftApi');
const { isValidMinecraftUsername } = require('../utils/validation');
const { EmbedBuilder } = require('discord.js');

const cooldowns = new Map();
const COOLDOWN_MS = 10_000;

async function whitelist(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Not Configured').setDescription('This server hasn\'t been set up yet. Ask an admin to run `>setup` or `/setup`.')]
    });
  }

  const now = Date.now();
  if (cooldowns.has(ctx.userId)) {
    const expires = cooldowns.get(ctx.userId) - now;
    if (expires > 0) {
      return ctx.reply({
        embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription(`⏳ Please wait \`${(expires / 1000).toFixed(1)}s\` before using this command again.`)]
      });
    }
  }

  if (ctx.guildConfig.whitelist_role_id) {
    if (!ctx.member.roles.cache.has(ctx.guildConfig.whitelist_role_id)) {
      return ctx.reply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('You do not have the required role to use this command.')]
      });
    }
  }

  const username = ctx.options.get('username').trim();
  if (!isValidMinecraftUsername(username)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid Minecraft username — must be 3–16 characters (letters, numbers, underscores).')]
    });
  }

  await ctx.deferReply();

  const api = new MinecraftApi(ctx.guildConfig);
  const mcOnline = await api.healthCheck();
  if (!mcOnline) {
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('The Minecraft server is currently offline. Try again later.')]
    });
  }

  const dbResult = whitelistDb.linkAccount(ctx.guildId, ctx.userId, username, ctx.userTag);
  if (!dbResult.ok) {
    return ctx.editReply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(dbResult.error)] });
  }

  const apiResult = await api.addToWhitelist(username);
  if (!apiResult.ok) {
    whitelistDb.unlinkAccount(ctx.guildId, ctx.userId);

    // If the API key was rotated on the MC side, clear the config
    if (apiResult.auth_failure) {
      guilds.clearConfig(ctx.guildId);
      return ctx.editReply({
        embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle('⚠️ Server Disconnected').setDescription(
          `Could not whitelist **${username}** — the Minecraft server's API key was rotated.\n\nThe connection has been removed. Ask an admin to re-pair with \`>pair\` or \`/pair\`.`
        )]
      });
    }

    const reason = apiResult.error || 'The Minecraft server could not process the request.';
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`Failed to whitelist **${username}**: ${reason}`)]
    });
  }

  cooldowns.set(ctx.userId, now + COOLDOWN_MS);
  setTimeout(() => cooldowns.delete(ctx.userId), COOLDOWN_MS);

  const memberRoles = ctx.member.roles.cache.map(r => r.id);
  const group = rolesDb.getGroupForRoles(ctx.guildId, memberRoles);
  if (group) {
    const syncApi = new MinecraftApi(ctx.guildConfig);
    await syncApi.syncRoles(ctx.userId, username, group);
  }

  return ctx.editReply({
    embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('✅ Whitelisted').setDescription(`You are now whitelisted as **${username}**`).setFooter({ text: 'One account per server. Use >unlink or /unlink to change it.' })]
  });
}

module.exports = whitelist;
