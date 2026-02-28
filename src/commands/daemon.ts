import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import {
    loadRegistry,
    getPidPath,
    getLogPath,
    addProject,
    removeProject,
} from '../daemon/daemonRegistry';
import { enableAutostart, disableAutostart, isAutostartEnabled } from '../daemon/autostart';
import chalk from 'chalk';

const NEON = chalk.hex('#39FF14');

export async function daemonCommand(args: string[]): Promise<void> {
    const subcommand = args[0] || 'status';

    switch (subcommand) {
        case 'start':
            return startDaemon();
        case 'stop':
            return stopDaemon();
        case 'status':
            return showStatus();
        case 'logs':
            return showLogs();
        case 'enable':
            return enableBoot();
        case 'disable':
            return disableBoot();
        default:
            logger.error(`Unknown daemon command: ${subcommand}`);
            logger.info('Available: start, stop, status, logs, enable, disable');
    }
}

function getDaemonScript(): string {
    // Resolve the daemon.js path relative to this file's compiled location
    return path.resolve(__dirname, '..', 'daemon', 'daemon.js');
}

function getDaemonPid(): number | null {
    const pidPath = getPidPath();
    if (!fs.existsSync(pidPath)) return null;

    try {
        const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim());
        if (isNaN(pid)) return null;

        // Check if process is actually running
        try {
            process.kill(pid, 0); // Signal 0 = check if alive
            return pid;
        } catch {
            // PID file exists but process is dead — clean up
            fs.unlinkSync(pidPath);
            return null;
        }
    } catch {
        return null;
    }
}

function startDaemon(): void {
    logger.header('Starting Daemon');

    const pid = getDaemonPid();
    if (pid) {
        logger.warn(`Daemon is already running (PID: ${pid}).`);
        return;
    }

    const daemonScript = getDaemonScript();

    if (!fs.existsSync(daemonScript)) {
        logger.error('Daemon script not found. Run: npm run build');
        return;
    }

    const projects = loadRegistry();
    if (projects.length === 0) {
        logger.warn('No projects registered. Run: watcher init (in a project directory)');
        return;
    }

    // Spawn detached background process
    const child = spawn(process.execPath, [daemonScript], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
    });

    child.unref();

    logger.success(`Daemon started (PID: ${child.pid}).`);
    logger.info(`Monitoring ${projects.length} project(s).`);
    logger.info(`Logs: ${getLogPath()}`);
}

function stopDaemon(): void {
    logger.header('Stopping Daemon');

    const pid = getDaemonPid();
    if (!pid) {
        logger.info('Daemon is not running.');
        return;
    }

    try {
        process.kill(pid, 'SIGTERM');
        logger.success(`Daemon stopped (PID: ${pid}).`);

        // Clean up PID file
        const pidPath = getPidPath();
        if (fs.existsSync(pidPath)) {
            fs.unlinkSync(pidPath);
        }
    } catch (error: any) {
        logger.error(`Failed to stop daemon: ${error.message}`);
    }
}

function showStatus(): void {
    logger.header('Daemon Status');

    const pid = getDaemonPid();
    const projects = loadRegistry();
    const autostart = isAutostartEnabled();

    logger.table(
        ['Property', 'Value'],
        [
            ['Status', pid ? NEON('Running') : chalk.dim('Stopped')],
            ['PID', pid ? String(pid) : 'N/A'],
            ['Auto-Start', autostart ? NEON('Enabled') : chalk.dim('Disabled')],
            ['Registered Projects', String(projects.length)],
            ['Log File', getLogPath()],
        ]
    );

    if (projects.length > 0) {
        logger.blank();
        logger.section('Monitored Projects');
        logger.table(
            ['Name', 'Path', 'Added'],
            projects.map((p) => [
                p.name,
                p.path,
                p.addedAt.split('T')[0],
            ])
        );
    }
}

function showLogs(): void {
    const logPath = getLogPath();

    if (!fs.existsSync(logPath)) {
        logger.info('No daemon logs found.');
        return;
    }

    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n');
    const tail = lines.slice(-50).join('\n'); // Show last 50 lines

    logger.header('Daemon Logs (last 50 lines)');
    console.log(chalk.dim(tail));
}

function enableBoot(): void {
    logger.header('Enabling Auto-Start');

    const daemonScript = getDaemonScript();
    const success = enableAutostart(process.execPath, daemonScript);

    if (success) {
        logger.success('Auto-start enabled. Daemon will launch on boot.');
    } else {
        logger.error('Failed to enable auto-start.');
    }
}

function disableBoot(): void {
    logger.header('Disabling Auto-Start');

    const success = disableAutostart();

    if (success) {
        logger.success('Auto-start disabled.');
    } else {
        logger.error('Failed to disable auto-start.');
    }
}
