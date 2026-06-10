# Discord Bot Setup

## 1. Create the Application

1. Go to https://discord.com/developers/applications
2. Click **New Application** → enter a name → **Create**

## 2. Get Your Credentials

Left sidebar → **OAuth2 > General**

Copy the **Client ID** — this goes into `config.json` as `clientId`.

## 3. Create the Bot

Left sidebar → **Bot** → **Add Bot** → confirm

| Setting | Value |
|---------|-------|
| **Token** | Click **Reset Token** → copy it |
| **Public Bot** | Off |
| **Server Members Intent** | On (under Privileged Gateway Intents) |

The token goes into `config.json` as `token`. Never share it or commit it.

## 4. Invite the Bot

1. Left sidebar → **OAuth2 > URL Generator**
2. Scopes: `bot`, `applications.commands`
3. Bot Permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`, `Manage Nicknames`, `Manage Roles`
4. Copy the URL → open in browser → select your server → **Authorize**

> **Note:** `Manage Nicknames` is needed for nickname sync. `Manage Roles` is needed for role sync. If you don't use these features, you can skip those permissions.

## 5. Configure

**For Production:** Set environment variables:
```bash
export DISCORD_BOT_TOKEN="YOUR_BOT_TOKEN"
export DISCORD_CLIENT_ID="YOUR_CLIENT_ID"
```

**For Development:**
```bash
node -e "if(!require('fs').existsSync('./config.json')){require('fs').copyFileSync('./config.example.json','./config.json');console.log('Created config.json from example.');}else{console.log('config.json already exists.');}"
```

Then edit `discord-bot/config.json`:

```json
{
  "token": "${DISCORD_BOT_TOKEN}",
  "clientId": "${DISCORD_CLIENT_ID}"
}
```

## 6. Run

```bash
cd discord-bot
npm install
node src/deploy.js    # registers slash commands
npm start             # starts the bot
```

> **Tip:** After setup, run `/help` or `>help` in Discord to see all available commands with interactive category buttons.

## 7. Pair with Minecraft

### Option A — From Minecraft (recommended)

1. In your MC server: `/wlb pair`
2. Copy the command it shows you
3. Paste it in Discord

### Option B — From Discord

1. In Discord: `/pair ip:your.server.ip`
2. In MC: `/wlb connect <CODE>`
3. Paste the result back in Discord

### Option C — Manual

```
/setup apikey:<key> host:<ip> port:25252 role:@role
```

**API Key Source:**
- **If using MC to Discord pairing:** The API key is automatically generated and provided by the Minecraft plugin
- **If using Discord to MC pairing:** You need the API key from your `plugins/WhitelistBot/config.yml` (use a random 32-char hex string)

**For production:** Use environment variables - no need to edit config files.

## 8. Features After Setup

Once paired, your community has access to:

- **Self-whitelisting** — `/whitelist <username>` to link MC accounts
- **Role sync** — `/roles set @role <group>` to map Discord roles to LuckPerms
- **Nickname sync** — `/nickname sync` to auto-match Discord nicknames to MC usernames
- **Activity logging** — `/logging channel <ch>` to track joins, leaves, deaths, advancements
- **Dynamic status channels** — `/statuschannel set` for auto-updating player counts
- **Moderation** — `/ban`, `/kick`, `/mute`, `/warn` across both platforms
- **Events** — `/events create` with RSVP and reminders
- **Applications** — `/applications setup` for questionnaire-based whitelist approval
- **Reputation** — `/rep give` and `/rep check` for community trust
- **And more** — run `/help` to see everything
