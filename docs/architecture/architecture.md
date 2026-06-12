# Architecture

## Overview

MC-DC-Whitelister is a two-component system: a Discord bot (Node.js) that communicates with a Minecraft server plugin (Java) over HTTP or WebSocket. The bot connects outbound to the plugin — neither component requires inbound ports on the bot side.

## Component Architecture

### Discord Bot (Node.js)

```
src/index.js
├── Client (discord.js v14)            # Discord gateway connection
├── CommandHandler                     # Loads and manages slash commands
├── EventListener                      # Discord event handlers (interactions, messages, joins)
├── ApiClient                          # HTTP client → plugin API (global)
├── MinecraftApi                       # Tunnel-aware client (per-guild)
├── TunnelServer                       # WebSocket server for Pterodactyl tunnel
├── CleanupService                     # Periodic background tasks (5-min interval)
├── config.js                          # Config cascade loader
├── prefix.js                          # Legacy prefix command handler
├── deploy.js                          # Slash command registration script
├── commands/                          # 47 slash command definitions
├── handlers/                          # Business logic (decoupled from commands)
├── database/                          # 18 SQLite table modules
└── utils/                             # Logger, validator, file discovery
```

#### Service Initialization Order

```
1. config()              → Load Discord credentials
2. production.validate() → Verify production env
3. CommandHandler        → Load all commands from disk
4. ApiClient             → Initialize HTTP client
5. CleanupService        → Start 5-min background interval
6. EventListener         → Register Discord event handlers
7. TunnelServer          → Start WebSocket server on port 9000
8. client.login()        → Connect to Discord gateway
```

### Minecraft Plugin (Java)

```
WhitelistBotPlugin
├── onEnable()
│   ├── ConfigManager       → Load YAML config + env overrides
│   ├── WhitelistManager    → Bukkit whitelist wrapper
│   ├── PairingManager      → Pairing session management
│   ├── DataStore           → Player data persistence (JSON)
│   ├── FeatureManager      → Register 8 features
│   │   ├── WhitelistFeature    → /api/health, /api/whitelist/add|remove, /api/config
│   │   ├── PairingFeature      → /api/pair/validate|challenge|disconnect
│   │   ├── ConsoleFeature      → /api/console
│   │   ├── ActivityFeature     → /api/activity/log|sync
│   │   ├── RoleSyncFeature     → /api/roles, /api/roles/sync
│   │   ├── ModerationFeature   → /api/moderation/ban|kick|mute|(DELETE mute)
│   │   ├── CommunityFeature    → /api/community/command
│   │   └── EconomyFeature      → /api/economy/balance|give
│   ├── ApiServer            → HTTP server (0.0.0.0:25252, 10 threads)
│   ├── TunnelClient         → WebSocket tunnel (optional, Pterodactyl mode)
│   ├── AntiAltListener      → IP-based alt detection
│   └── WhitelistBotCommand  → /wlb in-game command
└── onDisable()
    ├── featureManager.disableAll()
    ├── tunnelClient.disconnect()
    ├── apiServer.stop()
    └── dataStore.saveNow()
```

## Communication Modes

### Direct HTTP Mode

```
Discord Bot           HTTP (port 25252)           MC Plugin
┌─────────┐    POST /api/whitelist/add      ┌──────────┐
│ ApiClient│  ─────────────────────────────▶ │ ApiServer│
│    or    │    { "player": "Steve" }        │  Feature │
│Minecraft │                                 │ Handler  │
│   Api    │  ◀───────────────────────────── │(sync via │
└─────────┘    200 { "success": true }       │callSync) │
                                             └──────────┘
```

- Bot initiates all connections
- Plugin binds to configured interface (default `0.0.0.0`)
- Authentication via `X-API-Key` header
- 10-second timeout on all requests

### WebSocket Tunnel Mode

