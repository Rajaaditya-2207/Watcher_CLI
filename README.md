<div align="center">

```diff
+ ██╗    ██╗ █████╗ ████████╗ ██████╗██╗  ██╗███████╗██████╗ 
+ ██║    ██║██╔══██╗╚══██╔══╝██╔════╝██║  ██║██╔════╝██╔══██╗
+ ██║ █╗ ██║███████║   ██║   ██║     ███████║█████╗  ██████╔╝
+ ██║███╗██║██╔══██║   ██║   ██║     ██╔══██║██╔══╝  ██╔══██╗
+ ╚███╔███╔╝██║  ██║   ██║   ╚██████╗██║  ██║███████╗██║  ██║
+  ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
```

**Silent Observer. Intelligent Documentation.**

[![npm version](https://img.shields.io/npm/v/@AdiRajaaditya/watcher-cli.svg?color=39FF14)](https://www.npmjs.com/package/@AdiRajaaditya/watcher-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-39FF14.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16-39FF14)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-39FF14.svg)](http://makeapullrequest.com)

**A CLI development observer that translates code changes into human-readable narratives.**
**Your AI-powered silent technical writer — right in the terminal.**

[Website](https://Rajaaditya-2207.github.io/Watcher_CLI) · [npm](https://www.npmjs.com/package/@AdiRajaaditya/watcher-cli) · [GitHub](https://github.com/Rajaaditya-2207/Watcher_CLI)

</div>

---

## Install

```bash
npm install -g @AdiRajaaditya/watcher-cli
```

Then run anywhere:

```bash
watcher
```

On first run, Watcher guides you through a one-time global setup:
1. **Select AI provider** — AWS Bedrock, OpenRouter, or Groq
2. **Enter API key** — encrypted with AES-256-CBC (skipped for Bedrock)
3. **Pick your model** — fetched live from the provider API
4. **Configure features** — auto-docs, tech debt, analytics

Your config is saved globally at `~/.watcher/config.json`. Every subsequent project just works.

---

## What is Watcher?

Watcher is your **silent technical writer**. It monitors your codebase in real-time, understands what you're building through AI-powered semantic analysis, and auto-generates documentation — all from a unified terminal UI.

### The Problem

- **Documentation Fatigue** — Developers spend hours writing progress reports
- **AI Context Loss** — Constantly re-explaining project context to AI assistants
- **Hidden Technical Debt** — Code issues accumulate silently
- **Team Visibility Gap** — Hard to track progress across contributors

### The Solution

- **80% reduction** in documentation time
- **Interactive AI agent** that knows your repository
- **Automated** progress logging, changelogs, and tech debt detection
- **100% privacy** — BYOK architecture, code never leaves your machine

---

## Features

| Feature | Description |
|---------|-------------|
| **Unified TUI** | Ink-based React terminal UI with chat, file monitoring, and config editing in one view |
| **AI Chat** | Ask questions about your codebase, git status, architecture — with agentic tool access |
| **Auto Documentation** | Maintains `PROGRESS.md` and `CHANGELOG.md` as you code |
| **Semantic Analysis** | AI understands architectural patterns, not just syntax diffs |
| **Multi-Provider** | AWS Bedrock, OpenRouter (Claude/GPT-4/Gemini/Llama), Groq |
| **Dynamic Models** | Fetches available models from your provider's API at runtime |
| **BYOK Privacy** | Bring Your Own Key — your code never leaves your machine |
| **Encrypted Credentials** | AES-256-CBC with machine-specific key derivation |
| **Development Analytics** | Velocity metrics, file hotspots, activity timelines |
| **Technical Debt** | Auto-scans for large files, TODO/FIXME/HACK |
| **Background Daemon** | Monitor projects even when no terminal is open |
| **Session Management** | Multiple named sessions, auto-save, switch between conversations |
| **Mouse Scroll** | SGR mouse support for scroll and click in the TUI |

---

## Slash Commands

All commands are available inside the unified TUI by typing `/`:

| Command | Description |
|---------|-------------|
| `/help` | List all commands |
| `/config` | View current configuration |
| `/config edit` | Interactive config editor (provider, model, keys, features) |
| `/search <pattern>` | Search project source files |
| `/report` | Generate project status report |
| `/insights` | Development analytics (all time) |
| `/insights day\|week\|month` | Analytics for a specific period |
| `/watch` | Toggle file monitoring on/off |
| `/daemon status\|start\|stop` | Background daemon management |
| `/session new\|list\|switch\|save` | Session management |
| `/status` `/diff` `/files` | Git/filesystem quick views |
| `/clear` `/quit` | Utility commands |

---

## How It Works

```
┌─────────────┐
│  Your Code  │
└──────┬──────┘
       │
       v
┌─────────────────┐
│ File Monitoring  │  ← Detects changes in real-time
└──────┬──────────┘
       │
       v
┌─────────────────┐
│  Git Analysis    │  ← Analyzes diffs and status
└──────┬──────────┘
       │
       v
┌─────────────────┐
│   AI Analysis    │  ← Semantic understanding via AI
└──────┬──────────┘
       │
       ├──→ PROGRESS.md     (Auto-updated)
       ├──→ CHANGELOG.md    (Auto-updated)
       ├──→ SQLite Database (Change history)
       └──→ Terminal TUI    (Interactive chat + monitoring)
```

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 16+ |
| Language | TypeScript |
| Bundler | esbuild (~165kb output) |
| TUI Framework | Ink + React 19 |
| CLI | Commander.js |
| Database | SQLite via sql.js (WASM, no native deps) |
| File Monitoring | Chokidar |
| AI Providers | OpenRouter, Groq, AWS Bedrock |
| Security | AES-256-CBC encrypted credentials |

---

## Configuration

Config is stored globally at `~/.watcher/config.json`:

```json
{
  "aiProvider": "bedrock",
  "model": "anthropic.claude-3-sonnet-20240229-v1:0",
  "watchInterval": 5000,
  "ignorePatterns": ["node_modules/**", "dist/**", ".git/**", "*.log"],
  "features": {
    "autoDocumentation": true,
    "technicalDebt": true,
    "analytics": true
  },
  "reporting": {
    "defaultFormat": "markdown",
    "includeMetrics": true
  }
}
```

| Path | Scope | Purpose |
|------|-------|---------|
| `~/.watcher/config.json` | Global | AI provider, model, features |
| `~/.watcher/.credentials` | Global | Encrypted API keys |
| `~/.watcher/projects.json` | Global | Daemon project registry |
| `.watcher/watcher.db` | Per-project | Change history (SQLite) |
| `.watcher/sessions/*.json` | Per-project | Chat session history |

---

## Privacy & Security

- **Code stays local** — only semantic diffs sent to AI, never raw source
- **BYOK** — you bring your own API keys, you control costs
- **Encrypted at rest** — AES-256-CBC with machine-specific key derivation
- **No telemetry** — zero tracking, zero data collection
- **Your cost:** $2-30/month based on usage. **Our cost:** $0

---

## Development

```bash
git clone https://github.com/Rajaaditya-2207/Watcher_CLI.git
cd watcher
npm install
npm run build        # esbuild → dist/
npx tsc --noEmit     # type-check (separate from build)
npm link             # test locally as `watcher`
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -m 'Add new feature'`)
4. Push (`git push origin feature/new-feature`)
5. Open a Pull Request

---

## Team

**KREONYX** — Built by Rajaaditya. R

---

## License

MIT — see [LICENSE](LICENSE) for details.
