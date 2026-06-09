const whitelistDb = require('../database/whitelist');
const MinecraftApi = require('../services/MinecraftApi');
const { EmbedBuilder } = require('discord.js');

async function status(ctx) {
  const link = whitelistDb.getLink(ctx.guildId, ctx.userId);

  const embed = new EmbedBuilder().setColor(link ? 0x2ecc71 : 0x95a5a6);

  if (link) {
    embed.setTitle('✅ Linked Account')
      .setDescription(`**Minecraft:** \`${link.minecraft_username}\``)
      .addFields(
        { name: 'Linked', value: `<t:${Math.floor(new Date(link.linked_at).getTime() / 1000)}:R>`, inline: true },
        { name: 'Discord', value: `\`${link.discord_tag}\``, inline: true }
      );
  } else {
    embed.setTitle('❌ Not Linked')
      .setDescription('You don\'t have a Minecraft account linked in this server.\nUse `>whitelist <username>` or `/whitelist <username>` to link one.');
  }

  if (ctx.guildConfig) {
    const api = new MinecraftApi(ctx.guildConfig);

    // Fetch live server details
    let tps = null;
    let playerCount = null;
    let version = null;
    let uptime = null;
    let onlinePlayers = null;

    try {
      const detail = await api.getServerStatus();
      if (detail.ok) {
        tps = detail.tps;
        playerCount = detail.player_count;
        version = detail.version;
        uptime = detail.uptime;
        onlinePlayers = detail.online_players;
      }
    } catch {
      // fallback to just health check
    }

    const online = tps !== null || await api.healthCheck();
    const statusIcon = online ? '🟢' : '🔴';

    const serverVal = `\`${ctx.guildConfig.mc_host}:${ctx.guildConfig.mc_port}\``;
    const statusVal = `${statusIcon} ${online ? 'Online' : 'Offline / Unreachable'}`;

    embed.addFields(
      { name: 'Minecraft Server', value: serverVal, inline: true },
      { name: 'Status', value: statusVal, inline: true }
    );

    if (online && tps !== null) {
      const tpsVal = typeof tps === 'number' ? tps.toFixed(1) : tps;
      embed.addFields(
        { name: 'TPS', value: `\`${tpsVal}\``, inline: true },
        { name: 'Players', value: `\`${playerCount}\``, inline: true },
        { name: 'Version', value: `\`${version || 'N/A'}\``, inline: true },
      );
      if (uptime) {
        embed.addFields({ name: 'Uptime', value: `\`${uptime}\``, inline: true });
      }
      if (onlinePlayers && onlinePlayers.length > 0) {
        const list = onlinePlayers.slice(0, 10).join(', ');
        embed.addFields({ name: 'Online Now', value: list + (onlinePlayers.length > 10 ? ` (+${onlinePlayers.length - 10} more)` : ''), inline: false });
      }
    }
  }

  return ctx.reply({ embeds: [embed] });
}

module.exports = status;
