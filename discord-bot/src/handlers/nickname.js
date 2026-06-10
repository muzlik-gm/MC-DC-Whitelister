const { EmbedBuilder } = require('discord.js');
const settings = require('../database/settings');
const whitelistDb = require('../database/whitelist');
const rolesDb = require('../database/roles');

function buildNickname(format, username, group, rank) {
  return format
    .replace(/{username}/g, username)
    .replace(/{group}/g, group || '')
    .replace(/{rank}/g, rank || '')
    .trim();
}

async function handleSync(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server is not linked to any Minecraft server.')]
    });
  }

  await ctx.deferReply();

  const s = settings.getSettings(ctx.guildId);
  if (!s || !s.nickname_format) {
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('No nickname format configured. Use `/nickname format <format>` first.')]
    });
  }

  const entries = whitelistDb.getAllForGuild(ctx.guildId);
  if (entries.length === 0) {
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('No linked members found.')]
    });
  }

  const guild = ctx.member.guild;
  let synced = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const member = guild.members.cache.get(entry.discord_id);
      if (!member) continue;

      const memberRoles = member.roles.cache.map(r => r.id);
      const mapping = rolesDb.getGroupForRoles(ctx.guildId, memberRoles);
      const nickname = buildNickname(s.nickname_format, entry.minecraft_username, mapping || '', '');

      if (member.nickname !== nickname) {
        await member.setNickname(nickname);
      }
      synced++;
    } catch {
      errors++;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Nickname Sync Complete')
    .setDescription(`Synced **${synced}** member(s). Errors: **${errors}**`);

  return ctx.editReply({ embeds: [embed] });
}

async function handleFormat(ctx) {
  const format = ctx.options.get('format');
  if (!format) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify a format template (e.g. `[{group}] {username}`, `{username}`).')]
    });
  }

  const supported = ['{username}', '{group}', '{rank}'];
  const used = supported.filter(t => format.includes(t));
  if (used.length === 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Format must include at least one placeholder: `{username}`, `{group}`, `{rank}`.')]
    });
  }

  settings.setNicknameFormat(ctx.guildId, format);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Nickname Format Set')
    .setDescription(`Format: \`${format}\``);

  return ctx.reply({ embeds: [embed] });
}

async function handleStatus(ctx) {
  const s = settings.getSettings(ctx.guildId);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Nickname Configuration')
    .addFields(
      { name: 'Format', value: s?.nickname_format ? `\`${s.nickname_format}\`` : 'Not set (default: `{username}`)', inline: false },
      { name: 'Placeholders', value: '`{username}` — Minecraft username\n`{group}` — MC group from role mapping\n`{rank}` — Rank (not yet implemented)', inline: false }
    );

  return ctx.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { handleSync, handleFormat, handleStatus, buildNickname };