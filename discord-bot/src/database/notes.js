const { getDb } = require('./index');

let stmts = null;

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    add: db.prepare(`
      INSERT INTO notes (guild_id, player_uuid, player_name, author_id, author_name, content)
      VALUES (@guild_id, @player_uuid, @player_name, @author_id, @author_name, @content)
    `),
    get: db.prepare('SELECT * FROM notes WHERE guild_id = ? AND player_uuid = ? ORDER BY created_at DESC'),
    remove: db.prepare('DELETE FROM notes WHERE id = ?'),
  };
  return stmts;
}

function addNote(guildId, playerUuid, playerName, authorId, authorName, content) {
  const s = ensureStmts();
  const info = s.add.run({
    guild_id: guildId,
    player_uuid: playerUuid,
    player_name: playerName,
    author_id: authorId,
    author_name: authorName,
    content,
  });
  return { ok: true, id: info.lastInsertRowid };
}

function getNotes(guildId, playerUuid) {
  const s = ensureStmts();
  return s.get.all(guildId, playerUuid);
}

function removeNote(noteId) {
  const s = ensureStmts();
  const info = s.remove.run(noteId);
  return { ok: info.changes > 0 };
}

module.exports = { addNote, getNotes, removeNote };
