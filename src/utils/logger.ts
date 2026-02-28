import chalk from 'chalk';
import ora, { Ora } from 'ora';
import boxen from 'boxen';

const NEON = chalk.hex('#39FF14');

export class Logger {
  private spinner: Ora | null = null;

  info(message: string): void {
    console.log(chalk.white('[i]'), message);
  }

  success(message: string): void {
    console.log(NEON('[+]'), message);
  }

  error(message: string): void {
    console.log(chalk.red('[x]'), message);
  }

  warn(message: string): void {
    console.log(chalk.yellow('[!]'), message);
  }

  debug(message: string): void {
    console.log(chalk.gray('[.]'), message);
  }

  startSpinner(message: string): void {
    this.spinner = ora({ text: message, spinner: 'dots', color: 'green' }).start();
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
        borderColor: 'green',
        title: title,
        titleAlignment: 'center',
      })
    );
  }

  header(text: string): void {
    console.log();
    console.log(NEON.bold(text));
    console.log(chalk.hex('#1a8a0a')('─'.repeat(text.length + 4)));
  }

  divider(): void {
    console.log(chalk.hex('#1a8a0a')('─'.repeat(60)));
  }

  table(headers: string[], rows: string[][]): void {
    const colWidths = headers.map((h, i) => {
      const maxDataWidth = rows.reduce(
        (max, row) => Math.max(max, (row[i] || '').length),
        0
      );
      return Math.max(h.length, maxDataWidth) + 2;
    });

    const headerLine = headers
      .map((h, i) => NEON.bold(h.padEnd(colWidths[i])))
      .join(chalk.dim(' | '));
    console.log('  ' + headerLine);
    console.log(
      '  ' +
      colWidths.map((w) => chalk.dim('─'.repeat(w))).join(chalk.dim('─┼─'))
    );

    rows.forEach((row) => {
      const line = row
        .map((cell, i) => (cell || '').padEnd(colWidths[i]))
        .join(chalk.dim(' | '));
      console.log('  ' + line);
    });
  }

  blank(): void {
    console.log();
  }

  section(title: string): void {
    console.log();
    console.log(NEON.bold(title));
    console.log(chalk.hex('#1a8a0a')('─'.repeat(title.length)));
  }

  prompt(message: string): void {
    process.stdout.write(NEON('> ') + message);
  }
}

export const logger = new Logger();
