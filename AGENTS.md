# MC-DC-Whitelister — AI Agent Guide

This file is the primary entry point for AI coding agents. Read this first before making any changes.

## Project Identity

- **Name:** MC-DC-Whitelister
- **Purpose:** A Discord ↔ Minecraft community bridge that replaces whitelist management, role sync, moderation, and community tools with a single bot + plugin pair
- **Value proposition:** One install replaces 5-15 separate plugins/bots. Players self-whitelist. Staff moderate both platforms from Discord. Everything syncs automatically.
- **License:** MIT
- **Repository:** `https://github.com/muzlik-gm/MC-DC-Whitelister`

## System Components

### Discord Bot (Node.js)

| Attribute | Value |
|-----------|-------|
| Language | JavaScript (Node.js 18+) |
| Framework | discord.js v14 |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Location | `discord-bot/` |
| Entry | `discord-bot/src/index.js` |
| Config cascade | env vars → `.env` → `config.json` → `config.example.json` |

Responsibilities:

- Register and handle 47 Discord slash commands
- Handle prefix commands (`>` prefix, e.g. `>whitelist`)
- Manage SQLite database (18 tables: guild configs, whitelist links, moderation, roles, events, reputation, etc.)
- Communicate with the Minecraft plugin via HTTP or WebSocket tunnel
- Run periodic background cleanup (temp whitelist expiry, inactive removal, activity polling, status channel updates)
- Host a WebSocket tunnel server for Pterodactyl-hosted MC servers

### Minecraft Plugin (Java)

| Attribute | Value |
|-----------|-------|
| Language | Java 17 |
| Framework | Paper API 1.20.4 |
| Build | Maven + maven-shade-plugin |
| Location | `minecraft-plugin/` |
| Entry | `src/main/java/com/whitelistbot/WhitelistBotPlugin.java` |
| Optional deps | LuckPerms (role sync), Vault (economy) |

Responsibilities:

- Host an HTTP API server (`0.0.0.0:25252`) with 10-thread pool
- Register API endpoints via a pluggable Feature system (8 features)
- Manage Minecraft whitelist, pairing, commands, and Bukkit listeners
- Connect outbound via WebSocket tunnel to the Discord bot's VPS (Pterodactyl mode)
- Handle all Bukkit API calls synchronously via `callSyncMethod` (critical: all API handlers run async)

## Architecture

### Direct Mode (self-hosted MC server)

```
Discord Bot (Node.js)  ──── HTTP (port 25252) ───▶  MC Plugin (Paper)
    │                     ◀─── API responses ─────      │
    │  SQLite DB                                          YAML config
    │  slash + prefix cmds                                Feature API
    └─────────────────────────────────────────────────────┘
```

Bot connects **outbound** to the plugin's HTTP server. Plugin binds to `0.0.0.0` — restrict to localhost in production.

### Tunnel Mode (Pterodactyl / restricted hosting)

```
 Discord Bot    WebSocket (port 9000)     VPS Tunnel      HTTP (127.0.0.1:25252)     MC Plugin
 (VPS)          ◀──── reverse tunnel ───▶ Server         ◀──── outbound connect ──── (Pterodactyl)
                ──── request/response ───▶ (Node.js)      ──── proxy to local ─────▶
```

Pterodactyl containers expose only the MC game port. The plugin connects **outbound** via WebSocket to a tunnel server on the VPS. The bot routes API calls through that connection.

### Pairing System

Two flows, both produce a stored `(mc_host, mc_port, api_key)` per Discord guild:

**Flow A — MC to Discord (recommended):**
1. `/wlb pair` on MC server → plugin generates 6-char code (5-min expiry, single-use)
2. Paste the shown command into Discord
3. Bot calls `POST /api/pair/validate` → plugin returns API key
4. Bot stores config in SQLite

**Flow B — Discord to MC:**
1. `/pair ip:host` in Discord → bot sends challenge to plugin
2. In MC: `/wlb connect <CODE>` → plugin returns a command
3. Paste that command into Discord → same validation as Flow A

### Data Flow

