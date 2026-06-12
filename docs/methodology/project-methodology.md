# Project Methodology

## Architectural Principles

### 1. Outbound-Only Communication

The Discord bot **always connects outbound** to the Minecraft plugin. Neither component requires inbound ports on the bot side. This is a deliberate security and deployment decision:

- Self-hosted servers: Bot outbound HTTP → plugin's REST API
- Pterodactyl servers: Plugin outbound WebSocket → bot's tunnel server

This means:
- No port forwarding needed for the bot
- No public IP needed for the bot (it reaches out to find the plugin)
- The plugin can be behind NAT, Docker, or Pterodactyl

### 2. Feature-Based Plugin Architecture

The Minecraft plugin uses a pluggable `Feature` interface:

```java
public interface Feature {
    String getName();
    boolean isEnabled();
    void onEnable(WhitelistBotPlugin plugin);
    void onDisable();
    List<Endpoint> getEndpoints();
}
```

Each feature is self-contained with its own API endpoints, lifecycle, and state. Adding a new feature:
1. Create a new package under `feature/`
2. Implement the `Feature` interface
3. Register in `WhitelistBotPlugin.onEnable()`

Features are automatically discovered by `FeatureManager` — no wiring code needed.

### 3. Decoupled Command Architecture

Discord commands follow a three-layer separation:

```
Definition (commands/*.js)     → SlashCommandBuilder + ctx wrapper
Business Logic (handlers/*.js) → Actual processing, API calls, DB access
Execution (EventListener)      → Routes interactions to commands
```

This allows:
- Prefix commands and slash commands to share handler logic
- Testing handlers independently of Discord
- Adding new invocation methods (e.g., message components) without duplicating logic

### 4. Singleton Tunnel Access

The tunnel instance is accessed via a singleton module rather than being threaded through every handler:

```javascript
// tunnel.js
module.exports = { setTunnel, getTunnel };

// Any module can check tunnel availability:
const tunnel = require('./services/tunnel');
if (tunnel.getTunnel()) { /* use tunnel */ }
```

This avoids modifying constructor signatures across dozens of handlers when the tunnel was added later.

### 5. SQLite as Single-Purpose Store

SQLite is chosen deliberately — not as a limitation but as a design constraint:

- No infrastructure (no server process, no Docker, no connection pooling)
- File-based backup and restore
- WAL mode for concurrent read performance
- Parameterized queries prevent injection by design
- Single-file database simplifies deployment and migration

## Development Philosophy

### Backward Compatibility First

- Never break existing pairings. A paired server must continue working after updates.
- Database migrations are additive only (ALTER TABLE ADD COLUMN, never DROP).
- API endpoints never change response format without a version path.
- Deprecated features receive a deprecation warning cycle before removal.

### Security-First Mindset

- All inputs are treated as untrusted until validated.
- The bot validates MC usernames, hostnames, and ports before sending to the plugin.
- The plugin validates all API inputs independently (defense in depth).
- API keys use constant-time comparison.
- SSRF protection is built into the bot's hostname validation.

### Performance-Conscious Development

- Plugin API handlers run async. Never block the main server thread.
- Bukkit API calls from async handlers use `callSyncMethod()`.
- HTTP timeouts prevent resource leaks on network failures.
- SQLite WAL mode allows concurrent reads without blocking.
- 10-thread pool prevents DoS on plugin API.

### Minimal Operational Complexity

- Zero external infrastructure: no Docker, no Redis, no PostgreSQL, no proxy.
- Single systemd service for the bot.
- Single SQLite file for all data.
- Zero configuration for basic use (env vars only).
- Five-minute deploy from clone to running.

### Stable Production Deployments

- GitHub Actions auto-deploys every push to `main`.
- Rollback snapshot taken before every deploy.
- Health checks verify the bot is running after deploy.
- systemd restarts the bot on crash.

## Feature Design Process

### New Discord Command

1. Identify the command category:
   - `commands/*.js` for player-facing commands
   - `commands/admin/*.js` for staff-only commands
