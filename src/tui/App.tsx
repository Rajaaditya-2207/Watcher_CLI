import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp, render } from 'ink';
import chalk from 'chalk';
import path from 'path';
import { EventEmitter } from 'events';

import { Banner } from './components/Banner';
import { ChatView, ChatMessage, formatToolMessage } from './components/ChatView';
import { InputArea } from './components/InputArea';
import { SidePanel } from './components/SidePanel';
import { StatusBar } from './components/StatusBar';
import { CommandPalette, SlashCommand, getPaletteFiltered, PARENT_COMMANDS } from './components/CommandPalette';
import { ConfigEditor } from './components/ConfigEditor';

import type { AIProvider } from '../ai/AIProvider';
import type { SessionManager } from '../modes/sessionManager';
import type { ChatTools } from '../modes/chatTools';
import type { GitService } from '../git/GitService';
import type { WatcherDatabase } from '../database/Database';
import type { SemanticAnalyzer } from '../ai/SemanticAnalyzer';
import type { ProgressGenerator } from '../documentation/ProgressGenerator';
import type { ChangelogGenerator } from '../documentation/ChangelogGenerator';
import type { ConfigManager } from '../config/ConfigManager';
import type { CredentialManager } from '../credentials/CredentialManager';
import type { WatcherConfig, CommandOptions } from '../types';
import { FileMonitor, FileEvent } from '../monitor/FileMonitor';
import { AIProviderFactory } from '../ai/AIProviderFactory';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { TechnicalDebtTracker } from '../analytics/TechnicalDebtTracker';
import { loadRegistry, getPidPath, getLogPath } from '../daemon/daemonRegistry';
import { isAutostartEnabled } from '../daemon/autostart';
import { fetchModels } from '../ai/modelFetcher';
import { spawn } from 'child_process';
import fs from 'fs';

// ─── Types ────────────────────────────────────────────────────

export interface AppProps {
    config: WatcherConfig;
    projectPath: string;
    aiProvider: AIProvider;
    session: SessionManager;
    tools: ChatTools;
    gitService: GitService;
    db: WatcherDatabase;
    analyzer: SemanticAnalyzer;
    progressGen: ProgressGenerator;
    changelogGen: ChangelogGenerator;
    configManager: ConfigManager;
    credentialManager: CredentialManager;
    scrollBus: EventEmitter; // bridges mouse events from app.ts (pre-Ink) into the TUI
}

// ─── Slash Commands ───────────────────────────────────────────

const SLASH_COMMANDS: SlashCommand[] = [
    { name: 'help', description: 'Show available commands' },
    { name: 'clear', description: 'Clear chat history' },
    { name: 'config', description: 'View current configuration' },
    { name: 'config edit', description: 'Interactive config editor (provider, model, keys, features)' },
    { name: 'report', description: 'Generate project status report' },
    { name: 'insights', description: 'Show development analytics (all time)' },
    { name: 'insights day', description: 'Analytics for the last 24 hours' },
    { name: 'insights week', description: 'Analytics for the last 7 days' },
    { name: 'insights month', description: 'Analytics for the last 30 days' },
    { name: 'watch', description: 'Toggle file monitoring on/off' },
    { name: 'daemon status', description: 'Show background daemon status' },
    { name: 'daemon start', description: 'Start background daemon' },
    { name: 'daemon stop', description: 'Stop background daemon' },
    { name: 'session new', description: 'Start a new chat session' },
    { name: 'session list', description: 'List all saved sessions' },
    { name: 'session switch', description: 'Switch to a saved session (by ID)' },
    { name: 'session save', description: 'Save the current session' },
    { name: 'status', description: 'Show git repository status' },
    { name: 'diff', description: 'Show unstaged git diff' },
    { name: 'files', description: 'List project files' },
    { name: 'search', description: 'Search project files for a pattern' },
    { name: 'quit', description: 'Exit Watcher' },
];

// ─── Main App Component ──────────────────────────────────────

