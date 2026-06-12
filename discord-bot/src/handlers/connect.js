const guilds = require('../database/guilds');
const { isValidHost, isValidPort, isPrivateIp } = require('../utils/validation');
const { EmbedBuilder } = require('discord.js');

const DEFAULT_PORT = 25252;
const FETCH_TIMEOUT = 10000;

async function connect(ctx) {
  const rawCode = ctx.options.get('code');
  const rawIp = ctx.options.get('ip');
  const port = Number(ctx.options.get('port')) || DEFAULT_PORT;

  if (!rawCode) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Missing pairing code. Usage: `>connect <CODE> ip:<server-ip>` or `/connect <CODE> <ip>`.')]
    });
  }
  if (!rawIp) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Missing server IP. Usage: `>connect <CODE> ip:<server-ip>` or `/connect <CODE> <ip>`.')]
    });
  }

  const code = String(rawCode).toUpperCase().trim();
  const ip = String(rawIp).trim();

  // Check if already connected
  const existing = guilds.getConfig(ctx.guildId);
  if (existing) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle('Already Connected').setDescription(`This server is already linked to \`${existing.mc_host}:${existing.mc_port}\`.\nUse \`>unlinkserver\` or \`/unlinkserver\` to disconnect first, then try connecting again.`)]
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

  if (code.length < 4 || code.length > 10) {
    return ctx.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid code format — must be 4–10 characters.')] });
  }

  await ctx.deferReply();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(`http://${ip}:${port}/api/pair/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': '' },
      body: JSON.stringify({ code }),
      signal: controller.signal
    });
    clearTimeout(timer);

    const data = await res.json();

    if (!data.success) {
      return ctx.editReply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(data.error || 'Pairing failed. Check the code is correct and not expired.')]
      });
    }

    guilds.setConfig(ctx.guildId, {
      mc_host: ip,
      mc_port: port,
      api_key: data.api_key,
      whitelist_role_id: null
    });

    const portDisplay = port !== DEFAULT_PORT ? `:${port}` : '';
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Server Connected')
      .setDescription(`This server is now linked to \`${ip}${portDisplay}\``)
      .addFields(
        { name: 'Users', value: 'Use `>whitelist <username>` or `/whitelist <username>` to join the whitelist.', inline: false },
        { name: 'Restrict', value: 'Use `>setup role:@role` or `/setup role:@role` to limit who can whitelist.', inline: false }
      );

    return ctx.editReply({ embeds: [embed] });
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'Connection timed out.' : 'Could not reach the plugin.';
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Connection Failed').setDescription(`${reason}\n• Is the server online?\n• Is the plugin installed and running?\n• Is the port correct? (Default: ${DEFAULT_PORT})`)]
    });
  }
}

module.exports = connect;
