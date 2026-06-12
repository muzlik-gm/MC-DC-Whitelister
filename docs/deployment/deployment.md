# Deployment

## Overview

The deployment pipeline is designed for a Linux VPS running the Discord bot behind systemd. The Minecraft plugin is deployed separately to the game server (self-hosted or Pterodactyl).

**Critical understanding:** GitHub is the source of truth. Every push to `main` automatically updates the VPS deployment via GitHub Actions.

## Architecture

```
┌──────────────┐      push to main       ┌───────────────┐
│  Developer   │ ───────────────────────▶ │  GitHub       │
│  (git push)  │                          │  Actions      │
└──────────────┘                          └───────┬───────┘
                                                  │ SSH deploy
                                                  ▼
                                          ┌───────────────┐
                                          │  VPS          │
                                          │  (Ubuntu)     │
                                          │               │
                                          │  systemd      │
                                          │  whitelist-   │
                                          │  bot.service  │
                                          │               │
                                          │  Node.js bot  │
                                          │  Tunnel port  │
                                          │  (9000)       │
                                          └───────────────┘
```

## VPS Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| CPU | 1 core (AMD) | 2 cores |
| RAM | 512 MB | 1 GB |
| Disk | 5 GB | 10 GB |
| OS | Ubuntu 22.04 | Ubuntu 24.04 |
| Node.js | 18.x | 22.x |
| systemd | Available | 255+ |

The VPS runs on Oracle VM.Standard.E2.1.Micro (free-tier) at `161.118.162.21`.

### What Runs on the VPS

- Discord Bot (Node.js process)
- WebSocket Tunnel Server (port 9000)
- SQLite database file
- systemd service manager
- GitHub deployment scripts

### What Does NOT Run on the VPS

- Minecraft game server
- Minecraft plugin (Java)
- Any database server (SQLite is file-based)

## GitHub Actions

The deploy workflow (`.github/workflows/deploy.yml`) triggers on every push to `main`.

### Required Secrets

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | VPS IP address (`161.118.162.21`) |
| `VPS_SSH_KEY` | Private SSH key for authentication |

### Deploy Steps

```
1. GitHub Actions checkout
   → uses: actions/checkout@v4

2. SSH into VPS
   → uses: appleboy/ssh-action@v1.2.0
   → host: ${{ secrets.VPS_HOST }}
   → username: ubuntu
   → key: ${{ secrets.VPS_SSH_KEY }}
   → timeout: 300s

3. Navigate to project root (~/)

4. Check if repo exists:
   If not:  git clone https://github.com/muzlik/MC-DC-Whitelister.git
   If yes:  cd MC-DC-Whitelister && git reset --hard

5. Save rollback state
   → git status, git diff, git rev-parse HEAD → backup/

6. Pull latest code
   → git reset --hard
   → git pull origin main

7. Install dependencies
   → npm --prefix discord-bot install

8. Stop the bot
   → sudo systemctl stop whitelist-bot

9. Start the bot
   → sudo systemctl start whitelist-bot

10. Health check
    → sleep 10
    → pgrep -f "node src/index.js"
    → If not running: bash rollback.sh && exit 1
```

## systemd Service

The bot runs as a systemd service for automatic startup, crash recovery, and log management.

### Service File (`/etc/systemd/system/whitelist-bot.service`)

```ini
[Unit]
Description=MC-DC-Whitelister Discord Bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/MC-DC-Whitelister/discord-bot
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=DISCORD_BOT_TOKEN=<set in .env>
Environment=DISCORD_CLIENT_ID=<set in .env>

[Install]
WantedBy=multi-user.target
```

### Service Commands

```bash
sudo systemctl status whitelist-bot        # Check status
sudo systemctl start whitelist-bot         # Start
sudo systemctl stop whitelist-bot          # Stop
sudo systemctl restart whitelist-bot       # Restart
sudo systemctl enable whitelist-bot        # Enable on boot
sudo systemctl disable whitelist-bot       # Disable on boot
sudo journalctl -u whitelist-bot -n 50     # Recent logs
sudo journalctl -u whitelist-bot -f        # Follow logs
```

## Environment Variables

### Required (Bot)

| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `DISCORD_CLIENT_ID` | Discord application client ID |

### Optional (Bot)

| Variable | Default | Description |
|----------|---------|-------------|
| `TUNNEL_PORT` | `9000` | WebSocket tunnel server port |
| `NODE_ENV` | (unset) | Set to `production` for deployment |

### Required (Plugin)

| Variable | Description |
|----------|-------------|
| `MINECRAFT_API_KEY` | Shared API key for bot↔plugin auth |

### Optional (Plugin)

| Variable | Default | Description |
|----------|---------|-------------|
| `MC_HOST` | Config file value | Server host/IP |
| `MC_PORT` | Config file value | Server port |

## Manual Deployment

When GitHub Actions is unavailable:

