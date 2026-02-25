import fs from 'fs';
import path from 'path';
import { WatcherConfig } from '../types';

export class ConfigManager {
  private configPath: string;
  private defaultConfig: WatcherConfig = {
    aiProvider: 'openrouter',
    model: 'anthropic/claude-3-sonnet',
    watchInterval: 5000,
    ignorePatterns: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '*.log',
      '.git/**',
      'coverage/**',
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

  constructor(projectPath: string = process.cwd()) {
    this.configPath = path.join(projectPath, '.watcherrc.json');
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
