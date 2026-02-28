import { WatcherDatabase } from '../database/Database';
import fs from 'fs';
import path from 'path';

export interface DebtItem {
    type: string;
    severity: string;
    filePath: string;
    description: string;
}

export class TechnicalDebtTracker {
    private db: WatcherDatabase;
    private projectPath: string;

    constructor(db: WatcherDatabase, projectPath: string) {
        this.db = db;
        this.projectPath = projectPath;
    }

    async scan(projectId: number): Promise<DebtItem[]> {
        const items: DebtItem[] = [];

        // Clear previous scan results
        this.db.clearTechnicalDebt(projectId);

        // Scan for large files
        items.push(...this.findLargeFiles());

        // Scan for TODO/FIXME comments
        items.push(...this.findTodoComments());

        // Save to database
        for (const item of items) {
            this.db.saveTechnicalDebt({
                projectId,
                type: item.type,
                severity: item.severity,
                filePath: item.filePath,
                description: item.description,
            });
        }

        return items;
    }

    private findLargeFiles(): DebtItem[] {
        const items: DebtItem[] = [];
        const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c'];

        this.walkDirectory(this.projectPath, (filePath) => {
            const ext = path.extname(filePath);
            if (!extensions.includes(ext)) return;

            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lineCount = content.split('\n').length;

                if (lineCount > 500) {
                    const severity = lineCount > 1000 ? 'high' : 'medium';
                    items.push({
                        type: 'large_file',
                        severity,
                        filePath: path.relative(this.projectPath, filePath),
                        description: `File has ${lineCount} lines. Consider splitting into smaller modules.`,
                    });
                }
            } catch {
                // Skip unreadable files
            }
        });

        return items;
    }

    private findTodoComments(): DebtItem[] {
        const items: DebtItem[] = [];
        const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c'];
        const patterns = [/\/\/\s*TODO/gi, /\/\/\s*FIXME/gi, /\/\/\s*HACK/gi, /#\s*TODO/gi, /#\s*FIXME/gi];

        this.walkDirectory(this.projectPath, (filePath) => {
            const ext = path.extname(filePath);
            if (!extensions.includes(ext)) return;

            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    for (const pattern of patterns) {
                        pattern.lastIndex = 0;
                        if (pattern.test(lines[i])) {
                            const comment = lines[i].trim().substring(0, 120);
                            items.push({
                                type: 'todo_comment',
                                severity: 'low',
                                filePath: path.relative(this.projectPath, filePath),
                                description: `Line ${i + 1}: ${comment}`,
                            });
                            break;
                        }
                    }
                }
            } catch {
                // Skip unreadable files
            }
        });

        return items;
    }

    private walkDirectory(dir: string, callback: (filePath: string) => void): void {
        const ignoreList = ['node_modules', '.git', 'dist', 'build', 'coverage', '.watcher'];

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (ignoreList.includes(entry.name)) continue;

                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    this.walkDirectory(fullPath, callback);
                } else if (entry.isFile()) {
                    callback(fullPath);
                }
            }
        } catch {
            // Skip inaccessible directories
        }
    }
}
