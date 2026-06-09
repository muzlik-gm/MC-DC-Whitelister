const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    insert: db.prepare(`
      INSERT INTO events (guild_id, name, description, mc_command, reward_role_id, max_participants, starts_at, created_by)
      VALUES (@guild_id, @name, @description, @mc_command, @reward_role_id, @max_participants, @starts_at, @created_by)
    `),
    getById: db.prepare('SELECT * FROM events WHERE id = ?'),
    getUpcoming: db.prepare(
      "SELECT * FROM events WHERE guild_id = ? AND starts_at > datetime('now') ORDER BY starts_at ASC"
    ),
    getPast: db.prepare(
      "SELECT * FROM events WHERE guild_id = ? AND starts_at <= datetime('now') ORDER BY starts_at DESC"
    ),
    delete: db.prepare('DELETE FROM events WHERE id = ? AND guild_id = ?'),
    rsvpInsert: db.prepare(
      'INSERT OR IGNORE INTO event_participants (event_id, discord_id, minecraft_username) VALUES (?, ?, ?)'
    ),
    rsvpDelete: db.prepare(
      'DELETE FROM event_participants WHERE event_id = ? AND discord_id = ?'
    ),
    markAttended: db.prepare(
      'UPDATE event_participants SET attended = 1 WHERE event_id = ? AND discord_id = ?'
    ),
    getParticipants: db.prepare(
      'SELECT * FROM event_participants WHERE event_id = ?'
    ),
    participantCount: db.prepare(
      'SELECT COUNT(*) AS count FROM event_participants WHERE event_id = ?'
    ),
  };
  return stmts;
}

function createEvent(guildId, name, description, mcCommand, rewardRoleId, maxParticipants, startsAt, createdBy) {
  const s = ensureStmts();
  const result = s.insert.run({
    guild_id: guildId,
    name,
    description: description || null,
    mc_command: mcCommand || null,
    reward_role_id: rewardRoleId || null,
    max_participants: maxParticipants || null,
    starts_at: startsAt,
    created_by: createdBy,
  });
  return { ok: true, id: result.lastInsertRowid };
}

function getEvent(eventId) {
  const s = ensureStmts();
  return s.getById.get(eventId) || null;
}

function getEvents(guildId, upcoming) {
  const s = ensureStmts();
  if (upcoming) {
    return s.getUpcoming.all(guildId);
  }
  return s.getPast.all(guildId);
}

function rsvpEvent(eventId, discordId, minecraftUsername) {
  const s = ensureStmts();
  const event = s.getById.get(eventId);
  if (!event) return { ok: false, error: 'Event not found.' };

  if (event.max_participants) {
    const count = s.participantCount.get(eventId);
    if (count.count >= event.max_participants) {
      return { ok: false, error: 'Event is full.' };
    }
  }

  const result = s.rsvpInsert.run(eventId, discordId, minecraftUsername || null);
  if (result.changes === 0) {
    return { ok: false, error: 'You are already RSVPed for this event.' };
  }
  return { ok: true };
}

function unrsvpEvent(eventId, discordId) {
  const s = ensureStmts();
  const result = s.rsvpDelete.run(eventId, discordId);
  if (result.changes === 0) {
    return { ok: false, error: 'You are not RSVPed for this event.' };
  }
  return { ok: true };
}

function markAttended(eventId, discordId) {
  const s = ensureStmts();
  s.markAttended.run(eventId, discordId);
  return { ok: true };
}

function getParticipants(eventId) {
  const s = ensureStmts();
  return s.getParticipants.all(eventId);
}

function deleteEvent(eventId, guildId) {
  const s = ensureStmts();
  const event = s.getById.get(eventId);
  if (!event) return { ok: false, error: 'Event not found.' };
  if (event.guild_id !== guildId) return { ok: false, error: 'Event not found in this server.' };

  s.delete.run(eventId, guildId);
  return { ok: true };
}

module.exports = { createEvent, getEvent, getEvents, rsvpEvent, unrsvpEvent, markAttended, getParticipants, deleteEvent };
