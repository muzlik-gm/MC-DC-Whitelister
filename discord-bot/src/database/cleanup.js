const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    upsert: db.prepare(`
      INSERT INTO cleanup_config (guild_id, enabled, inactive_days, unverified_days)
      VALUES (@guild_id, @enabled, @inactive_days, @unverified_days)
      ON CONFLICT(guild_id) DO UPDATE SET
        enabled = excluded.enabled,
        inactive_days = excluded.inactive_days,
        unverified_days = excluded.unverified_days
    `),
    get: db.prepare('SELECT * FROM cleanup_config WHERE guild_id = ?'),
    getAll: db.prepare('SELECT * FROM cleanup_config WHERE enabled = 1'),
    getEntriesOlderThan: db.prepare(`
      SELECT * FROM whitelist_entries
      WHERE guild_id = ? AND linked_at < datetime('now', '-' || ? || ' days')
    `),
  };
  return stmts;
}

function getConfig(guildId) {
  const s = ensureStmts();
  return s.get.get(guildId) || null;
}

function setConfig(guildId, config) {
  const s = ensureStmts();
  s.upsert.run({
    guild_id: guildId,
    enabled: config.enabled ? 1 : 0,
    inactive_days: config.inactive_days ?? 30,
    unverified_days: config.unverified_days ?? 7,
  });
}

function getAllConfigs() {
  const s = ensureStmts();
  return s.getAll.all();
}

function getInactiveEntries(guildId, inactiveDays) {
  const s = ensureStmts();
  return s.getEntriesOlderThan.all(guildId, inactiveDays);
}

function getUnverifiedEntries(guildId, unverifiedDays) {
  const s = ensureStmts();
  return s.getEntriesOlderThan.all(guildId, unverifiedDays);
}

module.exports = { getConfig, setConfig, getAllConfigs, getInactiveEntries, getUnverifiedEntries };
