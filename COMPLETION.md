# Watcher — Project Completion Report

**Team:** KREONYX
**Author:** Rajaaditya. R
**License:** MIT

---

## Overview

Watcher is a CLI-based development observer that translates code changes into human-readable narratives. It monitors codebases in real-time, analyzes changes via AI, and auto-generates documentation — acting as a silent technical writer for your project.

---

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| CLI | Commander.js | Argument parsing, subcommands |
| TUI | Ink + React 19 | Interactive terminal UI |
| AI | OpenRouter / Groq / AWS Bedrock | Code analysis, chat |
| Database | sql.js (WASM SQLite) | Change history |
| Monitoring | chokidar | Real-time file watching |
| Git | Git CLI wrapper | Branch, status, diff |
| Encryption | AES-256-CBC | API key storage |

### Data Flow

```
File Change → FileMonitor (chokidar)
  → SemanticAnalyzer (AI provider)
  → Database (sql.js)
  → ProgressGenerator / ChangelogGenerator
```

### TUI Component Tree

```
App.tsx
  ├── Banner.tsx              (initial view)
  ├── ConfigEditor.tsx        (replaces chat when editing config)
  ├── ChatView.tsx            (scrollable messages + markdown)
  │   └── ink-spinner         (thinking indicator)
  ├── CommandPalette.tsx       (hierarchical slash commands)
  ├── InputArea.tsx            (text input)
  ├── SidePanel.tsx            (status, activity, tokens)
  └── StatusBar.tsx            (mode, model, shortcuts)
```

---

## Features Delivered

### Core
- [x] Real-time file monitoring with configurable ignore patterns
- [x] AI-powered semantic analysis of code changes
- [x] Auto-generated PROGRESS.md and CHANGELOG.md
- [x] SQLite change history (WASM, no native deps)

### AI Integration
- [x] Multi-provider support (AWS Bedrock, OpenRouter, Groq)
- [x] BYOK — users provide their own API keys
- [x] Model selection with live search against provider APIs
- [x] Agentic tool-calling loop (up to 5 rounds per query)
- [x] Abort in-flight AI responses (Esc / Ctrl+C)

### Interactive TUI
- [x] Ink + React 19 terminal UI with full keyboard navigation
- [x] Mouse scroll support (scrollBus EventEmitter architecture)
- [x] Hierarchical slash-command palette (keyboard + mouse click)
- [x] Interactive ConfigEditor (replaces chat view)
- [x] Multi-session management with auto-save
- [x] Markdown rendering (headings, code blocks, bold, italic, links)
- [x] Left-border message accents by role
- [x] Token usage and cost tracking in side panel

### Developer Tools (Slash Commands)
- [x] `/search <pattern>` — cross-platform project search
- [x] `/report` — generate project status report
- [x] `/insights [day|week|month]` — development analytics
- [x] `/config` / `/config edit` — view and edit configuration
- [x] `/watch` — toggle file monitoring
- [x] `/daemon status|start|stop` — background daemon
- [x] `/session new|list|switch|save` — session management
- [x] `/status`, `/diff`, `/files` — git/filesystem views

### Security
- [x] AES-256-CBC encrypted credential storage
- [x] Machine-specific encryption key (hostname + username)
- [x] Named key aliases (multiple keys per provider)
- [x] No data leaves the machine — BYOK model

### UX
- [x] First-run onboarding wizard (9-step guided setup)
- [x] Alt-screen buffer management (clean terminal on exit)
- [x] Ctrl+C shows hint instead of exiting (use `/quit`)
- [x] ASCII-only UI strings for Windows CMD/PowerShell compatibility

---

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Ink over blessed | React paradigm, hooks, automatic re-renders |
| sql.js over better-sqlite3 | No native compilation, WASM portability |
| Global config (`~/.watcher/`) | One setup, works across all projects |
| scrollBus EventEmitter | Ink pauses stdin between renders; pre-Ink listener survives |
| esbuild over tsc for build | ~165kb output, fast builds, ESM native |
| ASCII-only strings | Windows CMD/PowerShell encoding safety |

---

## Build Output

- **Bundle size:** ~165kb (esbuild, ESM)
- **TypeScript errors:** 0
- **Runtime:** Node.js >= 16
- **Binary:** `watcher` (via `npm link` or global install)

---

## Distribution

- **npm:** `npm install -g @kreonyx/watcher-cli`
- **GitHub:** [github.com/Rajaaditya-2207/Watcher_CLI](https://github.com/Rajaaditya-2207/Watcher_CLI)
- **Website:** [Rajaaditya-2207.github.io/Watcher_CLI](https://Rajaaditya-2207.github.io/Watcher_CLI)
