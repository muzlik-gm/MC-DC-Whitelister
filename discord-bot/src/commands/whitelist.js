const { SlashCommandBuilder } = require('discord.js');
const guilds = require('../database/guilds');
const handler = require('../handlers/whitelist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Link your Discord to a Minecraft username and join the whitelist')
    .addStringOption(opt =>
      opt.setName('username')
        .setDescription('Your Minecraft username (3-16 chars)')
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(16))
    .addStringOption(opt =>
      opt.setName('ref')
        .setDescription('Discord ID or Minecraft username of who referred you')
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
