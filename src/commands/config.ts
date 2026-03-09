import inquirer from 'inquirer';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { CredentialManager } from '../credentials/CredentialManager';
import { ConfigManager } from '../config/ConfigManager';
import { AIProviderFactory } from '../ai/AIProviderFactory';
import { fetchModels, ModelInfo } from '../ai/modelFetcher';
import { CommandOptions } from '../types';

const NEON = chalk.hex('#39FF14');

/**
 * Prompt for model selection with search capability (shared logic).
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
      { type: 'input', name: 'model', message: 'Enter model ID:' },
    ]);
    return model;
  }

  if (method === 'search') {
    let selectedModel = '';
    while (!selectedModel) {
      const { searchTerm } = await inquirer.prompt([
        { type: 'input', name: 'searchTerm', message: 'Search models (type a keyword):' },
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
        { type: 'list', name: 'model', message: 'Select a model:', choices, pageSize: 20 },
      ]);

      if (model !== '__search_again__') {
        selectedModel = model;
      }
    }
    return selectedModel;
  }

  // Browse
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

export async function configCommand(options: CommandOptions): Promise<void> {
  try {
    const projectPath = process.cwd();
    const configManager = new ConfigManager(projectPath);
    const credentialManager = new CredentialManager(projectPath);

    if (!configManager.exists()) {
      logger.error('Watcher is not initialized. Run: watcher init');
      process.exit(1);
    }

    const config = await configManager.load();

    logger.header('Watcher Configuration');

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to configure?',
        choices: [
          { name: NEON('Add API Key') + chalk.dim('         — Save a new API key'), value: 'add-key' },
          { name: NEON('Switch API Key') + chalk.dim('      — Switch between saved keys'), value: 'switch-key' },
          { name: NEON('Change Provider') + chalk.dim('     — Switch AI provider & model'), value: 'change-provider' },
          { name: NEON('Change Model') + chalk.dim('        — Pick a different model'), value: 'change-model' },
          { name: NEON('Test Connection') + chalk.dim('     — Verify API connectivity'), value: 'test' },
          { name: NEON('View Settings') + chalk.dim('       — Show current configuration'), value: 'view' },
          { name: NEON('Delete API Key') + chalk.dim('      — Remove a saved key'), value: 'delete-key' },
        ],
      },
    ]);

    switch (action) {
      case 'add-key':
        await addApiKey(config.aiProvider, configManager, credentialManager);
        break;
      case 'switch-key':
        await switchApiKey(config.aiProvider, configManager, credentialManager);
        break;
      case 'change-provider':
        await changeProvider(configManager, credentialManager);
        break;
      case 'change-model':
        await changeModel(configManager, credentialManager);
        break;
      case 'test':
        await testConnection(config.aiProvider, config.model, credentialManager, config.keyAlias);
        break;
      case 'view':
        await viewSettings(config, credentialManager);
        break;
      case 'delete-key':
        await deleteApiKey(config.aiProvider, credentialManager);
        break;
    }
  } catch (error: any) {
    logger.error(`Configuration failed: ${error.message}`);
    process.exit(1);
  }
}

async function addApiKey(
  provider: string,
  configManager: ConfigManager,
  credentialManager: CredentialManager
): Promise<void> {
  logger.info(`Adding a new API key for: ${chalk.white(provider)}`);

  // Show existing keys
  const existingAliases = await credentialManager.listKeyAliases(provider);
  if (existingAliases.length > 0) {
    logger.info(`Existing keys: ${existingAliases.map((a) => NEON(a)).join(', ')}`);
  }

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
      message: 'Enter your API key:',
      mask: '*',
      validate: (input: string) => (input.length > 0 ? true : 'API key cannot be empty'),
    },
  ]);

  const finalAlias = alias.trim();
  logger.startSpinner('Saving API key...');
  await credentialManager.storeApiKey(provider, apiKey, finalAlias);
  logger.stopSpinner(true, `API key "${finalAlias}" saved securely.`);

  if (existingAliases.length === 0) {
    const config = await configManager.load();
    config.keyAlias = finalAlias;
    await configManager.save(config);
    logger.success(`Set "${finalAlias}" as the active key automatically.`);
  } else {
    const { makeActive } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'makeActive',
        message: `Set "${finalAlias}" as the active key?`,
        default: true,
      }
    ]);
    if (makeActive) {
      const config = await configManager.load();
      config.keyAlias = finalAlias;
      await configManager.save(config);
      logger.success(`Switched active key to "${finalAlias}".`);
    }
  }
}

async function switchApiKey(
  provider: string,
  configManager: ConfigManager,
  credentialManager: CredentialManager
): Promise<void> {
  const aliases = await credentialManager.listKeyAliases(provider);

  if (aliases.length === 0) {
    logger.warn('No API keys saved for this provider. Use "Add API Key" first.');
    return;
  }

  if (aliases.length === 1) {
    logger.info(`Only one key saved: ${NEON(aliases[0])}. Nothing to switch.`);
    return;
  }

  const config = await configManager.load();

  const { alias } = await inquirer.prompt([
    {
      type: 'list',
      name: 'alias',
      message: 'Select API key to use:',
      choices: aliases.map((a) => ({
        name: a === config.keyAlias ? NEON(a) + chalk.dim(' (active)') : a,
        value: a,
      })),
    },
  ]);

  config.keyAlias = alias;
  await configManager.save(config);
  logger.success(`Switched to API key: ${NEON(alias)}`);
}

async function deleteApiKey(
  provider: string,
  credentialManager: CredentialManager
): Promise<void> {
  const aliases = await credentialManager.listKeyAliases(provider);

  if (aliases.length === 0) {
    logger.warn('No API keys saved for this provider.');
    return;
  }

  const { alias } = await inquirer.prompt([
    {
      type: 'list',
      name: 'alias',
      message: 'Select API key to delete:',
      choices: aliases.map((a) => ({ name: a, value: a })),
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete key "${alias}"?`,
      default: false,
    },
  ]);

  if (confirm) {
    await credentialManager.deleteApiKey(provider, alias);
    logger.success(`Deleted API key: ${alias}`);
  }
}

async function changeModel(
  configManager: ConfigManager,
  credentialManager: CredentialManager
): Promise<void> {
  const config = await configManager.load();
  const apiKey = await credentialManager.getApiKey(config.aiProvider, config.keyAlias);

  if (!apiKey) {
    logger.error('API key not found. Please add one first.');
    return;
  }

  logger.startSpinner('Fetching available models...');
  try {
    const models = await fetchModels(config.aiProvider, apiKey);
    logger.stopSpinner(true, `Found ${models.length} models.`);

    const selectedModel = await promptModelSelection(models);
    config.model = selectedModel;
    await configManager.save(config);
    logger.success(`Model changed to: ${NEON(selectedModel)}`);
  } catch (error: any) {
    logger.stopSpinner(false, `Could not fetch models: ${error.message}`);
    const { model } = await inquirer.prompt([
      { type: 'input', name: 'model', message: 'Enter model name manually:' },
    ]);
    config.model = model;
    await configManager.save(config);
    logger.success(`Model changed to: ${NEON(model)}`);
  }
}

async function testConnection(
  provider: string,
  model: string,
  credentialManager: CredentialManager,
  keyAlias?: string
): Promise<void> {
  logger.info(`Testing connection to: ${chalk.white(provider)}`);

  const apiKey = await credentialManager.getApiKey(provider, keyAlias);

  if (!apiKey) {
    logger.error('API key not found. Please set it first.');
    return;
  }

  logger.startSpinner('Testing API connection...');

  try {
    const aiProvider = AIProviderFactory.create({
      provider: provider as any,
      apiKey,
      model,
    });

    const isValid = await aiProvider.validateConfig();

    if (isValid) {
      logger.stopSpinner(true, 'Connection successful.');
      logger.success(`${provider} is configured correctly.`);
    } else {
      logger.stopSpinner(false, 'Connection failed.');
      logger.error('API key may be invalid or service is unavailable.');
    }
  } catch (error: any) {
    logger.stopSpinner(false, 'Connection failed.');
    logger.error(`Error: ${error.message}`);
  }
}

async function viewSettings(
  config: any,
  credentialManager: CredentialManager
): Promise<void> {
  const hasKey = await credentialManager.hasApiKey(config.aiProvider, config.keyAlias);
  const aliases = await credentialManager.listKeyAliases(config.aiProvider);

  logger.box(
    `AI Provider:  ${config.aiProvider}
Model:        ${config.model}
Active Key:   ${config.keyAlias || 'default'} ${hasKey ? NEON('✓') : chalk.red('✗ not set')}
Saved Keys:   ${aliases.length > 0 ? aliases.join(', ') : 'none'}
Interval:     ${config.watchInterval}ms

Features:
  Auto Docs:    ${config.features.autoDocumentation ? NEON('Enabled') : chalk.dim('Disabled')}
  Tech Debt:    ${config.features.technicalDebt ? NEON('Enabled') : chalk.dim('Disabled')}
  Analytics:    ${config.features.analytics ? NEON('Enabled') : chalk.dim('Disabled')}`,
    'Current Configuration'
  );
}

async function changeProvider(
  configManager: ConfigManager,
  credentialManager: CredentialManager
): Promise<void> {
  const config = await configManager.load();

  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select new AI provider:',
      choices: [
        { name: NEON('AWS Bedrock') + chalk.dim(' — Claude 4.6, Titan, Llama via AWS'), value: 'bedrock' },
        { name: NEON('OpenRouter') + chalk.dim(' — Claude, GPT-4, Gemini, Llama & more'), value: 'openrouter' },
        { name: NEON('Groq') + chalk.dim(' — Ultra-fast inference with Llama models'), value: 'groq' },
      ],
      default: config.aiProvider,
    },
  ]);

  config.aiProvider = provider;

  // Check for existing keys
  const aliases = await credentialManager.listKeyAliases(provider);

  let keyAlias = 'default';
  if (aliases.length > 0) {
    logger.info(`Found saved keys for ${provider}: ${aliases.map((a) => NEON(a)).join(', ')}`);
    const { useExisting } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useExisting',
        message: 'Use an existing key?',
        default: true,
      },
    ]);

    if (useExisting) {
      if (aliases.length === 1) {
        keyAlias = aliases[0];
      } else {
        const { alias } = await inquirer.prompt([
          {
            type: 'list',
            name: 'alias',
            message: 'Select API key:',
            choices: aliases.map((a) => ({ name: a, value: a })),
          },
        ]);
        keyAlias = alias;
      }
    } else {
      await addApiKey(provider, configManager, credentialManager);
      const updatedAliases = await credentialManager.listKeyAliases(provider);
      keyAlias = updatedAliases[updatedAliases.length - 1] || 'default';
    }
  } else {
    logger.warn('No API key saved for this provider.');
    await addApiKey(provider, configManager, credentialManager);
    const updatedAliases = await credentialManager.listKeyAliases(provider);
    keyAlias = updatedAliases[updatedAliases.length - 1] || 'default';
  }

  config.keyAlias = keyAlias;

  // Fetch models with the selected key and let user pick
  const apiKey = await credentialManager.getApiKey(provider, keyAlias);
  if (apiKey) {
    logger.startSpinner('Fetching available models...');
    try {
      const models = await fetchModels(provider, apiKey);
      logger.stopSpinner(true, `Found ${models.length} models.`);
      config.model = await promptModelSelection(models);
    } catch (error: any) {
      logger.stopSpinner(false, `Could not fetch models: ${error.message}`);
      const { model } = await inquirer.prompt([
        { type: 'input', name: 'model', message: 'Enter model name:' },
      ]);
      config.model = model;
    }
  }

  await configManager.save(config);
  logger.success('Provider updated successfully.');

  logger.box(
    `Provider:  ${config.aiProvider}\nModel:     ${config.model}\nKey:       ${config.keyAlias || 'default'}`,
    'Updated Configuration'
  );
}
