import { logger } from '../utils/logger';
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
import chalk from 'chalk';
import path from 'path';

export async function watchCommand(options: CommandOptions): Promise<void> {
  try {
    const projectPath = process.cwd();
    const configManager = new ConfigManager(projectPath);
    const credentialManager = new CredentialManager(projectPath);

    // Check if initialized
    if (!configManager.exists()) {
      logger.error('Watcher is not initialized. Run: watcher init');
      process.exit(1);
    }

    const config = await configManager.load();
    const gitService = new GitService(projectPath);

    // Initialize database
    const db = new WatcherDatabase(projectPath);
    await db.initialize();

    // Documentation generators
    const progressGen = new ProgressGenerator(db, projectPath);
    const changelogGen = new ChangelogGenerator(db, projectPath);

    // Check for API key
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
        logger.success('AI analysis enabled');
      }
    } else {
      logger.warn('AI analysis disabled (no API key). Run: watcher config');
    }

    logger.header('Starting Watcher');

    // Display current status
    if (gitService.isGitRepository()) {
      const status = gitService.getStatus();
      logger.info(`Branch: ${chalk.cyan(status.branch)}`);
      logger.info(`Watching: ${chalk.cyan(projectPath)}`);
    }

    // Initialize file monitor
    const monitor = new FileMonitor(projectPath, config.ignorePatterns);
    const changeBuffer: FileEvent[] = [];
    let analysisTimeout: NodeJS.Timeout | null = null;

    monitor.on('ready', () => {
      logger.success('File monitor ready');
      logger.info(chalk.dim('Watching for changes... (Press Ctrl+C to stop)'));
    });

    monitor.on('fileChange', (event: FileEvent) => {
      const label =
        event.type === 'add' ? 'ADD' : event.type === 'change' ? 'MOD' : 'DEL';
      logger.info(`${chalk.yellow(`[${label}]`)} ${event.path}`);

      if (options.verbose) {
        // Show git diff for changed files
        if (event.type === 'change' && gitService.isGitRepository()) {
          const diff = gitService.getUnstagedDiff(event.path);
          if (diff) {
            console.log(chalk.dim(diff.substring(0, 200) + '...'));
          }
        }
      }

      // Buffer changes for batch analysis
      if (analyzer && config.features.autoDocumentation) {
        changeBuffer.push(event);

        // Clear existing timeout
        if (analysisTimeout) {
          clearTimeout(analysisTimeout);
        }

        // Analyze after 5 seconds of no changes
        analysisTimeout = setTimeout(async () => {
          await analyzeBufferedChanges(
            changeBuffer,
            analyzer!,
            gitService,
            db,
            progressGen,
            changelogGen,
            projectPath
          );
          changeBuffer.length = 0;
        }, 5000);
      }
    });

    monitor.on('error', (error) => {
      logger.error(`Monitor error: ${error.message}`);
    });

    // Start monitoring
    monitor.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.blank();
      logger.info('Stopping Watcher...');
      if (analysisTimeout) {
        clearTimeout(analysisTimeout);
      }
      monitor.stop();
      db.close();
      logger.success('Watcher stopped.');
      process.exit(0);
    });
  } catch (error: any) {
    logger.error(`Watch failed: ${error.message}`);
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
  projectPath: string
): Promise<void> {
  if (changes.length === 0) return;

  logger.blank();
  logger.info(chalk.cyan('Analyzing changes...'));

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

    // Save to database
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

      // Update documentation
      try {
        await progressGen.generate();
        await changelogGen.generate();
        logger.success('Documentation updated.');
      } catch (docErr: any) {
        logger.warn(`Documentation update skipped: ${docErr.message}`);
      }
    }

    logger.box(
      `${analysis.summary}\n\nCategory: ${analysis.category}\nImpact: ${analysis.impact}\nAffected: ${analysis.affectedAreas.join(', ') || 'N/A'}`,
      'Analysis Result'
    );
  } catch (error: any) {
    logger.warn(`Analysis failed: ${error.message}`);
  }
}
