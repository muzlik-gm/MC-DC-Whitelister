const {
  EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const eventsDb = require('../database/events');
const eventConfig = require('../database/eventConfig');

const states = new Map();
const TTL = 12 * 60 * 1000;

function key(guildId, userId) { return `${guildId}:${userId}`; }

function getState(k) {
  const s = states.get(k);
  if (!s || Date.now() - s.ts > TTL) { states.delete(k); return null; }
  return s;
}

function setState(k, patch) {
  const cur = states.get(k);
  states.set(k, { ...cur, ...patch, ts: cur?.ts || Date.now() });
}

function daysFrom(n) {
  const d = new Date(); d.setDate(d.getDate() + n); return d;
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function tsFromState(s) {
  if (!s.date || !s.time) return null;
  const dt = new Date(`${s.date}T${s.time}:00`);
  return isNaN(dt.getTime()) ? null : Math.floor(dt.getTime() / 1000);
}

function progressBar(current, total) {
  const filled = '\u2588'.repeat(current);
  const empty = '\u2591'.repeat(total - current);
  return `${filled}${empty} ${current}/${total}`;
}

// ── Date options ──
function dateOptions() {
  const labels = ['Today', 'Tomorrow', 'In 2 Days', 'In 3 Days', 'In 4 Days', 'In 5 Days', 'In 6 Days'];
  const opts = labels.map((l, i) => {
    const d = daysFrom(i);
    return { label: l, description: fmtDate(d), value: `d:${d.toISOString().split('T')[0]}` };
  });
  [7, 14].forEach(n => {
    const d = daysFrom(n);
    opts.push({ label: n === 7 ? 'Next Week' : 'In 2 Weeks', description: fmtDate(d), value: `d:${d.toISOString().split('T')[0]}` });
  });
  opts.push({ label: 'Custom Date', description: 'Type a date (YYYY-MM-DD)', value: 'd:custom' });
  return opts;
}

function timeOptions() {
  const pairs = [
    ['12:00 PM', '12:00', 'Noon'], ['1:00 PM', '13:00', 'Early afternoon'], ['2:00 PM', '14:00', 'Afternoon'],
    ['3:00 PM', '15:00', 'Mid-afternoon'], ['4:00 PM', '16:00', 'Late afternoon'], ['5:00 PM', '17:00', 'Early evening'],
    ['6:00 PM', '18:00', 'Evening'], ['7:00 PM', '19:00', 'Prime time'], ['8:00 PM', '20:00', 'Night'],
    ['9:00 PM', '21:00', 'Late night'], ['10:00 PM', '22:00', 'Late night'],
  ];
  return pairs.map(([l, v, desc]) => ({ label: l, description: desc, value: `t:${v}` }))
    .concat({ label: 'Custom Time', description: 'Type a time (HH:MM, 24h)', value: 't:custom' });
}

function roleOptions(guild) {
  const roles = guild.roles.cache
    .filter(r => r.id !== guild.id && !r.managed)
    .sort((a, b) => b.position - a.position)
    .first(25);
  return roles.length > 0
    ? roles.map(r => ({ label: r.name, value: `role:${r.id}`, emoji: { name: '\u{1F466}' } }))
    : [{ label: 'No roles available', value: 'role:none' }];
}

// ── Build helpers ──
function nameEmbed() {
  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('Create Event')
    .setDescription(`${progressBar(1, 4)} **What's the event called?**\nClick the button below to enter the name and description.`);
}

function dateEmbed(s) {
  const ts = tsFromState(s);
  const desc = ts
    ? `**${s.name}**\n\nSelected: <t:${ts}:F> (<t:${ts}:R>)`
    : `**${s.name}**\n\nPick a date and time below.`;

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('Create Event')
    .setDescription(`${progressBar(2, 4)}\n${desc}`);
}

function settingsEmbed(s, config) {
  const lines = [];
  if (s.mcCommand) lines.push(`**MC Command:** \`${s.mcCommand}\``);
  if (s.maxParticipants) lines.push(`**Max Participants:** ${s.maxParticipants}`);
  if (s.rewardRole) lines.push(`**Reward Role:** <@&${s.rewardRole}>`);

  if (lines.length === 0) {
    lines.push('No additional settings configured. All optional.');
  }

  const defaults = [];
  if (!s.mcCommand && config?.default_mc_command) defaults.push(`MC Command: \`${config.default_mc_command}\``);
  if (!s.maxParticipants && config?.default_max_participants) defaults.push(`Max: ${config.default_max_participants}`);
  if (!s.rewardRole && config?.default_reward_role_id) defaults.push(`Role: <@&${config.default_reward_role_id}>`);

  if (defaults.length > 0) {
    lines.push('', '**Guild Defaults (will be used):**');
    defaults.forEach(l => lines.push(l));
  }

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('Create Event')
    .setDescription(`${progressBar(3, 4)}\n**${s.name}**\n\n${lines.join('\n')}`);
}

function reviewEmbed(s) {
  const ts = tsFromState(s);
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Review Event')
    .setDescription(`${progressBar(4, 4)}\nReview and confirm your event.`);

  embed.addFields({ name: 'Event', value: `**${s.name}**`, inline: false });

  if (s.description) embed.addFields({ name: 'Description', value: s.description, inline: false });
  if (ts) embed.addFields({ name: 'Starts', value: `<t:${ts}:F>\n(<t:${ts}:R>)`, inline: false });
  if (s.mcCommand) embed.addFields({ name: 'MC Command', value: `\`${s.mcCommand}\``, inline: false });
  if (s.maxParticipants) embed.addFields({ name: 'Max Participants', value: String(s.maxParticipants), inline: true });
  if (s.rewardRole) embed.addFields({ name: 'Reward Role', value: `<@&${s.rewardRole}>`, inline: true });

  return embed;
}

// ── Component builders ──
function dateComponents(s) {
  const rows = [];

  const dm = new StringSelectMenuBuilder()
    .setCustomId('ew_date')
    .setPlaceholder(s.date ? `Date: ${s.date}` : 'Pick a date...')
    .addOptions(dateOptions());
  rows.push(new ActionRowBuilder().addComponents(dm));

  const tm = new StringSelectMenuBuilder()
    .setCustomId('ew_time')
    .setPlaceholder(s.time ? `Time: ${s.time}` : 'Pick a time...')
    .addOptions(timeOptions());
  rows.push(new ActionRowBuilder().addComponents(tm));

  const next = new ButtonBuilder().setCustomId('ew_next_dt').setLabel('Continue').setStyle(ButtonStyle.Primary)
    .setDisabled(!(s.date && s.time));
  const back = new ButtonBuilder().setCustomId('ew_back_dt').setLabel('Back').setStyle(ButtonStyle.Secondary);

  rows.push(new ActionRowBuilder().addComponents(back, next));
  return rows;
}

function settingsComponents(s, guild) {
  const rows = [];

  const mcBtn = new ButtonBuilder().setCustomId('ew_set_mc').setLabel('MC Command').setStyle(ButtonStyle.Secondary);
  if (s.mcCommand) mcBtn.setLabel(`MC: ${s.mcCommand.length > 20 ? s.mcCommand.slice(0, 20) + '...' : s.mcCommand}`);

  const maxBtn = new ButtonBuilder().setCustomId('ew_set_max').setLabel('Max Participants').setStyle(ButtonStyle.Secondary);
  if (s.maxParticipants) maxBtn.setLabel(`Max: ${s.maxParticipants}`);

  rows.push(new ActionRowBuilder().addComponents(mcBtn, maxBtn));

  const rm = new StringSelectMenuBuilder()
    .setCustomId('ew_set_role')
    .setPlaceholder(s.rewardRole ? `Reward: <@&${s.rewardRole}>` : 'Reward role (optional)...')
    .addOptions(roleOptions(guild));
  rows.push(new ActionRowBuilder().addComponents(rm));

  const back = new ButtonBuilder().setCustomId('ew_back_set').setLabel('Back').setStyle(ButtonStyle.Secondary);
  const next = new ButtonBuilder().setCustomId('ew_next_set').setLabel('Review').setStyle(ButtonStyle.Primary);
  rows.push(new ActionRowBuilder().addComponents(back, next));

  return rows;
}

function reviewComponents() {
  const back = new ButtonBuilder().setCustomId('ew_back_rev').setLabel('Back').setStyle(ButtonStyle.Secondary);
  const create = new ButtonBuilder().setCustomId('ew_create').setLabel('Create Event').setStyle(ButtonStyle.Success);
  return [new ActionRowBuilder().addComponents(back, create)];
}

// ── Wizard entry ──
async function startWizard(ctx) {
  const k = key(ctx.guildId, ctx.userId);
  const name = ctx.options.get('name');
  const description = ctx.options.get('description');
  const guild = ctx.member?.guild;
  const config = guild ? eventConfig.getConfig(ctx.guildId) : null;

  if (!name) {
    setState(k, { step: 'name' });

    const modal = new ModalBuilder().setCustomId('ew_modal_name').setTitle('Event Details');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ew_in_name').setLabel('Event Name')
          .setPlaceholder('e.g. Holiday Bash, Community Night')
          .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ew_in_desc').setLabel('Description (optional)')
          .setPlaceholder('What\u2019s happening at this event?')
          .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)
      )
    );
    return ctx.reply({ embeds: [nameEmbed({})], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ew_start').setLabel('Name Your Event').setStyle(ButtonStyle.Primary)
    )] });
  }

  setState(k, {
    name, description: description || (config?.default_mc_command ? null : null) || null,
    step: 'datetime', mcCommand: config?.default_mc_command || null,
    maxParticipants: config?.default_max_participants || null,
    rewardRole: config?.default_reward_role_id || null,
  });
  const s = getState(k);
  return ctx.reply({ embeds: [dateEmbed(s)], components: dateComponents(s) });
}

