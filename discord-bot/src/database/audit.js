const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    add: db.prepare(`
      INSERT INTO audit_log (guild_id, action, actor_id, target, details)
      VALUES (@guild_id, @action, @actor_id, @target, @details)
    `),
    get: db.prepare('SELECT * FROM audit_log WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?'),
  };
  return stmts;
}

function logAction(guildId, action, actorId, target, details) {
  const s = ensureStmts();
  s.add.run({
    guild_id: guildId,
    action,
    actor_id: actorId,
    target: target || null,
    details: details || null,
  });
}

function getActions(guildId, limit) {
  const s = ensureStmts();
  return s.get.all(guildId, limit || 25);
}

module.exports = { logAction, getActions };
