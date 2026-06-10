const MinecraftApi = require('../services/MinecraftApi');
const { EmbedBuilder } = require('discord.js');
const { logAction } = require('../database/audit');

async function consoleExec(ctx) {
  const guildConfig = ctx.guildConfig;
  if (!guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server is not linked to any Minecraft server. Use `/pair` or `>pair` to link one first.')]
    });
  }

  const command = ctx.options.get('command');
  if (!command || command.trim().length === 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify a command to run. Usage: `/console <command>`')]
    });
  }

  if (command.length > 200) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Command too long (max 200 characters).')]
    });
  }

  await ctx.deferReply();

  const api = new MinecraftApi(guildConfig);
  const res = await api.request('/api/console/execute', { command });

  if (!res.ok) {
    if (res.auth_failure) {
      return ctx.editReply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Remote Console').setDescription('Connection lost — API key was rejected. The key may have been rotated on the Minecraft server.').addFields({ name: 'To Fix', value: 'Use `/unlinkserver` then re-pair with `/pair`.', inline: false })]
      });
    }
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Remote Console').setDescription(res.error || 'Could not execute command.')]
    });
  }

  logAction(ctx.guildId, 'console', ctx.userId, null, `/${command}`);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Command Executed')
    .addFields({ name: 'Command', value: `\`/${command}\``, inline: false })
    .addFields({ name: 'Result', value: res.output || 'Done.', inline: false });

  return ctx.editReply({ embeds: [embed] });
}

module.exports = consoleExec;
