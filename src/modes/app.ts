import { AIProviderFactory } from '../ai/AIProviderFactory';
import { CredentialManager } from '../credentials/CredentialManager';
import { ConfigManager } from '../config/ConfigManager';
import { WatcherDatabase } from '../database/Database';
import { SessionManager } from './sessionManager';
import { ChatTools } from './chatTools';
import { GitService } from '../git/GitService';
import { SemanticAnalyzer } from '../ai/SemanticAnalyzer';
import { ProgressGenerator } from '../documentation/ProgressGenerator';
import { ChangelogGenerator } from '../documentation/ChangelogGenerator';
import { renderApp } from '../tui/App';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import { EventEmitter } from 'events';

export async function runUnifiedApp(projectPath: string): Promise<void> {
    const configManager = new ConfigManager(projectPath);
    const credentialManager = new CredentialManager(projectPath);
    let config = await configManager.load();

    let apiKey = await credentialManager.getApiKey(config.aiProvider, config.keyAlias);

    // Auto-prompt UX fix: If there is no API key configured, prompt immediately.
    // Bedrock uses AWS env-var credentials — never prompt for API key.
    if (config.aiProvider !== 'bedrock' && !apiKey) {
        console.log(chalk.yellow(`\n[!] API key not found for provider: ${config.aiProvider}`));
        const { newApiKey } = await inquirer.prompt([
            {
                type: 'password',
                name: 'newApiKey',
                message: `Enter your ${config.aiProvider} API key:`,
                mask: '*',
                validate: (input: string) => input.length > 0 ? true : 'API key cannot be empty.',
            },
        ]);

        apiKey = newApiKey;
        const alias = config.keyAlias || 'default';
        await credentialManager.storeApiKey(config.aiProvider, apiKey!, alias);
        console.log(chalk.green(`\u2713 API key saved as "${alias}".\n`));

        config.keyAlias = alias;
        await configManager.save(config);

        console.log(chalk.dim('Testing API connection...'));
        const aiProviderTest = AIProviderFactory.create({
            provider: config.aiProvider as any,
            apiKey: apiKey!,
            model: config.model,
        });

        try {
            const isValid = await aiProviderTest.validateConfig();
            if (isValid) {
                console.log(chalk.green('\u2713 Connection successful! Booting interface...'));
                await new Promise((resolve) => setTimeout(resolve, 1500));
            } else {
                throw new Error(
                    'API connection failed. Please check your API key and try again.\n' +
                    'Run "watcher config" to update your API key.'
                );
            }
        } catch (err: any) {
            if (err.message.startsWith('API connection failed')) {
                throw err;
            }
            throw new Error(
                `API connection failed: ${err.message}\n` +
                'Run "watcher config" to update your API key.'
            );
        }
    }

    const aiProvider = AIProviderFactory.create({
        provider: config.aiProvider as any,
        apiKey: apiKey!,
        model: config.model,
    });

    const db = new WatcherDatabase(projectPath);
    await db.initialize();
    // Ensure this project is registered in the local database (idempotent upsert — safe every run)
    db.saveProject({
        name: path.basename(projectPath),
        path: projectPath,
        techStack: [],
        architecture: 'Unknown',
    });
    const tools = new ChatTools(projectPath, db);
    const gitService = new GitService(projectPath);
    const analyzer = new SemanticAnalyzer(aiProvider);
    const progressGen = new ProgressGenerator(db, projectPath);
    const changelogGen = new ChangelogGenerator(db, projectPath);

    function getSystemPrompt() {
        return `You are Watcher, an intelligent development assistant. You have deep knowledge of the user's local repository and codebase. Respond in a professional, concise manner without using emojis or casual language.

Format your responses using clean Markdown:
- Use ## and ### headings to organize sections
- Use **bold** for emphasis on filenames and important terms
- Use \`backticks\` for file names, commands, and code references
- Use bullet lists (- item) for enumerations
- Use numbered lists (1. item) for sequential steps
- Use \`\`\`language code blocks for code snippets
- Keep paragraphs short (2-3 sentences max)

Current Project Context:
${tools.getProjectSummary()}

Git Status:
${tools.getGitStatus()}

Project Files:
${tools.getFileList()}

${tools.getToolDescriptions()}`;
    }

    const session = new SessionManager(getSystemPrompt(), projectPath);

    // --- Mouse scroll setup (BEFORE renderApp / Ink startup) ---
    // We must register on stdin here, before Ink's readline integration takes over,
    // because Ink calls process.stdin.pause() between renders which kills any
    // data listener registered inside a React component (useEffect).
    // An EventEmitter (scrollBus) bridges events into App.tsx safely.
    const scrollBus = new EventEmitter();
    scrollBus.setMaxListeners(4);

    // Enable mouse reporting on stdout now, before the alt-screen is drawn.
    process.stdout.write('\x1b[?1000h'); // X10 mouse button/scroll
    process.stdout.write('\x1b[?1006h'); // SGR extended coordinates

    // Ensure stdin is raw and flowing.
    try { if ((process.stdin as any).isTTY) (process.stdin as any).setRawMode(true); } catch {}
    process.stdin.resume();

    // Periodically re-resume stdin because Ink calls pause() between renders.
    const flowInterval = setInterval(() => process.stdin.resume(), 50);

    let seqBuf = '';
    const mouseHandler = (chunk: Buffer | string) => {
        seqBuf += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        const re = /\x1b\[<(\d+);(\d+);(\d+)[Mm]/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(seqBuf)) !== null) {
            scrollBus.emit('mouse', parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
        }
        seqBuf = seqBuf.replace(/\x1b\[<\d+;\d+;\d+[Mm]/g, '');
        if (seqBuf.length > 64) seqBuf = seqBuf.slice(-32);
    };
    process.stdin.on('data', mouseHandler);

    // --- Launch Ink TUI ---
    await renderApp({
        config,
        projectPath,
        aiProvider,
        session,
        tools,
        gitService,
        db,
        analyzer,
        progressGen,
        changelogGen,
        configManager,
        credentialManager,
        scrollBus,
    });

    // Cleanup mouse after TUI exits
    clearInterval(flowInterval);
    process.stdin.off('data', mouseHandler);
    process.stdout.write('\x1b[?1006l');
    process.stdout.write('\x1b[?1000l');

    // After TUI exits
    console.log(session.getUsageSummary());
    console.log('Session ended.');
}
