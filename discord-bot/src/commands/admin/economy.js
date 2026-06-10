const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Manage Minecraft server economy')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('balance')
        .setDescription('Check a player\'s balance')
        .addStringOption(opt =>
          opt.setName('username')
            .setDescription('Minecraft username')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('Give money to a player')
        .addStringOption(opt =>
          opt.setName('username')
            .setDescription('Minecraft username')
            .setRequired(true))
        .addNumberOption(opt =>
          opt.setName('amount')
            .setDescription('Amount to give')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('Reason for giving money')
            .setRequired(false))),

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

    if (sub === 'balance') {
      ctx.options.set('username', interaction.options.getString('username'));
    } else if (sub === 'give') {
      ctx.options.set('username', interaction.options.getString('username'));
      ctx.options.set('amount', interaction.options.getNumber('amount'));
      ctx.options.set('reason', interaction.options.getString('reason'));
    }

    await handler(ctx);
  }
};
