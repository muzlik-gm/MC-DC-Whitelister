const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/pair');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pair')
    .setDescription('Pair this server with a Minecraft server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('ip')
        .setDescription('Your Minecraft server IP (bot sends a challenge code to it)')
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('port')
        .setDescription('Plugin port (default: 25252)')
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
