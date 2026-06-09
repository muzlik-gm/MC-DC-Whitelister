const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/roles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Manage Discord role to LuckPerms group mappings')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Map a Discord role to a LuckPerms group')
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('The Discord role to map')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('group')
            .setDescription('The LuckPerms group name')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a role mapping')
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('The Discord role to unmap')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Show all role mappings'))
    .addSubcommand(sub =>
      sub.setName('sync')
        .setDescription('Manually sync roles for all linked members')),

  async execute(interaction) {
    const ctx = {
      reply: (data) => interaction.reply({ ...data, ephemeral: true }),
      deferReply: () => interaction.deferReply({ ephemeral: true }),
      editReply: (data) => interaction.editReply(data),
      options: new Map(),
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      guildId: interaction.guildId,
      member: interaction.member,
      guildConfig: guilds.getConfig(interaction.guildId),
    };

    const sub = interaction.options.getSubcommand();
    ctx.options.set('action', sub);

    if (sub === 'set') {
      ctx.options.set('role', interaction.options.getRole('role'));
      ctx.options.set('group', interaction.options.getString('group'));
    } else if (sub === 'remove') {
      ctx.options.set('role', interaction.options.getRole('role'));
    }

    await handler(ctx);
  }
};