```bash
# On the VPS via SSH
ssh bot

# Navigate to repo
cd ~/MC-DC-Whitelister

# Pull latest
git pull origin main

# Install dependencies
npm --prefix discord-bot install

# Restart bot
sudo systemctl restart whitelist-bot

# Check status
sudo systemctl status whitelist-bot
```

Or use the deployment script:

```bash
bash deploy.sh
```

## Minecraft Plugin Deployment

The plugin JAR is built separately and deployed to the game server:

### Self-Hosted

```bash
# Build locally
cd minecraft-plugin
mvn clean package -DskipTests

# Copy to server
cp target/WhitelistBot-1.0.0.jar /path/to/server/plugins/

# Restart or reload
```

### Pterodactyl

1. Build locally: `mvn clean package -DskipTests`
2. Upload `target/WhitelistBot-1.0.0.jar` via Pterodactyl file manager to `/plugins/`
3. Restart the server from Pterodactyl panel

## Disaster Recovery

### Bot Crash

systemd automatically restarts the bot on failure (`Restart=on-failure`, 5-second delay). If it crashes repeatedly:

```bash
# Check recent logs
sudo journalctl -u whitelist-bot -n 100 --no-pager

# Check for common issues
# - Missing DISCORD_BOT_TOKEN
# - SQLite database corruption
# - Port 9000 already in use
```

### Failed Deployment

The deployment script includes rollback logic. If the health check fails:

```bash
# Auto-rollback (from deploy script)
# The script calls: bash rollback.sh

# Manual rollback
bash rollback.sh
```

### Full Server Failure

If the VPS is unrecoverable:

1. Provision a new VPS
2. Install Node.js 18+ and git
3. Clone the repository: `git clone https://github.com/muzlik/MC-DC-Whitelister.git`
4. Set up `.env` with Discord credentials
5. Create systemd service
6. Run `npm --prefix discord-bot install`
7. Start the bot: `sudo systemctl start whitelist-bot`
8. Re-pair the Minecraft server via `/wlb pair`

### Database Recovery

SQLite database is at `discord-bot/data/whitelist.db`. Backups should be taken periodically:

```bash
cp discord-bot/data/whitelist.db discord-bot/data/whitelist.db.backup
```

To restore:

```bash
sudo systemctl stop whitelist-bot
cp discord-bot/data/whitelist.db.backup discord-bot/data/whitelist.db
sudo systemctl start whitelist-bot
```

## Rollback Process

### How Rollback Works

1. Before each deploy, the script saves:
   - Current git commit hash
   - Git diff (uncommitted changes)
   - Plugin build artifacts
   - Node modules
   - systemd service file

2. On rollback:
   - Stop the bot
   - `git checkout` the saved commit hash
   - Restore previous `node_modules/`
   - Rebuild the plugin
   - Restart the bot

### Triggering Rollback

**Automatic:** When the health check fails after deploy.

**Manual:**
```bash
cd ~/MC-DC-Whitelister
bash rollback.sh
```

### Rollback File Structure

```
~/MC-DC-Whitelister/backup/
├── rollback-info                        # Points to latest backup
├── git_status_20261206_143000.txt       # Pre-deploy git status
├── git_diff_20261206_143000.txt         # Pre-deploy git diff
├── git_commit_20261206_143000.txt       # Pre-deploy commit hash
├── target_20261206_143000/              # Plugin build artifacts
├── node_modules_20261206_143000/        # Node.js dependencies
├── config_20261206_143000.yml           # Plugin config backup
├── package_20261206_143000.json         # Package.json backup
└── whitelist-bot.service_20261206_143000  # systemd service file
```

## Network Diagram

```
Internet
    │
    ├── Discord API (gateway.discord.gg:443)
    │       │
    │       ▼
    │   VPS (161.118.162.21)
    │   ├── Port 9000 (WebSocket tunnel — MC → VPS)
    │   ├── Port 22 (SSH — GitHub Actions / admin)
    │   └── Outbound only to Discord API
    │
    └── Minecraft Server (in-02.kwickcloud.in:25605)
        ├── Port 25605 (MC game protocol)
        └── Outbound to VPS:9000 (WebSocket tunnel)
```

## Deployment Checklist

### First Time Setup

- [ ] VPS provisioned with Ubuntu 22.04+
- [ ] Node.js 18+ installed
- [ ] Git installed
- [ ] Repository cloned
- [ ] `.env` configured with Discord credentials
- [ ] systemd service created and enabled
- [ ] UFW firewall allows port 9000/tcp
- [ ] GitHub secrets configured (VPS_HOST, VPS_SSH_KEY)
- [ ] Bot started and verified operational
- [ ] Slash commands deployed via `node src/deploy.js <GUILD_ID>`

### Each Deploy

- [ ] Code pushed to `main`
- [ ] GitHub Actions run completes successfully
- [ ] Health check passes (bot responsive)
- [ ] Rollback snapshot created

### After Incident

- [ ] root cause identified
- [ ] Fix pushed to `main`
- [ ] Deploy verified
- [ ] Rollback snapshot cleaned if no longer needed
