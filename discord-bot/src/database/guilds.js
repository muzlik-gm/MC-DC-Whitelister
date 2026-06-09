const { getDb } = require('./index');
const logger = require('../utils/logger');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    upsert: db.prepare(`
      INSERT INTO guild_configs (guild_id, mc_host, mc_port, api_key, whitelist_role_id)
      VALUES (@guild_id, @mc_host, @mc_port, @api_key, @whitelist_role_id)
      ON CONFLICT(guild_id) DO UPDATE SET
        mc_host = excluded.mc_host,
        mc_port = excluded.mc_port,
        api_key = excluded.api_key,
        whitelist_role_id = excluded.whitelist_role_id,
        updated_at = datetime('now')
    `),
    get: db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?'),
    del: db.prepare('DELETE FROM guild_configs WHERE guild_id = ?'),
    all: db.prepare('SELECT * FROM guild_configs ORDER BY created_at DESC'),
  };
  return stmts;
}

function setConfig(guildId, { mc_host, mc_port, api_key, whitelist_role_id }) {
  const s = ensureStmts();
  s.upsert.run({ guild_id: guildId, mc_host, mc_port, api_key, whitelist_role_id: whitelist_role_id || null });
  return s.get.get(guildId);
}

function getConfig(guildId) {
  const s = ensureStmts();
  return s.get.get(guildId) || null;
}

function removeConfig(guildId) {
  const s = ensureStmts();
  s.del.run(guildId);
}

function clearConfig(guildId) {
  removeConfig(guildId);
  logger.warn('Guilds', `Config cleared for guild ${guildId} — API key was rejected by the MC plugin`);
}

function getAllConfigs() {
  const s = ensureStmts();
  return s.all.all();
}

module.exports = { setConfig, getConfig, removeConfig, clearConfig, getAllConfigs };
