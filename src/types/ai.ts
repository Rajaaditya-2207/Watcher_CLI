export interface AIProviderConfig {
  provider: 'openrouter' | 'bedrock' | 'groq';
  apiKey: string;
  model: string;
  baseURL?: string;
}

export interface AnalysisContext {
  files: FileChangeInfo[];
  diff: string;
  projectContext: ProjectContext;
}

export interface FileChangeInfo {
  path: string;
  changeType: 'added' | 'modified' | 'deleted';
  content?: string;
}

export interface ProjectContext {
  name: string;
  techStack: string[];
  architecture: string;
  recentChanges?: string[];
}

export interface SemanticAnalysis {
  summary: string;
  category: 'feature' | 'fix' | 'refactor' | 'docs' | 'style' | 'test';
  impact: 'low' | 'medium' | 'high';
  affectedAreas: string[];
  technicalDetails: string;
  suggestedDocumentation?: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
