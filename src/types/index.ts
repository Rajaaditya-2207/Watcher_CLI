export interface WatcherConfig {
  aiProvider: 'openrouter' | 'bedrock' | 'groq';
  model: string;
  watchInterval: number;
  ignorePatterns: string[];
  features: {
    autoDocumentation: boolean;
    technicalDebt: boolean;
    analytics: boolean;
  };
  reporting: {
    defaultFormat: 'markdown' | 'json' | 'slack';
    includeMetrics: boolean;
  };
}

export interface ProjectMetadata {
  name: string;
  path: string;
  techStack: string[];
  architecture: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileChange {
  path: string;
  changeType: 'added' | 'modified' | 'deleted';
  linesAdded: number;
  linesRemoved: number;
}

export interface ChangeRecord {
  id: string;
  timestamp: Date;
  files: FileChange[];
  category: 'feature' | 'fix' | 'refactor' | 'docs';
  summary: string;
  description?: string;
  impact: 'low' | 'medium' | 'high';
  linesAdded: number;
  linesRemoved: number;
}

export interface CommandOptions {
  force?: boolean;
  config?: string;
  interval?: string;
  verbose?: boolean;
  format?: string;
  since?: string;
  output?: string;
  period?: string;
  metric?: string;
}
