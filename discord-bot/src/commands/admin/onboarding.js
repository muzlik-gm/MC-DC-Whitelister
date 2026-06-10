const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/onboarding');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('onboarding')
    .setDescription('Configure automatic welcome messages for new members')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Set the welcome channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('The channel for welcome messages')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('message')
        .setDescription('Set the welcome message')
        .addStringOption(opt =>
          opt.setName('text')
            .setDescription('Welcome text (use {user} and {server})')
            .setRequired(true)
            .setMaxLength(1000)))
    .addSubcommand(sub =>
      sub.setName('role')
        .setDescription('Set the auto-role for new members')
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('Role to assign automatically')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Enable onboarding'))
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable onboarding'))
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Show current onboarding configuration')),

  async execute(interaction) {
    const ctx = {
      reply: (data) => interaction.reply({ ...data, flags: 64 }),
      deferReply: () => interaction.deferReply({ flags: 64 }),
      editReply: (data) => interaction.editReply(data),
      options: new Map(),
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      guildId: interaction.guildId,
      member: interaction.member,
      guildConfig: guilds.getConfig(interaction.guildId),
    };
    const sub = interaction.options.getSubcommand();
    ctx.options.set('sub', sub);

    if (sub === 'channel') {
      ctx.options.set('channel', interaction.options.getChannel('channel'));
    } else if (sub === 'message') {
      ctx.options.set('text', interaction.options.getString('text'));
    } else if (sub === 'role') {
      ctx.options.set('role', interaction.options.getRole('role'));
    }

    await handler(ctx);
  }
};
