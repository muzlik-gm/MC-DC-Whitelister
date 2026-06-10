const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/cleanup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cleanup')
    .setDescription('Auto-cleanup inactive whitelist entries')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('Configure cleanup settings')
        .addIntegerOption(opt =>
          opt.setName('days')
            .setDescription('Days of inactivity before removal')
            .setRequired(false))
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable or disable auto-cleanup')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('dryrun')
        .setDescription('Preview who would be removed'))
    .addSubcommand(sub =>
      sub.setName('run')
        .setDescription('Execute cleanup of inactive entries')),

  async execute(interaction) {
    const ctx = {
      reply: (data) => interaction.reply({ ...data, flags: 64 }),
      deferReply: (opts) => interaction.deferReply({ ...opts, flags: 64 }),
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

    if (sub === 'config') {
      const days = interaction.options.getInteger('days');
      const enabled = interaction.options.getBoolean('enabled');
      if (days !== null) ctx.options.set('days', days);
      if (enabled !== null) ctx.options.set('enabled', enabled);
    }

    await handler(ctx);
  }
};
