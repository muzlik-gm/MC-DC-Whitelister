const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/notes');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('notes')
    .setDescription('Manage private staff notes for players')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a note to a player')
        .addStringOption(opt =>
          opt.setName('username')
            .setDescription('The Minecraft username')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('content')
            .setDescription('Note content')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List notes for a player')
        .addStringOption(opt =>
          opt.setName('username')
            .setDescription('The Minecraft username')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a note by ID')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('The note ID')
            .setRequired(true))),

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

    if (sub === 'add') {
      ctx.options.set('username', interaction.options.getString('username'));
      ctx.options.set('content', interaction.options.getString('content'));
    } else if (sub === 'list') {
      ctx.options.set('username', interaction.options.getString('username'));
    } else if (sub === 'remove') {
      ctx.options.set('id', interaction.options.getInteger('id'));
    }

    await handler(ctx);
  }
};
