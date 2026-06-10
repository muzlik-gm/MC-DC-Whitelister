const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../database/guilds');
const handler = require('../handlers/connect');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('connect')
    .setDescription('Connect this server to a Minecraft server using a pairing code')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('code')
        .setDescription('The pairing code from /wlb pair')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('ip')
        .setDescription('Your Minecraft server IP (shown alongside the code)')
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('port')
        .setDescription('Plugin port (default: 25252 — only needed if non-default)')
        .setRequired(false)),

  async execute(interaction) {
    const ctx = {
      reply: (data) => interaction.reply({ ...data, flags: 64 }),
      deferReply: () => interaction.deferReply({ flags: 64 }),
      editReply: (data) => interaction.editReply(data),
      options: new Map(interaction.options.data.map(o => [o.name, o.value])),
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      guildId: interaction.guildId,
      member: interaction.member,
      guildConfig: guilds.getConfig(interaction.guildId),
    };
    await handler(ctx);
  }
};
