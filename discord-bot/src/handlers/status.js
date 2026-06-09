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
    const online = await api.healthCheck();
    const statusIcon = online ? '🟢' : '🔴';
    embed.addFields(
      { name: 'Minecraft Server', value: `\`${ctx.guildConfig.mc_host}:${ctx.guildConfig.mc_port}\``, inline: true },
      { name: 'Status', value: `${statusIcon} ${online ? 'Online' : 'Offline / Unreachable'}`, inline: true }
    );
  }

  return ctx.reply({ embeds: [embed] });
}

module.exports = status;
