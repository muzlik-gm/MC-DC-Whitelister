const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let _db = null;

function getDb() {
  if (_db) return _db;

  const DATA_DIR = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new Database(path.join(DATA_DIR, 'whitelist.db'));
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS guild_configs (
      guild_id         TEXT PRIMARY KEY,
      mc_host          TEXT NOT NULL DEFAULT '127.0.0.1',
      mc_port          INTEGER NOT NULL DEFAULT 25252,
      api_key          TEXT NOT NULL,
      whitelist_role_id TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS whitelist_entries (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id          TEXT NOT NULL,
      discord_id        TEXT NOT NULL,
      minecraft_username TEXT NOT NULL,
      discord_tag       TEXT NOT NULL,
      linked_at         TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(guild_id, discord_id),
      UNIQUE(guild_id, minecraft_username)
    )
  `);

  return _db;
}

module.exports = { getDb };
