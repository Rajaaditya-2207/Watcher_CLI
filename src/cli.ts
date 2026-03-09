#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { displayBanner } from './ui/banner';
import { runOnboarding } from './ui/onboarding';
import { ConfigManager } from './config/ConfigManager';
import { initCommand } from './commands/init';
import { runUnifiedApp } from './modes/app';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Only 'init' remains as a standalone subcommand
  if (args.length > 0 && args[0] === 'init') {
    displayBanner();
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

    program.parse(process.argv);
    return;
  }

  // Interactive unified mode — all features accessible via slash commands
  const projectPath = process.cwd();
  const configManager = new ConfigManager(projectPath);

  // Check if configured
  if (!configManager.exists()) {
    console.clear();
    displayBanner();
    await runOnboarding(projectPath);
  }

  await runUnifiedApp(projectPath);
}

main().catch((error) => {
  try { process.stdout.write('\x1b[?1049l'); } catch {}
  try { process.stdout.write('\x1b[?25h'); } catch {}
  console.error(chalk.red(`\n[x] Fatal error: ${error.message}`));
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});
