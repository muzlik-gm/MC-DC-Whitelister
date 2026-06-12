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
      log_milestones  INTEGER NOT NULL DEFAULT 1,
      status_channel_id TEXT,
      status_online_channel_id TEXT,
      status_player_channel_id TEXT,
      nickname_format TEXT NOT NULL DEFAULT '{username}'
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

  _db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      player_uuid TEXT NOT NULL,
      player_name TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      target TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS temp_whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      discord_id TEXT,
      minecraft_username TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      discord_id TEXT NOT NULL,
      minecraft_username TEXT NOT NULL,
      answers TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      review_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS application_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      question TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS reputation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      from_discord_id TEXT NOT NULL,
      to_discord_id TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(guild_id, from_discord_id, to_discord_id)
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS reputation_roles (
      guild_id TEXT NOT NULL,
      min_reputation INTEGER NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (guild_id, min_reputation)
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS cleanup_config (
      guild_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      inactive_days INTEGER NOT NULL DEFAULT 30,
      unverified_days INTEGER NOT NULL DEFAULT 7
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      discord_id TEXT,
      minecraft_username TEXT,
      amount REAL NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  _db.exec(`
    CREATE TABLE IF NOT EXISTS event_config (
      guild_id TEXT PRIMARY KEY,
      default_mc_command TEXT,
      default_reward_role_id TEXT,
      default_max_participants INTEGER,
      notification_channel_id TEXT,
      auto_announce INTEGER NOT NULL DEFAULT 1,
      event_role_id TEXT
    )
  `);

  // Migrate guild_settings — add columns that may not exist on older databases
  const migrateColumns = [
    'ALTER TABLE guild_settings ADD COLUMN log_milestones INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE guild_settings ADD COLUMN status_online_channel_id TEXT',
    'ALTER TABLE guild_settings ADD COLUMN status_player_channel_id TEXT',
    'ALTER TABLE guild_settings ADD COLUMN nickname_format TEXT NOT NULL DEFAULT \'{username}\'',
  ];
  for (const sql of migrateColumns) {
    try { _db.exec(sql); } catch (e) { /* column already exists */ }
  }

  return _db;
}

module.exports = { getDb };
