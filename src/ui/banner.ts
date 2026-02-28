import chalk from 'chalk';

const NEON = chalk.hex('#39FF14');
const NEON_BOLD = chalk.hex('#39FF14').bold;
const DIM_GREEN = chalk.hex('#1a8a0a');

const BANNER = `
${NEON_BOLD(`██╗    ██╗ █████╗ ████████╗ ██████╗██╗  ██╗███████╗██████╗ `)}
${NEON_BOLD(`██║    ██║██╔══██╗╚══██╔══╝██╔════╝██║  ██║██╔════╝██╔══██╗`)}
${NEON_BOLD(`██║ █╗ ██║███████║   ██║   ██║     ███████║█████╗  ██████╔╝`)}
${NEON_BOLD(`██║███╗██║██╔══██║   ██║   ██║     ██╔══██║██╔══╝  ██╔══██╗`)}
${NEON_BOLD(`╚███╔███╔╝██║  ██║   ██║   ╚██████╗██║  ██║███████╗██║  ██║`)}
${NEON_BOLD(` ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝`)}
`;

const TAGLINE = DIM_GREEN('  Silent Observer. Intelligent Documentation.');
const VERSION_LINE = DIM_GREEN(`  v0.1.0 | Team KREONYX`);

export function displayBanner(): void {
  console.log(BANNER);
  console.log(TAGLINE);
  console.log(VERSION_LINE);
  console.log(DIM_GREEN('  ' + '─'.repeat(56)));
  console.log();
}
