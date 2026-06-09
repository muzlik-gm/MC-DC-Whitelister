const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guilds = require('../../database/guilds');
const handler = require('../../handlers/console');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('console')
    .setDescription('Run a Minecraft server command remotely')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('command')
        .setDescription('The command to run (e.g. "say Hello" or "list")')
        .setRequired(true)
        .setMaxLength(200)),

  async execute(interaction) {
    const ctx = {
      reply: (data) => interaction.reply({ ...data, ephemeral: true }),
      deferReply: () => interaction.deferReply({ ephemeral: true }),
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
