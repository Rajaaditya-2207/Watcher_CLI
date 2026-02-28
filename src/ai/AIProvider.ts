import { AIProviderConfig, AIResponse } from '../types/ai';

export abstract class AIProvider {
  protected config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  abstract analyze(prompt: string, systemPrompt?: string): Promise<AIResponse>;

  abstract validateConfig(): Promise<boolean>;

  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  protected async makeRequest(
    url: string,
    body: any,
    headers: Record<string, string>
  ): Promise<any> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI Provider Error (${response.status}): ${error}`);
    }

    return response.json();
  }
}
