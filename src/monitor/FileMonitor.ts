import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import path from 'path';

export interface FileEvent {
  path: string;
  type: 'add' | 'change' | 'unlink';
  timestamp: Date;
}

export class FileMonitor extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private ignorePatterns: string[];
  private watchPath: string;

  constructor(watchPath: string, ignorePatterns: string[] = []) {
    super();
    this.watchPath = watchPath;
    this.ignorePatterns = ignorePatterns;
  }

  start(): void {
    this.watcher = chokidar.watch(this.watchPath, {
      ignored: this.ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (filePath) => this.handleFileEvent(filePath, 'add'))
      .on('change', (filePath) => this.handleFileEvent(filePath, 'change'))
      .on('unlink', (filePath) => this.handleFileEvent(filePath, 'unlink'))
      .on('error', (error) => this.emit('error', error));

    this.emit('ready');
  }

  private handleFileEvent(filePath: string, type: 'add' | 'change' | 'unlink'): void {
    const event: FileEvent = {
      path: path.relative(this.watchPath, filePath),
      type,
      timestamp: new Date(),
    };
    this.emit('fileChange', event);
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  setIgnorePatterns(patterns: string[]): void {
    this.ignorePatterns = patterns;
    if (this.watcher) {
      this.stop();
      this.start();
    }
  }
}
