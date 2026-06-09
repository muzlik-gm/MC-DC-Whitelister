const { EmbedBuilder } = require('discord.js');

async function help(ctx) {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🔐 WhitelistBot Commands')
    .setDescription('You can use either slash commands (`/`) or prefix commands (`>`) — they work identically.')
    .addFields(
      { name: '👤 Player Commands', value: '`>whitelist <username>` / `/whitelist` — Link your Minecraft account\n`>unlink` / `/unlink` — Remove your account\n`>status` / `/status` — Check your link status', inline: false },
      { name: '🛠️ Admin Commands', value: '`/setup` — Manual config\n`/pair` — Generate pairing code\n`/connect` — Complete pairing\n`/unlinkserver` — Disconnect server\n`/config` — Configuration panel\n`/console <command>` — Run MC command remotely\n`/logging` — Activity log setup\n`/roles` — Manage role → group mappings\n`/ban <username>` — Ban a player\n`/kick <username>` — Kick a player\n`/warn <username>` — Warn a player\n`/warnings <username>` — View warnings\n`/delwarn <id>` — Remove a warning', inline: false },
      { name: 'ℹ️ Info Commands', value: '`>tutorial` / `/tutorial` — Full setup guide\n`>help` / `/help` — This message\n`>about` / `/about` — Bot info', inline: false }
    );

  return ctx.reply({ embeds: [embed] });
}

module.exports = help;
