# Watcher CLI — Development Guide

## Project Status: All Phases Complete

---

## Architecture

```
src/
  cli.ts                          Entry point with interactive flow
  index.ts                        Public exports
  ui/
    banner.ts                     Neon green ASCII art banner
    onboarding.ts                 First-run setup (provider, API key, model)
  ai/
    AIProvider.ts                 Abstract provider base class
    AIProviderFactory.ts          Factory pattern for provider creation
    OpenRouterProvider.ts         OpenRouter API integration
    GroqProvider.ts               Groq API integration
    BedrockProvider.ts            AWS Bedrock structure
    SemanticAnalyzer.ts           AI-powered code analysis engine
    modelFetcher.ts               Dynamic model listing from provider APIs
  commands/
    init.ts                       Project initialization
    watch.ts                      File monitoring with AI analysis
    report.ts                     Report generation (md/json)
    insights.ts                   Analytics and debt tracking
    config.ts                     Configuration management
  modes/
    chatMode.ts                   Interactive AI chat REPL
    chatTools.ts                  Repository inspection tools
    sessionManager.ts             Conversation and token tracking
  config/
    ConfigManager.ts              Configuration file management
  credentials/
    CredentialManager.ts          AES-256-CBC encrypted key storage
  database/
    Database.ts                   SQLite with full CRUD operations
  documentation/
    ProgressGenerator.ts          PROGRESS.md auto-generation
    ChangelogGenerator.ts         CHANGELOG.md auto-generation
  analytics/
    AnalyticsEngine.ts            Velocity and productivity metrics
    TechnicalDebtTracker.ts       Code health scanning
  daemon/
    daemon.ts                     Background monitoring process
    daemonRegistry.ts             Global project registry
    autostart.ts                  OS auto-start integration
  git/
    GitService.ts                 Git operations wrapper
  monitor/
    FileMonitor.ts                File system change detection
  types/
    index.ts                      Core TypeScript interfaces
    ai.ts                         AI-related type definitions
  utils/
    logger.ts                     Professional terminal output
```

## Installation and Setup

### Prerequisites
- Node.js >= 16.0.0
- Git (recommended)

### Development Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Link for local testing
npm link

# Now you can use 'watcher' command globally
watcher --version
```

## Usage

### Interactive Mode (Recommended)

```bash
# Run bare watcher for interactive flow
watcher
```

This will:
1. Display neon green ASCII banner
2. If first run: prompt for AI provider, API key, and model selection
3. Present mode selection: Chat Mode or Watch Mode

### Direct Commands

```bash
# Initialize project manually
watcher init

# Start file monitoring directly
watcher watch
watcher watch --verbose

# Generate reports
watcher report --format md
watcher report --format json --since 2024-01-01 --output report.json

# View analytics
watcher insights --period week
watcher insights --period month --metric debt

# Background daemon
watcher daemon start
watcher daemon stop
watcher daemon status
watcher daemon logs
watcher daemon enable
watcher daemon disable
```

## Development Commands

```bash
# Build TypeScript
npm run build

# Watch mode (auto-rebuild)
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Configuration File

The `.watcherrc.json` file is created during initialization:

```json
{
  "aiProvider": "openrouter",
  "model": "anthropic/claude-3-sonnet",
  "watchInterval": 5000,
  "ignorePatterns": [
    "node_modules/**",
    "dist/**",
    "build/**",
    "*.log",
    ".git/**",
    "coverage/**"
  ],
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

## Database Schema

### projects
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Project name |
| path | TEXT UNIQUE | Project path |
| tech_stack | TEXT | JSON array |
| architecture | TEXT | Architecture pattern |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update |

### changes
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| project_id | INTEGER FK | References projects |
| timestamp | DATETIME | Change timestamp |
| category | TEXT | feature, fix, refactor, docs, style, test |
| summary | TEXT | AI-generated summary |
| description | TEXT | Technical details |
| impact | TEXT | low, medium, high |
| lines_added | INTEGER | Lines added |
| lines_removed | INTEGER | Lines removed |
| files_changed | INTEGER | File count |

### file_changes
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| change_id | INTEGER FK | References changes |
| file_path | TEXT | Relative file path |
| change_type | TEXT | added, modified, deleted |
| lines_added | INTEGER | Lines added |
| lines_removed | INTEGER | Lines removed |

### technical_debt
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| project_id | INTEGER FK | References projects |
| type | TEXT | large_file, todo_comment, etc. |
| severity | TEXT | low, medium, high |
| file_path | TEXT | Relative file path |
| description | TEXT | Issue description |
| detected_at | DATETIME | Detection timestamp |
| resolved_at | DATETIME | Resolution timestamp |
| status | TEXT | open, resolved |

### metrics
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| project_id | INTEGER FK | References projects |
| timestamp | DATETIME | Snapshot timestamp |
| total_files | INTEGER | File count |
| total_lines | INTEGER | Line count |
| test_coverage | REAL | Coverage percentage |
| code_duplication | REAL | Duplication percentage |
| complexity_avg | REAL | Average complexity |
| debt_count | INTEGER | Open debt items |

## Troubleshooting

### "Command not found: watcher"
Run `npm link` in the project directory to create a global symlink.

### "Watcher is not initialized"
Run `watcher init` or simply run `watcher` to trigger the onboarding flow.

### Database locked error
Close any other Watcher instances running in the same project.

### AI analysis not working
Run `watcher config` to verify your API key is set and test the connection.