// ── Interaction handler ──
async function handleInteraction(interaction) {
  const k = key(interaction.guildId, interaction.user.id);
  const s = getState(k);

  // — Start / Name modal —
  if (interaction.customId === 'ew_start') {
    const modal = new ModalBuilder().setCustomId('ew_modal_name').setTitle('Event Details');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ew_in_name').setLabel('Event Name')
          .setPlaceholder('e.g. Holiday Bash').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ew_in_desc').setLabel('Description (optional)')
          .setPlaceholder('What\u2019s happening?').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)
      )
    );
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'ew_modal_name') {
    const name = interaction.fields.getTextInputValue('ew_in_name');
    const description = interaction.fields.getTextInputValue('ew_in_desc') || null;
    const config = eventConfig.getConfig(interaction.guildId);
    setState(k, {
      name, description, step: 'datetime',
      mcCommand: config?.default_mc_command || null,
      maxParticipants: config?.default_max_participants || null,
      rewardRole: config?.default_reward_role_id || null,
    });
    const ns = getState(k);
    return interaction.reply({ embeds: [dateEmbed(ns)], components: dateComponents(ns) });
  }

  if (!s) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Wizard expired. Run `/events create` again.')],
      flags: 64
    });
  }

  // — Cancel —
  if (interaction.customId === 'ew_cancel') {
    states.delete(k);
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('Cancelled.')], components: [] });
  }

  // — Date select —
  if (interaction.customId === 'ew_date') {
    const val = interaction.values[0];
    if (val === 'd:custom') {
      const modal = new ModalBuilder().setCustomId('ew_modal_date').setTitle('Custom Date');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ew_in_date').setLabel('Date (YYYY-MM-DD)')
          .setPlaceholder('2025-12-31').setStyle(TextInputStyle.Short).setRequired(true)
      ));
      return interaction.showModal(modal);
    }
    setState(k, { date: val.replace('d:', '') });
    const ns = getState(k);
    return interaction.update({ embeds: [dateEmbed(ns)], components: dateComponents(ns) });
  }

  // — Time select —
  if (interaction.customId === 'ew_time') {
    const val = interaction.values[0];
    if (val === 't:custom') {
      const modal = new ModalBuilder().setCustomId('ew_modal_time').setTitle('Custom Time');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ew_in_time').setLabel('Time (HH:MM, 24h)')
          .setPlaceholder('20:00').setStyle(TextInputStyle.Short).setRequired(true)
      ));
      return interaction.showModal(modal);
    }
    setState(k, { time: val.replace('t:', '') });
    const ns = getState(k);
    return interaction.update({ embeds: [dateEmbed(ns)], components: dateComponents(ns) });
  }

  // — Custom date modal —
  if (interaction.customId === 'ew_modal_date') {
    const raw = interaction.fields.getTextInputValue('ew_in_date').trim();
    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid date. Use YYYY-MM-DD (e.g. 2025-12-31).')], flags: 64 });
    }
    const date = parsed.toISOString().split('T')[0];
    setState(k, { date });
    const ns = getState(k);
    return interaction.reply({ embeds: [dateEmbed(ns)], components: dateComponents(ns) });
  }

  // — Custom time modal —
  if (interaction.customId === 'ew_modal_time') {
    const raw = interaction.fields.getTextInputValue('ew_in_time').trim();
    if (!/^\d{1,2}:\d{2}$/.test(raw)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid time. Use HH:MM in 24-hour format (e.g. 20:00).')], flags: 64 });
    }
    const [h, m] = raw.split(':');
    setState(k, { time: `${h.padStart(2, '0')}:${m.padStart(2, '0')}` });
    const ns = getState(k);
    return interaction.reply({ embeds: [dateEmbed(ns)], components: dateComponents(ns) });
  }

  // — Navigation: forward from date/time to settings —
  if (interaction.customId === 'ew_next_dt') {
    if (!s.date || !s.time) return interaction.deferUpdate();
    setState(k, { step: 'settings' });
    const ns = getState(k);
    return interaction.update({ embeds: [settingsEmbed(ns, eventConfig.getConfig(interaction.guildId))], components: settingsComponents(ns, interaction.guild) });
  }

  // — Navigation: back from settings to date/time —
  if (interaction.customId === 'ew_back_dt') {
    setState(k, { step: 'datetime' });
    const ns = getState(k);
    return interaction.update({ embeds: [dateEmbed(ns)], components: dateComponents(ns) });
  }

  // — MC Command button —
  if (interaction.customId === 'ew_set_mc') {
    const modal = new ModalBuilder().setCustomId('ew_modal_mc').setTitle('MC Command (Optional)');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('ew_in_mc').setLabel('MC Command').setPlaceholder('e.g. give %player% diamond 1')
        .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(500)
        .setValue(s.mcCommand || '')
    ));
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'ew_modal_mc') {
    const mcCommand = interaction.fields.getTextInputValue('ew_in_mc').trim() || null;
    setState(k, { mcCommand });
    const ns = getState(k);
    return interaction.reply({ embeds: [settingsEmbed(ns, eventConfig.getConfig(interaction.guildId))], components: settingsComponents(ns, interaction.guild) });
  }

  // — Max Participants button —
  if (interaction.customId === 'ew_set_max') {
    const modal = new ModalBuilder().setCustomId('ew_modal_max').setTitle('Max Participants (Optional)');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('ew_in_max').setLabel('Max Participants').setPlaceholder('Leave empty for unlimited')
        .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(4)
        .setValue(s.maxParticipants ? String(s.maxParticipants) : '')
    ));
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'ew_modal_max') {
    const raw = interaction.fields.getTextInputValue('ew_in_max').trim();
    const max = raw ? parseInt(raw, 10) : null;
    if (max !== null && (isNaN(max) || max < 1 || max > 1000)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Enter a number between 1\u20131000.')], flags: 64 });
    }
    setState(k, { maxParticipants: max });
    const ns = getState(k);
    return interaction.reply({ embeds: [settingsEmbed(ns, eventConfig.getConfig(interaction.guildId))], components: settingsComponents(ns, interaction.guild) });
  }

  // — Reward Role select —
  if (interaction.customId === 'ew_set_role') {
    const val = interaction.values[0];
    const roleId = val === 'role:none' ? null : val.replace('role:', '');
    setState(k, { rewardRole: roleId });
    const ns = getState(k);
    return interaction.update({ embeds: [settingsEmbed(ns, eventConfig.getConfig(interaction.guildId))], components: settingsComponents(ns, interaction.guild) });
  }

  // — Navigation: forward from settings to review —
  if (interaction.customId === 'ew_next_set') {
    setState(k, { step: 'review' });
    const ns = getState(k);
    return interaction.update({ embeds: [reviewEmbed(ns)], components: reviewComponents() });
  }

  // — Navigation: back from settings to date/time —
  if (interaction.customId === 'ew_back_set') {
    setState(k, { step: 'datetime' });
    const ns = getState(k);
    return interaction.update({ embeds: [dateEmbed(ns)], components: dateComponents(ns) });
  }

  // — Navigation: back from review to settings —
  if (interaction.customId === 'ew_back_rev') {
    setState(k, { step: 'settings' });
    const ns = getState(k);
    return interaction.update({ embeds: [settingsEmbed(ns, eventConfig.getConfig(interaction.guildId))], components: settingsComponents(ns, interaction.guild) });
  }

  // — Create event —
  if (interaction.customId === 'ew_create') {
    if (!s.name || !s.date || !s.time) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Missing required fields.')], flags: 64 });
    }

    const dateTime = new Date(`${s.date}T${s.time}:00`);
    if (isNaN(dateTime.getTime())) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid date/time.')], flags: 64 });
    }
    if (dateTime.getTime() <= Date.now()) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Event must start in the future.')], flags: 64 });
    }

    const result = eventsDb.createEvent(
      interaction.guildId, s.name, s.description || null,
      s.mcCommand || null, s.rewardRole || null,
      s.maxParticipants || null, dateTime.toISOString(), interaction.user.id
    );

    states.delete(k);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('Event Created')
      .setDescription(`**${s.name}** (ID: \`${result.id}\`)`)
      .addFields({ name: 'Starts', value: `<t:${Math.floor(dateTime.getTime() / 1000)}:F>\n(<t:${Math.floor(dateTime.getTime() / 1000)}:R>)`, inline: false });

    if (s.description) embed.addFields({ name: 'Description', value: s.description, inline: false });
    if (s.mcCommand) embed.addFields({ name: 'MC Command', value: `\`${s.mcCommand}\``, inline: false });
    if (s.maxParticipants) embed.addFields({ name: 'Max Participants', value: String(s.maxParticipants), inline: true });
    if (s.rewardRole) embed.addFields({ name: 'Reward Role', value: `<@&${s.rewardRole}>`, inline: true });

    return interaction.update({ embeds: [embed], components: [] });
  }
}

module.exports = { startWizard, handleInteraction };
