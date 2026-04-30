import fs from 'fs';
import path from 'path';
import os from 'os';
import { WatcherConfig } from '../types';

const GLOBAL_DIR = path.join(os.homedir(), '.watcher');
const GLOBAL_CONFIG = path.join(GLOBAL_DIR, 'config.json');

export class ConfigManager {
  private configPath: string;
  private defaultConfig: WatcherConfig = {
    aiProvider: 'anthropic',
    model: 'claude-3-5-sonnet-latest',
    watchInterval: 5000,
    ignorePatterns: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '*.log',
      '**/*.log',
      '.git/**',
      'coverage/**',
      '.watcher/**',
      '**/*.db',
      '**/*.map',
      '.env',
      '.env.*',
    ],
    features: {
      autoDocumentation: true,
      technicalDebt: true,
      analytics: true,
    },
    reporting: {
      defaultFormat: 'markdown',
      includeMetrics: true,
    },
  };

  constructor(_projectPath: string = process.cwd()) {
    if (!fs.existsSync(GLOBAL_DIR)) {
      fs.mkdirSync(GLOBAL_DIR, { recursive: true });
    }
    this.configPath = GLOBAL_CONFIG;
  }

  async load(): Promise<WatcherConfig> {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf-8');
        return { ...this.defaultConfig, ...JSON.parse(configData) };
      }
      return this.defaultConfig;
    } catch (error) {
      throw new Error(`Failed to load config: ${error}`);
    }
  }

  async save(config: WatcherConfig): Promise<void> {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`);
    }
  }

  exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  getDefaultConfig(): WatcherConfig {
    return { ...this.defaultConfig };
  }
}
