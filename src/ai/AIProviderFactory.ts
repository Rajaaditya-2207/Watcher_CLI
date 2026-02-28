import { AIProvider } from './AIProvider';
import { OpenRouterProvider } from './OpenRouterProvider';
import { BedrockProvider } from './BedrockProvider';
import { GroqProvider } from './GroqProvider';
import { AIProviderConfig } from '../types/ai';

export class AIProviderFactory {
  static create(config: AIProviderConfig): AIProvider {
    switch (config.provider) {
      case 'openrouter':
        return new OpenRouterProvider(config);
      case 'bedrock':
        return new BedrockProvider(config);
      case 'groq':
        return new GroqProvider(config);
      default:
        throw new Error(`Unknown AI provider: ${config.provider}`);
    }
  }
}
