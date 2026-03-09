import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { ConfigManager } from '../config/ConfigManager';
import { WatcherDatabase } from '../database/Database';
import { CredentialManager } from '../credentials/CredentialManager';
import { fetchModels, ModelInfo } from '../ai/modelFetcher';
import { WatcherConfig } from '../types';
import chalk from 'chalk';
import path from 'path';

const NEON = chalk.hex('#39FF14');

/**
 * Prompt for model selection with a search/filter capability.
 * Uses a standard list prompt with pageSize, plus a manual fallback.
 */
async function promptModelSelection(models: ModelInfo[]): Promise<string> {
    if (models.length === 0) {
        const { model } = await inquirer.prompt([
            {
                type: 'input',
                name: 'model',
                message: 'Enter model name manually:',
                default: 'anthropic/claude-3-sonnet',
            },
        ]);
        return model;
    }

    // Ask if user wants to search or browse
    const { method } = await inquirer.prompt([
        {
            type: 'list',
            name: 'method',
            message: `Found ${NEON(models.length.toString())} models. How would you like to select?`,
            choices: [
                { name: NEON('Search') + chalk.dim(' — Type to filter models by name'), value: 'search' },
                { name: NEON('Browse') + chalk.dim(' — Scroll through the full list'), value: 'browse' },
                { name: NEON('Manual') + chalk.dim(' — Enter a model ID directly'), value: 'manual' },
            ],
        },
    ]);

    if (method === 'manual') {
        const { model } = await inquirer.prompt([
            {
                type: 'input',
                name: 'model',
                message: 'Enter model ID:',
            },
        ]);
        return model;
    }

    if (method === 'search') {
        // Search loop: let user type a search term, show filtered results, repeat
        let selectedModel = '';
        while (!selectedModel) {
            const { searchTerm } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'searchTerm',
                    message: 'Search models (type a keyword):',
                },
            ]);

            const term = searchTerm.trim().toLowerCase();
            const filtered = term
                ? models.filter(
                    (m) =>
                        m.id.toLowerCase().includes(term) ||
                        m.name.toLowerCase().includes(term)
                )
                : models;

            if (filtered.length === 0) {
                logger.warn(`No models matched "${searchTerm}". Try again.`);
                continue;
            }

            logger.info(`Found ${NEON(filtered.length.toString())} matching models.`);

            const choices = filtered.map((m) => ({
                name: NEON(m.id) + (m.name !== m.id ? chalk.dim(` — ${m.name}`) : ''),
                value: m.id,
            }));
            choices.push({ name: chalk.dim('↩ Search again'), value: '__search_again__' });

            const { model } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'model',
                    message: 'Select a model:',
                    choices,
                    pageSize: 20,
                },
            ]);

            if (model !== '__search_again__') {
                selectedModel = model;
            }
        }
        return selectedModel;
    }

    // Browse mode — full list
    const { model } = await inquirer.prompt([
        {
            type: 'list',
            name: 'model',
            message: 'Select a model:',
            choices: models.map((m) => ({
                name: NEON(m.id) + (m.name !== m.id ? chalk.dim(` — ${m.name}`) : ''),
                value: m.id,
            })),
            pageSize: 20,
        },
    ]);
    return model;
}

/**
 * Prompt user for an API key with an optional alias/name.
 */
async function promptApiKey(provider: string): Promise<{ apiKey: string; alias: string }> {
    const { alias } = await inquirer.prompt([
        {
            type: 'input',
            name: 'alias',
            message: 'Give this key a name (e.g. "personal", "work"):',
            default: 'default',
            validate: (input: string) => input.trim().length > 0 ? true : 'Name cannot be empty.',
        },
    ]);

    const { apiKey } = await inquirer.prompt([
        {
            type: 'password',
            name: 'apiKey',
            message: `Enter your ${provider} API key:`,
            mask: '*',
            validate: (input: string) => input.length > 0 ? true : 'API key cannot be empty.',
        },
    ]);

    return { apiKey, alias: alias.trim() };
}

