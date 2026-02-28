export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class SessionManager {
    private history: ChatMessage[] = [];
    private tokenUsage: { prompt: number; completion: number } = { prompt: 0, completion: 0 };

    constructor(systemPrompt: string) {
        this.history.push({ role: 'system', content: systemPrompt });
    }

    addUserMessage(content: string): void {
        this.history.push({ role: 'user', content });
    }

    addAssistantMessage(content: string): void {
        this.history.push({ role: 'assistant', content });
    }

    getHistory(): ChatMessage[] {
        return [...this.history];
    }

    getMessages(): ChatMessage[] {
        // Return all messages for the API call
        return this.history;
    }

    trackUsage(promptTokens: number, completionTokens: number): void {
        this.tokenUsage.prompt += promptTokens;
        this.tokenUsage.completion += completionTokens;
    }

    getTotalTokens(): number {
        return this.tokenUsage.prompt + this.tokenUsage.completion;
    }

    getUsageSummary(): string {
        return `Tokens used: ${this.tokenUsage.prompt} prompt + ${this.tokenUsage.completion} completion = ${this.getTotalTokens()} total`;
    }

    getMessageCount(): number {
        // Exclude system message
        return this.history.filter((m) => m.role !== 'system').length;
    }

    clear(): void {
        const systemMsg = this.history[0];
        this.history = [systemMsg];
        this.tokenUsage = { prompt: 0, completion: 0 };
    }
}
