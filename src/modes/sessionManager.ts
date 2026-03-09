import fs from 'fs';
import path from 'path';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface SessionInfo {
    id: string;
    name: string;
    createdAt: string;
    messageCount: number;
}

/**
 * Manages conversation history and token tracking.
 * Supports multiple named sessions with persistence via JSON files
 * stored in .watcher/sessions/.
 */
export class SessionManager {
    private history: ChatMessage[] = [];
    private tokenUsage: { prompt: number; completion: number } = { prompt: 0, completion: 0 };
    private systemPrompt: string;
    private sessionId: string;
    private sessionName: string;
    private sessionsDir: string | null = null;

    constructor(systemPrompt: string, projectPath?: string) {
        this.systemPrompt = systemPrompt;
        this.sessionId = this.generateId();
        this.sessionName = `Session ${new Date().toLocaleString()}`;
        this.history.push({ role: 'system', content: systemPrompt });

        if (projectPath) {
            this.sessionsDir = path.join(projectPath, '.watcher', 'sessions');
            if (!fs.existsSync(this.sessionsDir)) {
                fs.mkdirSync(this.sessionsDir, { recursive: true });
            }
        }
    }

    private generateId(): string {
        return `s_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
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
        return this.history.filter((m) => m.role !== 'system').length;
    }

    getSessionId(): string {
        return this.sessionId;
    }

    getSessionName(): string {
        return this.sessionName;
    }

    setSessionName(name: string): void {
        this.sessionName = name;
    }

    // ─── Multi-session support ─────────────────────────────────

    /**
     * Save the current session to disk.
     */
    saveSession(): void {
        if (!this.sessionsDir) return;
        const data = {
            id: this.sessionId,
            name: this.sessionName,
            createdAt: new Date().toISOString(),
            tokenUsage: this.tokenUsage,
            history: this.history.filter((m) => m.role !== 'system'),
        };
        const filePath = path.join(this.sessionsDir, `${this.sessionId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    /**
     * List all saved sessions.
     */
    listSessions(): SessionInfo[] {
        if (!this.sessionsDir || !fs.existsSync(this.sessionsDir)) return [];

        const files = fs.readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'));
        const sessions: SessionInfo[] = [];

        for (const file of files) {
            try {
                const raw = fs.readFileSync(path.join(this.sessionsDir, file), 'utf-8');
                const data = JSON.parse(raw);
                sessions.push({
                    id: data.id,
                    name: data.name,
                    createdAt: data.createdAt,
                    messageCount: data.history?.length ?? 0,
                });
            } catch {
                // Skip corrupted files
            }
        }

        return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    /**
     * Load a session by ID, restoring its history.
     */
    loadSession(sessionId: string): boolean {
        if (!this.sessionsDir) return false;
        const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
        if (!fs.existsSync(filePath)) return false;

        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(raw);

            // Save current session first
            this.saveSession();

            this.sessionId = data.id;
            this.sessionName = data.name;
            this.tokenUsage = data.tokenUsage || { prompt: 0, completion: 0 };
            this.history = [{ role: 'system', content: this.systemPrompt }, ...data.history];

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Create a new session, saving the current one first.
     */
    newSession(name?: string): void {
        this.saveSession();
        this.sessionId = this.generateId();
        this.sessionName = name || `Session ${new Date().toLocaleString()}`;
        this.history = [{ role: 'system', content: this.systemPrompt }];
        this.tokenUsage = { prompt: 0, completion: 0 };
    }

    clear(): void {
        const systemMsg = this.history[0];
        this.history = [systemMsg];
        this.tokenUsage = { prompt: 0, completion: 0 };
    }
}
