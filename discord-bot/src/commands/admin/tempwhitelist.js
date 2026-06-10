const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/tempwhitelist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempwhitelist')
    .setDescription('Manage temporary whitelist entries')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Temporarily whitelist a player')
        .addStringOption(opt =>
          opt.setName('username')
            .setDescription('The Minecraft username')
            .setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('duration')
            .setDescription('Duration in hours')
            .setRequired(true)
            .setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List active temporary whitelists'))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a temporary whitelist')
        .addStringOption(opt =>
          opt.setName('username')
            .setDescription('The Minecraft username')
            .setRequired(true))),

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
    ctx.options.set('action', sub);

    if (sub === 'add') {
      ctx.options.set('username', interaction.options.getString('username'));
      ctx.options.set('duration', interaction.options.getInteger('duration'));
    } else if (sub === 'remove') {
      ctx.options.set('username', interaction.options.getString('username'));
    }

    await handler(ctx);
  }
};
