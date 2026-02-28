import { logger } from '../utils/logger';
import { ConfigManager } from '../config/ConfigManager';
import { WatcherDatabase } from '../database/Database';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { TechnicalDebtTracker } from '../analytics/TechnicalDebtTracker';
import { CommandOptions } from '../types';
import chalk from 'chalk';

export async function insightsCommand(options: CommandOptions): Promise<void> {
  try {
    const projectPath = process.cwd();
    const configManager = new ConfigManager(projectPath);

    if (!configManager.exists()) {
      logger.error('Watcher is not initialized. Run: watcher init');
      process.exit(1);
    }

    logger.header('Development Insights');

    const db = new WatcherDatabase(projectPath);
    await db.initialize();

    const projectId = db.getProjectId(projectPath);
    if (projectId === null) {
      logger.error('Project not found in database. Run: watcher init');
      db.close();
      process.exit(1);
    }

    const project = db.getProject(projectPath);
    const analytics = new AnalyticsEngine(db);
    const debtTracker = new TechnicalDebtTracker(db, projectPath);

    // Determine period
    const periodMap: Record<string, number> = {
      day: 1,
      week: 7,
      month: 30,
    };
    const periodLabel = options.period || 'week';
    const periodDays = periodMap[periodLabel] || 7;

    logger.info(`Project: ${chalk.cyan(project?.name || 'Unknown')}`);
    logger.info(`Period: Last ${periodDays} day${periodDays > 1 ? 's' : ''}`);
    logger.blank();

    // Velocity Metrics
    const velocity = analytics.getVelocityMetrics(projectId, periodDays);

    logger.section('Velocity');
    logger.table(
      ['Metric', 'Value'],
      [
        ['Total Changes', String(velocity.totalChanges)],
        ['Changes / Day', String(velocity.changesPerDay)],
        ['Lines Added', chalk.green(`+${velocity.linesAdded}`)],
        ['Lines Removed', chalk.red(`-${velocity.linesRemoved}`)],
        ['Net Lines', String(velocity.netLines)],
      ]
    );

    // Category Breakdown
    if (Object.keys(velocity.categoryBreakdown).length > 0) {
      logger.blank();
      logger.section('Change Categories');
      logger.table(
        ['Category', 'Count', 'Percentage'],
        Object.entries(velocity.categoryBreakdown).map(([cat, count]) => {
          const pct = velocity.totalChanges > 0
            ? Math.round((count / velocity.totalChanges) * 100)
            : 0;
          return [cat, String(count), `${pct}%`];
        })
      );
    }

    // Impact Breakdown
    if (Object.keys(velocity.impactBreakdown).length > 0) {
      logger.blank();
      logger.section('Impact Distribution');
      logger.table(
        ['Impact', 'Count'],
        Object.entries(velocity.impactBreakdown).map(([impact, count]) => [
          impact,
          String(count),
        ])
      );
    }

    // File Hotspots
    const hotspots = analytics.getFileHotspots(projectId, 10);
    if (hotspots.length > 0) {
      logger.blank();
      logger.section('File Hotspots');
      logger.table(
        ['File', 'Changes'],
        hotspots.map((h) => [h.filePath, String(h.changeCount)])
      );
    }

    // Activity Timeline
    const timeline = analytics.getActivityTimeline(projectId, periodDays);
    if (Object.keys(timeline).length > 0) {
      logger.blank();
      logger.section('Activity Timeline');

      const maxCount = Math.max(...Object.values(timeline));
      const barWidth = 30;

      for (const [date, count] of Object.entries(timeline)) {
        const barLength = maxCount > 0 ? Math.round((count / maxCount) * barWidth) : 0;
        const bar = chalk.cyan('|'.repeat(barLength));
        console.log(`  ${date}  ${bar} ${count}`);
      }
    }

    // Technical Debt Scan
    if (!options.metric || options.metric === 'debt') {
      logger.blank();
      logger.section('Technical Debt');

      logger.startSpinner('Scanning for technical debt...');
      const debtItems = await debtTracker.scan(projectId);
      logger.stopSpinner(true, `Found ${debtItems.length} issue${debtItems.length !== 1 ? 's' : ''}.`);

      if (debtItems.length > 0) {
        logger.table(
          ['Type', 'Severity', 'File', 'Description'],
          debtItems.slice(0, 15).map((d) => [
            d.type,
            d.severity,
            d.filePath || 'N/A',
            d.description.substring(0, 60),
          ])
        );

        if (debtItems.length > 15) {
          logger.info(`... and ${debtItems.length - 15} more items.`);
        }
      } else {
        logger.success('No technical debt items found.');
      }
    }

    db.close();
    logger.blank();
    logger.success('Insights generation complete.');
  } catch (error: any) {
    logger.error(`Insights generation failed: ${error.message}`);
    process.exit(1);
  }
}
