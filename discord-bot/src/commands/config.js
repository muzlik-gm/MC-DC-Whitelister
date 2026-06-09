const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { handleCommand } = require('../handlers/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Open the configuration panel (Discord + MC synced GUI)')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    await handleCommand({
      guildId: interaction.guildId,
      reply: (opts) => interaction.reply(opts),
      deferReply: () => interaction.deferReply(),
      editReply: (opts) => interaction.editReply(opts),
      options: {
        get: () => null
      }
    });
  }
};
