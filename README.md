# MC-DC-Whitelister

A complete Discord ↔ Minecraft community platform. Self-whitelisting, role sync, moderation, analytics, and more — one bot, one plugin, zero hassle.

## Why This Exists

Minecraft whitelist management is tedious. Someone joins your Discord, you add them to the whitelist file, restart or reload, repeat. Every time someone leaves, you clean up. If you run a public server with a Discord community, this becomes a daily chore.

This project replaces that with a two-way bridge: a Discord bot with slash commands and a Minecraft plugin that exposes a lightweight HTTP API. Pair them once, and your members handle the rest.

## Features

- **Self-Whitelisting** — Players link their MC account from Discord without admin intervention
- **Role Sync** — Discord roles ↔ LuckPerms groups with automatic sync
- **Activity Tracking** — Joins, leaves, deaths, advancements, playtime milestones
- **Moderation** — Ban, kick, mute, warn across both platforms
- **Staff Notes** — Private staff records on players
- **Audit Logs** — Every staff action recorded
- **Remote Console** — Run MC server commands from Discord
- **Dynamic Status Channels** — Auto-updating voice channels with player counts
- **Nickname Sync** — Auto-sync Discord nicknames with MC usernames
- **Events** — Scheduled events with RSVP and reminders
- **Referrals** — Invite tracking with leaderboards
- **Reputation** — Community trust system with role rewards
- **Onboarding** — Auto-welcome and auto-role for new members
- **Applications** — Questionnaire-based whitelist approval workflow
- **Economy** — Check and give in-game currency from Discord
- **Donation Tracking** — Record donations with leaderboard
- **Auto Cleanup** — Remove inactive whitelist entries automatically
- **Temporary Whitelisting** — Time-limited access for events or trials
- **Interactive Help** — Button-based command browser

## Architecture

The bot communicates with the MC plugin over HTTP (default port 25252). Two connection modes:

### Direct Mode (self-hosted MC server)

```
┌─────────────────┐         HTTP (port 25252)         ┌──────────────────┐
│  Discord Bot     │ ◀──── one-time pairing ────────▶ │  MC Plugin       │
│  (Node.js)       │ ──── API key + whitelist ──────▶ │  (Paper 1.20+)   │
│                  │                                   │                  │
│  - SQLite DB     │                                   │  - YAML storage  │
│  - Slash cmds    │                                   │  - Feature API   │
│  - Prefix cmds   │                                   │  - Anti-alt      │
└─────────────────┘                                   └──────────────────┘
```

The bot connects outbound to the plugin. The plugin binds to `127.0.0.1` by default — keep it localhost unless you know what you're doing.

### Tunnel Mode (Pterodactyl / restricted hosting)

```
┌─────────────────┐  WebSocket (port 9000)   ┌───────────────────┐  HTTP (127.0.0.1:25252)  ┌──────────────────┐
│  Discord Bot     │ ◀──── reverse tunnel ───▶  VPS (tunnel     │ ◀──── outbound connect ──▶│  MC Plugin       │
│  (VPS)           │ ──── request/response ──▶  server, port    │ ──── proxy to local ─────▶│  (Pterodactyl)   │
│                  │                          9000)              │                           │                  │
└─────────────────┘                           └───────────────────┘                           └──────────────────┘
```

Pterodactyl containers can't expose custom ports. The plugin connects **outbound** via WebSocket to a lightweight tunnel server on your VPS. The bot routes all API calls through that same WebSocket connection. No open ports needed on the MC server.

## Quick Start

### Prerequisites

