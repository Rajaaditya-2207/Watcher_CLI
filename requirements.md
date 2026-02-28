# Watcher — Requirements Document

## Project Overview

**Team Name:** KREONYX  
**Team Leader:** Rajaaditya. R  
**Hackathon:** AWS AI for Bharat Hackathon  
**Track:** Track 1 — AI for Learning and Developer Productivity

## Executive Summary

Watcher is a CLI-based development observer that provides semantic, real-time understanding of projects by translating technical code changes into human-readable narratives. It functions as a silent technical writer that auto-generates PROGRESS.md files and changelogs, reducing manual documentation time by up to 80%.

## Problem Statement

### Core Problems Addressed

1. **Documentation Fatigue**
   - Manual documentation is time-consuming and often neglected
   - Developers spend excessive time writing progress reports
   - Target: 80% reduction in documentation time

2. **AI Context Loss**
   - AI coding assistants require repeated context explanations
   - Context repetition problem reduces suggestion quality
   - Target: 3x improvement in AI suggestion quality

3. **Learning Barriers**
   - Beginners struggle to identify implementation gaps
   - Lack of comparison with reference implementations
   - Target: 2x speed improvement in learning

4. **Technical Debt**
   - Hidden issues like code duplication go unnoticed
   - Outdated dependencies accumulate over time
   - Lack of automated detection and reporting

5. **Team Visibility Gap**
   - Poor visibility into project progress
   - Slow developer onboarding process
   - Target: 50% faster developer onboarding

## Solution Overview

Watcher is a CLI tool that monitors codebases in real-time, providing:
- Semantic understanding of code changes
- Automated documentation generation
- AI-optimized context exports
- Technical debt tracking
- Privacy-first architecture with BYOK (Bring Your Own Key)
- Interactive Chat Mode for repository analysis

## Unique Differentiators

1. **Semantic Observation** — High-level understanding of development progress; translates raw code diffs into meaningful feature updates
2. **Interactive AI Agent** — Chat Mode allows developers to ask questions about their codebase, git status, and project structure
3. **Dynamic Model Selection** — Fetches available models from provider APIs at runtime; users choose their preferred model
4. **AI Context Optimization** — Generates machine-readable summaries for AI assistants; eliminates repetitive prompting
5. **Privacy and Control** — BYOK model ensures code remains local; user controls data and API costs

## Functional Requirements

### FR1: Core CLI Functionality

#### FR1.1: Interactive Onboarding
- **Trigger:** First run of `watcher` with no existing configuration
- **Requirements:**
  - Select AI provider (OpenRouter, Groq, AWS Bedrock)
  - Enter API key (stored with AES-256-CBC encryption)
  - Fetch and display available models from provider API
  - Select preferred model from fetched list
  - Auto-initialize database and configuration
- **Status:** IMPLEMENTED

#### FR1.2: Dual Operating Modes
- **Trigger:** Running `watcher` after setup
- **Requirements:**
  - **Chat Mode:** Interactive REPL to talk to AI about the repository
  - **Watch Mode:** Automatic file monitoring and progress logging
  - Mode selection via interactive prompt
- **Status:** IMPLEMENTED

#### FR1.3: Continuous Monitoring
- **Command:** `watcher watch`
- **Requirements:**
  - Real-time file system monitoring
  - Git change tracking
  - AI-powered change categorization (feature, fix, refactor, docs, style, test)
  - Automated impact assessment
  - Database persistence of analyzed changes
  - Auto-update PROGRESS.md and CHANGELOG.md
- **Status:** IMPLEMENTED

#### FR1.4: Semantic Auto-Documentation
- **Requirements:**
  - Generate and maintain PROGRESS.md file
  - Generate and maintain CHANGELOG.md file
  - Update documentation automatically as code changes
  - Translate technical changes into human-readable narratives
- **Status:** IMPLEMENTED

#### FR1.5: Flexible Reporting
- **Command:** `watcher report`
- **Requirements:**
  - Export in Markdown and JSON formats
  - Filterable history by date
  - File output support
  - Summary statistics, category breakdown, file hotspots, technical debt
- **Status:** IMPLEMENTED

### FR2: AI Integration

#### FR2.1: Multi-Provider Support
- **Requirements:**
  - OpenRouter (Claude, GPT-4, Gemini, Llama)
  - Groq (Llama, Mixtral)
  - AWS Bedrock (Claude, Titan)
  - Abstract provider interface with factory pattern
  - Dynamic model fetching from provider APIs
- **Status:** IMPLEMENTED

#### FR2.2: Semantic Code Understanding
- **Requirements:**
  - AI-powered analysis of code changes
  - Category classification (feature, fix, refactor, docs, style, test)
  - Impact assessment (low, medium, high)
  - Affected area identification
  - JSON response parsing with fallback handling
- **Status:** IMPLEMENTED

#### FR2.3: Interactive Chat Agent
- **Requirements:**
  - Readline-based interactive REPL
  - System prompt with full repository context (git status, file list, project summary)
  - Direct tool commands (status, diff, files, cat, summary)
  - Session management with conversation history
  - Token usage tracking
- **Status:** IMPLEMENTED

### FR3: Insights and Technical Health

#### FR3.1: Development Analytics
- **Command:** `watcher insights`
- **Requirements:**
  - Velocity metrics (changes/day, lines added/removed)
  - Category breakdown with percentages
  - Impact distribution
  - File hotspot detection
  - ASCII activity timeline visualization
  - Configurable time periods (day, week, month)
- **Status:** IMPLEMENTED

#### FR3.2: Technical Debt Tracking
- **Requirements:**
  - Large file detection (>500 lines)
  - TODO/FIXME/HACK comment scanning
  - Database persistence of debt items
  - Severity classification (low, medium, high)
  - Open/resolved status tracking
