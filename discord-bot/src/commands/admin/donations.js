const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/donations');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('donations')
    .setDescription('Manage donation records')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Record a donation')
        .addStringOption(opt =>
          opt.setName('username')
            .setDescription('Minecraft username')
            .setRequired(true))
        .addNumberOption(opt =>
          opt.setName('amount')
            .setDescription('Donation amount')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('recent')
        .setDescription('Show recent donations'))
    .addSubcommand(sub =>
      sub.setName('leaderboard')
        .setDescription('Show top donors')),

  async execute(interaction) {
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
    };

    const sub = interaction.options.getSubcommand();
    ctx.options.set('sub', sub);

    if (sub === 'set') {
      ctx.options.set('username', interaction.options.getString('username'));
      ctx.options.set('amount', interaction.options.getNumber('amount'));
    }

    await handler(ctx);
  }
};
