#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { displayBanner } from './ui/banner';
import { runOnboarding } from './ui/onboarding';
import { ConfigManager } from './config/ConfigManager';
import { startChatMode } from './modes/chatMode';
import { watchCommand } from './commands/watch';
import { reportCommand } from './commands/report';
import { insightsCommand } from './commands/insights';
import { configCommand } from './commands/config';
import { initCommand } from './commands/init';
import { daemonCommand } from './commands/daemon';

const NEON = chalk.hex('#39FF14');

async function main(): Promise<void> {
  // Display banner always
  displayBanner();

  const args = process.argv.slice(2);

  // If a subcommand is given, use Commander
  if (args.length > 0) {
    const program = new Command();

    program
      .name('watcher')
      .description('A CLI-based development observer that translates code changes into human-readable narratives')
      .version('0.1.0');

    program
      .command('init')
      .description('Initialize Watcher in current project')
      .option('--force', 'Force re-initialization')
      .option('--config <path>', 'Custom config file path')
      .action(initCommand);

    program
      .command('watch')
      .description('Start monitoring project changes')
      .option('--interval <ms>', 'Watch interval in milliseconds', '5000')
      .option('--verbose', 'Verbose output')
      .action(watchCommand);

    program
      .command('report')
      .description('Generate project status report')
      .option('--format <type>', 'Output format: md, json', 'md')
      .option('--since <date>', 'Include changes since date')
      .option('--output <path>', 'Output file path')
      .action(reportCommand);

    program
      .command('insights')
      .description('View development analytics and metrics')
      .option('--period <type>', 'Time period: day, week, month', 'week')
      .option('--metric <name>', 'Specific metric to display')
      .action(insightsCommand);

    program
      .command('config')
      .description('Manage configuration and API keys')
      .action(configCommand);

    // Handle daemon command manually (uses subcommands)
    if (args[0] === 'daemon') {
      await daemonCommand(args.slice(1));
      return;
    }

    program.parse(process.argv);
    return;
  }

  // Interactive mode — no subcommand given
  const projectPath = process.cwd();
  const configManager = new ConfigManager(projectPath);

  // Check if configured
  if (!configManager.exists()) {
    await runOnboarding(projectPath);
  }

  // Mode selection
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Select mode:',
      choices: [
        {
          name: NEON('Chat Mode') + chalk.dim('    — Talk to the AI agent about your repository'),
          value: 'chat',
        },
        {
          name: NEON('Watch Mode') + chalk.dim('   — Auto-monitor and log development progress'),
          value: 'watch',
        },
      ],
    },
  ]);

  if (mode === 'chat') {
    await startChatMode(projectPath);
  } else {
    await watchCommand({ verbose: false });
  }
}

main().catch((error) => {
  console.error(chalk.red(`[x] Fatal error: ${error.message}`));
  process.exit(1);
});