2. Create command definition with `SlashCommandBuilder`:
   - Set name, description, options (with types, required/optional)
   - Set `defaultMemberPermissions` for admin commands
   - Create `ctx` wrapper in the `execute` function
3. Create handler in `handlers/*.js`:
   - Extract parameters from ctx
   - Validate inputs
   - Execute business logic (DB queries, API calls)
   - Return response via ctx
4. Add prefix support in `src/prefix.js` (optional, legacy)
5. Register: `node src/deploy.js <GUILD_ID>`

### New Plugin API Endpoint

1. Identify the feature that should own the endpoint
2. Add an `Endpoint` implementation to that feature class:
   - Define path (e.g., `/api/myfeature/action`)
   - Implement `HttpHandler` with authentication
   - Use `callSyncMethod()` for any Bukkit API calls
   - Return structured JSON responses
3. Add to feature's `getEndpoints()` list
4. REST endpoints are automatically registered by `ApiServer`

### New Database Table

1. Add CREATE TABLE statement to `discord-bot/src/database/index.js`
2. Create a new file in `discord-bot/src/database/` with CRUD methods:
   - Constructor takes a `db` instance (from `getDb()`)
   - All queries use `db.prepare(...).run()`, `.get()`, or `.all()`
   - All queries use parameterized placeholders (`?`)
3. Add ALTER TABLE migration in the `migrateColumns` section for existing databases

## Security Review Process

Before merging any change that touches:

1. **Authentication** — Verify API key comparison is constant-time
2. **Input validation** — Verify all external inputs are validated on both bot and plugin
3. **Database** — Verify parameterized queries (no string interpolation)
4. **Network** — Verify SSRF protection (private IP, DNS rebinding checks)
5. **Credentials** — Verify no secrets committed (config.json, .env in .gitignore)
6. **Permissions** — Verify Discord permission checks for admin commands

## Release Workflow

```
1. Feature development on branch
   ↓
2. Code review (self-review via diff)
   ↓
3. Run tests: npm test + mvn clean package
   ↓
4. Run lint: npm run lint
   ↓
5. Merge to main via PR
   ↓
6. GitHub Actions auto-deploys to VPS
   ↓
7. Verify: sudo journalctl -u whitelist-bot -n 20
```

## Bug-Fix Workflow

```
1. Reproduce the bug
   ↓
2. Identify the root cause
   ↓
3. Write a failing test (if applicable)
   ↓
4. Fix the code
   ↓
5. Verify the test passes
   ↓
6. Run full test suite
   ↓
7. Push to main (auto-deploys)
   ↓
8. Verify fix in production
```

### Bug Classification

| Severity | Response | Example |
|----------|----------|---------|
| Critical | Immediate fix, hotfix branch | Bot crashes on startup, plugin crashes server |
| High | Fix within 24 hours | Whitelist not working, pairing broken |
| Medium | Fix within current milestone | Incorrect error message, missing validation |
| Low | Fix when time permits | Cosmetic issue, non-critical edge case |

## Backward Compatibility Expectations

### Database

- New columns are added via ALTER TABLE, never dropped
- Old column values are preserved
- Migration code handles missing columns gracefully (try/catch on ALTER TABLE)

### API Endpoints

- Existing endpoints never change method, path, or response format
- New fields in responses are additive (clients ignore unknown fields)
- Endpoint deprecation: add warning header, keep endpoint for 3 months, then remove

### Discord Commands

- Command names and arguments never change
- New arguments are optional with sensible defaults
- Deprecated commands remain registered but show a deprecation notice

### Configuration

- Config file format never changes without migration
- Old config values are read and respected
- Environment variable names never change
- New config options have sensible defaults

## Cross-Reference

For detailed architecture documentation, see [docs/architecture/architecture.md](../architecture/architecture.md).
For deployment procedures, see [docs/deployment/deployment.md](../deployment/deployment.md).
For security guidelines, see [docs/security/security.md](../security/security.md).
For development standards, see [docs/standards/development-standards.md](../standards/development-standards.md).
