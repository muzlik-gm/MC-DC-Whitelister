const { EmbedBuilder } = require('discord.js');
const settings = require('../database/settings');
const MinecraftApi = require('../services/MinecraftApi');
const guilds = require('../database/guilds');

async function handleSet(ctx) {
  const onlineChannel = ctx.options.get('online_channel');
  const playerChannel = ctx.options.get('player_channel');

  if (!onlineChannel && !playerChannel) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify at least one voice channel.')]
    });
  }

  if (onlineChannel && (onlineChannel.type !== 2)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Online channel must be a voice channel.')]
    });
  }

  if (playerChannel && (playerChannel.type !== 2)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Player channel must be a voice channel.')]
    });
  }

  settings.setStatusChannels(ctx.guildId, onlineChannel?.id || null, playerChannel?.id || null);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Status Channels Set')
    .setDescription(`${onlineChannel ? `Online channel: ${onlineChannel}\n` : ''}${playerChannel ? `Player channel: ${playerChannel}` : ''}`);

  return ctx.reply({ embeds: [embed] });
}

async function handleRemove(ctx) {
  settings.setStatusChannels(ctx.guildId, null, null);

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('Status Channels Removed')
    .setDescription('Dynamic status voice channels have been disabled.');

  return ctx.reply({ embeds: [embed] });
}

async function handleStatus(ctx) {
  const s = settings.getSettings(ctx.guildId);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Status Channel Configuration')
    .addFields(
      { name: 'Online Channel', value: s?.status_online_channel_id ? `<#${s.status_online_channel_id}>` : 'Not set', inline: true },
      { name: 'Player Channel', value: s?.status_player_channel_id ? `<#${s.status_player_channel_id}>` : 'Not set', inline: true }
    );

  return ctx.reply({ embeds: [embed], flags: 64 });
}

async function updateStatusChannels(client) {
  for (const [guildId, guild] of client.guilds.cache) {
    const s = settings.getSettings(guildId);
    if (!s) continue;

    const onlineChannelId = s.status_online_channel_id;
    const playerChannelId = s.status_player_channel_id;
    if (!onlineChannelId && !playerChannelId) continue;

    const guildCfg = guilds.getConfig(guildId);
    if (!guildCfg) continue;

    const api = new MinecraftApi(guildCfg);
    const status = await api.getOnlinePlayers();

    let onlineCount = 0;
    let maxPlayers = 0;
    if (status.ok) {
      onlineCount = status.online_count ?? status.online_players?.length ?? 0;
      maxPlayers = status.max_players ?? status.max ?? 0;
    }

    if (onlineChannelId) {
      const channel = guild.channels.cache.get(onlineChannelId);
      if (channel) {
        const name = `🟢 Online: ${onlineCount}`.slice(0, 100);
        if (channel.name !== name) {
          channel.setName(name).catch(() => {});
        }
      }
    }

    if (playerChannelId) {
      const channel = guild.channels.cache.get(playerChannelId);
      if (channel) {
        const name = `👥 Players: ${onlineCount}/${maxPlayers}`.slice(0, 100);
        if (channel.name !== name) {
          channel.setName(name).catch(() => {});
        }
      }
    }
  }
}

module.exports = { handleSet, handleRemove, handleStatus, updateStatusChannels };