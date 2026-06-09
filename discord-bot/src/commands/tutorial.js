const { SlashCommandBuilder } = require('discord.js');
const guilds = require('../database/guilds');
const handler = require('../handlers/tutorial');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tutorial')
    .setDescription('Show the full setup guide for WhitelistBot'),

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
