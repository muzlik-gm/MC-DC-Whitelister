# MC-DC-Whitelister

A Discord bot and Minecraft plugin that lets players whitelist themselves from Discord. No admin intervention needed beyond the initial one-time pairing.

## Why This Exists

Minecraft whitelist management is tedious. Someone joins your Discord, you add them to the whitelist file, restart or reload, repeat. Every time someone leaves, you clean up. If you run a public server with a Discord community, this becomes a daily chore.

This project replaces that with a two-way bridge: a Discord bot with slash commands and a Minecraft plugin that exposes a lightweight HTTP API. Pair them once, and your members handle the rest.

## Architecture

```
┌─────────────────┐         HTTP (port 25252)         ┌──────────────────┐
│  Discord Bot     │ ──── one-time pairing ────────▶  │  MC Plugin       │
│  (Node.js)       │ ◀──── API key + whitelist ────── │  (Paper 1.20.4)  │
│                  │                                   │                  │
│  - SQLite DB     │                                   │  - YAML storage  │
│  - Slash cmds    │                                   │  - Feature API   │
│  - Prefix cmds   │                                   │  - Anti-alt      │
└─────────────────┘                                   └──────────────────┘
```

The bot never exposes a port. It connects outbound to the plugin's HTTP server. The plugin binds to localhost by default — don't expose it publicly unless you know what you're doing.

## Setup

### What You Need

- A Discord application with a bot token (create one at https://discord.com/developers/applications)
- A Minecraft server running Paper 1.20.4+ (Purpur, Pufferfish, etc.)
- Java 17+ and Maven to build the plugin
- Node.js 22+ to run the bot

### Discord Bot

```bash
cd discord-bot
npm install
cp config.example.json config.json
```

Edit `config.json` with your bot token and client ID. Then:

```bash
node src/deploy.js <YOUR_GUILD_ID>   # register slash commands
node src/index.js                     # start the bot
```

Detailed walkthrough: [discord-bot/SETUP.md](discord-bot/SETUP.md)

### Minecraft Plugin

```bash
cd minecraft-plugin
mvn clean package
```

Copy `target/WhitelistBot-1.0.0.jar` to your server's `plugins/` folder and restart.

Edit `plugins/WhitelistBot/config.yml`:

```yaml
api-key: <generate a random 32-char hex string>
```

### Pair Them

**From Minecraft (recommended):**
```
/wlb pair
```
Copy the command it shows you and paste it into Discord.

**From Discord:**
```
/pair ip:your.server.ip
```
Then in Minecraft: `/wlb connect <CODE>`, and paste the result back in Discord.

## Commands

### Discord

| Command | What it does |
|---------|--------------|
| `/whitelist <username>` | Link your Discord to a MC account and join the whitelist |
| `/unlink` | Remove yourself from the whitelist (cooldown applies) |
| `/status` | Check your linked account and server info |
| `/pair ip:<host>` | Send a challenge code to your MC server |
| `/connect <code> ip:<host>` | Pair using a code from `/wlb pair` |
| `/setup apikey:<key> [host] [port] [role]` | Manual config |
| `/config` | Open the config panel |
| `/unlinkserver` | Disconnect the bot from your MC server |
| `/help` | List all commands |
| `/about` | Bot info |

### Minecraft

| Command | What it does |
|---------|--------------|
| `/wlb pair` | Generate a pairing code |
| `/wlb connect <code>` | Confirm a challenge from Discord |
| `/wlb status` | Show plugin status |
| `/wlb config` | Open the in-game config GUI |

Aliases: `/whitelistbot`, `/wbot`

## Configuration Reference

### Plugin (`plugins/WhitelistBot/config.yml`)

```yaml
http:
  host: 127.0.0.1
  port: 25252

api-key: CHANGE_ME

unlink:
  enabled: true
  cooldown: 1w

anti-alt:
  enabled: false
  max-accounts: 1
```

| Field | Default | Description |
|-------|---------|-------------|
| `http.host` | `127.0.0.1` | Interface to bind the HTTP server on |
| `http.port` | `25252` | Port for the API server |
| `api-key` | (random) | Shared secret between bot and plugin |
| `unlink.enabled` | `true` | Whether unlink is allowed at all |
| `unlink.cooldown` | `1w` | Min time between unlink and re-link (`10m`, `1h`, `7d`, `1w`, `30d`) |
| `anti-alt.enabled` | `false` | Limit accounts per IP address |
| `anti-alt.max-accounts` | `1` | How many accounts allowed per IP |

### Discord Bot (`discord-bot/config.json`)

```json
{
  "token": "YOUR_BOT_TOKEN",
  "clientId": "YOUR_CLIENT_ID"
}
```

## How Pairing Works

There are two flows, but they converge on the same result.

**Flow A — MC → Discord (easiest):**
1. `/wlb pair` on the server — plugin generates a 6-char code and shows a `/connect <code> ip:<host>` command
2. Paste that command into Discord
3. Bot calls `POST /api/pair/validate` on the plugin with the code
4. Plugin confirms the code matches, returns an API key
5. Bot stores the config — done

**Flow B — Discord → MC:**
1. `/pair ip:host` in Discord — bot generates a code and calls `POST /api/pair/challenge` on the plugin
2. Plugin stores the challenge
3. `/wlb connect <CODE>` in Minecraft — plugin looks up the challenge, returns a `/connect` command
4. Paste that command into Discord
5. Same validation as Flow A

After pairing, the bot stores `mc_host`, `mc_port`, and `api_key` in its SQLite database. Everything after that uses the API key for auth.

## Deployment

The bot is designed to run on a Linux VPS behind systemd. The repo includes:

- **systemd service** — auto-starts on boot, restarts on crash, logs to journald
- **Graceful shutdown** — SIGTERM handler drains connections before exit
- **Command syncing** — only PATCHes commands that actually changed (no destructive global command deletion at runtime)
- **GitHub Actions deploy** — pushes to `main` trigger an SSH deploy to the VPS
- **Daily fallback** — cron job at 3:00 AM pulls updates if the webhook missed one

If you want to self-host, the setup is:

```bash
# On the VPS
cd /opt
git clone https://github.com/muzlik-gm/MC-DC-Whitelister.git
cd discord-bot
npm install
cp config.example.json config.json   # fill in credentials
node src/deploy.js <GUILD_ID>
```

Then set up the systemd service (see [discord-bot/SETUP.md](discord-bot/SETUP.md) for details).

## Security

- **No telemetry.** Zero analytics, zero third-party calls. The bot only talks to Discord and your MC server.
- **API key is sent in cleartext** over HTTP. Keep the plugin on localhost or a trusted network. Don't expose port 25252 publicly.
- **Pairing codes expire** after 5 minutes and are single-use.
- **Constant-time API key comparison** prevents timing side-channel attacks.
- **Parameterized SQL queries** prevent injection.
- **Bounded thread pool** (10 threads max) prevents DoS against the plugin's HTTP server.
- **Private IP validation** on the Discord bot prevents SSRF.

If you find a vulnerability, report it at https://github.com/muzlik-gm/MC-DC-Whitelister/security/advisories/new

## License

[MIT](LICENSE) — do whatever you want with it.
