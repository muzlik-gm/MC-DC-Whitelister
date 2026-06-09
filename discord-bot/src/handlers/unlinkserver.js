const guilds = require('../database/guilds');
const whitelistDb = require('../database/whitelist');
const MinecraftApi = require('../services/MinecraftApi');
const { EmbedBuilder } = require('discord.js');

async function unlinkserver(ctx) {
  const guildConfig = guilds.getConfig(ctx.guildId);
  if (!guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('This server is not linked to any Minecraft server.')]
    });
  }

  await ctx.deferReply();

  const server = `${guildConfig.mc_host}:${guildConfig.mc_port}`;
  const whitelistCount = whitelistDb.removeAllForGuild(ctx.guildId).removed;

  try {
    const api = new MinecraftApi(guildConfig);
    await api.request('/api/pair/disconnect', { guild_id: ctx.guildId });
  } catch {
    /* plugin unreachable — still remove local data */
  }

  guilds.removeConfig(ctx.guildId);

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('🔌 Server Disconnected')
    .setDescription(`This Discord server is no longer linked to \`${server}\`.`)
    .addFields(
      { name: 'Whitelist Entries Cleared', value: `\`${whitelistCount}\` accounts removed`, inline: true },
      { name: 'Config Removed', value: '✅ Local data deleted', inline: true },
      { name: 'Reconnect', value: 'Use `>pair`, `/pair`, `>connect`, or `/connect` to link a new server.', inline: false }
    );

  return ctx.editReply({ embeds: [embed] });
}

module.exports = unlinkserver;
