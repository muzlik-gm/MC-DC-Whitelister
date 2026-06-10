const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/applications');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('applications')
    .setDescription('Manage whitelist applications')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub.setName('apply')
        .setDescription('Submit a whitelist application')
        .addStringOption(opt =>
          opt.setName('username')
            .setDescription('Your Minecraft username')
            .setRequired(true)
            .setMaxLength(16)))
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('View application setup guide'))
    .addSubcommand(sub =>
      sub.setName('pending')
        .setDescription('List pending applications'))
    .addSubcommand(sub =>
      sub.setName('approve')
        .setDescription('Approve a pending application')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('Application ID')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('note')
            .setDescription('Optional note')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('reject')
        .setDescription('Reject a pending application')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('Application ID')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('note')
            .setDescription('Rejection reason')
            .setRequired(true)))
    .addSubcommandGroup(group =>
      group.setName('questions')
        .setDescription('Manage application questions')
        .addSubcommand(sub =>
          sub.setName('list')
            .setDescription('List current questions'))
        .addSubcommand(sub =>
          sub.setName('add')
            .setDescription('Add a question')
            .addStringOption(opt =>
              opt.setName('question')
                .setDescription('The question to ask applicants')
                .setRequired(true)
                .setMaxLength(500)))
        .addSubcommand(sub =>
          sub.setName('remove')
            .setDescription('Remove a question')
            .addIntegerOption(opt =>
              opt.setName('id')
                .setDescription('Question ID')
                .setRequired(true)))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup();

    const ctx = {
      reply: (data) => interaction.reply({ ...data, ephemeral: true }),
      deferReply: (opts) => interaction.deferReply({ ...opts, ephemeral: true }),
      editReply: (data) => interaction.editReply(data),
      options: new Map(),
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      guildId: interaction.guildId,
      member: interaction.member,
      guildConfig: guilds.getConfig(interaction.guildId),
      channel: interaction.channel,
    };

    if (group === 'questions') {
      ctx.options.set('sub', sub);
      ctx.options.set('group', 'questions');
      if (sub === 'add') {
        ctx.options.set('question', interaction.options.getString('question'));
      } else if (sub === 'remove') {
        ctx.options.set('id', interaction.options.getInteger('id'));
      }
    } else {
      ctx.options.set('sub', sub);
      if (sub === 'apply') {
        ctx.options.set('username', interaction.options.getString('username'));
      } else if (sub === 'approve' || sub === 'reject') {
        ctx.options.set('id', interaction.options.getInteger('id'));
        ctx.options.set('note', interaction.options.getString('note'));
      }
    }

    const adminSubs = ['setup', 'pending', 'approve', 'reject'];
    if (adminSubs.includes(sub) || group === 'questions') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          embeds: [new (require('discord.js').EmbedBuilder)().setColor(0xe74c3c).setDescription('You need Administrator permission.')],
          ephemeral: true
        });
      }
    }

    await handler(ctx);
  }
};
