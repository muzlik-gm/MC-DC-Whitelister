const { EmbedBuilder } = require('discord.js');
const eventsDb = require('../database/events');

async function eventsHandler(ctx) {
  if (!ctx.guildConfig) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('This server is not linked to any Minecraft server.')]
    });
  }

  const sub = ctx.options.get('sub') || 'list';

  if (sub === 'create') return handleCreate(ctx);
  if (sub === 'list') return handleList(ctx);
  if (sub === 'rsvp') return handleRsvp(ctx);
  if (sub === 'cancel') return handleCancel(ctx);
  if (sub === 'delete') return handleDelete(ctx);

  return ctx.reply({
    embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription('Unknown subcommand.')]
  });
}

async function handleCreate(ctx) {
  const name = ctx.options.get('name');
  const description = ctx.options.get('description') || null;
  const mcCommand = ctx.options.get('mc_command') || null;
  const rewardRole = ctx.options.get('reward_role') || null;
  const maxParticipants = ctx.options.get('max_participants') || null;
  const startsAt = ctx.options.get('starts_at');

  const parsed = new Date(startsAt);
  if (isNaN(parsed.getTime())) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Invalid date/time format. Use a valid date string (e.g. "2025-12-31 20:00 UTC").')]
    });
  }

  if (parsed.getTime() <= Date.now()) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Event must start in the future.')]
    });
  }

  const result = eventsDb.createEvent(
    ctx.guildId, name, description, mcCommand,
    rewardRole, maxParticipants, parsed.toISOString(), ctx.userId
  );

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Event Created')
    .setDescription(`**${name}** (ID: \`${result.id}\`)`)
    .addFields(
      { name: 'Starts', value: `<t:${Math.floor(parsed.getTime() / 1000)}:F>`, inline: true }
    );

  if (description) embed.addFields({ name: 'Description', value: description, inline: false });
  if (maxParticipants) embed.addFields({ name: 'Max Participants', value: String(maxParticipants), inline: true });

  return ctx.reply({ embeds: [embed] });
}

async function handleList(ctx) {
  const events = eventsDb.getEvents(ctx.guildId, true);

  if (events.length === 0) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('No upcoming events.')]
    });
  }

  const lines = events.map(e => {
    const ts = Math.floor(new Date(e.starts_at).getTime() / 1000);
    return `**\`${e.id}\`** — ${e.name} — <t:${ts}:R>`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Upcoming Events')
    .setDescription(lines.join('\n'));

  return ctx.reply({ embeds: [embed] });
}

async function handleRsvp(ctx) {
  const eventId = ctx.options.get('event_id');
  const minecraftUsername = ctx.options.get('minecraft_username') || null;

  const event = eventsDb.getEvent(eventId);
  if (!event) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`Event \`${eventId}\` not found.`)]
    });
  }

  if (event.guild_id !== ctx.guildId) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('Event not found in this server.')]
    });
  }

  const result = eventsDb.rsvpEvent(eventId, ctx.userId, minecraftUsername);
  if (!result.ok) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription(result.error)]
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('RSVP Confirmed')
    .setDescription(`You have RSVPed for **${event.name}**.`);

  return ctx.reply({ embeds: [embed] });
}

async function handleCancel(ctx) {
  const eventId = ctx.options.get('event_id');

  const result = eventsDb.unrsvpEvent(eventId, ctx.userId);
  if (!result.ok) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription(result.error)]
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('RSVP Cancelled')
    .setDescription('Your RSVP has been cancelled.');

  return ctx.reply({ embeds: [embed] });
}

async function handleDelete(ctx) {
  const eventId = ctx.options.get('event_id');

  const result = eventsDb.deleteEvent(eventId, ctx.guildId);
  if (!result.ok) {
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(result.error)]
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('Event Deleted')
    .setDescription(`Event \`${eventId}\` has been deleted.`);

  return ctx.reply({ embeds: [embed] });
}

module.exports = eventsHandler;
