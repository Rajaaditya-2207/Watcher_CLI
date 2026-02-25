import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { ConfigManager } from '../config/ConfigManager';
import { WatcherDatabase } from '../database/Database';
import { GitService } from '../git/GitService';
import { CommandOptions, WatcherConfig } from '../types';
import path from 'path';

export async function initCommand(options: CommandOptions): Promise<void> {
  try {
    logger.header('🚀 Initializing Watcher');

    const projectPath = process.cwd();
    const projectName = path.basename(projectPath);
    const configManager = new ConfigManager(projectPath);

    // Check if already initialized
    if (configManager.exists() && !options.force) {
      logger.warn('Watcher is already initialized in this project.');
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Do you want to re-initialize?',
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

    // Interactive configuration
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'aiProvider',
        message: 'Select AI provider:',
        choices: [
          { name: 'OpenRouter', value: 'openrouter' },
          { name: 'AWS Bedrock', value: 'bedrock' },
          { name: 'Groq', value: 'groq' },
        ],
        default: 'openrouter',
      },
      {
        type: 'input',
        name: 'watchInterval',
        message: 'Watch interval (ms):',
        default: '5000',
        validate: (input) => {
          const num = parseInt(input);
          return !isNaN(num) && num > 0 ? true : 'Please enter a valid number';
        },
      },
      {
        type: 'confirm',
        name: 'autoDocumentation',
        message: 'Enable auto-documentation?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'technicalDebt',
        message: 'Enable technical debt tracking?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'analytics',
        message: 'Enable analytics?',
        default: true,
      },
    ]);

    // Create configuration
    const config: WatcherConfig = {
      ...configManager.getDefaultConfig(),
      aiProvider: answers.aiProvider,
      watchInterval: parseInt(answers.watchInterval),
      features: {
        autoDocumentation: answers.autoDocumentation,
        technicalDebt: answers.technicalDebt,
        analytics: answers.analytics,
      },
    };

    logger.startSpinner('Saving configuration...');
    await configManager.save(config);
    logger.stopSpinner(true, 'Configuration saved');

    // Initialize database
    logger.startSpinner('Initializing database...');
    const db = new WatcherDatabase(projectPath);
    db.saveProject({
      name: projectName,
      path: projectPath,
      techStack: [],
      architecture: 'Unknown',
    });
    db.close();
    logger.stopSpinner(true, 'Database initialized');

    logger.box(
      `Watcher initialized successfully!\n\nNext steps:\n  1. Configure your API key (coming soon)\n  2. Run: watcher watch\n  3. Start coding!`,
      '✨ Success'
    );
  } catch (error: any) {
    logger.error(`Initialization failed: ${error.message}`);
    process.exit(1);
  }
}
