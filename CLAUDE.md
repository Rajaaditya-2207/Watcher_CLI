# CLAUDE.md -- Watcher CLI

## Project Overview

**Watcher** is a CLI-based development observer that translates code changes into human-readable narratives. It acts as a silent technical writer -- monitoring codebases in real-time, analyzing changes via AI, and auto-generating documentation.

- **Team:** KREONYX
- **Author:** Rajaaditya. R
- **License:** MIT
- **Runtime:** Node.js >=16, TypeScript

---

## Architecture

```
src/
  cli.ts                          <- Entry point. Only `watcher init` subcommand remains;
                                     everything else launches the unified Ink TUI.
  index.ts                        Public exports for library usage.

  ai/                             AI provider abstraction layer
    AIProvider.ts                 Abstract base class (strategy pattern)
    AIProviderFactory.ts          Factory: creates provider by name
    OpenRouterProvider.ts         OpenRouter API (Claude, GPT-4, Gemini, Llama)
                                  Detects data-policy 404 and emits actionable error message.
    GroqProvider.ts               Groq API (fast Llama inference)
    BedrockProvider.ts            AWS Bedrock (SigV4 + Converse API; requires AWS credentials in env)
    SemanticAnalyzer.ts           AI-powered code change analysis -> JSON
    modelFetcher.ts               Fetches available models from provider APIs

  modes/                          Interactive application modes
    app.ts                        Unified TUI app (chat + watch combined)
    chatMode.ts                   Standalone chat mode (legacy, unused in main flow)
    chatTools.ts                  Repository inspection tools (git, fs, shell)
    sessionManager.ts             Multi-session manager with persistence

  tui/                            Terminal UI (Ink + React)
    App.tsx                       Main Ink application component + renderApp()
    theme.ts                      Color palette + semantic aliases
    formatters.ts                 Markdown -> terminal formatting (non-TUI)
    components/
      Banner.tsx                  ASCII art banner with project context
      ChatView.tsx                Scrollable message list + left-border accent
      InputArea.tsx               Text input (ink-text-input wrapper)
      CommandPalette.tsx          Hierarchical slash-command palette (sub-command mode)
      SidePanel.tsx               Right-side status/activity/token panel
      StatusBar.tsx               Bottom status bar (mode + model + shortcuts)
      ConfigEditor.tsx            Interactive config editor (keyboard-driven, replaces chat view)
    Screen.ts                     [Legacy] blessed screen manager (used by watch.ts)
    widgets/                      [Legacy] blessed widgets (used by watch.ts)
      Banner.ts, InputBox.ts, MessageList.ts, CommandPalette.ts, SidePanel.ts, StatusBar.ts

  commands/                       CLI subcommands
    init.ts                       `watcher init` -- project initialization (only remaining subcommand)
    watch.ts                      `watcher watch` -- standalone watch mode (legacy TUI)
    report.ts                     `watcher report` -- generate reports (md/json)
    insights.ts                   `watcher insights` -- analytics dashboard
    config.ts                     `watcher config` -- manage keys/models/providers
    daemon.ts                     `watcher daemon` -- background service management

  config/ConfigManager.ts         ~/.watcher/config.json read/write (global)
  credentials/CredentialManager.ts AES-256-CBC encrypted API key storage (global, ~/.watcher/.credentials)
  database/Database.ts            SQLite via sql.js (WASM, no native deps)
  monitor/FileMonitor.ts          chokidar-based file watcher
  git/GitService.ts               Git CLI wrapper (branch, status, diff)

  documentation/
    ProgressGenerator.ts          Auto-generates PROGRESS.md
    ChangelogGenerator.ts         Auto-generates CHANGELOG.md

  analytics/
    AnalyticsEngine.ts            Velocity metrics, file hotspots, timeline
    TechnicalDebtTracker.ts       Scans for large files, TODO/FIXME comments

  daemon/
    daemon.ts                     Background Node.js process for monitoring
    daemonRegistry.ts             Global project registry (~/.watcher/projects.json)
    autostart.ts                  OS-level auto-start (Windows/macOS/Linux)

  types/
    index.ts                      WatcherConfig, ProjectMetadata, etc.
    ai.ts                         AIProviderConfig, AIResponse, SemanticAnalysis

  ui/
    banner.ts                     Console ASCII banner (non-TUI)
    onboarding.ts                 First-run setup wizard

  utils/
    logger.ts                     Styled console logger with spinner
```

---

## Key Flows

### First Run (`watcher` with no args, no global config)
1. `cli.ts:main()` detects no subcommand
2. Global config (`~/.watcher/config.json`) does not exist -> `displayBanner()` + `runOnboarding()`
3. Onboarding (9 steps): select provider -> enter API key (skipped for Bedrock) -> pick model -> watch interval -> feature toggles (autoDoc/techDebt/analytics) -> report settings -> show summary -> confirm -> save global config + global credentials + init local project DB
4. `runUnifiedApp()` launches the Ink TUI with chat + watch combined

