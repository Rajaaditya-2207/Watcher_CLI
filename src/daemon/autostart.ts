import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getGlobalDir } from './daemonRegistry';

const LABEL = 'com.kreonyx.watcher';
const SERVICE_NAME = 'WatcherDaemon';

export function enableAutostart(nodePath: string, daemonScript: string): boolean {
    const platform = os.platform();

    try {
        switch (platform) {
            case 'win32':
                return enableWindows(nodePath, daemonScript);
            case 'darwin':
                return enableMacOS(nodePath, daemonScript);
            case 'linux':
                return enableLinux(nodePath, daemonScript);
            default:
                return false;
        }
    } catch {
        return false;
    }
}

export function disableAutostart(): boolean {
    const platform = os.platform();

    try {
        switch (platform) {
            case 'win32':
                return disableWindows();
            case 'darwin':
                return disableMacOS();
            case 'linux':
                return disableLinux();
            default:
                return false;
        }
    } catch {
        return false;
    }
}

export function isAutostartEnabled(): boolean {
    const platform = os.platform();

    try {
        switch (platform) {
            case 'win32':
                return checkWindows();
            case 'darwin':
                return checkMacOS();
            case 'linux':
                return checkLinux();
            default:
                return false;
        }
    } catch {
        return false;
    }
}

// --- Windows: Task Scheduler ---

function enableWindows(nodePath: string, daemonScript: string): boolean {
    const cmd = `schtasks /create /tn "${SERVICE_NAME}" /tr "\\"${nodePath}\\" \\"${daemonScript}\\"" /sc onlogon /rl limited /f`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
}

function disableWindows(): boolean {
    execSync(`schtasks /delete /tn "${SERVICE_NAME}" /f`, { stdio: 'ignore' });
    return true;
}

function checkWindows(): boolean {
    try {
        execSync(`schtasks /query /tn "${SERVICE_NAME}"`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

// --- macOS: LaunchAgent ---

function getMacPlistPath(): string {
    return path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
}

function enableMacOS(nodePath: string, daemonScript: string): boolean {
    const plistPath = getMacPlistPath();
    const logPath = path.join(getGlobalDir(), 'daemon.log');

    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${daemonScript}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${logPath}</string>
  <key>StandardErrorPath</key>
  <string>${logPath}</string>
</dict>
</plist>`;

    const dir = path.dirname(plistPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(plistPath, plist);
    execSync(`launchctl load "${plistPath}"`, { stdio: 'ignore' });
    return true;
}

function disableMacOS(): boolean {
    const plistPath = getMacPlistPath();
    if (fs.existsSync(plistPath)) {
        try {
            execSync(`launchctl unload "${plistPath}"`, { stdio: 'ignore' });
        } catch { }
        fs.unlinkSync(plistPath);
    }
    return true;
}

function checkMacOS(): boolean {
    return fs.existsSync(getMacPlistPath());
}

// --- Linux: systemd user service ---

function getLinuxServicePath(): string {
    return path.join(os.homedir(), '.config', 'systemd', 'user', 'watcher-daemon.service');
}

function enableLinux(nodePath: string, daemonScript: string): boolean {
    const servicePath = getLinuxServicePath();

    const service = `[Unit]
Description=Watcher Background Daemon
After=default.target

[Service]
ExecStart=${nodePath} ${daemonScript}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
`;

    const dir = path.dirname(servicePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(servicePath, service);
    execSync('systemctl --user daemon-reload', { stdio: 'ignore' });
    execSync('systemctl --user enable watcher-daemon', { stdio: 'ignore' });
    execSync('systemctl --user start watcher-daemon', { stdio: 'ignore' });
    return true;
}

function disableLinux(): boolean {
    try {
        execSync('systemctl --user stop watcher-daemon', { stdio: 'ignore' });
        execSync('systemctl --user disable watcher-daemon', { stdio: 'ignore' });
    } catch { }
    const servicePath = getLinuxServicePath();
    if (fs.existsSync(servicePath)) {
        fs.unlinkSync(servicePath);
    }
    try {
        execSync('systemctl --user daemon-reload', { stdio: 'ignore' });
    } catch { }
    return true;
}

function checkLinux(): boolean {
    return fs.existsSync(getLinuxServicePath());
}
