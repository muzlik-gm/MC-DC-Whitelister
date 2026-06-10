const { EmbedBuilder } = require('discord.js');
const repDb = require('../database/reputation');

async function reputationHandler(ctx) {
  const sub = ctx.options.get('sub') || ctx.options.get('action') || 'check';

  if (sub === 'give') return handleGive(ctx);
  if (sub === 'check') return handleCheck(ctx);
  if (sub === 'leaderboard') return handleLeaderboard(ctx);
  if (sub === 'roles') return handleRoles(ctx);
  if (sub === 'add' || sub === 'remove' || sub === 'list') {
    if (sub === 'list') return handleListRoles(ctx);
    return handleRoles(ctx);
  }

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Unknown subcommand.')]
  });
}

async function handleGive(ctx) {
  const target = ctx.options.get('user');
  const reason = ctx.options.get('reason') || null;

  if (!target) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify a user to give reputation to.')]
    });
  }

  const targetId = typeof target === 'string' ? target : target.id;
  if (targetId === ctx.userId) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('You cannot give reputation to yourself.')]
    });
  }

  if (repDb.hasGiven(ctx.guildId, ctx.userId, targetId)) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('You have already given reputation to this user.')]
    });
  }

  const result = repDb.giveRep(ctx.guildId, ctx.userId, targetId, reason);
  if (!result.ok) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Could not give reputation.')]
    });
  }

  const count = repDb.getRep(ctx.guildId, targetId);

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`<@${targetId}> now has **${count}** reputation point${count !== 1 ? 's' : ''}.${reason ? `\nReason: ${reason}` : ''}`)]
  });
}

async function handleCheck(ctx) {
  const target = ctx.options.get('user');
  const targetId = target ? (typeof target === 'string' ? target : target.id) : ctx.userId;
  const count = repDb.getRep(ctx.guildId, targetId);

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0x3498db).setDescription(`<@${targetId}> has **${count}** reputation point${count !== 1 ? 's' : ''}.`)]
  });
}

async function handleLeaderboard(ctx) {
  const entries = repDb.getLeaderboard(ctx.guildId, 10);

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('Reputation Leaderboard')
    .setDescription(entries.length === 0 ? 'No reputation points given yet.' : `Top ${entries.length} users:`);

  if (entries.length > 0) {
    const lines = entries.map((e, i) => `**#${i + 1}** <@${e.to_discord_id}> — ${e.count} rep${e.count !== 1 ? 's' : ''}`);
    embed.addFields({ name: 'Rankings', value: lines.join('\n'), inline: false });
  }

  return ctx.reply({ embeds: [embed] });
}

async function handleRoles(ctx) {
  const action = ctx.options.get('action') || ctx.options.get('sub');
  if (!action || action === 'list') return handleListRoles(ctx);

  if (action === 'add') {
    const minRep = Number(ctx.options.get('min_rep'));
    const role = ctx.options.get('role');

    if (isNaN(minRep) || minRep < 1) {
      return ctx.reply({
        embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Min reputation must be a positive number.')]
      });
    }

    const roleId = typeof role === 'string' ? role : role.id;
    repDb.setRepRole(ctx.guildId, minRep, roleId);

    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`Role <@&${roleId}> will be auto-assigned at **${minRep}** rep.`)]
    });
  }

  if (action === 'remove') {
    const minRep = Number(ctx.options.get('min_rep'));
    if (isNaN(minRep)) {
      return ctx.reply({
        embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify the min reputation threshold to remove.')]
      });
    }

    repDb.removeRepRole(ctx.guildId, minRep);
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`Reputation role threshold **${minRep}** removed.`)]
    });
  }

  return handleListRoles(ctx);
}

async function handleListRoles(ctx) {
  const roles = repDb.getRepRoles(ctx.guildId);

  if (roles.length === 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('No reputation role thresholds configured.')]
    });
  }

  const lines = roles.map(r => `**${r.min_reputation}** rep → <@&${r.role_id}>`);
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Reputation Role Thresholds')
    .setDescription(lines.join('\n'));

  return ctx.reply({ embeds: [embed] });
}

module.exports = reputationHandler;
