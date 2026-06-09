const { EmbedBuilder } = require('discord.js');

async function help(ctx) {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🔐 WhitelistBot Commands')
    .setDescription('You can use either slash commands (`/`) or prefix commands (`>`) — they work identically.')
    .addFields(
      { name: '👤 Player Commands', value: '`>whitelist <username>` / `/whitelist` — Link your Minecraft account\n`>unlink` / `/unlink` — Remove your account\n`>status` / `/status` — Check your link status', inline: false },
      { name: '🛠️ Admin Commands', value: '`>setup <apikey> [host] [port] [role]` / `/setup` — Manual config\n`>pair [ip] [port]` / `/pair` — Generate pairing code\n`>connect <code> <ip> [port]` / `/connect` — Complete pairing\n`>unlinkserver` / `/unlinkserver` — Disconnect server', inline: false },
      { name: 'ℹ️ Info Commands', value: '`>tutorial` / `/tutorial` — Full setup guide\n`>help` / `/help` — This message\n`>about` / `/about` — Bot info', inline: false }
    );

  return ctx.reply({ embeds: [embed] });
}

module.exports = help;