- Node.js 22+
- Java 17+ and Maven
- A Discord bot token ([create one](https://discord.com/developers/applications))
- A Minecraft server running Paper 1.20+ (Purpur, Pufferfish, etc.)

### Environment Setup

Copy the example env file and edit with your credentials:

```bash
cp .env.example .env
```

Required variables:
- `DISCORD_BOT_TOKEN` — Your Discord bot token
- `DISCORD_CLIENT_ID` — Your Discord application client ID

Optional:
- `TUNNEL_PORT` — Port for the WebSocket tunnel server (default `9000`)

### 1. Discord Bot

```bash
cd discord-bot
npm install
node src/deploy.js
npm start
```

### 2. Minecraft Plugin

```bash
cd minecraft-plugin
mvn clean package -DskipTests
cp target/WhitelistBot-1.0.0.jar <server>/plugins/
```

### 3. Pair

**If self-hosted:** In Minecraft: `/wlb pair` — copy the command it shows and paste it in Discord.

**If using Pterodactyl (tunnel mode):**
1. Set `tunnel.host` and `tunnel.port` in `plugins/WhitelistBot/config.yml`
2. Ensure the VPS firewall allows the tunnel port (default `9000/tcp`)
3. Follow the same pairing flow: `/wlb pair` in Minecraft → paste in Discord

That's it. Players can now run `/whitelist <username>` in Discord to join.

Full walkthrough: [discord-bot/SETUP.md](discord-bot/SETUP.md)

## Commands Reference

### Player Commands

| Command | Description |
|---------|-------------|
| `/whitelist <username>` | Link your MC account to Discord |
| `/whitelist <username> ref:<user>` | Link with a referral |
| `/unlink` | Remove your linked MC account |
| `/status` | Check your link status and server info |
| `/applications apply <username>` | Submit a whitelist application |
| `/rep give <user> [reason]` | Give reputation to another player |
| `/rep check [user]` | Check reputation score |
| `/rep leaderboard` | View reputation rankings |
| `/referrals leaderboard` | View top referrers |

### Server Setup

| Command | Description |
|---------|-------------|
| `/setup apikey:<key>` | Manually configure MC server connection |
| `/pair ip:<host>` | Generate a pairing code to connect |
| `/connect <code> ip:<host>` | Complete the pairing process |
| `/unlinkserver` | Disconnect Discord from MC server |
| `/config` | Open the configuration panel |
| `/onboarding channel <ch>` | Set welcome message channel |
| `/onboarding message <text>` | Set welcome message template |
| `/onboarding role <role>` | Set auto-assign role for joiners |

### Server Management

| Command | Description |
|---------|-------------|
| `/console <command>` | Run any MC server command remotely |
| `/logging channel <ch>` | Set channel for activity logs |
| `/logging types` | Toggle join/leave/death/advancement logs |
| `/logging status` | Show current log configuration |
| `/logging clear` | Remove logging channel |
| `/statuschannel set <on> <pl>` | Set dynamic online player channels |
| `/nickname sync` | Sync all nicknames to MC usernames |
| `/nickname format <fmt>` | Set nickname format template |
| `/cleanup config [days]` | Set inactivity auto-removal threshold |
| `/cleanup dryrun` | Preview inactive accounts |
| `/cleanup run` | Remove inactive whitelist entries |

### Staff Moderation

| Command | Description |
|---------|-------------|
| `/ban <username> [reason]` | Ban a player from MC server |
| `/kick <username> [reason]` | Kick an online player |
| `/mute <user> <duration> [reason]` | Mute a player |
| `/mute remove <username>` | Unmute a player |
| `/warn <username> <reason>` | Issue a warning to a player |
| `/warnings <username>` | View all warnings |
| `/delwarn <id>` | Remove a specific warning |
| `/notes add <user> <content>` | Add a private staff note |
| `/notes list <username>` | View staff notes |
| `/audit [limit]` | Recent staff actions log |

### Community Features

| Command | Description |
|---------|-------------|
| `/roles set @role <group>` | Map Discord role to LuckPerms group |
| `/roles list` | View all role mappings |
| `/roles sync` | Sync all members to their mapped groups |
| `/events create` | Create a scheduled event |
| `/events list` | View upcoming events |
| `/events rsvp <id>` | RSVP to an event |
| `/tempwhitelist add <user> <hours>` | Time-limited whitelist invite |
| `/applications setup` | Configure application questions |
| `/applications pending` | Review pending applications |
| `/applications approve <id>` | Approve an application |
| `/economy balance <user>` | Check in-game balance |
| `/economy give <user> <amt>` | Give in-game currency |
| `/donations set <user> <amt>` | Record a donation |

### Information

| Command | Description |
|---------|-------------|
| `/help [category]` | View help by category with interactive buttons |
| `/tutorial` | Full setup guide with step-by-step |
| `/about` | Bot information and version |

### Minecraft Commands

| Command | Description |
|---------|-------------|
| `/wlb pair` | Generate a pairing code |
| `/wlb connect <code>` | Confirm a challenge from Discord |
| `/wlb status` | Show plugin status |
| `/wlb config` | Open the in-game config GUI |

Aliases: `/whitelistbot`, `/wbot`

**Total: 47 Discord commands + 4 Minecraft commands**

## Configuration Reference

### Plugin (`plugins/WhitelistBot/config.yml`)

**For Production:** Use environment variables:
- `MINECRAFT_API_KEY` — API key (required)
- `MC_HOST` — Server host (defaults to config value)
- `MC_PORT` — Server port (defaults to config value)

```yaml
server:
  host: "127.0.0.1"
  port: 25252

api-key: ""

unlink:
  allow-user-unlink: true
  cooldown: "1w"

anti-alt:
  enabled: false
  max-accounts: 1

tunnel:
  host: ""
  port: 9000

milestones:
  - 1
  - 10
  - 50
  - 100
  - 500
  - 1000
```

| Field | Default | Description |
|-------|---------|-------------|
| `server.host` | `127.0.0.1` | Interface to bind the HTTP server on |
| `server.port` | `25252` | Port for the API server |
| `api-key` | (empty) | Shared secret (use MINECRAFT_API_KEY for production) |
| `unlink.allow-user-unlink` | `true` | Whether players can use `/wlb unlink` |
| `unlink.cooldown` | `1w` | Min time between unlink and re-link |
| `anti-alt.enabled` | `false` | Limit accounts per IP address |
| `anti-alt.max-accounts` | `1` | How many accounts allowed per IP |
| `tunnel.host` | (empty) | VPS host/IP for reverse WebSocket tunnel (leave empty for direct mode) |
| `tunnel.port` | `9000` | VPS tunnel server port |
| `milestones` | `[1,10,50,100,500,1000]` | Playtime milestones (hours) that trigger events |

### Discord Bot

**For Production:** Use environment variables:
- `DISCORD_BOT_TOKEN` — Bot token (required)
- `DISCORD_CLIENT_ID` — Client ID (required)

**For Development:** Set up with `cp config.example.json config.json`

```json
{
  "token": "${DISCORD_BOT_TOKEN}",
  "clientId": "${DISCORD_CLIENT_ID}"
}
```

## How Pairing Works

**Flow A — MC to Discord (easiest):**
1. `/wlb pair` on the server — plugin generates a 6-char code
2. Paste the command it shows into Discord
3. Bot calls `POST /api/pair/validate` on the plugin
4. Plugin confirms the code, returns an API key
5. Bot stores the config — done

**Flow B — Discord to MC:**
1. `/pair ip:host` in Discord — bot generates a code
2. In MC: `/wlb connect <CODE>` — plugin returns a command
3. Paste that command into Discord
4. Same validation as Flow A

After pairing, the bot stores `mc_host`, `mc_port`, and `api_key` in its SQLite database.

**Tunnel mode:** When the plugin connects via WebSocket, the bot automatically routes all API calls through the tunnel instead of direct HTTP. No config changes needed after pairing.

## Tunnel Mode (Pterodactyl)

Pterodactyl containers only expose the Minecraft game port. The reverse WebSocket tunnel solves this:

1. **Bot** runs a WebSocket server (port `9000`) on your VPS
2. **Plugin** connects outbound to the VPS WebSocket server on startup
3. **Bot** detects the tunnel connection and routes API requests through it
4. **No custom ports** needed on the MC server — the plugin only needs outbound internet access

### Setup

**On the VPS (bot host):**
```bash
# Ensure port 9000 is open
sudo ufw allow 9000/tcp
```

**In `plugins/WhitelistBot/config.yml` on the MC server:**
```yaml
tunnel:
  host: "your.vps.ip"
  port: 9000
```

The plugin connects to the tunnel automatically on startup and reconnects if disconnected.

## Deployment

### VPS Deployment

The bot is designed for a Linux VPS behind systemd:

- **systemd service** — auto-starts on boot, restarts on crash, logs to journald
- **Graceful shutdown** — SIGTERM handler drains connections before exit
- **Command syncing** — only PATCHes commands that changed (no destructive global deletion)
- **GitHub Actions deploy** — pushes to `main` trigger SSH deploy
- **Daily fallback** — cron job at 12:00 PM pulls updates if webhook missed

```bash
# On the VPS
git clone https://github.com/muzlik-gm/MC-DC-Whitelister.git
cd MC-DC-Whitelister/discord-bot
npm install
cp config.example.json config.json
# Edit config.json with your Discord credentials
node src/deploy.js
```

### Pterodactyl Plugin Deployment

```bash
# Build the plugin
cd minecraft-plugin
mvn clean package -DskipTests

# Upload the jar to Pterodactyl's /plugins/ via file manager
# target/WhitelistBot-1.0.0.jar → /plugins/

# Restart the server from the Pterodactyl panel
```

### GitHub Actions

A deploy workflow (`.github/workflows/deploy.yml`) runs on every push to `main`:

1. Checkout code from GitHub
2. SSH into the VPS using stored secrets (`VPS_HOST`, `VPS_SSH_KEY`)
3. Pull latest code, install dependencies, restart the bot

Secrets required in the repository:
- `VPS_HOST` — VPS IP address
- `VPS_USERNAME` — SSH user (default `ubuntu`)
- `VPS_SSH_KEY` — Private SSH key for authentication

### Rollback

A rollback script (`rollback.sh`) is included for manual recovery:
```bash
bash rollback.sh
```

## Security

- **No telemetry** — Zero analytics, zero third-party calls. The bot only talks to Discord and your MC server.
- **API key in cleartext over HTTP** — Keep the plugin on localhost or a trusted network. Don't expose port 25252 publicly.
- **WebSocket tunnel auth** — The plugin authenticates with the tunnel server using the API key.
- **Pairing codes expire** after 5 minutes and are single-use.
- **Constant-time API key comparison** prevents timing side-channel attacks.
- **Parameterized SQL queries** prevent injection.
- **Bounded thread pool** (10 threads max) prevents DoS against the plugin's HTTP server.
- **Private IP validation** on the Discord bot prevents SSRF.
- **DNS rebinding protection** — Blocks known rebinding domains (nip.io, xip.io, sslip.io, lvh.me, localtest.me).
- **Environment variable credential management** — All credentials are loaded from environment variables, not hardcoded.
- **Concurrent-safe design** — All shared state uses `ConcurrentHashMap`, `volatile`, and `synchronized` blocks. Bukkit API calls from async contexts are wrapped in `callSyncMethod`.

Report vulnerabilities at https://github.com/muzlik-gm/MC-DC-Whitelister/security/advisories/new

## Development

### Discord Bot

```bash
cd discord-bot

# Install dependencies
npm install

# Lint
npm run lint

# Test
npm test

# Test with coverage
npm run test:coverage
```

### Minecraft Plugin

```bash
cd minecraft-plugin

# Build
mvn clean package -DskipTests

# Build with tests
mvn clean package
```

The plugin requires Paper 1.20+ API and optionally LuckPerms for role sync.

## License

[MIT](LICENSE) — do whatever you want with it.
