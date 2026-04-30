import { AIProvider } from './AIProvider';
import { AIProviderConfig, AIResponse } from '../types/ai';

export class GeminiProvider extends AIProvider {
  private baseURL = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(config: AIProviderConfig) {
    super(config);
    if (config.baseURL) {
      this.baseURL = config.baseURL;
    }
  }

  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  async analyze(prompt: string, systemPrompt?: string, signal?: AbortSignal): Promise<AIResponse> {
    const contents: any[] = [];
    
    // Gemini handles system prompts via systemInstruction
    const body: any = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      }
    };

    if (systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    try {
      // API key is passed in URL query param for Gemini
      const url = `${this.baseURL}/${this.config.model}:generateContent?key=${this.config.apiKey}`;
      const data = await this.makeRequest(url, body, this.buildHeaders(), signal);

      return {
        content: data.candidates[0].content.parts[0].text,
        usage: data.usageMetadata
          ? {
              promptTokens: data.usageMetadata.promptTokenCount,
              completionTokens: data.usageMetadata.candidatesTokenCount,
              totalTokens: data.usageMetadata.totalTokenCount,
            }
          : undefined,
      };
    } catch (error: any) {
      throw new Error(`Gemini API Error: ${error.message}`);
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
