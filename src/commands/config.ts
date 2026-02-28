import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { CredentialManager } from '../credentials/CredentialManager';
import { ConfigManager } from '../config/ConfigManager';
import { AIProviderFactory } from '../ai/AIProviderFactory';
import { CommandOptions } from '../types';

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
          { name: 'Set API Key', value: 'set-key' },
          { name: 'Test API Connection', value: 'test' },
          { name: 'View Current Settings', value: 'view' },
          { name: 'Change AI Provider', value: 'change-provider' },
        ],
      },
    ]);

    switch (action) {
      case 'set-key':
        await setApiKey(config.aiProvider, credentialManager);
        break;
      case 'test':
        await testConnection(config.aiProvider, config.model, credentialManager);
        break;
      case 'view':
        await viewSettings(config, credentialManager);
        break;
      case 'change-provider':
        await changeProvider(configManager, credentialManager);
        break;
    }
  } catch (error: any) {
    logger.error(`Configuration failed: ${error.message}`);
    process.exit(1);
  }
}

async function setApiKey(
  provider: string,
  credentialManager: CredentialManager
): Promise<void> {
  logger.info(`Setting API key for: ${provider}`);

  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your API key:',
      mask: '*',
      validate: (input) => (input.length > 0 ? true : 'API key cannot be empty'),
    },
  ]);

  logger.startSpinner('Saving API key...');
  await credentialManager.storeApiKey(provider, apiKey);
  logger.stopSpinner(true, 'API key saved securely.');

  logger.success('API key configured.');
}

async function testConnection(
  provider: string,
  model: string,
  credentialManager: CredentialManager
): Promise<void> {
  logger.info(`Testing connection to: ${provider}`);

  const apiKey = await credentialManager.getApiKey(provider);

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
  const hasKey = await credentialManager.hasApiKey(config.aiProvider);

  logger.box(
    `AI Provider: ${config.aiProvider}
Model: ${config.model}
API Key: ${hasKey ? 'Configured' : 'Not set'}
Watch Interval: ${config.watchInterval}ms

Features:
  Auto Documentation: ${config.features.autoDocumentation ? 'Enabled' : 'Disabled'}
  Technical Debt: ${config.features.technicalDebt ? 'Enabled' : 'Disabled'}
  Analytics: ${config.features.analytics ? 'Enabled' : 'Disabled'}`,
    'Current Configuration'
  );
}

async function changeProvider(
  configManager: ConfigManager,
  credentialManager: CredentialManager
): Promise<void> {
  const config = await configManager.load();

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select new AI provider:',
      choices: [
        { name: 'OpenRouter', value: 'openrouter' },
        { name: 'AWS Bedrock', value: 'bedrock' },
        { name: 'Groq', value: 'groq' },
      ],
      default: config.aiProvider,
    },
    {
      type: 'input',
      name: 'model',
      message: 'Enter model name:',
      default: (answers: any) => {
        if (answers.provider === 'openrouter') return 'anthropic/claude-3-sonnet';
        if (answers.provider === 'groq') return 'llama-3.1-70b-versatile';
        return 'anthropic.claude-v2';
      },
    },
  ]);

  config.aiProvider = answers.provider;
  config.model = answers.model;

  await configManager.save(config);
  logger.success('Provider updated.');

  const hasKey = await credentialManager.hasApiKey(answers.provider);
  if (!hasKey) {
    logger.warn('API key not set for this provider.');
    const { setNow } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'setNow',
        message: 'Would you like to set the API key now?',
        default: true,
      },
    ]);

    if (setNow) {
      await setApiKey(answers.provider, credentialManager);
    }
  }
}
