const { EmbedBuilder } = require('discord.js');
const referralsDb = require('../database/referrals');

async function referralsHandler(ctx) {
  const sub = ctx.options.get('sub') || 'leaderboard';

  if (sub === 'leaderboard') {
    return handleLeaderboard(ctx);
  }
  if (sub === 'count') {
    return handleCount(ctx);
  }

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Unknown subcommand.')]
  });
}

async function handleLeaderboard(ctx) {
  const entries = referralsDb.getLeaderboard(ctx.guildId, 10);

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('Referral Leaderboard')
    .setDescription(entries.length === 0 ? 'No referrals yet.' : `Top ${entries.length} referrers:`);

  if (entries.length > 0) {
    const lines = entries.map((e, i) => `**#${i + 1}** <@${e.referrer_discord_id}> — ${e.count} referral${e.count !== 1 ? 's' : ''}`);
    embed.addFields({ name: 'Rankings', value: lines.join('\n'), inline: false });
  }

  return ctx.reply({ embeds: [embed] });
}

async function handleCount(ctx) {
  const count = referralsDb.getReferralCount(ctx.guildId, ctx.userId);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Your Referrals')
    .setDescription(`You have referred **${count}** player${count !== 1 ? 's' : ''}.`);

  return ctx.reply({ embeds: [embed] });
}

module.exports = referralsHandler;