### Subsequent Runs in the Same Repo (`watcher` with existing global config)
1. `cli.ts:main()` -> global config exists -> skip onboarding
2. `runUnifiedApp(projectPath)` loads global config + global credentials
3. Local `.watcher/watcher.db` and `.watcher/sessions/` are created/used per-project
4. Local DB project record upserted on every launch (idempotent)
5. `app.ts` creates services (DB, tools, git, session) then calls `renderApp()`
6. `App.tsx` renders Ink components: Banner -> ChatView + SidePanel + StatusBar
7. FileMonitor starts in a useEffect hook for real-time change detection
8. User types in InputArea -> slash commands or AI queries via useInput

### Opening a NEW Repo (global config already set)
1. `watcher` in new project directory
2. Global config exists -> skip onboarding
3. `runUnifiedApp()` picks up global config/credentials immediately
4. Local `.watcher/watcher.db` is created fresh for this project
5. Project record inserted into local DB on first launch

### Subcommands
- `watcher init` -- register THIS project locally (init local DB + daemon registry entry). Global config must already exist (created by first-run onboarding). Does NOT modify `~/.watcher/config.json`.
- All other operations (`/report`, `/insights`, `/config`, `/daemon`, `/session`, etc.) are handled as slash commands inside the unified TUI.

---

