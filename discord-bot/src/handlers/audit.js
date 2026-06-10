const { EmbedBuilder } = require('discord.js');
const { getActions } = require('../database/audit');

async function auditHandler(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server is not linked to any Minecraft server. Pair one first with `/pair` or `>pair`.')]
    });
  }

  const limit = ctx.options.get('limit') || 25;
  const actions = getActions(ctx.guildId, limit);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Audit Log')
    .setDescription(actions.length === 0 ? 'No audit entries found.' : `Showing ${actions.length} recent action(s):`);

  if (actions.length > 0) {
    const lines = actions.map(a => {
      const target = a.target ? ` — ${a.target}` : '';
      const details = a.details ? ` (${a.details})` : '';
      return `\`${a.action}\`${target}${details}\n<@${a.actor_id}> — ${a.created_at}`;
    });
    embed.addFields({ name: 'Actions', value: lines.join('\n\n'), inline: false });
  }

  return ctx.reply({ embeds: [embed] });
}

module.exports = auditHandler;
