# Watcher — Development Guide

## Project Structure

```
src/
  cli.ts                          Entry point. `watcher init` subcommand + unified Ink TUI
  index.ts                        Public exports

  ai/                             AI provider abstraction layer
    AIProvider.ts                 Abstract base class (strategy pattern)
    AIProviderFactory.ts          Factory: creates provider by name
    OpenRouterProvider.ts         OpenRouter API (Claude, GPT-4, Gemini, Llama)
    GroqProvider.ts               Groq API (fast Llama inference)
    BedrockProvider.ts            AWS Bedrock (SigV4 + Converse API)
    SemanticAnalyzer.ts           AI-powered code change analysis
    modelFetcher.ts               Fetches available models from provider APIs

  modes/                          Interactive application modes
    app.ts                        Unified TUI app (chat + watch combined)
    chatTools.ts                  Repository inspection tools (git, fs, shell)
    sessionManager.ts             Multi-session manager with persistence

  tui/                            Terminal UI (Ink + React)
    App.tsx                       Main Ink application component
    theme.ts                      Color palette + semantic aliases
    formatters.ts                 Markdown → terminal formatting
    components/
      Banner.tsx                  ASCII art banner with project context
      ChatView.tsx                Scrollable message list + markdown rendering
      InputArea.tsx               Text input (ink-text-input wrapper)
      CommandPalette.tsx          Hierarchical slash-command palette
      SidePanel.tsx               Right-side status/activity/token panel
      StatusBar.tsx               Bottom status bar
      ConfigEditor.tsx            Interactive config editor

  commands/                       CLI subcommands
    init.ts                       `watcher init` — local project initialization
    watch.ts                      `watcher watch` — standalone watch mode (legacy)
    report.ts                     `watcher report` — generate reports
    insights.ts                   `watcher insights` — analytics dashboard
    config.ts                     `watcher config` — manage keys/models/providers
    daemon.ts                     `watcher daemon` — background service

  config/ConfigManager.ts         Global config (~/.watcher/config.json)
  credentials/CredentialManager.ts AES-256-CBC encrypted API key storage
  database/Database.ts            SQLite via sql.js (WASM)
  monitor/FileMonitor.ts          chokidar-based file watcher
  git/GitService.ts               Git CLI wrapper

  documentation/
    ProgressGenerator.ts          Auto-generates PROGRESS.md
    ChangelogGenerator.ts         Auto-generates CHANGELOG.md

  analytics/
    AnalyticsEngine.ts            Velocity metrics, file hotspots, timeline
    TechnicalDebtTracker.ts       Large files, TODO/FIXME scanning

  daemon/
    daemon.ts                     Background Node.js process
    daemonRegistry.ts             Global project registry
    autostart.ts                  OS-level auto-start

  types/
    index.ts                      WatcherConfig, ProjectMetadata, etc.
    ai.ts                         AIProviderConfig, AIResponse

  ui/
    banner.ts                     Console ASCII banner (non-TUI)
    onboarding.ts                 First-run setup wizard

  utils/
    logger.ts                     Styled console logger with spinner
```

---

## Build System

| Tool | Purpose |
|------|---------|
| **esbuild** | Bundles TypeScript → ESM (~165kb), JSX automatic |
| **tsc** | Type-checking only (`noEmit: true`) |
| **Module** | ESM (`"type": "module"`, `"module": "ES2022"`) |
| **JSX** | `"jsx": "react-jsx"` — React 19 automatic runtime |

```bash
npm install          # install dependencies
npm run build        # esbuild → dist/cli.js
npx tsc --noEmit     # type-check (separate step)
npm link             # local testing as `watcher` command
```

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `commander` | CLI argument parsing |
| `inquirer` | Interactive prompts (onboarding) |
| `ink` + `react` | React-based TUI framework |
| `ink-text-input` | Text input component |
| `ink-spinner` | Animated spinner |
| `chalk` | Terminal colors |
| `chokidar` | File system watching |
| `sql.js` | SQLite in pure JS (WASM) |
| `blessed` | Legacy TUI for standalone watch mode |

---

## Configuration Files

| Path | Scope | Purpose |
|------|-------|---------|
| `~/.watcher/config.json` | Global | AI provider, model, features |
| `~/.watcher/.credentials` | Global | AES-256-CBC encrypted API keys |
| `~/.watcher/projects.json` | Global | Daemon project registry |
| `.watcher/watcher.db` | Per-project | Change history (SQLite) |
| `.watcher/sessions/*.json` | Per-project | Chat session history |

---

## Key Patterns

1. **BYOK** — Users provide their own API keys. No code leaves the machine.
2. **Strategy pattern** — `AIProviderFactory.create()` picks the right provider.
3. **Ink + React TUI** — Components are `.tsx` files with React hooks. State changes trigger re-renders.
4. **Credential encryption** — `CredentialManager` derives key from `hostname + username`, encrypts with AES-256-CBC.
5. **sql.js** — WASM-based SQLite, no native compilation required.
6. **scrollBus pattern** — Mouse events are captured on `process.stdin` in `app.ts` (before Ink starts) and bridged into the React component via an `EventEmitter`, because Ink pauses stdin between renders.

---

## Testing Locally

```bash
npm run build
node dist/cli.js               # run directly
# or after npm link:
watcher                        # interactive mode
watcher init                   # initialize a project
```

---

## Publishing to npm

```bash
npm login
npm publish --access public
```

The package is published as `@kreonyx/watcher-cli` with the `watcher` binary.
