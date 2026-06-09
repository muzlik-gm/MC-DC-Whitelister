const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    upsert: db.prepare(`
      INSERT INTO guild_settings (guild_id, log_channel_id, log_joins, log_leaves, log_deaths, log_advancements, status_channel_id)
      VALUES (@guild_id, @log_channel_id, @log_joins, @log_leaves, @log_deaths, @log_advancements, @status_channel_id)
      ON CONFLICT(guild_id) DO UPDATE SET
        log_channel_id = excluded.log_channel_id,
        log_joins = excluded.log_joins,
        log_leaves = excluded.log_leaves,
        log_deaths = excluded.log_deaths,
        log_advancements = excluded.log_advancements,
        status_channel_id = excluded.status_channel_id
    `),
    get: db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?'),
    del: db.prepare('DELETE FROM guild_settings WHERE guild_id = ?'),
  };
  return stmts;
}

function getSettings(guildId) {
  const s = ensureStmts();
  return s.get.get(guildId) || null;
}

function setLogChannel(guildId, channelId) {
  const existing = getSettings(guildId) || {};
  const s = ensureStmts();
  s.upsert.run({
    guild_id: guildId,
    log_channel_id: channelId || null,
    log_joins: existing.log_joins ?? 1,
    log_leaves: existing.log_leaves ?? 1,
    log_deaths: existing.log_deaths ?? 0,
    log_advancements: existing.log_advancements ?? 1,
    status_channel_id: existing.status_channel_id || null,
  });
}

function setLogTypes(guildId, types) {
  const existing = getSettings(guildId) || {};
  const s = ensureStmts();
  s.upsert.run({
    guild_id: guildId,
    log_channel_id: existing.log_channel_id || null,
    log_joins: types.join ?? 1,
    log_leaves: types.leave ?? 1,
    log_deaths: types.death ?? 0,
    log_advancements: types.advancement ?? 1,
    status_channel_id: existing.status_channel_id || null,
  });
}

function setStatusChannel(guildId, channelId) {
  const existing = getSettings(guildId) || {};
  const s = ensureStmts();
  s.upsert.run({
    guild_id: guildId,
    log_channel_id: existing.log_channel_id || null,
    log_joins: existing.log_joins ?? 1,
    log_leaves: existing.log_leaves ?? 1,
    log_deaths: existing.log_deaths ?? 0,
    log_advancements: existing.log_advancements ?? 1,
    status_channel_id: channelId || null,
  });
}

function removeSettings(guildId) {
  const s = ensureStmts();
  s.del.run(guildId);
}

module.exports = { getSettings, setLogChannel, setLogTypes, setStatusChannel, removeSettings };
