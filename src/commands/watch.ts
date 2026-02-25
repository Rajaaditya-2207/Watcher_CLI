import { logger } from '../utils/logger';
import { ConfigManager } from '../config/ConfigManager';
import { FileMonitor } from '../monitor/FileMonitor';
import { GitService } from '../git/GitService';
import { CommandOptions } from '../types';
import chalk from 'chalk';

export async function watchCommand(options: CommandOptions): Promise<void> {
  try {
    const projectPath = process.cwd();
    const configManager = new ConfigManager(projectPath);

    // Check if initialized
    if (!configManager.exists()) {
      logger.error('Watcher is not initialized. Run: watcher init');
      process.exit(1);
    }

    const config = await configManager.load();
    const gitService = new GitService(projectPath);

    logger.header('👀 Starting Watcher');

    // Display current status
    if (gitService.isGitRepository()) {
      const status = gitService.getStatus();
      logger.info(`Branch: ${chalk.cyan(status.branch)}`);
      logger.info(`Watching: ${chalk.cyan(projectPath)}`);
    }

    // Initialize file monitor
    const monitor = new FileMonitor(projectPath, config.ignorePatterns);

    monitor.on('ready', () => {
      logger.success('File monitor ready');
      logger.info(chalk.dim('Watching for changes... (Press Ctrl+C to stop)'));
    });

    monitor.on('fileChange', (event) => {
      const icon = event.type === 'add' ? '➕' : event.type === 'change' ? '📝' : '🗑️';
      logger.info(`${icon} ${chalk.yellow(event.type.toUpperCase())} ${event.path}`);

      if (options.verbose) {
        // Show git diff for changed files
        if (event.type === 'change' && gitService.isGitRepository()) {
          const diff = gitService.getUnstagedDiff(event.path);
          if (diff) {
            console.log(chalk.dim(diff.substring(0, 200) + '...'));
          }
        }
      }
    });

    monitor.on('error', (error) => {
      logger.error(`Monitor error: ${error.message}`);
    });

    // Start monitoring
    monitor.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('\nStopping Watcher...');
      monitor.stop();
      logger.success('Watcher stopped');
      process.exit(0);
    });
  } catch (error: any) {
    logger.error(`Watch failed: ${error.message}`);
    process.exit(1);
  }
}
