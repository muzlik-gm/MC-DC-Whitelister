const guilds = require('../database/guilds');
const MinecraftApi = require('../services/MinecraftApi');
const { isValidHost, isValidPort } = require('../utils/validation');
const { EmbedBuilder } = require('discord.js');

async function setup(ctx) {
  const host = ctx.options.get('host') || '127.0.0.1';
  const port = Number(ctx.options.get('port')) || 25252;
  const apiKey = ctx.options.get('apikey');
  const role = ctx.options.get('role') || null;

  if (!isValidHost(host)) {
    return ctx.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid hostname format.')] });
  }

  if (!isValidPort(port)) {
    return ctx.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Port must be between 1 and 65535.')] });
  }

  await ctx.deferReply();

  const guildConfig = guilds.setConfig(ctx.guildId, {
    mc_host: host,
    mc_port: port,
    api_key: apiKey,
    whitelist_role_id: role ? role.id : null,
  });

  const api = new MinecraftApi(guildConfig);
  const online = await api.healthCheck();

  const embed = new EmbedBuilder()
    .setColor(online ? 0x2ecc71 : 0xe67e22)
    .setTitle(online ? '✅ Setup Complete' : '⚠️ Setup Saved (Server Offline)')
    .addFields(
      { name: 'Host', value: `\`${host}\``, inline: true },
      { name: 'Port', value: `\`${port}\``, inline: true },
      { name: 'Role', value: role ? `${role}` : '`None (anyone can whitelist)`', inline: true },
      { name: 'Status', value: online ? '🟢 Connected' : '🔴 Unreachable', inline: false }
    );

  if (!online) {
    embed.setDescription('Config saved, but could not reach the Minecraft plugin. Make sure the server is running and the API key matches.');
  }

  return ctx.editReply({ embeds: [embed] });
}

module.exports = setup;
