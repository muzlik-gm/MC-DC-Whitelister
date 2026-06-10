const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/logging');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logging')
    .setDescription('Configure activity logging from your Minecraft server')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Set the channel for activity logs')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('The text channel to post logs in')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('types')
        .setDescription('Toggle which event types to log')
        .addBooleanOption(opt => opt.setName('join').setDescription('Log player joins'))
        .addBooleanOption(opt => opt.setName('leave').setDescription('Log player leaves'))
        .addBooleanOption(opt => opt.setName('death').setDescription('Log player deaths'))
        .addBooleanOption(opt => opt.setName('advancement').setDescription('Log advancements'))
        .addBooleanOption(opt => opt.setName('milestone').setDescription('Log playtime milestones')))
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Stop logging and remove the log channel'))
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Show current logging configuration')),

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

    if (sub === 'channel') {
      ctx.options.set('channel', interaction.options.getChannel('channel'));
    } else if (sub === 'types') {
      const join = interaction.options.getBoolean('join');
      const leave = interaction.options.getBoolean('leave');
      const death = interaction.options.getBoolean('death');
      const advancement = interaction.options.getBoolean('advancement');
      if (join !== null) ctx.options.set('join', join);
      if (leave !== null) ctx.options.set('leave', leave);
      if (death !== null) ctx.options.set('death', death);
      if (advancement !== null) ctx.options.set('advancement', advancement);
      const milestone = interaction.options.getBoolean('milestone');
      if (milestone !== null) ctx.options.set('milestone', milestone);
    }

    await handler(ctx);
  }
};
