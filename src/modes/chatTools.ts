import { GitService } from '../git/GitService';
import { WatcherDatabase } from '../database/Database';
import fs from 'fs';
import path from 'path';

export interface ToolResult {
    name: string;
    result: string;
}

export class ChatTools {
    private gitService: GitService;
    private db: WatcherDatabase;
    private projectPath: string;

    constructor(projectPath: string, db: WatcherDatabase) {
        this.projectPath = projectPath;
        this.gitService = new GitService(projectPath);
        this.db = db;
    }

    getToolDescriptions(): string {
        return `You have access to the following tools to help answer questions about this project. When you need information, describe what tool you would use and what data you need. The user's questions should be answered using the project context provided.

Available information sources:
- Git status: current branch, staged/unstaged/untracked files
- Git diff: see current uncommitted changes
- File listing: see all project files
- File contents: read specific files
- Project summary: overview from the database including change history`;
    }

    async executeCommand(command: string): Promise<string> {
        const cmd = command.trim().toLowerCase();

        if (cmd === 'status' || cmd === 'git status') {
            return this.getGitStatus();
        }
        if (cmd === 'diff' || cmd === 'git diff') {
            return this.getGitDiff();
        }
        if (cmd === 'files' || cmd === 'ls') {
            return this.getFileList();
        }
        if (cmd.startsWith('cat ') || cmd.startsWith('read ')) {
            const filePath = command.trim().substring(cmd.startsWith('cat') ? 4 : 5).trim();
            return this.readFile(filePath);
        }
        if (cmd === 'summary' || cmd === 'project') {
            return this.getProjectSummary();
        }
        if (cmd === 'help' || cmd === 'tools') {
            return this.getToolHelp();
        }

        return '';
    }

    getGitStatus(): string {
        if (!this.gitService.isGitRepository()) {
            return 'Not a git repository.';
        }

        try {
            const status = this.gitService.getStatus();
            let result = `Branch: ${status.branch}\n`;

            if (status.staged.length > 0) {
                result += `\nStaged files (${status.staged.length}):\n`;
                status.staged.forEach((f) => (result += `  + ${f}\n`));
            }

            if (status.unstaged.length > 0) {
                result += `\nUnstaged changes (${status.unstaged.length}):\n`;
                status.unstaged.forEach((f) => (result += `  ~ ${f}\n`));
            }

            if (status.untracked.length > 0) {
                result += `\nUntracked files (${status.untracked.length}):\n`;
                status.untracked.forEach((f) => (result += `  ? ${f}\n`));
            }

            if (status.staged.length === 0 && status.unstaged.length === 0 && status.untracked.length === 0) {
                result += 'Working tree clean.';
            }

            return result;
        } catch (error: any) {
            return `Error getting git status: ${error.message}`;
        }
    }

    getGitDiff(): string {
        if (!this.gitService.isGitRepository()) {
            return 'Not a git repository.';
        }

        try {
            const diff = this.gitService.getUnstagedDiff();
            if (!diff || diff.trim().length === 0) {
                return 'No unstaged changes.';
            }
            // Limit to first 3000 chars to avoid overwhelming the AI
            return diff.substring(0, 3000) + (diff.length > 3000 ? '\n\n... (truncated)' : '');
        } catch (error: any) {
            return `Error getting diff: ${error.message}`;
        }
    }

    getFileList(): string {
        const ignoreList = ['node_modules', '.git', 'dist', 'build', 'coverage', '.watcher'];
        const files: string[] = [];

        const walk = (dir: string, prefix: string = '') => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (ignoreList.includes(entry.name)) continue;
                    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
                    if (entry.isDirectory()) {
                        files.push(`${relativePath}/`);
                        walk(path.join(dir, entry.name), relativePath);
                    } else {
                        files.push(relativePath);
                    }
                }
            } catch {
                // Skip inaccessible directories
            }
        };

        walk(this.projectPath);

        if (files.length === 0) return 'No files found.';
        return `Project files (${files.length}):\n` + files.map((f) => `  ${f}`).join('\n');
    }

    readFile(filePath: string): string {
        const fullPath = path.resolve(this.projectPath, filePath);

        // Security: ensure file is within project
        if (!fullPath.startsWith(this.projectPath)) {
            return 'Access denied: file is outside project directory.';
        }

        try {
            if (!fs.existsSync(fullPath)) {
                return `File not found: ${filePath}`;
            }

            const stat = fs.statSync(fullPath);
            if (stat.size > 50000) {
                return `File is too large to display (${Math.round(stat.size / 1024)}KB). Try a specific section.`;
            }

            const content = fs.readFileSync(fullPath, 'utf-8');
            return `--- ${filePath} ---\n${content}`;
        } catch (error: any) {
            return `Error reading file: ${error.message}`;
        }
    }

    getProjectSummary(): string {
        const project = this.db.getProject(this.projectPath);
        if (!project) return 'Project not found in database.';

        const projectId = this.db.getProjectId(this.projectPath);
        let result = `Project: ${project.name}\n`;
        result += `Path: ${project.path}\n`;
        result += `Architecture: ${project.architecture}\n`;
        result += `Tech Stack: ${project.techStack.join(', ') || 'Not detected'}\n`;

        if (projectId !== null) {
            const summary = this.db.getChangeSummary(projectId);
            result += `\nTotal Changes: ${summary.totalChanges}\n`;
            result += `Lines Added: +${summary.totalLinesAdded}\n`;
            result += `Lines Removed: -${summary.totalLinesRemoved}\n`;

            if (Object.keys(summary.categories).length > 0) {
                result += '\nCategories:\n';
                for (const [cat, count] of Object.entries(summary.categories)) {
                    result += `  ${cat}: ${count}\n`;
                }
            }
        }

        return result;
    }

    getToolHelp(): string {
        return `Available commands:
  status      Show git status (branch, staged, unstaged, untracked)
  diff        Show current uncommitted changes
  files       List all project files
  cat <path>  Read a specific file
  summary     Show project summary from database
  clear       Clear conversation history
  exit        Exit chat mode`;
    }
}
