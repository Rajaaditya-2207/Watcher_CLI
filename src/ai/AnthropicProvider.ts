import { AIProvider } from './AIProvider';
import { AIProviderConfig, AIResponse } from '../types/ai';

export class AnthropicProvider extends AIProvider {
  private baseURL = 'https://api.anthropic.com/v1';

  constructor(config: AIProviderConfig) {
    super(config);
    if (config.baseURL) {
      this.baseURL = config.baseURL;
    }
  }

  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  async analyze(prompt: string, systemPrompt?: string, signal?: AbortSignal): Promise<AIResponse> {
    const messages: any[] = [
      {
        role: 'user',
        content: prompt,
      }
    ];

    const body: any = {
      model: this.config.model,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    try {
      const data = await this.makeRequest(`${this.baseURL}/messages`, body, this.buildHeaders(), signal);

      return {
        content: data.content[0].text,
        usage: data.usage
          ? {
              promptTokens: data.usage.input_tokens,
              completionTokens: data.usage.output_tokens,
              totalTokens: data.usage.input_tokens + data.usage.output_tokens,
            }
          : undefined,
      };
    } catch (error: any) {
      throw new Error(`Anthropic API Error: ${error.message}`);
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.analyze('Hello');
      return true;
    } catch {
      return false;
    }
  }
}
