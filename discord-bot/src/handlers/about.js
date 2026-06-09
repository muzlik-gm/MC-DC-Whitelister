const { EmbedBuilder, version: djsVersion } = require('discord.js');

async function about(ctx) {
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('🔐 WhitelistBot')
    .setDescription('A Discord bot that lets players whitelist themselves on your Minecraft server.')
    .addFields(
      { name: 'Author', value: 'muzlik', inline: true },
      { name: 'Version', value: '1.0.0', inline: true },
      { name: 'Library', value: `Discord.js v${djsVersion}`, inline: true },
      { name: 'How it works', value: '1️⃣ Install the plugin on your MC server → 2️⃣ Pair via `>pair` or `/wlb pair` → 3️⃣ Players use `>whitelist` or `/whitelist` to join', inline: false },
      { name: 'Need help?', value: 'Use `>tutorial` or `/tutorial` for a full guide, or `>help` / `/help` to see all commands.', inline: false }
    );

  return ctx.reply({ embeds: [embed] });
}

module.exports = about;
