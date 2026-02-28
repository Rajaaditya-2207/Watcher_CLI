import { logger } from '../utils/logger';
import { ConfigManager } from '../config/ConfigManager';
import { WatcherDatabase } from '../database/Database';
import { ProgressGenerator } from '../documentation/ProgressGenerator';
import { ChangelogGenerator } from '../documentation/ChangelogGenerator';
import { CommandOptions } from '../types';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export async function reportCommand(options: CommandOptions): Promise<void> {
  try {
    const projectPath = process.cwd();
    const configManager = new ConfigManager(projectPath);

    if (!configManager.exists()) {
      logger.error('Watcher is not initialized. Run: watcher init');
      process.exit(1);
    }

    logger.header('Generating Report');

    const db = new WatcherDatabase(projectPath);
    await db.initialize();

    const projectId = db.getProjectId(projectPath);
    if (projectId === null) {
      logger.error('Project not found in database. Run: watcher init');
      db.close();
      process.exit(1);
    }

    const project = db.getProject(projectPath);
    const format = options.format || 'md';

    // Get changes
    const changes = db.getChanges(projectId, options.since);
    const summary = db.getChangeSummary(projectId);
    const hotspots = db.getFileHotspots(projectId, 10);
    const debt = db.getTechnicalDebt(projectId);

    if (format === 'json') {
      // JSON output
      const report = {
        project: {
          name: project?.name,
          path: project?.path,
          architecture: project?.architecture,
          techStack: project?.techStack,
        },
        summary: {
          totalChanges: summary.totalChanges,
          linesAdded: summary.totalLinesAdded,
          linesRemoved: summary.totalLinesRemoved,
          categories: summary.categories,
        },
        changes: changes.map((c) => ({
          timestamp: c.timestamp,
          category: c.category,
          summary: c.summary,
          impact: c.impact,
          filesChanged: c.filesChanged,
        })),
        hotspots: hotspots.map((h) => ({
          file: h.filePath,
          changes: h.count,
        })),
        technicalDebt: debt.map((d) => ({
          type: d.type,
          severity: d.severity,
          file: d.filePath,
          description: d.description,
        })),
        generatedAt: new Date().toISOString(),
      };

      const output = JSON.stringify(report, null, 2);

      if (options.output) {
        fs.writeFileSync(options.output, output, 'utf-8');
        logger.success(`Report saved to: ${options.output}`);
      } else {
        console.log(output);
      }
    } else {
      // Markdown output
      let report = '';

      report += `# Project Status Report\n\n`;
      report += `**Project:** ${project?.name || 'Unknown'}\n`;
      report += `**Generated:** ${new Date().toISOString().split('T')[0]}\n`;
      if (options.since) {
        report += `**Period:** Since ${options.since}\n`;
      }
      report += `\n---\n\n`;

      // Summary
      report += `## Summary\n\n`;
      report += `| Metric | Value |\n`;
      report += `|--------|-------|\n`;
      report += `| Total Changes | ${summary.totalChanges} |\n`;
      report += `| Lines Added | +${summary.totalLinesAdded} |\n`;
      report += `| Lines Removed | -${summary.totalLinesRemoved} |\n`;
      report += `\n`;

      // Category breakdown
      if (Object.keys(summary.categories).length > 0) {
        report += `## Change Breakdown\n\n`;
        report += `| Category | Count |\n`;
        report += `|----------|-------|\n`;
        for (const [cat, count] of Object.entries(summary.categories)) {
          report += `| ${cat} | ${count} |\n`;
        }
        report += `\n`;
      }

      // Recent changes
      if (changes.length > 0) {
        report += `## Recent Changes\n\n`;
        for (const change of changes.slice(0, 20)) {
          const date = change.timestamp.split(' ')[0] || change.timestamp.split('T')[0];
          report += `- **${date}** [${change.category.toUpperCase()}] ${change.summary}`;
          if (change.impact !== 'low') {
            report += ` *(${change.impact} impact)*`;
          }
          report += `\n`;
        }
        report += `\n`;
      }

      // File hotspots
      if (hotspots.length > 0) {
        report += `## File Hotspots\n\n`;
        report += `Most frequently changed files:\n\n`;
        report += `| File | Changes |\n`;
        report += `|------|---------|\n`;
        for (const spot of hotspots) {
          report += `| ${spot.filePath} | ${spot.count} |\n`;
        }
        report += `\n`;
      }

      // Technical Debt
      if (debt.length > 0) {
        report += `## Technical Debt\n\n`;
        report += `| Type | Severity | File | Description |\n`;
        report += `|------|----------|------|-------------|\n`;
        for (const item of debt) {
          report += `| ${item.type} | ${item.severity} | ${item.filePath || 'N/A'} | ${item.description} |\n`;
        }
        report += `\n`;
      }

      report += `---\n*Generated by Watcher CLI*\n`;

      if (options.output) {
        fs.writeFileSync(options.output, report, 'utf-8');
        logger.success(`Report saved to: ${options.output}`);
      } else {
        console.log(report);
      }

      // Also generate PROGRESS.md and CHANGELOG.md
      const progressGen = new ProgressGenerator(db, projectPath);
      const changelogGen = new ChangelogGenerator(db, projectPath);

      try {
        await progressGen.generate();
        logger.success('PROGRESS.md updated.');
      } catch (err: any) {
        logger.warn(`Could not update PROGRESS.md: ${err.message}`);
      }

      try {
        await changelogGen.generate();
        logger.success('CHANGELOG.md updated.');
      } catch (err: any) {
        logger.warn(`Could not update CHANGELOG.md: ${err.message}`);
      }
    }

    // Terminal summary
    logger.blank();
    logger.section('Report Summary');
    logger.table(
      ['Metric', 'Value'],
      [
        ['Total Changes', String(summary.totalChanges)],
        ['Lines Added', `+${summary.totalLinesAdded}`],
        ['Lines Removed', `-${summary.totalLinesRemoved}`],
        ['File Hotspots', String(hotspots.length)],
        ['Open Debt Items', String(debt.length)],
      ]
    );

    db.close();
    logger.blank();
    logger.success('Report generation complete.');
  } catch (error: any) {
    logger.error(`Report generation failed: ${error.message}`);
    process.exit(1);
  }
}
