const { getDb } = require('./index');

let stmts = null;

function ensure() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    upsert: db.prepare(`
      INSERT INTO event_config (guild_id, default_mc_command, default_reward_role_id, default_max_participants, notification_channel_id, auto_announce, event_role_id)
      VALUES (@guild_id, @default_mc_command, @default_reward_role_id, @default_max_participants, @notification_channel_id, @auto_announce, @event_role_id)
      ON CONFLICT(guild_id) DO UPDATE SET
        default_mc_command = excluded.default_mc_command,
        default_reward_role_id = excluded.default_reward_role_id,
        default_max_participants = excluded.default_max_participants,
        notification_channel_id = excluded.notification_channel_id,
        auto_announce = excluded.auto_announce,
        event_role_id = excluded.event_role_id
    `),
    get: db.prepare('SELECT * FROM event_config WHERE guild_id = ?'),
    del: db.prepare('DELETE FROM event_config WHERE guild_id = ?'),
  };
  return stmts;
}

function getConfig(guildId) {
  return ensure().get.get(guildId) || null;
}

function setConfig(guildId, data) {
  const existing = getConfig(guildId) || {};
  ensure().upsert.run({
    guild_id: guildId,
    default_mc_command: data.default_mc_command !== undefined ? data.default_mc_command : (existing.default_mc_command || null),
    default_reward_role_id: data.default_reward_role_id !== undefined ? data.default_reward_role_id : (existing.default_reward_role_id || null),
    default_max_participants: data.default_max_participants !== undefined ? data.default_max_participants : (existing.default_max_participants || null),
    notification_channel_id: data.notification_channel_id !== undefined ? data.notification_channel_id : (existing.notification_channel_id || null),
    auto_announce: data.auto_announce !== undefined ? (data.auto_announce ? 1 : 0) : (existing.auto_announce ?? 1),
    event_role_id: data.event_role_id !== undefined ? data.event_role_id : (existing.event_role_id || null),
  });
  return getConfig(guildId);
}

function removeConfig(guildId) {
  ensure().del.run(guildId);
}

module.exports = { getConfig, setConfig, removeConfig };
