import { TuiScreen } from '../tui/Screen';
import { COLORS } from '../tui/theme';
import { SidePanel } from '../tui/widgets/SidePanel';
import { StatusBar } from '../tui/widgets/StatusBar';
import { ConfigManager } from '../config/ConfigManager';
import { FileMonitor, FileEvent } from '../monitor/FileMonitor';
import { GitService } from '../git/GitService';
import { CredentialManager } from '../credentials/CredentialManager';
import { AIProviderFactory } from '../ai/AIProviderFactory';
import { SemanticAnalyzer } from '../ai/SemanticAnalyzer';
import { WatcherDatabase } from '../database/Database';
import { ProgressGenerator } from '../documentation/ProgressGenerator';
import { ChangelogGenerator } from '../documentation/ChangelogGenerator';
import { CommandOptions } from '../types';
import blessed from 'blessed';
import path from 'path';
import fs from 'fs';

export async function watchCommand(options: CommandOptions): Promise<void> {
  try {
    const projectPath = process.cwd();
    const configManager = new ConfigManager(projectPath);
    const credentialManager = new CredentialManager(projectPath);

    // Check global config exists (created during first-run onboarding)
    if (!configManager.exists()) {
      console.error('Watcher is not set up yet. Run "watcher" to complete first-time setup.');
      process.exit(1);
    }

    // Check this project has been initialized locally
    const localDbPath = path.join(projectPath, '.watcher', 'watcher.db');
    if (!fs.existsSync(localDbPath)) {
      console.error('This project has not been initialized. Run: watcher init');
      process.exit(1);
    }

    const config = await configManager.load();
    const gitService = new GitService(projectPath);

    const db = new WatcherDatabase(projectPath);
    await db.initialize();

    const progressGen = new ProgressGenerator(db, projectPath);
    const changelogGen = new ChangelogGenerator(db, projectPath);

    const hasApiKey = await credentialManager.hasApiKey(config.aiProvider);
    let analyzer: SemanticAnalyzer | null = null;

    if (hasApiKey) {
      const apiKey = await credentialManager.getApiKey(config.aiProvider);
      if (apiKey) {
        const aiProvider = AIProviderFactory.create({
          provider: config.aiProvider as any,
          apiKey,
          model: config.model,
        });
        analyzer = new SemanticAnalyzer(aiProvider);
      }
    }

    // ─── Create TUI ───
    const tui = new TuiScreen('Watcher — Watch');

    // Left panel: File change log (70% width)
    const changeLog = blessed.box({
      parent: tui.screen,
      top: 0,
      left: 0,
      width: '70%',
      bottom: 2,
      border: {
        type: 'line',
      },
      label: ' File Changes ',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      scrollbar: {
        style: { bg: COLORS.dimGreen },
      },
      style: {
        fg: COLORS.white,
        bg: COLORS.bg,
        border: { fg: COLORS.dimGreen },
        label: { fg: COLORS.neon, bold: true },
      },
    });

    // Right panel: Status dashboard
    const sidePanel = new SidePanel(tui.screen, {
      title: 'Status',
      width: '30%+1',
      right: 0,
    });

    // Status bar
    const statusBar = new StatusBar(tui.screen);
    statusBar.update('Watch', config.model, analyzer ? 'AI Enabled' : 'AI Disabled');

    // ─── Initialize status panel ───
    let sessionChanges = 0;
    let sessionAnalyses = 0;

    const projectName = path.basename(projectPath);
    const branchName = gitService.isGitRepository()
      ? gitService.getStatus().branch
      : 'N/A';

    function updateSidePanel(): void {
      const lines: string[] = [];

      lines.push(`{${COLORS.neon}-fg}{bold}Project{/}`);
      lines.push(`{${COLORS.white}-fg}${projectName}{/}`);
      lines.push(`{${COLORS.dimWhite}-fg}${projectPath}{/}`);
      lines.push('');

      lines.push(`{${COLORS.neon}-fg}{bold}Branch{/}`);
      lines.push(`{${COLORS.white}-fg}${branchName}{/}`);
      lines.push('');

      lines.push(`{${COLORS.neon}-fg}{bold}Session{/}`);
      lines.push(`{${COLORS.white}-fg}Changes:  ${sessionChanges}{/}`);
      lines.push(`{${COLORS.white}-fg}Analyses: ${sessionAnalyses}{/}`);
      lines.push('');

      lines.push(`{${COLORS.neon}-fg}{bold}AI Provider{/}`);
      lines.push(`{${COLORS.white}-fg}${config.aiProvider}{/}`);
      lines.push(`{${COLORS.white}-fg}${config.model}{/}`);
      lines.push(`{${COLORS.white}-fg}Status: ${analyzer ? '{' + COLORS.neon + '-fg}Active{/}' : '{' + COLORS.red + '-fg}Disabled{/}'}{/}`);
      lines.push('');

      lines.push(`{${COLORS.neon}-fg}{bold}Features{/}`);
      lines.push(`{${COLORS.white}-fg}Auto Docs:  ${config.features.autoDocumentation ? 'On' : 'Off'}{/}`);
      lines.push(`{${COLORS.white}-fg}Tech Debt:  ${config.features.technicalDebt ? 'On' : 'Off'}{/}`);
      lines.push(`{${COLORS.white}-fg}Analytics:  ${config.features.analytics ? 'On' : 'Off'}{/}`);

      sidePanel.setContent(lines.join('\n'));
    }

    updateSidePanel();

    // ─── Log helpers ───
    function addLog(line: string): void {
      const current = changeLog.getContent();
      const timestamp = new Date().toLocaleTimeString();
      changeLog.setContent(current + `\n{${COLORS.dimWhite}-fg}${timestamp}{/}  ${line}`);
      changeLog.setScrollPerc(100);
      tui.render();
    }

    addLog(`{${COLORS.neon}-fg}{bold}Watcher started{/}`);
    addLog(`{${COLORS.dimWhite}-fg}Watching: ${projectPath}{/}`);
    if (analyzer) {
      addLog(`{${COLORS.neon}-fg}✓{/} {${COLORS.white}-fg}AI analysis enabled{/}`);
    } else {
      addLog(`{${COLORS.yellow}-fg}⚠{/} {${COLORS.white}-fg}AI analysis disabled (no API key){/}`);
    }
    addLog(`{${COLORS.dimWhite}-fg}Waiting for changes...{/}`);

    tui.render();

    // ─── File Monitor ───
    const monitor = new FileMonitor(projectPath, config.ignorePatterns);
    const changeBuffer: FileEvent[] = [];
    let analysisTimeout: NodeJS.Timeout | null = null;

    monitor.on('ready', () => {
      addLog(`{${COLORS.neon}-fg}✓{/} {${COLORS.white}-fg}File monitor ready{/}`);
    });

    monitor.on('fileChange', (event: FileEvent) => {
      sessionChanges++;

      const labelColors: Record<string, string> = {
        add: COLORS.neon,
        change: COLORS.yellow,
        unlink: COLORS.red,
      };
      const labels: Record<string, string> = {
        add: 'ADD',
        change: 'MOD',
        unlink: 'DEL',
      };

      const color = labelColors[event.type] || COLORS.white;
      const label = labels[event.type] || event.type.toUpperCase();

      addLog(`{${color}-fg}[${label}]{/} {${COLORS.white}-fg}${event.path}{/}`);

      updateSidePanel();

      // Buffer changes for batch analysis
      if (analyzer && config.features.autoDocumentation) {
        changeBuffer.push(event);

        if (analysisTimeout) {
          clearTimeout(analysisTimeout);
        }

        analysisTimeout = setTimeout(async () => {
          await analyzeBufferedChanges(
            changeBuffer,
            analyzer!,
            gitService,
            db,
            progressGen,
            changelogGen,
            projectPath,
            addLog,
            () => { sessionAnalyses++; updateSidePanel(); }
          );
          changeBuffer.length = 0;
        }, 5000);
      }
    });

    monitor.on('error', (error) => {
      addLog(`{${COLORS.red}-fg}[ERR]{/} {${COLORS.white}-fg}${error.message}{/}`);
    });

    monitor.start();

    // ─── Graceful shutdown ───
    tui.screen.key(['C-c'], () => {
      if (analysisTimeout) clearTimeout(analysisTimeout);
      monitor.stop();
      db.close();
      tui.destroy();
      console.log('Watcher stopped.');
      process.exit(0);
    });

    // Keep alive
    return new Promise<void>((resolve) => {
      tui.screen.on('destroy', () => {
        monitor.stop();
        db.close();
        resolve();
      });
    });
  } catch (error: any) {
    console.error(`Watch failed: ${error.message}`);
    process.exit(1);
  }
}

