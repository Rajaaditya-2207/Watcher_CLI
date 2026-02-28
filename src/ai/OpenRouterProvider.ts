import { AIProvider } from './AIProvider';
import { AIProviderConfig, AIResponse } from '../types/ai';

export class OpenRouterProvider extends AIProvider {
  private baseURL = 'https://openrouter.ai/api/v1';

  constructor(config: AIProviderConfig) {
    super(config);
    if (config.baseURL) {
      this.baseURL = config.baseURL;
    }
  }

  async analyze(prompt: string, systemPrompt?: string): Promise<AIResponse> {
    const messages: any[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    const body = {
      model: this.config.model,
      messages,
    };

    const headers = {
      ...this.buildHeaders(),
      'HTTP-Referer': 'https://github.com/kreonyx/watcher',
      'X-Title': 'Watcher CLI',
    };

    try {
      const data = await this.makeRequest(`${this.baseURL}/chat/completions`, body, headers);

      return {
        content: data.choices[0].message.content,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error: any) {
      throw new Error(`OpenRouter API Error: ${error.message}`);
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Test with a simple prompt
      await this.analyze('Hello', 'You are a helpful assistant.');
      return true;
    } catch {
      return false;
    }
  }
}
