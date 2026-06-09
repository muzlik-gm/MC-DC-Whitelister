const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    add: db.prepare(`
      INSERT INTO warnings (guild_id, player_uuid, player_name, moderator_id, moderator_name, reason)
      VALUES (@guild_id, @player_uuid, @player_name, @moderator_id, @moderator_name, @reason)
    `),
    get: db.prepare('SELECT * FROM warnings WHERE guild_id = ? AND player_uuid = ? ORDER BY created_at DESC'),
    remove: db.prepare('DELETE FROM warnings WHERE id = ?'),
    clear: db.prepare('DELETE FROM warnings WHERE guild_id = ? AND player_uuid = ?'),
  };
  return stmts;
}

function addWarning(guildId, playerUuid, playerName, moderatorId, moderatorName, reason) {
  const s = ensureStmts();
  const info = s.add.run({
    guild_id: guildId,
    player_uuid: playerUuid,
    player_name: playerName,
    moderator_id: moderatorId,
    moderator_name: moderatorName,
    reason,
  });
  return { ok: true, id: info.lastInsertRowid };
}

function getWarnings(guildId, playerUuid) {
  const s = ensureStmts();
  return s.get.all(guildId, playerUuid);
}

function removeWarning(warningId) {
  const s = ensureStmts();
  const info = s.remove.run(warningId);
  return { ok: info.changes > 0 };
}

function clearWarnings(guildId, playerUuid) {
  const s = ensureStmts();
  const info = s.clear.run(guildId, playerUuid);
  return { ok: true, removed: info.changes };
}

module.exports = { addWarning, getWarnings, removeWarning, clearWarnings };
