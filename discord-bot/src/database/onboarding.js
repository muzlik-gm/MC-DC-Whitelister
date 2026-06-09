const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    upsert: db.prepare(`
      INSERT INTO onboarding_config (guild_id, welcome_channel_id, welcome_message, auto_role_id, tutorial_channel_id, enabled)
      VALUES (@guild_id, @welcome_channel_id, @welcome_message, @auto_role_id, @tutorial_channel_id, @enabled)
      ON CONFLICT(guild_id) DO UPDATE SET
        welcome_channel_id = excluded.welcome_channel_id,
        welcome_message = excluded.welcome_message,
        auto_role_id = excluded.auto_role_id,
        tutorial_channel_id = excluded.tutorial_channel_id,
        enabled = excluded.enabled
    `),
    get: db.prepare('SELECT * FROM onboarding_config WHERE guild_id = ?'),
    setEnabled: db.prepare('UPDATE onboarding_config SET enabled = ? WHERE guild_id = ?'),
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
    welcome_channel_id: config.welcome_channel_id || null,
    welcome_message: config.welcome_message || null,
    auto_role_id: config.auto_role_id || null,
    tutorial_channel_id: config.tutorial_channel_id || null,
    enabled: config.enabled != null ? (config.enabled ? 1 : 0) : 1,
  });
  return s.get.get(guildId);
}

function setEnabled(guildId, enabled) {
  const s = ensureStmts();
  const existing = s.get.get(guildId);
  if (!existing) {
    s.upsert.run({
      guild_id: guildId,
      welcome_channel_id: null,
      welcome_message: null,
      auto_role_id: null,
      tutorial_channel_id: null,
      enabled: enabled ? 1 : 0,
    });
    return;
  }
  s.setEnabled.run(enabled ? 1 : 0, guildId);
}

module.exports = { getConfig, setConfig, setEnabled };
