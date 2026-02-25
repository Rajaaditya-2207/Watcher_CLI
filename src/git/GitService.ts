import { execSync } from 'child_process';
import path from 'path';

export interface GitStatus {
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export class GitService {
  private projectPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
  }

  isGitRepository(): boolean {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: this.projectPath,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }

  getCurrentBranch(): string {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      });
      return branch.trim();
    } catch (error) {
      throw new Error('Failed to get current branch');
    }
  }

  getStatus(): GitStatus {
    try {
      const output = execSync('git status --porcelain', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      });

      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];

      output.split('\n').forEach((line) => {
        if (!line) return;

        const status = line.substring(0, 2);
        const file = line.substring(3);

        if (status[0] !== ' ' && status[0] !== '?') {
          staged.push(file);
        }
        if (status[1] !== ' ' && status[1] !== '?') {
          unstaged.push(file);
        }
        if (status === '??') {
          untracked.push(file);
        }
      });

      return {
        branch: this.getCurrentBranch(),
        staged,
        unstaged,
        untracked,
      };
    } catch (error) {
      throw new Error('Failed to get git status');
    }
  }

  getDiff(filePath?: string): string {
    try {
      const command = filePath
        ? `git diff HEAD -- "${filePath}"`
        : 'git diff HEAD';

      const diff = execSync(command, {
        cwd: this.projectPath,
        encoding: 'utf-8',
      });

      return diff;
    } catch (error) {
      return '';
    }
  }

  getUnstagedDiff(filePath?: string): string {
    try {
      const command = filePath ? `git diff -- "${filePath}"` : 'git diff';

      const diff = execSync(command, {
        cwd: this.projectPath,
        encoding: 'utf-8',
      });

      return diff;
    } catch (error) {
      return '';
    }
  }
}