```
Discord Slash Command
    → EventListener.interactionCreate
    → command file (src/commands/*.js) creates ctx
    → handler file (src/handlers/*.js) processes logic
    → MinecraftApi.js or ApiClient.js makes HTTP/WebSocket request
    → Plugin ApiServer routes to Feature endpoint
    → Feature executes Bukkit API (via callSyncMethod)
    → Response flows back through the chain
```

### API Endpoints (Plugin)

| Method | Path | Feature | Auth |
|--------|------|---------|------|
| GET | `/api/health` | whitelist | X-API-Key |
| POST | `/api/whitelist/add` | whitelist | X-API-Key |
| POST | `/api/whitelist/remove` | whitelist | X-API-Key |
| GET/POST | `/api/config` | whitelist | X-API-Key |
| POST | `/api/pair/validate` | pairing | none (code-based) |
| POST | `/api/pair/challenge` | pairing | none (code-based) |
| POST | `/api/pair/disconnect` | pairing | X-API-Key |
| POST | `/api/console` | console | X-API-Key |
| POST | `/api/activity/log` | activity | X-API-Key |
| POST | `/api/activity/sync` | activity | X-API-Key |
| GET | `/api/roles` | rolesync | X-API-Key |
| POST | `/api/roles/sync` | rolesync | X-API-Key |
| POST | `/api/moderation/ban` | moderation | X-API-Key |
| POST | `/api/moderation/kick` | moderation | X-API-Key |
| PUT | `/api/moderation/mute` | moderation | X-API-Key |
| DELETE | `/api/moderation/mute` | moderation | X-API-Key |
| POST | `/api/economy/balance` | economy | X-API-Key |
| POST | `/api/economy/give` | economy | X-API-Key |
| POST | `/api/community/command` | community | X-API-Key |

## Development Philosophy

1. **Backward compatibility** — Never break existing pairings or commands. Use additive changes, migrations, deprecation warnings.
2. **Security-first** — All inputs validated. No SSRF. Constant-time comparisons. Parameterized SQL. No hardcoded secrets.
3. **Performance-conscious** — 10-thread pool bound. Timeouts on all HTTP calls. WAL mode on SQLite. No blocking Bukkit API from async.
4. **Minimal ops complexity** — Zero external infrastructure. No Docker. No Redis. No proxy. SQLite file is the database. systemd manages the process.
5. **Stable deployments** — GitHub Actions auto-deploys on push to `main`. Rollback supported. Health checks on every deploy.

## Repository Structure

