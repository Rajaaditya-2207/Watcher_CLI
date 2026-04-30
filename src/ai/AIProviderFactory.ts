import { AIProvider } from './AIProvider';
import { OpenRouterProvider } from './OpenRouterProvider';
import { BedrockProvider } from './BedrockProvider';
import { GroqProvider } from './GroqProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GeminiProvider } from './GeminiProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { OllamaProvider, LMStudioProvider, LlamaCppProvider } from './LocalProviders';
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
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'gemini':
        return new GeminiProvider(config);
      case 'openai':
        return new OpenAIProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      case 'lmstudio':
        return new LMStudioProvider(config);
      case 'llamacpp':
        return new LlamaCppProvider(config);
      default:
        throw new Error(`Unknown AI provider: ${config.provider}`);
    }
  }
}
