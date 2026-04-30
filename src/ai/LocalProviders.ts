import { AIProviderConfig } from '../types/ai';
import { OpenAIProvider } from './OpenAIProvider';

export class OllamaProvider extends OpenAIProvider {
  constructor(config: AIProviderConfig) {
    // Ollama supports OpenAI compatibility layer at /v1
    super({
      ...config,
      baseURL: config.baseURL || 'http://localhost:11434/v1',
      apiKey: config.apiKey || 'ollama', // API key is usually not required
    });
  }
}

export class LMStudioProvider extends OpenAIProvider {
  constructor(config: AIProviderConfig) {
    super({
      ...config,
      baseURL: config.baseURL || 'http://localhost:1234/v1',
      apiKey: config.apiKey || 'lmstudio',
    });
  }
}

export class LlamaCppProvider extends OpenAIProvider {
  constructor(config: AIProviderConfig) {
    super({
      ...config,
      baseURL: config.baseURL || 'http://localhost:8080/v1',
      apiKey: config.apiKey || 'llamacpp',
    });
  }
}
