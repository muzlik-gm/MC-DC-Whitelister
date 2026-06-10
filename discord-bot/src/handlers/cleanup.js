const { EmbedBuilder } = require('discord.js');
const cleanupDb = require('../database/cleanup');
const whitelistDb = require('../database/whitelist');
const MinecraftApi = require('../services/MinecraftApi');

async function cleanupHandler(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server is not linked to any Minecraft server.')]
    });
  }

  const sub = ctx.options.get('sub') || ctx.options.get('action') || 'config';

  if (sub === 'config') return handleConfig(ctx);
  if (sub === 'dryrun') return handleDryRun(ctx);
  if (sub === 'run') return handleRun(ctx);

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Unknown subcommand.')]
  });
}

async function handleConfig(ctx) {
  const days = ctx.options.get('days');
  const enabled = ctx.options.get('enabled');

  const current = cleanupDb.getConfig(ctx.guildId) || { enabled: 0, inactive_days: 30, unverified_days: 7 };

  if (days !== null && days !== undefined) {
    current.inactive_days = Number(days);
  }
  if (enabled !== null && enabled !== undefined) {
    current.enabled = enabled;
  }

  cleanupDb.setConfig(ctx.guildId, current);

  const embed = new EmbedBuilder()
    .setColor(current.enabled ? 0x2ecc71 : 0x95a5a6)
    .setTitle('Cleanup Configuration')
    .addFields(
      { name: 'Enabled', value: current.enabled ? '✅' : '❌', inline: true },
      { name: 'Inactive Threshold', value: `${current.inactive_days} days`, inline: true },
      { name: 'Unverified Threshold', value: `${current.unverified_days} days`, inline: true }
    );

  return ctx.reply({ embeds: [embed] });
}

async function handleDryRun(ctx) {
  const config = cleanupDb.getConfig(ctx.guildId);
  if (!config || !config.enabled) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Cleanup is not enabled. Configure it first with `/cleanup config days:<number> enabled:true`.')]
    });
  }

  await ctx.deferReply();

  const inactive = cleanupDb.getInactiveEntries(ctx.guildId, config.inactive_days);
  const unverified = cleanupDb.getUnverifiedEntries(ctx.guildId, config.unverified_days);

  const total = new Set([...inactive, ...unverified].map(e => e.id)).size;

  if (total === 0) {
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription('No entries would be removed.')]
    });
  }

  const lines = [];
  const all = [...inactive, ...unverified];
  const seen = new Set();
  for (const e of all) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    lines.push(`<@${e.discord_id}> — **${e.minecraft_username}** _(linked <t:${Math.floor(new Date(e.linked_at).getTime() / 1000)}:R>)_`);
  }

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`Dry Run — ${total} entries to remove`)
    .setDescription(lines.join('\n'));

  return ctx.editReply({ embeds: [embed] });
}

async function handleRun(ctx) {
  const config = cleanupDb.getConfig(ctx.guildId);
  if (!config || !config.enabled) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Cleanup is not enabled. Configure it first.')]
    });
  }

  await ctx.deferReply();

  const entries = cleanupDb.getInactiveEntries(ctx.guildId, config.inactive_days);
  const api = new MinecraftApi(ctx.guildConfig);
  let removed = 0;
  let failed = 0;

  for (const entry of entries) {
    const result = await api.removeFromWhitelist(entry.minecraft_username);
    if (result.ok || (result.error && result.error.includes('not whitelisted'))) {
      whitelistDb.unlinkAccount(ctx.guildId, entry.discord_id);
      removed++;
    } else {
      failed++;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(removed > 0 ? 0x2ecc71 : 0x95a5a6)
    .setTitle('Cleanup Complete')
    .setDescription(`Removed **${removed}** inactive entr${removed !== 1 ? 'ies' : 'y'}.${failed > 0 ? `\n${failed} failed.` : ''}`);

  return ctx.editReply({ embeds: [embed] });
}

module.exports = cleanupHandler;
