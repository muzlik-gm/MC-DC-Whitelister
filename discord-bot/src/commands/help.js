const { SlashCommandBuilder } = require('discord.js');
const guilds = require('../database/guilds');
const handler = require('../handlers/help');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands')
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('Command category to view')
        .setRequired(false)
        .addChoices(
          { name: 'Player Commands', value: 'player' },
          { name: 'Server Setup', value: 'setup' },
          { name: 'Management', value: 'management' },
          { name: 'Moderation', value: 'moderation' },
          { name: 'Community', value: 'community' },
          { name: 'Information', value: 'info' },
        )),

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
    ctx.options.set('category', interaction.options.getString('category'));
    await handler(ctx);
  }
};
