const { EmbedBuilder } = require('discord.js');
const rolesDb = require('../database/roles');
const whitelistDb = require('../database/whitelist');
const MinecraftApi = require('../services/MinecraftApi');
const { logAction } = require('../database/audit');

async function rolesHandler(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server is not linked to any Minecraft server. Pair one first with `/pair` or `>pair`.')]
    });
  }

  const action = ctx.options.get('action');

  if (action === 'set') {
    return handleSet(ctx);
  } else if (action === 'remove') {
    return handleRemove(ctx);
  } else if (action === 'list') {
    return handleList(ctx);
  } else if (action === 'sync') {
    return handleSync(ctx);
  }

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Usage: `/roles set @role group:name`, `/roles remove @role`, `/roles list`, or `/roles sync`')]
  });
}

async function handleSet(ctx) {
  const role = ctx.options.get('role');
  const group = ctx.options.get('group');

  if (!role || !group) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify a role and a group name.')]
    });
  }

  rolesDb.setMapping(ctx.guildId, role.id, group);

  logAction(ctx.guildId, 'role_set', ctx.userId, role.name, `Group: ${group}`);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Role Mapping Set')
    .setDescription(`${role} → \`${group}\``);

  return ctx.reply({ embeds: [embed] });
}

async function handleRemove(ctx) {
  const role = ctx.options.get('role');

  if (!role) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Specify a role to unmap.')]
    });
  }

  rolesDb.removeMapping(ctx.guildId, role.id);

  logAction(ctx.guildId, 'role_remove', ctx.userId, role.name, null);

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('Role Mapping Removed')
    .setDescription(`${role} has been unmapped.`);

  return ctx.reply({ embeds: [embed] });
}

async function handleList(ctx) {
  const mappings = rolesDb.getMappings(ctx.guildId);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Role Mappings')
    .setDescription(mappings.length === 0 ? 'No role mappings configured.' : `Found ${mappings.length} mapping(s):`);

  if (mappings.length > 0) {
    const lines = mappings.map(m => `<@&${m.discord_role_id}> → \`${m.mc_group}\``);
    embed.addFields({ name: 'Mappings', value: lines.join('\n'), inline: false });
  }

  return ctx.reply({ embeds: [embed] });
}

async function handleSync(ctx) {
  await ctx.deferReply();

  const entries = whitelistDb.getAllForGuild(ctx.guildId);
  if (entries.length === 0) {
    return ctx.editReply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('No linked members found.')]
    });
  }

  const api = new MinecraftApi(ctx.guildConfig);
  let synced = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const member = ctx.member.guild.members.cache.get(entry.discord_id);
      if (!member) continue;

      const memberRoles = member.roles.cache.map(r => r.id);
      const group = rolesDb.getGroupForRoles(ctx.guildId, memberRoles);
      if (!group) continue;

      const res = await api.syncRoles(entry.discord_id, entry.minecraft_username, group);
      if (res.ok) {
        synced++;
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }

  logAction(ctx.guildId, 'role_sync', ctx.userId, null, `Synced: ${synced}, Errors: ${errors}`);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Role Sync Complete')
    .setDescription(`Synced **${synced}** member(s). Errors: **${errors}**`);

  return ctx.editReply({ embeds: [embed] });
}

module.exports = rolesHandler;
