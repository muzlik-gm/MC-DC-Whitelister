const settings = require('../database/settings');
const { EmbedBuilder, ChannelType } = require('discord.js');

async function loggingHandler(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server is not linked to any Minecraft server. Pair one first with `/pair` or `>pair`.')]
    });
  }

  const action = ctx.options.get('action') || 'status';

  if (action === 'channel') {
    const channel = ctx.options.get('channel');
    if (!channel) {
      const current = settings.getSettings(ctx.guildId);
      return ctx.reply({
        embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(current?.log_channel_id ? `<#${current.log_channel_id}>` : 'No log channel set.')]
      });
    }

    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
      return ctx.reply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Must be a text channel.')]
      });
    }

    settings.setLogChannel(ctx.guildId, channel.id);
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`Activity logs will be posted to ${channel}.`)],
      ephemeral: true
    });
  }

  if (action === 'types') {
    const join = ctx.options.get('join') ?? null;
    const leave = ctx.options.get('leave') ?? null;
    const death = ctx.options.get('death') ?? null;
    const advancement = ctx.options.get('advancement') ?? null;

    const types = {};
    if (join !== null) types.join = join ? 1 : 0;
    if (leave !== null) types.leave = leave ? 1 : 0;
    if (death !== null) types.death = death ? 1 : 0;
    if (advancement !== null) types.advancement = advancement ? 1 : 0;

    settings.setLogTypes(ctx.guildId, types);
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription('Log types updated.')],
      ephemeral: true
    });
  }

  if (action === 'clear') {
    settings.setLogChannel(ctx.guildId, null);
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Log channel cleared. Activity will no longer be posted.')],
      ephemeral: true
    });
  }

  // status
  const s = settings.getSettings(ctx.guildId);
  const embed = new EmbedBuilder()
    .setColor(s?.log_channel_id ? 0x2ecc71 : 0x95a5a6)
    .setTitle('Activity Logging')
    .addFields(
      { name: 'Channel', value: s?.log_channel_id ? `<#${s.log_channel_id}>` : 'Not set', inline: true },
      { name: 'Joins', value: s?.log_joins ? '✅' : '❌', inline: true },
      { name: 'Leaves', value: s?.log_leaves ? '✅' : '❌', inline: true },
      { name: 'Deaths', value: s?.log_deaths ? '✅' : '❌', inline: true },
      { name: 'Advancements', value: s?.log_advancements ? '✅' : '❌', inline: true },
    );

  return ctx.reply({ embeds: [embed], ephemeral: true });
}

module.exports = loggingHandler;
