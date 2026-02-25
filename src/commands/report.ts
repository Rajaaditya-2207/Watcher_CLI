import { logger } from '../utils/logger';
import { CommandOptions } from '../types';

export async function reportCommand(options: CommandOptions): Promise<void> {
  logger.header('📊 Generating Report');
  logger.info('Report generation coming in Phase 3...');
  logger.info(`Format: ${options.format || 'markdown'}`);
  if (options.since) {
    logger.info(`Since: ${options.since}`);
  }
}