- **Status:** IMPLEMENTED

### FR4: Privacy and Security

#### FR4.1: BYOK Architecture
- **Requirements:**
  - Code remains strictly local
  - Never transmit raw code to external servers (only semantic diffs)
  - User provides own API keys
  - User controls API costs and usage
  - Multiple AI provider support
- **Status:** IMPLEMENTED

#### FR4.2: Secure Configuration Management
- **Requirements:**
  - AES-256-CBC encryption for API keys
  - Machine-specific key derivation (hostname + username)
  - Restrictive file permissions on credential storage
  - Customizable watch intervals and ignore patterns
- **Status:** IMPLEMENTED

### FR5: Data Management

#### FR5.1: Local Database
- **Requirements:**
  - SQLite via sql.js (pure JavaScript, no native dependencies)
  - Five tables: projects, changes, file_changes, technical_debt, metrics
  - Complete CRUD operations
  - Indexed queries for performance
  - No external database dependencies
- **Status:** IMPLEMENTED

#### FR5.2: Historical Tracking
- **Requirements:**
  - Complete change history
  - Time-based queries (since date filter)
  - Category and impact aggregation
  - File hotspot analysis
  - Project timeline generation
- **Status:** IMPLEMENTED

## Non-Functional Requirements

### NFR1: Performance
- Real-time file monitoring with minimal latency
- Buffered change analysis (5-second debounce)
- Indexed database queries
- Low CPU and memory footprint

### NFR2: Usability
- Neon green themed terminal UI
- Professional tone (no emojis in CLI output)
- Interactive prompts for configuration
- Clear error messages
- Table-formatted analytics output

### NFR3: Compatibility
- Cross-platform support (Windows, macOS, Linux)
- Node.js v16+ runtime
- Git integration
- Standard Markdown output

### NFR4: Reliability
- Graceful error handling with fallbacks
- Graceful shutdown on SIGINT
- Data integrity in local database
- Safe concurrent file operations

### NFR5: Security
- AES-256-CBC encrypted credential storage
- No raw code transmission to external servers
- Machine-specific encryption keys
- Restrictive file permissions

### NFR6: Maintainability
- Modular architecture with clear separation of concerns
- TypeScript strict mode
- Code formatting (Prettier)
- Linting (ESLint)

## Technical Requirements

### TR1: Runtime and Language
- TypeScript (strict mode)
- Node.js v16+ (LTS)

### TR2: AI Integration
- OpenRouter API (v1)
- Groq API (OpenAI-compatible)
- AWS Bedrock (structural)
- Dynamic model fetching

### TR3: CLI Framework
- Commander.js for command parsing
- Inquirer.js for interactive prompts
- Chalk for colors (neon green theme)
- Ora for spinners
- Boxen for boxed output

### TR4: Data Storage
- sql.js (pure JavaScript SQLite)
- AES-256-CBC for credential encryption

### TR5: Monitoring
- Chokidar for file system events
- Native Git commands for version control

### TR6: Development Tools
- Jest for testing
- Prettier and ESLint for code quality
- Husky for git hooks

## Acceptance Criteria

### AC1: Core Functionality
- [x] `watcher` (bare) triggers interactive mode with onboarding and mode selection
- [x] `watcher watch` monitors changes in real-time
- [x] PROGRESS.md is auto-generated and updated
- [x] CHANGELOG.md is auto-generated and updated
- [x] `watcher report` exports in markdown and JSON formats

### AC2: AI Integration
- [x] Dynamic model fetching from OpenRouter and Groq APIs
- [x] Semantic understanding produces categorized change summaries
- [x] Chat Mode allows interactive conversation about the repository
- [x] API keys are encrypted with AES-256-CBC

### AC3: Analytics and Technical Debt
- [x] Automated detection of large files and TODO comments
- [x] Velocity metrics with period filtering
- [x] File hotspot analysis
- [x] Activity timeline visualization

### AC4: Privacy and Security
- [x] Code remains local at all times
- [x] API keys are encrypted at rest
- [x] User controls all costs via BYOK

### AC5: Usability
- [x] Neon green themed terminal output
- [x] Professional tone with no emojis in CLI
- [x] Interactive onboarding for first-run setup
- [x] Table-formatted analytics display

## Cost Structure

### Implementation Cost
- **Development:** $0 (self-built, open-source tools)
- **Monthly Operations:** $5-$10 (AWS testing only)

### User Cost
- **BYOK Model:** $2-$30/month (user-controlled)
- Users bring their own API keys
- Direct control over spending

## Success Metrics

1. **Documentation Efficiency:** 80% reduction in manual documentation time
2. **AI Suggestion Quality:** 3x improvement with context export
3. **Learning Speed:** 2x faster for beginners using gap analysis
4. **Onboarding Speed:** 50% faster developer onboarding
5. **User Adoption:** Community growth and contributions
6. **Code Quality:** Measurable reduction in technical debt

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI API costs too high | High | BYOK model gives users control |
| Performance issues on large repos | Medium | Optimized parsing, ignore patterns, debounce |
| User adoption challenges | Medium | Strong documentation, onboarding flow |
| API provider changes | Low | Abstract provider interface, multiple providers |
| Security vulnerabilities | High | AES-256-CBC encryption, no code transmission |

## Timeline

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 | Core Infrastructure (CLI, config, DB, monitoring, git) | COMPLETE |
| Phase 2 | AI Integration (providers, analysis, credentials) | COMPLETE |
| Phase 3 | Documentation Generation (PROGRESS.md, CHANGELOG.md, reports) | COMPLETE |
| Phase 4 | Analytics and Insights (velocity, debt tracking) | COMPLETE |
| Phase 5 | Interactive Mode System (onboarding, chat, watch modes) | COMPLETE |
