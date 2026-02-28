#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { loadRegistry, getPidPath, getLogPath, RegisteredProject } from './daemonRegistry';
import { ConfigManager } from '../config/ConfigManager';
import { CredentialManager } from '../credentials/CredentialManager';
import { WatcherDatabase } from '../database/Database';
import { AIProviderFactory } from '../ai/AIProviderFactory';
import { SemanticAnalyzer } from '../ai/SemanticAnalyzer';
import { ProgressGenerator } from '../documentation/ProgressGenerator';
import { ChangelogGenerator } from '../documentation/ChangelogGenerator';
import { GitService } from '../git/GitService';

interface ProjectWatcher {
    project: RegisteredProject;
    watcher: chokidar.FSWatcher;
    changeBuffer: { path: string; type: string }[];
    timeout: NodeJS.Timeout | null;
    db: WatcherDatabase;
    analyzer: SemanticAnalyzer | null;
    progressGen: ProgressGenerator;
    changelogGen: ChangelogGenerator;
    gitService: GitService;
}

const logFile = getLogPath();

function log(message: string): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, line);
}

async function main(): Promise<void> {
    // Write PID
    const pidPath = getPidPath();
    fs.writeFileSync(pidPath, String(process.pid));

    log('Daemon started (PID: ' + process.pid + ')');

    // Load registered projects
    const projects = loadRegistry();
    if (projects.length === 0) {
        log('No projects registered. Exiting.');
        process.exit(0);
    }

    log(`Monitoring ${projects.length} project(s)`);

    const watchers: ProjectWatcher[] = [];

    for (const project of projects) {
        try {
            if (!fs.existsSync(project.path)) {
                log(`Project not found: ${project.path}. Skipping.`);
                continue;
            }

            const configManager = new ConfigManager(project.path);
            if (!configManager.exists()) {
                log(`No config for: ${project.name}. Skipping.`);
                continue;
            }

            const config = await configManager.load();
            const credentialManager = new CredentialManager(project.path);
            const db = new WatcherDatabase(project.path);
            await db.initialize();

            const gitService = new GitService(project.path);
            const progressGen = new ProgressGenerator(db, project.path);
            const changelogGen = new ChangelogGenerator(db, project.path);

            // Setup AI analyzer
            let analyzer: SemanticAnalyzer | null = null;
            const hasKey = await credentialManager.hasApiKey(config.aiProvider);
            if (hasKey) {
                const apiKey = await credentialManager.getApiKey(config.aiProvider);
                if (apiKey) {
                    const provider = AIProviderFactory.create({
                        provider: config.aiProvider as any,
                        apiKey,
                        model: config.model,
                    });
                    analyzer = new SemanticAnalyzer(provider);
                }
            }

            // Create file watcher
            const ignorePatterns = config.ignorePatterns || [
                'node_modules/**', 'dist/**', 'build/**', '*.log', '.git/**', 'coverage/**', '.watcher/**',
            ];

            const watcher = chokidar.watch(project.path, {
                ignored: ignorePatterns,
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: { stabilityThreshold: 500 },
            });

            const pw: ProjectWatcher = {
                project,
                watcher,
                changeBuffer: [],
                timeout: null,
                db,
                analyzer,
                progressGen,
                changelogGen,
                gitService,
            };

            watcher.on('add', (filePath) => bufferChange(pw, filePath, 'add'));
            watcher.on('change', (filePath) => bufferChange(pw, filePath, 'change'));
            watcher.on('unlink', (filePath) => bufferChange(pw, filePath, 'unlink'));

            watcher.on('ready', () => {
                log(`Watching: ${project.name} (${project.path})`);
            });

            watcher.on('error', (error) => {
                log(`Watcher error for ${project.name}: ${error.message}`);
            });

            watchers.push(pw);
        } catch (error: any) {
            log(`Failed to setup watcher for ${project.name}: ${error.message}`);
        }
    }

    // Periodic registry reload (every 60 seconds)
    setInterval(() => {
        reloadRegistry(watchers);
    }, 60000);

    // Handle shutdown
    const shutdown = () => {
        log('Daemon shutting down...');
        for (const pw of watchers) {
            pw.watcher.close();
            if (pw.timeout) clearTimeout(pw.timeout);
            pw.db.close();
        }
        try {
            fs.unlinkSync(pidPath);
        } catch { }
        log('Daemon stopped.');
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

function bufferChange(pw: ProjectWatcher, filePath: string, type: string): void {
    const relative = path.relative(pw.project.path, filePath);
    pw.changeBuffer.push({ path: relative, type });

    log(`[${pw.project.name}] ${type.toUpperCase()}: ${relative}`);

    // Clear previous timeout
    if (pw.timeout) clearTimeout(pw.timeout);

    // Analyze after 10 seconds of no changes
    pw.timeout = setTimeout(async () => {
        await processChanges(pw);
    }, 10000);
}

async function processChanges(pw: ProjectWatcher): Promise<void> {
    if (pw.changeBuffer.length === 0) return;

    const changes = [...pw.changeBuffer];
    pw.changeBuffer.length = 0;

    log(`[${pw.project.name}] Processing ${changes.length} change(s)...`);

    if (!pw.analyzer) {
        log(`[${pw.project.name}] No AI analyzer configured. Skipping analysis.`);
        return;
    }

    try {
        const diff = pw.gitService.isGitRepository() ? pw.gitService.getUnstagedDiff() : '';

        const analysis = await pw.analyzer.analyzeChanges({
            files: changes.map((c) => ({
                path: c.path,
                changeType: c.type === 'add' ? 'added' : c.type === 'unlink' ? 'deleted' : 'modified',
            })),
            diff,
            projectContext: {
                name: pw.project.name,
                techStack: [],
                architecture: 'Unknown',
            },
        });

        // Save to database
        const projectId = pw.db.getProjectId(pw.project.path);
        if (projectId !== null) {
            pw.db.saveChange({
                projectId,
                category: analysis.category,
                summary: analysis.summary,
                description: analysis.technicalDetails,
                impact: analysis.impact,
                filesChanged: changes.length,
                fileDetails: changes.map((c) => ({
                    filePath: c.path,
                    changeType: c.type === 'add' ? 'added' : c.type === 'unlink' ? 'deleted' : 'modified',
                })),
            });

            // Update documentation
            try {
                await pw.progressGen.generate();
                await pw.changelogGen.generate();
                log(`[${pw.project.name}] Documentation updated.`);
            } catch (docErr: any) {
                log(`[${pw.project.name}] Doc update error: ${docErr.message}`);
            }
        }

        log(`[${pw.project.name}] Analysis complete: ${analysis.summary}`);
    } catch (error: any) {
        log(`[${pw.project.name}] Analysis failed: ${error.message}`);
    }
}

function reloadRegistry(watchers: ProjectWatcher[]): void {
    // Check for new projects added to registry
    const registry = loadRegistry();
    const watchedPaths = new Set(watchers.map((w) => path.resolve(w.project.path)));

    for (const project of registry) {
        if (!watchedPaths.has(path.resolve(project.path))) {
            log(`New project detected in registry: ${project.name}. Restart daemon to monitor.`);
        }
    }
}

main().catch((error) => {
    log(`Daemon fatal error: ${error.message}`);
    process.exit(1);
});
