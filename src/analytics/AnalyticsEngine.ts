import { WatcherDatabase, ChangeRow } from '../database/Database';

export interface VelocityMetrics {
    totalChanges: number;
    changesPerDay: number;
    linesAdded: number;
    linesRemoved: number;
    netLines: number;
    categoryBreakdown: Record<string, number>;
    impactBreakdown: Record<string, number>;
}

export interface FileHotspot {
    filePath: string;
    changeCount: number;
}

export class AnalyticsEngine {
    private db: WatcherDatabase;

    constructor(db: WatcherDatabase) {
        this.db = db;
    }

    getVelocityMetrics(projectId: number, periodDays: number): VelocityMetrics {
        const since = this.getDateOffset(periodDays);
        const changes = this.db.getChanges(projectId, since);
        const summary = this.db.getChangeSummary(projectId);

        const impactBreakdown: Record<string, number> = {};
        const categoryBreakdown: Record<string, number> = {};

        for (const change of changes) {
            impactBreakdown[change.impact] = (impactBreakdown[change.impact] || 0) + 1;
            categoryBreakdown[change.category] = (categoryBreakdown[change.category] || 0) + 1;
        }

        return {
            totalChanges: changes.length,
            changesPerDay: periodDays > 0 ? Math.round((changes.length / periodDays) * 10) / 10 : changes.length,
            linesAdded: summary.totalLinesAdded,
            linesRemoved: summary.totalLinesRemoved,
            netLines: summary.totalLinesAdded - summary.totalLinesRemoved,
            categoryBreakdown,
            impactBreakdown,
        };
    }

    getFileHotspots(projectId: number, limit: number = 10): FileHotspot[] {
        return this.db.getFileHotspots(projectId, limit).map((h) => ({
            filePath: h.filePath,
            changeCount: h.count,
        }));
    }

    getActivityTimeline(projectId: number, periodDays: number): Record<string, number> {
        const since = this.getDateOffset(periodDays);
        const changes = this.db.getChanges(projectId, since);

        const timeline: Record<string, number> = {};

        for (const change of changes) {
            const date = change.timestamp.split(' ')[0] || change.timestamp.split('T')[0] || 'Unknown';
            timeline[date] = (timeline[date] || 0) + 1;
        }

        return timeline;
    }

    private getDateOffset(days: number): string {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0];
    }
}
