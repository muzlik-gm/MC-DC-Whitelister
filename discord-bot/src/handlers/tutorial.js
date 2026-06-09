const { EmbedBuilder } = require('discord.js');

async function tutorial(ctx) {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('📖 WhitelistBot Setup Guide')
    .setDescription('Follow these steps to connect your Minecraft server to Discord.')
    .addFields(
      {
        name: '🔹 Method 1: MC → Discord (easiest)',
        value: [
          '1. Run **`/wlb pair`** in your Minecraft server',
          '2. Click the **yellow command** it gives you to copy it',
          '3. **Paste** it in this Discord channel — it starts with **`>`**',
          '4. The bot confirms the connection!',
          '',
          '> Make sure you paste the **`>`** command in Discord, not in Minecraft.'
        ].join('\n'),
        inline: false
      },
      {
        name: '🔹 Method 2: Discord → MC',
        value: [
          '1. Run **`>pair ip:your.server.ip`** in this Discord channel',
          '2. The bot gives you a code like **`<code>`**',
          '3. In Minecraft, run **`/wlb connect <code>`**',
          '4. The plugin gives you a **`>`** command to paste back in Discord',
          '5. **Paste** that command here to complete pairing',
          '',
          '> Replace **`<code>`** with the actual code you received.'
        ].join('\n'),
        inline: false
      },
      {
        name: '🔹 Method 3: Manual Setup',
        value: [
          '1. Open your MC server\'s `plugins/WhitelistBot/config.yml`',
          '2. Find the **`api-key`** (change it from the default!)',
          '3. Run **`>setup apikey:<your-key>`** in this Discord channel',
          '4. Add optional args: `host:127.0.0.1` `port:25252` `role:@whitelist`',
          '',
          '> Only use this method if pairing doesn\'t work (e.g., different network).'
        ].join('\n'),
        inline: false
      },
      {
        name: '👤 For Players',
        value: [
          '• **`>whitelist <username>`** or **`/whitelist <username>`** — Link your MC account',
          '• **`>unlink`** or **`/unlink`** — Remove your account from the whitelist',
          '• **`>status`** or **`/status`** — Check which account you have linked',
          '',
          '> One account per person. To switch accounts, **`>unlink`** or **`/unlink`** first.'
        ].join('\n'),
        inline: false
      },
      {
        name: '🛠️ For Admins',
        value: [
          '• **`>setup`** / **`/setup`** — Manual server config with API key',
          '• **`>pair`** / **`/pair`** — Generate a pairing code for the plugin',
          '• **`>connect`** / **`/connect`** — Complete pairing from Discord side',
          '• **`>unlinkserver`** / **`/unlinkserver`** — Disconnect the server (clears all whitelists)',
          '',
          '> Restrict whitelisting by adding a role: **`>setup apikey:<key> role:@Members`**'
        ].join('\n'),
        inline: false
      },
      {
        name: '💡 Tip: Prefix `>` vs Slash `/`',
        value: [
          'Both work the same way. Use whichever is faster:',
          '• **`>`** — Type the command directly in chat (no waiting for slash sync)',
          '• **`/`** — Type `/` and select from Discord\'s autocomplete',
          '',
          '> Commands with **`>`** are instant. Slash commands may take up to 1 hour to appear.'
        ].join('\n'),
        inline: false
      }
    );

  return ctx.reply({ embeds: [embed] });
}

module.exports = tutorial;
