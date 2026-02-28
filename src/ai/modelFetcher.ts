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

        // Return top 50 most relevant models to keep the list manageable
        return models.slice(0, 50);
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