async function analyzeBufferedChanges(
  changes: FileEvent[],
  analyzer: SemanticAnalyzer,
  gitService: GitService,
  db: WatcherDatabase,
  progressGen: ProgressGenerator,
  changelogGen: ChangelogGenerator,
  projectPath: string,
  addLog: (line: string) => void,
  onComplete: () => void
): Promise<void> {
  if (changes.length === 0) return;

  addLog(`{${COLORS.cyan}-fg}⚙{/} {${COLORS.dimWhite}-fg}[ai]{/} {${COLORS.white}-fg}Analyzing ${changes.length} change(s)...{/}`);

  try {
    const diff = gitService.getUnstagedDiff();

    const analysis = await analyzer.analyzeChanges({
      files: changes.map((c) => ({
        path: c.path,
        changeType:
          c.type === 'add' ? 'added' : c.type === 'unlink' ? 'deleted' : 'modified',
      })),
      diff,
      projectContext: {
        name: path.basename(projectPath),
        techStack: [],
        architecture: 'Unknown',
      },
    });

    const projectId = db.getProjectId(projectPath);
    if (projectId !== null) {
      db.saveChange({
        projectId,
        category: analysis.category,
        summary: analysis.summary,
        description: analysis.technicalDetails,
        impact: analysis.impact,
        filesChanged: changes.length,
        fileDetails: changes.map((c) => ({
          filePath: c.path,
          changeType:
            c.type === 'add' ? 'added' : c.type === 'unlink' ? 'deleted' : 'modified',
        })),
      });

      try {
        await progressGen.generate();
        await changelogGen.generate();
        addLog(`{${COLORS.neon}-fg}✓{/} {${COLORS.white}-fg}Documentation updated{/}`);
      } catch (docErr: any) {
        addLog(`{${COLORS.yellow}-fg}⚠{/} {${COLORS.dimWhite}-fg}Doc update skipped: ${docErr.message}{/}`);
      }
    }

    // Show analysis result
    addLog('');
    addLog(`{${COLORS.neon}-fg}┌─ Analysis Result ────────────────────────────┐{/}`);
    addLog(`{${COLORS.neon}-fg}│{/} {${COLORS.white}-fg}${analysis.summary}{/}`);
    addLog(`{${COLORS.neon}-fg}│{/} {${COLORS.dimWhite}-fg}Category: ${analysis.category} | Impact: ${analysis.impact}{/}`);
    if (analysis.affectedAreas.length > 0) {
      addLog(`{${COLORS.neon}-fg}│{/} {${COLORS.dimWhite}-fg}Areas: ${analysis.affectedAreas.join(', ')}{/}`);
    }
    addLog(`{${COLORS.neon}-fg}└──────────────────────────────────────────────┘{/}`);
    addLog('');

    onComplete();
  } catch (error: any) {
    addLog(`{${COLORS.red}-fg}✗{/} {${COLORS.white}-fg}Analysis failed: ${error.message}{/}`);
  }
}