```
MC-DC-Whitelister/
├── AGENTS.md                          # This file — AI entry point
├── README.md                          # User-facing documentation
├── LICENSE                            # MIT
├── .editorconfig                      # Editor settings (2/4 space indentation)
├── .eslintrc.json                     # ESLint config (Node.js, ES2023)
├── .prettierrc                        # Prettier config
├── .gitignore                         # Ignores node_modules, target/, *.jar, *.db, secrets
├── .env.example                       # Template for Discord credentials
├── .github/
│   └── workflows/
│       └── deploy.yml                 # GitHub Actions: SSH deploy on push to main
├── discord-bot/                       # Discord bot (Node.js)
│   ├── src/
│   │   ├── index.js                   # Entry: initializes all services
│   │   ├── config.js                  # Config cascade loader
│   │   ├── deploy.js                  # Slash command registration
│   │   ├── prefix.js                  # Legacy text command system (> prefix)
│   │   ├── commands/                  # 47 slash command definitions (SlashCommandBuilder)
│   │   │   ├── about.js, config.js, connect.js, help.js, status.js, ...
│   │   │   └── admin/                 # Admin-only commands (ban, kick, mute, etc.)
│   │   ├── handlers/                  # Command logic (decoupled from command defs)
│   │   ├── services/
│   │   │   ├── commandHandler.js      # Discovers & loads command files
│   │   │   ├── eventListener.js       # Registers all Discord.js event handlers
│   │   │   ├── apiClient.js           # HTTP client for plugin API
│   │   │   ├── MinecraftApi.js        # Tunnel-aware API client (tunnel → HTTP fallback)
│   │   │   ├── cleanupService.js      # Periodic background tasks (5-min interval)
│   │   │   ├── tunnel.js              # Singleton tunnel reference
│   │   │   └── tunnelServer.js        # WebSocket server (port 9000)
│   │   ├── database/                  # SQLite table modules (18 tables)
│   │   │   ├── index.js               # Connection manager, schema creation, migrations
│   │   │   ├── guilds.js, whitelist.js, moderation.js, ...
│   │   │   └── settings.js            # Logging, status channels, nickname format
│   │   ├── config/
│   │   │   └── production.js          # Production env validation
│   │   └── utils/
│   │       ├── logger.js              # Structured [timestamp] [LEVEL] [Component] logging
│   │       ├── requireDir.js          # Recursive JS file discovery
│   │       └── validation.js          # MC username, host, port, SSRF validation
│   ├── test/                          # Jest test suite
│   ├── data/                          # SQLite database directory (gitignored)
│   ├── package.json
│   └── SETUP.md
├── minecraft-plugin/                  # Minecraft plugin (Java)
│   ├── pom.xml                        # Maven: Java 17, Paper 1.20.4, shade plugin
│   ├── src/main/
│   │   ├── java/com/whitelistbot/
│   │   │   ├── WhitelistBotPlugin.java   # Main class: lifecycle, service init
│   │   │   ├── api/ApiServer.java        # HTTP server (0.0.0.0:25252, 10 threads)
│   │   │   ├── tunnel/TunnelClient.java  # WebSocket tunnel client (outbound)
│   │   │   ├── command/WhitelistBotCommand.java  # /wlb command executor
│   │   │   ├── config/ConfigManager.java # YAML + env var config
│   │   │   ├── data/DataStore.java       # Player data persistence (JSON file)
│   │   │   ├── whitelist/WhitelistManager.java  # Bukkit whitelist operations
│   │   │   ├── pairing/
│   │   │   │   ├── PairingManager.java   # Session management (ConcurrentHashMap)
│   │   │   │   └── PairingSession.java   # Code, host, port, apiKey, expiry
│   │   │   ├── feature/
│   │   │   │   ├── Feature.java          # Interface: name, endpoints, lifecycle
│   │   │   │   ├── FeatureManager.java   # Registration, lifecycle, shutdown
│   │   │   │   ├── whitelist/WhitelistFeature.java
│   │   │   │   ├── pairing/PairingFeature.java
│   │   │   │   ├── console/ConsoleFeature.java
│   │   │   │   ├── activity/ActivityFeature.java
│   │   │   │   ├── rolesync/RoleSyncFeature.java
│   │   │   │   ├── moderation/ModerationFeature.java
│   │   │   │   ├── community/CommunityFeature.java
│   │   │   │   └── economy/EconomyFeature.java
│   │   │   ├── gui/ConfigGUI.java         # In-game config GUI
│   │   │   └── listener/AntiAltListener.java  # IP-based alt detection
│   │   └── resources/
│   │       ├── plugin.yml
│   │       └── config.yml
│   └── target/                        # Maven build output (gitignored)
├── deploy.sh                          # Manual deploy script (bash)
├── rollback.sh                        # Manual rollback script (bash)
├── test_deployment.sh                 # Deployment test script
└── PLAN.md                            # Product vision document (historical)
```

## Deployment Overview

### Pipeline

```
Developer pushes code to main
    → GitHub Actions triggers (deploy.yml)
    → SSH into VPS (appleboy/ssh-action)
    → git reset --hard + git pull origin main
    → npm --prefix discord-bot install
    → sudo systemctl stop whitelist-bot
    → sudo systemctl start whitelist-bot
    → sleep 10 (warm-up)
    → pgrep -f "node src/index.js" (health check)
    → If fail: bash rollback.sh
```

**Critical understanding:** GitHub is the source of truth. Every push to `main` automatically updates the VPS deployment. The VPS does not run a Minecraft server. The VPS runs only the Discord bot and the tunnel server.

### VPS Infrastructure