## Build & Run

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript -> dist/ via esbuild (ESM, ~155kb)
node dist/cli.js     # Run directly
# or after npm link:
watcher              # Interactive mode
watcher init         # Initialize a project
```

## Build System

- **Bundler:** esbuild via `build.mjs` -- ESM format, JSX automatic, external packages, ~155kb output
- **Type checking:** `npx tsc --noEmit` (separate from build -- tsconfig has `"noEmit": true`)
- **Module system:** ESM (`"type": "module"`, `"module": "ES2022"`, `"moduleResolution": "bundler"`)
- **JSX:** `"jsx": "react-jsx"` -- React 19 automatic runtime

## Dependencies

| Package | Purpose |
|---------|---------|
| `commander` | CLI argument parsing |
| `inquirer` | Interactive prompts (onboarding) |
| `ink` + `react` | React-based TUI framework (main interactive mode) |
| `ink-text-input` | Text input component for Ink |
| `ink-spinner` | Animated spinner component for Ink |
| `chalk` | Terminal colors |
| `chokidar` | File system watching |
| `ora` | Spinners (used in non-TUI flows) |
| `boxen` | Boxed terminal output |
| `sql.js` | SQLite in pure JS (WASM) |
| `marked` + `marked-terminal` | Markdown rendering |
| `blessed` | [Legacy] Terminal UI for watch.ts standalone mode |

---

## Configuration

- **Config file:** `~/.watcher/config.json` (global — shared across all projects)
- **Credentials:** `~/.watcher/.credentials` (global — AES-256-CBC encrypted, machine-specific key)
- **Database:** `.watcher/watcher.db` (local per-project — SQLite via sql.js)
- **Sessions:** `.watcher/sessions/*.json` (local per-project — conversation history)
- **Daemon registry:** `~/.watcher/projects.json` (global)

### WatcherConfig shape
```typescript
{
  aiProvider: 'openrouter' | 'bedrock' | 'groq',
  model: string,
  keyAlias?: string,
  watchInterval: number,
  ignorePatterns: string[],
  features: { autoDocumentation, technicalDebt, analytics },
  reporting: { defaultFormat, includeMetrics }
}
```

---

## Slash Commands (inside TUI)

All config management and tool commands are integrated as slash commands. Typing a parent command alone
shows its sub-commands in the palette (hierarchical mode). Only two `/config` commands exist:

| Command | Description |
|---------|-------------|
| `/config` | View current configuration as a table |
| `/config edit` | Open the interactive ConfigEditor inside the chat area |
| `/search <pattern>` | Search project source files (uses grep/findstr) |
| `/report` | Generate project status report in chat |
| `/insights` | Development analytics (all time) |
| `/insights day\|week\|month` | Analytics for a specific period |
| `/watch` | Toggle file monitoring on/off |
| `/daemon status\|start\|stop` | Daemon management |
| `/session new\|list\|switch\|save` | Session management |
| `/status`, `/diff`, `/files` | Git/filesystem quick views |
| `/help` | List all commands |
| `/clear`, `/quit` | Utility commands |

---

## Important Patterns

1. **BYOK (Bring Your Own Key):** No code leaves the machine. Users provide their own API keys.

2. **Strategy pattern:** `AIProviderFactory.create()` picks the right provider class.

3. **Ink + React TUI architecture:** The main interactive mode uses Ink (React-based TUI framework). Components are `.tsx` files using React hooks (`useState`, `useEffect`, `useInput`). State changes trigger automatic re-renders -- no manual `screen.render()` calls needed.

4. **Credential encryption:** `CredentialManager` derives a key from `hostname + username`, encrypts with AES-256-CBC. The `keyAlias` field supports multiple named keys per provider.

5. **sql.js (not native SQLite):** Uses WASM-based SQLite -- no native compilation required.

6. **Mouse scroll + alt-screen setup:** The alt-screen `useEffect` in `App.tsx` also enables SGR mouse reporting (`\x1b[?1000h` + `\x1b[?1006h`). A `process.stdin` data listener parses incoming `ESC[<btn;x;yM` sequences: btn=64 scrolls up 3 lines, btn=65 scrolls down 3 lines, btn=0 (left click) triggers palette item selection via `handlePaletteClickRef`. All modes are disabled on unmount.

7. **Component layout:** `App.tsx` renders: `Box(column)` -> `Box(row)` [LeftPanel 70% + SidePanel 30%] -> StatusBar. LeftPanel shows one of: Banner (initial) | ConfigEditor | ChatView + CommandPalette + InputArea.

8. **ConfigEditor replaces ChatView:** When `configEditMode` state is true, the ConfigEditor component replaces the chat/input area entirely. CommandPalette and InputArea are hidden (`{!configEditMode && ...}`). On Save/Cancel, `configEditMode` returns to false.

9. **ConfigEditor fields:** aiProvider (enum cycle), model (live search against provider API), apiKey (secret input, staged until Save), watchInterval (number), autoDocumentation/technicalDebt/analytics (boolean toggles), defaultFormat (enum), includeMetrics (boolean). Navigation: Up/Down, Enter/Space to edit/toggle, Ctrl+S to save.

10. **Model search in ConfigEditor:** Pressing Enter on the Model field fetches all models from the provider API via `fetchModels(stagedKey?)`. The staged (typed-but-not-yet-saved) API key is passed first; if none is staged, falls back to the persisted key from `credentialManager`. Results are shown in a filterable list -- type to filter, Up/Dn to navigate, Enter to select, Esc to go back.

11. **Keyboard handling (useInput):** All keyboard shortcuts in `App.tsx`: Esc (stop AI response if thinking), Ctrl+C (stop AI response if thinking, otherwise shows "/quit to exit" hint — does NOT exit), Ctrl+L (clear), Ctrl+N (new session), Ctrl+A (list sessions), PageUp/Down (scroll 10 lines), Up/Down arrows (palette navigation or scroll 1 line when palette hidden), Tab (palette confirm), `/` prefix (command palette toggle). All shortcuts except Esc and Ctrl+C are blocked when ConfigEditor is open.

12. **Palette Enter-key race fix:** `paletteInterceptedRef` flag prevents the palette's Enter keypress from also triggering `handleSubmit` (both `useInput` and `ink-text-input` fire on Enter).

13. **Hierarchical command palette:** `CommandPalette.tsx` exports `PARENT_COMMANDS = ['config', 'session', 'daemon', 'insights']` and `getPaletteFiltered(commands, input)`. Typing an exact parent name (e.g. `/config`) switches to sub-command mode: a cyan breadcrumb header appears, only that parent's sub-commands are listed using their short label (e.g. `edit` instead of `config edit`). Both keyboard (arrows + Enter/Tab) and mouse click (left-click on any item row) select a command. `App.tsx` imports `getPaletteFiltered` and uses it in both the `useInput` handler and the `handlePaletteClickRef`.

14. **Auto-scroll to bottom:** `setScrollOffset(Number.MAX_SAFE_INTEGER)` is used whenever a new message is sent or received. `ChatView` clamps the offset to `maxScroll = max(0, totalLines - height)`, so `MAX_SAFE_INTEGER` always lands at the bottom. `setScrollOffset(0)` is only used for `/clear`.

15. **ANSI bleed reset:** `padBg()` in `ChatView.tsx` appends `\x1b[0m` (full ANSI reset) after every rendered line. This prevents bold, italic, or color sequences opened by chalk from bleeding into adjacent lines, since terminals maintain ANSI state globally across lines.

16. **Agentic loop (AI tool access):** `handleSubmit` runs an agentic loop (up to 5 rounds). The AI can emit `[TOOL_CALL: /command]` lines to invoke internal Watcher commands. Results are fed back into the conversation. `executeToolForAI()` handles all commands: `/status`, `/diff`, `/files`, `/search <pattern>`, `/report`, `/insights [day|week|month]`, `/config`, `/daemon status`, `summary`, `cat <file>`, `search <pattern>` (cross-platform grep), `run <cmd>`.

17. **OpenRouter data-policy error:** `OpenRouterProvider` catches 404 responses containing "data policy" / "No endpoints found" and emits a clear user-facing message pointing to `https://openrouter.ai/settings/privacy` and suggesting `/config edit`.

18. **Message rendering -- left-border accent:** Messages use a left-border colored by role. `ChatView.tsx` handles markdown formatting (headings, code blocks, lists, blockquotes, inline: `**bold**`, `*italic*`, `_italic_`, `` `code` ``, `~~strikethrough~~`, `[links]()`) using chalk.

19. **Token/cost in side panel:** Token usage, session name, and estimated cost are displayed in SidePanel. StatusBar shows only mode, model name, provider, and shortcut hints.

20. **Session management:** `SessionManager` supports multiple named sessions persisted as JSON files. Auto-named from the first user message. Commands: `/session new [name]`, `/session list`, `/session switch <id>`, `/session save`. Auto-saved on Ctrl+C exit.

21. **Thinking indicator:** `ink-spinner` (dots) shown at the bottom of ChatView while waiting for AI response, controlled by `isThinking` state.

22. **File monitoring via useEffect:** `App.tsx` creates `FileMonitor` in a `useEffect` hook. Detected changes are auto-analyzed by `SemanticAnalyzer` when `autoDocumentation` is enabled. Results are logged to the activity log and database.

23. **Separation of concerns (app.ts vs App.tsx):** `app.ts` handles pre-TUI setup (config loading, API key prompting, service creation) then calls `renderApp()`. `App.tsx` owns all TUI state and rendering.

24. **ASCII-only string literals in ConfigEditor:** All UI strings use ASCII characters only (`>` not a Unicode arrow, `---` not box-drawing chars, `|` not a dot) to ensure correct rendering in Windows CMD/PowerShell without encoding issues.

25. **Bedrock API-key recovery prompt:** The fallback `if (!apiKey)` block in `app.ts` skips Bedrock (`config.aiProvider !== 'bedrock'`) because Bedrock uses AWS env-var credentials, not a stored API key. For all other providers this block prompts the user once if the credential file was manually deleted or corrupted.

27. **Abort AI response:** Each `handleSubmit` call creates a fresh `AbortController` stored in `abortControllerRef`. Pressing Esc or Ctrl+C while the AI is thinking aborts the in-flight `fetch()` via the signal passed to `provider.analyze()`. The catch block detects `error.name === 'AbortError'` and shows `_Response stopped._` without saving the partial response to the session history.

28. **Ctrl+C no longer exits:** `exitOnCtrlC: false` is set in the Ink `render()` options. The `Ctrl+C` key handler in `useInput` no longer calls `exit()` — it either aborts the AI (if thinking) or shows "Use /quit to exit Watcher." Only `/quit` or `/exit` slash commands will exit.

26. **ConfigEditor keyboard isolation:** `useInput` in `App.tsx` has a `if (configEditMode) return;` guard placed after Ctrl+C but before all other shortcuts (Ctrl+L/N/A, PageUp/Down, arrow scroll). This prevents destructive shortcuts from firing while the config editor is open. Esc and Ctrl+C still work globally.

26. **System prompt tool table:** The agent system prompt in `getSystemPrompt()` contains a full markdown table of all available tool commands and strict rules: "use tools first, answer second", "never fabricate data", "multiple tool calls allowed in one response". The agent is expected to call tools proactively for any question about live repo state.

---

## Known Limitations

- The blessed TUI (`watch.ts` standalone mode) does not support mouse-based text selection; use keyboard shortcuts.
- `FileMonitor` watches the entire project tree; very large repos may need tuned `ignorePatterns`.
- **AWS Bedrock** requires `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` environment variables. The IAM user/role must have `bedrock:InvokeModel` permission and the target model must be enabled in the Bedrock console.
- Mouse click palette selection accuracy depends on the terminal emulator's SGR mouse coordinate origin. Keyboard selection (arrows + Enter) is always reliable.

---

## Debugging Tips

- Set `DEBUG=1` environment variable to see full stack traces on fatal errors.
- If the terminal gets stuck in alternate buffer after a crash, press `Ctrl+C` or run `reset` in the terminal.
- The main error handler in `cli.ts` writes escape sequences to restore the terminal on crash.
- Check `.watcher/watcher.db` with any SQLite viewer to inspect change history.
- Daemon logs are at the path shown by `/daemon status` inside the TUI.
- On Windows, always write `.tsx`/`.ts` files via `[System.IO.File]::WriteAllText(..., [System.Text.Encoding]::UTF8)` to avoid PowerShell encoding from mangling UTF-8 characters in source files.