# MC-DC-Whitelister

A Discord bot + Minecraft plugin that bridges your Discord server with your Minecraft whitelist. Members whitelist themselves from Discord — no admin intervention needed.

One Discord user = one Minecraft account. No alts, no workarounds.

## How It Works

1. Install the plugin on your Minecraft server
2. Add the bot to your Discord server
3. Pair them with a one-time code
4. Members run `/whitelist <username>` and they're in

The pairing is two-way: start from Discord or from Minecraft, whichever is easier.

## Features

- **Two-way pairing** — initiate from Discord (`>pair`) or MC (`/wlb pair`)
- **One-account enforcement** — database-level UNIQUE constraint, one Discord = one MC
- **Anti-alt detection** — optional IP-based account limiting
- **Role-gated whitelisting** — restrict to specific Discord roles
- **Unlink cooldown** — configurable cooldown between unlink/relink (10 minutes to 1 month)
- **Live config panel** — toggle settings from Discord or in-game GUI
- **Per-server config** — each Discord server pairs independently
- **No telemetry** — zero analytics, zero third-party services

## Requirements

- Node.js 18+
- Minecraft server running Paper 1.20.4+ (or forks: Purpur, Pufferfish, etc.)
- Discord bot application with a bot token

## Setup

See [discord-bot/SETUP.md](discord-bot/SETUP.md) for the full walkthrough.

Quick version:

```bash
# Discord Bot
cd discord-bot
npm install
cp config.example.json config.json   # fill in your token + clientId
node src/deploy.js                    # register slash commands
npm start

# Minecraft Plugin
cd minecraft-plugin
mvn clean package
# copy target/WhitelistBot-1.0.0.jar to your server's plugins/ folder
# restart the server
```

Then in Minecraft: `/wlb pair` — copy the command it gives you and paste it in Discord.

## Commands

### Discord

| Command | Description |
|---------|-------------|
| `/whitelist <username>` | Link your MC account and join the whitelist |
| `/unlink` | Remove yourself from the whitelist |
| `/status` | Check your linked account |
| `/pair ip:<host>` | Send a pairing code to your MC server |
| `/connect <code> ip:<host>` | Connect using a code from `/wlb pair` |
| `/setup apikey:<key>` | Manual config (power users) |
| `/config` | Open the config panel |
| `/unlinkserver` | Disconnect the bot from your MC server |

### Minecraft

| Command | Description |
|---------|-------------|
| `/wlb pair` | Show pairing code + command for Discord |
| `/wlb connect <code>` | Confirm a challenge from Discord |
| `/wlb status` | Show plugin status |

Aliases: `/whitelistbot`, `/wbot`

## Configuration

### Minecraft Plugin (`plugins/WhitelistBot/config.yml`)

```yaml
http:
  host: 127.0.0.1
  port: 25252

api-key: CHANGE_ME_TO_A_SECURE_RANDOM_KEY

unlink:
  enabled: true
  cooldown: 1w    # 1w = 1 week, 30m = 30 minutes, etc.

anti-alt:
  enabled: false
  max-accounts: 1
```

### Discord Bot (`discord-bot/config.json`)

```json
{
  "token": "YOUR_BOT_TOKEN",
  "clientId": "YOUR_BOT_CLIENT_ID"
}
```

## Security

If you find a security issue, please report it privately via [GitHub's private vulnerability reporting](https://github.com/muzlik-gm/MC-DC-Whitelister/security/advisories/new) rather than opening a public issue.

## Contributing

Pull requests are welcome. Run the linter before submitting:

```bash
cd discord-bot && npx eslint src/
```

Build the plugin to verify it compiles:

```bash
cd minecraft-plugin && mvn clean package
```

## License

[MIT](LICENSE)
