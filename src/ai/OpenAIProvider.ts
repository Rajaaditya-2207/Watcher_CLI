import { AIProvider } from './AIProvider';
import { AIProviderConfig, AIResponse } from '../types/ai';

export class OpenAIProvider extends AIProvider {
  protected defaultBaseURL = 'https://api.openai.com/v1';

  constructor(config: AIProviderConfig) {
    super(config);
    if (!this.config.baseURL) {
      this.config.baseURL = this.defaultBaseURL;
    }
  }

  async analyze(prompt: string, systemPrompt?: string, signal?: AbortSignal): Promise<AIResponse> {
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
      temperature: 0.7,
      max_tokens: 4096,
    };

    try {
      const data = await this.makeRequest(`${this.config.baseURL}/chat/completions`, body, this.buildHeaders(), signal);

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
      throw new Error(`OpenAI API Error: ${error.message}`);
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.analyze('Hello', 'You are a helpful assistant.');
      return true;
    } catch {
      return false;
    }
  }
}
