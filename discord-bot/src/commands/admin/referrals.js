const { SlashCommandBuilder } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/referrals');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('referrals')
    .setDescription('Referral system commands')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub.setName('leaderboard')
        .setDescription('Show the top referrers'))
    .addSubcommand(sub =>
      sub.setName('count')
        .setDescription('Check your referral count')),

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
    ctx.options.set('sub', interaction.options.getSubcommand());
    await handler(ctx);
  }
};
