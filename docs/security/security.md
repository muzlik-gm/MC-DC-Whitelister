# Security

## Threat Model

| Threat | Impact | Existing Mitigation |
|--------|--------|---------------------|
| SSRF via guild config | Attacker makes bot request internal services | Private IP / DNS rebinding validation |
| API key theft | Attacker controls MC server via plugin API | XOR constant-time comparison, key rotation on pair |
| SQL injection | Database corruption / data exfiltration | Parameterized queries (better-sqlite3) |
| Discord token theft | Full bot control | Token in env vars, never committed |
| WebSocket MITM | Tunnel traffic interception | Connections within trusted VPC |
| DoS on plugin API | Server resource exhaustion | 10-thread pool bound, 5s connect/read timeouts |
| Alt account abuse | Whitelist exploitation | IP-based anti-alt detection (configurable) |
| Pairing code brute-force | Unauthorized server pairing | 5-min expiry, single-use, 6-char alphanumeric (32^6 combos) |
| Timing attack on API key | Key extraction via response timing | XOR constant-time comparison |

## SSRF Protections

The `discord-bot/src/utils/validation.js` module provides SSRF defense.

### Private IP Detection

Blocks requests to private, loopback, and link-local addresses:

```
127.0.0.0/8      — Loopback
10.0.0.0/8       — Private (Class A)
172.16.0.0/12    — Private (Class B)
192.168.0.0/16   — Private (Class C)
169.254.0.0/16   — Link-local
0.0.0.0/8        — Invalid
::1              — IPv6 loopback
fc00::/7         — IPv6 unique local
fe80::/10        — IPv6 link-local
```

### DNS Rebinding Protection

Blocks known DNS rebinding / SSRF-vulnerable domains:

```
*.nip.io
*.xip.io
*.sslip.io
lvh.me
*.lvh.me
localtest.me
*.localtest.me
```

### Hostname Format Validation

Rejects malformed hostnames:
- Leading dots
- Trailing dots without valid TLD
- Octal IP notation (e.g., `0177.0.0.1`)
- Hexadecimal IP notation (e.g., `0x7f.0.0.1`)
- Integer IP notation (e.g., `2130706433`)

## API Authentication

### Plugin API Key

All plugin API endpoints (except pairing) require the `X-API-Key` header:

```java
// Constant-time comparison prevents timing attacks
private boolean constantTimeEquals(String a, String b) {
    if (a.length() != b.length()) return false;
    int result = 0;
    for (int i = 0; i < a.length(); i++) {
        result |= a.charAt(i) ^ b.charAt(i);
    }
    return result == 0;
}
```

### API Key Rotation

The API key is automatically rotated during pairing:

```java
String newApiKey = plugin.getConfigManager().rotateApiKey();
```

### Unauthenticated Endpoints

The pairing endpoints (`/api/pair/validate`, `/api/pair/challenge`) do not require API key auth because they use single-use time-limited codes instead.

## Secret Management

### Bot Credentials

Credentials follow a strict cascade:

1. **Environment variables** (most secure for production)
2. **`.env` file** (secure if file permissions are set)
3. **`config.json`** (development only, gitignored)
4. **`config.example.json`** (fallback, development only)

### What is NEVER committed

- `discord-bot/config.json` (in `.gitignore`)
- `discord-bot/.env` (in `.gitignore`)
- Root `.env` (in `.gitignore`)
- Any `*.db` files
- SSH private keys

### Plugin Credentials

- `api-key` in `config.yml` (gitignored if in `plugins/` directory, not in repo)
- `MINECRAFT_API_KEY` environment variable (production)
- API key stored per-guild in SQLite `guild_configs` table

## SQL Injection Prevention

All database queries use **parameterized statements** via better-sqlite3:

```javascript
// SAFE — parameterized
db.prepare('INSERT INTO whitelist_entries (discord_id, minecraft_username) VALUES (?, ?)').run(discordId, username);

// DANGEROUS — string interpolation
// db.prepare(`INSERT INTO whitelist_entries VALUES ('${discordId}', '${username}')`).run();
```

## Channel Permissions

### Discord Permission Checks

The bot performs permission checks in command files before executing admin commands:

```javascript
// Admin commands check for specific permissions
if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    return ctx.reply('You need Administrator permission to use this command.');
}
```

### Minecraft Permission Checks

- In-game `/wlb pair` requires OP or operator status
- Plugin commands check sender's permission level

## Tunnel Authentication

The WebSocket tunnel uses API key authentication:

```
Plugin → TunnelServer: {"type": "auth", "api_key": "..."}
TunnelServer validates key → marks connection as authenticated
Unauthenticated connections are ignored/dropped
```

## Rate Limiting

### Plugin Side

- 10-thread fixed thread pool limits concurrent API handlers
- 5-second connect and read timeouts on HTTP requests
- 5-second timeouts on tunnel proxy requests

### Bot Side

- 10-second timeout on all HTTP requests to plugin
- Pending request map in tunnel server prevents memory leaks

## Logging Requirements

All security-relevant events must be logged:

| Event | Log Level | Component |
|-------|-----------|-----------|
| Authentication failure | WARN | ApiClient / Feature |
| Invalid pairing code | WARN | PairingFeature |
| SSRF attempt blocked | WARN | validation.js |
| SQL error | ERROR | Database |
| Discord token validation failure | ERROR | production.js |
| Bot startup/shutdown | INFO | Bot |
| Connection established | INFO | Tunnel |
| Connection lost | WARN | Tunnel |

## Currently Missing Security Measures

These areas should be addressed in future development:

### Missing

1. **HTTPS support** — Plugin API and tunnel communicate over cleartext HTTP/WS. Should support TLS for untrusted networks.
2. **Rate limiting on pairing endpoints** — No per-IP rate limiting on `/api/pair/*` endpoints.
3. **Input size limits** — No maximum body size enforcement on plugin HTTP server.
4. **WebSocket frame size limits** — No maximum frame size on tunnel server.
5. **Database encryption** — SQLite file is unencrypted at rest.
6. **Audit log rotation** — No log rotation for audit logs in the database.
7. **Permission re-validation** — Role sync permissions could be re-verified periodically.
8. **Session invalidation on guild leave** — When bot leaves a guild, API keys are not explicitly invalidated.
9. **Input sanitization for console commands** — Remote console commands from Discord could include injection attempts.
10. **WebSocket origin validation** — Tunnel server does not validate WebSocket origin headers.

### Mitigated by Architecture

Some risks are inherently limited by the system design:

- **Cleartext HTTP for plugin API** — Acceptable when plugin is on localhost or trusted VPC. The tunnel mode routes through the VPS only.
- **No TLS on tunnel** — Acceptable when tunnel is between known endpoints on a trusted network.
- **Single SQLite file** — Acceptable for single-server deployments. Not designed for multi-server sharding.