```
Discord Bot (VPS)     WebSocket (port 9000)     MC Plugin (Pterodactyl)
┌──────────┐                                  ┌──────────────┐
│ Tunnel   │  ◀──── connect + auth ────────── │ TunnelClient │
│ Server   │                                  │              │
│          │  ──── {"type":"request", ───────▶ │  proxies to  │
│          │         "id":"...",              │ 127.0.0.1:   │
│ Pending  │         "method":"POST",         │   25252      │
│  Map     │         "path":"/api/...",       │              │
│          │         "body":{...}}            │              │
│          │                                  │              │
│          │  ◀─── {"type":"response", ─────── │              │
│          │         "id":"...",              │              │
│          │         "status":200,            │              │
│          │         "body":{...}}            │              │
└──────────┘                                  └──────────────┘
```

1. Plugin starts → reads `tunnel.host` from config.yml
2. Plugin connects outbound to `ws://<tunnel.host>:9000`
3. Plugin sends `{"type":"auth","api_key":"..."}`
4. Tunnel server validates auth, marks connection as authenticated
5. Bot needs to call plugin → `MinecraftApi.js` checks tunnel
6. If tunnel connected: send request via WebSocket, await correlated response
7. Plugin receives request → proxies to `127.0.0.1:25252` → sends response back

## Pairing Lifecycle

### Flow A — MC to Discord (recommended)

```
 MC (player)         MC (plugin)              Discord Bot             SQLite
     │                    │                        │                    │
     │  /wlb pair         │                        │                    │
     │───────────────────▶│                        │                    │
     │                    │  Generate 6-char code  │                    │
     │                    │  Store session (5-min) │                    │
     │  "Paste this in    │                        │                    │
     │   Discord:         │                        │                    │
     │   /connect <CODE>" │                        │                    │
     │◀───────────────────│                        │                    │
     │                    │                        │                    │
     │                    │     /connect <CODE>     │                    │
     │                    │◀────────────────────────│                    │
     │                    │                        │                    │
     │                    │  POST /api/pair/validate│                    │
     │                    │◀────────────────────────│                    │
     │                    │  Validate + claim code  │                    │
     │                    │  Rotate API key         │                    │
     │                    │  Return {host,port,key} │                    │
     │                    │────────────────────────▶│                    │
     │                    │                        │  INSERT INTO        │
     │                    │                        │  guild_configs      │
     │                    │                        │──────────────────▶  │
     │                    │  "Paired successfully"  │                    │
     │                    │◀────────────────────────│                    │
     │  "Server paired"   │                        │                    │
     │◀───────────────────│                        │                    │
```

### Flow B — Discord to MC

```
Discord (admin)         Discord Bot             MC Plugin            MC (player)
     │                      │                      │                     │
     │ /pair ip:host        │                      │                     │
     │─────────────────────▶│                      │                     │
     │                      │ POST /pair/challenge  │                     │
     │                      │   {code: "XK4M9P"}   │                     │
     │                      │─────────────────────▶│                     │
     │                      │ Register code (unused)│                    │
     │                      │◀──────────────────────│                     │
     │ "Run /wlb connect    │                      │                     │
     │  XK4M9P in MC"       │                      │                     │
     │◀─────────────────────│                      │                     │
     │                      │                      │ /wlb connect XK4M9P │
     │                      │                      │◀────────────────────│
     │                      │                      │ Mark code claimed   │
     │                      │                      │ Show command to     │
     │                      │                      │ paste in Discord    │
     │                      │                      │────────────────────▶│
     │  (admin pastes       │                      │                     │
     │   shown command)     │                      │                     │
     │─────────────────────▶│ POST /pair/validate   │                     │
     │                      │─────────────────────▶│ Validate + return   │
     │                      │◀──────────────────────│ {host,port,key}    │
     │                      │ Store in SQLite       │                     │
     │ "Paired successfully"│                      │                     │
     │◀─────────────────────│                      │                     │
```

## API Request Flow