| Item | Detail |
|------|--------|
| Host | Oracle VM.Standard.E2.1.Micro (free-tier) |
| IP | 161.118.162.21 |
| OS | Ubuntu |
| User | ubuntu |
| SSH alias | `ssh bot` |
| VPS runs | Discord Bot, Tunnel Server (port 9000), systemd service |
| VPS does NOT run | Minecraft game server, Minecraft plugin, database server (other than SQLite file) |
| MC server location | Pterodactyl container at `in-02.kwickcloud.in:25605` |

### Rollback

1. `bash rollback.sh` on VPS restores the previous git commit, node_modules, and plugin build
2. Also available from `deploy.sh` auto-rollback on failure
3. Backup stored in `~/MC-DC-Whitelister/backup/` with timestamps

### Service Management

```bash
sudo systemctl status whitelist-bot     # Check status
sudo systemctl restart whitelist-bot    # Restart
sudo journalctl -u whitelist-bot -n 50  # View recent logs
sudo journalctl -u whitelist-bot -f     # Follow logs
```

## Key Conventions

- **No AI-looking code** — No generated-looking comments, no excessively verbose patterns
- **No emojis in code** — User-facing messages in Discord may use emojis, but code files should not
- **Windows PowerShell development** — Local environment is PowerShell. Use `;` as command separator.
- **Slash commands first** — All new features should be slash commands. Prefix commands exist for legacy support only.
- **Config cascade** — Env vars → `.env` → `config.json` → `config.example.json`. Never hardcode credentials.
- **All plugin async → Bukkit sync** — Every plugin API handler runs async. All Bukkit API calls must use `callSyncMethod` or `runTask`.
- **Concurrent safety** — Plugin uses `ConcurrentHashMap`, `volatile`, and `synchronized` for all shared state.
- **Tunnel before HTTP** — `MinecraftApi.js` always tries the WebSocket tunnel before falling back to direct HTTP.
- **Constant-time comparisons** — API key comparisons use XOR-based constant-time to prevent timing attacks.

## Common Workflows

### Adding a new Discord command
1. Create `src/commands/admin/<name>.js` with `SlashCommandBuilder` data + execute
2. Create `src/handlers/<name>.js` with business logic
3. Add to `src/prefix.js` if prefix support is needed
4. Register with `node src/deploy.js <GUILD_ID>`

### Adding a new plugin API endpoint
1. Create or modify a Feature class in `minecraft-plugin/src/main/java/com/whitelistbot/feature/`
2. Add endpoint to `getEndpoints()` list
3. Implement `HttpHandler` with authentication
4. Register the feature in `WhitelistBotPlugin.onEnable()`

### Adding a new database table
1. Add CREATE TABLE to `discord-bot/src/database/index.js`
2. Create a module in `discord-bot/src/database/` with CRUD methods
3. Add migration column ALTER TABLE statements in the migration section

### Full testing cycle
```bash
cd discord-bot
npm run lint              # ESLint
npm test                  # Jest tests
npm run test:coverage     # With coverage
```

```bash
cd minecraft-plugin
mvn clean package -DskipTests   # Build
mvn clean package               # Build with tests
```

## Related Documentation

| File | Purpose |
|------|---------|
| [README.md](README.md) | User-facing project overview, features, quick start |
| [PLAN.md](PLAN.md) | Historical product vision (MCLink era) |
| [discord-bot/SETUP.md](discord-bot/SETUP.md) | Bot setup walkthrough |
| [docs/architecture/architecture.md](docs/architecture/architecture.md) | Deep architecture documentation |
| [docs/deployment/deployment.md](docs/deployment/deployment.md) | Complete deployment guide |
| [docs/security/security.md](docs/security/security.md) | Security threat model and mitigations |
| [docs/technologies/technology-stack.md](docs/technologies/technology-stack.md) | Technology decisions and rationale |
| [docs/standards/development-standards.md](docs/standards/development-standards.md) | Coding standards and conventions |
| [docs/methodology/project-methodology.md](docs/methodology/project-methodology.md) | Development methodology and workflows |
