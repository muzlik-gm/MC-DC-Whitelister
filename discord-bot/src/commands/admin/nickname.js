const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const { handleSync, handleFormat, handleStatus } = require('../../handlers/nickname');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('Manage Discord nickname synchronization with Minecraft usernames')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('sync')
        .setDescription('Sync all linked members\' nicknames to their MC username'))
    .addSubcommand(sub =>
      sub.setName('format')
        .setDescription('Set nickname format template')
        .addStringOption(opt =>
          opt.setName('format')
            .setDescription('Format template (e.g. [{group}] {username}, {username})')
            .setRequired(true)
            .setMaxLength(100)))
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Show current nickname configuration')),

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

    if (sub === 'sync') {
      await handleSync(ctx);
    } else if (sub === 'format') {
      ctx.options.set('format', interaction.options.getString('format'));
      await handleFormat(ctx);
    } else if (sub === 'status') {
      await handleStatus(ctx);
    }
  }
};