export async function runOnboarding(projectPath: string): Promise<void> {
    logger.header('First-Time Setup');
    logger.info('Welcome to Watcher! This config is stored globally — you\'ll only need to do this once.\n');

    const configManager = new ConfigManager(projectPath);
    const credentialManager = new CredentialManager(projectPath);

    // ── Step 1: Provider ──────────────────────────────────────────────────────
    const { provider } = await inquirer.prompt([
        {
            type: 'list',
            name: 'provider',
            message: 'Select your AI provider:',
            choices: [
                { name: NEON('AWS Bedrock') + chalk.dim(' — Claude, Titan, Llama via AWS (uses env vars)'), value: 'bedrock' },
                { name: NEON('OpenRouter') + chalk.dim(' — Claude, GPT-4, Gemini, Llama & more'), value: 'openrouter' },
                { name: NEON('Groq') + chalk.dim(' — Ultra-fast inference with Llama models'), value: 'groq' },
            ],
        },
    ]);

    // ── Step 2: API key (Bedrock uses env vars, no key needed) ────────────────
    let apiKey = '';
    let alias = 'default';
    if (provider !== 'bedrock') {
        const result = await promptApiKey(provider);
        apiKey = result.apiKey;
        alias = result.alias;
        logger.startSpinner('Storing API key securely...');
        await credentialManager.storeApiKey(provider, apiKey, alias);
        logger.stopSpinner(true, `API key "${alias}" stored (AES-256-CBC encrypted, global).`);
    } else {
        logger.info(chalk.dim('  Bedrock reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION from env.'));
    }

    // ── Step 3: Model selection ───────────────────────────────────────────────
    let selectedModel = '';
    logger.startSpinner('Fetching available models...');
    try {
        const models = await fetchModels(provider, apiKey);
        logger.stopSpinner(true, `Found ${models.length} model${models.length !== 1 ? 's' : ''}.`);
        selectedModel = await promptModelSelection(models);
    } catch (error: any) {
        logger.stopSpinner(false, `Could not fetch models: ${error.message}`);
        const { model } = await inquirer.prompt([
            {
                type: 'input',
                name: 'model',
                message: 'Enter model name manually:',
                default: provider === 'openrouter'
                    ? 'anthropic/claude-3-sonnet'
                    : provider === 'groq'
                        ? 'llama-3.3-70b-versatile'
                        : 'anthropic.claude-3-sonnet-20240229-v1:0',
            },
        ]);
        selectedModel = model;
    }

    // ── Step 4: Watch interval ────────────────────────────────────────────────
    const { watchIntervalStr } = await inquirer.prompt([
        {
            type: 'input',
            name: 'watchIntervalStr',
            message: 'File watch interval in ms (how often to detect changes):',
            default: '5000',
            validate: (v: string) => parseInt(v) > 0 ? true : 'Must be a positive number.',
        },
    ]);
    const watchInterval = parseInt(watchIntervalStr, 10);

    // ── Step 5: Feature toggles ───────────────────────────────────────────────
    logger.blank();
    logger.section('Feature Settings');
    const { autoDocumentation } = await inquirer.prompt([
        { type: 'confirm', name: 'autoDocumentation', message: 'Auto-generate documentation when files change?', default: true },
    ]);
    const { technicalDebt } = await inquirer.prompt([
        { type: 'confirm', name: 'technicalDebt', message: 'Track technical debt (TODO/FIXME comments, large files)?', default: true },
    ]);
    const { analytics } = await inquirer.prompt([
        { type: 'confirm', name: 'analytics', message: 'Enable development analytics (velocity, hotspots, timeline)?', default: true },
    ]);

    // ── Step 6: Reporting settings ────────────────────────────────────────────
    logger.blank();
    logger.section('Reporting Settings');
    const { defaultFormat } = await inquirer.prompt([
        {
            type: 'list',
            name: 'defaultFormat',
            message: 'Default report format:',
            choices: [
                { name: NEON('markdown') + chalk.dim(' — Rich Markdown report'), value: 'markdown' },
                { name: NEON('json') + chalk.dim(' — Machine-readable JSON'), value: 'json' },
                { name: NEON('slack') + chalk.dim(' — Slack-formatted text'), value: 'slack' },
            ],
        },
    ]);
    const { includeMetrics } = await inquirer.prompt([
        { type: 'confirm', name: 'includeMetrics', message: 'Include velocity metrics in reports?', default: true },
    ]);

    // ── Step 7: Summary + confirmation ───────────────────────────────────────
    logger.blank();
    logger.box(
        [
            `Provider:        ${provider}`,
            `Model:           ${selectedModel}`,
            `Key alias:       ${provider !== 'bedrock' ? alias : 'N/A (env vars)'}`,
            `Watch interval:  ${watchInterval}ms`,
            `Auto-docs:       ${autoDocumentation ? 'on' : 'off'}`,
            `Tech debt:       ${technicalDebt ? 'on' : 'off'}`,
            `Analytics:       ${analytics ? 'on' : 'off'}`,
            `Report format:   ${defaultFormat}`,
            `Include metrics: ${includeMetrics ? 'yes' : 'no'}`,
        ].join('\n'),
        'Configuration Summary'
    );

    const { confirmed } = await inquirer.prompt([
        { type: 'confirm', name: 'confirmed', message: 'Save this global configuration and launch Watcher?', default: true },
    ]);

    if (!confirmed) {
        logger.info('Setup cancelled. Run `watcher` again to restart setup.');
        process.exit(0);
    }

    // ── Step 8: Save global config ────────────────────────────────────────────
    const config: WatcherConfig = {
        ...configManager.getDefaultConfig(),
        aiProvider: provider,
        model: selectedModel,
        keyAlias: provider !== 'bedrock' ? alias : undefined,
        watchInterval,
        features: { autoDocumentation, technicalDebt, analytics },
        reporting: { defaultFormat, includeMetrics },
    };

    logger.startSpinner('Saving global configuration...');
    await configManager.save(config);
    logger.stopSpinner(true, 'Global configuration saved to ~/.watcher/config.json');

    // ── Step 9: Initialize local project database ─────────────────────────────
    logger.startSpinner('Initializing local project database...');
    const db = new WatcherDatabase(projectPath);
    await db.initialize();
    db.saveProject({
        name: path.basename(projectPath),
        path: projectPath,
        techStack: [],
        architecture: 'Unknown',
    });
    db.close();
    logger.stopSpinner(true, 'Database ready.');

    logger.blank();
    logger.info(NEON('[+] Watcher is configured globally. Launching...\n'));
}
