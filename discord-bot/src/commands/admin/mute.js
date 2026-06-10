const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/mute');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute or unmute a player on the Minecraft server')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('mute')
        .setDescription('Mute a player')
        .addStringOption(opt =>
          opt.setName('username')
            .setDescription('The Minecraft username')
            .setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('duration')
            .setDescription('Duration in minutes (e.g. 30, 1440)')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('Reason for the mute')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Unmute a player')
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
    ctx.options.set('username', interaction.options.getString('username'));

    if (sub === 'mute') {
      ctx.options.set('duration', interaction.options.getInteger('duration'));
      const reason = interaction.options.getString('reason');
      if (reason) ctx.options.set('reason', reason);
    }

    await handler(ctx);
  }
};
