import inquirer from 'inquirer';
import fs from 'fs';
import { logger } from '../utils/logger';
import { ConfigManager } from '../config/ConfigManager';
import { WatcherDatabase } from '../database/Database';
import { GitService } from '../git/GitService';
import { addProject } from '../daemon/daemonRegistry';
import { CommandOptions } from '../types';
import path from 'path';

export async function initCommand(options: CommandOptions): Promise<void> {
  try {
    logger.header('Initializing Watcher for this project');

    const projectPath = process.cwd();
    const projectName = path.basename(projectPath);

    // Global config must already exist (created by first-run onboarding)
    const configManager = new ConfigManager(projectPath);
    if (!configManager.exists()) {
      logger.error('Watcher is not set up yet. Run "watcher" (no arguments) to complete first-time setup.');
      process.exit(1);
    }

    // Check if this project already has a local database
    const localDbPath = path.join(projectPath, '.watcher', 'watcher.db');
    if (fs.existsSync(localDbPath) && !options.force) {
      logger.warn('This project is already initialized.');
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Re-initialize the local project database?',
          default: false,
        },
      ]);

      if (!proceed) {
        logger.info('Initialization cancelled.');
        return;
      }
    }

    // Check Git repository
    const gitService = new GitService(projectPath);
    if (!gitService.isGitRepository()) {
      logger.warn('This is not a Git repository. Some features may be limited.');
    }

    // Initialize local database
    logger.startSpinner('Initializing project database...');
    const db = new WatcherDatabase(projectPath);
    await db.initialize();
    db.saveProject({
      name: projectName,
      path: projectPath,
      techStack: [],
      architecture: 'Unknown',
    });
    db.close();
    logger.stopSpinner(true, 'Project database initialized');

    // Register in global daemon registry
    addProject(projectPath, projectName);
    logger.success('Project registered for background monitoring.');

    // Ask about daemon
    const { enableDaemon } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enableDaemon',
        message: 'Enable background monitoring? (runs even when no terminal is open)',
        default: true,
      },
    ]);

    logger.box(
      `Project initialized.\n\nRun "watcher" to open the interactive TUI.${enableDaemon ? '\nRun "watcher daemon start" to start background monitoring.' : ''}`,
      'Done'
    );

    if (enableDaemon) {
      logger.info('Run: watcher daemon start   (to start background service)');
      logger.info('Run: watcher daemon enable  (to auto-start on boot)');
    }
  } catch (error: any) {
    logger.error(`Initialization failed: ${error.message}`);
    process.exit(1);
  }
}
