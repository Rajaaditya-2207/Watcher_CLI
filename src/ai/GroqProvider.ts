import { AIProvider } from './AIProvider';
import { AIProviderConfig, AIResponse } from '../types/ai';

export class GroqProvider extends AIProvider {
  private baseURL = 'https://api.groq.com/openai/v1';

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
      temperature: 0.7,
      max_tokens: 2000,
    };

    try {
      const data = await this.makeRequest(`${this.baseURL}/chat/completions`, body, this.buildHeaders());

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
      throw new Error(`Groq API Error: ${error.message}`);
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
