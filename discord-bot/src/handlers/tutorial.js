const { EmbedBuilder } = require('discord.js');

async function tutorial(ctx) {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('WhitelistBot Setup Guide')
    .setDescription('Follow these steps to connect your Minecraft server to Discord.')
    .addFields(
      {
        name: 'Method 1: MC to Discord (easiest)',
        value: [
          '1. Run **`/wlb pair`** in your Minecraft server',
          '2. Click the **yellow command** it gives you to copy it',
          '3. **Paste** it in this Discord channel — it starts with **`>`**',
          '4. The bot confirms the connection!'
        ].join('\n'),
        inline: false
      },
      {
        name: 'Method 2: Discord to MC',
        value: [
          '1. Run **`>pair ip:your.server.ip`** in this Discord channel',
          '2. The bot gives you a code',
          '3. In Minecraft, run **`/wlb connect <code>`**',
          '4. Paste the result back in Discord to complete pairing'
        ].join('\n'),
        inline: false
      },
      {
        name: 'Method 3: Manual Setup',
        value: [
          '1. Open your MC server\'s `plugins/WhitelistBot/config.yml`',
          '2. Find the **`api-key`** (change it from the default!)',
          '3. Run **`>setup apikey:<your-key> host:<ip> port:<port> role:@role`**',
          '',
          'Only use this if pairing doesn\'t work.'
        ].join('\n'),
        inline: false
      },
      {
        name: 'Player Commands',
        value: [
          '• **`>whitelist <username>`** / **`/whitelist`** — Link your MC account',
          '• **`>unlink`** / **`/unlink`** — Remove your linked account',
          '• **`>status`** / **`/status`** — Check link status and server info',
          '• **`>help`** / **`/help`** — View all commands with interactive buttons'
        ].join('\n'),
        inline: false
      },
      {
        name: 'Admin Commands',
        value: [
          'Type **`>help`** or **`/help`** to see all admin commands.',
          'Categories: **Server Setup**, **Management**, **Moderation**, **Community**, **Info**, **Player**'
        ].join('\n'),
        inline: false
      },
      {
        name: 'Important Notes',
        value: [
          '• One account per server — unlink before switching',
          '• Commands work as both **`>`** prefix and **`/`** slash',
          '• Slash commands may take up to 1 hour to sync'
        ].join('\n'),
        inline: false
      }
    );

  return ctx.reply({ embeds: [embed] });
}

module.exports = tutorial;
