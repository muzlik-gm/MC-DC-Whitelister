# Technology Stack

## Overview

MC-DC-Whitelister uses a deliberately minimal technology stack. Zero external infrastructure dependencies — no Docker, no Redis, no PostgreSQL, no proxy servers. The entire system runs on a single $0/month VPS plus the Minecraft game server.

---

## Discord Integration

### discord.js v14

**Why:** The de facto standard Node.js library for Discord bot development. Provides full access to Discord's REST API, Gateway (WebSocket), slash commands, interactions, and permission system.

**Responsibility:**
- Gateway connection to Discord (message streams, events)
- Slash command registration via REST API
- Interaction handling (commands, buttons, select menus)
- Guild member tracking (joins, roles)
- Message construction (embeds, components)

**Best Practices:**
- Use `GatewayIntentBits` explicitly (only intents actually needed)
- Prefer `SlashCommandBuilder` for command definitions
- Use `REST` for command deployment (separate from runtime)
- Handle `interactionCreate` events for all interaction types
- Use `AbortController` for timeouts on outbound requests

---

## Backend (Discord Bot)

### Node.js 18+

**Why:** Required for the `fetch` API (native in Node 18+). The bot uses `fetch` for all HTTP communication with the Minecraft plugin. Also provides stable `AbortController`, `crypto`, and modern ES2023 features.

**Responsibility:**
- Runtime for the Discord bot
- HTTP client for plugin communication
- WebSocket server for tunnel mode

**Best Practices:**
- Use `node >=18.0.0` (enforced in `package.json` engines)
- Prefer `require()` (CommonJS) for consistency across the codebase
- Use `fs` and `path` for filesystem operations
- Use `AbortController` for all HTTP timeouts

### JavaScript (ES2023)

**Why:** The project uses JavaScript (not TypeScript) for simplicity and reduced build complexity. The codebase is small enough that type safety is achieved through testing and linting.

**Responsibility:**
- All Discord bot source code
- Configuration files
- Test files

**Best Practices:**
- Use `'use strict'` implicitly via ES modules / eslint
- Prefer `const` over `let`
- Use `async/await` for asynchronous code
- Destructure objects in function parameters
- Use JSDoc comments for complex functions (sparingly)

### better-sqlite3

**Why:** Synchronous SQLite driver for Node.js. Chosen over `sql.js` (slow) and `sqlite3` (callback-based) for its synchronous API that simplifies database access patterns. WAL mode provides concurrent read performance.

**Responsibility:**
- All persistent data storage
- Guild configurations
- Whitelist mappings
- Moderation records
- Community features (events, reputation, referrals)

**Best Practices:**
- Enable WAL mode: `db.pragma('journal_mode = WAL')`
- Enable foreign keys: `db.pragma('foreign_keys = ON')`
- Use parameterized queries (`?` placeholders)
- Use transactions for multi-step operations
- Separating table operations into individual modules (`src/database/*.js`)

### ws (WebSocket)

**Why:** Lightweight WebSocket library for Node.js. Used for the reverse tunnel server that allows Pterodactyl-hosted Minecraft servers to connect to the bot.

**Responsibility:**
- WebSocket server (port 9000) for plugin tunnel connections
- Message correlation via UUIDs
- Request/response routing between bot and plugin

### dotenv

**Why:** Loads `.env` files into `process.env`. Used as part of the config cascade for local development.

**Responsibility:**
- Loading environment variables from `.env` file (fallback from actual env vars)

---

## Plugin (Minecraft)

### Java 17

**Why:** Required by Paper API 1.20.4. Java 17 LTS provides modern language features (records, sealed classes, pattern matching) while maintaining compatibility.

**Responsibility:**
- All Minecraft plugin source code
- HTTP server implementation
- Bukkit API integration

### Maven

**Why:** Standard Java build tool. `pom.xml` manages dependencies, build lifecycle, and shading.

**Responsibility:**
- Dependency management
- Build automation
- Shading (bundling) of WebSocket library into final JAR

### Paper API 1.20.4

**Why:** The most widely used Minecraft server software for plugin development. Paper provides performance optimizations over Spigot/Bukkit and a comprehensive API.

**Responsibility:**
- All Minecraft server operations (whitelist, player management, commands)
- Event listeners (player join, leave, advancement, death)
- Scheduler for async-to-sync bridging

**Best Practices:**
- Always use `callSyncMethod()` for Bukkit API calls from async contexts
- Use `runTaskAsynchronously()` for non-Bukkit operations
- Use `runTaskTimer()` for periodic tasks
- Register event listeners in `onEnable()`

### Java-WebSocket 1.5.7

**Why:** Lightweight WebSocket client library for Java. Used by TunnelClient to connect outbound to the bot's tunnel server.

**Responsibility:**
- WebSocket client connection to VPS tunnel server
- Authentication handshake
- Message sending/receiving
- Auto-reconnect on disconnect

### Gson

**Why:** Bundled with the JDK's `com.sun.net.httpserver` HTTP server. Used for JSON serialization/deserialization in all API handlers.

**Responsibility:**
- Parsing incoming JSON requests
- Serializing JSON responses

---

## Infrastructure

### GitHub Actions

**Why:** CI/CD pipeline that auto-deploys the bot on every push to `main`.

**Responsibility:**
- Trigger on push to `main`
- SSH into VPS via appleboy/ssh-action
- Execute deploy commands
- Verify deployment health

### SSH

**Why:** Secure remote access to the VPS. Used by both GitHub Actions and manual deployment.

**Responsibility:**
- GitHub Actions deployment
- Manual administration
- Log inspection

### Ubuntu (Linux)

**Why:** Standard server operating system. Free-tier Oracle VPS runs Ubuntu.

**Responsibility:**
- Host all bot processes
- systemd service management
- Firewall (UFW) configuration

### systemd

**Why:** Linux init system that manages the bot process. Provides auto-start on boot, crash recovery, and log management.

**Responsibility:**
- Start bot on system boot
- Restart bot on crash (5-second delay)
- Log management via journald
- Service status monitoring

### UFW (Firewall)

**Why:** Simple firewall management for Ubuntu.

**Configuration:**
- Port 22/tcp (SSH) — typically open by default
- Port 9000/tcp (WebSocket tunnel) — open for MC server connections

---

## Networking

### HTTP

**Why:** Standard REST API protocol for bot↔plugin communication in direct mode.

**Port:** 25252 (configurable)
**Auth:** X-API-Key header
**Timeouts:** 10s (bot), 5s (plugin)

### WebSocket

**Why:** Persistent bidirectional connection for tunnel mode. Allows the plugin (behind Pterodactyl's firewall) to connect outbound to the bot.

**Port:** 9000 (configurable via TUNNEL_PORT)
**Auth:** JSON message with `api_key` on connect
**Protocol:** JSON request/response with correlation IDs

---

## Testing

### Jest

**Why:** Standard JavaScript testing framework. Chosen for its zero-config setup, built-in mocking, and coverage reporting.

**Responsibility:**
- Unit tests for bot modules
- Integration tests for services

### Sinon

**Why:** Standalone test doubles (spies, stubs, mocks) for Jest. Used when Jest's built-in mocking is insufficient.

### ESLint

**Why:** Code quality and consistency enforcement.

**Configuration:**
- Node.js + ES2023 environment
- Recommended ruleset
- Unused vars warned (not error) when prefixed with `_`

### Prettier

**Why:** Code formatting. Consistent style without debate.

**Configuration:**
- Single quotes
- Semicolons
- Trailing commas
- 120 print width
- 2 space indentation
