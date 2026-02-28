import fs from 'fs';
import path from 'path';
import os from 'os';

export interface RegisteredProject {
    path: string;
    name: string;
    addedAt: string;
}

const GLOBAL_DIR = path.join(os.homedir(), '.watcher');
const REGISTRY_FILE = path.join(GLOBAL_DIR, 'projects.json');

function ensureGlobalDir(): void {
    if (!fs.existsSync(GLOBAL_DIR)) {
        fs.mkdirSync(GLOBAL_DIR, { recursive: true });
    }
}

export function getRegistryPath(): string {
    return REGISTRY_FILE;
}

export function getGlobalDir(): string {
    return GLOBAL_DIR;
}

export function loadRegistry(): RegisteredProject[] {
    ensureGlobalDir();
    if (!fs.existsSync(REGISTRY_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(REGISTRY_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

export function saveRegistry(projects: RegisteredProject[]): void {
    ensureGlobalDir();
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(projects, null, 2), 'utf-8');
}

export function addProject(projectPath: string, name: string): void {
    const projects = loadRegistry();
    const normalized = path.resolve(projectPath);

    // Check if already registered
    if (projects.some((p) => path.resolve(p.path) === normalized)) {
        return; // Already registered
    }

    projects.push({
        path: normalized,
        name,
        addedAt: new Date().toISOString(),
    });

    saveRegistry(projects);
}

export function removeProject(projectPath: string): void {
    const projects = loadRegistry();
    const normalized = path.resolve(projectPath);
    const filtered = projects.filter((p) => path.resolve(p.path) !== normalized);
    saveRegistry(filtered);
}

export function isRegistered(projectPath: string): boolean {
    const projects = loadRegistry();
    const normalized = path.resolve(projectPath);
    return projects.some((p) => path.resolve(p.path) === normalized);
}

export function getPidPath(): string {
    ensureGlobalDir();
    return path.join(GLOBAL_DIR, 'daemon.pid');
}

export function getLogPath(): string {
    ensureGlobalDir();
    return path.join(GLOBAL_DIR, 'daemon.log');
}
