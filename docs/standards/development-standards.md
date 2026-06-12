# Development Standards

## Code Style

### General

- **Indentation:** 2 spaces (JavaScript), 4 spaces (Java)
- **Encoding:** UTF-8
- **Line endings:** LF (Unix)
- **Final newline:** Always
- **Trailing whitespace:** Strip (except Markdown)

### JavaScript

- **Quotes:** Single quotes (`'`) for strings, template literals (`` ` ``) for interpolation
- **Semicolons:** Required
- **Trailing commas:** Always where valid (objects, arrays, function params)
- **Print width:** 120 characters
- **Arrow functions:** Always use parentheses around parameters
- **Declarations:** Prefer `const`, use `let` only when reassigning

```javascript
// CORRECT
const getUser = (id) => users.find(u => u.id === id);
const config = {
  host: 'localhost',
  port: 25252,
};

// INCORRECT
var user = getUser(id)
let config = {host: 'localhost', port: 25252}
```

### Java

- **Indentation:** 4 spaces
- **Braces:** Egyptian style (opening brace on same line)
- **Naming:** camelCase for methods/variables, PascalCase for classes, UPPER_SNAKE for constants
- **Visibility:** Prefer `private`; use `public` only when needed

```java
// CORRECT
public class WhitelistManager {
    private final Map<String, Boolean> whitelist = new ConcurrentHashMap<>();

    public boolean addPlayer(String player) {
        // ...
    }
}
```

## Naming Conventions

| Concept | Convention | Example |
|---------|------------|---------|
| JavaScript files | kebab-case | `cleanupService.js`, `tunnel-server.js` |
| Class names (JS) | PascalCase | `CommandHandler`, `TunnelServer` |
| Functions/variables (JS) | camelCase | `loadCommands()`, `guildConfig` |
| Constants (JS) | UPPER_SNAKE or const | `FETCH_TIMEOUT`, `PREFIX` |
| Java files | PascalCase | `WhitelistBotPlugin.java` |
| Classes (Java) | PascalCase | `PairingManager` |
| Methods (Java) | camelCase | `getEndpoints()`, `onEnable()` |
| Fields (Java) | camelCase | `apiServer`, `featureManager` |
| Constants (Java) | UPPER_SNAKE | `CHARS`, `CODE_LENGTH` |
| API endpoints | kebab-case with `/api/` prefix | `/api/whitelist/add` |

## Error Handling

### JavaScript

- Always use `try/catch` around async operations
- Log errors with the logger, never `console.log` directly
- Return user-friendly error messages for Discord interactions
- Exit process (1) on unrecoverable errors (missing config, DB corruption)

```javascript
// CORRECT
try {
  const result = await apiClient.post(endpoint, guildConfig, body);
  return result;
} catch (err) {
  logger.error('WhitelistHandler', 'Failed to whitelist player', err);
  return { success: false, error: 'Server unreachable. Please try again.' };
}
```

### Java

- Catch specific exceptions, never generic `Exception` unless at top-level handler
- Log exceptions with `plugin.getLogger()` at appropriate level (`warning` for recoverable, `severe` for fatal)
- Return structured JSON error responses from API endpoints

```java
// CORRECT
try {
    JsonObject req = parseBody(exchange);
    // ...
} catch (IOException e) {
    plugin.getLogger().log(Level.WARNING, "Error in whitelist/add", e);
    sendError(exchange, 500, "Internal server error");
}
```

## Logging

### Format

```
[2026-06-12 16:33:29] [LEVEL] [Component] Message
[2026-06-12 16:33:29] [LEVEL] [Component] Message — error details
```

### Levels

| Level | When | Component Examples |
|-------|------|-------------------|
| `INFO` | Normal operations (startup, shutdown, pairing) | Bot, ApiClient, Tunnel |
| `WARN` | Recoverable issues (auth failure, disconnect, timeout) | Feature, TunnelClient |
| `ERROR` | Unrecoverable or unexpected failures | Database, Config |

### Rules

- Every service/class logs with a consistent component name
- Errors include the exception object (not just `err.message`)
- Security events (auth failures, SSRF blocks) are logged at WARN
- Never log API keys, tokens, or secrets

## Testing

### JavaScript (Jest)

- Tests live in `discord-bot/test/` mirroring `src/` structure
- Use `jest.isolateModules()` for config-dependent tests
- Clear mocks between tests (`clearMocks: true`, `restoreMocks: true` in Jest config)
- Test files: `*.test.js`

### Java (Maven)

- Tests live in `src/test/java/` (standard Maven layout)
- Run with `mvn clean package` (includes tests) or `mvn clean package -DskipTests` (skip tests)

### Coverage

- Aim for >70% coverage on business logic
- Infrastructure/glue code does not require tests
- Run `npm run test:coverage` before deployment

## Security Requirements

1. **No hardcoded secrets** — All credentials via env vars or config files
2. **No committed secrets** — API keys, tokens in `.gitignore`
3. **Parameterized SQL** — Never string-interpolate SQL queries
4. **Input validation** — All external input validated (MC usernames, hostnames, ports)
5. **Constant-time comparison** — API key comparisons use XOR
6. **SSRF protection** — Block private IPs and DNS rebinding domains
7. **Timeouts** — All external requests have timeouts (10s bot, 5s plugin)
8. **Thread safety** — `ConcurrentHashMap`, `volatile`, `synchronized` in plugin

## Performance Requirements

1. **Plugin API handlers** — Must not block the main server thread. All handler logic runs async
2. **Bukkit API calls** — Must use `callSyncMethod()` from async contexts
3. **HTTP timeouts** — 10 seconds on bot side, 5 seconds on plugin side
4. **Thread pool** — Plugin HTTP server uses exactly 10 threads
5. **SQLite** — WAL mode enabled. No long-running transactions
6. **Background tasks** — Run every 5 minutes, not more frequently
7. **Discord API** — Respect rate limits. No burst command registrations

## Documentation Requirements

1. **AGENTS.md** — Always kept current. Primary AI entry point
2. **README.md** — User-facing. Features, quick start, commands
3. **`docs/`** — Architecture, deployment, security, standards, methodology
4. **Code comments** — Minimal. Explain WHY not WHAT. No obvious comments

```javascript
// GOOD — explains non-obvious design decision
// Use tunnel first because Pterodactyl containers can't expose custom ports

// BAD — states the obvious
// This function adds a player to the whitelist
```

## Pull Request Expectations

1. **One feature per PR** — No scope creep
2. **Backward compatible** — Existing pairings, commands, and data must not break
3. **Tests pass** — Run `npm test` before submitting
4. **Lint clean** — Run `npm run lint` before submitting
5. **No secrets** — Verify no tokens in code or diffs
6. **Descriptive title** — What changed and why

## Release Expectations

1. **Version bump** — Update version in `package.json` and `pom.xml`
2. **CHANGELOG** — Note significant changes
3. **Deploy** — Push to `main` triggers auto-deploy
4. **Verify** — Check VPS logs after deploy: `sudo journalctl -u whitelist-bot -n 20`

## Git Conventions

### Commit Messages

```
type: Short description (50 chars max)

Optional longer description with context.

- Bullet points for multiple changes
```

Types: `fix`, `feat`, `chore`, `docs`, `refactor`, `test`, `security`

### Branch Strategy

- `main` — Production. Auto-deploys
- Feature branches — Branch from `main`, merge back via PR

### .gitignore Rules

See `.gitignore` at repository root. Key entries:
- `node_modules/` — Node.js dependencies
- `target/` — Maven build output
- `*.jar` — Plugin JARs
- `*.db` — SQLite databases
- `config.json` — Bot credentials
- `.env` — Environment secrets