function WatcherApp(props: AppProps) {
    const { exit } = useApp();

    // Terminal dimensions
    const [rows, setRows] = useState(process.stdout.rows || 24);
    const [cols, setCols] = useState(process.stdout.columns || 80);

    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [showBanner, setShowBanner] = useState(true);
    const [scrollOffset, setScrollOffset] = useState(0);

    // Command palette
    const [showPalette, setShowPalette] = useState(false);
    const [paletteIndex, setPaletteIndex] = useState(0);
    const paletteInterceptedRef = useRef(false);

    // Side panel data
    const [sessionChanges, setSessionChanges] = useState(0);
    const [sessionAnalyses, setSessionAnalyses] = useState(0);
    const [activityLog, setActivityLog] = useState<string[]>([]);
    const [branchName, setBranchName] = useState('N/A');

    // Watch mode toggle
    const [watchEnabled, setWatchEnabled] = useState(true);
    const watchEnabledRef = useRef(true);

    // Config editor mode
    const [configEditMode, setConfigEditMode] = useState(false);
    const [configEditorKeyStatus, setConfigEditorKeyStatus] = useState(false);

    // Refs for mutable state in callbacks
    const aiProviderRef = useRef(props.aiProvider);
    const configRef = useRef(props.config);
    // Palette mouse-click handler — updated every render to avoid stale closures
    const handlePaletteClickRef = useRef<(x: number, y: number) => void>(() => {});
    // AbortController for cancelling in-flight AI requests
    const abortControllerRef = useRef<AbortController | null>(null);

    const projectName = path.basename(props.projectPath);

    // ─── Config editor save/cancel handlers ───
    const handleConfigSave = useCallback(async (newConfig: WatcherConfig, newApiKey?: string) => {
        const oldProvider = configRef.current.aiProvider;
        if (newApiKey) {
            const alias = newConfig.keyAlias || 'default';
            await props.credentialManager.storeApiKey(newConfig.aiProvider, newApiKey, alias);
            newConfig = { ...newConfig, keyAlias: alias };
        }
        await props.configManager.save(newConfig);
        configRef.current = newConfig;
        setConfigEditMode(false);

        // Always recreate AI provider so any change takes effect
        const apiKey = await props.credentialManager.getApiKey(newConfig.aiProvider, newConfig.keyAlias);
        if (apiKey) {
            aiProviderRef.current = AIProviderFactory.create({ provider: newConfig.aiProvider as any, apiKey, model: newConfig.model });
        }

        const changed: string[] = [];
        if (newConfig.aiProvider !== oldProvider) changed.push(`provider → **${newConfig.aiProvider}**`);
        if (newApiKey) changed.push('API key updated');
        const summary = changed.length > 0
            ? `Configuration saved (${changed.join(', ')}).`
            : 'Configuration saved.';
        setMessages(prev => [...prev, { role: 'assistant', content: summary, timestamp: Date.now() }]);
    }, [props.configManager, props.credentialManager]);

    const handleConfigCancel = useCallback(() => {
        setConfigEditMode(false);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Config edit cancelled.', timestamp: Date.now() }]);
    }, []);

    // ─── Fetch models for config editor ───
    const handleFetchModels = useCallback(async (stagedKey?: string) => {
        const config = configRef.current;
        const apiKey = stagedKey || await props.credentialManager.getApiKey(config.aiProvider, config.keyAlias);
        if (!apiKey) throw new Error('No API key set. Enter an API key in the editor first, then Save, then reopen /config edit.');
        return fetchModels(config.aiProvider, apiKey);
    }, [props.credentialManager]);

    // ─── Enter alternate screen buffer ───
    // Mouse enable/disable is handled in app.ts (before Ink starts), so we only
    // manage the alt-screen buffer here.
    useEffect(() => {
        process.stdout.write('\x1b[?1049h'); // enter alt buffer
        process.stdout.write('\x1b[?25h');   // show cursor
        return () => {
            process.stdout.write('\x1b[?1049l'); // exit alt buffer
        };
    }, []);

    // ─── Mouse scroll via scrollBus (set up in app.ts before Ink) ───
    useEffect(() => {
        const handleMouse = (btn: number, mx: number, my: number) => {
            if (btn === 64) {
                setScrollOffset(prev => Math.max(0, prev - 3)); // wheel up
            } else if (btn === 65) {
                setScrollOffset(prev => prev + 3);              // wheel down
            } else if (btn === 0) {
                handlePaletteClickRef.current(mx, my);          // left click
            }
        };
        props.scrollBus.on('mouse', handleMouse);
        return () => { props.scrollBus.off('mouse', handleMouse); };
    }, [props.scrollBus]);

    // ─── Resize handler ───
    useEffect(() => {
        const onResize = () => {
            setRows(process.stdout.rows || 24);
            setCols(process.stdout.columns || 80);
        };
        process.stdout.on('resize', onResize);
        return () => { process.stdout.off('resize', onResize); };
    }, []);

    // ─── Git branch ───
    useEffect(() => {
        try {
            if (props.gitService.isGitRepository()) {
                setBranchName(props.gitService.getStatus().branch);
            }
        } catch { /* git may fail */ }
    }, [props.gitService]);

    // ─── File Monitor ───
    useEffect(() => {
        const monitor = new FileMonitor(props.projectPath, configRef.current.ignorePatterns);
        let changeBuffer: FileEvent[] = [];
        let analysisTimeout: NodeJS.Timeout | null = null;

        const addLog = (entry: string) => {
            const ts = new Date().toLocaleTimeString();
            setActivityLog(prev => {
                const log = [...prev, `${chalk.dim(ts)} ${entry}`];
                return log.slice(-10);
            });
        };

        monitor.on('ready', () => {
            addLog(chalk.hex('#39FF14')('✓ Monitor active'));
        });

        monitor.on('fileChange', (event: FileEvent) => {
            if (!watchEnabledRef.current) return; // skip when watch is disabled
            setSessionChanges(prev => prev + 1);
            const colorMap: Record<string, string> = { add: '#39FF14', change: '#e0af68', unlink: '#f7768e' };
            const color = colorMap[event.type] || '#c9d1d9';
            addLog(`${chalk.hex(color)('[' + event.type.toUpperCase() + ']')} ${chalk.hex('#c9d1d9')(path.basename(event.path))}`);

            if (configRef.current.features.autoDocumentation) {
                changeBuffer.push(event);
                if (analysisTimeout) clearTimeout(analysisTimeout);

                analysisTimeout = setTimeout(async () => {
                    const changes = [...changeBuffer];
                    changeBuffer = [];
                    addLog(`${chalk.hex('#7dcfff')('⚙')} Analyzing ${changes.length} file(s)...`);

                    try {
                        const diff = props.gitService.getUnstagedDiff();
                        const analysis = await props.analyzer.analyzeChanges({
                            files: changes.map(c => ({
                                path: c.path,
                                changeType: c.type === 'add' ? 'added' as const : c.type === 'unlink' ? 'deleted' as const : 'modified' as const,
                            })),
                            diff,
                            projectContext: { name: projectName, techStack: [], architecture: 'Unknown' },
                        });

                        const projectId = props.db.getProjectId(props.projectPath);
                        if (projectId) {
                            props.db.saveChange({
                                projectId,
                                category: analysis.category,
                                summary: analysis.summary,
                                description: analysis.technicalDetails,
                                impact: analysis.impact,
                                filesChanged: changes.length,
                                fileDetails: changes.map(c => ({
                                    filePath: c.path,
                                    changeType: c.type === 'add' ? 'added' as const : c.type === 'unlink' ? 'deleted' as const : 'modified' as const,
                                })),
                            });

                            try {
                                await props.progressGen.generate();
                                await props.changelogGen.generate();
                                addLog(chalk.hex('#39FF14')('✓ Docs updated'));
                            } catch {
                                addLog(chalk.hex('#e0af68')('⚠ Doc error'));
                            }
                        }

                        addLog(`${chalk.hex('#39FF14')('✦')} ${chalk.hex('#c9d1d9')(analysis.summary)}`);
                        setSessionAnalyses(prev => prev + 1);
                    } catch {
                        addLog(chalk.hex('#f7768e')('✗ Analysis failed'));
                    }
                }, 5000);
            }
        });

        monitor.start();
        return () => {
            monitor.stop();
            if (analysisTimeout) clearTimeout(analysisTimeout);
        };
    }, [props.projectPath]);

    // ─── Execute a tool for the AI (returns output string, no UI side-effects) ───
    const executeToolForAI = useCallback(async (command: string): Promise<string> => {
        const cmd = command.trim();
        const lower = cmd.toLowerCase();

        if (lower === '/status' || lower === 'status' || lower === 'git status') return props.tools.getGitStatus();
        if (lower === '/diff' || lower === 'diff' || lower === 'git diff') return props.tools.getGitDiff();
        if (lower === '/files' || lower === 'files' || lower === 'ls') return props.tools.getFileList();
        if (lower === 'summary' || lower === '/summary' || lower === 'project') return props.tools.getProjectSummary();
        if (lower === 'help' || lower === 'tools') return props.tools.getToolHelp();
        if (lower.startsWith('cat ') || lower.startsWith('read ')) {
            const fp = cmd.substring(lower.startsWith('cat') ? 4 : 5).trim();
            return props.tools.readFile(fp);
        }
        if (lower.startsWith('search ') || lower.startsWith('grep ') || lower.startsWith('find ')) {
            // Cross-platform pattern search through project files
            const prefixLen = lower.startsWith('search ') ? 7 : lower.startsWith('grep ') ? 5 : 5;
            const pattern = cmd.substring(prefixLen).trim();
            if (!pattern) return 'Usage: search <pattern>';
            // Use git grep when available (fast), fall back to ripgrep or findstr
            const isWin = process.platform === 'win32';
            const grepCmd = isWin
                ? `findstr /s /i /n "${pattern}" *`
                : `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" "${pattern}" .`;
            return props.tools.executeShellCommand(grepCmd);
        }
        if (lower.startsWith('run ') || lower.startsWith('exec ') || lower.startsWith('$ ')) {
            let shellCmd: string;
            if (lower.startsWith('$ ')) shellCmd = cmd.substring(2).trim();
            else if (lower.startsWith('run ')) shellCmd = cmd.substring(4).trim();
            else shellCmd = cmd.substring(5).trim();
            return props.tools.executeShellCommand(shellCmd);
        }
        if (lower === '/report') {
            const projectId = props.db.getProjectId(props.projectPath);
            if (!projectId) return 'Project not found in database.';
            const summary = props.db.getChangeSummary(projectId);
            const hotspots = props.db.getFileHotspots(projectId, 10);
            const changes = props.db.getChanges(projectId);
            let out = `Total Changes: ${summary.totalChanges}, Lines Added: +${summary.totalLinesAdded}, Lines Removed: -${summary.totalLinesRemoved}\n`;
            if (Object.keys(summary.categories).length > 0) {
                out += 'Categories: ' + Object.entries(summary.categories).map(([k, v]) => `${k}=${v}`).join(', ') + '\n';
            }
            if (hotspots.length > 0) {
                out += 'Hotspots: ' + hotspots.map(h => `${h.filePath}(${h.count})`).join(', ') + '\n';
            }
            if (changes.length > 0) {
                out += 'Recent: ' + changes.slice(0, 10).map(c => `[${c.category}] ${c.summary}`).join('; ') + '\n';
            }
            return out;
        }
        if (lower === '/insights' || lower.startsWith('/insights ') || lower === 'insights' || lower.startsWith('insights ')) {
            const periodArg = lower.includes(' ') ? cmd.split(' ').slice(1).join(' ').trim().toLowerCase() : '';
            const periodMap: Record<string, number> = { day: 1, week: 7, month: 30 };
            const periodDays = periodMap[periodArg] || 7;
            const projectId = props.db.getProjectId(props.projectPath);
            if (!projectId) return 'Project not found in database.';
            const analytics = new AnalyticsEngine(props.db);
            const velocity = analytics.getVelocityMetrics(projectId, periodDays);
            const hotspots = analytics.getFileHotspots(projectId, 10);
            let out = `Velocity (${periodDays}d): ${velocity.totalChanges} changes, ${velocity.changesPerDay.toFixed(1)}/day, +${velocity.linesAdded}/-${velocity.linesRemoved} lines\n`;
            if (Object.keys(velocity.categoryBreakdown).length > 0) {
                out += 'Categories: ' + Object.entries(velocity.categoryBreakdown).map(([k, v]) => `${k}=${v}`).join(', ') + '\n';
            }
            if (hotspots.length > 0) {
                out += 'Hotspots: ' + hotspots.map(h => `${h.filePath}(${h.changeCount})`).join(', ') + '\n';
            }
            return out;
        }
        if (lower === '/config') {
            const config = configRef.current;
            return `Provider: ${config.aiProvider}, Model: ${config.model}, Key: ${config.keyAlias || 'default'}, Watch: ${config.watchInterval}ms, AutoDocs: ${config.features.autoDocumentation}, TechDebt: ${config.features.technicalDebt}, Analytics: ${config.features.analytics}`;
        }
        if (lower === '/daemon status' || lower === '/daemon' || lower === 'daemon status') {
            const pidPath = getPidPath();
            let pid: number | null = null;
            try {
                if (fs.existsSync(pidPath)) {
                    const parsed = parseInt(fs.readFileSync(pidPath, 'utf-8').trim());
                    if (!isNaN(parsed)) { try { process.kill(parsed, 0); pid = parsed; } catch {} }
                }
            } catch {}
            const projects = loadRegistry();
            return `Daemon: ${pid ? 'Running (PID ' + pid + ')' : 'Stopped'}, Projects: ${projects.length}, LogFile: ${getLogPath()}`;
        }
        return `Unknown tool command: ${cmd}`;
    }, [props]);

    // ─── System prompt ───
    const getSystemPrompt = useCallback(() => {
        return `You are Watcher, an intelligent development assistant embedded in the developer's terminal. You have live access to the user's repository, file system, and shell. Respond professionally and concisely — no emojis, no filler.

Format responses using clean Markdown:
- Use ## / ### headings to organize
- Use **bold** for filenames and key terms
- Use \`backticks\` for file names, commands, symbols
- Use bullet lists or numbered lists for enumerations and steps
- Use \`\`\`language code blocks for code
- Keep paragraphs short (2-3 sentences)

## Live Project Snapshot
${props.tools.getProjectSummary()}

## Git Status
${props.tools.getGitStatus()}

## Project Files
${props.tools.getFileList()}

---

## Tool Access

You have access to all of the following tools. Use them proactively — ALWAYS call a tool rather than guessing or making up data.

To call a tool, include this exact syntax on its own line in your response:

[TOOL_CALL: <command>]

### Available Tools

| Command | What it does |
|---------|-------------|
| /status | Current git status — branch, staged, unstaged, untracked files |
| /diff | Full unstaged git diff |
| /files | Complete project file tree |
| /report | Project change metrics — total changes, lines added/removed, hotspot files, recent activity |
| /insights [day\|week\|month] | Development velocity, category breakdown, hotspot files, tech debt summary |
| /config | Current Watcher configuration (provider, model, features) |
| /daemon status | Background daemon status (running/stopped, PID, monitored projects) |
| summary | Project overview from the Watcher database |
| cat <filepath> | Read any file in the project (use relative paths from project root) |
| search <pattern> | Search all source files for a pattern (like grep) |
| run <shell command> | Execute a shell command and return the output (read-only commands preferred) |

### Rules

1. **Use tools first, answer second.** If a question involves the repo, files, git state, metrics, or live data — call the tool, then answer. Do not rely on the snapshot above for current state.
2. **Multiple tool calls are allowed** in one response. Put each on its own line.
3. After tool results are returned, provide a concise final analysis in your next response.
4. Never fabricate file contents, git state, or metrics. Use a tool call.
5. When reading a specific file, always use \`cat <filepath>\`. Use \`search <pattern>\` to locate where something is defined.

### Examples

- "What changed recently?" → \`[TOOL_CALL: /report]\`
- "Show me the auth middleware" → \`[TOOL_CALL: search auth]\` then \`[TOOL_CALL: cat src/middleware/auth.ts]\`
- "What branch am I on?" → \`[TOOL_CALL: /status]\`
- "Run the tests" → \`[TOOL_CALL: run npm test]\`
- "How fast am I shipping?" → \`[TOOL_CALL: /insights week]\`
- "Are there any TODOs?" → \`[TOOL_CALL: /insights day]\` or \`[TOOL_CALL: search TODO]\``;
    }, [props.tools]);

    // ─── Handle commands ───
    const handleCommand = useCallback(async (text: string): Promise<boolean> => {
        const lower = text.toLowerCase().trim();

        // ─── Exit ───
        if (lower === '/exit' || lower === '/quit') {
            props.session.saveSession();
            props.db.close();
            exit();
            return true;
        }

        // ─── Help ───
        if (lower === '/help') {
            setShowBanner(false);
            const helpLines = SLASH_COMMANDS.map(c => `- **/${c.name}** — ${c.description}`);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `## Available Commands\n\n${helpLines.join('\n')}\n\nYou can also type plain text to chat with the AI.`,
                timestamp: Date.now(),
            }]);
            return true;
        }

        // ─── Clear ───
        if (lower === '/clear' || lower === 'clear') {
            props.session.clear();
            setMessages([]);
            setScrollOffset(0);
            return true;
        }

        // ─── Config: Edit (interactive) ───
        if (lower === '/config edit') {
            setShowBanner(false);
            const hasKey = await props.credentialManager.hasApiKey(configRef.current.aiProvider, configRef.current.keyAlias);
            setConfigEditorKeyStatus(hasKey);
            setConfigEditMode(true);
            return true;
        }

        // ─── Config: View ───
        if (lower === '/config' || lower === '/configure') {
            setShowBanner(false);
            const config = configRef.current;
            const hasKey = await props.credentialManager.hasApiKey(config.aiProvider, config.keyAlias);
            const aliases = await props.credentialManager.listKeyAliases(config.aiProvider);
            const content = `## Current Configuration\n\n` +
                `| Setting | Value |\n|---------|-------|\n` +
                `| **Provider** | ${config.aiProvider} |\n` +
                `| **Model** | ${config.model} |\n` +
                `| **Active Key** | ${config.keyAlias || 'default'} ${hasKey ? '(set)' : '(not set)'} |\n` +
                `| **Saved Keys** | ${aliases.length > 0 ? aliases.join(', ') : 'none'} |\n` +
                `| **Watch Interval** | ${config.watchInterval}ms |\n` +
                `| **Auto Docs** | ${config.features.autoDocumentation ? 'Enabled' : 'Disabled'} |\n` +
                `| **Tech Debt** | ${config.features.technicalDebt ? 'Enabled' : 'Disabled'} |\n` +
                `| **Analytics** | ${config.features.analytics ? 'Enabled' : 'Disabled'} |\n` +
                `| **Watch Mode** | ${watchEnabledRef.current ? 'Active' : 'Paused'} |\n\n` +
                `Use \`/config edit\` to interactively change settings.`;
            setMessages(prev => [...prev, { role: 'assistant', content, timestamp: Date.now() }]);
            return true;
        }

        // ─── Report ───
        if (lower === '/report' || lower.startsWith('/report ')) {
            setShowBanner(false);
            setMessages(prev => [...prev, { role: 'tool', content: formatToolMessage('report', 'Generating project report...') }]);
            try {
                const projectId = props.db.getProjectId(props.projectPath);
                if (!projectId) {
                    setMessages(prev => [...prev, { role: 'assistant', content: 'Project not found in database. Run `watcher init` first.', timestamp: Date.now() }]);
                    return true;
                }
                const project = props.db.getProject(props.projectPath);
                const changes = props.db.getChanges(projectId);
                const summary = props.db.getChangeSummary(projectId);
                const hotspots = props.db.getFileHotspots(projectId, 10);
                const debt = props.db.getTechnicalDebt(projectId);

                let report = `## Project Status Report\n\n`;
                report += `**Project:** ${project?.name || projectName}\n`;
                report += `**Generated:** ${new Date().toISOString().split('T')[0]}\n\n---\n\n`;
                report += `### Summary\n\n| Metric | Value |\n|--------|-------|\n`;
                report += `| Total Changes | ${summary.totalChanges} |\n`;
                report += `| Lines Added | +${summary.totalLinesAdded} |\n`;
                report += `| Lines Removed | -${summary.totalLinesRemoved} |\n\n`;

                if (Object.keys(summary.categories).length > 0) {
                    report += `### Change Breakdown\n\n| Category | Count |\n|----------|-------|\n`;
                    for (const [cat, count] of Object.entries(summary.categories)) {
                        report += `| ${cat} | ${count} |\n`;
                    }
                    report += '\n';
                }

                if (changes.length > 0) {
                    report += `### Recent Changes\n\n`;
                    for (const change of changes.slice(0, 15)) {
                        const date = change.timestamp.split(' ')[0] || change.timestamp.split('T')[0];
                        report += `- **${date}** [${change.category.toUpperCase()}] ${change.summary}`;
                        if (change.impact !== 'low') report += ` *(${change.impact} impact)*`;
                        report += '\n';
                    }
                    report += '\n';
                }

                if (hotspots.length > 0) {
                    report += `### File Hotspots\n\n| File | Changes |\n|------|---------|\n`;
                    for (const spot of hotspots) {
                        report += `| ${spot.filePath} | ${spot.count} |\n`;
                    }
                    report += '\n';
                }

                if (debt.length > 0) {
                    report += `### Technical Debt\n\n| Type | Severity | File |\n|------|----------|------|\n`;
                    for (const item of debt.slice(0, 10)) {
                        report += `| ${item.type} | ${item.severity} | ${item.filePath || 'N/A'} |\n`;
                    }
                    report += '\n';
                }

                // Also update PROGRESS.md / CHANGELOG.md
                try { await props.progressGen.generate(); } catch {}
                try { await props.changelogGen.generate(); } catch {}

                setMessages(prev => [...prev, { role: 'assistant', content: report, timestamp: Date.now() }]);
            } catch (err: any) {
                setMessages(prev => [...prev, { role: 'assistant', content: `Report generation failed: ${err.message}`, timestamp: Date.now() }]);
            }
            return true;
        }

        // ─── Insights ───
        if (lower === '/insights' || lower.startsWith('/insights ')) {
            setShowBanner(false);
            const periodArg = text.substring('/insights'.length).trim().toLowerCase();
            const periodMap: Record<string, number> = { day: 1, week: 7, month: 30 };
            const periodLabel = periodArg && periodMap[periodArg] ? periodArg : 'week';
            const periodDays = periodMap[periodLabel] || 7;

            setMessages(prev => [...prev, { role: 'tool', content: formatToolMessage('analytics', `Analyzing last ${periodDays} day(s)...`) }]);
            try {
                const projectId = props.db.getProjectId(props.projectPath);
                if (!projectId) {
                    setMessages(prev => [...prev, { role: 'assistant', content: 'Project not found in database.', timestamp: Date.now() }]);
                    return true;
                }

                const analytics = new AnalyticsEngine(props.db);
                const velocity = analytics.getVelocityMetrics(projectId, periodDays);
                const hotspots = analytics.getFileHotspots(projectId, 10);
                const timeline = analytics.getActivityTimeline(projectId, periodDays);

                let content = `## Development Insights (last ${periodDays} day${periodDays > 1 ? 's' : ''})\n\n`;
                content += `### Velocity\n\n| Metric | Value |\n|--------|-------|\n`;
                content += `| Total Changes | ${velocity.totalChanges} |\n`;
                content += `| Changes/Day | ${velocity.changesPerDay} |\n`;
                content += `| Lines Added | +${velocity.linesAdded} |\n`;
                content += `| Lines Removed | -${velocity.linesRemoved} |\n`;
                content += `| Net Lines | ${velocity.netLines} |\n\n`;

                if (Object.keys(velocity.categoryBreakdown).length > 0) {
                    content += `### Categories\n\n| Category | Count |\n|----------|-------|\n`;
                    for (const [cat, count] of Object.entries(velocity.categoryBreakdown)) {
                        content += `| ${cat} | ${count} |\n`;
                    }
                    content += '\n';
                }

                if (hotspots.length > 0) {
                    content += `### File Hotspots\n\n| File | Changes |\n|------|---------|\n`;
                    for (const h of hotspots) {
                        content += `| ${h.filePath} | ${h.changeCount} |\n`;
                    }
                    content += '\n';
                }

                if (Object.keys(timeline).length > 0) {
                    content += `### Activity Timeline\n\n`;
                    for (const [date, count] of Object.entries(timeline)) {
                        const bar = '\u2588'.repeat(Math.min(count, 30));
                        content += `- **${date}** ${bar} ${count}\n`;
                    }
                    content += '\n';
                }

                // Tech debt scan
                const debtTracker = new TechnicalDebtTracker(props.db, props.projectPath);
                const debtItems = await debtTracker.scan(projectId);
                if (debtItems.length > 0) {
                    content += `### Technical Debt (${debtItems.length} items)\n\n| Type | Severity | File |\n|------|----------|------|\n`;
                    for (const d of debtItems.slice(0, 10)) {
                        content += `| ${d.type} | ${d.severity} | ${d.filePath || 'N/A'} |\n`;
                    }
                    if (debtItems.length > 10) content += `\n...and ${debtItems.length - 10} more.`;
                    content += '\n';
                }

                setMessages(prev => [...prev, { role: 'assistant', content, timestamp: Date.now() }]);
            } catch (err: any) {
                setMessages(prev => [...prev, { role: 'assistant', content: `Insights failed: ${err.message}`, timestamp: Date.now() }]);
            }
            return true;
        }

        // ─── Watch Toggle ───
        if (lower === '/watch') {
            setShowBanner(false);
            const newState = !watchEnabledRef.current;
            watchEnabledRef.current = newState;
            setWatchEnabled(newState);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: newState ? 'File monitoring **resumed**. Changes will be tracked and analyzed.' : 'File monitoring **paused**. Changes will not be tracked until re-enabled.',
                timestamp: Date.now(),
            }]);
            return true;
        }

        // ─── Daemon ───
        if (lower === '/daemon' || lower === '/daemon status') {
            setShowBanner(false);
            const pidPath = getPidPath();
            let pid: number | null = null;
            try {
                if (fs.existsSync(pidPath)) {
                    const raw = fs.readFileSync(pidPath, 'utf-8').trim();
                    const parsed = parseInt(raw);
                    if (!isNaN(parsed)) {
                        try { process.kill(parsed, 0); pid = parsed; } catch { fs.unlinkSync(pidPath); }
                    }
                }
            } catch {}
            const projects = loadRegistry();
            const autostart = isAutostartEnabled();
            let content = `## Daemon Status\n\n| Property | Value |\n|----------|-------|\n`;
            content += `| **Status** | ${pid ? 'Running' : 'Stopped'} |\n`;
            content += `| **PID** | ${pid || 'N/A'} |\n`;
            content += `| **Auto-Start** | ${autostart ? 'Enabled' : 'Disabled'} |\n`;
            content += `| **Projects** | ${projects.length} |\n`;
            content += `| **Log File** | ${getLogPath()} |\n`;
            if (projects.length > 0) {
                content += `\n### Monitored Projects\n\n`;
                for (const p of projects) {
                    content += `- **${p.name}** — ${p.path}\n`;
                }
            }
            setMessages(prev => [...prev, { role: 'assistant', content, timestamp: Date.now() }]);
            return true;
        }

        if (lower === '/daemon start') {
            setShowBanner(false);
            const pidPath = getPidPath();
            let isRunning = false;
            try {
                if (fs.existsSync(pidPath)) {
                    const parsed = parseInt(fs.readFileSync(pidPath, 'utf-8').trim());
                    if (!isNaN(parsed)) { try { process.kill(parsed, 0); isRunning = true; } catch {} }
                }
            } catch {}
            if (isRunning) {
                setMessages(prev => [...prev, { role: 'assistant', content: 'Daemon is already running.', timestamp: Date.now() }]);
                return true;
            }
            // Resolve daemon script relative to CLI entry
            const cliScript = process.argv[1] || '';
            const daemonScript = path.resolve(path.dirname(cliScript), 'daemon', 'daemon.js');
            if (!fs.existsSync(daemonScript)) {
                setMessages(prev => [...prev, { role: 'assistant', content: `Daemon script not found at \`${daemonScript}\`. Run \`npm run build\` with a separate daemon entry.`, timestamp: Date.now() }]);
                return true;
            }
            const projects = loadRegistry();
            if (projects.length === 0) {
                setMessages(prev => [...prev, { role: 'assistant', content: 'No projects registered for daemon monitoring. Run `watcher init` in a project directory first.', timestamp: Date.now() }]);
                return true;
            }
            try {
                const child = spawn(process.execPath, [daemonScript], { detached: true, stdio: 'ignore' });
                child.unref();
                setMessages(prev => [...prev, { role: 'assistant', content: `Daemon started (PID: ${child.pid}). Monitoring ${projects.length} project(s).`, timestamp: Date.now() }]);
            } catch (err: any) {
                setMessages(prev => [...prev, { role: 'assistant', content: `Failed to start daemon: ${err.message}`, timestamp: Date.now() }]);
            }
            return true;
        }

        if (lower === '/daemon stop') {
            setShowBanner(false);
            const pidPath = getPidPath();
            let pid: number | null = null;
            try {
                if (fs.existsSync(pidPath)) {
                    const parsed = parseInt(fs.readFileSync(pidPath, 'utf-8').trim());
                    if (!isNaN(parsed)) { try { process.kill(parsed, 0); pid = parsed; } catch {} }
                }
            } catch {}
            if (!pid) {
                setMessages(prev => [...prev, { role: 'assistant', content: 'Daemon is not running.', timestamp: Date.now() }]);
                return true;
            }
            try {
                process.kill(pid, 'SIGTERM');
                try { if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath); } catch {}
                setMessages(prev => [...prev, { role: 'assistant', content: `Daemon stopped (PID: ${pid}).`, timestamp: Date.now() }]);
            } catch (err: any) {
                setMessages(prev => [...prev, { role: 'assistant', content: `Failed to stop daemon: ${err.message}`, timestamp: Date.now() }]);
            }
            return true;
        }

        // ─── Session Commands ───
        if (lower === '/session new' || lower.startsWith('/session new ')) {
            const name = text.substring('/session new'.length).trim() || undefined;
            props.session.newSession(name);
            setMessages([]);
            setShowBanner(false);
            setMessages([{ role: 'assistant', content: `New session started: **${props.session.getSessionName()}**`, timestamp: Date.now() }]);
            return true;
        }

        if (lower === '/session list') {
            setShowBanner(false);
            const sessions = props.session.listSessions();
            if (sessions.length === 0) {
                setMessages(prev => [...prev, { role: 'assistant', content: 'No saved sessions found.', timestamp: Date.now() }]);
            } else {
                const lines = sessions.map(s => {
                    const marker = s.id === props.session.getSessionId() ? ' (current)' : '';
                    return `- \`${s.id}\` — **${s.name}** (${s.messageCount} messages)${marker}`;
                });
                setMessages(prev => [...prev, { role: 'assistant', content: `## Saved Sessions\n\n${lines.join('\n')}`, timestamp: Date.now() }]);
            }
            return true;
        }

        if (lower.startsWith('/session switch ')) {
            const targetId = text.substring('/session switch '.length).trim();
            setShowBanner(false);
            if (props.session.loadSession(targetId)) {
                const history = props.session.getHistory();
                const restored: ChatMessage[] = history
                    .filter(m => m.role === 'user' || m.role === 'assistant')
                    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
                restored.push({ role: 'assistant', content: `Switched to session: **${props.session.getSessionName()}**`, timestamp: Date.now() });
                setMessages(restored);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: `Session \`${targetId}\` not found. Use \`/session list\` to see available sessions.`, timestamp: Date.now() }]);
            }
            return true;
        }

        if (lower === '/session save') {
            props.session.saveSession();
            setShowBanner(false);
            setMessages(prev => [...prev, { role: 'assistant', content: `Session saved: **${props.session.getSessionName()}** (\`${props.session.getSessionId()}\`)`, timestamp: Date.now() }]);
            return true;
        }

        // ─── Git / Tool Commands ───
        if (lower === '/status' || lower === 'status' || lower === 'git status') {
            setShowBanner(false);
            setMessages(prev => [
                ...prev,
                { role: 'tool', content: formatToolMessage('git', 'Reading repository status...') },
                { role: 'assistant', content: props.tools.getGitStatus(), timestamp: Date.now() },
            ]);
            return true;
        }

        if (lower === '/diff' || lower === 'diff' || lower === 'git diff') {
            setShowBanner(false);
            setMessages(prev => [
                ...prev,
                { role: 'tool', content: formatToolMessage('git', 'Reading unstaged diff...') },
                { role: 'assistant', content: props.tools.getGitDiff(), timestamp: Date.now() },
            ]);
            return true;
        }

        if (lower === '/files' || lower === 'files' || lower === 'ls') {
            setShowBanner(false);
            setMessages(prev => [
                ...prev,
                { role: 'tool', content: formatToolMessage('fs', 'Scanning project file tree...') },
                { role: 'assistant', content: props.tools.getFileList(), timestamp: Date.now() },
            ]);
            return true;
        }

        // ─── Search ───
        if (lower.startsWith('/search ') || lower === '/search') {
            const pattern = text.substring('/search'.length).trim();
            setShowBanner(false);
            if (!pattern) {
                setMessages(prev => [...prev, { role: 'assistant', content: 'Usage: `/search <pattern>`', timestamp: Date.now() }]);
                return true;
            }
            setMessages(prev => [...prev, { role: 'tool', content: formatToolMessage('search', `Searching files for: ${pattern}`) }]);
            const isWin = process.platform === 'win32';
            const grepCmd = isWin
                ? `findstr /s /i /n "${pattern}" *`
                : `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" "${pattern}" .`;
            const result = props.tools.executeShellCommand(grepCmd);
            setMessages(prev => [...prev, { role: 'assistant', content: result, timestamp: Date.now() }]);
            return true;
        }

        if (lower.startsWith('cat ') || lower.startsWith('read ')) {
            const filePath = text.substring(lower.startsWith('cat') ? 4 : 5).trim();
            setShowBanner(false);
            setMessages(prev => [
                ...prev,
                { role: 'tool', content: formatToolMessage('fs', `Reading file: ${filePath}`) },
                { role: 'assistant', content: props.tools.readFile(filePath), timestamp: Date.now() },
            ]);
            return true;
        }

        if (lower.startsWith('run ') || lower.startsWith('exec ') || lower.startsWith('$ ')) {
            let shellCmd: string;
            if (lower.startsWith('$ ')) shellCmd = text.substring(2).trim();
            else if (lower.startsWith('run ')) shellCmd = text.substring(4).trim();
            else shellCmd = text.substring(5).trim();

            setShowBanner(false);
            setMessages(prev => [
                ...prev,
                { role: 'tool', content: formatToolMessage('shell', `Executing: ${shellCmd}`) },
                { role: 'assistant', content: props.tools.executeShellCommand(shellCmd), timestamp: Date.now() },
            ]);
            return true;
        }

        return false;
    }, [props, exit, getSystemPrompt, watchEnabled]);

    // ─── Handle submit ───
    const handleSubmit = useCallback(async (text: string) => {
        // If the palette already intercepted this Enter, skip
        if (paletteInterceptedRef.current) {
            paletteInterceptedRef.current = false;
            return;
        }

        setInput('');
        setShowPalette(false);

        // Check for slash/built-in commands first
        const wasCommand = await handleCommand(text);
        if (wasCommand) return;

        // Regular AI query
        setShowBanner(false);
        setMessages(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
        props.session.addUserMessage(text);
        setIsThinking(true);
        setScrollOffset(Number.MAX_SAFE_INTEGER); // auto-scroll to bottom (clamped by ChatView)

        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        const TOOL_CALL_RE = /^\[TOOL_CALL:\s*(.+?)\]$/gm;
        const MAX_TOOL_ROUNDS = 3;
        // Cache system prompt once — avoids re-fetching file list/git on every round
        const systemPrompt = getSystemPrompt();

        try {
            const startTime = Date.now();
            let conversationMessages: { role: 'user' | 'assistant' | 'tool'; content: string }[] = [
                { role: 'user', content: text },
            ];

            let finalContent = '';
            let totalPromptTokens = 0;
            let totalCompletionTokens = 0;

            // Agentic loop: call AI, parse tool calls, feed results, repeat
            for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
                // Keep only the last 6 messages to cap token growth in long loops
                const recentMessages = conversationMessages.slice(-6);
                const fullPrompt = recentMessages.map(m => {
                    if (m.role === 'user') return `User: ${m.content}`;
                    if (m.role === 'tool') return `Tool Result:\n${m.content}`;
                    return `Assistant: ${m.content}`;
                }).join('\n\n');

                const response = await aiProviderRef.current.analyze(fullPrompt, systemPrompt, abortController.signal);

                if (response.usage) {
                    totalPromptTokens += response.usage.promptTokens;
                    totalCompletionTokens += response.usage.completionTokens;
                }

                const aiText = response.content;
                conversationMessages.push({ role: 'assistant', content: aiText });

                // Parse tool calls
                const toolCalls: string[] = [];
                let match: RegExpExecArray | null;
                const re = new RegExp(TOOL_CALL_RE.source, 'gm');
                while ((match = re.exec(aiText)) !== null) {
                    toolCalls.push(match[1].trim());
                }

                if (toolCalls.length === 0 || round === MAX_TOOL_ROUNDS) {
                    // No more tool calls — this is the final response
                    // Strip tool call lines from the displayed content
                    finalContent = aiText.replace(/^\[TOOL_CALL:\s*.+?\]\s*$/gm, '').trim();
                    break;
                }

                // Execute each tool call and show in UI
                const toolResults: string[] = [];
                for (const tc of toolCalls) {
                    setMessages(prev => [...prev, { role: 'tool', content: formatToolMessage('ai-tool', `Running: ${tc}`) }]);
                    const result = await executeToolForAI(tc);
                    toolResults.push(`[${tc}]:\n${result}`);
                }

                const combinedResults = toolResults.join('\n\n');
                conversationMessages.push({ role: 'tool', content: combinedResults });
            }

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            setIsThinking(false);

            props.session.addAssistantMessage(finalContent);
            if (totalPromptTokens > 0 || totalCompletionTokens > 0) {
                props.session.trackUsage(totalPromptTokens, totalCompletionTokens);
            }

            // Auto-name session from first AI response
            if (messages.filter(m => m.role === 'user').length <= 1) {
                autoNameSession(text, finalContent);
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: finalContent,
                metadata: `${configRef.current.aiProvider}/${configRef.current.model} · ${elapsed}s`,
                timestamp: Date.now(),
            }]);
            setScrollOffset(Number.MAX_SAFE_INTEGER); // show newest message
        } catch (error: any) {
            setIsThinking(false);
            if (error.name === 'AbortError') {
                setMessages(prev => [...prev, { role: 'assistant', content: '_Response stopped._', timestamp: Date.now() }]);
                return;
            }
            props.session.addAssistantMessage(`[Error: ${error.message}]`);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `**Error:** ${error.message}`,
                timestamp: Date.now(),
            }]);
        }
    }, [handleCommand, getSystemPrompt, props, messages, executeToolForAI]);

    // ─── Auto-name session ───
    const autoNameSession = useCallback((userText: string, assistantText: string) => {
        // Generate a short name from the user's first message
        const words = userText.trim().split(/\s+/).slice(0, 6);
        let name = words.join(' ');
        if (name.length > 40) name = name.substring(0, 37) + '...';
        if (name.length < 3) name = 'Chat session';
        // Capitalize first letter
        name = name.charAt(0).toUpperCase() + name.slice(1);
        props.session.setSessionName(name);
    }, [props.session]);

    // ─── Keyboard shortcuts ───

    // Update palette click handler every render (gives it a fresh closure over state/callbacks).
    // The mouse useEffect reads this ref so it never holds stale state.
    handlePaletteClickRef.current = (_x: number, clickY: number) => {
        if (!showPalette || configEditMode) return;
        const filtered = getPaletteFiltered(SLASH_COMMANDS, input);
        if (filtered.length === 0) return;
        const query = (input.startsWith('/') ? input.slice(1) : input).toLowerCase().trim();
        const isSubMode = PARENT_COMMANDS.includes(query);
        const extraRows = isSubMode ? 1 : 0; // breadcrumb line
        const ph = Math.min(filtered.length + 2 + extraRows, 14); // border(2) + optional breadcrumb + items
        const inputH = 3;   // input area height
        const statusH = 2;  // status bar height (Ink renders 2 rows: bar + trailing line)
        const paletteBottom = rows - statusH - inputH; // last row of palette (0-indexed from top? no, 1-indexed)
        const paletteTop = paletteBottom - ph + 1;
        // Items start after top border (+ 1) and optional breadcrumb (+ extraRows)
        const itemStartY = paletteTop + 1 + extraRows;
        const itemIndex = clickY - itemStartY;
        if (itemIndex >= 0 && itemIndex < filtered.length) {
            const cmd = '/' + filtered[itemIndex].name;
            setInput('');
            setShowPalette(false);
            handleCommand(cmd);
        }
    };

    useInput((char, key) => {
        // Esc — stop AI response if in progress
        if (key.escape && isThinking) {
            abortControllerRef.current?.abort();
            return;
        }

        // Command palette navigation
        if (showPalette) {
            if (key.downArrow) {
                setPaletteIndex(prev => prev + 1);
                return;
            }
            if (key.upArrow) {
                setPaletteIndex(prev => Math.max(0, prev - 1));
                return;
            }
            if (key.tab || key.return) {
                // Execute the currently highlighted item using the same filtering logic as the UI
                const filtered = getPaletteFiltered(SLASH_COMMANDS, input);
                if (filtered[paletteIndex]) {
                    const cmd = '/' + filtered[paletteIndex].name;
                    // Signal handleSubmit to skip (Enter fires on both useInput and ink-text-input)
                    if (key.return) paletteInterceptedRef.current = true;
                    setInput('');
                    setShowPalette(false);
                    handleCommand(cmd);
                }
                return;
            }
        }

        // Ctrl+C — stop AI response if thinking, otherwise show exit hint
        if (key.ctrl && char === 'c') {
            if (isThinking) {
                abortControllerRef.current?.abort();
            } else {
                setShowBanner(false);
                setMessages(prev => [...prev, { role: 'assistant', content: 'Use **/quit** to exit Watcher.', timestamp: Date.now() }]);
            }
            return;
        }

        // Block remaining shortcuts when config editor is open
        if (configEditMode) return;

        // Ctrl+L — clear
        if (key.ctrl && char === 'l') {
            props.session.clear();
            setMessages([]);
            setScrollOffset(0);
            return;
        }

        // Ctrl+N — new session
        if (key.ctrl && char === 'n') {
            props.session.newSession();
            setMessages([]);
            setShowBanner(false);
            setMessages([{ role: 'assistant', content: `New session started: **${props.session.getSessionName()}**`, timestamp: Date.now() }]);
            return;
        }

        // Ctrl+A — list sessions
        if (key.ctrl && char === 'a') {
            setShowBanner(false);
            const sessions = props.session.listSessions();
            if (sessions.length === 0) {
                setMessages(prev => [...prev, { role: 'assistant', content: 'No saved sessions found.', timestamp: Date.now() }]);
            } else {
                const lines = sessions.map(s => {
                    const marker = s.id === props.session.getSessionId() ? ' ← current' : '';
                    return `- \`${s.id}\` — **${s.name}** (${s.messageCount} messages)${marker}`;
                });
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `## Sessions\n\n${lines.join('\n')}\n\nUse \`/session switch <id>\` to switch.`,
                    timestamp: Date.now(),
                }]);
            }
            return;
        }

        // PageUp / PageDown for scrolling
        if (key.pageUp) {
            setScrollOffset(prev => Math.max(0, prev - 10));
            return;
        }
        if (key.pageDown) {
            setScrollOffset(prev => prev + 10);
            return;
        }

        // UpArrow / DownArrow for scrolling (when not in palette)
        if (!showPalette) {
            if (key.upArrow) {
                setScrollOffset(prev => Math.max(0, prev - 1));
                return;
            }
            if (key.downArrow) {
                setScrollOffset(prev => prev + 1);
                return;
            }
        }
    });

    // ─── Command palette toggle on input change ───
    useEffect(() => {
        if (input.startsWith('/')) {
            setShowPalette(true);
            setPaletteIndex(0);
        } else {
            setShowPalette(false);
        }
    }, [input]);

    // ─── Layout dimensions ───
    // When the command palette is visible it takes up vertical space — shrink chatHeight accordingly
    // so ChatView + palette + input always fit within the terminal without overflow.
    let paletteRows = 0;
    if (showPalette && !configEditMode) {
        const paletteQuery = (input.startsWith('/') ? input.slice(1) : input).toLowerCase().trim();
        const isSubMode = PARENT_COMMANDS.includes(paletteQuery);
        const filtered = getPaletteFiltered(SLASH_COMMANDS, input);
        const extraRows = isSubMode ? 1 : 0;
        paletteRows = filtered.length > 0 ? Math.min(filtered.length + 2 + extraRows, 14) : 0;
    }
    const chatHeight = Math.max(3, rows - 5 - paletteRows); // 3 for input + 2 for status bar + palette

    return (
        <Box flexDirection="column" height={rows} width={cols}>
            <Box flexDirection="row" flexGrow={1}>
                {/* Left panel — 70% */}
                <Box flexDirection="column" width="70%">
                    {configEditMode ? (
                        <ConfigEditor
                            config={configRef.current}
                            apiKeyIsSet={configEditorKeyStatus}
                            onSave={handleConfigSave}
                            onCancel={handleConfigCancel}
                            fetchModels={handleFetchModels}
                        />
                    ) : showBanner ? (
                        <Banner
                            projectName={projectName}
                            provider={configRef.current.aiProvider}
                            model={configRef.current.model}
                            cwd={props.projectPath}
                        />
                    ) : (
                        <ChatView
                            messages={messages}
                            isThinking={isThinking}
                            height={chatHeight}
                            width={Math.floor(cols * 0.7)}
                            scrollOffset={scrollOffset}
                        />
                    )}

                    {/* Command palette and input — hidden when config editor is open */}
                    {!configEditMode && (
                        <CommandPalette
                            visible={showPalette}
                            filter={input}
                            commands={SLASH_COMMANDS}
                            selectedIndex={paletteIndex}
                            onSelect={(fullName) => {
                                setInput('');
                                setShowPalette(false);
                                handleCommand('/' + fullName);
                            }}
                        />
                    )}

                    {!configEditMode && (
                        <InputArea
                            value={input}
                            onChange={setInput}
                            onSubmit={handleSubmit}
                            placeholder="Ask anything, or type / for commands..."
                            isActive={!isThinking}
                        />
                    )}
                </Box>

                {/* Right panel — 30% */}
                <SidePanel
                    projectName={projectName}
                    branchName={branchName}
                    sessionName={props.session.getSessionName()}
                    sessionId={props.session.getSessionId()}
                    changes={sessionChanges}
                    analyses={sessionAnalyses}
                    tokens={props.session.getTotalTokens()}
                    provider={configRef.current.aiProvider}
                    model={configRef.current.model}
                    autoDocsEnabled={configRef.current.features.autoDocumentation}
                    activityLog={activityLog}
                />
            </Box>

            {/* Status bar */}
            <StatusBar
                mode="Watcher"
                model={configRef.current.model}
                provider={configRef.current.aiProvider}
            />
        </Box>
    );
}

// ─── Render function (called from modes/app.ts) ──────────────

export async function renderApp(props: AppProps): Promise<void> {
    const { waitUntilExit } = render(
        React.createElement(WatcherApp, props),
        { exitOnCtrlC: false },
    );
    await waitUntilExit();
}
