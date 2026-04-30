export interface ModelInfo {
    id: string;
    name: string;
}

export async function fetchModels(provider: string, apiKey: string): Promise<ModelInfo[]> {
    switch (provider) {
        case 'openrouter':
            return fetchOpenRouterModels(apiKey);
        case 'groq':
            return fetchGroqModels(apiKey);
        case 'bedrock':
            return getBedrockModels();
        case 'anthropic':
            return getAnthropicModels();
        case 'gemini':
            return getGeminiModels();
        case 'openai':
            return fetchOpenAIModels(apiKey);
        case 'ollama':
            return fetchOllamaModels();
        case 'lmstudio':
            return fetchLMStudioModels();
        case 'llamacpp':
            return fetchLlamaCppModels();
        default:
            return [];
    }
}

async function fetchOpenRouterModels(apiKey: string): Promise<ModelInfo[]> {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data: any = await response.json();
        const models: ModelInfo[] = (data.data || [])
            .filter((m: any) => m.id)
            .map((m: any) => ({
                id: m.id,
                name: m.name || m.id,
            }))
            .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));

        return models;
    } catch (error: any) {
        throw new Error(`Failed to fetch OpenRouter models: ${error.message}`);
    }
}

async function fetchGroqModels(apiKey: string): Promise<ModelInfo[]> {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data: any = await response.json();
        const models: ModelInfo[] = (data.data || [])
            .filter((m: any) => m.id)
            .map((m: any) => ({
                id: m.id,
                name: m.id,
            }))
            .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));

        return models;
    } catch (error: any) {
        throw new Error(`Failed to fetch Groq models: ${error.message}`);
    }
}

function getBedrockModels(): ModelInfo[] {
    // Bedrock has no public model listing API; return known models
    return [
        { id: 'anthropic.claude-3-sonnet-20240229-v1:0', name: 'Claude 3 Sonnet' },
        { id: 'anthropic.claude-3-haiku-20240307-v1:0', name: 'Claude 3 Haiku' },
        { id: 'anthropic.claude-v2', name: 'Claude v2' },
        { id: 'amazon.titan-text-express-v1', name: 'Amazon Titan Text Express' },
        { id: 'meta.llama3-70b-instruct-v1:0', name: 'Llama 3 70B' },
    ];
}

function getAnthropicModels(): ModelInfo[] {
    return [
        { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
        { id: 'claude-3-opus-latest', name: 'Claude 3 Opus' },
    ];
}

function getGeminiModels(): ModelInfo[] {
    return [
        { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' },
    ];
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: any = await response.json();
        return (data.data || [])
            .filter((m: any) => m.id)
            .map((m: any) => ({ id: m.id, name: m.id }))
            .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
    } catch (error: any) {
        throw new Error(`Failed to fetch OpenAI models: ${error.message}`);
    }
}

async function fetchOllamaModels(): Promise<ModelInfo[]> {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: any = await response.json();
        return (data.models || []).map((m: any) => ({ id: m.name, name: m.name }));
    } catch (error: any) {
        throw new Error(`Failed to fetch Ollama models. Is Ollama running?: ${error.message}`);
    }
}

async function fetchLMStudioModels(): Promise<ModelInfo[]> {
    try {
        const response = await fetch('http://localhost:1234/v1/models');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: any = await response.json();
        return (data.data || []).map((m: any) => ({ id: m.id, name: m.id }));
    } catch (error: any) {
        throw new Error(`Failed to fetch LM Studio models. Is LM Studio running?: ${error.message}`);
    }
}

async function fetchLlamaCppModels(): Promise<ModelInfo[]> {
    try {
        const response = await fetch('http://localhost:8080/v1/models');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: any = await response.json();
        return (data.data || []).map((m: any) => ({ id: m.id, name: m.id }));
    } catch (error: any) {
        throw new Error(`Failed to fetch Llama.cpp models. Is Llama.cpp server running?: ${error.message}`);
    }
}
