const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/unlinkserver');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlinkserver')
    .setDescription('Disconnect this Discord server from its Minecraft server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

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
    await handler(ctx);
  }
};
