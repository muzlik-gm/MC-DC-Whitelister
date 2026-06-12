const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/events');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('events')
    .setDescription('Manage community events')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new event')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Event name (leave empty to enter in the wizard)')
            .setRequired(false)
            .setMaxLength(100))
        .addStringOption(opt =>
          opt.setName('starts_at')
            .setDescription('When the event starts (e.g. "2025-12-31 20:00 UTC"). Leave empty for the visual wizard.')
            .setRequired(false))
        .addStringOption(opt =>
          opt.setName('description')
            .setDescription('Event description')
            .setRequired(false)
            .setMaxLength(1000))
        .addStringOption(opt =>
          opt.setName('mc_command')
            .setDescription('Command to run on MC server when event starts (use %player%)')
            .setRequired(false)
            .setMaxLength(500))
        .addRoleOption(opt =>
          opt.setName('reward_role')
            .setDescription('Role to award to participants')
            .setRequired(false))
        .addIntegerOption(opt =>
          opt.setName('max_participants')
            .setDescription('Maximum number of participants')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(1000)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List upcoming events'))
    .addSubcommand(sub =>
      sub.setName('rsvp')
        .setDescription('RSVP for an event')
        .addIntegerOption(opt =>
          opt.setName('event_id')
            .setDescription('Event ID')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('minecraft_username')
            .setDescription('Your Minecraft username (if required)')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('Cancel your RSVP for an event')
        .addIntegerOption(opt =>
          opt.setName('event_id')
            .setDescription('Event ID')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete an event')
        .addIntegerOption(opt =>
          opt.setName('event_id')
            .setDescription('Event ID')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Configure event defaults (MC command, roles, etc.)')),

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

    if (sub === 'create') {
      ctx.options.set('name', interaction.options.getString('name'));
      ctx.options.set('description', interaction.options.getString('description'));
      ctx.options.set('mc_command', interaction.options.getString('mc_command'));
      ctx.options.set('reward_role', interaction.options.getRole('reward_role')?.id);
      ctx.options.set('max_participants', interaction.options.getInteger('max_participants'));
      ctx.options.set('starts_at', interaction.options.getString('starts_at'));
    } else if (sub === 'rsvp') {
      ctx.options.set('event_id', interaction.options.getInteger('event_id'));
      ctx.options.set('minecraft_username', interaction.options.getString('minecraft_username'));
    } else if (sub === 'cancel' || sub === 'delete') {
      ctx.options.set('event_id', interaction.options.getInteger('event_id'));
    } else if (sub === 'setup') {
      const { showPanel } = require('../../handlers/eventSetup');
      return showPanel(interaction);
    }

    await handler(ctx);
  }
};
