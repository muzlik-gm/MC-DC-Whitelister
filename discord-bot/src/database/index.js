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

  _db.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id        TEXT PRIMARY KEY,
      log_channel_id  TEXT,
      log_joins       INTEGER NOT NULL DEFAULT 1,
      log_leaves      INTEGER NOT NULL DEFAULT 1,
      log_deaths      INTEGER NOT NULL DEFAULT 0,
      log_advancements INTEGER NOT NULL DEFAULT 1,
      status_channel_id TEXT
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS role_mappings (
      guild_id TEXT NOT NULL,
      discord_role_id TEXT NOT NULL,
      mc_group TEXT NOT NULL,
      PRIMARY KEY (guild_id, discord_role_id)
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      player_uuid TEXT NOT NULL,
      player_name TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      moderator_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      referrer_discord_id TEXT NOT NULL,
      referee_discord_id TEXT NOT NULL,
      referee_minecraft TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(guild_id, referee_discord_id)
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      mc_command TEXT,
      reward_role_id TEXT,
      max_participants INTEGER,
      starts_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS event_participants (
      event_id INTEGER NOT NULL,
      discord_id TEXT NOT NULL,
      minecraft_username TEXT,
      attended INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (event_id, discord_id)
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS onboarding_config (
      guild_id TEXT PRIMARY KEY,
      welcome_channel_id TEXT,
      welcome_message TEXT,
      auto_role_id TEXT,
      tutorial_channel_id TEXT,
      enabled INTEGER NOT NULL DEFAULT 1
    )
  `);

  return _db;
}

module.exports = { getDb };
