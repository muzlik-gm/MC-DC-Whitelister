const guilds = require('../database/guilds');
const { isValidHost, isValidPort, isPrivateIp } = require('../utils/validation');
const { EmbedBuilder } = require('discord.js');
const { randomInt } = require('crypto');
const tunnel = require('../services/tunnel');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const FETCH_TIMEOUT = 10000;

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARS[randomInt(CHARS.length)];
  }
  return code;
}

async function pair(ctx) {
  const ip = ctx.options.get('ip');
  const port = Number(ctx.options.get('port')) || 25252;

  const existing = guilds.getConfig(ctx.guildId);
  if (existing) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle('Already Connected').setDescription('This server is already linked to `' + existing.mc_host + ':' + existing.mc_port + '`.\nUse `>setup` or `/setup` to change settings or `>unlinkserver` or `/unlinkserver` to disconnect.')]
    });
  }

  if (!ip) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle('Server IP Required').setDescription('Provide your Minecraft server IP to send a pairing code to it.\n\n**Usage:** `>pair ip:<server-ip>`\n**Optional:** `>pair ip:<server-ip> port:25252`\n\nThe plugin must be running on the server.')]
    });
  }

  if (!isValidHost(ip)) {
    return ctx.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid hostname.')] });
  }
  if (isPrivateIp(ip)) {
    return ctx.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Cannot connect to private/internal IP addresses.')] });
  }
  if (!isValidPort(port)) {
    return ctx.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Port must be between 1 and 65535.')] });
  }

  await ctx.deferReply();

  const code = generateCode();

  // Try tunnel first, fall back to direct HTTP
  const t = tunnel.getTunnel();
  if (t && t.pluginConnection && t.authenticated) {
    try {
      const result = await t.request('/api/pair/challenge', 'POST', { code });

      if (result.ok) {
        const portDisplay = port !== 25252 ? ':' + port : '';
        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('Challenge Sent')
          .setDescription('A pairing code was sent via tunnel to `' + ip + portDisplay + '`.')
          .addFields(
            { name: 'Code', value: '```' + code + '```', inline: false },
            { name: 'Next Step', value: 'Run this in Minecraft:\n```/wlb connect ' + code + '```\nThen it will give you the `>` command to finish in Discord.', inline: false }
          );

        return ctx.editReply({ embeds: [embed] });
      }

      if (result.auth_failure) {
        return ctx.editReply({
          embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Connection lost — API key was rejected.')]
        });
      }
    } catch (err) {
      // Fall through to direct HTTP
    }
  }

  // Direct HTTP fallback
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch('http://' + ip + ':' + port + '/api/pair/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': '' },
      body: JSON.stringify({ code }),
      signal: controller.signal
    });
    clearTimeout(timer);

    const data = await res.json();

    if (!data.success) {
      return ctx.editReply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(data.error || 'Server rejected the challenge code.')]
      });
    }

    const portDisplay = port !== 25252 ? ':' + port : '';
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('Challenge Sent')
      .setDescription('A pairing code was sent to `' + ip + portDisplay + '`.')
      .addFields(
        { name: 'Code', value: '```' + code + '```', inline: false },
        { name: 'Next Step', value: 'Run this in Minecraft:\n```/wlb connect ' + code + '```\nThen it will give you the `>` command to finish in Discord.', inline: false }
      );

    return ctx.editReply({ embeds: [embed] });
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'Connection timed out.' : 'Could not reach the plugin.';
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Connection Failed').setDescription(reason + ' at `' + ip + ':' + port + '`.\nMake sure the plugin is loaded and the server is running.\n\nIf using Pterodactyl, use `>pair ip:<server-ip> port:25252` with the Minecraft server IP and the plugin API port.')]
    });
  }
}

module.exports = pair;
