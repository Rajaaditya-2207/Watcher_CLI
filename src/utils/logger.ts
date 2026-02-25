import chalk from 'chalk';
import ora, { Ora } from 'ora';
import boxen from 'boxen';

export class Logger {
  private spinner: Ora | null = null;

  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  error(message: string): void {
    console.log(chalk.red('✗'), message);
  }

  warn(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  startSpinner(message: string): void {
    this.spinner = ora(message).start();
  }

  stopSpinner(success: boolean, message: string): void {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(message);
      } else {
        this.spinner.fail(message);
      }
      this.spinner = null;
    }
  }

  box(message: string, title?: string): void {
    console.log(
      boxen(message, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        title: title,
        titleAlignment: 'center',
      })
    );
  }

  header(text: string): void {
    console.log('\n' + chalk.bold.cyan(text) + '\n');
  }
}

export const logger = new Logger();
