#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init';
import { watchCommand } from './commands/watch';
import { reportCommand } from './commands/report';
import { insightsCommand } from './commands/insights';

const program = new Command();

program
  .name('watcher')
  .description('A CLI-based development observer that translates code changes into human-readable narratives')
  .version('0.1.0');

// Init command
program
  .command('init')
  .description('Initialize Watcher in current project')
  .option('--force', 'Force re-initialization')
  .option('--config <path>', 'Custom config file path')
  .action(initCommand);

// Watch command
program
  .command('watch')
  .description('Start monitoring project changes')
  .option('--interval <ms>', 'Watch interval in milliseconds', '5000')
  .option('--verbose', 'Verbose output')
  .action(watchCommand);

// Report command
program
  .command('report')
  .description('Generate project status report')
  .option('--format <type>', 'Output format: md, json, slack', 'md')
  .option('--since <date>', 'Include changes since date')
  .option('--output <path>', 'Output file path')
  .action(reportCommand);

// Insights command
program
  .command('insights')
  .description('View development analytics')
  .option('--period <type>', 'Time period: day, week, month', 'week')
  .option('--metric <name>', 'Specific metric to display')
  .action(insightsCommand);

// Error handling
program.exitOverride();

try {
  program.parse(process.argv);
} catch (error: any) {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
}