```
Discord Interaction
    │
    ▼
interactionCreate Event
    │
    ▼
CommandHandler resolves command name
    │
    ▼
Command file creates ctx wrapper
  • ctx.reply() / ctx.deferReply() / ctx.editReply()
  • ctx.options for command arguments
  • ctx.guildConfig from database
    │
    ▼
Handler file executes business logic
  • Validates inputs (MC username, permissions, etc.)
  • Looks up guild config from database
  • Calls API client methods
    │
    ▼
ApiClient or MinecraftApi makes HTTP request
  • MinecraftApi checks tunnel first
  • Falls back to direct HTTP if no tunnel
  • Sets X-API-Key header
  • 10-second timeout with AbortController
    │
    ▼
Plugin ApiServer receives request
  • 10-thread pool handles the request
  • Route matched against Feature endpoints
  • Authenticated via constant-time X-API-Key comparison
    │
    ▼
Feature handler executes
  • Parses JSON body
  • Calls Bukkit API via callSyncMethod (critical!)
  • Returns JSON response
    │
    ▼
Response propagates back to Discord
```

### Critical Async → Sync Bridge

All plugin `HttpHandler` implementations run on the API server's thread pool (async). Any Bukkit API call (player operations, whitelist, commands, etc.) **must** be wrapped in `Bukkit.getScheduler().callSyncMethod()`. Failure to do so will cause undefined behavior, race conditions, or server crashes.

```java
// CORRECT — synchronous Bukkit call from async context
Bukkit.getScheduler().callSyncMethod(plugin, () -> {
    OfflinePlayer off = Bukkit.getOfflinePlayer(player);
    dataStore.setLinkTimestamp(off.getUniqueId());
    return null;
}).get(10, TimeUnit.SECONDS);

// INCORRECT — calling Bukkit API directly from async handler
// OfflinePlayer off = Bukkit.getOfflinePlayer(player); // DANGER
```

## Database Schema

The bot uses SQLite (WAL mode) with 18 tables stored in `discord-bot/data/whitelist.db`:

| Table | Purpose |
|-------|---------|
| `guild_configs` | Per-guild MC server connection (host, port, api_key, role) |
| `whitelist_entries` | Discord ID ↔ Minecraft username mappings |
| `guild_settings` | Logging channels, status channels, nickname format |
| `role_mappings` | Discord role ID ↔ LuckPerms group name |
| `warnings` | Player warning records |
| `referrals` | Referral tracking |
| `events` | Scheduled community events |
| `event_participants` | RSVPs for events |
| `onboarding_config` | Welcome messages, auto-roles |
| `notes` | Private staff notes |
| `audit_log` | Staff action audit trail |
| `temp_whitelist` | Time-limited whitelist entries |
| `applications` | Whitelist application submissions |
| `application_questions` | Application question configurations |
| `reputation` | Reputation scores |
| `reputation_roles` | Reputation-based role rewards |
| `cleanup_config` | Inactivity cleanup configuration |
| `donations` | Donation records |

## Background Tasks (CleanupService)

Runs every 5 minutes (`setInterval`, 300000ms):

| Task | Description |
|------|-------------|
| Temp whitelist cleanup | Remove expired temporary whitelist entries from DB |
| Inactive cleanup | Remove whitelist entries exceeding guild's inactivity threshold |
| Activity polling | Poll MC server for player events (joins, leaves, deaths, advancements) |
| Status channel updates | Update voice channel names with online/player counts |

## Failure Handling

| Failure | Bot Behavior | Plugin Behavior |
|---------|-------------|-----------------|
| HTTP timeout (10s) | Returns error to user, logs warning | N/A |
| Plugin offline | Returns "server unreachable" to user | N/A |
| Invalid API key | Returns 401, prompts re-pairing | Returns 401, logs warning |
| Tunnel disconnected | Falls back to direct HTTP | Auto-reconnects after 10s (200 ticks) |
| Discord API down | Bot cannot function | Plugin still works for in-game use |
| SQLite corruption | Logs error, exits | N/A |
| Plugin crash | Returns errors on all requests | Paper restarts plugin |
| VPS reboot | systemd auto-restarts | Plugin loses tunnel, reconnects on startup |
