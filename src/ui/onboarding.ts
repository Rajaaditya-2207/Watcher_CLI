import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { ConfigManager } from '../config/ConfigManager';
import { WatcherDatabase } from '../database/Database';
import { CredentialManager } from '../credentials/CredentialManager';
import { fetchModels } from '../ai/modelFetcher';
import { WatcherConfig } from '../types';
import chalk from 'chalk';
import path from 'path';

const NEON = chalk.hex('#39FF14');

export async function runOnboarding(projectPath: string): Promise<void> {
    logger.header('First-Time Setup');
    logger.info('Let\'s configure Watcher for this project.\n');

    const configManager = new ConfigManager(projectPath);
    const credentialManager = new CredentialManager(projectPath);

    // Step 1: Select provider
    const { provider } = await inquirer.prompt([
        {
            type: 'list',
            name: 'provider',
            message: 'Select your AI provider:',
            choices: [
                { name: NEON('AWS Bedrock') + chalk.dim(' — Claude 4.6, Titan, Llama via AWS'), value: 'bedrock' },
                { name: NEON('OpenRouter') + chalk.dim(' — Claude, GPT-4, Gemini, Llama & more'), value: 'openrouter' },
                { name: NEON('Groq') + chalk.dim(' — Ultra-fast inference with Llama models'), value: 'groq' },
            ],
        },
    ]);

    // Step 2: Enter API key
    const { apiKey } = await inquirer.prompt([
        {
            type: 'password',
            name: 'apiKey',
            message: `Enter your ${provider} API key:`,
            mask: '*',
            validate: (input: string) => input.length > 0 ? true : 'API key cannot be empty.',
        },
    ]);

    // Save API key securely
    logger.startSpinner('Storing API key securely...');
    await credentialManager.storeApiKey(provider, apiKey);
    logger.stopSpinner(true, 'API key stored (AES-256-CBC encrypted).');

    // Step 3: Fetch and select model
    let selectedModel = '';

    logger.startSpinner('Fetching available models...');
    try {
        const models = await fetchModels(provider, apiKey);
        logger.stopSpinner(true, `Found ${models.length} model${models.length !== 1 ? 's' : ''}.`);

        if (models.length > 0) {
            const { model } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'model',
                    message: 'Select a model:',
                    choices: models.map((m) => ({
                        name: NEON(m.id) + (m.name !== m.id ? chalk.dim(` — ${m.name}`) : ''),
                        value: m.id,
                    })),
                    pageSize: 15,
                },
            ]);
            selectedModel = model;
        } else {
            // Fallback to manual input
            const { model } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'model',
                    message: 'Enter model name:',
                    default: provider === 'openrouter' ? 'anthropic/claude-3-sonnet' : 'llama-3.1-70b-versatile',
                },
            ]);
            selectedModel = model;
        }
    } catch (error: any) {
        logger.stopSpinner(false, `Could not fetch models: ${error.message}`);
        // Fallback to manual input
        const { model } = await inquirer.prompt([
            {
                type: 'input',
                name: 'model',
                message: 'Enter model name manually:',
                default: provider === 'openrouter' ? 'anthropic/claude-3-sonnet' : 'llama-3.1-70b-versatile',
            },
        ]);
        selectedModel = model;
    }

    // Step 4: Save configuration
    const config: WatcherConfig = {
        ...configManager.getDefaultConfig(),
        aiProvider: provider,
        model: selectedModel,
        features: {
            autoDocumentation: true,
            technicalDebt: true,
            analytics: true,
        },
    };

    logger.startSpinner('Saving configuration...');
    await configManager.save(config);
    logger.stopSpinner(true, 'Configuration saved.');

    // Step 5: Initialize database
    logger.startSpinner('Initializing database...');
    const db = new WatcherDatabase(projectPath);
    await db.initialize();
    db.saveProject({
        name: path.basename(projectPath),
        path: projectPath,
        techStack: [],
        architecture: 'Unknown',
    });
    db.close();
    logger.stopSpinner(true, 'Database initialized.');

    logger.blank();
    logger.box(
        `Provider:  ${provider}\nModel:     ${selectedModel}\nProject:   ${path.basename(projectPath)}`,
        'Setup Complete'
    );
}
