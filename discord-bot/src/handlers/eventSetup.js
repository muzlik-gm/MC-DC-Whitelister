const {
  EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const eventConfig = require('../database/eventConfig');

async function showPanel(interaction) {
  const config = eventConfig.getConfig(interaction.guildId);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Event Settings')
    .setDescription('Configure default settings for events. These are pre-filled when creating events.');

  const lines = [
    config?.default_mc_command ? `**MC Command:** \`${config.default_mc_command}\`` : '**MC Command:** *Not set*',
    config?.default_reward_role_id ? `**Reward Role:** <@&${config.default_reward_role_id}>` : '**Reward Role:** *Not set*',
    config?.default_max_participants ? `**Max Participants:** ${config.default_max_participants}` : '**Max Participants:** *Not set*',
    config?.notification_channel_id ? `**Notification Channel:** <#${config.notification_channel_id}>` : '**Notification Channel:** *Not set*',
    `**Auto-Announce:** ${config?.auto_announce ? 'Enabled' : 'Disabled'}`,
  ];
  embed.addFields({ name: '\u200b', value: lines.join('\n'), inline: false });

  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('es_mc').setLabel('MC Command').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('es_role').setLabel('Reward Role').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('es_max').setLabel('Max Participants').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('es_notify').setLabel('Notify Channel').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('es_announce').setLabel(config?.auto_announce ? 'Disable Auto' : 'Enable Auto').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('es_clear').setLabel('Reset All').setStyle(ButtonStyle.Danger),
    ),
  ];

  return interaction.reply({ embeds: [embed], components: rows, flags: 64 });
}

async function handleInteraction(interaction) {
  const cid = interaction.customId;

  if (cid === 'es_mc') {
    const config = eventConfig.getConfig(interaction.guildId);
    const modal = new ModalBuilder().setCustomId('es_modal_mc').setTitle('Default MC Command');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('es_in_mc').setLabel('MC Command (use %player%)')
        .setPlaceholder('e.g. give %player% diamond 1')
        .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(500)
        .setValue(config?.default_mc_command || '')
    ));
    return interaction.showModal(modal);
  }

  if (cid === 'es_modal_mc') {
    const val = interaction.fields.getTextInputValue('es_in_mc').trim() || null;
    eventConfig.setConfig(interaction.guildId, { default_mc_command: val });
    return showPanel(interaction);
  }

  if (cid === 'es_role') {
    const roles = interaction.guild.roles.cache
      .filter(r => r.id !== interaction.guild.id && !r.managed)
      .sort((a, b) => b.position - a.position)
      .first(25);

    if (roles.length === 0) {
      return interaction.update({ embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('No roles available.')], flags: 64 });
    }

    const config = eventConfig.getConfig(interaction.guildId);
    const menu = new StringSelectMenuBuilder()
      .setCustomId('es_select_role')
      .setPlaceholder('Select a reward role...')
      .addOptions(roles.map(r => ({ label: r.name, value: r.id })));

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('Select Reward Role')
      .setDescription(`Current: ${config?.default_reward_role_id ? `<@&${config.default_reward_role_id}>` : 'None'}`);

    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (cid === 'es_select_role') {
    const roleId = interaction.values[0];
    eventConfig.setConfig(interaction.guildId, { default_reward_role_id: roleId });
    return showPanel(interaction);
  }

  if (cid === 'es_max') {
    const config = eventConfig.getConfig(interaction.guildId);
    const modal = new ModalBuilder().setCustomId('es_modal_max').setTitle('Max Participants');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('es_in_max').setLabel('Default max participants (leave empty for unlimited)')
        .setPlaceholder('50').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(4)
        .setValue(config?.default_max_participants ? String(config.default_max_participants) : '')
    ));
    return interaction.showModal(modal);
  }

  if (cid === 'es_modal_max') {
    const raw = interaction.fields.getTextInputValue('es_in_max').trim();
    const val = raw ? parseInt(raw, 10) : null;
    if (val !== null && (isNaN(val) || val < 1 || val > 1000)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Enter a number between 1\u20131000.')], flags: 64 });
    }
    eventConfig.setConfig(interaction.guildId, { default_max_participants: val });
    return showPanel(interaction);
  }

  if (cid === 'es_notify') {
    const channels = interaction.guild.channels.cache
      .filter(c => c.type === 0)
      .first(25);
    if (channels.length === 0) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('No text channels available.')], flags: 64 });
    }

    const config = eventConfig.getConfig(interaction.guildId);
    const menu = new StringSelectMenuBuilder()
      .setCustomId('es_select_channel')
      .setPlaceholder('Select notification channel...')
      .addOptions(channels.map(c => ({ label: `#${c.name}`, value: c.id })));

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('Select Notification Channel')
      .setDescription(`Current: ${config?.notification_channel_id ? `<#${config.notification_channel_id}>` : 'None'}`);

    return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (cid === 'es_select_channel') {
    eventConfig.setConfig(interaction.guildId, { notification_channel_id: interaction.values[0] });
    return showPanel(interaction);
  }

  if (cid === 'es_announce') {
    const config = eventConfig.getConfig(interaction.guildId);
    eventConfig.setConfig(interaction.guildId, { auto_announce: !(config?.auto_announce ?? 1) });
    return showPanel(interaction);
  }

  if (cid === 'es_clear') {
    eventConfig.removeConfig(interaction.guildId);
    return showPanel(interaction);
  }
}

module.exports = { showPanel, handleInteraction };
