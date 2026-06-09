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
3. Bot Permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
4. Copy the URL → open in browser → select your server → **Authorize**

## 5. Configure

Edit `discord-bot/config.json`:

```json
{
  "token": "YOUR_BOT_TOKEN",
  "clientId": "YOUR_CLIENT_ID"
}
```

## 6. Run

```bash
cd discord-bot
npm install
node src/deploy.js    # registers slash commands
npm start             # starts the bot
```

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

Use this if you already have the API key from `config.yml`.
