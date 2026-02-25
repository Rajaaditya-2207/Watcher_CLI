# Watcher CLI - Development Guide

## Phase 1: Core Infrastructure ✅

This phase implements the foundational components of Watcher CLI.

### Completed Features

#### 1. CLI Framework Setup
- ✅ Commander.js integration for command parsing
- ✅ TypeScript configuration
- ✅ Project structure setup

#### 2. Configuration Management
- ✅ ConfigManager class for reading/writing `.watcherrc.json`
- ✅ Default configuration with sensible defaults
- ✅ Interactive configuration during `init`

#### 3. Database Initialization
- ✅ SQLite3 database setup
- ✅ Schema creation (projects, changes, file_changes tables)
- ✅ Database stored in `.watcher/watcher.db`

#### 4. File System Monitoring
- ✅ FileMonitor class using chokidar
- ✅ Real-time file change detection
- ✅ Ignore patterns support
- ✅ Event emission for file changes

#### 5. Git Integration
- ✅ GitService class for git operations
- ✅ Repository detection
- ✅ Branch information
- ✅ Git status parsing
- ✅ Diff retrieval

### Project Structure

```
watcher-cli/
├── src/
│   ├── cli.ts                 # Main CLI entry point
│   ├── index.ts               # Public API exports
│   ├── types/
│   │   └── index.ts           # TypeScript interfaces
│   ├── commands/
│   │   ├── init.ts            # Init command
│   │   ├── watch.ts           # Watch command
│   │   ├── report.ts          # Report command (stub)
│   │   └── insights.ts        # Insights command (stub)
│   ├── config/
│   │   └── ConfigManager.ts   # Configuration management
│   ├── database/
│   │   └── Database.ts        # SQLite database wrapper
│   ├── monitor/
│   │   └── FileMonitor.ts     # File system monitoring
│   ├── git/
│   │   └── GitService.ts      # Git integration
│   └── utils/
│       └── logger.ts          # Logging utilities
├── dist/                      # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── .gitignore
```

## Installation & Setup

### Prerequisites
- Node.js >= 16.0.0
- Git (optional, but recommended)

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

### Usage

#### Initialize Watcher in a Project

```bash
cd your-project
watcher init
```

This will:
1. Create `.watcherrc.json` configuration file
2. Initialize `.watcher/watcher.db` database
3. Prompt for AI provider and settings

#### Start Watching

```bash
watcher watch
```

This will:
1. Monitor file changes in real-time
2. Display file add/change/delete events
3. Show git diff in verbose mode

#### Options

```bash
# Watch with verbose output
watcher watch --verbose

# Watch with custom interval
watcher watch --interval=3000

# Force re-initialization
watcher init --force
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

## Testing the CLI

### Test Init Command

```bash
# Create a test directory
mkdir test-project
cd test-project
git init

# Initialize Watcher
watcher init

# Check created files
ls -la .watcherrc.json
ls -la .watcher/watcher.db
```

### Test Watch Command

```bash
# Start watching
watcher watch --verbose

# In another terminal, make changes
echo "console.log('test');" > test.js
echo "more changes" >> test.js
rm test.js
```

You should see real-time notifications of file changes.

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

### Projects Table
- `id`: Primary key
- `name`: Project name
- `path`: Project path (unique)
- `tech_stack`: JSON array of technologies
- `architecture`: Architecture pattern
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

### Changes Table
- `id`: Primary key
- `project_id`: Foreign key to projects
- `timestamp`: Change timestamp
- `category`: feature | fix | refactor | docs
- `summary`: Change summary
- `description`: Detailed description
- `impact`: low | medium | high
- `lines_added`: Lines added count
- `lines_removed`: Lines removed count
- `files_changed`: Number of files changed

### File Changes Table
- `id`: Primary key
- `change_id`: Foreign key to changes
- `file_path`: Relative file path
- `change_type`: added | modified | deleted
- `lines_added`: Lines added
- `lines_removed`: Lines removed

## Next Steps: Phase 2

Phase 2 will implement:
- AI provider integration (OpenRouter, AWS Bedrock, Groq)
- Semantic code analysis
- API key management with Keytar
- Prompt engineering for code understanding

## Troubleshooting

### "Command not found: watcher"

Run `npm link` in the project directory to create a global symlink.

### "Watcher is not initialized"

Run `watcher init` in your project directory first.

### Database locked error

Close any other Watcher instances running in the same project.

## Contributing

Phase 1 is complete! Ready to move to Phase 2 for AI integration.
