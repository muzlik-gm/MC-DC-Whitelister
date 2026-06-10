const { EmbedBuilder } = require('discord.js');
const donationsDb = require('../database/donations');

async function donationsHandler(ctx) {
  const sub = ctx.options.get('sub') || ctx.options.get('action');

  if (sub === 'set') return handleSet(ctx);
  if (sub === 'recent') return handleRecent(ctx);
  if (sub === 'leaderboard') return handleLeaderboard(ctx);

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Unknown subcommand.')]
  });
}

async function handleSet(ctx) {
  const username = ctx.options.get('username');
  const amount = Number(ctx.options.get('amount'));

  if (!username) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify a Minecraft username.')]
    });
  }

  if (isNaN(amount) || amount <= 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Amount must be a positive number.')]
    });
  }

  donationsDb.addDonation(ctx.guildId, null, username, amount, null);

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`Donation of **${amount}** recorded for **${username}**.`)]
  });
}

async function handleRecent(ctx) {
  const donations = donationsDb.getRecent(ctx.guildId, 10);

  if (donations.length === 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('No donations recorded yet.')]
    });
  }

  const lines = donations.map(d => {
    const ts = Math.floor(new Date(d.created_at).getTime() / 1000);
    const who = d.minecraft_username || 'Unknown';
    return `**${who}** — **${d.amount}** — <t:${ts}:R>`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Recent Donations')
    .setDescription(lines.join('\n'));

  return ctx.reply({ embeds: [embed] });
}

async function handleLeaderboard(ctx) {
  const top = donationsDb.getTopDonors(ctx.guildId, 10);

  if (top.length === 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('No donations recorded yet.')]
    });
  }

  const lines = top.map((d, i) => `**#${i + 1}** **${d.minecraft_username || 'Unknown'}** — ${d.total} total`);

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('Top Donors')
    .setDescription(lines.join('\n'));

  return ctx.reply({ embeds: [embed] });
}

module.exports = donationsHandler;
