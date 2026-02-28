import readline from 'readline';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { AIProviderFactory } from '../ai/AIProviderFactory';
import { CredentialManager } from '../credentials/CredentialManager';
import { ConfigManager } from '../config/ConfigManager';
import { WatcherDatabase } from '../database/Database';
import { SessionManager } from './sessionManager';
import { ChatTools } from './chatTools';
import { WatcherConfig } from '../types';
import path from 'path';

const NEON = chalk.hex('#39FF14');

export async function startChatMode(projectPath: string): Promise<void> {
    const configManager = new ConfigManager(projectPath);
    const credentialManager = new CredentialManager(projectPath);
    const config = await configManager.load();

    // Get API key
    const apiKey = await credentialManager.getApiKey(config.aiProvider);
    if (!apiKey) {
        logger.error('API key not found. Run watcher to reconfigure.');
        return;
    }

    // Initialize AI provider
    const aiProvider = AIProviderFactory.create({
        provider: config.aiProvider as any,
        apiKey,
        model: config.model,
    });

    // Initialize database and tools
    const db = new WatcherDatabase(projectPath);
    await db.initialize();
    const tools = new ChatTools(projectPath, db);

    // Gather context for system prompt
    const gitStatus = tools.getGitStatus();
    const fileList = tools.getFileList();
    const projectSummary = tools.getProjectSummary();

    const systemPrompt = `You are Watcher, an intelligent development assistant. You have deep knowledge of the user's local repository and codebase. Respond in a professional, concise manner without using emojis or casual language.

Current Project Context:
${projectSummary}

Git Status:
${gitStatus}

Project Files:
${fileList}

${tools.getToolDescriptions()}

When the user asks about their codebase, git status, project structure, or development progress, provide precise, actionable answers based on the context above. If you need to reference specific files, mention their paths. Keep responses focused and technical.`;

    // Initialize session
    const session = new SessionManager(systemPrompt);

    logger.header('Chat Mode');
    logger.info(`Provider: ${chalk.white(config.aiProvider)} | Model: ${chalk.white(config.model)}`);
    logger.info(`Project: ${chalk.white(path.basename(projectPath))}`);
    logger.blank();
    logger.info('Type your message to talk about this repository.');
    logger.info('Commands: ' + chalk.dim('status, diff, files, cat <path>, summary, clear, exit'));
    logger.divider();
    logger.blank();

    // Start REPL
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: NEON('watcher > '),
    });

    rl.prompt();

    rl.on('line', async (line: string) => {
        const input = line.trim();

        if (!input) {
            rl.prompt();
            return;
        }

        // Handle exit
        if (input === 'exit' || input === 'quit') {
            logger.blank();
            logger.info(session.getUsageSummary());
            logger.success('Session ended.');
            db.close();
            rl.close();
            return;
        }

        // Handle clear
        if (input === 'clear') {
            session.clear();
            logger.success('Conversation cleared.');
            logger.blank();
            rl.prompt();
            return;
        }

        // Handle direct tool commands
        const toolResult = await tools.executeCommand(input);
        if (toolResult) {
            console.log();
            console.log(chalk.white(toolResult));
            console.log();
            rl.prompt();
            return;
        }

        // Send to AI
        session.addUserMessage(input);

        process.stdout.write(chalk.dim('\n  Thinking...\r'));

        try {
            const messages = session.getMessages();
            const body = {
                model: config.model,
                messages: messages.map((m) => ({ role: m.role, content: m.content })),
            };

            const response = await aiProvider.analyze(input, systemPrompt);

            // Clear the "Thinking..." line
            process.stdout.write('               \r');

            const assistantMessage = response.content;
            session.addAssistantMessage(assistantMessage);

            if (response.usage) {
                session.trackUsage(response.usage.promptTokens, response.usage.completionTokens);
            }

            // Display response
            console.log();
            console.log(NEON.bold('  Watcher'));
            console.log(chalk.dim('  ──────'));

            // Format response with proper indentation
            const lines = assistantMessage.split('\n');
            for (const responseLine of lines) {
                console.log(`  ${responseLine}`);
            }

            console.log();
        } catch (error: any) {
            process.stdout.write('               \r');
            logger.error(`AI request failed: ${error.message}`);
            session.addAssistantMessage(`[Error: ${error.message}]`);
            console.log();
        }

        rl.prompt();
    });

    rl.on('close', () => {
        db.close();
    });

    // Keep the process alive
    return new Promise<void>((resolve) => {
        rl.on('close', () => {
            resolve();
        });
    });
}
